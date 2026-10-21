/* Checks the pure plan editing helpers used by the pipeline builder, including the medium component list, its defaults, the upgrade of a single-species setMedium, particle groups, a
   medium switched between all space and a body, a medium that replaces another one flagged and nested as bodies, keyframe targets and quantities, a second keyframe that watches
   what the first one did, and the particle weight. */
import type { EnvironmentPreset, ExperimentPlan, InfluenceStep } from '@standard-model/contracts';
import { describe, expect, it } from 'vitest';
import {
  applyEnvironmentPreset,
  environmentPresetOf,
  duplicateStep,
  freshName,
  addReport,
  addStep,
  collisionEnergyInGev,
  compositeOf,
  createdLabels,
  defaultInfluenceParameters,
  describeStep,
  influenceParameters,
  planWarnings,
  recordsForStatistic,
  emptyPlan,
  labelGroups,
  labelParticles,
  moveStep,
  parseNumberOrParameter,
  recordNames,
  reorderedIndex,
  reorderStep,
  toggleCategory,
  removeStep,
  resizeRecords,
  setParameter,
  mediumReplacements,
  nestedAsBodies,
  placedAsBody,
  keyframeQuantities,
  keyframeTargets,
  numericRecords,
  withParticleWeight,
} from '../src/plan-edits';

