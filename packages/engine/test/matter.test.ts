/* Checks the matter layer: generated nuclei, atoms and molecules from NUBASE2020, AME2020, NIST ASD and UFF, the composition chain, photon absorption thresholds, Doppler cooling, thermal dissociation and the compile-time guards of the new steps. */
import {
  NEUTRON_MASS_ENERGY_EQUIVALENT_IN_MEV,
  PLANCK_CONSTANT_IN_EV_PER_HERTZ,
  PROTON_MASS_ENERGY_EQUIVALENT_IN_MEV,
  SPEED_OF_LIGHT_IN_VACUUM,
  atomName,
  defaultMassNumber,
  moleculeName,
  nucleusName,
  particleSpec,
} from '@standard-model/constants';
import { statisticalTolerance } from '@standard-model/utils';
import { describe, expect, it } from 'vitest';
import {
  EXPERIMENT_TEMPLATES,
  PlanCompilationError,
  bondAngleInDegrees,
  compilePlan,
  experiment,
  molecularStructure,
  photoionizationCrossSectionInSquareMeters,
  photonuclearChannel,
  runExperiment,
} from '../src/index.js';
import { Atom } from '../src/particles/atom.js';
import { Molecule } from '../src/particles/molecule.js';
import { Nucleus } from '../src/particles/nucleus.js';
import { createEngine } from '../src/index.js';

const MEV_PER_GEV = 1e3;
const CENTIMETERS_PER_METER = 100;
const RESONANT_POWER_IN_WATTS = 1;
const RESONANT_SHOTS = 50;
const SHOTS = 10_000;
const MONTE_CARLO_TIMEOUT_IN_MILLISECONDS = 30_000;
const SIGMAS = 5;
const HYDROGEN_IONIZATION_IN_EV = 13.598434599702;
const VERNER_HYDROGEN_EDGE_IN_EV = 13.6;
const WATER = {
  atoms: [
    { protons: 8, massNumber: 16 },
    { protons: 1, massNumber: 1 },
    { protons: 1, massNumber: 1 },
  ],
  bonds: [
    { first: 0, second: 1, order: 1 },
    { first: 0, second: 2, order: 1 },
  ] as const,
};

describe('generated nuclei and atoms', () => {
  it('builds iron-56 with the AME2020 binding energy per nucleon', () => {
    const iron = particleSpec(nucleusName(26, 56));
    const free =
      26 * PROTON_MASS_ENERGY_EQUIVALENT_IN_MEV.value +
      30 * NEUTRON_MASS_ENERGY_EQUIVALENT_IN_MEV.value;
    expect((free - iron.massInGev.value * MEV_PER_GEV) / 56).toBeCloseTo(8.7897, 3);
    expect(iron.decays).toHaveLength(0);
    expect(iron.constituents).toHaveLength(56);
  });

  it('keeps the catalog names for the light nuclei and atoms', () => {
    expect(nucleusName(1, 2)).toBe('deuteron');
    expect(atomName(1, 1, 0)).toBe('hydrogenAtom');
    expect(atomName(26, 56, 26)).toBe('nucleus:26:56');
    expect(defaultMassNumber(26)).toBe(56);
  });

  it('takes decay modes from NUBASE2020 and keeps only open channels', () => {
    const uranium = particleSpec(nucleusName(92, 238));
    expect(uranium.decays.map((channel) => channel.products)).toEqual([
      ['nucleus:90:234', 'alphaParticle'],
    ]);
    expect(particleSpec(nucleusName(4, 7)).decays).toHaveLength(0);
    expect(particleSpec(atomName(4, 7, 0)).decays[0]?.products).toEqual([
      'atom:3:7:0',
      'electronNeutrino',
    ]);
  });

  it('gives silver the Landé moment of its 2S1/2 ground level', () => {
    const silver = particleSpec(atomName(47, 107, 0));
    expect(silver.spinInReducedPlanckUnits).toBe(0.5);
    expect(silver.gFactor?.value).toBeCloseTo(2.00232, 5);
  });

  it('nests the composition chain molecule ⊃ atom ⊃ nucleus ⊃ nucleon ⊃ quark', () => {
    const engine = createEngine({ seed: 1 });
    const water = engine.particles.create(moleculeName(WATER));
    expect(water).toBeInstanceOf(Molecule);
    const oxygen = (water as Molecule).constituents[0];
    expect(oxygen).toBeInstanceOf(Atom);
    const nucleus = (oxygen as Atom).constituents[0];
    expect(nucleus).toBeInstanceOf(Nucleus);
    const proton = (nucleus as Nucleus).constituents[0];
    expect(proton?.spec.name).toBe('proton');
  });
});

