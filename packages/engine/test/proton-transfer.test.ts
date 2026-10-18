/* Checks Brønsted proton transfer: charged molecule names next to unchanged neutral ones, specs and structures of ions, shares of acid–base forms by the law of mass action, the pH of sulfuric and
   phosphoric acid against their charge balance written out, glycine as a cation in acid, a zwitterion in water and an anion in base, seeded Monte Carlo at five sigma and the glycine template. */
import {
  ACID_BASE_SYSTEMS,
  AVOGADRO_CONSTANT,
  ENVIRONMENT_PRESETS,
  MOLECULE_CATALOG,
  moleculeName,
  moleculeStructureOf,
  particleSpec,
  stepNegativeLogarithm,
} from '@standard-model/constants';
import type { MediumAspect, ParticleName } from '@standard-model/contracts';
import { statisticalTolerance } from '@standard-model/utils';
import { describe, expect, it } from 'vitest';
import {
  EXPERIMENT_TEMPLATES,
  HYDRONIUM,
  HYDROXIDE,
  ImmutableEnvironment,
  acidBaseChains,
  chainMembership,
  createEngine,
  fragmentsAfterBreaking,
  mediumAcidity,
  mediumPhase,
  molecularStructure,
  protonationShares,
  runExperiment,
  solventOf,
  validateMoleculeStructure,
  type AcidBaseChain,
} from '../src/index.js';

const EXACT = 1e-12;
const PH_PRECISION = 1e-9;
const ROOM_TEMPERATURE_IN_KELVIN = 298.15;
const LITERS_PER_CUBIC_METER = 1000;
const TENTH_MOLAR = 0.1 * AVOGADRO_CONSTANT.value * LITERS_PER_CUBIC_METER;
const SHOTS = 10_000;
const TEMPLATE_SHOTS = 2000;
const RUN_TIMEOUT_IN_MILLISECONDS = 60_000;
const WATER: ParticleName = 'molecule:8-16,1-1,1-1;0-1-1,0-2-1';
const SODIUM_ION: ParticleName = 'atom:11:23:1';

const ocean = ENVIRONMENT_PRESETS.find((preset) => preset.name === 'oceanSurface');
const waterDensity =
  ocean?.components.find((component) => component.species === WATER)?.numberDensityPerCubicMeter ??
  0;

function solution(extra: readonly [ParticleName, number][] = []): MediumAspect {
  return {
    components: [
      { species: WATER, numberDensityPerCubicMeter: waterDensity, crossSectionInSquareMeters: 0 },
      ...extra.map(([species, numberDensityPerCubicMeter]) => ({
        species,
        numberDensityPerCubicMeter,
        crossSectionInSquareMeters: 0,
      })),
    ],
    temperatureInKelvin: ROOM_TEMPERATURE_IN_KELVIN,
    pressureInPascals: ocean?.pressureInPascals ?? 0,
    bulkVelocityInMetersPerSecond: { x: 0, y: 0, z: 0 },
    reactionMode: 'oneReactionPerStep',
  };
}

function chain(molecule: string): AcidBaseChain {
  const found = acidBaseChains().find((candidate) => candidate.molecule === molecule);
  if (found === undefined) {
    throw new Error(`${molecule} chain expected`);
  }
  return found;
}

function catalogName(key: string): ParticleName {
  const entry = MOLECULE_CATALOG.find((molecule) => molecule.key === key);
  if (entry === undefined) {
    throw new Error(`${key} expected in the catalogue`);
  }
  return entry.name;
}

function acidConstants(molecule: string): number[] {
  return (ACID_BASE_SYSTEMS.find((system) => system.molecule === molecule)?.steps ?? []).map(
    (step) => 10 ** -stepNegativeLogarithm(step),
  );
}

function molalityOf(density: number): number {
  const solvent = solventOf(solution());
  return density / (AVOGADRO_CONSTANT.value * (solvent?.massDensityInKilogramsPerCubicMeter ?? 1));
}

function densityAtPh(acidityValue: number): number {
  const solvent = solventOf(solution());
  return (
    10 ** -acidityValue *
    AVOGADRO_CONSTANT.value *
    (solvent?.massDensityInKilogramsPerCubicMeter ?? 1)
  );
}

function form(molecule: string, level: number): ParticleName {
  const name = chain(molecule).forms[level];
  if (name === undefined) {
    throw new Error(`${molecule} has no form ${String(level)}`);
  }
  return name;
}

