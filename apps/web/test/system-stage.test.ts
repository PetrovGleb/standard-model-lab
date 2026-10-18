/* Checks the stage layout: evenly spaced live particles in rows of at most six, identical particles folded into one group that can be expanded, merging constituents moving to the composite,
   decaying parents fading in place. */
import type { ParticleName, ParticleView, SystemFrame } from '@standard-model/contracts';
import { describe, expect, it } from 'vitest';
import {
  appearanceOrder,
  layoutStage,
  linkBundles,
  nodeRadius,
  safeHalfWidth,
  zoomedAt,
} from '../src/system-stage';
import { foldedEvents } from '../src/particle-text';

function particle(
  label: string,
  status: ParticleView['status'] = 'alive',
  name = `up-${label}`,
): ParticleView {
  return {
    label,
    id: label,
    name: name as ParticleName,
    symbol: name,
    family: 'quark',
    status,
    massInGev: 0.002,
    chargeInElementaryUnits: 0,
    energyInGev: 0,
    momentumInGev: { x: 0, y: 0, z: 0 },
    positionInFemtometers: { x: 0, y: 0, z: 0 },
    properTimeInSeconds: 0,
    lorentzFactor: 1,
    quantum: [],
  };
}

const TOTALS = {
  chargeInElementaryUnits: 0,
  baryonNumber: 0,
  electronNumber: 0,
  muonNumber: 0,
  tauNumber: 0,
  energyInGev: 0,
  momentumInGev: { x: 0, y: 0, z: 0 },
};

function frame(
  particles: readonly ParticleView[],
  events: SystemFrame['events'] = [],
): SystemFrame {
  return {
    stepIndex: 0,
    step: null,
    particles,
    environment: {},
    regions: [],
    events,
    totals: TOTALS,
    space: null,
  };
}

describe('layoutStage', () => {
  const frames = [
    frame([]),
    frame([particle('q1'), particle('q2'), particle('q3')]),
    frame(
      [particle('q1', 'bound'), particle('q2', 'bound'), particle('q3', 'bound'), particle('p')],
      [{ kind: 'combined', labels: ['q1', 'q2', 'q3', 'p'], text: '' }],
    ),
  ];

  it('spreads live particles across the stage', () => {
    expect(layoutStage(frames, 1, 900, 90).map((node) => node.x)).toEqual([90, 450, 810]);
    expect(appearanceOrder(frames)).toEqual(['q1', 'q2', 'q3', 'p']);
  });

  it('keeps every neighbour outside both safe zones and centres a row on the stage', () => {
    const crowd = Array.from({ length: 6 }, (unused, position) =>
      particle(`particle${String(position)}`),
    );
    const nodes = layoutStage([frame(crowd)], 0, 900, 90);
    nodes.slice(1).forEach((node, position) => {
      const before = nodes[position];
      expect(before).toBeDefined();
      if (before !== undefined) {
        expect(node.x - before.x).toBeGreaterThanOrEqual(
          safeHalfWidth(before.view) + safeHalfWidth(node.view) - 1e-9,
        );
      }
    });
    const first = nodes[0]?.x ?? 0;
    const last = nodes[nodes.length - 1]?.x ?? 0;
    expect((first + last) / 2).toBeCloseTo(450, 9);
  });

  it('zooms about the cursor so the point under it stays put', () => {
    const viewport = { width: 900, height: 250, minimumZoom: 0.5, maximumZoom: 3 };
    const view = { zoom: 1, panX: 40, panY: -10 };
    const worldX = (current: typeof view) =>
      450 + current.panX + (0.8 - 0.5) * (900 / current.zoom);
    const zoomed = zoomedAt(view, 2, 0.8, 0.3, viewport);
    expect(zoomed.zoom).toBe(2);
    expect(worldX(zoomed)).toBeCloseTo(worldX(view), 9);
    expect(zoomedAt(view, 100, 0.5, 0.5, viewport).zoom).toBe(3);
    expect(zoomedAt(view, 0.01, 0.5, 0.5, viewport).zoom).toBe(0.5);
  });

  it('moves merging constituents onto the composite and fades them', () => {
    const nodes = layoutStage(frames, 2, 900, 90);
    const composite = nodes.find((node) => node.label === 'p');
    const leaving = nodes.filter((node) => node.leaving);
    expect(composite?.x).toBe(450);
    expect(leaving.map((node) => node.x)).toEqual([450, 450, 450]);
    expect(leaving.every((node) => node.opacity === 0)).toBe(true);
    expect(layoutStage(frames, 0, 900, 90)).toEqual([]);
  });

  it('folds identical particles into one group node and expands it on request', () => {
    const same = [
      frame(
        Array.from({ length: 20 }, (unused, position) =>
          particle(`c${String(position + 1)}`, 'alive', 'carbon'),
        ),
      ),
    ];
    const folded = layoutStage(same, 0, 900, 90);
    expect(folded).toHaveLength(1);
    expect(folded[0]?.members).toHaveLength(20);
    const key = folded[0]?.key ?? '';
    const unfolded = layoutStage(same, 0, 900, 90, { expanded: new Set([key]) });
    expect(unfolded).toHaveLength(20);
    expect(unfolded.every((node) => node.group === key)).toBe(true);
  });

  it('keeps at most six nodes in a row and puts the next ones on new rows', () => {
    const crowd = Array.from({ length: 14 }, (unused, position) =>
      particle(`particle${String(position)}`),
    );
    const nodes = layoutStage([frame(crowd)], 0, 900, 90, { centerY: 300 });
    const rows = new Map<number, number>();
    nodes.forEach((node) => rows.set(node.y, (rows.get(node.y) ?? 0) + 1));
    expect([...rows.values()]).toEqual([6, 6, 2]);
    const heights = [...rows.keys()];
    expect((Math.min(...heights) + Math.max(...heights)) / 2).toBeCloseTo(300, 9);
  });

  it('bundles reaction links between folded groups and splits them as groups unfold', () => {
    const atoms = Array.from({ length: 4 }, (unused, position) =>
      particle(`c${String(position + 1)}`, 'alive', 'carbon'),
    );
    const reacted = atoms.map((atom) => ({ ...atom, status: 'collided' as const }));
    const products = atoms.map((atom, position) =>
      particle(`m${String(position + 1)}`, 'alive', 'methane'),
    );
    const frames = [
      frame(atoms),
      frame(
        [...reacted, ...products],
        atoms.map((atom, position) => ({
          kind: 'reacted' as const,
          labels: [atom.label, `m${String(position + 1)}`],
          products: [`m${String(position + 1)}`],
          text: '',
        })),
      ),
    ];
    const folded = linkBundles(frames[1] ?? frame([]), layoutStage(frames, 1, 900, 90));
    expect(folded.map((bundle) => bundle.count)).toEqual([4]);
    const productGroup = layoutStage(frames, 1, 900, 90).find((node) => !node.leaving)?.key ?? '';
    const unfolded = linkBundles(
      frames[1] ?? frame([]),
      layoutStage(frames, 1, 900, 90, { expanded: new Set([productGroup]) }),
    );
    expect(unfolded.map((bundle) => bundle.count)).toEqual([1, 1, 1, 1]);
  });

  it('draws heavier particles larger', () => {
    expect(nodeRadius(172.6)).toBeGreaterThan(nodeRadius(0.938));
    expect(nodeRadius(0.938)).toBeGreaterThan(nodeRadius(0.000511));
    expect(nodeRadius(0)).toBe(15);
  });
});

