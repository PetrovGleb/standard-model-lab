/* Deconfinement: above the QCD crossover temperature from lattice QCD (PDG) colour is not confined, so hadrons, nuclei and the nuclei of atoms in such an environment melt into their quarks with
   Maxwell–Jüttner momenta of the bath, electrons stay as they are, and free quarks and gluons are not hadronized; a medium component may take the equilibrium density of an ideal quantum gas,
   n = g/(2π²)(kT/ħc)³ ∫ x² dx/(exp(√(x² + (m/kT)²)) ∓ 1), with g from spin, helicity and colour. */
import {
  BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN,
  PDG_2026,
  REDUCED_PLANCK_CONSTANT_IN_EV_SECOND,
  SPEED_OF_LIGHT_IN_VACUUM,
  particleSpec,
} from '@standard-model/constants';
import type {
  Environment,
  MediumAspect,
  Particle,
  ParticleName,
  RandomSource,
} from '@standard-model/contracts';
import { EV_PER_GEV, sampleIsotropicDirection, scaleVector } from '@standard-model/utils';

const INTEGRATION_STEPS = 400;
const INTEGRATION_LIMIT = 40;
const SIMPSON_ODD_WEIGHT = 4;
const SIMPSON_EVEN_WEIGHT = 2;
const SIMPSON_DIVISOR = 3;
const COLOR_MULTIPLICITY = { singlet: 1, triplet: 3, antitriplet: 3, octet: 8 } as const;
const MASSLESS_HELICITIES = 2;
const MAXIMUM_SAMPLING_TRIES = 1000;
const GAMMA_SHAPE_SAMPLES = 3;

export const CROSSOVER_TEMPERATURE_IN_GEV = PDG_2026.couplings.qcdCrossoverTemperatureInGev.value;

export function environmentTemperatureInGev(environment: Environment): number {
  const kelvin =
    environment.get('medium')?.temperatureInKelvin ??
    environment.get('temperature')?.temperatureInKelvin ??
    0;
  return (BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * kelvin) / EV_PER_GEV;
}

export function isDeconfined(environment: Environment): boolean {
  return environmentTemperatureInGev(environment) >= CROSSOVER_TEMPERATURE_IN_GEV;
}

export function mediumIsDeconfined(medium: MediumAspect): boolean {
  return (
    (BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * medium.temperatureInKelvin) / EV_PER_GEV >=
    CROSSOVER_TEMPERATURE_IN_GEV
  );
}

export function isStronglyInteracting(name: ParticleName): boolean {
  const spec = particleSpec(name);
  return (
    spec.colorRepresentation !== 'singlet' ||
    spec.family === 'meson' ||
    spec.family === 'baryon' ||
    spec.family === 'nucleus' ||
    spec.family === 'atom'
  );
}

export function degeneracyOf(name: ParticleName): number {
  const spec = particleSpec(name);
  const states =
    spec.massInGev.value === 0 && spec.spinInReducedPlanckUnits > 0
      ? MASSLESS_HELICITIES
      : 2 * spec.spinInReducedPlanckUnits + 1;
  return states * COLOR_MULTIPLICITY[spec.colorRepresentation];
}

export function equilibriumNumberDensityPerCubicMeter(
  name: ParticleName,
  temperatureInKelvin: number,
): number {
  const spec = particleSpec(name);
  const thermalInEv = BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * temperatureInKelvin;
  if (!(thermalInEv > 0)) {
    return 0;
  }
  const massRatio = (spec.massInGev.value * EV_PER_GEV) / thermalInEv;
  const sign = spec.statistics === 'fermiDirac' ? 1 : -1;
  const step = INTEGRATION_LIMIT / INTEGRATION_STEPS;
  const integrand = (momentum: number): number =>
    momentum === 0
      ? 0
      : momentum ** 2 / (Math.exp(Math.sqrt(momentum ** 2 + massRatio ** 2)) + sign);
  let integral = integrand(0) + integrand(INTEGRATION_LIMIT);
  for (let index = 1; index < INTEGRATION_STEPS; index += 1) {
    integral +=
      (index % 2 === 1 ? SIMPSON_ODD_WEIGHT : SIMPSON_EVEN_WEIGHT) * integrand(index * step);
  }
  integral *= step / SIMPSON_DIVISOR;
  const inverseLength =
    thermalInEv / (REDUCED_PLANCK_CONSTANT_IN_EV_SECOND.value * SPEED_OF_LIGHT_IN_VACUUM.value);
  return (degeneracyOf(name) / (2 * Math.PI ** 2)) * inverseLength ** 3 * integral;
}

function thermalMomentumInGev(
  massInGev: number,
  temperatureInGev: number,
  random: RandomSource,
): number {
  for (let attempt = 0; attempt < MAXIMUM_SAMPLING_TRIES; attempt += 1) {
    let product = 1;
    for (let sample = 0; sample < GAMMA_SHAPE_SAMPLES; sample += 1) {
      product *= 1 - random.nextUnit();
    }
    const momentum = -temperatureInGev * Math.log(product);
    const energy = Math.sqrt(momentum ** 2 + massInGev ** 2);
    if (random.nextUnit() < Math.exp(-(energy - momentum) / temperatureInGev)) {
      return momentum;
    }
  }
  return temperatureInGev;
}

export function meltedConstituents(name: ParticleName): readonly ParticleName[] {
  const spec = particleSpec(name);
  if (spec.colorRepresentation !== 'singlet' || spec.constituents === null) {
    return [name];
  }
  if (spec.family === 'chargedLepton' || spec.family === 'neutrino') {
    return [name];
  }
  return spec.constituents.flatMap((constituent) => meltedConstituents(constituent));
}

export class Deconfinement {
  constructor(
    private readonly create: (
      name: ParticleName,
      momentumInGev: { x: number; y: number; z: number },
      from: Particle,
    ) => Particle,
    private readonly random: RandomSource,
  ) {}

  melt(particle: Particle, environment: Environment): readonly Particle[] | null {
    const family = particle.spec.family;
    if (
      !isDeconfined(environment) ||
      (family !== 'meson' && family !== 'baryon' && family !== 'nucleus' && family !== 'atom')
    ) {
      return null;
    }
    const parts = meltedConstituents(particle.spec.name);
    if (parts.length < 2) {
      return null;
    }
    const temperature = environmentTemperatureInGev(environment);
    return parts.map((name) => {
      const mass = particleSpec(name).massInGev.value;
      const momentum = scaleVector(
        sampleIsotropicDirection(this.random),
        thermalMomentumInGev(mass, temperature, this.random),
      );
      return this.create(name, momentum, particle);
    });
  }
}
