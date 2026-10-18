/* Chemistry of solutions: the densest liquid water component is the solvent (Malmberg–Maryott permittivity), ions in it are solvated, a polar diatomic M–X dissociates into M⁺ + X⁻ by the Born–Haber
   cycle with Marcus hydration energies scaled by the Born factor, and an acid–base system of data/acid-base.json trades protons with H₃O⁺ and OH⁻ of the water into the form the law of mass action
   picks at the pH; the pH comes from charge balance over free ions, diatomic acids and acid–base chains with the IAPWS ionization constant of water, or from explicit H⁺, H₃O⁺ or OH⁻. */
import {
  AVOGADRO_CONSTANT,
  BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN,
  ELECTRON_VOLT,
  HYDRATION_REFERENCE_TEMPERATURE_IN_KELVIN,
  SPEED_OF_LIGHT_IN_VACUUM,
  WATER_IONIZATION,
  WATER_PERMITTIVITY,
  atomName,
  defaultMassNumber,
  electronAffinityInEv,
  hasFormalCharges,
  hydrationGibbsEnergyInKjPerMole,
  ionizationEnergyInEv,
  matterIdentity,
  moleculeName,
  moleculeStructureOf,
  particleSpec,
  substanceKey,
  type MatterIdentity,
} from '@standard-model/constants';
import {
  localizedText,
  type Environment,
  type LocalizedText,
  type MediumAspect,
  type MediumComponent,
  type Particle,
  type ParticleName,
  type RandomSource,
} from '@standard-model/contracts';
import { EV_PER_GEV, sampleIndexByWeights } from '@standard-model/utils';
import { aggregateState, idealGasPressureInPascals } from '../environment/aggregate-state.js';
import { equilibriumConstantInCubicMeters } from './molecular-association.js';
import {
  chainMembership,
  meanChainCharge,
  protonationShares,
  waterIonCharge,
  type ChainMembership,
} from './proton-transfer.js';

const ZERO_CELSIUS_IN_KELVIN = 273.15;
const JOULES_PER_KILOJOULE = 1000;
const GRAMS_PER_KILOGRAM = 1000;
const CUBIC_CENTIMETERS_PER_CUBIC_METER = 1e6;
const LITERS_PER_CUBIC_METER = 1000;
const STANDARD_MOLALITY = 1;
const LOWEST_PH = -2;
const HIGHEST_PH = 16;
const PH_BISECTION_STEPS = 80;
const CATION = 1;
const ANION = -1;
const HYDROGEN = 1;

export interface Solvent {
  readonly species: ParticleName;
  readonly permittivity: number;
  readonly massDensityInKilogramsPerCubicMeter: number;
}

export interface Acidity {
  readonly pH: number;
  readonly hydrogenMolality: number;
  readonly ionizationNegativeLogarithm: number;
}

export interface SolutionOutcome {
  readonly products: readonly ParticleName[];
  readonly label: LocalizedText;
}

function waterPermittivity(temperatureInKelvin: number): number {
  const celsius = Math.min(
    WATER_PERMITTIVITY.highestTemperatureInCelsius,
    Math.max(
      WATER_PERMITTIVITY.lowestTemperatureInCelsius,
      temperatureInKelvin - ZERO_CELSIUS_IN_KELVIN,
    ),
  );
  return WATER_PERMITTIVITY.coefficientsInCelsiusPowers.reduce(
    (sum, coefficient, power) => sum + coefficient * celsius ** power,
    0,
  );
}

function isWater(species: ParticleName): boolean {
  if (!species.startsWith('molecule:')) {
    return false;
  }
  const signature = (name: string): string => {
    const structure = moleculeStructureOf(name);
    return [
      structure.atoms
        .map((atom) => atom.protons)
        .sort((left, right) => left - right)
        .join(','),
      structure.bonds
        .map((bond) => bond.order)
        .sort()
        .join(','),
    ].join(';');
  };
  return signature(species) === signature(WATER_PERMITTIVITY.species);
}

function massInKilograms(species: ParticleName): number {
  return (
    (particleSpec(species).massInGev.value * EV_PER_GEV * ELECTRON_VOLT.value) /
    SPEED_OF_LIGHT_IN_VACUUM.value ** 2
  );
}

