/* Checks neutron transport and fission from ENDF/B-VIII.0: the generated data against values of the evaluation (σ_f and ν̄ of uranium-235 at 1 MeV, yields summing to two), fission and capture
   conserving charge and baryon number with the target taken from the medium, a chain that grows in a large uranium-235 ball and dies in a small one and in natural uranium. */
import { fissionYields, neutronData } from '@standard-model/constants';
import { describe, expect, it } from 'vitest';
import {
  EXPERIMENT_TEMPLATES,
  experiment,
  neutronCrossSectionInBarns,
  runExperiment,
} from '../src/index.js';

const MEGA_ELECTRON_VOLT = 1e6;
const EVALUATED_FISSION_IN_BARNS = 1.204;
const EVALUATED_PROMPT_NEUTRONS = 2.517;
const RELATIVE_TOLERANCE = 0.01;
const YIELD_SUM = 2;
const URANIUM_METAL = 4.83e28;
const TARGET_BARYONS = 235;
const TARGET_CHARGE = 92;
const SHOTS = 60;
const SEED_NEUTRONS = 4;

function template(name: string) {
  const plan = EXPERIMENT_TEMPLATES[name];
  if (plan === undefined) {
    throw new Error(`${name} template expected`);
  }
  return plan;
}

describe('ENDF/B-VIII.0 data', () => {
  it('holds the uranium-235 fission cross section, prompt neutrons and yields of the evaluation', () => {
    const uranium = neutronData(92, 235);
    expect(uranium).not.toBeNull();
    if (uranium === null) {
      return;
    }
    const fission = neutronCrossSectionInBarns(uranium, 'fission', MEGA_ELECTRON_VOLT);
    expect(Math.abs(fission / EVALUATED_FISSION_IN_BARNS - 1)).toBeLessThan(RELATIVE_TOLERANCE);
    const prompt = uranium.promptNeutrons;
    const [energies = [], values = []] = prompt ?? [];
    const index = energies.findIndex((energy) => energy >= MEGA_ELECTRON_VOLT);
    expect(Math.abs((values[index] ?? 0) / EVALUATED_PROMPT_NEUTRONS - 1)).toBeLessThan(0.02);
    const yields = fissionYields(92, 235);
    yields?.fragments.forEach((set) =>
      expect(
        Math.abs(set.reduce((sum, fragment) => sum + fragment[2], 0) - YIELD_SUM),
      ).toBeLessThan(0.01),
    );
  });
});

describe('neutron reactions in uranium', () => {
  it('conserves charge and baryon number, the target nucleus coming from the medium', () => {
    const plan = experiment('one neutron')
      .influence('setMedium', {
        components: [{ species: 'atom:92:235:0', numberDensityPerCubicMeter: URANIUM_METAL }],
        temperatureInKelvin: 293,
      })
      .create('neutron', 'neutron', { momentumInGev: { x: 0, y: 0, z: 0.0613 } })
      .evolve(1e-7)
      .build();
    const report = runExperiment(plan, { shots: 1 }).systemReports ?? [];
    expect(report.length).toBeGreaterThan(0);
    report.forEach((trace) => {
      const last = trace.frames[trace.frames.length - 1];
      const alive = (last?.particles ?? []).filter((particle) => particle.status === 'alive');
      const charge = alive.reduce((sum, particle) => sum + particle.chargeInElementaryUnits, 0);
      const baryons = alive.reduce(
        (sum, particle) =>
          sum + (particle.name === 'neutron' ? 1 : (particle.readings?.massNumber ?? 0)),
        0,
      );
      expect([0, TARGET_CHARGE]).toContain(charge);
      expect([1, 1 + TARGET_BARYONS]).toContain(baryons);
    });
  });

  it('grows in a large uranium-235 ball and dies in a small one and in natural uranium', () => {
    const last = (values: Record<string, number | null>) => values['Нейтронов через 80 нс'] ?? 0;
    const large = runExperiment(template('uraniumChainReaction'), {
      shots: SHOTS,
      includeSystemReport: false,
    });
    expect(last(large.reportValues)).toBeGreaterThan(10 * SEED_NEUTRONS);
    const small = runExperiment(template('uraniumChainReaction'), {
      shots: SHOTS,
      includeSystemReport: false,
      parameters: { coreDiameterInMeters: 0.06 },
    });
    expect(last(small.reportValues)).toBeLessThan(2 * SEED_NEUTRONS);
    const natural = runExperiment(template('naturalUraniumChainDies'), {
      shots: SHOTS,
      includeSystemReport: false,
    });
    expect(last(natural.reportValues)).toBeLessThan(2 * SEED_NEUTRONS);
  }, 300_000);
});
