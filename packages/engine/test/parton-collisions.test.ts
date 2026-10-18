/* Checks hadron collisions: NNPDF grid nodes reproduced exactly and the momentum and valence sum rules, flavour mapping for the neutron and antiproton, and proton–proton events that conserve charge and baryon number exactly and energy up to the field energy of collapsed light strings. */
import { PARTICLE_CATALOG, PROTON_PARTON_DISTRIBUTIONS } from '@standard-model/constants';
import { describe, expect, it } from 'vitest';
import {
  experiment,
  PARTON_FLAVORS,
  partonMomentumDensity,
  partonStructureOf,
  runExperiment,
  strongCouplingOfPdf,
} from '../src/index.js';

const SEED = 20261016;
const EXACT_DIGITS = 12;
const SUM_RULE_TOLERANCE = 0.01;
const INTEGRATION_POINTS = 4000;
const SCALE_IN_GEV = 100;
const MINIMUM_LOG_X = Math.log(1e-9);
const BEAM_MOMENTUM_IN_GEV = 6800;
const EVENT_SHOTS = 30;
const FIELD_ENERGY_TOLERANCE = 1e-6;

describe('parton distributions', () => {
  const proton = partonStructureOf(PARTICLE_CATALOG.proton);
  if (proton === null) {
    throw new Error('the proton must have a parton structure');
  }

  it('reproduces the grid at its nodes and alpha_s at M_Z', () => {
    const grid = PROTON_PARTON_DISTRIBUTIONS;
    const column = grid.flavors.indexOf(2);
    const xIndex = 60;
    const qIndex = 20;
    const stored =
      grid.values[(xIndex * grid.qsInGev.length + qIndex) * grid.flavors.length + column];
    expect(
      partonMomentumDensity(proton, 'up', grid.xs[xIndex] ?? 0, grid.qsInGev[qIndex] ?? 0),
    ).toBeCloseTo(stored ?? 0, EXACT_DIGITS);
    expect(strongCouplingOfPdf(grid.alphaS.zMassInGev)).toBeCloseTo(grid.alphaS.valueAtZMass, 6);
  });

  it('satisfies the momentum and valence sum rules', () => {
    let momentum = 0;
    let upValence = 0;
    let downValence = 0;
    const step = -MINIMUM_LOG_X / INTEGRATION_POINTS;
    for (let index = 0; index < INTEGRATION_POINTS; index += 1) {
      const fraction = Math.exp(MINIMUM_LOG_X + (index + 0.5) * step);
      PARTON_FLAVORS.forEach((parton) => {
        momentum += partonMomentumDensity(proton, parton, fraction, SCALE_IN_GEV) * fraction * step;
      });
      upValence +=
        (partonMomentumDensity(proton, 'up', fraction, SCALE_IN_GEV) -
          partonMomentumDensity(proton, 'antiUp', fraction, SCALE_IN_GEV)) *
        step;
      downValence +=
        (partonMomentumDensity(proton, 'down', fraction, SCALE_IN_GEV) -
          partonMomentumDensity(proton, 'antiDown', fraction, SCALE_IN_GEV)) *
        step;
    }
    expect(Math.abs(momentum - 1)).toBeLessThan(SUM_RULE_TOLERANCE);
    expect(Math.abs(upValence - 2)).toBeLessThan(2 * SUM_RULE_TOLERANCE);
    expect(Math.abs(downValence - 1)).toBeLessThan(SUM_RULE_TOLERANCE);
  });

  it('maps the neutron by isospin and the antiproton by charge conjugation', () => {
    const neutron = partonStructureOf(PARTICLE_CATALOG.neutron);
    const antiproton = partonStructureOf(PARTICLE_CATALOG.antiProton);
    if (neutron === null || antiproton === null) {
      throw new Error('nucleons must have a parton structure');
    }
    expect(partonMomentumDensity(neutron, 'up', 0.1, 10)).toBeCloseTo(
      partonMomentumDensity(proton, 'down', 0.1, 10),
      EXACT_DIGITS,
    );
    expect(partonMomentumDensity(antiproton, 'antiUp', 0.1, 10)).toBeCloseTo(
      partonMomentumDensity(proton, 'up', 0.1, 10),
      EXACT_DIGITS,
    );
    expect(partonStructureOf(PARTICLE_CATALOG.lambdaBaryon)).toBeNull();
  });
});

describe('proton–proton collisions', () => {
  it('conserve charge, baryon number and four-momentum through the hard process, remnants and hadronization', () => {
    const plan = experiment('lhc')
      .create('first', 'proton', { momentumInGev: { x: 0, y: 0, z: BEAM_MOMENTUM_IN_GEV } })
      .create('second', 'proton', { momentumInGev: { x: 0, y: 0, z: -BEAM_MOMENTUM_IN_GEV } })
      .collide(['first', 'second'], 'collision', undefined, 50)
      .evolve(1e-9)
      .measureSystem('detector')
      .report('mean', ['detector.chargedCount'], 'charged')
      .build();
    const result = runExperiment(plan, { shots: EVENT_SHOTS, seed: SEED });
    const totals = result.systemReport?.frames.at(-1)?.totals;
    const energy = 2 * Math.hypot(BEAM_MOMENTUM_IN_GEV, PARTICLE_CATALOG.proton.massInGev.value);
    expect(totals?.chargeInElementaryUnits).toBeCloseTo(2, 9);
    expect(totals?.baryonNumber).toBeCloseTo(2, 9);
    expect(Math.abs((totals?.energyInGev ?? 0) - energy) / energy).toBeLessThan(
      FIELD_ENERGY_TOLERANCE,
    );
    expect(result.reportValues['charged'] ?? 0).toBeGreaterThan(10);
  }, 120_000);
});
