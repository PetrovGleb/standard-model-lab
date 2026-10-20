/* Checks the plan diagram layout: lanes per particle, entangle links, combine merges, collisions and decay splits with lazily opened product lanes, one stacked lane per particle group. */
import type { ExperimentPlan } from '@standard-model/contracts';
import { describe, expect, it } from 'vitest';
import { layoutPlan } from '../src/plan-diagram';

const PLAN: ExperimentPlan = {
  name: 'diagram',
  parameters: {},
  shots: 1,
  steps: [
    { operation: 'create', label: 'q1', particle: 'up' },
    { operation: 'create', label: 'q2', particle: 'up' },
    { operation: 'create', label: 'q3', particle: 'down' },
    { operation: 'combine', targets: ['q1', 'q2', 'q3'], label: 'proton' },
    { operation: 'create', label: 'muon', particle: 'muon', spin: 'up' },
    { operation: 'create', label: 'mate', particle: 'muon' },
    { operation: 'entangle', targets: ['muon', 'mate'], state: 'spinSinglet' },
    { operation: 'evolve', durationInSeconds: 1e-9 },
    { operation: 'decay', target: 'muon', record: 'decay' },
    { operation: 'measure', target: 'muon.0', observable: 'spin', record: 'electronSpin' },
  ],
  report: [],
};

describe('layoutPlan', () => {
  const layout = layoutPlan(PLAN);

  it('opens one lane per particle and closes bound and decayed ones', () => {
    expect(layout.lanes.map((lane) => lane.label)).toEqual([
      'q1',
      'q2',
      'q3',
      'proton',
      'muon',
      'mate',
      'muon.0',
    ]);
    expect(layout.lanes.find((lane) => lane.label === 'q1')?.endKind).toBe('bound');
    expect(layout.lanes.find((lane) => lane.label === 'muon')?.endRow).toBe(8);
    expect(layout.lanes.find((lane) => lane.label === 'muon.0')?.startRow).toBe(8);
    expect(layout.rowCount).toBe(10);
  });

  it('links entangled pairs, merges combined particles and splits decays into used products', () => {
    expect(layout.links).toEqual([
      { row: 3, kind: 'combine', fromColumns: [0, 1, 2], toColumns: [3] },
      { row: 6, kind: 'entangle', fromColumns: [4], toColumns: [5] },
      { row: 8, kind: 'decay', fromColumns: [4], toColumns: [6] },
    ]);
  });

  it('puts evolve nodes on every live lane when no targets are given', () => {
    const evolveColumns = layout.nodes
      .filter((node) => node.operation === 'evolve')
      .map((node) => node.column);
    expect(evolveColumns).toEqual([3, 4, 5]);
    expect(layout.nodes.find((node) => node.operation === 'measure')?.note).toBe('electronSpin');
  });

  it('closes both beams at a collision and opens the products it records', () => {
    const collision = layoutPlan({
      name: 'collision',
      parameters: {},
      shots: 1,
      steps: [
        { operation: 'create', label: 'beam', particle: 'electron' },
        { operation: 'create', label: 'target', particle: 'positron' },
        { operation: 'collide', targets: ['beam', 'target'], record: 'hit' },
        { operation: 'measure', target: 'hit.1', observable: 'spin', record: 'spin' },
      ],
      report: [],
    });
    expect(collision.lanes.map((lane) => [lane.label, lane.endKind])).toEqual([
      ['beam', 'collided'],
      ['target', 'collided'],
      ['hit.1', null],
    ]);
    expect(collision.links).toEqual([
      { row: 2, kind: 'collide', fromColumns: [0, 1], toColumns: [2] },
    ]);
  });

  it('puts system-wide steps after a collision on a products lane', () => {
    const collision = layoutPlan({
      name: 'jets',
      parameters: {},
      shots: 1,
      steps: [
        { operation: 'create', label: 'first', particle: 'proton' },
        { operation: 'create', label: 'second', particle: 'proton' },
        { operation: 'collide', targets: ['first', 'second'], record: 'collision' },
        { operation: 'evolve', durationInSeconds: 1e-9 },
        { operation: 'measureSystem', record: 'detector' },
      ],
      report: [],
    });
    expect(collision.lanes.map((lane) => [lane.label, lane.caption, lane.startRow])).toEqual([
      ['first', null, 0],
      ['second', null, 1],
      ['collision.*', 'продукты столкновения', 2],
    ]);
    expect(collision.links).toEqual([
      { row: 2, kind: 'collide', fromColumns: [0, 1], toColumns: [2] },
    ]);
    expect(
      collision.nodes
        .filter((node) => node.row > 2)
        .map((node) => [node.row, node.column, node.operation]),
    ).toEqual([
      [3, 2, 'evolve'],
      [4, 2, 'measureSystem'],
    ]);
  });

  it('gives nuclei, atoms and molecules their own captioned lanes with influence nodes', () => {
    const symbols: Readonly<Record<number, string>> = { 1: 'H', 8: 'O', 26: 'Fe' };
    const matter = layoutPlan(
      {
        name: 'matter',
        parameters: {},
        shots: 1,
        steps: [
          { operation: 'createNucleus', label: 'iron', protons: 26, massNumber: 56 },
          { operation: 'createAtom', label: 'ion', protons: 26, charge: 2 },
          {
            operation: 'createMolecule',
            label: 'water',
            atoms: [{ protons: 8 }, { protons: 1 }, { protons: 1 }],
            bonds: [
              { first: 0, second: 1, order: 1 },
              { first: 0, second: 2, order: 1 },
            ],
          },
          { operation: 'influence', influence: 'irradiate', targets: ['water'] },
          { operation: 'measureSystem', record: 'after' },
        ],
        report: [],
      },
      [],
      (protons) => symbols[protons] ?? '?',
    );
    expect(matter.lanes.map((lane) => lane.caption)).toEqual([
      'ядро Fe-56',
      'ион Fe2+',
      'молекула H2O',
    ]);
    expect(matter.nodes.filter((node) => node.row === 3).map((node) => node.column)).toEqual([2]);
    expect(matter.nodes.filter((node) => node.row === 4)).toHaveLength(3);
  });
});

