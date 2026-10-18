/* Charge balance of an atom or ion with the electron (or positron) component of a medium: electron-impact ionization by the Voronov 1997 fit plus photoionization by the Planck photons of the radiation field, radiative recombination at the Kramers rate and three-body recombination from detailed balance with ionization, all at an effective temperature that adds the drift through the medium;
   continuum lowering by the Debye–Hückel or ion-sphere potential of the plasma, whichever is smaller, removes the bound levels a dense plasma cannot hold, so there is no recombination into them; builds the chain of charge states, its rates and the products of a sampled change of charge. */
import {
  BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN,
  FINE_STRUCTURE_CONSTANT,
  PLANCK_CONSTANT_IN_EV_PER_HERTZ,
  REDUCED_PLANCK_CONSTANT_IN_EV_SECOND,
  SPEED_OF_LIGHT_IN_VACUUM,
  collisionalIonizationFit,
  groundStatisticalWeight,
  particleSpec,
} from '@standard-model/constants';
import {
  localizedText,
  type FourMomentumInGev,
  type LocalizedText,
  type MediumAspect,
  type MediumComponent,
  type Particle,
  type ParticleName,
  type RandomSource,
  type Vector3,
} from '@standard-model/contracts';
import {
  boostFromRest,
  dotProduct,
  sampleGaussian,
  sampleIsotropicDirection,
  scaleVector,
  subtractVectors,
} from '@standard-model/utils';
import type { ParticleFactory } from '../particles/particle-factory.js';
import { photoionizationCrossSectionInSquareMeters } from '../radiation/photon-absorption.js';
import {
  bindingEnergyInEv,
  boundLepton,
  capturedState,
  ionizedState,
  isLepton,
  radiativeRecombinationRateCoefficientInCubicMetersPerSecond,
} from './atomic-processes.js';

const EV_PER_GEV = 1e9;
const CUBIC_METERS_PER_CUBIC_CENTIMETER = 1e-6;
const ELECTRON_SPIN_STATES = 2;
const DRIFT_DEGREES_OF_FREEDOM = 3;
const LABEL_PRECISION = 5;

export interface ChargeExchangeProduct {
  readonly name: ParticleName;
  readonly particle: Particle;
  readonly fourMomentumInGev: FourMomentumInGev;
}

export interface ChargeExchange {
  readonly kind: 'ionization' | 'recombination';
  readonly products: readonly ChargeExchangeProduct[];
  readonly label: LocalizedText;
}

export interface ChargeChain {
  readonly states: readonly ParticleName[];
  readonly startIndex: number;
}

export interface ChargeChainRates {
  readonly ionizationPerSecond: readonly number[];
  readonly radiativePerSecond: readonly number[];
  readonly threeBodyPerSecond: readonly number[];
}

interface AtomIdentity {
  readonly protons: number;
  readonly electrons: number;
}

function massInGev(name: ParticleName): number {
  return particleSpec(name).massInGev.value;
}

function identityOf(atom: ParticleName): AtomIdentity | null {
  const spec = particleSpec(atom);
  const constituents = spec.family === 'atom' ? (spec.constituents ?? []) : [];
  const nucleus = constituents.find((name) => !isLepton(name));
  return nucleus === undefined
    ? null
    : {
        protons: Math.abs(particleSpec(nucleus).electricChargeInElementaryUnits),
        electrons: constituents.filter(isLepton).length,
      };
}

function canIonize(state: ParticleName, lepton: ParticleName): boolean {
  const spec = particleSpec(state);
  return spec.family === 'atom' && boundLepton(spec) === lepton;
}

function voronovTerms(
  atom: ParticleName,
  temperatureInKelvin: number,
): { readonly prefactor: number; readonly thresholdInEv: number } | null {
  const identity = identityOf(atom);
  const fit =
    identity === null ? null : collisionalIonizationFit(identity.protons, identity.electrons);
  if (fit === null || !(temperatureInKelvin > 0)) {
    return null;
  }
  const reduced =
    fit.thresholdInEv / (BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * temperatureInKelvin);
  return {
    prefactor:
      ((fit.amplitudeInCubicCentimetersPerSecond *
        (1 + fit.squareRootCoefficient * Math.sqrt(reduced))) /
        (fit.denominatorOffset + reduced)) *
      reduced ** fit.exponent *
      CUBIC_METERS_PER_CUBIC_CENTIMETER,
    thresholdInEv: fit.thresholdInEv,
  };
}

export function electronImpactIonizationRateCoefficientInCubicMetersPerSecond(
  atom: ParticleName,
  temperatureInKelvin: number,
): number {
  const terms = voronovTerms(atom, temperatureInKelvin);
  return terms === null
    ? 0
    : terms.prefactor *
        Math.exp(
          -terms.thresholdInEv / (BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * temperatureInKelvin),
        );
}

