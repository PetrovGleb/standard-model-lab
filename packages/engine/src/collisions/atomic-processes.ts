/* Atomic processes at eV–keV energies: an electron (or positron) and a bare nucleus or ion recombine radiatively into the atom by the Kramers cross section summed over shells (Milne relation, Gaunt factor 1), with Rutherford scattering in the acceptance as the alternative; a photon ionizes an atom or ion by the Kramers ground-state cross section or scatters by Thomson on its electrons; the Maxwellian radiative recombination rate ⟨σv⟩ of a hot electron medium. */
import {
  BOHR_RADIUS,
  BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN,
  FINE_STRUCTURE_CONSTANT,
  RYDBERG_CONSTANT_TIMES_PLANCK_CONSTANT_TIMES_SPEED_OF_LIGHT_IN_EV,
  SPEED_OF_LIGHT_IN_VACUUM,
  THOMSON_CROSS_SECTION,
  ionizationEnergyInEv,
  matterIdentity,
  particleSpec,
} from '@standard-model/constants';
import {
  PARTICLE_NAMES,
  type FourMomentumInGev,
  type Particle,
  type ParticleName,
  type ParticleSpec,
  type RandomSource,
} from '@standard-model/contracts';
import {
  addVectors,
  boostFromRest,
  invariantMassInGev,
  sampleIndexByWeights,
} from '@standard-model/utils';
import type { ParticleFactory } from '../particles/particle-factory.js';
import { threeBodyRestFrame, twoBodyRestFrame } from '../decay/phase-space.js';
import type { CollisionEvent, CollisionMechanism, CollisionRequest } from './collisions.js';
import { NANOBARN_PER_INVERSE_GEV_SQUARED } from './cross-sections.js';
import { LocalizedError, localizedText } from '@standard-model/contracts';

const EV_PER_GEV = 1e9;
const SQUARE_METERS_PER_BARN = 1e-28;
const NANOBARN_PER_BARN = 1e9;
const ATOMIC_ENERGY_LIMIT_IN_EV = 1e4;
const DETECTOR_ACCEPTANCE_COSINE = 0.95;
const HALF = 0.5;
const SHELLS = 30;
const KRAMERS_RECOMBINATION_FACTOR = 32 / (3 * Math.sqrt(3));
const KRAMERS_PHOTOIONIZATION_FACTOR = 64 / (3 * Math.sqrt(3));
const REACTIVITY_POINTS = 400;
const REACTIVITY_LOWER_FRACTION = 1e-4;
const REACTIVITY_UPPER_FRACTION = 100;
const RATE_CACHE_LIMIT = 4096;

const RYDBERG = RYDBERG_CONSTANT_TIMES_PLANCK_CONSTANT_TIMES_SPEED_OF_LIGHT_IN_EV.value;
const BOHR_AREA_IN_BARN = (BOHR_RADIUS.value * BOHR_RADIUS.value) / SQUARE_METERS_PER_BARN;
const ATOMS: readonly ParticleSpec[] = PARTICLE_NAMES.map((name) => particleSpec(name)).filter(
  (spec) => spec.family === 'atom',
);

function massInGev(name: ParticleName): number {
  return particleSpec(name).massInGev.value;
}

export function boundLepton(spec: ParticleSpec): ParticleName {
  return spec.pdgId > 0 ? 'electron' : 'positron';
}

function contentOf(name: ParticleName): readonly ParticleName[] {
  const spec = particleSpec(name);
  return spec.family === 'atom' ? (spec.constituents ?? []) : [name];
}

function key(names: readonly ParticleName[]): string {
  return [...names].sort().join('+');
}

export function capturedState(target: ParticleName, lepton: ParticleName): ParticleName | null {
  const wanted = key([...contentOf(target), lepton]);
  return ATOMS.find((atom) => key(atom.constituents ?? []) === wanted)?.name ?? null;
}

