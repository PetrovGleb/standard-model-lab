/* Neutron transport through a finite medium (one with a thickness) with ENDF/B-VIII.0 data: a free neutron flies exponential free paths of 1/Σ_t, Σ = Σ n_i σ_i(E), until the window ends, it leaves the ball of the medium or it
   hits a nucleus; elastic scattering by two-body kinematics with a centre-of-mass angle of the ENDF mean cosine, inelastic scattering to a Weisskopf evaporation energy, capture with a photon,
   (n,2n), (n,p), (n,α), and fission into a fragment pair drawn from the independent yields with prompt neutrons from the fission spectrum, the energy release coming from the AME masses. */
import {
  SPEED_OF_LIGHT_IN_VACUUM,
  fissionYields,
  matterIdentity,
  moleculeStructureOf,
  neutronData,
  nucleusName,
  particleSpec,
  type EnergyTable,
  type FissionSpectrum,
  type NeutronData,
  type NeutronReaction,
} from '@standard-model/constants';
import {
  localizedText,
  type FourMomentumInGev,
  type LocalizedText,
  type MediumAspect,
  type Particle,
  type ParticleName,
  type RandomSource,
  type Vector3,
} from '@standard-model/contracts';
import {
  EV_PER_GEV,
  addVectors,
  invariantMassInGev,
  sampleIsotropicDirection,
  scaleVector,
  vectorMagnitude,
} from '@standard-model/utils';
import { boostToLab, twoBodyRestFrame } from '../decay/phase-space.js';
import { distanceToEdgeInMeters } from '../environment/medium-extent.js';
import type { ParticleFactory } from '../particles/particle-factory.js';

const SQUARE_METERS_PER_BARN = 1e-28;
const FEMTOMETERS_PER_METER = 1e15;
const MAXIMUM_COLLISIONS = 2000;
const MAXIMUM_FRAGMENT_TRIES = 64;
const EVAPORATION_LEVEL_DENSITY_PER_MEV_PER_NUCLEON = 1 / 8;
const EV_PER_MEV = 1e6;
const HALF = 0.5;
const ALPHA_PROTONS = 2;
const ALPHA_MASS_NUMBER = 4;
const THRESHOLD_REACTIONS: ReadonlySet<NeutronReaction> = new Set(['inelastic', 'twoNeutrons']);
const CHANNELS: readonly NeutronReaction[] = [
  'elastic',
  'inelastic',
  'twoNeutrons',
  'fission',
  'capture',
  'protonEmission',
  'alphaEmission',
];

interface Target {
  readonly data: NeutronData;
  readonly numberDensityPerCubicMeter: number;
}

export interface TransportOutcome {
  readonly kind: 'fission' | 'capture' | 'reaction';
  readonly products: readonly Particle[];
  readonly label: LocalizedText;
}

function interpolated(table: EnergyTable, energyInEv: number): number {
  const [energies, values] = table;
  const last = energies.length - 1;
  if (energyInEv >= (energies[last] ?? 0)) {
    return values[last] ?? 0;
  }
  let low = 0;
  let high = last;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if ((energies[middle] ?? 0) <= energyInEv) {
      low = middle;
    } else {
      high = middle;
    }
  }
  const lower = energies[low] ?? 0;
  const upper = energies[high] ?? lower;
  const share = upper === lower ? 0 : (energyInEv - lower) / (upper - lower);
  return Math.max(0, (values[low] ?? 0) + share * ((values[high] ?? 0) - (values[low] ?? 0)));
}

export function neutronCrossSectionInBarns(
  data: NeutronData,
  reaction: NeutronReaction,
  energyInEv: number,
): number {
  const table = data.crossSectionsInBarns[reaction];
  if (table === undefined) {
    return 0;
  }
  const first = table[0][0] ?? 0;
  const firstValue = table[1][0] ?? 0;
  if (energyInEv >= first) {
    return interpolated(table, energyInEv);
  }
  if (THRESHOLD_REACTIONS.has(reaction) || firstValue === 0 || first > data.resonanceBoundaryInEv) {
    return reaction === 'elastic' ? firstValue : 0;
  }
  return reaction === 'elastic' ? firstValue : firstValue * Math.sqrt(first / energyInEv);
}

