/* Radiation influences: irradiate shines a photon beam of given frequency, power and beam area on the targets (photoionization, Compton ionization and photonuclear knockout for atoms and nuclei; rotational, infrared and electronic absorption, heating, photodissociation and thermal break-up for molecules); laserCool runs Doppler cooling on a closed NIST transition toward the Doppler limit. */
import {
  BOLTZMANN_CONSTANT,
  BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN,
  ELECTRON_MASS,
  ELECTRON_VOLT,
  ELEMENTARY_CHARGE,
  PLANCK_CONSTANT_IN_EV_PER_HERTZ,
  REDUCED_PLANCK_CONSTANT,
  SPEED_OF_LIGHT_IN_VACUUM,
  VACUUM_ELECTRIC_PERMITTIVITY,
  atomName,
  coolingTransitionOf,
  ionizationEnergyInEv,
  matterIdentity,
  restMassInGev,
  type MatterIdentity,
} from '@standard-model/constants';
import {
  LocalizedError,
  localizedText,
  type FourMomentumInGev,
  type Influence,
  type InfluenceOutcome,
  type InfluenceReaction,
  type LocalizedText,
  type MediumAspect,
  type Particle,
  type ParticleName,
  type RandomSource,
} from '@standard-model/contracts';
import {
  EV_PER_GEV,
  addVectors,
  invariantMassInGev,
  sampleExponentialTime,
  sampleGaussian,
  scaleVector,
  vectorMagnitude,
} from '@standard-model/utils';
import { boostToLab, twoBodyRestFrame } from '../decay/phase-space.js';
import {
  absorbedPower,
  bondDissociationRatesPerSecond,
  moleculeCollisionRatePerSecond,
  fragmentsAfterBreaking,
  heatedTemperature,
} from '../molecules/molecular-behaviour.js';
import { Molecule } from '../particles/molecule.js';
import {
  comptonCrossSectionInSquareMeters,
  photoionizationCrossSectionInSquareMeters,
  photonuclearChannel,
} from '../radiation/photon-absorption.js';
import { heatedMedium, photonAttenuationPerMeter } from '../environment/medium-extent.js';
import { molecularStructure } from '../molecules/molecular-structure.js';
import { unchanged, type EngineInfluenceContext } from './context.js';

const TRK_SUM_PER_ELECTRON_IN_SQUARE_METER_EV =
  (Math.PI * ELEMENTARY_CHARGE.value * REDUCED_PLANCK_CONSTANT.value) /
  (2 * VACUUM_ELECTRIC_PERMITTIVITY.value * ELECTRON_MASS.value * SPEED_OF_LIGHT_IN_VACUUM.value);
const BOND_ELECTRONS = 2;
const METERS_PER_NANOMETER = 1e-9;
const CLUSTER_SHARE = 0.5;

export interface BeamSettings {
  readonly frequencyInHertz: number;
  readonly powerInWatts: number;
  readonly beamAreaInSquareMeters: number;
  readonly durationInSeconds: number;
}

function photonFourMomentum(energyInEv: number): FourMomentumInGev {
  const energy = energyInEv / EV_PER_GEV;
  return { energy, momentum: { x: 0, y: 0, z: energy } };
}

function splitMomenta(
  total: FourMomentumInGev,
  masses: readonly number[],
  random: RandomSource,
): FourMomentumInGev[] {
  const [first = 0, ...rest] = masses;
  if (rest.length === 0) {
    return [total];
  }
  const invariant = invariantMassInGev(total);
  const restSum = rest.reduce((sum, mass) => sum + mass, 0);
  const clusterMass =
    rest.length === 1
      ? restSum
      : restSum + CLUSTER_SHARE * Math.max(0, invariant - first - restSum);
  const [head, cluster] = boostToLab(
    twoBodyRestFrame(invariant, [first, clusterMass], random),
    total,
    invariant,
  );
  if (head === undefined || cluster === undefined) {
    throw new Error('Two-body split failed');
  }
  return [head, ...splitMomenta(cluster, rest, random)];
}

