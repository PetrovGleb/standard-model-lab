/* REACLIB rates in a medium: for a nucleus and the nuclear components around it, every library reaction whose other reactants are species of the medium, two- or three-body, with the factorial
   of identical partners, leptons restored to weak reactions by the charge they move and a photon to radiative captures; photodisintegration of a nucleus by the thermal photons of the medium;
   the fit evaluated inside its window and held at the top of it above; below the window the library is silent, since a 1/v continuation from keV energies overshoots the thermal captures of heavy nuclei by their resonances. */
import {
  AVOGADRO_CONSTANT,
  REACLIB_TEMPERATURE_VALIDITY_IN_GIGAKELVIN,
  particleSpec,
  reaclibReactions,
  type ReaclibReaction,
} from '@standard-model/constants';
import type { MediumComponent, ParticleName } from '@standard-model/contracts';

const KELVIN_PER_GIGAKELVIN = 1e9;
const CUBIC_METERS_PER_CUBIC_CENTIMETER = 1e-6;
const ONE_THIRD = 1 / 3;
const FIVE_THIRDS = 5 / 3;
const RADIATIVE_CAPTURE_CHAPTERS: ReadonlySet<number> = new Set([4, 8]);
const MEDIUM_CHAPTERS: ReadonlySet<number> = new Set([4, 5, 6, 7, 8, 9, 10]);
const PHOTODISINTEGRATION_CHAPTERS: ReadonlySet<number> = new Set([2, 3, 11]);
const POSITRON_EMISSION_CHARGE_CHANGE = -1;
const ELECTRON_EMISSION_CHARGE_CHANGE = 1;

export interface ReaclibMediumChannel {
  readonly reaction: ReaclibReaction;
  readonly partners: readonly ParticleName[];
  readonly products: readonly ParticleName[];
  readonly ratePerSecond: number;
}

export interface ReaclibPhotodisintegration {
  readonly reaction: ReaclibReaction;
  readonly products: readonly ParticleName[];
  readonly ratePerSecond: number;
}

function logRate(set: readonly number[], gigakelvin: number): number {
  const [
    constant = 0,
    inverse = 0,
    inverseCubeRoot = 0,
    cubeRoot = 0,
    linear = 0,
    fiveThirds = 0,
    logarithmic = 0,
  ] = set;
  return (
    constant +
    inverse / gigakelvin +
    inverseCubeRoot * gigakelvin ** -ONE_THIRD +
    cubeRoot * gigakelvin ** ONE_THIRD +
    linear * gigakelvin +
    fiveThirds * gigakelvin ** FIVE_THIRDS +
    logarithmic * Math.log(gigakelvin)
  );
}

export function reaclibRatePerSecond(
  reaction: ReaclibReaction,
  temperatureInKelvin: number,
): number {
  const [lowest, highest] = REACLIB_TEMPERATURE_VALIDITY_IN_GIGAKELVIN;
  const gigakelvin = temperatureInKelvin / KELVIN_PER_GIGAKELVIN;
  if (!(gigakelvin > 0)) {
    return 0;
  }
  const evaluate = (gigakelvinAt: number): number =>
    reaction.sets.reduce((sum, set) => sum + Math.exp(logRate(set, gigakelvinAt)), 0);
  if (gigakelvin > highest) {
    return evaluate(highest);
  }
  return gigakelvin >= lowest ? evaluate(gigakelvin) : 0;
}

const MOST_PARTNERS = 3;

function reactantKey(names: readonly ParticleName[]): string {
  return [...names].sort().join('+');
}

let byReactants: Map<string, ReaclibReaction[]> | null = null;
let byFirstReactant: Map<ParticleName, ReaclibReaction[]> | null = null;

function index(): {
  readonly byReactants: Map<string, ReaclibReaction[]>;
  readonly byFirstReactant: Map<ParticleName, ReaclibReaction[]>;
} {
  if (byReactants === null || byFirstReactant === null) {
    const pairs = new Map<string, ReaclibReaction[]>();
    const firsts = new Map<ParticleName, ReaclibReaction[]>();
    reaclibReactions().forEach((reaction) => {
      const key = reactantKey(reaction.reactants);
      pairs.set(key, [...(pairs.get(key) ?? []), reaction]);
      const [first = 'neutron'] = reaction.reactants;
      firsts.set(first, [...(firsts.get(first) ?? []), reaction]);
    });
    byReactants = pairs;
    byFirstReactant = firsts;
  }
  return { byReactants, byFirstReactant };
}

function partnerCombinations(
  species: readonly ParticleName[],
  size: number,
  from = 0,
): readonly (readonly ParticleName[])[] {
  if (size === 0) {
    return [[]];
  }
  return species.flatMap((candidate, position) =>
    position < from
      ? []
      : partnerCombinations(species, size - 1, position).map((rest) => [candidate, ...rest]),
  );
}

const charges = new Map<ParticleName, number>();

function chargeOf(name: ParticleName): number {
  const cached = charges.get(name);
  if (cached !== undefined) {
    return cached;
  }
  const charge = particleSpec(name).electricChargeInElementaryUnits;
  charges.set(name, charge);
  return charge;
}

const productsCache = new Map<ReaclibReaction, readonly ParticleName[] | null>();