describe('plan edits', () => {
  it('adds, moves and removes steps immutably', () => {
    const plan = addStep(addStep(emptyPlan(), 'create'), 'measure');
    expect(plan.steps.map((step) => step.operation)).toEqual(['create', 'measure']);
    const measure = plan.steps[1];
    expect(measure?.operation === 'measure' && measure.target).toBe('particle1');
    const moved = moveStep(plan, 1, -1);
    expect(moved.steps.map((step) => step.operation)).toEqual(['measure', 'create']);
    expect(moveStep(plan, 0, -1)).toBe(plan);
    expect(removeStep(plan, 0).steps).toHaveLength(1);
    expect(plan.steps).toHaveLength(2);
  });

  it('tracks labels, records and parameters', () => {
    let plan = addStep(emptyPlan(), 'create');
    plan = addStep(plan, 'decay');
    expect(createdLabels(plan, plan.steps.length)).toEqual([
      'particle1.0',
      'particle1.1',
      'particle1.2',
    ]);
    expect(recordNames(plan)).toContain('decay2.product[0].energyInGev');
    plan = setParameter(plan, 'angle', 30);
    expect(plan.parameters.angle).toBe(30);
    expect(addReport(plan).report[0]?.records).toEqual(['decay2']);
  });

  it('maps labels to particles and builds default influence parameters', () => {
    const plan = addStep(addStep(emptyPlan(), 'create'), 'decay');
    const particles = labelParticles(plan, plan.steps.length);
    expect(particles.get('particle1')).toBe('electron');
    expect(particles.get('particle1.0')).toBeNull();
    const defaults = defaultInfluenceParameters({
      name: 'setMedium',
      description: '',
      parameters: [
        { name: 'species', kind: 'particleName', required: true },
        { name: 'numberDensityPerCubicMeter', kind: 'number', required: true },
        { name: 'xVelocityInMetersPerSecond', kind: 'number', required: false, defaultValue: 0 },
        { name: 'dephasingTimeInSeconds', kind: 'number', required: false },
      ],
    });
    expect(defaults).toEqual({
      species: 'electron',
      numberDensityPerCubicMeter: 0,
      xVelocityInMetersPerSecond: 0,
    });
    expect(resizeRecords(['a'], 2, 'z')).toEqual(['a', 'a']);
    expect(resizeRecords(['a', 'b', 'c'], 2, 'z')).toEqual(['a', 'b']);
    expect(resizeRecords([], 1, 'z')).toEqual(['z']);
  });

  it('offers decay channels to frequency and decay numbers to numeric statistics', () => {
    const plan = addStep(addStep(emptyPlan(), 'create'), 'decay');
    expect(recordsForStatistic(plan, 'frequency')).toEqual(['decay2']);
    expect(recordsForStatistic(plan, 'mean')).toContain('decay2.properTimeInSeconds');
    expect(recordsForStatistic(plan, 'mean')).not.toContain('decay2');
  });

  it('warns about plans with nothing to observe or report', () => {
    expect(planWarnings(addStep(emptyPlan(), 'create'))).toHaveLength(2);
    const observed = addReport(addStep(addStep(emptyPlan(), 'create'), 'measure'));
    expect(planWarnings(observed)).toEqual([]);
  });

  it('describes steps in words', () => {
    expect(
      describeStep({ operation: 'create', label: 'e', particle: 'electron', spin: 'up' }),
    ).toBe('создать e: electron, спин up');
    expect(
      describeStep({
        operation: 'influence',
        influence: 'applyMagneticField',
        parameters: { zInTesla: '{{field}}' },
      }),
    ).toBe('воздействие applyMagneticField (zInTesla = {{field}}) на все живые');
    expect(describeStep({ operation: 'decay', target: 'muon' })).toBe(
      'распад muon → запись muon.decay',
    );
  });

  it('resolves combined quarks to the catalog composite and hides consumed particles', () => {
    const catalog = [
      { name: 'proton' as const, constituents: ['up', 'up', 'down'] as const },
      { name: 'electron' as const, constituents: null },
    ];
    expect(compositeOf(['down', 'up', 'up'], catalog)).toBe('proton');
    expect(compositeOf(['up', null], catalog)).toBeNull();
    const plan = {
      ...emptyPlan(),
      steps: [
        { operation: 'create' as const, label: 'q1', particle: 'up' as const },
        { operation: 'create' as const, label: 'q2', particle: 'up' as const },
        { operation: 'create' as const, label: 'q3', particle: 'down' as const },
        { operation: 'combine' as const, targets: ['q1', 'q2', 'q3'], label: 'p' },
      ],
    };
    expect(labelParticles(plan, 4, catalog).get('p')).toBe('proton');
    expect(createdLabels(plan, 4)).toEqual(['p']);
  });

  it('parses numbers and placeholders', () => {
    expect(parseNumberOrParameter(' 12.5 ')).toBe(12.5);
    expect(parseNumberOrParameter('{{angle}}')).toBe('{{angle}}');
    expect(parseNumberOrParameter('nonsense')).toBe(0);
  });

  it('computes the collision energy √s from the momenta of the created particles', () => {
    const beamInGev = 45;
    const plan = {
      ...emptyPlan(),
      parameters: { beam: beamInGev },
      steps: [
        {
          operation: 'create',
          label: 'first',
          particle: 'electron',
          momentumInGev: { x: 0, y: 0, z: '{{beam}}' },
        },
        {
          operation: 'create',
          label: 'second',
          particle: 'positron',
          momentumInGev: { x: 0, y: 0, z: -beamInGev },
        },
        { operation: 'collide', targets: ['first', 'second'], record: 'collision' },
      ],
    } as ExperimentPlan;
    const massless = (): number => 0;
    expect(collisionEnergyInGev(plan, 2, ['first', 'second'], massless)).toBeCloseTo(
      2 * beamInGev,
      12,
    );
    expect(collisionEnergyInGev(plan, 2, ['first', 'missing'], massless)).toBeNull();
  });

  it('reorders a dragged step to the slot it was dropped on and remaps indices', () => {
    const plan = addStep(addStep(addStep(emptyPlan(), 'create'), 'measure'), 'evolve');
    const moved = reorderStep(plan, 0, 3);
    expect(moved.steps.map((step) => step.operation)).toEqual(['measure', 'evolve', 'create']);
    expect(reorderStep(plan, 2, 0).steps.map((step) => step.operation)).toEqual([
      'evolve',
      'create',
      'measure',
    ]);
    expect(reorderStep(plan, 1, 2)).toBe(plan);
    expect([0, 1, 2].map((index) => reorderedIndex(index, 0, 3))).toEqual([2, 0, 1]);
  });

  it('toggles template categories on and off as tags', () => {
    const tagged = toggleCategory(toggleCategory(emptyPlan(), 'atoms'), 'radiation');
    expect(tagged.categories).toEqual(['atoms', 'radiation']);
    expect(toggleCategory(tagged, 'atoms').categories).toEqual(['radiation']);
  });

  it('fills a medium component list and a reaction mode with defaults', () => {
    expect(
      defaultInfluenceParameters({
        name: 'setMedium',
        description: '',
        parameters: [
          {
            name: 'components',
            kind: 'list',
            required: true,
            fields: [
              { name: 'species', kind: 'particleName', required: true },
              { name: 'numberDensityPerCubicMeter', kind: 'number', required: true },
              {
                name: 'crossSectionInSquareMeters',
                kind: 'number',
                required: false,
                defaultValue: 0,
              },
            ],
          },
          {
            name: 'reactionMode',
            kind: 'choice',
            required: false,
            defaultValue: 'oneReactionPerStep',
            choices: ['oneReactionPerStep', 'allReactionsInStep'],
          },
        ],
      }),
    ).toEqual({
      components: [
        { species: 'electron', numberDensityPerCubicMeter: 0, crossSectionInSquareMeters: 0 },
      ],
      reactionMode: 'oneReactionPerStep',
    });
  });

  it('reads a single-species setMedium as one component and describes the list in words', () => {
    const legacy: InfluenceStep = {
      operation: 'influence',
      influence: 'setMedium',
      parameters: {
        species: 'triton',
        numberDensityPerCubicMeter: '{{density}}',
        temperatureInKelvin: 1e8,
        crossSectionInSquareMeters: 0,
      },
    };
    const upgraded = influenceParameters(legacy);
    expect(upgraded).toEqual({
      temperatureInKelvin: 1e8,
      components: [
        {
          species: 'triton',
          numberDensityPerCubicMeter: '{{density}}',
          crossSectionInSquareMeters: 0,
        },
      ],
    });
    expect(influenceParameters({ ...legacy, parameters: upgraded })).toEqual(upgraded);
    const described = describeStep({ ...legacy, parameters: upgraded });
    expect(described).toContain('triton {{density}} 0');
    expect(described).not.toContain('[object Object]');
  });
});