function nuclidesOf(species: ParticleName): readonly { protons: number; massNumber: number }[] {
  if (species.startsWith('molecule:')) {
    return moleculeStructureOf(species).atoms;
  }
  const identity = matterIdentity(species);
  return identity === null ? [] : [{ protons: identity.protons, massNumber: identity.massNumber }];
}

export function neutronTargets(medium: MediumAspect): readonly Target[] {
  return medium.components.flatMap((component) =>
    nuclidesOf(component.species).flatMap((nuclide) => {
      const data = neutronData(nuclide.protons, nuclide.massNumber);
      return data === null || !(component.numberDensityPerCubicMeter > 0)
        ? []
        : [{ data, numberDensityPerCubicMeter: component.numberDensityPerCubicMeter }];
    }),
  );
}

function totalOf(data: NeutronData, energyInEv: number): number {
  return CHANNELS.reduce(
    (sum, reaction) => sum + neutronCrossSectionInBarns(data, reaction, energyInEv),
    0,
  );
}

function massOf(name: ParticleName): number {
  return particleSpec(name).massInGev.value;
}

function existing(name: ParticleName): boolean {
  try {
    particleSpec(name);
    return true;
  } catch {
    return false;
  }
}

function rotated(direction: Vector3, cosine: number, random: RandomSource): Vector3 {
  const sine = Math.sqrt(Math.max(0, 1 - cosine * cosine));
  const azimuth = 2 * Math.PI * random.nextUnit();
  const helper = Math.abs(direction.z) < HALF ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
  const first = normalized({
    x: direction.y * helper.z - direction.z * helper.y,
    y: direction.z * helper.x - direction.x * helper.z,
    z: direction.x * helper.y - direction.y * helper.x,
  });
  const second = {
    x: direction.y * first.z - direction.z * first.y,
    y: direction.z * first.x - direction.x * first.z,
    z: direction.x * first.y - direction.y * first.x,
  };
  return normalized(
    addVectors(
      scaleVector(direction, cosine),
      addVectors(
        scaleVector(first, sine * Math.cos(azimuth)),
        scaleVector(second, sine * Math.sin(azimuth)),
      ),
    ),
  );
}

function normalized(vector: Vector3): Vector3 {
  const length = vectorMagnitude(vector);
  return length > 0 ? scaleVector(vector, 1 / length) : { x: 0, y: 0, z: 1 };
}

function henyeyGreensteinCosine(meanCosine: number, random: RandomSource): number {
  const unit = random.nextUnit();
  if (Math.abs(meanCosine) < 1e-6) {
    return 2 * unit - 1;
  }
  const term = (1 - meanCosine ** 2) / (1 - meanCosine + 2 * meanCosine * unit);
  return Math.max(-1, Math.min(1, (1 + meanCosine ** 2 - term ** 2) / (2 * meanCosine)));
}

function evaporationEnergyInEv(
  energyInEv: number,
  massNumber: number,
  random: RandomSource,
): number {
  const temperatureInMev = Math.sqrt(
    energyInEv / EV_PER_MEV / (EVAPORATION_LEVEL_DENSITY_PER_MEV_PER_NUCLEON * massNumber),
  );
  const sampled =
    -temperatureInMev *
    EV_PER_MEV *
    Math.log(Math.max(random.nextUnit() * random.nextUnit(), 1e-300));
  return Math.min(sampled, energyInEv);
}

function spectrumEnergyInEv(
  spectrum: FissionSpectrum | undefined,
  incidentInEv: number,
  random: RandomSource,
): number {
  if (spectrum === undefined) {
    return evaporationEnergyInEv(incidentInEv, 1, random);
  }
  const index = spectrum.incidentEnergiesInEv.reduce(
    (best, energy, position) =>
      Math.abs(Math.log(energy / incidentInEv)) <
      Math.abs(Math.log((spectrum.incidentEnergiesInEv[best] ?? energy) / incidentInEv))
        ? position
        : best,
    0,
  );
  const quantiles = spectrum.quantilesInEv[index] ?? [];
  const position = random.nextUnit() * (quantiles.length - 1);
  const low = Math.floor(position);
  return (
    (quantiles[low] ?? 0) +
    (position - low) * ((quantiles[low + 1] ?? quantiles[low] ?? 0) - (quantiles[low] ?? 0))
  );
}

