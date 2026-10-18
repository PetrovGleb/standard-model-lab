/* Checks plan compilation: parameter substitution and overrides, label and record checks, ajv rejection with its message, particle groups made by a create step with a count, and
   molecular ions made by the optional formal charges of a create-molecule step. */
import type { CreateMoleculeStep } from '@standard-model/contracts';
import { describe, expect, it } from 'vitest';
import {
  EXPERIMENT_TEMPLATES,
  compilePlan,
  experiment,
  PlanCompilationError,
  runExperiment,
  SINGLET_CORRELATION_TEMPLATE,
} from '../src/index.js';

describe('compilePlan', () => {
  it('substitutes placeholders with defaults and overrides', () => {
    const compiled = compilePlan(SINGLET_CORRELATION_TEMPLATE, {
      parameters: { angleBetweenAxesDegrees: 60 },
      shots: 5,
      seed: 42,
    });
    const measureB = compiled.steps[4];
    if (measureB?.operation !== 'measure') {
      throw new Error('measure step expected');
    }
    expect(measureB.axis?.polarAngleDegrees).toBe(60);
    expect(compiled.parameters.angleBetweenAxesDegrees).toBe(60);
    expect(compiled.shots).toBe(5);
    expect(compiled.seed).toBe(42);
    expect(compilePlan(SINGLET_CORRELATION_TEMPLATE).seed).toBe(1);
  });

  it('rejects unknown parameters, labels and duplicate records', () => {
    expect(() => compilePlan(SINGLET_CORRELATION_TEMPLATE, { parameters: { tilt: 1 } })).toThrow(
      /unknown parameters: tilt/,
    );
    const unknownPlaceholder = experiment('bad')
      .create('e', 'electron', { spin: 'up' })
      .measure('e', 'spin', 'r', { polarAngleDegrees: '{{missing}}', azimuthDegrees: 0 })
      .build();
    expect(() => compilePlan(unknownPlaceholder)).toThrow(
      /step 1: unknown parameter \{\{missing\}\}/,
    );
    const unknownLabel = experiment('bad')
      .create('e', 'electron')
      .measure('ghost', 'spin', 'r')
      .build();
    expect(() => compilePlan(unknownLabel)).toThrow(PlanCompilationError);
    expect(() => compilePlan(unknownLabel)).toThrow(/unknown particle label ghost/);
    const duplicateRecord = experiment('bad')
      .create('e', 'electron', { spin: 'up' })
      .measure('e', 'spin', 'r')
      .measure('e', 'spin', 'r')
      .build();
    expect(() => compilePlan(duplicateRecord)).toThrow(/duplicate record r/);
    const badReport = experiment('bad').create('e', 'electron').report('mean', ['nothing']).build();
    expect(() => compilePlan(badReport)).toThrow(/unknown record nothing/);
  });

  it('accepts decay product labels and derived records', () => {
    const plan = experiment('decayChain')
      .create('muon', 'muon')
      .decay('muon', 'decay')
      .measure('muon.0', 'spin', 'electronSpin')
      .report('mean', ['decay.product[0].energyInGev'])
      .build();
    expect(compilePlan(plan).steps).toHaveLength(3);
  });

  it('reports schema violations with the ajv message', () => {
    expect(() =>
      compilePlan({ name: 'x', parameters: {}, shots: 0, steps: [], report: [] }),
    ).toThrow(/invalid plan/);
    expect(() =>
      compilePlan({ ...SINGLET_CORRELATION_TEMPLATE, steps: [{ operation: 'warp' }] }),
    ).toThrow(/operation/);
  });
});

describe('compilePlan report and decay checks', () => {
  it('refuses to decay a stable particle and to average a decay channel', () => {
    const stable = experiment('stable').create('e', 'electron').decay('e', 'decay').build();
    expect(() => compilePlan(stable)).toThrow(/electron, which has no decay channels/);
    const averaged = experiment('averaged')
      .create('muon', 'muon')
      .decay('muon', 'decay')
      .report('mean', ['decay'])
      .build();
    expect(() => compilePlan(averaged)).toThrow(
      /mean needs a number, but decay is a decay channel/,
    );
    const typo = experiment('typo')
      .create('muon', 'muon')
      .decay('muon', 'decay')
      .report('mean', ['decay.lifetime'])
      .build();
    expect(() => compilePlan(typo)).toThrow(/unknown field decay.lifetime/);
    const fine = experiment('fine')
      .create('muon', 'muon')
      .decay('muon', 'decay')
      .report('mean', ['decay.properTimeInSeconds'])
      .report('frequency', ['decay'])
      .build();
    expect(compilePlan(fine).report).toHaveLength(2);
  });
});