const GLYCINE = 'glycine';
const GLYCINE_CATION = form(GLYCINE, 0);
const GLYCINE_ZWITTERION = form(GLYCINE, 1);
const GLYCINE_ANION = form(GLYCINE, 2);

describe('charged molecules', () => {
  it('keeps neutral names and writes formal charges as a third part', () => {
    expect(moleculeName(moleculeStructureOf(WATER))).toBe(WATER);
    expect(HYDRONIUM).toBe('molecule:8-16,1-1,1-1,1-1;0-1-1,0-2-1,0-3-1;0+1');
    expect(HYDROXIDE).toBe('molecule:8-16,1-1;0-1-1;0-1');
    expect(moleculeName(moleculeStructureOf(HYDRONIUM))).toBe(HYDRONIUM);
    expect(moleculeStructureOf(WATER).charges).toBeUndefined();
    expect(moleculeStructureOf(GLYCINE_ZWITTERION).charges).toEqual([
      { atom: 0, charge: 1 },
      { atom: 4, charge: -1 },
    ]);
  });

  it('gives ions their charge, electrons, symbol and charged constituents', () => {
    const hydronium = particleSpec(HYDRONIUM);
    const water = particleSpec(WATER);
    expect(hydronium.electricChargeInElementaryUnits).toBe(1);
    expect(hydronium.symbol).toBe('H3O+');
    expect(hydronium.leptonNumbers.electron).toBe(water.leptonNumbers.electron);
    expect(particleSpec(HYDROXIDE).symbol).toBe('HO−');
    expect(particleSpec(form('phosphoricAcid', 3)).symbol).toBe('O4P3−');
    expect(particleSpec(GLYCINE_CATION).symbol).toBe('C2H6NO2+');
    expect(particleSpec(GLYCINE_ZWITTERION).symbol).toBe('C2H5NO2±');
    expect(particleSpec(GLYCINE_ZWITTERION).electricChargeInElementaryUnits).toBe(0);
    expect(particleSpec(GLYCINE_ANION).symbol).toBe('C2H4NO2−');
    expect(particleSpec(HYDROXIDE).constituents).toEqual(['atom:8:16:-1', 'hydrogenAtom']);
    const engine = createEngine({ seed: 1 });
    expect(engine.particles.create(GLYCINE_ZWITTERION).spec.symbol).toBe('C2H5NO2±');
  });

  it('constrains the equilibrated charges to the charge of the ion', () => {
    const sum = (name: ParticleName): number =>
      molecularStructure(name).partialCharges.reduce((total, charge) => total + charge, 0);
    expect(Math.abs(sum(HYDROXIDE) + 1)).toBeLessThan(1e-9);
    expect(Math.abs(sum(form('sulfuricAcid', 2)) + 2)).toBeLessThan(1e-9);
    expect(Math.abs(sum(GLYCINE_ZWITTERION))).toBeLessThan(1e-9);
    expect(Math.abs(sum(WATER))).toBeLessThan(1e-9);
  });

  it('keeps formal charges on fragments and refuses impossible ones', () => {
    expect(fragmentsAfterBreaking(HYDROXIDE, [0])).toEqual(['atom:8:16:-1', 'hydrogenAtom']);
    expect(
      validateMoleculeStructure({
        ...moleculeStructureOf(HYDRONIUM),
        charges: [{ atom: 1, charge: 1 }],
      }),
    ).not.toBeNull();
    expect(validateMoleculeStructure(moleculeStructureOf(HYDRONIUM))).toBeNull();
  });

  it('calls ions and zwitterions in water solvated', () => {
    expect(mediumPhase(GLYCINE_ZWITTERION, solution()).phase).toBe('solvated');
    expect(mediumPhase(HYDRONIUM, solution()).phase).toBe('solvated');
  });
});

