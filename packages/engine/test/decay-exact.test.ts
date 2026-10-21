/* Deterministic decay checks: catalog conservation, two- and three-body kinematics, forbidden decays, time dilation, parent retirement and motion. */
import {
  NEUTRON_PROTON_MASS_DIFFERENCE_ENERGY_EQUIVALENT_IN_MEV,
  PARTICLE_CATALOG,
  SPEED_OF_LIGHT,
  particleSpec,
} from '@standard-model/constants';
import { PARTICLE_NAMES } from '@standard-model/contracts';
import {
  invariantMassInGev,
  threeBodyEndpointEnergyInGev,
  twoBodyDecayMomentumInGev,
} from '@standard-model/utils';
import type { ParticleName } from '@standard-model/contracts';
import { describe, expect, it } from 'vitest';
import {
  conservationViolations,
  createEngine,
  createEnvironment,
  exclusiveProductNames,
  isExclusiveChannel,
  measuredPartialWidth,
  virtualBosonResolutions,
  type DecayEvent,
} from '../src/index.js';

const SEED = 17;
const SAMPLES = 200;

function totalFourMomentum(event: DecayEvent) {
  return event.products.reduce(
    (sum, product) => {
      const momentum = product.fourMomentumInGev;
      if (momentum === null) {
        throw new Error('exclusive products expected');
      }
      return {
        energy: sum.energy + momentum.energy,
        momentum: {
          x: sum.momentum.x + momentum.momentum.x,
          y: sum.momentum.y + momentum.momentum.y,
          z: sum.momentum.z + momentum.momentum.z,
        },
      };
    },
    { energy: 0, momentum: { x: 0, y: 0, z: 0 } },
  );
}

const SLOW_TEST_TIMEOUT_IN_MILLISECONDS = 60_000;

describe('catalog decay channels', () => {
  it('conserve charge, baryon number and lepton family numbers in every exclusive channel', () => {
    PARTICLE_NAMES.forEach((name) => {
      const spec = particleSpec(name);
      spec.decays.filter(isExclusiveChannel).forEach((channel) => {
        const products = exclusiveProductNames(channel).map((product) => particleSpec(product));
        expect(conservationViolations(spec, products)).toEqual([]);
      });
    });
    expect(conservationViolations(PARTICLE_CATALOG.muon, [PARTICLE_CATALOG.electron])).toContain(
      'muonNumber',
    );
  });
});

describe('two-body decays', () => {
  it('sends W+ at rest into e+ nu back to back with the textbook momentum', () => {
    const engine = createEngine({ seed: SEED });
    const wBoson = engine.particles.create('wPlus');
    const event = engine.decays.decay(wBoson, { channelIndex: 0 });
    expect(event.products.map((product) => product.name)).toEqual(['positron', 'electronNeutrino']);
    const total = totalFourMomentum(event);
    expect(total.energy).toBeCloseTo(wBoson.massInGev, 12);
    expect(Math.hypot(total.momentum.x, total.momentum.y, total.momentum.z)).toBeLessThan(1e-12);
    const positron = event.products[0]?.fourMomentumInGev;
    const expectedMomentum = twoBodyDecayMomentumInGev(
      wBoson.massInGev,
      PARTICLE_CATALOG.positron.massInGev.value,
      0,
    );
    expect(
      Math.hypot(positron?.momentum.x ?? 0, positron?.momentum.y ?? 0, positron?.momentum.z ?? 0),
    ).toBeCloseTo(expectedMomentum, 12);
    expect(invariantMassInGev(total)).toBeCloseTo(wBoson.massInGev, 12);
    expect(event.products[0]?.particle?.spec.name).toBe('positron');
    expect(event.products[0]?.particle?.kinematics.fourMomentumInGev.momentum).toEqual(
      positron?.momentum,
    );
  });

  it('conserves four-momentum for a W in flight and keeps the invariant mass', () => {
    const engine = createEngine({ seed: SEED });
    const wBoson = engine.particles.create('wPlus', { momentumInGev: { x: 0, y: 0, z: 50 } });
    const parent = wBoson.kinematics.fourMomentumInGev;
    const event = engine.decays.decay(wBoson, { channelIndex: 1 });
    const total = totalFourMomentum(event);
    expect(total.energy).toBeCloseTo(parent.energy, 9);
    expect(total.momentum.z).toBeCloseTo(50, 9);
    expect(invariantMassInGev(total)).toBeCloseTo(wBoson.massInGev, 9);
  });

  it('decays the top into W+ and b, and resolves the invisible Z into a neutrino pair from the Z ν̄ ν vertex', () => {
    const engine = createEngine({ seed: SEED });
    const top = engine.particles.create('top');
    const event = engine.decays.decay(top);
    expect(event.products.map((product) => product.name)).toEqual(['wPlus', 'bottom']);
    expect(event.products.every((product) => product.particle !== null)).toBe(true);
    const zBoson = engine.particles.create('zBoson');
    const invisibleIndex = zBoson.spec.decays.findIndex((channel) =>
      channel.products.includes('invisible'),
    );
    const invisible = engine.decays.decay(zBoson, { channelIndex: invisibleIndex });
    expect(invisible.products).toHaveLength(2);
    expect(
      invisible.products.every(
        (product) => particleSpec(product.name as ParticleName).family === 'neutrino',
      ),
    ).toBe(true);
    expect(invisible.products.every((product) => product.particle !== null)).toBe(true);
  });
});

