/* Typed access to the chemistry data files: data/noble-gas-wells.json (viscosity Lennard-Jones wells of the noble gases for the bond-energy–bond-order method), data/solutions.json (electron
   affinities, Marcus hydration Gibbs energies of ions, the permittivity of water and the IAPWS ionization constant of water) and data/acid-base.json (Brønsted acid–base systems with their Ka or pKa). */
import acidBaseJson from '../data/acid-base.json' with { type: 'json' };
import nobleGasWellsJson from '../data/noble-gas-wells.json' with { type: 'json' };
import solutionsJson from '../data/solutions.json' with { type: 'json' };

export interface NobleGasWell {
  readonly protons: number;
  readonly sigmaInAngstrom: number;
  readonly wellDepthInKelvin: number;
}

interface NobleGasWellsFile {
  readonly source: string;
  readonly gases: readonly NobleGasWell[];
}

const nobleGasWells = nobleGasWellsJson as unknown as NobleGasWellsFile;

export const NOBLE_GAS_WELLS_SOURCE = nobleGasWells.source;

export function closingNobleGasWell(protons: number): NobleGasWell {
  const wells = nobleGasWells.gases;
  const heaviest = wells[wells.length - 1];
  const well = wells.find((candidate) => candidate.protons >= protons) ?? heaviest;
  if (well === undefined) {
    throw new Error('No noble-gas wells');
  }
  return well;
}

export interface WaterIonizationData {
  readonly coordinationNumber: number;
  readonly molarMassInGramsPerMole: number;
  readonly crowdingCoefficients: readonly [number, number, number];
  readonly shellCoefficients: readonly [number, number, number];
  readonly idealGasCoefficients: readonly [number, number, number, number];
  readonly tests: readonly {
    readonly temperatureInKelvin: number;
    readonly densityInGramsPerCubicCentimeter: number;
    readonly negativeLogarithm: number;
  }[];
}

export interface WaterPermittivityData {
  readonly species: string;
  readonly coefficientsInCelsiusPowers: readonly number[];
  readonly lowestTemperatureInCelsius: number;
  readonly highestTemperatureInCelsius: number;
}

interface SolutionsFile {
  readonly source: string;
  readonly electronAffinities: readonly {
    readonly protons: number;
    readonly electronAffinityInEv: number;
  }[];
  readonly hydrationGibbsEnergies: readonly {
    readonly protons: number;
    readonly charge: number;
    readonly gibbsEnergyInKjPerMole: number;
  }[];
  readonly hydrationReferenceTemperatureInKelvin: number;
  readonly waterPermittivity: WaterPermittivityData;
  readonly waterIonization: WaterIonizationData;
}

const solutions = solutionsJson as unknown as SolutionsFile;

export const SOLUTIONS_SOURCE = solutions.source;
export const WATER_IONIZATION = solutions.waterIonization;
export const WATER_PERMITTIVITY = solutions.waterPermittivity;
export const HYDRATION_REFERENCE_TEMPERATURE_IN_KELVIN =
  solutions.hydrationReferenceTemperatureInKelvin;

export function electronAffinityInEv(protons: number): number | null {
  return (
    solutions.electronAffinities.find((entry) => entry.protons === protons)?.electronAffinityInEv ??
    null
  );
}

export function hydrationGibbsEnergyInKjPerMole(protons: number, charge: number): number | null {
  return (
    solutions.hydrationGibbsEnergies.find(
      (entry) => entry.protons === protons && entry.charge === charge,
    )?.gibbsEnergyInKjPerMole ?? null
  );
}

export interface ProtonTransferStep {
  readonly site: number;
  readonly acidConstant?: number;
  readonly negativeLogarithm?: number;
  readonly complete?: boolean;
}

export interface AcidBaseSystem {
  readonly molecule: string;
  readonly reference: string;
  readonly protonatedSites: readonly number[];
  readonly steps: readonly ProtonTransferStep[];
}

interface AcidBaseFile {
  readonly source: string;
  readonly systems: readonly AcidBaseSystem[];
}

const acidBase = acidBaseJson as unknown as AcidBaseFile;

export const ACID_BASE_SOURCE = acidBase.source;
export const ACID_BASE_SYSTEMS = acidBase.systems;

export function stepNegativeLogarithm(step: ProtonTransferStep): number {
  if (step.complete === true) {
    return Number.NEGATIVE_INFINITY;
  }
  return step.negativeLogarithm ?? -Math.log10(step.acidConstant ?? 0);
}