export function ionizedState(atom: ParticleName): ParticleName | null {
  const spec = particleSpec(atom);
  if (spec.family !== 'atom') {
    return null;
  }
  const lepton = boundLepton(spec);
  const content = [...(spec.constituents ?? [])];
  content.splice(content.lastIndexOf(lepton), 1);
  if (content.length === 1) {
    return content[0] ?? null;
  }
  const wanted = key(content);
  return ATOMS.find((candidate) => key(candidate.constituents ?? []) === wanted)?.name ?? null;
}

const bindingEnergies = new Map<ParticleName, number>();

export function bindingEnergyInEv(atom: ParticleName): number {
  const cached = bindingEnergies.get(atom);
  if (cached !== undefined) {
    return cached;
  }
  const ion = ionizedState(atom);
  const identity = matterIdentity(atom);
  const energy =
    ion !== null
      ? (massInGev(ion) + massInGev(boundLepton(particleSpec(atom))) - massInGev(atom)) * EV_PER_GEV
      : identity?.kind === 'atom'
        ? (ionizationEnergyInEv(identity.protons, identity.charge) ?? 0)
        : 0;
  bindingEnergies.set(atom, energy);
  return energy;
}

function shellEnergyInEv(ionCharge: number, groundBinding: number, shell: number): number {
  return shell === 1 ? groundBinding : (ionCharge * ionCharge * RYDBERG) / (shell * shell);
}

interface RecombinationShell {
  readonly bindingInEv: number;
  readonly strengthInBarnEvSquared: number;
}

function recombinationShells(ion: ParticleName, atom: ParticleName): readonly RecombinationShell[] {
  const ionCharge = Math.abs(particleSpec(ion).electricChargeInElementaryUnits);
  const ground = bindingEnergyInEv(atom);
  const fineStructure = FINE_STRUCTURE_CONSTANT.value;
  return Array.from({ length: SHELLS }, (ignored, index) => {
    const shell = index + 1;
    const binding = shellEnergyInEv(ionCharge, ground, shell);
    const effectiveFourthPower = ((binding * shell * shell) / RYDBERG) ** 2;
    return {
      bindingInEv: binding,
      strengthInBarnEvSquared:
        (KRAMERS_RECOMBINATION_FACTOR *
          Math.PI *
          fineStructure ** 3 *
          BOHR_AREA_IN_BARN *
          effectiveFourthPower *
          RYDBERG *
          RYDBERG) /
        shell ** 3,
    };
  });
}

function shellCrossSectionInBarn(shell: RecombinationShell, energyInEv: number): number {
  return shell.strengthInBarnEvSquared / (energyInEv * (energyInEv + shell.bindingInEv));
}

function recombinationShellsInBarn(
  ion: ParticleName,
  atom: ParticleName,
  energyInEv: number,
): readonly number[] {
  return recombinationShells(ion, atom).map((shell) => shellCrossSectionInBarn(shell, energyInEv));
}

function photoionizationInBarn(atom: ParticleName, photonEnergyInEv: number): number {
  const ground = bindingEnergyInEv(atom);
  if (photonEnergyInEv < ground) {
    return 0;
  }
  const effectiveSquare = ground / RYDBERG;
  return (
    (KRAMERS_PHOTOIONIZATION_FACTOR *
      Math.PI *
      FINE_STRUCTURE_CONSTANT.value *
      BOHR_AREA_IN_BARN *
      (ground / photonEnergyInEv) ** 3) /
    effectiveSquare
  );
}

function rutherfordInBarn(first: ParticleName, second: ParticleName, energyInEv: number): number {
  const product =
    particleSpec(first).electricChargeInElementaryUnits *
    particleSpec(second).electricChargeInElementaryUnits;
  if (product === 0) {
    return 0;
  }
  const amplitude = (product * FINE_STRUCTURE_CONSTANT.value) / (4 * (energyInEv / EV_PER_GEV));
  const solidAngle = 8 * Math.PI * (1 / (1 - DETECTOR_ACCEPTANCE_COSINE) - HALF);
  return (
    (amplitude * amplitude * solidAngle * NANOBARN_PER_INVERSE_GEV_SQUARED) / NANOBARN_PER_BARN
  );
}