export function solventOf(medium: MediumAspect): Solvent | null {
  const pressure =
    medium.pressureInPascals ??
    idealGasPressureInPascals(medium.components, medium.temperatureInKelvin);
  const candidates = medium.components.filter(
    (component) =>
      isWater(component.species) &&
      aggregateState(component.species, medium.temperatureInKelvin, pressure).phase === 'liquid',
  );
  const densest = candidates.reduce<MediumComponent | null>(
    (best, component) =>
      best === null || component.numberDensityPerCubicMeter > best.numberDensityPerCubicMeter
        ? component
        : best,
    null,
  );
  return densest === null
    ? null
    : {
        species: densest.species,
        permittivity: waterPermittivity(medium.temperatureInKelvin),
        massDensityInKilogramsPerCubicMeter:
          densest.numberDensityPerCubicMeter * massInKilograms(densest.species),
      };
}

export function waterIonizationNegativeLogarithm(
  temperatureInKelvin: number,
  densityInGramsPerCubicCentimeter: number,
): number {
  const [crowdingConstant, crowdingPerTemperature, crowdingPerDensity] =
    WATER_IONIZATION.crowdingCoefficients;
  const [shellConstant, shellPerTemperature, shellPerDensity] = WATER_IONIZATION.shellCoefficients;
  const [gasConstant, gasFirst, gasSecond, gasThird] = WATER_IONIZATION.idealGasCoefficients;
  const density = densityInGramsPerCubicCentimeter;
  const temperature = temperatureInKelvin;
  const crowding =
    density *
    Math.exp(
      crowdingConstant +
        crowdingPerTemperature / temperature +
        (crowdingPerDensity * density ** (2 / 3)) / temperature ** 2,
    );
  const idealGas =
    gasConstant +
    gasFirst / temperature +
    gasSecond / temperature ** 2 +
    gasThird / temperature ** 3;
  return (
    -2 *
      WATER_IONIZATION.coordinationNumber *
      (Math.log10(1 + crowding) -
        (crowding / (crowding + 1)) *
          density *
          (shellConstant + shellPerTemperature / temperature + shellPerDensity * density)) +
    idealGas +
    2 * Math.log10(WATER_IONIZATION.molarMassInGramsPerMole / GRAMS_PER_KILOGRAM)
  );
}

function isHydrogenIon(identity: MatterIdentity | null): boolean {
  return identity !== null && identity.protons === HYDROGEN && identity.charge === CATION;
}

function molality(component: MediumComponent, solvent: Solvent): number {
  return (
    component.numberDensityPerCubicMeter /
    (AVOGADRO_CONSTANT.value * solvent.massDensityInKilogramsPerCubicMeter)
  );
}

function bornScale(permittivity: number): number {
  return (
    (1 - 1 / permittivity) / (1 - 1 / waterPermittivity(HYDRATION_REFERENCE_TEMPERATURE_IN_KELVIN))
  );
}

function hydrationInEv(identity: MatterIdentity, solvent: Solvent): number | null {
  const tabulated = hydrationGibbsEnergyInKjPerMole(identity.protons, identity.charge);
  return tabulated === null
    ? null
    : ((tabulated * JOULES_PER_KILOJOULE) / (AVOGADRO_CONSTANT.value * ELECTRON_VOLT.value)) *
        bornScale(solvent.permittivity);
}

interface IonPair {
  readonly molecule: ParticleName;
  readonly cation: ParticleName;
  readonly anion: ParticleName;
  readonly cationProtons: number;
  readonly anionProtons: number;
}

function pairOf(cation: MatterIdentity, anion: MatterIdentity): IonPair {
  return {
    molecule: moleculeName({
      atoms: [
        { protons: cation.protons, massNumber: cation.massNumber },
        { protons: anion.protons, massNumber: anion.massNumber },
      ],
      bonds: [{ first: 0, second: 1, order: 1 }],
    }),
    cation: atomName(cation.protons, cation.massNumber, CATION),
    anion: atomName(anion.protons, anion.massNumber, ANION),
    cationProtons: cation.protons,
    anionProtons: anion.protons,
  };
}