describe('three-body decays', () => {
  it('keeps the muon decay inside the Michel endpoint and conserves four-momentum', () => {
    const engine = createEngine({ seed: SEED });
    const endpoint = threeBodyEndpointEnergyInGev(
      PARTICLE_CATALOG.muon.massInGev.value,
      PARTICLE_CATALOG.electron.massInGev.value,
    );
    for (let sample = 0; sample < SAMPLES; sample += 1) {
      const muon = engine.particles.create('muon');
      const event = engine.decays.decay(muon);
      const total = totalFourMomentum(event);
      expect(total.energy).toBeCloseTo(muon.massInGev, 12);
      expect(Math.hypot(total.momentum.x, total.momentum.y, total.momentum.z)).toBeLessThan(1e-12);
      expect(event.products[0]?.fourMomentumInGev?.energy ?? Infinity).toBeLessThanOrEqual(
        endpoint + 1e-12,
      );
    }
  });

  it('keeps the neutron beta-decay electron below the Q value from CODATA', () => {
    const engine = createEngine({ seed: SEED });
    const electronMass = PARTICLE_CATALOG.electron.massInGev.value;
    const maximumKineticEnergyInGev =
      NEUTRON_PROTON_MASS_DIFFERENCE_ENERGY_EQUIVALENT_IN_MEV.value * 1e-3 - electronMass;
    expect(maximumKineticEnergyInGev * 1e3).toBeCloseTo(0.7823, 3);
    for (let sample = 0; sample < SAMPLES; sample += 1) {
      const neutron = engine.particles.create('neutron');
      const event = engine.decays.decay(neutron);
      expect(event.products.map((product) => product.name)).toEqual([
        'proton',
        'electron',
        'electronAntineutrino',
      ]);
      const electronEnergy = event.products[1]?.fourMomentumInGev?.energy ?? Infinity;
      expect(electronEnergy - electronMass).toBeLessThanOrEqual(maximumKineticEnergyInGev + 1e-12);
    }
  });
});

describe('decay rules', () => {
  it('refuses stable, confined and already decayed particles', () => {
    const engine = createEngine({ seed: SEED });
    expect(() => engine.decays.decay(engine.particles.create('electron'))).toThrow(/stable/);
    expect(() => engine.decays.decay(engine.particles.create('up'))).toThrow(/confined/);
    expect(() => engine.decays.decay(engine.particles.create('photon'))).toThrow(/stable/);
    const muon = engine.particles.create('muon');
    engine.decays.decay(muon);
    expect(muon.status).toBe('decayed');
    expect(() => engine.decays.decay(muon)).toThrow(/already decayed/);
  });

  it('releases the quantum register of the parent and refuses entangled parents', () => {
    const engine = createEngine({ seed: SEED });
    const muon = engine.particles.create('muon');
    engine.quantum.prepare(muon, 'spin', 'up');
    engine.decays.decay(muon);
    expect(muon.quantumSlot('spin')).toBeNull();
    expect(engine.quantum.registers.size).toBe(0);
    const muonA = engine.particles.create('muon');
    const muonB = engine.particles.create('muon');
    engine.quantum.entangle([muonA, muonB], 'spin', 'spinSinglet');
    expect(() => engine.decays.decay(muonA)).toThrow(/entangled/);
  });

  it('renormalizes exclusive-only channel probabilities', () => {
    const engine = createEngine({ seed: SEED });
    const zBoson = engine.particles.create('zBoson');
    const exclusive = engine.decays.channelProbabilities(zBoson, { exclusiveOnly: true });
    expect(exclusive).toHaveLength(3);
    expect(exclusive.reduce((sum, entry) => sum + entry.probability, 0)).toBeCloseTo(1, 12);
    const all = engine.decays.channelProbabilities(zBoson);
    expect(all).toHaveLength(5);
    expect(all[0]?.probability).toBeCloseTo(0.033632 / 1.0001, 6);
  });
});