describe('particle groups', () => {
  const group = experiment('group')
    .influence('setTemperature', { temperatureInKelvin: 1000 })
    .createAtom('carbon', 6, { massNumber: 12, count: '{{atoms}}' })
    .parameter('atoms', 4)
    .influence('heat', { byKelvin: 10 }, ['carbon'])
    .evolve(1e-9, ['carbon2'])
    .measureSystem('after')
    .report('mean', ['after.count.12C'])
    .build();

  it('names the members label1…labelN and unfolds the group label in targets', () => {
    const compiled = compilePlan(group);
    const created = compiled.steps[1];
    expect(created?.members).toEqual(['carbon1', 'carbon2', 'carbon3', 'carbon4']);
    const heated = compiled.steps[2];
    expect(heated?.operation === 'influence' ? heated.targets : null).toEqual([
      'carbon1',
      'carbon2',
      'carbon3',
      'carbon4',
    ]);
  });

  it('runs every member as its own particle', () => {
    const values = runExperiment(group, { shots: 3, includeSystemReport: false }).reportValues;
    expect(values['mean(after.count.12C)']).toBe(4);
  });

  it('refuses a group label where one particle is needed and a member label that repeats', () => {
    expect(() =>
      compilePlan({
        ...group,
        steps: [
          ...group.steps,
          { operation: 'measure', target: 'carbon', observable: 'spin', record: 'spin' },
        ],
      }),
    ).toThrow(/carbon1 … carbon4/);
    expect(() =>
      compilePlan({
        ...group,
        steps: [{ operation: 'createAtom', label: 'carbon2', protons: 6 }, ...group.steps],
      }),
    ).toThrow(/carbon2/);
  });

  it('leaves a create step without a count a single particle under its own label', () => {
    const plan = EXPERIMENT_TEMPLATES.sternGerlach;
    if (plan === undefined) {
      throw new Error('sternGerlach template expected');
    }
    const single = compilePlan(plan);
    expect(single.steps[0]?.members).toEqual(['electron']);
  });
});

describe('molecular ions', () => {
  const HYDROXIDE: CreateMoleculeStep = {
    operation: 'createMolecule',
    label: 'hydroxide',
    atoms: [{ protons: 8 }, { protons: 1 }],
    bonds: [{ first: 0, second: 1, order: 1 }],
    charges: [{ atom: 0, charge: -1 }],
  };
  const HYDRONIUM: CreateMoleculeStep = {
    operation: 'createMolecule',
    label: 'hydronium',
    atoms: [{ protons: 8 }, { protons: 1 }, { protons: 1 }, { protons: 1 }],
    bonds: [
      { first: 0, second: 1, order: 1 },
      { first: 0, second: 2, order: 1 },
      { first: 0, second: 3, order: 1 },
    ],
    charges: [{ atom: 0, charge: 1 }],
  };
  const withSteps = (...steps: CreateMoleculeStep[]) => {
    const base = experiment('ions').measureSystem('after').build();
    return { ...base, steps: [...steps, ...base.steps] };
  };
  const created = (...steps: CreateMoleculeStep[]) =>
    runExperiment(withSteps(...steps), { shots: 1 }).systemReport?.frames.at(-1)?.particles ?? [];

  it('creates OH⁻ and H₃O⁺ from the formal charges of a create-molecule step', () => {
    expect(
      created(HYDROXIDE, HYDRONIUM).map((view) => [
        view.label,
        view.name,
        view.chargeInElementaryUnits,
      ]),
    ).toEqual([
      ['hydroxide', 'molecule:8-16,1-1;0-1-1;0-1', -1],
      ['hydronium', 'molecule:8-16,1-1,1-1,1-1;0-1-1,0-2-1,0-3-1;0+1', 1],
    ]);
  });

  it('keeps a step without charges or with zero charges a neutral molecule', () => {
    const { charges, ...neutral } = HYDROXIDE;
    void charges;
    expect(
      created(neutral, { ...HYDROXIDE, label: 'zero', charges: [{ atom: 1, charge: 0 }] }).map(
        (view) => view.name,
      ),
    ).toEqual(['molecule:8-16,1-1;0-1-1', 'molecule:8-16,1-1;0-1-1']);
  });

  it('refuses a charge no ion can carry and a charge that is not an integer', () => {
    expect(() =>
      compilePlan(withSteps({ ...HYDROXIDE, charges: [{ atom: 1, charge: 1 }] })),
    ).toThrow(/charge 1 on atom 1 is impossible/);
    expect(() =>
      compilePlan(withSteps({ ...HYDROXIDE, charges: [{ atom: 5, charge: -1 }] })),
    ).toThrow(PlanCompilationError);
    expect(() =>
      compilePlan(withSteps({ ...HYDROXIDE, charges: [{ atom: 0, charge: -0.5 }] })),
    ).toThrow(/invalid plan/);
  });
});