function diatomicPairs(name: ParticleName): readonly IonPair[] {
  if (!name.startsWith('molecule:') || hasFormalCharges(name)) {
    return [];
  }
  const structure = moleculeStructureOf(name);
  const [first, second] = structure.atoms;
  const [bond] = structure.bonds;
  if (
    structure.atoms.length !== 2 ||
    first === undefined ||
    second === undefined ||
    bond?.order !== 1
  ) {
    return [];
  }
  const asIdentity = (atom: typeof first, charge: number): MatterIdentity => ({
    kind: 'atom',
    protons: atom.protons,
    massNumber: atom.massNumber,
    charge,
  });
  return [
    pairOf(asIdentity(first, CATION), asIdentity(second, ANION)),
    pairOf(asIdentity(second, CATION), asIdentity(first, ANION)),
  ];
}

export function dissociationGibbsEnergyInEv(
  pair: IonPair,
  solvent: Solvent,
  temperatureInKelvin: number,
): number | null {
  const ionization = ionizationEnergyInEv(pair.cationProtons, 0);
  const affinity = electronAffinityInEv(pair.anionProtons);
  const cationIdentity = matterIdentity(pair.cation);
  const anionIdentity = matterIdentity(pair.anion);
  const cationHydration = cationIdentity === null ? null : hydrationInEv(cationIdentity, solvent);
  const anionHydration = anionIdentity === null ? null : hydrationInEv(anionIdentity, solvent);
  if (
    ionization === null ||
    affinity === null ||
    cationHydration === null ||
    anionHydration === null
  ) {
    return null;
  }
  const thermal = BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * temperatureInKelvin;
  const standardConcentration =
    AVOGADRO_CONSTANT.value * LITERS_PER_CUBIC_METER * STANDARD_MOLALITY;
  const association = equilibriumConstantInCubicMeters(
    pair.molecule,
    atomName(pair.cationProtons, matterIdentity(pair.cation)?.massNumber ?? 0, 0),
    atomName(pair.anionProtons, matterIdentity(pair.anion)?.massNumber ?? 0, 0),
    0,
    temperatureInKelvin,
  );
  return (
    thermal * Math.log(association * standardConcentration) +
    ionization -
    affinity +
    cationHydration +
    anionHydration
  );
}

function bestPair(pairs: readonly IonPair[], solvent: Solvent, temperatureInKelvin: number) {
  return pairs
    .map((pair) => ({
      pair,
      energy: dissociationGibbsEnergyInEv(pair, solvent, temperatureInKelvin),
    }))
    .filter((entry): entry is { pair: IonPair; energy: number } => entry.energy !== null)
    .sort((left, right) => left.energy - right.energy)[0];
}

function dissociationConstant(energyInEv: number, temperatureInKelvin: number): number {
  return Math.exp(-energyInEv / (BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * temperatureInKelvin));
}

function freeMolecularIonCharge(species: ParticleName): number {
  return hasFormalCharges(species) &&
    chainMembership(species) === null &&
    waterIonCharge(species) === 0
    ? particleSpec(species).electricChargeInElementaryUnits
    : 0;
}