function kineticEnergyInEv(fourMomentum: FourMomentumInGev, massInGev: number): number {
  return (fourMomentum.energy - massInGev) * EV_PER_GEV;
}

function momentumForEnergy(massInGev: number, kineticInEv: number): number {
  const total = massInGev + kineticInEv / EV_PER_GEV;
  return Math.sqrt(Math.max(total ** 2 - massInGev ** 2, 0));
}

export class NeutronTransport {
  constructor(
    private readonly particles: ParticleFactory,
    private readonly random: RandomSource,
  ) {}

  applies(particle: Particle, medium: MediumAspect): boolean {
    const thickness = medium.thicknessInMeters;
    if (
      particle.spec.name !== 'neutron' ||
      thickness === undefined ||
      neutronTargets(medium).length === 0
    ) {
      return false;
    }
    const position = particle.kinematics.positionInFemtometers;
    return (
      Math.hypot(position.x, position.y, position.z) / FEMTOMETERS_PER_METER < HALF * thickness
    );
  }

  transport(
    neutron: Particle,
    medium: MediumAspect,
    durationInSeconds: number,
    startInFemtometers: Vector3,
  ): TransportOutcome | null {
    const targets = neutronTargets(medium);
    const mass = neutron.spec.massInGev.value;
    let energyInEv = kineticEnergyInEv(neutron.kinematics.fourMomentumInGev, mass);
    let direction = normalized(neutron.kinematics.fourMomentumInGev.momentum);
    let position = startInFemtometers;
    let timeLeft = durationInSeconds;
    for (let collision = 0; collision < MAXIMUM_COLLISIONS; collision += 1) {
      const speed =
        (momentumForEnergy(mass, energyInEv) / (mass + energyInEv / EV_PER_GEV)) *
        SPEED_OF_LIGHT_IN_VACUUM.value;
      const weights = targets.map(
        (target) =>
          target.numberDensityPerCubicMeter *
          totalOf(target.data, energyInEv) *
          SQUARE_METERS_PER_BARN,
      );
      const macroscopic = weights.reduce((sum, weight) => sum + weight, 0);
      const flight =
        macroscopic > 0
          ? -Math.log(1 - this.random.nextUnit()) / macroscopic
          : Number.POSITIVE_INFINITY;
      const edge = distanceToEdgeInMeters(medium, position, direction);
      const reach = speed * timeLeft;
      const travel = Math.min(flight, edge, reach);
      position = addVectors(position, scaleVector(direction, travel * FEMTOMETERS_PER_METER));
      timeLeft -= speed > 0 ? travel / speed : timeLeft;
      if (travel < flight) {
        this.update(neutron, mass, energyInEv, direction, position);
        return null;
      }
      let pick = this.random.nextUnit() * macroscopic;
      const target =
        targets.find((candidate, index) => {
          pick -= weights[index] ?? 0;
          return pick <= 0;
        }) ?? targets[targets.length - 1];
      if (target === undefined) {
        return null;
      }
      const reaction = this.channel(target.data, energyInEv);
      if (reaction === 'elastic') {
        const ratio = target.data.atomicWeightRatio;
        const cosine = henyeyGreensteinCosine(
          target.data.elasticMeanCosine === undefined
            ? 0
            : interpolated(target.data.elasticMeanCosine, energyInEv),
          this.random,
        );
        const scale = ratio ** 2 + 2 * ratio * cosine + 1;
        energyInEv *= scale / (ratio + 1) ** 2;
        direction = rotated(direction, (1 + ratio * cosine) / Math.sqrt(scale), this.random);
        continue;
      }
      if (reaction === 'inelastic') {
        energyInEv = evaporationEnergyInEv(energyInEv, target.data.massNumber, this.random);
        direction = sampleIsotropicDirection(this.random);
        continue;
      }
      this.update(neutron, mass, energyInEv, direction, position);
      return this.react(neutron, target.data, reaction, energyInEv, position);
    }
    this.update(neutron, mass, energyInEv, direction, position);
    return null;
  }