interface AtomicOption {
  readonly products: readonly ParticleName[];
  readonly barn: number;
  readonly kind: 'recombination' | 'elastic' | 'photoionization' | 'thomson';
}

export function isLepton(name: ParticleName): boolean {
  return name === 'electron' || name === 'positron';
}

export class AtomicProcesses implements CollisionMechanism {
  constructor(
    private readonly particles: ParticleFactory,
    private readonly random: RandomSource,
  ) {}

  applies(first: Particle, second: Particle, energyInGev: number): boolean {
    const names = [first.spec.name, second.spec.name];
    const kinetic =
      (energyInGev - massInGev(names[0] as ParticleName) - massInGev(names[1] as ParticleName)) *
      EV_PER_GEV;
    if (!(kinetic <= ATOMIC_ENERGY_LIMIT_IN_EV)) {
      return false;
    }
    return this.options(first.spec.name, second.spec.name, kinetic).length > 0;
  }

  options(first: ParticleName, second: ParticleName, kineticInEv: number): readonly AtomicOption[] {
    const lepton = isLepton(first) ? first : isLepton(second) ? second : null;
    const photonSide = first === 'photon' ? second : second === 'photon' ? first : null;
    if (lepton !== null) {
      const target = lepton === first ? second : first;
      const atom = capturedState(target, lepton);
      if (atom === null) {
        return [];
      }
      const shells = recombinationShellsInBarn(target, atom, kineticInEv);
      return [
        ...shells.map((barn, index) => ({
          products:
            index === 0 ? [atom, 'photon' as const] : [atom, 'photon' as const, 'photon' as const],
          barn,
          kind: 'recombination' as const,
        })),
        {
          products: [lepton, target],
          barn: rutherfordInBarn(lepton, target, kineticInEv),
          kind: 'elastic' as const,
        },
      ].filter((option) => option.barn > 0);
    }
    if (photonSide !== null && particleSpec(photonSide).family === 'atom') {
      const ion = ionizedState(photonSide);
      const photonEnergy = kineticInEv;
      const electrons = (particleSpec(photonSide).constituents ?? []).filter(isLepton).length;
      return [
        ...(ion === null
          ? []
          : [
              {
                products: [ion, boundLepton(particleSpec(photonSide))] as readonly ParticleName[],
                barn: photoionizationInBarn(photonSide, photonEnergy),
                kind: 'photoionization' as const,
              },
            ]),
        {
          products: ['photon', photonSide] as readonly ParticleName[],
          barn: (electrons * THOMSON_CROSS_SECTION.value) / SQUARE_METERS_PER_BARN,
          kind: 'thomson' as const,
        },
      ].filter((option) => option.barn > 0);
    }
    return [];
  }

