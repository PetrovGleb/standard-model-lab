/* Checks environment envelopes: the shared environment wraps everyone and contains a region on part of them, shared environments set at different steps nest with the earlier outside,
   members of a region sit side by side, equal parameters on separate particles share a badge, a region over everyone overrides the shared aspect, and a set that cannot be contiguous
   is cut into runs. */
import type { ParticleName, ParticleView, SystemFrame } from '@standard-model/contracts';
import { describe, expect, it } from 'vitest';
import {
  environmentBadges,
  envelopeOrder,
  envelopeRuns,
  frameEnvelopes,
} from '../src/environment-envelopes';
import { layoutStage } from '../src/system-stage';

const STAGE_WIDTH = 900;
const STAGE_PADDING = 90;
const HYDROGEN = { components: [{ species: 'hydrogenAtom', numberDensityPerCubicMeter: 1e24 }] };
const HELIUM = { components: [{ species: 'heliumAtom', numberDensityPerCubicMeter: 1e25 }] };
const WARM = { temperatureInKelvin: 300 };

function particle(label: string): ParticleView {
  return {
    label,
    id: label,
    name: `electron-${label}` as ParticleName,
    symbol: `e-${label}`,
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
  };
}

function frame(
  labels: readonly string[],
  environment: SystemFrame['environment'],
  regions: SystemFrame['regions'],
): SystemFrame {
  return {
    stepIndex: 0,
    step: null,
    particles: labels.map(particle),
    environment,
    regions,
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
    space: null,
  };
}

describe('frameEnvelopes', () => {
  const nested = frame(['first', 'bubble', 'last'], { medium: HYDROGEN }, [
    { id: 1, aspect: 'temperature', value: WARM, members: ['bubble'] },
  ]);

  it('wraps everyone in the shared environment around a region on one particle', () => {
    const [outer, inner] = frameEnvelopes(nested);
    expect(outer?.shared).toBe(true);
    expect(outer?.members).toEqual(['first', 'bubble', 'last']);
    expect(outer?.depth).toBe(1);
    expect(inner?.members).toEqual(['bubble']);
    expect(inner?.depth).toBe(0);
  });

  it('nests shared environments set at different steps, the earlier one outside', () => {
    const envelopes = frameEnvelopes(frame(['water'], { temperature: WARM, medium: HELIUM }, []));
    expect(envelopes.map((envelope) => envelope.aspects[0]?.aspect)).toEqual([
      'temperature',
      'medium',
    ]);
    expect(envelopes.map((envelope) => envelope.depth)).toEqual([1, 0]);
    expect(envelopes.every((envelope) => envelope.shared)).toBe(true);
    const stored = frameEnvelopes({
      ...frame(['water'], { medium: HELIUM, temperature: WARM }, []),
      environmentOrder: ['temperature', 'medium'],
    });
    expect(stored.map((envelope) => envelope.aspects[0]?.aspect)).toEqual([
      'temperature',
      'medium',
    ]);
  });

  it('lets a region over everyone override the shared aspect', () => {
    const envelopes = frameEnvelopes(
      frame(['first', 'second'], { medium: HYDROGEN }, [
        { id: 1, aspect: 'medium', value: HELIUM, members: ['first', 'second'] },
      ]),
    );
    expect(envelopes).toHaveLength(1);
    expect(envelopes[0]?.aspects.map((aspect) => aspect.value)).toEqual([HELIUM]);
  });

  it('places region members next to each other and keeps the shared envelope one run', () => {
    const order = envelopeOrder(['first', 'bubble', 'last'], frameEnvelopes(nested));
    expect(order).toEqual(['first', 'last', 'bubble']);
    expect(envelopeRuns(order, frameEnvelopes(nested)).map((run) => run.members)).toEqual([
      ['first', 'last', 'bubble'],
      ['bubble'],
    ]);
    const nodes = layoutStage([nested], 0, STAGE_WIDTH, STAGE_PADDING);
    expect(nodes.map((node) => node.label)).toEqual(['first', 'last', 'bubble']);
  });
});

describe('separate and split envelopes', () => {
  it('gives equal parameters on separate particles one badge', () => {
    const apart = frame(['left', 'middle', 'right'], {}, [
      { id: 1, aspect: 'medium', value: HYDROGEN, members: ['left'] },
      { id: 2, aspect: 'medium', value: HYDROGEN, members: ['right'] },
    ]);
    expect(frameEnvelopes(apart)).toHaveLength(2);
    expect([...environmentBadges([apart]).values()]).toEqual([1]);
  });

  it('cuts a set that cannot sit together into runs', () => {
    const tangled = frame(['one', 'two', 'three'], {}, [
      { id: 1, aspect: 'medium', value: HYDROGEN, members: ['one', 'two'] },
      { id: 2, aspect: 'temperature', value: WARM, members: ['two', 'three'] },
      {
        id: 3,
        aspect: 'magneticField',
        value: { fieldInTesla: { x: 0, y: 0, z: 1 } },
        members: ['one', 'three'],
      },
    ]);
    const envelopes = frameEnvelopes(tangled);
    const runs = envelopeRuns(envelopeOrder(['one', 'two', 'three'], envelopes), envelopes);
    expect(runs).toHaveLength(4);
    expect(environmentBadges([tangled]).size).toBe(1);
  });
});