describe('environmentBands', () => {
  const plan: ExperimentPlan = {
    name: 'bands',
    parameters: {},
    shots: 1,
    seed: 1,
    steps: [
      {
        operation: 'influence',
        influence: 'setTemperature',
        parameters: { temperatureInKelvin: 300 },
      },
      { operation: 'influence', influence: 'setMedium', parameters: { components: [] } },
      { operation: 'createAtom', label: 'first', protons: 8 },
      { operation: 'createAtom', label: 'second', protons: 8 },
      {
        operation: 'influence',
        influence: 'setMedium',
        parameters: { components: [] },
        targets: ['second'],
      },
      {
        operation: 'influence',
        influence: 'setTemperature',
        parameters: { temperatureInKelvin: 900 },
      },
      { operation: 'evolve', durationInSeconds: 1 },
    ],
    report: [],
  };

  it('spans every lane for system-wide environments and only the named lanes for targeted ones', () => {
    const { bands, lanes } = layoutPlan(plan, [], () => 'O');
    expect(bands.map((band) => [band.aspect, band.row, band.endRow, band.columns])).toEqual([
      ['temperature', 0, 4, null],
      ['medium', 1, 6, null],
      ['medium', 4, 6, [lanes[1]?.column]],
      ['temperature', 5, 6, null],
    ]);
    expect(bands.map((band) => band.topRow)).toEqual([0, 1, 4, 5]);
    expect(bands.map((band) => band.depth)).toEqual([0, 1, 2, 1]);
  });

  it('wraps the particles created just above a medium that reaches them first', () => {
    const later: ExperimentPlan = {
      name: 'later',
      parameters: {},
      shots: 1,
      seed: 1,
      steps: [
        { operation: 'createAtom', label: 'first', protons: 8 },
        { operation: 'createAtom', label: 'second', protons: 8 },
        { operation: 'influence', influence: 'setMedium', parameters: { components: [] } },
        { operation: 'measureSystem', record: 'inGas' },
        {
          operation: 'influence',
          influence: 'setTemperature',
          parameters: { temperatureInKelvin: 900 },
        },
        { operation: 'evolve', durationInSeconds: 1 },
      ],
      report: [],
    };
    const { bands } = layoutPlan(later, [], () => 'O');
    expect(bands.map((band) => [band.aspect, band.row, band.topRow, band.depth])).toEqual([
      ['medium', 2, 0, 0],
      ['temperature', 4, 4, 1],
    ]);
  });
});

describe('particle groups on the diagram', () => {
  const grouped: ExperimentPlan = {
    name: 'groups',
    parameters: { atoms: 100 },
    shots: 1,
    steps: [
      { operation: 'createAtom', label: 'carbon', protons: 6, count: '{{atoms}}' },
      { operation: 'create', label: 'probe', particle: 'electron' },
      {
        operation: 'influence',
        influence: 'setTemperature',
        targets: ['carbon'],
        parameters: { temperatureInKelvin: 500 },
      },
      { operation: 'evolve', durationInSeconds: 1, targets: ['carbon7'] },
    ],
    report: [],
  };

  it('gives a group one lane with a stacked node, and its members land on that lane', () => {
    const layout = layoutPlan(grouped);
    expect(layout.lanes.map((lane) => lane.label)).toEqual(['carbon', 'probe']);
    expect(layout.lanes[0]?.members).toHaveLength(100);
    const created = layout.nodes.find((node) => node.row === 0);
    expect(created?.stacked).toBe(true);
    expect(created?.note).toMatch(/100/);
    expect(layout.nodes.filter((node) => node.row === 3).map((node) => node.column)).toEqual([0]);
    expect(layout.bands[0]?.columns).toEqual([0]);
  });
});