describe('acid–base forms by the law of mass action', () => {
  it('builds the forms of every system and recognises the catalogue molecule', () => {
    expect(chain('sulfuricAcid').charges).toEqual([0, -1, -2]);
    expect(chain('phosphoricAcid').charges).toEqual([0, -1, -2, -3]);
    expect(chain(GLYCINE).charges).toEqual([1, 0, -1]);
    expect(chainMembership(catalogName('sulfuricAcid'))?.level).toBe(0);
    expect(chainMembership(catalogName(GLYCINE))?.level).toBe(1);
    expect(chainMembership(WATER)).toBeNull();
  });

  it('splits equal shares at pH = pKa and leaves nothing above a complete step', () => {
    const phosphoric = chain('phosphoricAcid');
    phosphoric.negativeLogarithms.forEach((negativeLogarithm, step) => {
      const shares = protonationShares(phosphoric, negativeLogarithm);
      expect(Math.abs(shares.reduce((sum, share) => sum + share, 0) - 1)).toBeLessThan(EXACT);
      expect(Math.abs((shares[step] ?? 0) - (shares[step + 1] ?? 0))).toBeLessThan(EXACT);
    });
    const sulfuric = chain('sulfuricAcid');
    const acidic = protonationShares(sulfuric, -2);
    expect(acidic[0]).toBe(0);
    const [secondConstant = 0] = acidConstants('sulfuricAcid').slice(1);
    const hydrogen = 10 ** -1;
    expect(Math.abs((acidic[1] ?? 0) / (acidic[2] ?? 1) - 10 ** 2 / secondConstant)).toBeLessThan(
      (EXACT * 10 ** 2) / secondConstant,
    );
    const atTenth = protonationShares(sulfuric, 1);
    expect(
      Math.abs((atTenth[2] ?? 0) / (atTenth[1] ?? 1) - secondConstant / hydrogen),
    ).toBeLessThan(EXACT);
  });

  it('finds the pH of 0.1 M sulfuric acid from its complete first and partial second step', () => {
    const acidity = mediumAcidity(solution([[catalogName('sulfuricAcid'), TENTH_MOLAR]]));
    const amount = molalityOf(TENTH_MOLAR);
    const [, second = 0] = acidConstants('sulfuricAcid');
    const hydrogen =
      (amount - second + Math.sqrt((second - amount) ** 2 + 8 * amount * second)) / 2;
    expect(Math.abs((acidity?.pH ?? 0) + Math.log10(hydrogen))).toBeLessThan(PH_PRECISION);
    expect(Math.abs((acidity?.pH ?? 0) - 0.96)).toBeLessThan(0.01);
  });

  it('solves the charge balance of 0.1 M phosphoric acid over its three steps', () => {
    const acidity = mediumAcidity(solution([[catalogName('phosphoricAcid'), TENTH_MOLAR]]));
    const hydrogen = acidity?.hydrogenMolality ?? 0;
    const product = 10 ** -(acidity?.ionizationNegativeLogarithm ?? 0);
    const [first = 0, second = 0, third = 0] = acidConstants('phosphoricAcid');
    const bound =
      (first * hydrogen ** 2 + 2 * first * second * hydrogen + 3 * first * second * third) /
      (hydrogen ** 3 + first * hydrogen ** 2 + first * second * hydrogen + first * second * third);
    const imbalance = hydrogen - product / hydrogen - molalityOf(TENTH_MOLAR) * bound;
    expect(Math.abs(imbalance) / hydrogen).toBeLessThan(PH_PRECISION);
  });

  it('reads explicit hydroxide and hydronium as the pH of the solution', () => {
    const base = mediumAcidity(
      solution([
        [SODIUM_ION, TENTH_MOLAR],
        [HYDROXIDE, TENTH_MOLAR],
      ]),
    );
    expect(
      Math.abs(
        (base?.pH ?? 0) -
          ((base?.ionizationNegativeLogarithm ?? 0) + Math.log10(molalityOf(TENTH_MOLAR))),
      ),
    ).toBeLessThan(PH_PRECISION);
    const acid = mediumAcidity(solution([[HYDRONIUM, TENTH_MOLAR]]));
    expect(Math.abs((acid?.pH ?? 0) + Math.log10(molalityOf(TENTH_MOLAR)))).toBeLessThan(
      PH_PRECISION,
    );
  });

  it('protonates glycine in acid, makes a zwitterion near neutral and an anion in base', () => {
    const glycine = chain(GLYCINE);
    const inSulfuric = mediumAcidity(solution([[catalogName('sulfuricAcid'), TENTH_MOLAR]]));
    expect(protonationShares(glycine, inSulfuric?.pH ?? 0)[0]).toBeGreaterThan(0.95);
    expect(protonationShares(glycine, mediumAcidity(solution())?.pH ?? 0)[1]).toBeGreaterThan(0.99);
    const base = mediumAcidity(
      solution([
        [SODIUM_ION, TENTH_MOLAR],
        [HYDROXIDE, TENTH_MOLAR],
      ]),
    );
    expect(protonationShares(glycine, base?.pH ?? 0)[2]).toBeGreaterThan(0.999);
  });
});