describe('duplicateStep', () => {
  const plan: ExperimentPlan = {
    name: 'copies',
    parameters: {},
    shots: 10,
    seed: 1,
    steps: [
      { operation: 'createAtom', label: 'oxygen', protons: 8 },
      { operation: 'evolve', durationInSeconds: 1e-9 },
      { operation: 'measureSystem', record: 'system2' },
      { operation: 'measureSystem', record: 'system3' },
    ],
    report: [],
  };

  it('puts the copy right after the original and renames what it creates', () => {
    const copied = duplicateStep(plan, 0);
    expect(copied.steps).toHaveLength(5);
    expect(copied.steps[1]).toEqual({ operation: 'createAtom', label: 'oxygen2', protons: 8 });
    expect(duplicateStep(plan, 1).steps[2]).toEqual(plan.steps[1]);
  });

  it('skips names already taken and leaves an out-of-range index alone', () => {
    expect(duplicateStep(plan, 2).steps[3]).toEqual({
      operation: 'measureSystem',
      record: 'system4',
    });
    expect(freshName('particle', new Set(['particle2']))).toBe('particle3');
    expect(duplicateStep(plan, 9)).toBe(plan);
  });
});

describe('environment presets in a medium step', () => {
  const preset: EnvironmentPreset = {
    name: 'mars',
    group: { ru: 'Планеты', en: 'Planets' },
    title: { ru: 'Марс', en: 'Mars' },
    components: [
      { species: 'molecule:6-12,8-16,8-16;0-1-2,0-2-2', numberDensityPerCubicMeter: 2e23 },
    ],
    temperatureInKelvin: 210,
    pressureInPascals: 610,
    radiationTemperatureInKelvin: null,
    source: 'NASA Mars Fact Sheet',
    note: { ru: 'поверхность', en: 'surface' },
  };
  const step: InfluenceStep = {
    operation: 'influence',
    influence: 'setMedium',
    parameters: {
      components: [
        { species: 'electron', numberDensityPerCubicMeter: 1, crossSectionInSquareMeters: 0 },
      ],
      temperatureInKelvin: 300,
      radiationTemperatureInKelvin: 5000,
      reactionMode: 'allReactionsInStep',
    },
  };

  it('fills components, temperature and pressure, drops a radiation the preset lacks and keeps the rest', () => {
    const applied = applyEnvironmentPreset(step, preset);
    expect(applied.parameters).toEqual({
      components: [
        { species: 'molecule:6-12,8-16,8-16;0-1-2,0-2-2', numberDensityPerCubicMeter: 2e23 },
      ],
      temperatureInKelvin: 210,
      pressureInPascals: 610,
      reactionMode: 'allReactionsInStep',
    });
    expect(environmentPresetOf(applied, [preset])).toBe(preset);
    expect(environmentPresetOf(step, [preset])).toBeUndefined();
    const warmed = { ...applied, parameters: { ...applied.parameters, temperatureInKelvin: 250 } };
    expect(environmentPresetOf(warmed, [preset])).toBeUndefined();
  });
});