  private update(
    neutron: Particle,
    mass: number,
    energyInEv: number,
    direction: Vector3,
    position: Vector3,
  ): void {
    neutron.setMomentum(scaleVector(direction, momentumForEnergy(mass, energyInEv)));
    neutron.setPosition(position);
  }

  private channel(data: NeutronData, energyInEv: number): NeutronReaction {
    const weights = CHANNELS.map((reaction) =>
      neutronCrossSectionInBarns(data, reaction, energyInEv),
    );
    let pick = this.random.nextUnit() * weights.reduce((sum, weight) => sum + weight, 0);
    return (
      CHANNELS.find((reaction, index) => {
        pick -= weights[index] ?? 0;
        return pick <= 0;
      }) ?? 'elastic'
    );
  }

  private create(name: ParticleName, momentum: FourMomentumInGev, position: Vector3): Particle {
    return this.particles.create(name, {
      momentumInGev: momentum.momentum,
      positionInFemtometers: position,
    });
  }

  private compound(neutron: Particle, data: NeutronData): FourMomentumInGev {
    const incoming = neutron.kinematics.fourMomentumInGev;
    return {
      energy: incoming.energy + massOf(nucleusName(data.protons, data.massNumber)),
      momentum: incoming.momentum,
    };
  }

  private twoBody(
    total: FourMomentumInGev,
    names: readonly [ParticleName, ParticleName],
    position: Vector3,
  ): readonly Particle[] | null {
    const masses: [number, number] = [massOf(names[0]), massOf(names[1])];
    const invariant = invariantMassInGev(total);
    if (!(invariant > masses[0] + masses[1])) {
      return null;
    }
    const lab = boostToLab(twoBodyRestFrame(invariant, masses, this.random), total, invariant);
    return names.map((name, index) => this.create(name, lab[index] ?? total, position));
  }

  private react(
    neutron: Particle,
    data: NeutronData,
    reaction: NeutronReaction,
    energyInEv: number,
    position: Vector3,
  ): TransportOutcome | null {
    const total = this.compound(neutron, data);
    const residual = (protons: number, massNumber: number): ParticleName =>
      nucleusName(protons, massNumber);
    if (reaction === 'fission') {
      return this.fission(neutron, data, energyInEv, total, position);
    }
    const pairs: Partial<Record<NeutronReaction, readonly [ParticleName, ParticleName]>> = {
      capture: [residual(data.protons, data.massNumber + 1), 'photon'],
      protonEmission: [residual(data.protons - 1, data.massNumber), 'proton'],
      alphaEmission: [
        residual(data.protons - ALPHA_PROTONS, data.massNumber + 1 - ALPHA_MASS_NUMBER),
        'alphaParticle',
      ],
      twoNeutrons: [residual(data.protons, data.massNumber - 1), 'neutron'],
    };
    const names = pairs[reaction];
    if (names === undefined || !existing(names[0])) {
      return null;
    }
    const products =
      reaction === 'twoNeutrons'
        ? this.twoNeutrons(total, names[0], energyInEv, data.massNumber, position)
        : this.twoBody(total, names, position);
    if (products === null) {
      return null;
    }
    const label: Partial<Record<NeutronReaction, LocalizedText>> = {
      capture: localizedText('захват нейтрона (n,γ)', 'neutron capture (n,γ)'),
      protonEmission: localizedText('реакция (n,p)', '(n,p) reaction'),
      alphaEmission: localizedText('реакция (n,α)', '(n,α) reaction'),
      twoNeutrons: localizedText('реакция (n,2n)', '(n,2n) reaction'),
    };
    return {
      kind: reaction === 'capture' ? 'capture' : 'reaction',
      products,
      label: label[reaction] ?? localizedText('ядерная реакция', 'nuclear reaction'),
    };
  }