describe('decay in flight', () => {
  it('dilates the decay time by gamma, moves the parent and records the decay length', () => {
    const engine = createEngine({ seed: SEED });
    const muon = engine.particles.create('muon');
    const gammaBeta = Math.sqrt(3);
    muon.setMomentum({ x: 0, y: 0, z: gammaBeta * muon.massInGev });
    const event = engine.decays.decayAfterSampledTime(muon, createEnvironment());
    const properTime = event.properTimeInSeconds ?? 0;
    const labTime = event.labTimeInSeconds ?? 0;
    expect(labTime / properTime).toBeCloseTo(2, 9);
    const expectedLength = (gammaBeta / 2) * SPEED_OF_LIGHT.value * labTime;
    expect(event.decayLengthInMeters ?? 0).toBeCloseTo(expectedLength, 6);
    expect(event.vertexInFemtometers.z).toBeCloseTo(expectedLength * 1e15, 0);
    expect(
      event.products.every(
        (product) =>
          product.particle?.kinematics.positionInFemtometers.z === event.vertexInFemtometers.z,
      ),
    ).toBe(true);
    expect(muon.kinematics.properTimeInSeconds).toBeCloseTo(properTime, 15);
  });

  it('moves a 1 GeV photon by c t during evolution', () => {
    const engine = createEngine({ seed: SEED });
    const photon = engine.particles.create('photon', { momentumInGev: { x: 0, y: 0, z: 1 } });
    engine.dynamics.evolve(photon, createEnvironment(), 1e-15);
    expect(photon.kinematics.positionInFemtometers.z).toBeCloseTo(SPEED_OF_LIGHT.value, 3);
  });
});

describe('decays below a two-boson threshold', () => {
  it(
    'turns Higgs to W W into one real W and a fermion pair from the virtual W',
    () => {
      const engine = createEngine({ seed: 9 });
      for (let sample = 0; sample < SAMPLES; sample += 1) {
        const higgs = engine.particles.create('higgsBoson');
        const channelIndex = higgs.spec.decays.findIndex((channel) =>
          channel.products.includes('wPlus'),
        );
        const event = engine.decays.decay(higgs, { channelIndex });
        const names = event.products.map((product) => product.name as ParticleName);
        expect(names).toHaveLength(3);
        expect(names.filter((name) => name === 'wPlus' || name === 'wMinus')).toHaveLength(1);
        expect(event.products.every((product) => product.particle !== null)).toBe(true);
        expect(
          conservationViolations(
            higgs.spec,
            names.map((name) => particleSpec(name)),
          ),
        ).toEqual([]);
        expect(totalFourMomentum(event).energy).toBeCloseTo(
          PARTICLE_CATALOG.higgsBoson.massInGev.value,
          9,
        );
      }
    },
    SLOW_TEST_TIMEOUT_IN_MILLISECONDS,
  );

  it('gives tree widths of H → W W* and H → Z Z* inside the PDG uncertainty', () => {
    (
      [
        ['wPlus', 'wMinus'],
        ['zBoson', 'zBoson'],
      ] as const
    ).forEach((pair) => {
      const tree = virtualBosonResolutions('higgsBoson', pair).reduce(
        (sum, option) => sum + option.widthInGev,
        0,
      );
      const measured = measuredPartialWidth('higgsBoson', pair);
      expect(Math.abs(tree - (measured?.value ?? 0))).toBeLessThan(measured?.uncertainty ?? 0);
    });
  });
});
