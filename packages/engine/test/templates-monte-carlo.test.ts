/* Monte Carlo tier on the templates: singlet at 120 degrees, CHSH, Stern-Gerlach at 90 degrees and muon decay means within tolerance. */
import { PARTICLE_CATALOG } from '@standard-model/constants';
import {
  DEFAULT_MONTE_CARLO_SHOTS,
  DEFAULT_SIGMA_MULTIPLIER,
  isWithinTolerance,
  statisticalTolerance,
} from '@standard-model/utils';
import { describe, expect, it } from 'vitest';
import {
  CHSH_TEMPLATE,
  MUON_DECAY_TEMPLATE,
  runExperiment,
  SINGLET_CORRELATION_TEMPLATE,
  STERN_GERLACH_TEMPLATE,
} from '../src/index.js';

const SEED = 20261015;

describe('templates', () => {
  it('singlet at 120 degrees gives same signs three quarters of the time', () => {
    const result = runExperiment(SINGLET_CORRELATION_TEMPLATE, {
      shots: DEFAULT_MONTE_CARLO_SHOTS,
      seed: SEED,
    });
    const observed = result.reportValues.sameSign ?? 0;
    expect(
      isWithinTolerance(observed, 0.75, statisticalTolerance(0.75, DEFAULT_MONTE_CARLO_SHOTS)),
    ).toBe(true);
    expect(observed).toBeGreaterThan(2 / 3);
  });

  it('CHSH violates the local bound and sits near 2 sqrt 2', () => {
    const result = runExperiment(CHSH_TEMPLATE, { shots: DEFAULT_MONTE_CARLO_SHOTS, seed: SEED });
    const chsh = Math.abs(result.reportValues.chsh ?? 0);
    const correlationStandardError = Math.sqrt((1 - 0.5) / DEFAULT_MONTE_CARLO_SHOTS);
    const tolerance = DEFAULT_SIGMA_MULTIPLIER * 2 * correlationStandardError;
    expect(isWithinTolerance(chsh, 2 * Math.SQRT2, tolerance)).toBe(true);
    expect(chsh).toBeGreaterThan(2);
  });

  it('Stern-Gerlach at 90 degrees splits evenly', () => {
    const result = runExperiment(STERN_GERLACH_TEMPLATE, {
      shots: DEFAULT_MONTE_CARLO_SHOTS,
      seed: SEED,
    });
    const plus = result.reportValues['spin[0.5]'] ?? 0;
    expect(isWithinTolerance(plus, 0.5, statisticalTolerance(0.5, DEFAULT_MONTE_CARLO_SHOTS))).toBe(
      true,
    );
  });

  it('muon decay reproduces the mean life and the Michel mean energy', () => {
    const result = runExperiment(MUON_DECAY_TEMPLATE, {
      shots: DEFAULT_MONTE_CARLO_SHOTS,
      seed: SEED,
    });
    const meanLife = PARTICLE_CATALOG.muon.meanLifeInSeconds?.value ?? 0;
    const lifeTolerance =
      (DEFAULT_SIGMA_MULTIPLIER * meanLife) / Math.sqrt(DEFAULT_MONTE_CARLO_SHOTS);
    expect(
      isWithinTolerance(result.reportValues.meanLabTimeInSeconds ?? 0, meanLife, lifeTolerance),
    ).toBe(true);
    const halfMuonMass = PARTICLE_CATALOG.muon.massInGev.value / 2;
    const energyFraction = (result.reportValues.meanElectronEnergyInGev ?? 0) / halfMuonMass;
    const fractionTolerance =
      (DEFAULT_SIGMA_MULTIPLIER * Math.sqrt(0.5333333333 - 0.49)) /
      Math.sqrt(DEFAULT_MONTE_CARLO_SHOTS);
    expect(isWithinTolerance(energyFraction, 0.7, fractionTolerance)).toBe(true);
    expect(result.reportValues['channel[electron+electronAntineutrino+muonNeutrino]']).toBe(1);
  });
});
