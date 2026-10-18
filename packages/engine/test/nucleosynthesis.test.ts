/* Checks the nucleosynthesis templates built on REACLIB and NUBASE: carbon burning splits between neon and sodium, the deuterium bottleneck holds while hot and helium forms after cooling,
   the s-process climbs well past iron in two thousand years, and nitrogen in atomic hydrogen ends as ammonia. */
import { describe, expect, it } from 'vitest';
import { EXPERIMENT_TEMPLATES, runExperiment } from '../src/index.js';

const SEED = 20261017;
const QUICK_SHOTS = 300;
const S_PROCESS_SHOTS = 60;
const MONTE_CARLO_TIMEOUT_IN_MILLISECONDS = 300_000;
const IRON_MASS_NUMBER = 56;

function values(name: keyof typeof EXPERIMENT_TEMPLATES, shots: number) {
  const plan = EXPERIMENT_TEMPLATES[name];
  if (plan === undefined) {
    throw new Error(`${String(name)} template expected`);
  }
  return runExperiment(plan, { seed: SEED, shots, includeSystemReport: false }).reportValues;
}

describe('nucleosynthesis templates', () => {
  it(
    'burns carbon into neon and sodium',
    () => {
      const result = values('carbonBurning', QUICK_SHOTS);
      expect(result['Что стало с углеродом[20Ne]']).toBeGreaterThan(0.3);
      expect(result['Что стало с углеродом[23Na]']).toBeGreaterThan(0.2);
    },
    MONTE_CARLO_TIMEOUT_IN_MILLISECONDS,
  );

  it(
    'holds the deuterium bottleneck while hot and makes helium after cooling',
    () => {
      const result = values('firstNucleiAfterBigBang', QUICK_SHOTS);
      expect(result['Пока горячо: самое тяжелое ядро[neutron]']).toBe(1);
      expect(result['После остывания: самое тяжелое ядро[alphaParticle]']).toBeGreaterThan(0.1);
    },
    MONTE_CARLO_TIMEOUT_IN_MILLISECONDS,
  );

  it(
    'climbs far beyond iron in the s-process',
    () => {
      const result = values('sProcessIron', S_PROCESS_SHOTS);
      expect(result['Массовое число через 2000 лет']).toBeGreaterThan(2 * IRON_MASS_NUMBER);
      expect(result['Бета-распадов на пути']).toBeGreaterThan(10);
    },
    MONTE_CARLO_TIMEOUT_IN_MILLISECONDS,
  );

  it(
    'assembles ammonia from a nitrogen atom in hydrogen',
    () => {
      expect(values('ammoniaFromAtoms', QUICK_SHOTS)['Через микросекунду[H3N]']).toBe(1);
    },
    MONTE_CARLO_TIMEOUT_IN_MILLISECONDS,
  );
});