  collide(first: Particle, second: Particle, request: CollisionRequest): CollisionEvent {
    const total = {
      energy:
        first.kinematics.fourMomentumInGev.energy + second.kinematics.fourMomentumInGev.energy,
      momentum: addVectors(
        first.kinematics.fourMomentumInGev.momentum,
        second.kinematics.fourMomentumInGev.momentum,
      ),
    };
    const energy = invariantMassInGev(total);
    const photonInvolved = first.spec.name === 'photon' || second.spec.name === 'photon';
    const kinetic = photonInvolved
      ? ((energy * energy -
          massInGev(first.spec.name === 'photon' ? second.spec.name : first.spec.name) ** 2) /
          (2 * energy)) *
        EV_PER_GEV
      : (energy - massInGev(first.spec.name) - massInGev(second.spec.name)) * EV_PER_GEV;
    const options = this.options(first.spec.name, second.spec.name, kinetic).filter(
      (option) => request.channel === undefined || option.products.join('+') === request.channel,
    );
    if (options.length === 0) {
      throw new LocalizedError(
        localizedText(
          `${first.spec.name} + ${second.spec.name}: нет атомных каналов${request.channel === undefined ? '' : ` для ${request.channel}`}`,
          `${first.spec.name} + ${second.spec.name}: no atomic channels${request.channel === undefined ? '' : ` for ${request.channel}`}`,
        ),
      );
    }
    const chosen =
      options[
        sampleIndexByWeights(
          options.map((option) => option.barn),
          this.random,
        )
      ];
    if (chosen === undefined) {
      throw new Error('No atomic channel chosen');
    }
    const masses = chosen.products.map(massInGev);
    const restFrame =
      masses.length === 2
        ? twoBodyRestFrame(energy, [masses[0] ?? 0, masses[1] ?? 0], this.random)
        : threeBodyRestFrame(energy, [masses[0] ?? 0, masses[1] ?? 0, masses[2] ?? 0], this.random);
    const position = first.kinematics.positionInFemtometers;
    const products = chosen.products.map((name, index) => {
      const fourMomentum = boostFromRest(restFrame[index] as FourMomentumInGev, total, energy);
      return {
        name,
        fourMomentumInGev: fourMomentum,
        particle: this.particles.create(name, {
          momentumInGev: fourMomentum.momentum,
          positionInFemtometers: position,
        }),
      };
    });
    const symbol = (name: ParticleName): string => particleSpec(name).symbol;
    const byChannel: Record<string, number> = {};
    options.forEach((option) => {
      const channel = option.products.join('+');
      byChannel[channel] = (byChannel[channel] ?? 0) + option.barn * NANOBARN_PER_BARN;
    });
    return {
      process: `${symbol(first.spec.name)} ${symbol(second.spec.name)} → ${chosen.products.map(symbol).join(' ')}`,
      centerOfMassEnergyInGev: energy,
      totalCrossSectionInNanobarns:
        options.reduce((sum, option) => sum + option.barn, 0) * NANOBARN_PER_BARN,
      channelCrossSectionsInNanobarns: byChannel,
      cosineInCenterOfMass: 0,
      products,
      diagrams: [],
    };
  }
}

const radiativeRateCache = new Map<string, number>();

export function radiativeRecombinationRateCoefficientInCubicMetersPerSecond(
  ion: ParticleName,
  lepton: ParticleName,
  temperatureInKelvin: number,
): number {
  const cacheKey = `${ion}:${lepton}:${String(temperatureInKelvin)}`;
  const cached = radiativeRateCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  if (radiativeRateCache.size >= RATE_CACHE_LIMIT) {
    radiativeRateCache.clear();
  }
  const rate = kramersRecombinationRate(ion, lepton, temperatureInKelvin);
  radiativeRateCache.set(cacheKey, rate);
  return rate;
}

function kramersRecombinationRate(
  ion: ParticleName,
  lepton: ParticleName,
  temperatureInKelvin: number,
): number {
  const atom = capturedState(ion, lepton);
  if (atom === null || !(temperatureInKelvin > 0)) {
    return 0;
  }
  const thermal = BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * temperatureInKelvin;
  const reducedMass =
    ((massInGev(ion) * massInGev(lepton)) / (massInGev(ion) + massInGev(lepton))) * EV_PER_GEV;
  const lower = Math.log(thermal * REACTIVITY_LOWER_FRACTION);
  const upper = Math.log(thermal * REACTIVITY_UPPER_FRACTION);
  const step = (upper - lower) / REACTIVITY_POINTS;
  const shells = recombinationShells(ion, atom);
  let integral = 0;
  for (let index = 0; index < REACTIVITY_POINTS; index += 1) {
    const energy = Math.exp(lower + (index + HALF) * step);
    const total = shells.reduce((sum, shell) => sum + shellCrossSectionInBarn(shell, energy), 0);
    const speedFraction = Math.sqrt((2 * energy) / reducedMass);
    const maxwell = 2 * Math.sqrt(energy / Math.PI) * thermal ** -1.5 * Math.exp(-energy / thermal);
    integral += total * speedFraction * maxwell * energy * step;
  }
  return integral * SQUARE_METERS_PER_BARN * SPEED_OF_LIGHT_IN_VACUUM.value;
}
