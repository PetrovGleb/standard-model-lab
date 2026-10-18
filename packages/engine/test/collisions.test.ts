/* Checks collision physics against textbook values: QED μμ cross section, the Z peak, R ratio, A_FB below the Z, Klein–Nishina, Breit–Wheeler threshold and annihilation photons. */
import { PARTICLE_CATALOG } from '@standard-model/constants';
import { describe, expect, it } from 'vitest';
import {
  ANNIHILATION_FERMION_CHANNELS,
  annihilationToFermions,
  createEngine,
  experiment,
  kleinNishina,
  pairProductionFromPhotons,
  runExperiment,
  runningAlpha,
  toNanobarns,
} from '../src/index.js';

const MUON_CHANNEL = ANNIHILATION_FERMION_CHANNELS.find(
  (channel) => channel.products[0] === 'muon',
);
const ELECTRON_MASS = PARTICLE_CATALOG.electron.massInGev.value;
const Z_MASS = PARTICLE_CATALOG.zBoson.massInGev.value;

function channel(name: string) {
  const found = ANNIHILATION_FERMION_CHANNELS.find((candidate) => candidate.products[0] === name);
  if (found === undefined) {
    throw new Error(`no channel ${name}`);
  }
  return found;
}

describe('cross sections', () => {
  it('runs α from 1/137 to about 1/129 at the Z', () => {
    expect(1 / runningAlpha(1e-8)).toBeCloseTo(137.036, 2);
    expect(1 / runningAlpha(Z_MASS * Z_MASS)).toBeGreaterThan(128);
    expect(1 / runningAlpha(Z_MASS * Z_MASS)).toBeLessThan(130);
  });

  it('gives the QED point cross section 86.8 nb/s for μμ well below the Z', () => {
    if (MUON_CHANNEL === undefined) {
      throw new Error('muon channel expected');
    }
    const energy = 5;
    const qed = (4 * Math.PI * runningAlpha(energy * energy) ** 2) / (3 * energy * energy);
    const ratio = annihilationToFermions(MUON_CHANNEL, energy) / qed;
    expect(ratio).toBeGreaterThan(0.99);
    expect(ratio).toBeLessThan(1.01);
  });

  it('peaks at about 2 nb for μμ on the Z and gives R ≈ 3.8 at 10.5 GeV', () => {
    expect(toNanobarns(annihilationToFermions(channel('muon'), Z_MASS))).toBeCloseTo(2.0, 0);
    const energy = 10.5;
    const hadrons = ['up', 'down', 'strange', 'charm'].reduce(
      (sum, name) => sum + annihilationToFermions(channel(name), energy),
      0,
    );
    const ratio = hadrons / annihilationToFermions(channel('muon'), energy);
    expect(ratio).toBeGreaterThan(3.4);
    expect(ratio).toBeLessThan(3.8);
  });

  it('reduces Klein–Nishina to Thomson at low energy and to 0.43 σT at 511 keV', () => {
    const thomson = (8 * Math.PI) / 3;
    const radiusSquared = (1 / 137.035999 / ELECTRON_MASS) ** 2;
    expect(kleinNishina(1e-9, ELECTRON_MASS) / (thomson * radiusSquared)).toBeCloseTo(1, 3);
    expect(kleinNishina(ELECTRON_MASS, ELECTRON_MASS) / (thomson * radiusSquared)).toBeCloseTo(
      0.431,
      2,
    );
  });

  it('closes Breit–Wheeler below threshold', () => {
    expect(pairProductionFromPhotons(1.9 * ELECTRON_MASS, ELECTRON_MASS)).toBe(0);
    expect(pairProductionFromPhotons(3 * ELECTRON_MASS, ELECTRON_MASS)).toBeGreaterThan(0);
  });
});

describe('collisions in plans', () => {
  it('annihilates at rest into back-to-back 511 keV photons with opposite polarizations', () => {
    const engine = createEngine({ seed: 3 });
    const event = engine.collisions.collide(
      engine.particles.create('electron'),
      engine.particles.create('positron'),
    );
    const [left, right] = event.products;
    expect(event.products.map((product) => product.name)).toEqual(['photon', 'photon']);
    expect(left?.fourMomentumInGev.energy).toBeCloseTo(ELECTRON_MASS, 12);
    expect(
      (left?.fourMomentumInGev.momentum.z ?? 0) + (right?.fourMomentumInGev.momentum.z ?? 0),
    ).toBeCloseTo(0, 12);
    const plan = experiment('annihilation')
      .create('e', 'electron')
      .create('p', 'positron')
      .collide(['e', 'p'], 'hit')
      .measure('hit.0', 'polarization', 'first')
      .measure('hit.1', 'polarization', 'second')
      .report('probabilitySameSign', ['first', 'second'], 'same')
      .build();
    expect(runExperiment(plan, { shots: 300, seed: 4 }).reportValues.same).toBe(0);
  });

  it('shows the −6% forward-backward asymmetry of μμ at 29 GeV', () => {
    const plan = experiment('afb')
      .create('e', 'electron', { momentumInGev: { x: 0, y: 0, z: 14.5 } })
      .create('p', 'positron', { momentumInGev: { x: 0, y: 0, z: -14.5 } })
      .collide(['e', 'p'], 'hit', 'muon+antiMuon')
      .report('mean', ['hit.cosThetaStar'], 'cos')
      .build();
    const asymmetry =
      1.5 *
      (runExperiment(plan, { shots: 20000, seed: 6, includeSystemReport: false }).reportValues
        .cos ?? 0);
    expect(asymmetry).toBeGreaterThan(-0.09);
    expect(asymmetry).toBeLessThan(-0.035);
  });

  it('refuses unsupported pairs before running and closed channels at run time', () => {
    const plan = experiment('bad')
      .create('a', 'pionPlus')
      .create('b', 'electron')
      .collide(['a', 'b'], 'hit')
      .build();
    expect(() => runExperiment(plan, { shots: 1 })).toThrow(
      /no collision process for pionPlus \+ electron/,
    );
    const closed = experiment('closed')
      .create('e', 'electron')
      .create('p', 'positron')
      .collide(['e', 'p'], 'hit', 'muon+antiMuon')
      .build();
    expect(() => runExperiment(closed, { shots: 1 })).toThrow(/закрыт/);
  });
});