describe('proton transfer by Monte Carlo', () => {
  function sampledShares(species: ParticleName, medium: MediumAspect, seed: number) {
    const engine = createEngine({ seed });
    const environment = ImmutableEnvironment.from({ medium });
    const counts = new Map<ParticleName, number>();
    for (let shot = 0; shot < SHOTS; shot += 1) {
      const outcome = engine.solutions.equilibrate(engine.particles.create(species), environment);
      const product = outcome?.products[0] ?? species;
      counts.set(product, (counts.get(product) ?? 0) + 1);
    }
    return (name: ParticleName): number => (counts.get(name) ?? 0) / SHOTS;
  }

  it(
    'protonates half of the glycine at pH = pKa1 of the carboxyl',
    () => {
      const glycine = chain(GLYCINE);
      const acidityValue = glycine.negativeLogarithms[0] ?? 0;
      const medium = solution([['proton', densityAtPh(acidityValue)]]);
      expect(Math.abs((mediumAcidity(medium)?.pH ?? 0) - acidityValue)).toBeLessThan(PH_PRECISION);
      const expected = protonationShares(glycine, acidityValue);
      const share = sampledShares(catalogName(GLYCINE), medium, 3);
      [GLYCINE_CATION, GLYCINE_ZWITTERION].forEach((name, level) => {
        const probability = expected[level] ?? 0;
        expect(Math.abs(share(name) - probability)).toBeLessThanOrEqual(
          statisticalTolerance(probability, SHOTS),
        );
      });
    },
    RUN_TIMEOUT_IN_MILLISECONDS,
  );

  it(
    'takes phosphoric acid in water down its steps to H₂PO₄⁻ and HPO₄²⁻',
    () => {
      const phosphoric = chain('phosphoricAcid');
      const acidityValue = phosphoric.negativeLogarithms[1] ?? 0;
      const medium = solution([['proton', densityAtPh(acidityValue)]]);
      const expected = protonationShares(phosphoric, acidityValue);
      const share = sampledShares(catalogName('phosphoricAcid'), medium, 5);
      phosphoric.forms.forEach((name, level) => {
        const probability = expected[level] ?? 0;
        expect(Math.abs(share(name) - probability)).toBeLessThanOrEqual(
          statisticalTolerance(probability, SHOTS),
        );
      });
    },
    RUN_TIMEOUT_IN_MILLISECONDS,
  );

  it(
    'runs the glycine template to the shares its three solutions predict',
    () => {
      const plan = EXPERIMENT_TEMPLATES.glycineAcrossPh;
      if (plan === undefined) {
        throw new Error('glycineAcrossPh template expected');
      }
      const result = runExperiment(plan, { shots: TEMPLATE_SHOTS, includeSystemReport: false });
      const values = result.reportValues;
      const acidPh = values['pH серной кислоты'] ?? 0;
      const acid = mediumAcidity(solution([[catalogName('sulfuricAcid'), TENTH_MOLAR]]));
      expect(Math.abs(acidPh - (acid?.pH ?? 0))).toBeLessThan(PH_PRECISION);
      const glycine = chain(GLYCINE);
      const media = [
        acidPh,
        mediumAcidity(solution())?.pH ?? 0,
        mediumAcidity(
          solution([
            [SODIUM_ION, TENTH_MOLAR],
            [HYDROXIDE, TENTH_MOLAR],
          ]),
        )?.pH ?? 0,
      ].map((acidityValue) => protonationShares(glycine, acidityValue));
      const labels = [
        'Катионов ⁺H₃N–CH₂–COOH',
        'Цвиттер-ионов ⁺H₃N–CH₂–COO⁻',
        'Анионов H₂N–CH₂–COO⁻',
      ];
      labels.forEach((label, level) => {
        const probabilities = media.map((shares) => shares[level] ?? 0);
        const expected = probabilities.reduce((sum, probability) => sum + probability, 0);
        const tolerance = Math.hypot(
          ...probabilities.map((probability) => statisticalTolerance(probability, TEMPLATE_SHOTS)),
        );
        expect(Math.abs((values[label] ?? 0) - expected)).toBeLessThanOrEqual(tolerance);
      });
      expect(values['Нейтральных молекул H₂N–CH₂–COOH']).toBe(0);
    },
    RUN_TIMEOUT_IN_MILLISECONDS,
  );
});