  private twoNeutrons(
    total: FourMomentumInGev,
    nucleus: ParticleName,
    energyInEv: number,
    massNumber: number,
    position: Vector3,
  ): readonly Particle[] | null {
    const neutronMass = massOf('neutron');
    const outgoing = [0, 1].map(() => {
      const kinetic = evaporationEnergyInEv(HALF * energyInEv, massNumber, this.random);
      const momentum = scaleVector(
        sampleIsotropicDirection(this.random),
        momentumForEnergy(neutronMass, kinetic),
      );
      return { energy: neutronMass + kinetic / EV_PER_GEV, momentum };
    });
    const remaining = {
      energy: total.energy - outgoing.reduce((sum, item) => sum + item.energy, 0),
      momentum: outgoing.reduce(
        (sum, item) => addVectors(sum, scaleVector(item.momentum, -1)),
        total.momentum,
      ),
    };
    if (!(invariantMassInGev(remaining) >= massOf(nucleus))) {
      return null;
    }
    return [
      this.create(nucleus, remaining, position),
      ...outgoing.map((momentum) => this.create('neutron', momentum, position)),
    ];
  }

  private fission(
    neutron: Particle,
    data: NeutronData,
    energyInEv: number,
    total: FourMomentumInGev,
    position: Vector3,
  ): TransportOutcome | null {
    const yields = fissionYields(data.protons, data.massNumber);
    const prompt =
      data.promptNeutrons === undefined ? 0 : interpolated(data.promptNeutrons, energyInEv);
    if (yields === null) {
      return null;
    }
    const set = yields.incidentEnergiesInEv.reduce(
      (best, energy, index) =>
        Math.abs(Math.log(energy / Math.max(energyInEv, 1e-5))) <
        Math.abs(
          Math.log((yields.incidentEnergiesInEv[best] ?? energy) / Math.max(energyInEv, 1e-5)),
        )
          ? index
          : best,
      0,
    );
    const fragments = yields.fragments[set] ?? [];
    const sum = fragments.reduce((accumulated, fragment) => accumulated + fragment[2], 0);
    const neutronMass = massOf('neutron');
    const compoundProtons = data.protons;
    const compoundMass = data.massNumber + 1;
    for (let attempt = 0; attempt < MAXIMUM_FRAGMENT_TRIES; attempt += 1) {
      let pick = this.random.nextUnit() * sum;
      const first = fragments.find((fragment) => {
        pick -= fragment[2];
        return pick <= 0;
      });
      if (first === undefined) {
        return null;
      }
      const count =
        Math.floor(prompt) + (this.random.nextUnit() < prompt - Math.floor(prompt) ? 1 : 0);
      const firstName = nucleusName(first[0], first[1]);
      const secondName = nucleusName(compoundProtons - first[0], compoundMass - first[1] - count);
      if (!existing(firstName) || !existing(secondName)) {
        continue;
      }
      const neutrons = Array.from({ length: count }, () => {
        const kinetic = spectrumEnergyInEv(data.fissionSpectrum, energyInEv, this.random);
        return {
          energy: neutronMass + kinetic / EV_PER_GEV,
          momentum: scaleVector(
            sampleIsotropicDirection(this.random),
            momentumForEnergy(neutronMass, kinetic),
          ),
        };
      });
      const remaining = {
        energy: total.energy - neutrons.reduce((accumulated, item) => accumulated + item.energy, 0),
        momentum: neutrons.reduce(
          (accumulated, item) => addVectors(accumulated, scaleVector(item.momentum, -1)),
          total.momentum,
        ),
      };
      const pair = this.twoBody(remaining, [firstName, secondName], position);
      if (pair === null) {
        continue;
      }
      return {
        kind: 'fission',
        products: [
          ...pair,
          ...neutrons.map((momentum) => this.create('neutron', momentum, position)),
        ],
        label: localizedText(
          `деление ${particleSpec(nucleusName(data.protons, data.massNumber)).symbol}: ${String(count)} нейтрона`,
          `fission of ${particleSpec(nucleusName(data.protons, data.massNumber)).symbol}: ${String(count)} neutrons`,
        ),
      };
    }
    return null;
  }
}
