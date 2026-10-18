/* Checks confinement: free quarks bind into the matching catalog baryon only after ħ/Λ_QCD, the field supplies the baryon mass, quark–antiquark pairs become mesons, and colour without a partner leaves as a jet. */
import { PARTICLE_CATALOG } from '@standard-model/constants';
import { describe, expect, it } from 'vitest';
import { experiment, HADRONIZATION_TIME_IN_SECONDS, runExperiment } from '../src/index.js';

function systemAfter(
  quarks: readonly string[],
  durationInSeconds: number,
): Record<string, number | null> {
  const builder = experiment('confinement');
  quarks.forEach((quark, index) => builder.create(`q${String(index)}`, quark as never));
  return runExperiment(
    builder
      .evolve(durationInSeconds)
      .measureSystem('system')
      .report('frequency', ['system'], 'system')
      .build(),
    { shots: 20, seed: 1 },
  ).reportValues;
}

describe('hadronization', () => {
  it('binds u u d into a proton, u d d into a neutron and antiquarks into an antiproton', () => {
    const after = 10 * HADRONIZATION_TIME_IN_SECONDS;
    expect(systemAfter(['up', 'up', 'down'], after)['system[proton]']).toBe(1);
    expect(systemAfter(['up', 'down', 'down'], after)['system[neutron]']).toBe(1);
    expect(systemAfter(['antiUp', 'antiUp', 'antiDown'], after)['system[antiProton]']).toBe(1);
  });

  it('keeps quarks free before ħ/Λ_QCD has passed', () => {
    expect(
      systemAfter(['up', 'up', 'down'], HADRONIZATION_TIME_IN_SECONDS / 10)['system[down+up+up]'],
    ).toBe(1);
  });

  it('turns a quark–antiquark pair into mesons and lone colour into a jet', () => {
    const after = 10 * HADRONIZATION_TIME_IN_SECONDS;
    expect(systemAfter(['strange', 'antiStrange'], after)['system[hadrons]']).toBe(1);
    expect(systemAfter(['up', 'up', 'down', 'antiUp'], after)['system[proton+jet]']).toBe(1);
    expect(systemAfter(['charm'], after)['system[jet]']).toBe(1);
  });

  it('takes the baryon mass from the gluon field, not from the quarks', () => {
    const plan = experiment('field')
      .create('first', 'up')
      .create('second', 'up')
      .create('third', 'down')
      .evolve(10 * HADRONIZATION_TIME_IN_SECONDS)
      .build();
    const frames =
      runExperiment({ ...plan, report: [] }, { shots: 1, seed: 1 }).systemReport?.frames ?? [];
    const proton = frames.at(-1)?.particles.find((particle) => particle.name === 'proton');
    expect(proton?.energyInGev).toBeCloseTo(PARTICLE_CATALOG.proton.massInGev.value, 2);
    expect(frames.at(-1)?.events.some((event) => event.kind === 'hadronized')).toBe(true);
  });
});