function dissociationEnergyInEv(molecule: Molecule, fragments: readonly ParticleName[]): number {
  const bondEnergy =
    (fragments.reduce((sum, name) => sum + restMassInGev(name), 0) -
      molecule.spec.massInGev.value) *
    EV_PER_GEV;
  return (
    Math.max(0, bondEnergy) +
    BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * molecule.internalTemperatureInKelvin
  );
}

function react(
  parent: Particle,
  productNames: readonly ParticleName[],
  photonEnergyInEv: number,
  label: LocalizedText,
  context: EngineInfluenceContext,
  internalEnergyInEv = 0,
): InfluenceReaction {
  const start = parent.kinematics.fourMomentumInGev;
  const photon = photonFourMomentum(photonEnergyInEv);
  const total = {
    energy: start.energy + photon.energy + internalEnergyInEv / EV_PER_GEV,
    momentum: addVectors(start.momentum, photon.momentum),
  };
  const momenta = splitMomenta(
    total,
    productNames.map((name) => restMassInGev(name)),
    context.random,
  );
  const products = productNames.map((name, index) =>
    context.particles.create(name, {
      momentumInGev: momenta[index]?.momentum ?? { x: 0, y: 0, z: 0 },
      positionInFemtometers: parent.kinematics.positionInFemtometers,
    }),
  );
  return { parent, products, label };
}

interface AbsorptionChannel {
  readonly crossSectionInSquareMeters: number;
  readonly products: readonly ParticleName[];
  readonly label: LocalizedText;
}

function atomChannels(identity: MatterIdentity, photonEnergyInEv: number): AbsorptionChannel[] {
  const electrons = identity.protons - identity.charge;
  const channels: AbsorptionChannel[] = [];
  const binding = electrons > 0 ? ionizationEnergyInEv(identity.protons, identity.charge) : null;
  if (binding !== null && photonEnergyInEv > binding) {
    const ion = atomName(identity.protons, identity.massNumber, identity.charge + 1);
    channels.push({
      crossSectionInSquareMeters: photoionizationCrossSectionInSquareMeters(
        identity.protons,
        electrons,
        photonEnergyInEv,
        binding,
      ),
      products: [ion, 'electron'],
      label: localizedText('фотоионизация', 'photoionization'),
    });
    channels.push({
      crossSectionInSquareMeters: electrons * comptonCrossSectionInSquareMeters(photonEnergyInEv),
      products: [ion, 'electron', 'photon'],
      label: localizedText('комптоновская ионизация', 'Compton ionization'),
    });
  }
  const nuclear = photonuclearChannel(identity.protons, identity.massNumber, photonEnergyInEv);
  if (nuclear !== null) {
    const daughterProtons = nuclear.emitted === 'proton' ? identity.protons - 1 : identity.protons;
    const keptElectrons = Math.min(electrons, daughterProtons);
    channels.push({
      crossSectionInSquareMeters: nuclear.crossSectionInSquareMeters,
      products: [
        atomName(daughterProtons, identity.massNumber - 1, daughterProtons - keptElectrons),
        nuclear.emitted,
        ...Array.from({ length: electrons - keptElectrons }, (): ParticleName => 'electron'),
      ],
      label:
        nuclear.emitted === 'neutron'
          ? localizedText('фоторасщепление (γ,n)', 'photodisintegration (γ,n)')
          : localizedText('фоторасщепление (γ,p)', 'photodisintegration (γ,p)'),
    });
  }
  return channels.filter((channel) => channel.crossSectionInSquareMeters > 0);
}