export function mediumAcidity(medium: MediumAspect): Acidity | null {
  const solvent = solventOf(medium);
  if (solvent === null) {
    return null;
  }
  const temperature = medium.temperatureInKelvin;
  const ionization = waterIonizationNegativeLogarithm(
    temperature,
    (solvent.massDensityInKilogramsPerCubicMeter * GRAMS_PER_KILOGRAM) /
      CUBIC_CENTIMETERS_PER_CUBIC_METER,
  );
  const product = 10 ** -ionization;
  const explicit = medium.components.find(
    (component) =>
      isHydrogenIon(matterIdentity(component.species)) ||
      waterIonCharge(component.species) === CATION,
  );
  const hydroxide = medium.components.find(
    (component) => waterIonCharge(component.species) === ANION,
  );
  const given =
    explicit !== undefined
      ? molality(explicit, solvent)
      : hydroxide !== undefined
        ? product / molality(hydroxide, solvent)
        : null;
  if (given !== null) {
    return {
      pH: -Math.log10(given),
      hydrogenMolality: given,
      ionizationNegativeLogarithm: ionization,
    };
  }
  const strongCharge = medium.components.reduce((sum, component) => {
    const identity = matterIdentity(component.species);
    if (identity === null) {
      const charge = freeMolecularIonCharge(component.species);
      return charge === 0 ? sum : sum + charge * molality(component, solvent);
    }
    return identity.kind !== 'atom' || identity.charge === 0
      ? sum
      : sum + identity.charge * molality(component, solvent);
  }, 0);
  const chains = medium.components.flatMap((component) => {
    const membership = chainMembership(component.species);
    return membership === null
      ? []
      : [{ amount: molality(component, solvent), chain: membership.chain }];
  });
  const acids = medium.components.flatMap((component) => {
    const best = bestPair(diatomicPairs(component.species), solvent, temperature);
    return best === undefined || best.pair.cationProtons !== HYDROGEN
      ? []
      : [
          {
            amount: molality(component, solvent),
            constant: dissociationConstant(best.energy, temperature),
          },
        ];
  });
  const imbalance = (hydrogen: number): number =>
    hydrogen +
    strongCharge -
    product / hydrogen -
    acids.reduce(
      (sum, acid) => sum + (acid.amount * acid.constant) / (acid.constant + hydrogen),
      0,
    ) +
    chains.reduce(
      (sum, entry) => sum + entry.amount * meanChainCharge(entry.chain, -Math.log10(hydrogen)),
      0,
    );
  let low = LOWEST_PH;
  let high = HIGHEST_PH;
  for (let step = 0; step < PH_BISECTION_STEPS; step += 1) {
    const middle = (low + high) / 2;
    if (imbalance(10 ** -middle) > 0) {
      low = middle;
    } else {
      high = middle;
    }
  }
  const acidityValue = (low + high) / 2;
  return {
    pH: acidityValue,
    hydrogenMolality: 10 ** -acidityValue,
    ionizationNegativeLogarithm: ionization,
  };
}

function counterMolality(
  pair: IonPair,
  medium: MediumAspect,
  solvent: Solvent,
  acidity: Acidity | null,
): number {
  const ofSpecies = (protons: number, charge: number): number =>
    medium.components
      .filter((component) => {
        const identity = matterIdentity(component.species);
        return identity !== null && identity.protons === protons && identity.charge === charge;
      })
      .reduce((sum, component) => sum + molality(component, solvent), 0);
  const cation =
    pair.cationProtons === HYDROGEN
      ? (acidity?.hydrogenMolality ?? 0)
      : ofSpecies(pair.cationProtons, CATION);
  return Math.max(cation, ofSpecies(pair.anionProtons, ANION));
}

export function dissociatedShare(
  name: ParticleName,
  medium: MediumAspect,
): { readonly share: number; readonly pair: IonPair } | null {
  const solvent = solventOf(medium);
  if (solvent === null) {
    return null;
  }
  const best = bestPair(diatomicPairs(name), solvent, medium.temperatureInKelvin);
  if (best === undefined) {
    return null;
  }
  const counter = counterMolality(best.pair, medium, solvent, mediumAcidity(medium));
  const constant = dissociationConstant(best.energy, medium.temperatureInKelvin);
  return { share: counter > 0 ? constant / (constant + counter) : 1, pair: best.pair };
}

function pairingPartners(identity: MatterIdentity, medium: MediumAspect, solvent: Solvent) {
  const acidity = mediumAcidity(medium);
  const partners: { pair: IonPair; molality: number }[] = medium.components.flatMap((component) => {
    const other = matterIdentity(component.species);
    if (other === null || other.charge !== -identity.charge || isHydrogenIon(other)) {
      return [];
    }
    const pair = identity.charge === CATION ? pairOf(identity, other) : pairOf(other, identity);
    return [{ pair, molality: molality(component, solvent) }];
  });
  if (identity.charge === ANION && acidity !== null) {
    partners.push({
      pair: pairOf(
        {
          kind: 'atom',
          protons: HYDROGEN,
          massNumber: defaultMassNumber(HYDROGEN),
          charge: CATION,
        },
        identity,
      ),
      molality: acidity.hydrogenMolality,
    });
  }
  return partners;
}