describe('particle groups in the builder', () => {
  const plan: ExperimentPlan = {
    name: 'groups',
    parameters: {},
    shots: 1,
    steps: [
      { operation: 'createAtom', label: 'carbon', protons: 6, count: 8 },
      { operation: 'create', label: 'probe', particle: 'electron' },
      { operation: 'evolve', durationInSeconds: 1 },
    ],
    report: [],
  };

  it('lists the members for one-particle choices and the group for targets', () => {
    expect(createdLabels(plan, 2)).toEqual([
      'carbon1',
      'carbon2',
      'carbon3',
      'carbon4',
      'carbon5',
      'carbon6',
      'carbon7',
      'carbon8',
      'probe',
    ]);
    expect([...labelGroups(plan, 2).keys()]).toEqual(['carbon']);
    expect(labelGroups(plan, 2).get('carbon')).toHaveLength(8);
    const first = plan.steps[0];
    expect(first === undefined ? '' : describeStep(first)).toMatch(/8/);
  });

  it('keeps a create step without a count a single label', () => {
    expect(createdLabels(plan, 1).length).toBe(8);
    expect(labelGroups({ ...plan, steps: plan.steps.slice(1) }, 2).size).toBe(0);
  });
});

describe('media as bodies', () => {
  const water: InfluenceStep = {
    operation: 'influence',
    influence: 'setMedium',
    parameters: {
      components: [
        { species: 'molecule:8-16,1-1,1-1;0-1-1,0-2-1', numberDensityPerCubicMeter: 3.34e28 },
      ],
      temperatureInKelvin: 293,
    },
  };
  const uranium: InfluenceStep = {
    operation: 'influence',
    influence: 'setMedium',
    parameters: {
      components: [{ species: 'atom:92:235:0', numberDensityPerCubicMeter: 4.83e28 }],
      temperatureInKelvin: 293,
      thicknessInMeters: 0.3,
    },
  };
  const plan: ExperimentPlan = {
    name: 'nested',
    parameters: {},
    shots: 1,
    seed: 1,
    steps: [water, uranium, { operation: 'evolve', durationInSeconds: 1 }],
    report: [],
  };

  it('switches a medium between all space and a body and back', () => {
    const body = placedAsBody(uranium, true);
    expect(body.influence).toBe('placeBody');
    expect(body.parameters?.shape).toBe('ball');
    expect(body.parameters?.sizeInMeters).toBe(0.3);
    expect(body.parameters?.thicknessInMeters).toBeUndefined();
    const back = placedAsBody(body, false);
    expect(back.influence).toBe('setMedium');
    expect(back.parameters?.thicknessInMeters).toBe(0.3);
    expect(back.parameters?.shape).toBeUndefined();
  });

  it('flags a medium for all space that replaces another one and nests them as bodies', () => {
    const [replacement] = mediumReplacements(plan);
    expect(replacement).toEqual({ row: 1, replacedRow: 0 });
    expect(mediumReplacements({ ...plan, steps: [uranium, uranium] })).toEqual([]);
    if (replacement === undefined) {
      return;
    }
    const nested = nestedAsBodies(plan, replacement);
    const [outer, inner] = nested.steps;
    expect(outer?.operation === 'influence' && outer.influence).toBe('placeBody');
    expect(inner?.operation === 'influence' && inner.influence).toBe('placeBody');
    const outerSize = outer?.operation === 'influence' ? outer.parameters?.sizeInMeters : undefined;
    const innerSize = inner?.operation === 'influence' ? inner.parameters?.sizeInMeters : undefined;
    expect(innerSize).toBe(0.3);
    expect(Number(outerSize)).toBeGreaterThan(Number(innerSize));
    expect(mediumReplacements(nested)).toEqual([]);
  });
});

