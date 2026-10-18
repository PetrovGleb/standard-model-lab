/* Checks combine: quark triples become the matching catalog composite with summed momentum, constituents retire, wrong content is refused. */
import { describe, expect, it } from 'vitest';
import { compositeFor, createEngine, experiment, runExperiment } from '../src/index.js';

const SEED = 23;

describe('Combinations', () => {
  it('assembles protons, neutrons and their antiparticles from quark triples', () => {
    expect(compositeFor(['up', 'up', 'down'])).toBe('proton');
    expect(compositeFor(['down', 'up', 'down'])).toBe('neutron');
    expect(compositeFor(['antiUp', 'antiUp', 'antiDown'])).toBe('antiProton');
    expect(compositeFor(['up', 'down', 'strange'])).toBe('lambdaBaryon');
    expect(compositeFor(['up', 'down'])).toBeNull();
  });

  it('sums momenta, keeps the catalog mass and retires the constituents', () => {
    const engine = createEngine({ seed: SEED });
    const quarks = [
      engine.particles.create('up', { momentumInGev: { x: 1, y: 0, z: 0 } }),
      engine.particles.create('up', { momentumInGev: { x: 0, y: 2, z: 0 } }),
      engine.particles.create('down', { momentumInGev: { x: 0, y: 0, z: 3 } }),
    ];
    engine.quantum.prepare(quarks[0]!, 'spin', 'up');
    const proton = engine.combinations.combine(quarks);
    expect(proton.spec.name).toBe('proton');
    expect(proton.kinematics.fourMomentumInGev.momentum).toEqual({ x: 1, y: 2, z: 3 });
    expect(proton.spec.massInGev.value).toBeCloseTo(0.938272, 6);
    expect(quarks.every((quark) => quark.status === 'bound')).toBe(true);
    expect(engine.quantum.registers.size).toBe(1);
    expect(proton.quantumSlot('spin')).not.toBeNull();
    expect(() => engine.combinations.combine(quarks)).toThrow(/bound/);
    expect(() =>
      engine.combinations.combine([
        engine.particles.create('up'),
        engine.particles.create('strange'),
      ]),
    ).toThrow(/No catalog particle/);
  });

  it('runs a plan that combines quarks into a neutron and lets it decay', () => {
    const plan = experiment('quarksToNeutron')
      .create('q1', 'up')
      .create('q2', 'down')
      .create('q3', 'down')
      .combine(['q1', 'q2', 'q3'], 'neutron')
      .decay('neutron', 'decay')
      .report('frequency', ['decay'], 'channel')
      .build();
    const result = runExperiment(plan, { shots: 20, seed: SEED });
    expect(result.reportValues['channel[proton+electron+electronAntineutrino]']).toBe(1);
  });
});

describe('combined particles in plans', () => {
  it('leaves the proton spin unpolarized and measurable', () => {
    const plan = experiment('protonSpin')
      .create('q1', 'up', { spin: 'up' })
      .create('q2', 'up')
      .create('q3', 'down')
      .combine(['q1', 'q2', 'q3'], 'proton')
      .measure('proton', 'spin', 'spin')
      .report('frequency', ['spin'], 'spin')
      .build();
    const result = runExperiment(plan, { shots: 4000, seed: SEED });
    expect(Math.abs((result.reportValues['spin[0.5]'] ?? 0) - 0.5)).toBeLessThan(0.04);
  });

  it('refuses flavor on a proton, consumed constituents and wrong quark content before running', () => {
    const base = experiment('bad')
      .create('q1', 'up')
      .create('q2', 'up')
      .create('q3', 'down')
      .combine(['q1', 'q2', 'q3'], 'proton');
    expect(() =>
      runExperiment(base.measure('proton', 'flavor', 'f').build(), { shots: 1 }),
    ).toThrow(/proton is a proton and has no flavor; it has spin/);
    const reuse = experiment('reuse')
      .create('q1', 'up')
      .create('q2', 'up')
      .create('q3', 'down')
      .combine(['q1', 'q2', 'q3'], 'proton')
      .evolve(1e-9, ['q2'])
      .build();
    expect(() => runExperiment(reuse, { shots: 1 })).toThrow(
      /q2 no longer exists: it was combined into proton/,
    );
    const wrong = experiment('wrong')
      .create('q1', 'up')
      .create('q2', 'strange')
      .combine(['q1', 'q2'], 'x')
      .build();
    expect(() => runExperiment(wrong, { shots: 1 })).toThrow(
      /no particle is made of up \+ strange/,
    );
  });
});