describe('foldedEvents', () => {
  it('folds events that say the same about several particles into one line with a count', () => {
    const events: SystemFrame['events'] = [
      { kind: 'reacted', labels: ['co1', 'co2b'], text: 'co1: reactions with the gas → CO2' },
      { kind: 'reacted', labels: ['co2', 'co2c'], text: 'co2: reactions with the gas → CO2' },
      { kind: 'phaseChanged', labels: ['o1'], text: 'o1: O at 1000 K — gas' },
    ];
    const folded = foldedEvents(events);
    expect(folded.map((fold) => fold.count)).toEqual([2, 1]);
    expect(folded[0]?.text).toBe('×2 · reactions with the gas → CO2');
    expect(folded[0]?.labels).toEqual(['co1', 'co2b', 'co2', 'co2c']);
  });
});

describe('reactions on the stage', () => {
  it('moves a reacting particle into its heaviest product and links that product to the rest', () => {
    const carbon = particle('carbon1', 'alive', 'carbon');
    const frames = [
      frame([carbon]),
      frame(
        [
          { ...carbon, status: 'collided' },
          { ...particle('monoxide', 'alive', 'monoxide'), massInGev: 26 },
          { ...particle('oxygen', 'alive', 'oxygen'), massInGev: 15 },
        ],
        [
          {
            kind: 'reacted',
            labels: ['carbon1', 'monoxide', 'oxygen'],
            products: ['monoxide', 'oxygen'],
            text: '',
          },
        ],
      ),
    ];
    const nodes = layoutStage(frames, 1, 900, 90);
    const monoxide = nodes.find((node) => node.label === 'monoxide');
    const leaving = nodes.find((node) => node.leaving);
    expect(leaving?.x).toBe(monoxide?.x);
    expect(leaving?.y).toBe(monoxide?.y);
    const links = linkBundles(frames[1] ?? frame([]), nodes);
    const oxygen = nodes.find((node) => node.label === 'oxygen');
    expect(links.some((link) => link.to.x === oxygen?.x && link.from.x === monoxide?.x)).toBe(true);
  });
});