describe('keyframes', () => {
  const water = {
    operation: 'influence',
    influence: 'setMedium',
    parameters: {
      name: 'pool',
      components: [
        { species: 'molecule:8-16,1-1,1-1;0-1-1,0-2-1', numberDensityPerCubicMeter: 3.34e28 },
      ],
      temperatureInKelvin: 293,
    },
  } as const;
  const plan: ExperimentPlan = {
    ...emptyPlan(),
    steps: [
      water,
      {
        operation: 'influence',
        influence: 'placeBody',
        parameters: { shape: 'ball', sizeInMeters: 1 },
      },
      { operation: 'create', label: 'n', particle: 'neutron' },
    ],
  };

  it('offers the system, the media by name and the particles as targets', () => {
    expect(keyframeTargets(plan, plan.steps.length)).toEqual([
      { target: 'system', kind: 'system' },
      { target: 'pool', kind: 'medium' },
      { target: 'body1', kind: 'medium' },
      { target: 'n', kind: 'particle' },
    ]);
    expect(keyframeQuantities(plan, 'system')).toEqual([
      'particleCount',
      'pendingNeutrons',
      'count.neutron',
    ]);
    expect(keyframeQuantities(plan, 'medium')).toContain('absorbedEnergyInJoules');
  });

  it('watches a medium first and then what the previous keyframe watched', () => {
    const first = addStep(plan, 'keyframe');
    const firstStep = first.steps[first.steps.length - 1];
    expect(firstStep).toEqual({
      operation: 'keyframe',
      name: 'key1',
      watch: [
        { target: 'pool', quantity: 'temperatureInKelvin' },
        { target: 'pool', quantity: 'absorbedEnergyInJoules' },
      ],
    });
    const second = addStep(first, 'keyframe');
    const secondStep = second.steps[second.steps.length - 1];
    expect(secondStep?.operation === 'keyframe' ? secondStep.name : '').toBe('key2');
    expect(secondStep?.operation === 'keyframe' ? secondStep.watch : []).toEqual(
      firstStep?.operation === 'keyframe' ? firstStep.watch : [],
    );
    expect(numericRecords(second)).toContain('key2.pool.absorbedEnergyInJoules');
  });

  it('keeps a particle weight other than one and drops it at one', () => {
    expect(withParticleWeight(plan, 5e12).particleWeight).toBe(5e12);
    expect('particleWeight' in withParticleWeight(withParticleWeight(plan, 5e12), 1)).toBe(false);
  });
});