function protonTransferLabel(released: number, acidity: Acidity): LocalizedText {
  const neutral = acidity.ionizationNegativeLogarithm / 2;
  const count = Math.abs(released) === 1 ? 'H⁺' : `${String(Math.abs(released))} H⁺`;
  const where = `pH ${acidity.pH.toFixed(2)}`;
  if (released === 0) {
    return localizedText(
      `перенос протона внутри молекулы, ${where}`,
      `a proton moved inside the molecule, ${where}`,
    );
  }
  if (released > 0) {
    return acidity.pH > neutral
      ? localizedText(
          `перенос ${count} на OH⁻ раствора (OH⁻ → H₂O), ${where}`,
          `${count} passed to OH⁻ of the solution (OH⁻ → H₂O), ${where}`,
        )
      : localizedText(
          `перенос ${count} на воду (H₂O → H₃O⁺), ${where}`,
          `${count} passed to the water (H₂O → H₃O⁺), ${where}`,
        );
  }
  return acidity.pH < neutral
    ? localizedText(
        `перенос ${count} с H₃O⁺ раствора (H₃O⁺ → H₂O), ${where}`,
        `${count} taken from H₃O⁺ of the solution (H₃O⁺ → H₂O), ${where}`,
      )
    : localizedText(
        `перенос ${count} с воды (H₂O → OH⁻), ${where}`,
        `${count} taken from the water (H₂O → OH⁻), ${where}`,
      );
}

export class SolutionChemistry {
  constructor(private readonly random: RandomSource) {}

  equilibrate(particle: Particle, environment: Environment): SolutionOutcome | null {
    const medium = environment.get('medium');
    const solvent = medium === undefined ? null : solventOf(medium);
    if (medium === undefined || solvent === null) {
      return null;
    }
    const identity = matterIdentity(particle.spec.name);
    if (identity !== null && identity.kind === 'atom' && Math.abs(identity.charge) === 1) {
      return this.pair(identity, medium, solvent);
    }
    const membership = chainMembership(particle.spec.name);
    if (membership !== null) {
      return this.transferProtons(particle.spec.name, membership, medium);
    }
    const dissolved = dissociatedShare(particle.spec.name, medium);
    if (dissolved === null || this.random.nextUnit() >= dissolved.share) {
      return null;
    }
    return {
      products: [dissolved.pair.cation, dissolved.pair.anion],
      label: localizedText(
        `распад на ионы в растворителе (ε = ${solvent.permittivity.toFixed(1)})`,
        `dissociation into ions in the solvent (ε = ${solvent.permittivity.toFixed(1)})`,
      ),
    };
  }

  private transferProtons(
    species: ParticleName,
    membership: ChainMembership,
    medium: MediumAspect,
  ): SolutionOutcome | null {
    const acidity = mediumAcidity(medium);
    if (acidity === null) {
      return null;
    }
    const level = sampleIndexByWeights(
      protonationShares(membership.chain, acidity.pH),
      this.random,
    );
    const form = membership.chain.forms[level];
    if (
      form === undefined ||
      (level === membership.level && substanceKey(form) === substanceKey(species))
    ) {
      return null;
    }
    return {
      products: [form],
      label: protonTransferLabel(level - membership.level, acidity),
    };
  }

  private pair(
    identity: MatterIdentity,
    medium: MediumAspect,
    solvent: Solvent,
  ): SolutionOutcome | null {
    const weights = pairingPartners(identity, medium, solvent).flatMap(
      ({ pair, molality: amount }) => {
        const energy = dissociationGibbsEnergyInEv(pair, solvent, medium.temperatureInKelvin);
        return energy === null || !(amount > 0)
          ? []
          : [{ pair, weight: amount / dissociationConstant(energy, medium.temperatureInKelvin) }];
      },
    );
    const total = weights.reduce((sum, entry) => sum + entry.weight, 0);
    if (!(total > 0) || this.random.nextUnit() >= total / (1 + total)) {
      return null;
    }
    let pick = this.random.nextUnit() * total;
    const chosen =
      weights.find((entry) => {
        pick -= entry.weight;
        return pick <= 0;
      }) ?? weights[weights.length - 1];
    return chosen === undefined
      ? null
      : {
          products: [chosen.pair.molecule],
          label: localizedText('ионы связались в молекулу', 'the ions joined into a molecule'),
        };
  }
}