function moleculeChannels(molecule: Molecule, photonEnergyInEv: number): AbsorptionChannel[] {
  const structure = molecule.structure;
  const weakest = structure.bonds
    .map((bond, index) => ({ index, energy: bond.dissociationEnergyInEv }))
    .sort((first, second) => first.energy - second.energy)[0];
  const lowestIonization = Math.min(
    ...structure.atoms.map(
      (atom) => ionizationEnergyInEv(atom.protons, 0) ?? Number.POSITIVE_INFINITY,
    ),
  );
  const channels: AbsorptionChannel[] = [];
  if (
    weakest !== undefined &&
    photonEnergyInEv >= weakest.energy &&
    photonEnergyInEv < lowestIonization
  ) {
    channels.push({
      crossSectionInSquareMeters:
        (TRK_SUM_PER_ELECTRON_IN_SQUARE_METER_EV * BOND_ELECTRONS) /
        (lowestIonization - weakest.energy),
      products: fragmentsAfterBreaking(molecule.spec.name, [weakest.index]),
      label: localizedText('фотодиссоциация', 'photodissociation'),
    });
  }
  structure.atoms.forEach((atom, index) => {
    const binding = ionizationEnergyInEv(atom.protons, 0);
    if (binding === null || photonEnergyInEv <= binding) {
      return;
    }
    const others = structure.atoms
      .filter((unused, position) => position !== index)
      .map((other) => atomName(other.protons, other.massNumber, 0));
    channels.push({
      crossSectionInSquareMeters: photoionizationCrossSectionInSquareMeters(
        atom.protons,
        atom.protons,
        photonEnergyInEv,
        binding,
      ),
      products: [atomName(atom.protons, atom.massNumber, 1), 'electron', ...others],
      label: localizedText(
        `диссоциативная фотоионизация ${atom.symbol}`,
        `dissociative photoionization ${atom.symbol}`,
      ),
    });
  });
  return channels.filter((channel) => channel.crossSectionInSquareMeters > 0);
}

export class Irradiate implements Influence<EngineInfluenceContext> {
  readonly name = 'irradiate';

  constructor(private readonly beam: BeamSettings) {
    if (beam.frequencyInHertz <= 0 || beam.powerInWatts < 0 || beam.beamAreaInSquareMeters <= 0) {
      throw new LocalizedError(
        localizedText(
          'облучению нужны положительные частота и площадь пучка и неотрицательная мощность',
          'irradiate needs a positive frequency and beam area and a non-negative power',
        ),
      );
    }
  }

  apply(targets: readonly Particle[], context: EngineInfluenceContext): InfluenceOutcome {
    const photonEnergyInEv = PLANCK_CONSTANT_IN_EV_PER_HERTZ.value * this.beam.frequencyInHertz;
    const intensity = this.beam.powerInWatts / this.beam.beamAreaInSquareMeters;
    const photonFlux = intensity / (photonEnergyInEv * ELECTRON_VOLT.value);
    const fluence = photonFlux * this.beam.durationInSeconds;
    const reactions: InfluenceReaction[] = [];
    const notes: string[] = [];
    targets
      .filter((particle) => particle.status === 'alive')
      .forEach((particle) => {
        if (particle instanceof Molecule) {
          this.heat(particle, intensity, context);
        }
        const identity = matterIdentity(particle.spec.name);
        const channels =
          particle instanceof Molecule
            ? moleculeChannels(particle, photonEnergyInEv)
            : identity === null
              ? []
              : atomChannels(identity, photonEnergyInEv);
        const total = channels.reduce(
          (sum, channel) => sum + channel.crossSectionInSquareMeters,
          0,
        );
        if (total > 0 && context.random.nextUnit() < -Math.expm1(-total * fluence)) {
          let pick = context.random.nextUnit() * total;
          const chosen =
            channels.find((channel) => {
              pick -= channel.crossSectionInSquareMeters;
              return pick <= 0;
            }) ?? channels[channels.length - 1];
          if (chosen !== undefined) {
            reactions.push(
              react(particle, chosen.products, photonEnergyInEv, chosen.label, context),
            );
            return;
          }
        }
        if (particle instanceof Molecule) {
          const broken = this.breakThermally(particle, context.random);
          if (broken !== null) {
            reactions.push(
              react(
                particle,
                broken,
                0,
                localizedText('тепловая диссоциация', 'thermal dissociation'),
                context,
                dissociationEnergyInEv(particle, broken),
              ),
            );
          }
        }
        if (channels.length === 0 && !(particle instanceof Molecule)) {
          notes.push(
            `${particle.spec.symbol} does not absorb ${photonEnergyInEv.toPrecision(3)} eV photons`,
          );
        }
      });
    const medium = context.environment.get('medium');
    return {
      environment:
        medium?.thicknessInMeters === undefined
          ? context.environment
          : context.environment.with(
              'medium',
              heatedMedium(medium, this.energyAbsorbedBy(medium, photonEnergyInEv, intensity)),
            ),
      notes,
      reactions,
    };
  }