describe('molecular structure', () => {
  it('relaxes water to the UFF geometry with three vibrational modes and a dipole', () => {
    const water = molecularStructure(moleculeName(WATER));
    expect(water.bondLengthsInAngstrom[0]).toBeCloseTo(0.99, 2);
    expect(bondAngleInDegrees(water, 1, 0, 2)).toBeCloseTo(104.51, 1);
    expect(water.normalModes).toHaveLength(3);
    expect(water.dipoleMomentInDebye).toBeGreaterThan(1);
  });

  it('finds carbon dioxide linear, nonpolar and with an infrared-silent symmetric stretch', () => {
    const carbonDioxide = molecularStructure(
      moleculeName({
        atoms: [
          { protons: 6, massNumber: 12 },
          { protons: 8, massNumber: 16 },
          { protons: 8, massNumber: 16 },
        ],
        bonds: [
          { first: 0, second: 1, order: 2 },
          { first: 0, second: 2, order: 2 },
        ],
      }),
    );
    expect(carbonDioxide.linear).toBe(true);
    expect(carbonDioxide.normalModes).toHaveLength(4);
    expect(carbonDioxide.dipoleMomentInDebye).toBeLessThan(1e-9);
    const strengths = carbonDioxide.normalModes.map(
      (mode) => mode.infraredStrengthInSquareMetersPerSecond,
    );
    expect(Math.min(...strengths) / Math.max(...strengths)).toBeLessThan(1e-12);
  });
});

describe('photon absorption', () => {
  it('opens hydrogen photoionization at 13.6 eV with the Verner threshold cross section', () => {
    expect(
      photoionizationCrossSectionInSquareMeters(
        1,
        1,
        HYDROGEN_IONIZATION_IN_EV - 0.1,
        HYDROGEN_IONIZATION_IN_EV,
      ),
    ).toBe(0);
    expect(
      photoionizationCrossSectionInSquareMeters(
        1,
        1,
        VERNER_HYDROGEN_EDGE_IN_EV,
        HYDROGEN_IONIZATION_IN_EV,
      ),
    ).toBeCloseTo(6.35e-22, 23);
  });

  it('opens deuteron photodisintegration at its binding energy', () => {
    expect(photonuclearChannel(1, 2, 2.2e6)).toBeNull();
    const channel = photonuclearChannel(1, 2, 4.4e6);
    expect(channel?.separationEnergyInMev).toBeCloseTo(2.2246, 3);
  });
});