export function thermalWavelengthInMeters(
  lepton: ParticleName,
  temperatureInKelvin: number,
): number {
  return (
    (PLANCK_CONSTANT_IN_EV_PER_HERTZ.value * SPEED_OF_LIGHT_IN_VACUUM.value) /
    Math.sqrt(
      2 *
        Math.PI *
        massInGev(lepton) *
        EV_PER_GEV *
        BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value *
        temperatureInKelvin,
    )
  );
}

export function threeBodyRecombinationRateCoefficientInMetersToTheSixthPerSecond(
  atom: ParticleName,
  lepton: ParticleName,
  temperatureInKelvin: number,
): number {
  const identity = identityOf(atom);
  const terms = voronovTerms(atom, temperatureInKelvin);
  if (identity === null || terms === null) {
    return 0;
  }
  const charge = identity.protons - identity.electrons;
  const atomWeight = groundStatisticalWeight(identity.protons, charge);
  const ionWeight = groundStatisticalWeight(identity.protons, charge + 1);
  if (atomWeight === null || ionWeight === null) {
    return 0;
  }
  const thermal = BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * temperatureInKelvin;
  return (
    terms.prefactor *
    Math.exp((bindingEnergyInEv(atom) - terms.thresholdInEv) / thermal) *
    (atomWeight / (ELECTRON_SPIN_STATES * ionWeight)) *
    thermalWavelengthInMeters(lepton, temperatureInKelvin) ** 3
  );
}

export function effectiveTemperatureInKelvin(
  particle: Particle,
  medium: MediumAspect,
  lepton: ParticleName,
): number {
  const { energy, momentum } = particle.kinematics.fourMomentumInGev;
  const drift = subtractVectors(
    scaleVector(momentum, 1 / energy),
    scaleVector(medium.bulkVelocityInMetersPerSecond, 1 / SPEED_OF_LIGHT_IN_VACUUM.value),
  );
  return (
    medium.temperatureInKelvin +
    (massInGev(lepton) * EV_PER_GEV * dotProduct(drift, drift)) /
      (DRIFT_DEGREES_OF_FREEDOM * BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value)
  );
}

export function chargeChain(start: ParticleName, lepton: ParticleName): ChargeChain {
  const bound: ParticleName[] = [];
  for (
    let current = capturedState(start, lepton);
    current !== null;
    current = capturedState(current, lepton)
  ) {
    bound.unshift(current);
  }
  const freed: ParticleName[] = [];
  for (
    let current = canIonize(start, lepton) ? ionizedState(start) : null;
    current !== null;
    current = canIonize(current, lepton) ? ionizedState(current) : null
  ) {
    freed.push(current);
  }
  return { states: [...bound, start, ...freed], startIndex: bound.length };
}

const COULOMB_ENERGY_IN_EV_METERS =
  FINE_STRUCTURE_CONSTANT.value *
  REDUCED_PLANCK_CONSTANT_IN_EV_SECOND.value *
  SPEED_OF_LIGHT_IN_VACUUM.value;
const ION_SPHERE_LOWERING_FACTOR = 3 / 2;

export function continuumLoweringInEv(
  ionCharge: number,
  components: readonly MediumComponent[],
  temperatureInKelvin: number,
): number {
  const electrons = components
    .filter((component) => isLepton(component.species))
    .reduce((sum, component) => sum + component.numberDensityPerCubicMeter, 0);
  if (!(electrons > 0) || !(temperatureInKelvin > 0) || ionCharge <= 0) {
    return 0;
  }
  const chargeWeightedDensity = components.reduce(
    (sum, component) =>
      sum +
      component.numberDensityPerCubicMeter *
        particleSpec(component.species).electricChargeInElementaryUnits ** 2,
    0,
  );
  const thermalInEv = BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * temperatureInKelvin;
  const debyeLengthInMeters = Math.sqrt(
    thermalInEv / (4 * Math.PI * COULOMB_ENERGY_IN_EV_METERS * chargeWeightedDensity),
  );
  const debyeHuckel = (ionCharge * COULOMB_ENERGY_IN_EV_METERS) / debyeLengthInMeters;
  const ionSphereRadiusInMeters = Math.cbrt((3 * ionCharge) / (4 * Math.PI * electrons));
  const ionSphere =
    (ION_SPHERE_LOWERING_FACTOR * ionCharge * COULOMB_ENERGY_IN_EV_METERS) /
    ionSphereRadiusInMeters;
  return Math.min(debyeHuckel, ionSphere);
}

