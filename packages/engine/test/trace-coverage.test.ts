/* Checks that the traced shots of a run cover its distinct outcomes: a rare fusion branch of a deuteron in tritium plasma gets a traced shot although the first six seeds miss it, the first
   seed is always kept, and the search stops at six shots when they already differ. */
import type { SystemReport } from '@standard-model/contracts';
import { describe, expect, it } from 'vitest';
import { EXPERIMENT_TEMPLATES, runExperiment } from '../src/index.js';
import { tracedReports } from '../src/experiment/run-experiment.js';

const SEED = 1;
const SHOTS = 200;
const TRACED_SHOTS = 6;
const TRACE_SEARCH_LIMIT = 240;

function report(seed: number, outcome: string): SystemReport {
  return {
    seed,
    note: '',
    frames: [
      {
        stepIndex: 0,
        step: null,
        particles: outcome.split('+').map((name) => ({
          label: name,
          id: name,
          name: name as SystemReport['frames'][number]['particles'][number]['name'],
          symbol: name,
          family: 'baryon',
          status: 'alive',
          massInGev: 1,
          chargeInElementaryUnits: 0,
          energyInGev: 1,
          momentumInGev: { x: 0, y: 0, z: 0 },
          positionInFemtometers: { x: 0, y: 0, z: 0 },
          properTimeInSeconds: 0,
          lorentzFactor: 1,
          quantum: [],
        })),
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
        space: null,
      },
    ],
  };
}

describe('tracedReports', () => {
  it('keeps the first seed and adds the first shot of every other outcome it finds', () => {
    const outcomes = ['d', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'alpha+n', 'd', 'd', 'h+n'];
    let traced = 0;
    const reports = tracedReports(
      (seed) => {
        traced += 1;
        return report(seed, outcomes[seed] ?? 'd');
      },
      0,
      () => 0,
    );
    expect(reports.map((entry) => entry.seed)).toEqual([0, 1, 2, 3, 8, 11]);
    expect(traced).toBe(TRACE_SEARCH_LIMIT);
  });

  it('stops at six shots when they already differ', () => {
    let traced = 0;
    const reports = tracedReports(
      (seed) => {
        traced += 1;
        return report(seed, `outcome${String(seed)}`);
      },
      10,
      () => 0,
    );
    expect(reports.map((entry) => entry.seed)).toEqual([10, 11, 12, 13, 14, 15]);
    expect(traced).toBe(TRACED_SHOTS);
  });

  it('traces a rare fusion branch of a deuteron in tritium plasma', () => {
    const plan = EXPERIMENT_TEMPLATES.deuteriumTritiumPlasma;
    if (plan === undefined) {
      throw new Error('deuteriumTritiumPlasma template expected');
    }
    const result = runExperiment(plan, { seed: SEED, shots: SHOTS });
    const outcomes = new Set(
      (result.systemReports ?? []).map((entry) =>
        (entry.frames.at(-1)?.particles ?? [])
          .filter((particle) => particle.status === 'alive')
          .map((particle) => particle.name)
          .sort()
          .join('+'),
      ),
    );
    expect(outcomes.has('deuteron')).toBe(true);
    expect(outcomes.has('alphaParticle+neutron')).toBe(true);
  });
});