describe('matter experiments', () => {
  it('cools sodium to the Doppler limit of its D2 line', () => {
    const result = runExperiment(EXPERIMENT_TEMPLATES.sodiumLaserCooling, { shots: 2000, seed: 2 });
    const after = result.reportValues['Температура после охлаждения, К'];
    expect(typeof after).toBe('number');
    expect(after as number).toBeGreaterThan(2.2e-4);
    expect(after as number).toBeLessThan(2.8e-4);
  });

  it('splits silver atoms into two Stern–Gerlach beams by the Born rule', () => {
    const result = runExperiment(EXPERIMENT_TEMPLATES.silverSternGerlach, {
      shots: SHOTS,
      seed: 3,
    });
    const upward = result.reportValues['Проекция J на ось магнита[0.5]'] as number;
    expect(Math.abs(upward - 0.5)).toBeLessThan(statisticalTolerance(0.5, SHOTS, SIGMAS));
  }, MONTE_CARLO_TIMEOUT_IN_MILLISECONDS);

  it('ionizes hydrogen only above 13.6 eV', () => {
    const plan = (photonEnergyInEv: number) =>
      experiment('lamp')
        .createAtom('hydrogen', 1)
        .influence(
          'irradiate',
          {
            frequencyInHertz: photonEnergyInEv / PLANCK_CONSTANT_IN_EV_PER_HERTZ.value,
            powerInWatts: 1,
            beamAreaInSquareMeters: 1e-10,
            durationInSeconds: 1e-3,
          },
          ['hydrogen'],
        )
        .measureSystem('after')
        .report('frequency', ['after'], 'after')
        .build();
    expect(
      runExperiment(plan(10), { shots: 200, seed: 1 }).reportValues['after[hydrogenAtom]'],
    ).toBe(1);
    expect(
      runExperiment(plan(20), { shots: 200, seed: 1 }).reportValues['after[electron+proton]'],
    ).toBe(1);
  });

  it('dissociates hydrogen molecules when the bath is hot and keeps them when it is cold', () => {
    const plan = (temperatureInKelvin: number) =>
      experiment('bath')
        .influence('setTemperature', { temperatureInKelvin })
        .createMolecule(
          'hydrogen',
          [{ protons: 1 }, { protons: 1 }],
          [{ first: 0, second: 1, order: 1 }],
        )
        .evolve(1e-6)
        .measureSystem('after')
        .report('frequency', ['after'], 'after')
        .build();
    expect(runExperiment(plan(1000), { shots: 200, seed: 1 }).reportValues['after[H2]']).toBe(1);
    expect(
      runExperiment(plan(6000), { shots: 200, seed: 1 }).reportValues[
        'after[hydrogenAtom+hydrogenAtom]'
      ],
    ).toBe(1);
  });

  it('explains impossible nuclides, ions and bond patterns at compile time', () => {
    expect(() => compilePlan(experiment('bad').createNucleus('iron', 26, 80).build())).toThrow(
      PlanCompilationError,
    );
    expect(() =>
      compilePlan(experiment('bad').createAtom('iron', 26, { charge: 26 }).build()),
    ).toThrow(/createNucleus/);
    expect(() =>
      compilePlan(
        experiment('bad')
          .createMolecule(
            'water',
            [{ protons: 8 }, { protons: 1 }, { protons: 1 }],
            [
              { first: 0, second: 1, order: 1 },
              { first: 0, second: 2, order: 1 },
              { first: 1, second: 2, order: 1 },
            ],
          )
          .build(),
      ),
    ).toThrow(/valence/);
    expect(() =>
      compilePlan(
        experiment('bad')
          .createMolecule('water', WATER.atoms, WATER.bonds)
          .influence('laserCool', {}, ['water'])
          .build(),
      ),
    ).toThrow(/closed NIST transition/);
  });
});

describe('resonant infrared on a molecule', () => {
  it('heats water at its stretch mode until a bond breaks, taking the bond energy from the heat', () => {
    const template = EXPERIMENT_TEMPLATES.microwaveWaterVapor;
    if (template === undefined) {
      throw new Error('microwaveWaterVapor template expected');
    }
    const stretch = Math.max(
      ...molecularStructure(moleculeName(WATER)).normalModes.map(
        (mode) => mode.wavenumberInInverseCentimeters,
      ),
    );
    const plan = {
      ...template,
      steps: template.steps.map((step) =>
        step.operation === 'influence' && step.influence === 'irradiate'
          ? {
              ...step,
              parameters: {
                ...step.parameters,
                frequencyInHertz: SPEED_OF_LIGHT_IN_VACUUM.value * CENTIMETERS_PER_METER * stretch,
                powerInWatts: RESONANT_POWER_IN_WATTS,
              },
            }
          : step,
      ),
      report: [{ statistic: 'frequency' as const, records: ['after'] }],
    };
    expect(runExperiment(plan, { shots: RESONANT_SHOTS, seed: 1 }).reportValues).toEqual({
      'frequency(after)[HO+hydrogenAtom]': 1,
    });
  });
});