const PLANCK_SPECTRUM_POINTS = 240;
const PLANCK_SPECTRUM_SPAN_IN_THERMAL_UNITS = 40;
const SPHERE_FULL_SOLID_ANGLE_PHASE_SPACE = 8 * Math.PI;

function photonNumberDensityPerElectronVolt(
  energyInEv: number,
  radiationTemperatureInKelvin: number,
): number {
  const planckLengthScaleInEvMeters =
    PLANCK_CONSTANT_IN_EV_PER_HERTZ.value * SPEED_OF_LIGHT_IN_VACUUM.value;
  const thermalInEv = BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * radiationTemperatureInKelvin;
  return (
    (SPHERE_FULL_SOLID_ANGLE_PHASE_SPACE * energyInEv * energyInEv) /
    (planckLengthScaleInEvMeters ** 3 * Math.expm1(energyInEv / thermalInEv))
  );
}

export function thermalPhotoionizationRatePerSecond(
  atom: ParticleName,
  radiationTemperatureInKelvin: number,
): number {
  const identity = identityOf(atom);
  if (identity === null || !(radiationTemperatureInKelvin > 0)) {
    return 0;
  }
  const threshold = bindingEnergyInEv(atom);
  const thermalInEv = BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * radiationTemperatureInKelvin;
  const top = threshold + PLANCK_SPECTRUM_SPAN_IN_THERMAL_UNITS * thermalInEv;
  const step = Math.log(top / threshold) / PLANCK_SPECTRUM_POINTS;
  let integral = 0;
  for (let index = 0; index < PLANCK_SPECTRUM_POINTS; index += 1) {
    const energyInEv = threshold * Math.exp((index + 1 / 2) * step);
    integral +=
      photoionizationCrossSectionInSquareMeters(
        identity.protons,
        identity.electrons,
        energyInEv,
        threshold,
      ) *
      photonNumberDensityPerElectronVolt(energyInEv, radiationTemperatureInKelvin) *
      energyInEv *
      step;
  }
  return integral * SPEED_OF_LIGHT_IN_VACUUM.value;
}

export function chargeChainRates(
  states: readonly ParticleName[],
  lepton: MediumComponent,
  temperatureInKelvin: number,
  components: readonly MediumComponent[] = [lepton],
  radiationTemperatureInKelvin = 0,
): ChargeChainRates {
  const density = lepton.numberDensityPerCubicMeter;
  const pairs = states.slice(1).map((ion, index) => [states[index] ?? ion, ion] as const);
  const bound = pairs.map(
    ([atom, ion]) =>
      bindingEnergyInEv(atom) >
      continuumLoweringInEv(
        Math.abs(particleSpec(ion).electricChargeInElementaryUnits),
        components,
        temperatureInKelvin,
      ),
  );
  return {
    ionizationPerSecond: pairs.map(
      ([atom]) =>
        density *
          electronImpactIonizationRateCoefficientInCubicMetersPerSecond(atom, temperatureInKelvin) +
        thermalPhotoionizationRatePerSecond(atom, radiationTemperatureInKelvin),
    ),
    radiativePerSecond: pairs.map(([, ion], index) =>
      bound[index] !== true
        ? 0
        : density *
          radiativeRecombinationRateCoefficientInCubicMetersPerSecond(
            ion,
            lepton.species,
            temperatureInKelvin,
          ),
    ),
    threeBodyPerSecond: pairs.map(([atom], index) =>
      bound[index] !== true
        ? 0
        : density *
          density *
          threeBodyRecombinationRateCoefficientInMetersToTheSixthPerSecond(
            atom,
            lepton.species,
            temperatureInKelvin,
          ),
    ),
  };
}

export function chargeChainGenerator(rates: ChargeChainRates): number[][] {
  const size = rates.ionizationPerSecond.length + 1;
  const generator = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
  rates.ionizationPerSecond.forEach((ionization, index) => {
    const recombination =
      (rates.radiativePerSecond[index] ?? 0) + (rates.threeBodyPerSecond[index] ?? 0);
    const lower = generator[index];
    const upper = generator[index + 1];
    if (lower !== undefined && upper !== undefined) {
      lower[index + 1] = ionization;
      upper[index] = recombination;
    }
  });
  return generator.map((row, index) =>
    row.map((rate, column) =>
      column === index
        ? -row.reduce((sum, value, other) => sum + (other === index ? 0 : value), 0)
        : rate,
    ),
  );
}

function bindingLabel(equations: readonly string[], energyInEv: number): LocalizedText {
  const energy = String(Number(energyInEv.toPrecision(LABEL_PRECISION)));
  return localizedText(
    `${equations.join('; ')}, ${energy} эВ`,
    `${equations.join('; ')}, ${energy} eV`,
  );
}