  private energyAbsorbedBy(
    medium: MediumAspect,
    photonEnergyInEv: number,
    intensity: number,
  ): number {
    const angularFrequency = 2 * Math.PI * this.beam.frequencyInHertz;
    const molecular = medium.components
      .filter((component) => component.species.startsWith('molecule:'))
      .reduce((sum, component) => {
        const structure = molecularStructure(component.species);
        const heating = absorbedPower(
          structure,
          angularFrequency,
          intensity,
          medium.temperatureInKelvin,
          moleculeCollisionRatePerSecond(structure, medium, medium.temperatureInKelvin),
        );
        return (
          sum +
          (component.numberDensityPerCubicMeter *
            (heating.rotationalWatts + heating.vibrationalWatts)) /
            intensity
        );
      }, 0);
    const attenuation = photonAttenuationPerMeter(medium, photonEnergyInEv) + molecular;
    return (
      this.beam.powerInWatts *
      this.beam.durationInSeconds *
      -Math.expm1(-attenuation * (medium.thicknessInMeters ?? 0))
    );
  }

  private heat(molecule: Molecule, intensity: number, context: EngineInfluenceContext): void {
    const structure = molecule.structure;
    const medium = context.environment.get('medium');
    const gas = context.environment.get('temperature')?.temperatureInKelvin ?? 0;
    const angularFrequency = 2 * Math.PI * this.beam.frequencyInHertz;
    molecule.internalTemperatureInKelvin = heatedTemperature(
      structure,
      molecule.internalTemperatureInKelvin,
      this.beam.durationInSeconds,
      (temperature) => {
        const collisions =
          medium === undefined
            ? 0
            : moleculeCollisionRatePerSecond(structure, medium, Math.max(temperature, gas));
        const power = absorbedPower(
          structure,
          angularFrequency,
          intensity,
          temperature,
          collisions,
        );
        return power.rotationalWatts + power.vibrationalWatts;
      },
    );
  }

  private breakThermally(molecule: Molecule, random: RandomSource): ParticleName[] | null {
    const rates = bondDissociationRatesPerSecond(
      molecule.structure,
      molecule.internalTemperatureInKelvin,
    );
    const total = rates.reduce((sum, rate) => sum + rate, 0);
    if (total <= 0 || sampleExponentialTime(1 / total, random) > this.beam.durationInSeconds) {
      return null;
    }
    let pick = random.nextUnit() * total;
    const bond = rates.findIndex((rate) => {
      pick -= rate;
      return pick <= 0;
    });
    return fragmentsAfterBreaking(molecule.spec.name, [Math.max(bond, 0)]);
  }
}

export interface CoolingSettings {
  readonly detuningInLinewidths: number;
  readonly saturationParameter: number;
  readonly durationInSeconds: number;
}

export class LaserCool implements Influence<EngineInfluenceContext> {
  readonly name = 'laserCool';

