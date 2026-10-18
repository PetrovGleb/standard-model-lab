/* Checks the carry-over plan: survivors only, safe labels, spin direction from the Bloch vector, exact joint amplitudes, clouds as gaussian packets no narrower than the grid allows,
   identical survivors folded into counted groups with labels that collide with nothing, and named particles kept apart. */
import type { ParticleView, QuantumSlotView, SystemReport } from '@standard-model/contracts';
import { describe, expect, it } from 'vitest';
import { carryOverPlan, foldIdenticalSteps } from '../src/carry-over';

function slot(patch: Partial<QuantumSlotView>): QuantumSlotView {
  return {
    observable: 'spin',
    dimension: 2,
    registerId: 'r',
    sharesRegisterWith: [],
    entangled: false,
    purity: 1,
    entropyInBits: 0,
    blochVector: { x: 0, y: 1, z: 0 },
    basisPopulations: [0.5, 0.5],
    registerState: null,
    ...patch,
  };
}

function particle(label: string, patch: Partial<ParticleView> = {}): ParticleView {
  return {
    label,
    id: label,
    name: 'electron',
    symbol: 'e-',
    family: 'chargedLepton',
    status: 'alive',
    massInGev: 0.000511,
    chargeInElementaryUnits: -1,
    energyInGev: 0.000511,
    momentumInGev: { x: 0, y: 0, z: 0 },
    positionInFemtometers: { x: 0, y: 0, z: 0 },
    properTimeInSeconds: 0,
    lorentzFactor: 1,
    quantum: [],
    ...patch,
  };
}

const JOINT = {
  slots: ['collision.0', 'collision.1'],
  real: [0, 0.7, -0.7, 0],
  imaginary: [0, 0, 0, 0.1],
  closestNamedState: 'spinSinglet' as const,
  closestNamedStateFidelity: 0.98,
};

const REPORT: SystemReport = {
  seed: 7,
  note: '',
  frames: [
    {
      stepIndex: 3,
      step: null,
      environment: {},
      regions: [],
      events: [],
      totals: {
        chargeInElementaryUnits: 0,
        baryonNumber: 0,
        electronNumber: 0,
        muonNumber: 0,
        tauNumber: 0,
        energyInGev: 0,
        momentumInGev: { x: 0, y: 0, z: 0 },
      },
      particles: [
        particle('beam', { status: 'collided' }),
        particle('free', {
          momentumInGev: { x: 0, y: 0, z: 1e-6 },
          quantum: [slot({})],
        }),
        particle('collision.0', {
          quantum: [slot({ entangled: true, blochVector: null, registerState: JOINT })],
        }),
        particle('collision.1', {
          quantum: [slot({ entangled: true, blochVector: null, registerState: JOINT })],
        }),
      ],
      space: {
        gridPointsPerAxis: 32,
        cellSizeInMeters: 5e-11,
        edgeInMeters: 1.6e-9,
        potential: 'barrier',
        potentialEnergyInEv: 10,
        barrierThicknessInMeters: 1e-10,
        nuclearCharge: 1,
        clouds: [
          {
            label: 'free',
            resolution: 16,
            density: [],
            projectionResolution: 32,
            projectionXy: [],
            projectionXz: [],
            projectionYz: [],
            meanPositionInMeters: { x: 1e-10, y: 0, z: 0 },
            spreadInMeters: { x: 1e-12, y: 1e-12, z: 1e-12 },
            probabilityInside: 1,
            energyInEv: 5,
          },
        ],
      },
    },
  ],
};