export class MediumChargeBalance {
  constructor(
    private readonly particles: ParticleFactory,
    private readonly random: RandomSource,
  ) {}

  private product(
    name: ParticleName,
    momentumInGev: Vector3,
    origin: Particle,
  ): ChargeExchangeProduct {
    const created = this.particles.create(name, {
      momentumInGev,
      positionInFemtometers: origin.kinematics.positionInFemtometers,
    });
    return { name, particle: created, fourMomentumInGev: created.kinematics.fourMomentumInGev };
  }

  ionize(
    particle: Particle,
    medium: MediumAspect,
    lepton: ParticleName,
    chain: ChargeChain,
    endIndex: number,
  ): ChargeExchange {
    const freed = this.freeLeptons(particle, medium, lepton, chain, endIndex);
    const end = chain.states[endIndex] ?? particle.spec.name;
    return {
      ...freed,
      products: [
        this.product(end, particle.kinematics.fourMomentumInGev.momentum, particle),
        ...freed.products,
      ],
    };
  }

  freeLeptons(
    particle: Particle,
    medium: MediumAspect,
    lepton: ParticleName,
    chain: ChargeChain,
    endIndex: number,
  ): ChargeExchange {
    const leptonMass = massInGev(lepton);
    const spread = Math.sqrt(
      (leptonMass * BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * medium.temperatureInKelvin) /
        EV_PER_GEV,
    );
    const flow = scaleVector(
      medium.bulkVelocityInMetersPerSecond,
      leptonMass / SPEED_OF_LIGHT_IN_VACUUM.value,
    );
    const steps = chain.states.slice(chain.startIndex, endIndex);
    const electrons = steps.map(() =>
      this.product(
        lepton,
        {
          x: flow.x + sampleGaussian(spread, this.random),
          y: flow.y + sampleGaussian(spread, this.random),
          z: flow.z + sampleGaussian(spread, this.random),
        },
        particle,
      ),
    );
    const end = chain.states[endIndex] ?? particle.spec.name;
    const symbol = (name: ParticleName): string => particleSpec(name).symbol;
    const equations = steps.map(
      (atom, index) =>
        `${symbol(atom)} + ${symbol(lepton)} → ${symbol(chain.states[chain.startIndex + index + 1] ?? end)} + 2${symbol(lepton)}`,
    );
    const energy = steps.reduce((sum, atom) => sum + bindingEnergyInEv(atom), 0);
    return {
      kind: 'ionization',
      products: electrons,
      label: bindingLabel(equations, energy),
    };
  }

  recombine(
    particle: Particle,
    lepton: ParticleName,
    chain: ChargeChain,
    endIndex: number,
    rates: ChargeChainRates,
    temperatureInKelvin: number,
  ): ChargeExchange {
    const symbol = (name: ParticleName): string => particleSpec(name).symbol;
    const parent = particle.kinematics.fourMomentumInGev;
    const thermal = BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * temperatureInKelvin;
    const steps = Array.from(
      { length: chain.startIndex - endIndex },
      (unused, offset) => chain.startIndex - offset - 1,
    ).map((index) => {
      const atom = chain.states[index] ?? particle.spec.name;
      const ion = chain.states[index + 1] ?? particle.spec.name;
      const radiative = rates.radiativePerSecond[index] ?? 0;
      const threeBody = rates.threeBodyPerSecond[index] ?? 0;
      const isRadiative = this.random.nextUnit() * (radiative + threeBody) < radiative;
      return { atom, ion, isRadiative };
    });
    const photons = steps
      .filter((step) => step.isRadiative)
      .map((step) => {
        const energy = (bindingEnergyInEv(step.atom) + thermal) / EV_PER_GEV;
        const rest: FourMomentumInGev = {
          energy,
          momentum: scaleVector(sampleIsotropicDirection(this.random), energy),
        };
        return this.product(
          'photon',
          boostFromRest(rest, parent, massInGev(particle.spec.name)).momentum,
          particle,
        );
      });
    const end = chain.states[endIndex] ?? particle.spec.name;
    const equations = steps.map((step) =>
      step.isRadiative
        ? `${symbol(step.ion)} + ${symbol(lepton)} → ${symbol(step.atom)} + ${symbol('photon')}`
        : `${symbol(step.ion)} + 2${symbol(lepton)} → ${symbol(step.atom)} + ${symbol(lepton)}`,
    );
    const energy = steps.reduce((sum, step) => sum + bindingEnergyInEv(step.atom), 0);
    return {
      kind: 'recombination',
      products: [this.product(end, parent.momentum, particle), ...photons],
      label: bindingLabel(equations, energy),
    };
  }
}