export function reaclibProducts(reaction: ReaclibReaction): readonly ParticleName[] | null {
  const cached = productsCache.get(reaction);
  if (cached !== undefined) {
    return cached;
  }
  const computed = augmentedProducts(reaction);
  productsCache.set(reaction, computed);
  return computed;
}

function augmentedProducts(reaction: ReaclibReaction): readonly ParticleName[] | null {
  const products: ParticleName[] = [...reaction.products];
  if (RADIATIVE_CAPTURE_CHAPTERS.has(reaction.chapter) && reaction.weak === 'none') {
    products.push('photon');
  }
  const chargeChange =
    reaction.products.reduce((sum, name) => sum + chargeOf(name), 0) -
    reaction.reactants.reduce((sum, name) => sum + chargeOf(name), 0);
  if (chargeChange === 0) {
    return reaction.weak === 'none' ? products : null;
  }
  if (reaction.weak !== 'none' && chargeChange === POSITRON_EMISSION_CHARGE_CHANGE) {
    return reaction.weak === 'electronCapture'
      ? [...products, 'electronNeutrino']
      : [...products, 'positron', 'electronNeutrino'];
  }
  if (reaction.weak !== 'none' && chargeChange === ELECTRON_EMISSION_CHARGE_CHANGE) {
    return [...products, 'electron', 'electronAntineutrino'];
  }
  return null;
}

function factorial(count: number): number {
  return count <= 1 ? 1 : count * factorial(count - 1);
}

function partnersOf(reaction: ReaclibReaction, nucleus: ParticleName): readonly ParticleName[] {
  const position = reaction.reactants.indexOf(nucleus);
  return reaction.reactants.filter((unused, index) => index !== position);
}

function perMoleDensity(numberDensityPerCubicMeter: number): number {
  return (numberDensityPerCubicMeter * CUBIC_METERS_PER_CUBIC_CENTIMETER) / AVOGADRO_CONSTANT.value;
}

const candidatesByReactants = new Map<string, readonly ReaclibReaction[]>();

function mediumCandidates(
  nucleus: ParticleName,
  species: readonly ParticleName[],
): readonly ReaclibReaction[] {
  const key = [nucleus, ...species].join('|');
  const known = candidatesByReactants.get(key);
  if (known !== undefined) {
    return known;
  }
  const { byReactants } = index();
  const found = Array.from({ length: MOST_PARTNERS }, (unused, size) => size + 1).flatMap((size) =>
    partnerCombinations(species, size).flatMap(
      (partners) => byReactants.get(reactantKey([nucleus, ...partners])) ?? [],
    ),
  );
  candidatesByReactants.set(key, found);
  return found;
}

export function reaclibMediumChannels(
  nucleus: ParticleName,
  components: readonly MediumComponent[],
  temperatureInKelvin: number,
): readonly ReaclibMediumChannel[] {
  const densityOf = new Map(
    components.map((component) => [component.species, component.numberDensityPerCubicMeter]),
  );
  const electrons = densityOf.get('electron');
  const species = components
    .filter(
      (component) =>
        component.numberDensityPerCubicMeter > 0 &&
        particleSpec(component.species).family !== 'chargedLepton' &&
        particleSpec(component.species).family !== 'neutrino',
    )
    .map((component) => component.species);
  const candidates = mediumCandidates(nucleus, species);
  return candidates.flatMap((reaction) => {
    if (!MEDIUM_CHAPTERS.has(reaction.chapter)) {
      return [];
    }
    const partners = partnersOf(reaction, nucleus);
    const products = reaclibProducts(reaction);
    if (products === null) {
      return [];
    }
    if (reaction.weak === 'electronCapture' && !(electrons !== undefined && electrons > 0)) {
      return [];
    }
    const multiplicities = new Map<ParticleName, number>();
    partners.forEach((partner) =>
      multiplicities.set(partner, (multiplicities.get(partner) ?? 0) + 1),
    );
    const identical = [...multiplicities.values()].reduce(
      (product, count) => product * factorial(count),
      1,
    );
    const densities = partners.reduce(
      (product, partner) => product * perMoleDensity(densityOf.get(partner) ?? 0),
      1,
    );
    const captured = reaction.weak === 'electronCapture' ? perMoleDensity(electrons ?? 0) : 1;
    const ratePerSecond =
      (reaclibRatePerSecond(reaction, temperatureInKelvin) * densities * captured) / identical;
    return ratePerSecond > 0 ? [{ reaction, partners, products, ratePerSecond }] : [];
  });
}

export function reaclibPhotodisintegrations(
  nucleus: ParticleName,
  temperatureInKelvin: number,
): readonly ReaclibPhotodisintegration[] {
  return (index().byFirstReactant.get(nucleus) ?? []).flatMap((reaction) => {
    if (!PHOTODISINTEGRATION_CHAPTERS.has(reaction.chapter) || !reaction.reverse) {
      return [];
    }
    const products = reaclibProducts(reaction);
    const ratePerSecond = reaclibRatePerSecond(reaction, temperatureInKelvin);
    return products === null || !(ratePerSecond > 0) ? [] : [{ reaction, products, ratePerSecond }];
  });
}

export function reaclibLabel(reaction: ReaclibReaction): string {
  const symbol = (name: ParticleName): string => particleSpec(name).symbol;
  return `REACLIB ${reaction.label}: ${reaction.reactants.map(symbol).join(' + ')} → ${(reaclibProducts(reaction) ?? reaction.products).map(symbol).join(' + ')}`;
}