  constructor(private readonly settings: CoolingSettings) {
    if (settings.detuningInLinewidths >= 0) {
      throw new LocalizedError(
        localizedText(
          'доплеровскому охлаждению нужна красная отстройка: detuningInLinewidths должен быть отрицательным',
          'Doppler cooling needs red detuning: detuningInLinewidths must be negative',
        ),
      );
    }
  }

  apply(targets: readonly Particle[], context: EngineInfluenceContext): InfluenceOutcome {
    const notes: string[] = [];
    targets.forEach((particle) => {
      const identity = matterIdentity(particle.spec.name);
      const transition =
        identity === null || identity.kind !== 'atom'
          ? null
          : coolingTransitionOf(identity.protons, identity.charge);
      if (transition === null) {
        throw new LocalizedError(
          localizedText(
            `у ${particle.spec.symbol} нет замкнутого перехода для охлаждения в данных NIST`,
            `${particle.spec.symbol} has no closed cooling transition in the NIST data`,
          ),
        );
      }
      const linewidth = transition.einsteinCoefficientPerSecond;
      const wavenumber = (2 * Math.PI) / (transition.wavelengthInNanometers * METERS_PER_NANOMETER);
      const detuning = this.settings.detuningInLinewidths * linewidth;
      const saturation = this.settings.saturationParameter;
      const lineFactor = 1 + saturation + ((2 * detuning) / linewidth) ** 2;
      const massInKilograms =
        (particle.spec.massInGev.value * EV_PER_GEV * ELECTRON_VOLT.value) /
        SPEED_OF_LIGHT_IN_VACUUM.value ** 2;
      const damping =
        (-8 * REDUCED_PLANCK_CONSTANT.value * wavenumber ** 2 * detuning * saturation) /
        (linewidth * lineFactor ** 2);
      const dopplerTemperature =
        ((REDUCED_PLANCK_CONSTANT.value * linewidth) / (4 * BOLTZMANN_CONSTANT.value)) *
        (lineFactor / (2 * Math.abs(detuning / linewidth)));
      const capture = linewidth / wavenumber;
      const maximumDeceleration =
        ((REDUCED_PLANCK_CONSTANT.value * wavenumber * linewidth) / (2 * massInKilograms)) *
        (saturation / (1 + saturation));
      const momentumToSpeed =
        (EV_PER_GEV * ELECTRON_VOLT.value) / SPEED_OF_LIGHT_IN_VACUUM.value / massInKilograms;
      const momentum = particle.kinematics.fourMomentumInGev.momentum;
      const speed = vectorMagnitude(momentum) * momentumToSpeed;
      let remaining = this.settings.durationInSeconds;
      let slowed = speed;
      if (speed > capture) {
        const slowingTime = (speed - capture) / maximumDeceleration;
        slowed = speed - maximumDeceleration * Math.min(slowingTime, remaining);
        remaining = Math.max(0, remaining - slowingTime);
      }
      const decay = Math.exp((-damping * remaining) / massInKilograms);
      const thermalSpread =
        Math.sqrt((BOLTZMANN_CONSTANT.value * dopplerTemperature) / massInKilograms) *
        Math.sqrt(1 - decay * decay);
      const direction =
        speed > 0 ? scaleVector(momentum, 1 / vectorMagnitude(momentum)) : { x: 0, y: 0, z: 0 };
      const mean = scaleVector(direction, slowed * decay);
      const velocity = {
        x: mean.x + sampleGaussian(thermalSpread, context.random),
        y: mean.y + sampleGaussian(thermalSpread, context.random),
        z: mean.z + sampleGaussian(thermalSpread, context.random),
      };
      particle.setMomentum(scaleVector(velocity, 1 / momentumToSpeed));
      notes.push(
        `${particle.spec.symbol}: Doppler limit ${dopplerTemperature.toPrecision(3)} K on ${transition.wavelengthInNanometers.toFixed(3)} nm`,
      );
    });
    return unchanged(context, notes);
  }
}