describe('carryOverPlan', () => {
  const plan = carryOverPlan(REPORT, 'source');

  it('recreates only survivors with safe labels and their spin direction', () => {
    expect(plan.name).toBe('sourceNext');
    expect(plan.space?.potential).toBe('barrier');
    expect(plan.steps.slice(0, 3)).toEqual([
      {
        operation: 'create',
        label: 'free',
        particle: 'electron',
        momentumInGev: { x: 0, y: 0, z: 1e-6 },
        spinDirection: { polarAngleDegrees: 90, azimuthDegrees: 90 },
      },
      { operation: 'create', label: 'collision_0', particle: 'electron' },
      { operation: 'create', label: 'collision_1', particle: 'electron' },
    ]);
  });

  it('entangles the pair once with its exact amplitudes and places the cloud', () => {
    expect(plan.steps.slice(3)).toEqual([
      {
        operation: 'entangle',
        targets: ['collision_0', 'collision_1'],
        state: 'spinSinglet',
        amplitudes: { real: JOINT.real, imaginary: JOINT.imaginary },
        observable: 'spin',
      },
      {
        operation: 'place',
        target: 'free',
        centerInMeters: { x: 1e-10, y: 0, z: 0 },
        widthInMeters: 7.5e-11,
        shape: 'gaussian',
      },
    ]);
  });

  it('folds identical survivors into one step named like the engine names the species', () => {
    const methane = 'molecule:6-12,1-1,1-1,1-1,1-1;0-1-1,0-2-1,0-3-1,0-4-1';
    const soup: SystemReport = {
      ...REPORT,
      frames: [
        {
          ...REPORT.frames[0]!,
          space: null,
          particles: [
            particle('moleculeCH42', { name: methane, symbol: 'CH4', family: 'molecule' }),
            particle('moleculeCH43', { name: methane, symbol: 'CH4', family: 'molecule' }),
            particle('moleculeCH45', { name: methane, symbol: 'CH4', family: 'molecule' }),
            particle('moleculeCH46', {
              name: methane,
              symbol: 'CH4',
              family: 'molecule',
              momentumInGev: { x: 0, y: 0, z: 1e-3 },
            }),
            particle('atom15', { name: 'atom:26:56:0', symbol: '56Fe', family: 'atom' }),
            particle('atom16', { name: 'atom:26:56:0', symbol: '56Fe', family: 'atom' }),
            particle('ion1', { name: 'atom:11:23:1', symbol: '23Na+', family: 'atom' }),
          ],
        },
      ],
    };
    const steps = carryOverPlan(soup, 'soup').steps;
    expect(steps.map((step) => ('label' in step ? step.label : ''))).toEqual([
      'moleculeCH4',
      'moleculeCH46',
      'atomFe56',
      'ion1',
    ]);
    expect(steps[0]).toMatchObject({ operation: 'createMolecule', count: 3 });
    expect(steps[2]).toMatchObject({ operation: 'createAtom', count: 2 });
    expect(steps[1]).not.toHaveProperty('count');
  });

  it('carries a molecular ion over with its formal charges', () => {
    const hydronium = 'molecule:8-16,1-1,1-1,1-1;0-1-1,0-2-1,0-3-1;0+1';
    const ions: SystemReport = {
      ...REPORT,
      frames: [
        {
          ...REPORT.frames[0]!,
          space: null,
          particles: [
            particle('hydronium', { name: hydronium, symbol: 'H3O+', family: 'molecule' }),
            particle('water', {
              name: 'molecule:8-16,1-1,1-1;0-1-1,0-2-1',
              symbol: 'H2O',
              family: 'molecule',
            }),
          ],
        },
      ],
    };
    const [ion, water] = carryOverPlan(ions, 'acid').steps;
    expect(ion).toEqual({
      operation: 'createMolecule',
      label: 'hydronium',
      atoms: [
        { protons: 8, massNumber: 16 },
        { protons: 1, massNumber: 1 },
        { protons: 1, massNumber: 1 },
        { protons: 1, massNumber: 1 },
      ],
      bonds: [
        { first: 0, second: 1, order: 1 },
        { first: 0, second: 2, order: 1 },
        { first: 0, second: 3, order: 1 },
      ],
      charges: [{ atom: 0, charge: 1 }],
    });
    expect(water).not.toHaveProperty('charges');
  });

  it('moves a group label away from labels that stay', () => {
    const iron = (label: string, massNumber: number) => ({
      step: { operation: 'createAtom', label, protons: 26, massNumber, charge: 0 } as const,
      base: 'atomFe56',
    });
    const folded = foldIdenticalSteps(
      [iron('a', 56), iron('atomFe561', 54), iron('b', 56)],
      new Set(),
    );
    expect(folded.map((step) => [step.label, step.count ?? 1])).toEqual([
      ['atomFe56Group', 2],
      ['atomFe561', 1],
    ]);
  });
});
