/* Checks the Lagrangian pipeline: Dirac algebra identities, masses and charges recovered from the Lagrangian, tree amplitudes against textbook QED, electroweak and QCD formulas, and widths against PDG within the size of missing loop corrections. */
import { FERMI_COUPLING_CONSTANT, PDG_2026, particleSpec } from '@standard-model/constants';
import { textIn, type ParticleName } from '@standard-model/contracts';
import { describe, expect, it } from 'vitest';
import {
  annihilationToPhotons,
  antiparticleSpinor,
  barred,
  DIRAC_FERMIONS,
  deriveLagrangian,
  GAMMA,
  IDENTITY,
  kleinNishina,
  measuredPartialWidth,
  multiplyDirac,
  NANOBARN_PER_INVERSE_GEV_SQUARED,
  pairProductionFromPhotons,
  particleSpinor,
  ProcessCalculator,
  ProcessError,
  ProcessKinematics,
  realFourVector,
  slash,
  standardModelParameters,
  summedSquaredAmplitude,
  type FourMomentum,
  type ProcessLeg,
} from '../src/index.js';

const calculator = new ProcessCalculator();
const fermiModel = calculator.model('fermiConstant');
const fermi = new ProcessKinematics(fermiModel);
const parameters = fermiModel.parameters;
const METRIC = [1, -1, -1, -1];

function maximumDifference(first: Float64Array, second: Float64Array): number {
  return first.reduce(
    (maximum, value, index) => Math.max(maximum, Math.abs(value - (second[index] ?? 0))),
    0,
  );
}

function outer(column: Float64Array, row: Float64Array): Float64Array {
  const result = new Float64Array(32);
  for (let rowIndex = 0; rowIndex < 4; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < 4; columnIndex += 1) {
      const leftReal = column[2 * rowIndex] ?? 0;
      const leftImaginary = column[2 * rowIndex + 1] ?? 0;
      const rightReal = row[2 * columnIndex] ?? 0;
      const rightImaginary = row[2 * columnIndex + 1] ?? 0;
      result[2 * (4 * rowIndex + columnIndex)] =
        leftReal * rightReal - leftImaginary * rightImaginary;
      result[2 * (4 * rowIndex + columnIndex) + 1] =
        leftReal * rightImaginary + leftImaginary * rightReal;
    }
  }
  return result;
}

function combine(first: Float64Array, second: Float64Array, sign: number): Float64Array {
  return first.map((value, index) => value + sign * (second[index] ?? 0));
}

describe('Dirac algebra', () => {
  it('satisfies the Clifford algebra {γ^μ, γ^ν} = 2 g^{μν}', () => {
    GAMMA.forEach((first, row) =>
      GAMMA.forEach((second, column) => {
        const anticommutator = combine(
          multiplyDirac(first, second),
          multiplyDirac(second, first),
          1,
        );
        const expected = IDENTITY.map((value) =>
          row === column ? 2 * (METRIC[row] ?? 0) * value : 0,
        );
        expect(maximumDifference(anticommutator, expected)).toBeLessThan(1e-14);
      }),
    );
  });

  it('builds spinors whose helicity sums are p̸ ± m', () => {
    const mass = 0.7;
    const momentum: FourMomentum = [
      Math.sqrt(mass ** 2 + 0.3 ** 2 + 0.4 ** 2 + 1.2 ** 2),
      0.3,
      -0.4,
      1.2,
    ];
    const slashed = slash(realFourVector(momentum));
    const massTerm = IDENTITY.map((value) => value * mass);
    const particles = [1, -1].reduce<Float64Array>(
      (total, helicity) =>
        combine(
          total,
          outer(
            particleSpinor(momentum, mass, helicity),
            barred(particleSpinor(momentum, mass, helicity)),
          ),
          1,
        ),
      new Float64Array(32),
    );
    const antiparticles = [1, -1].reduce<Float64Array>(
      (total, helicity) =>
        combine(
          total,
          outer(
            antiparticleSpinor(momentum, mass, helicity),
            barred(antiparticleSpinor(momentum, mass, helicity)),
          ),
          1,
        ),
      new Float64Array(32),
    );
    expect(maximumDifference(particles, combine(slashed, massTerm, 1))).toBeLessThan(1e-12);
    expect(maximumDifference(antiparticles, combine(slashed, massTerm, -1))).toBeLessThan(1e-12);
  });
});

describe('Standard Model Lagrangian', () => {
  const derived = deriveLagrangian(parameters);

  it('gives W and Z their masses from |DΦ|² and keeps the photon massless', () => {
    expect(derived.masses.wMassInGev).toBeCloseTo(parameters.wMassInGev, 10);
    expect(derived.masses.zMassInGev).toBeCloseTo(parameters.zMassInGev, 10);
    expect(derived.masses.photonMassInGev).toBe(0);
    expect(derived.masses.higgsMassInGev).toBeCloseTo(parameters.higgsMassInGev, 10);
    expect(derived.masses.higgsTadpole).toBeCloseTo(0, 10);
  });

  it('couples the photon to every fermion with the charge Q = T₃ + Y/2 of the catalog', () => {
    DIRAC_FERMIONS.forEach((fermion) => {
      const vertex = derived.vertices.find(
        (candidate) =>
          candidate.structure === 'fermionFermionVector' &&
          candidate.legs[1]?.particle === fermion &&
          candidate.legs[1]?.color === 0 &&
          candidate.legs[2]?.particle === 'photon',
      );
      const charge = particleSpec(fermion).electricChargeInElementaryUnits;
      expect(vertex?.factors[0]?.imaginary ?? 0).toBeCloseTo(
        parameters.electricCharge * charge,
        12,
      );
    });
  });

  it('builds a unitary CKM matrix close to the PDG magnitudes', () => {
    const ckm = parameters.ckm;
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        const product = [0, 1, 2].reduce((total, inner) => {
          const first = ckm[row]?.[inner] ?? { real: 0, imaginary: 0 };
          const second = ckm[column]?.[inner] ?? { real: 0, imaginary: 0 };
          return total + first.real * second.real + first.imaginary * second.imaginary;
        }, 0);
        expect(product).toBeCloseTo(row === column ? 1 : 0, 12);
      }
    }
    expect(Math.hypot(ckm[0]?.[2]?.real ?? 0, ckm[0]?.[2]?.imaginary ?? 0)).toBeCloseTo(
      PDG_2026.ckmMagnitudes.upBottom.value,
      4,
    );
  });
});

describe('tree amplitudes against textbook formulas', () => {
  it('reproduces QED μ-pair production and the Z peak', () => {
    const qedEnergy = 3;
    const qed = calculator.model('runningAlpha', qedEnergy);
    const fineStructure = qed.parameters.electricCharge ** 2 / (4 * Math.PI);
    const mass = qed.massOf('muon');
    const velocity = Math.sqrt(1 - (4 * mass * mass) / qedEnergy ** 2);
    const expected =
      ((4 * Math.PI * fineStructure ** 2) / (3 * qedEnergy ** 2)) *
      ((velocity * (3 - velocity ** 2)) / 2) *
      NANOBARN_PER_INVERSE_GEV_SQUARED;
    const measured = new ProcessKinematics(qed).crossSection(
      ['electron', 'positron'],
      ['muon', 'antiMuon'],
      qedEnergy,
    );
    expect(measured.crossSectionInNanobarns / expected).toBeCloseTo(1, 3);

    const peak = parameters.zMassInGev;
    const width = parameters.widthsInGev.zBoson ?? 0;
    const electronWidth = fermi.twoBodyWidth('zBoson', ['electron', 'positron']);
    const muonWidth = fermi.twoBodyWidth('zBoson', ['muon', 'antiMuon']);
    const alphaFermi = parameters.electricCharge ** 2 / (4 * Math.PI);
    const resonance =
      ((12 * Math.PI * electronWidth * muonWidth) / (peak ** 2 * width ** 2) +
        (4 * Math.PI * alphaFermi ** 2) / (3 * peak ** 2)) *
      NANOBARN_PER_INVERSE_GEV_SQUARED;
    const atPeak = fermi.crossSection(['electron', 'positron'], ['muon', 'antiMuon'], peak);
    expect(atPeak.crossSectionInNanobarns / resonance).toBeCloseTo(1, 3);
  });

  it('reproduces Bhabha and Møller scattering, s- and t-channels with their relative sign', () => {
    const energy = 1;
    const model = calculator.model('runningAlpha', energy);
    const fineStructure = model.parameters.electricCharge ** 2 / (4 * Math.PI);
    const kinematics = new ProcessKinematics(model);
    const toDifferential = 2 * Math.PI * NANOBARN_PER_INVERSE_GEV_SQUARED;
    const bhabha = kinematics.crossSection(
      ['electron', 'positron'],
      ['electron', 'positron'],
      energy,
      0.9,
      7,
    );
    bhabha.cosine.forEach((cosine, index) => {
      const sineHalfSquared = (1 - cosine) / 2;
      const cosineHalfSquared = (1 + cosine) / 2;
      const expected =
        (fineStructure ** 2 / (2 * energy ** 2)) *
        ((1 + cosineHalfSquared ** 2) / sineHalfSquared ** 2 -
          (2 * cosineHalfSquared ** 2) / sineHalfSquared +
          (1 + cosine ** 2) / 2) *
        toDifferential;
      expect((bhabha.differentialInNanobarns[index] ?? 0) / expected).toBeCloseTo(1, 3);
    });
    const moller = kinematics.crossSection(
      ['electron', 'electron'],
      ['electron', 'electron'],
      energy,
      0.9,
      7,
    );
    moller.cosine.forEach((cosine, index) => {
      const square = energy ** 2;
      const momentumTransfer = (-square * (1 - cosine)) / 2;
      const crossed = (-square * (1 + cosine)) / 2;
      const expected =
        (fineStructure ** 2 / (4 * square)) *
        ((square ** 2 + crossed ** 2) / momentumTransfer ** 2 +
          (square ** 2 + momentumTransfer ** 2) / crossed ** 2 +
          (2 * square ** 2) / (momentumTransfer * crossed)) *
        toDifferential;
      expect((moller.differentialInNanobarns[index] ?? 0) / expected).toBeCloseTo(1, 3);
    });
  });

  it('reproduces Klein–Nishina, Breit–Wheeler and two-photon annihilation at α(0)', () => {
    const model = calculator.model('runningAlpha', 0);
    const kinematics = new ProcessKinematics(model);
    const electronMass = model.massOf('electron');
    const photonEnergy = 0.001;
    const comptonEnergy = Math.sqrt(electronMass ** 2 + 2 * electronMass * photonEnergy);
    const compton = kinematics.crossSection(
      ['photon', 'electron'],
      ['photon', 'electron'],
      comptonEnergy,
    );
    expect(
      compton.crossSectionInNanobarns /
        (kleinNishina(photonEnergy, electronMass) * NANOBARN_PER_INVERSE_GEV_SQUARED),
    ).toBeCloseTo(1, 4);
    const pairEnergy = 0.003;
    const breitWheeler = kinematics.crossSection(
      ['photon', 'photon'],
      ['electron', 'positron'],
      pairEnergy,
    );
    expect(
      breitWheeler.crossSectionInNanobarns /
        (pairProductionFromPhotons(pairEnergy, electronMass) * NANOBARN_PER_INVERSE_GEV_SQUARED),
    ).toBeCloseTo(1, 4);
    const annihilation = kinematics.crossSection(
      ['electron', 'positron'],
      ['photon', 'photon'],
      pairEnergy,
    );
    expect(
      annihilation.crossSectionInNanobarns /
        (annihilationToPhotons(pairEnergy) * NANOBARN_PER_INVERSE_GEV_SQUARED),
    ).toBeCloseTo(1, 4);
  });

  it('does not depend on the order of the external legs, so fermion signs are consistent', () => {
    const model = calculator.model('runningAlpha', 0);
    const kinematics = new ProcessKinematics(model);
    const energy = Math.sqrt(
      model.massOf('electron') ** 2 + 2 * model.massOf('electron') * 0.00117,
    );
    const ordered = kinematics.crossSection(['photon', 'electron'], ['photon', 'electron'], energy);
    const swapped = kinematics.crossSection(['electron', 'photon'], ['electron', 'photon'], energy);
    const crossed = kinematics.crossSection(['photon', 'electron'], ['electron', 'photon'], energy);
    expect(swapped.crossSectionInNanobarns / ordered.crossSectionInNanobarns).toBeCloseTo(1, 8);
    expect(crossed.crossSectionInNanobarns / ordered.crossSectionInNanobarns).toBeCloseTo(1, 8);
    const bhabha = new ProcessKinematics(calculator.model('runningAlpha', 10));
    const forward = bhabha.crossSection(
      ['electron', 'positron'],
      ['electron', 'positron'],
      10,
      0.9,
    );
    const reordered = bhabha.crossSection(
      ['positron', 'electron'],
      ['positron', 'electron'],
      10,
      0.9,
    );
    expect(reordered.crossSectionInNanobarns / forward.crossSectionInNanobarns).toBeCloseTo(1, 6);
  });

  it('reproduces qq̄ → gg and gg → gg with colour sums and gluon self-couplings', () => {
    const model = calculator.model('runningAlpha', 100);
    const kinematics = new ProcessKinematics(model);
    const coupling = model.parameters.strongCoupling ** 4;
    const energy = 100;
    const square = energy ** 2;
    const legs = (first: ParticleName, second: ParticleName): ProcessLeg[] => [
      { particle: first, incoming: true },
      { particle: second, incoming: true },
      { particle: 'gluon', incoming: false },
      { particle: 'gluon', incoming: false },
    ];
    [-0.4, 0.3].forEach((cosine) => {
      const momenta = kinematics.centerOfMassMomenta([0, 0, 0, 0], energy, cosine);
      const transfer = (-square * (1 - cosine)) / 2;
      const crossed = (-square * (1 + cosine)) / 2;
      const quarks = summedSquaredAmplitude(model, legs('up', 'antiUp'), momenta) / 36;
      const quarksExpected =
        coupling *
        ((32 / 27) * ((transfer ** 2 + crossed ** 2) / (transfer * crossed)) -
          (8 / 3) * ((transfer ** 2 + crossed ** 2) / square ** 2));
      expect(quarks / quarksExpected).toBeCloseTo(1, 4);
      const gluons = summedSquaredAmplitude(model, legs('gluon', 'gluon'), momenta) / 256;
      const gluonsExpected =
        (9 / 2) *
        coupling *
        (3 -
          (transfer * crossed) / square ** 2 -
          (square * crossed) / transfer ** 2 -
          (square * transfer) / crossed ** 2);
      expect(gluons / gluonsExpected).toBeCloseTo(1, 4);
    });
  });

  it('keeps e⁺e⁻ → W⁺W⁻ unitary through the gauge cancellation of γ, Z and ν exchange', () => {
    const crossSectionAt = (energy: number): number =>
      new ProcessKinematics(calculator.model('runningAlpha', energy)).crossSection(
        ['electron', 'positron'],
        ['wPlus', 'wMinus'],
        energy,
      ).crossSectionInNanobarns * 1000;
    const lep = crossSectionAt(200);
    expect(lep).toBeGreaterThan(17);
    expect(lep).toBeLessThan(21);
    expect(crossSectionAt(500)).toBeLessThan(lep);
    expect(crossSectionAt(1000)).toBeLessThan(crossSectionAt(500));
  });
});

describe('decay widths', () => {
  const fermiConstant = FERMI_COUPLING_CONSTANT.value;

  it('matches the analytic tree widths of W, Z, top, Higgs and the muon', () => {
    const wMass = parameters.wMassInGev;
    expect(fermi.twoBodyWidth('wPlus', ['positron', 'electronNeutrino'])).toBeCloseTo(
      (fermiConstant * wMass ** 3) / (6 * Math.SQRT2 * Math.PI),
      9,
    );
    const zMass = parameters.zMassInGev;
    const neutrinoWidth = (fermiConstant * zMass ** 3) / (12 * Math.SQRT2 * Math.PI);
    expect(
      fermi.twoBodyWidth('zBoson', ['electronNeutrino', 'electronAntineutrino']) / neutrinoWidth,
    ).toBeCloseTo(1, 9);
    const topMass = fermiModel.massOf('top');
    const ratio = (wMass / topMass) ** 2;
    const topBottom = parameters.ckm[2]?.[2]?.real ?? 1;
    const topWidth =
      ((fermiConstant * topMass ** 3) / (8 * Math.SQRT2 * Math.PI)) *
      topBottom ** 2 *
      (1 - ratio) ** 2 *
      (1 + 2 * ratio);
    expect(fermi.twoBodyWidth('top', ['bottom', 'wPlus']) / topWidth).toBeCloseTo(1, 2);
    const higgsMass = parameters.higgsMassInGev;
    const bottomMass = fermiModel.massOf('bottom');
    const velocity = Math.sqrt(1 - (4 * bottomMass ** 2) / higgsMass ** 2);
    const higgsWidth =
      ((3 * fermiConstant * higgsMass * bottomMass ** 2) / (4 * Math.SQRT2 * Math.PI)) *
      velocity ** 3;
    expect(fermi.twoBodyWidth('higgsBoson', ['bottom', 'antiBottom']) / higgsWidth).toBeCloseTo(
      1,
      9,
    );
    const muonMass = fermiModel.massOf('muon');
    const muonWidth = (fermiConstant ** 2 * muonMass ** 5) / (192 * Math.PI ** 3);
    expect(
      Math.abs(
        fermi.threeBodyWidth('muon', ['electron', 'electronAntineutrino', 'muonNeutrino']) /
          muonWidth -
          1,
      ),
    ).toBeLessThan(3e-4);
  });

  it('agrees with PDG within the size of the missing radiative corrections', () => {
    const compare = (parent: ParticleName, products: ParticleName[], tolerance: number): void => {
      const reference = measuredPartialWidth(parent, products);
      const computed =
        products.length === 2
          ? fermi.twoBodyWidth(parent, products as [ParticleName, ParticleName])
          : fermi.threeBodyWidth(parent, products as [ParticleName, ParticleName, ParticleName]);
      expect(Math.abs(computed / (reference?.value ?? 1) - 1)).toBeLessThan(tolerance);
    };
    compare('muon', ['electron', 'electronAntineutrino', 'muonNeutrino'], 0.006);
    compare('wPlus', ['positron', 'electronNeutrino'], 0.03);
    compare('zBoson', ['electron', 'positron'], 0.005);
    compare('tau', ['electron', 'electronAntineutrino', 'tauNeutrino'], 0.03);
  });
});

describe('process calculator', () => {
  it('lists the s-channel diagrams of μ-pair production and both channels of Bhabha scattering', () => {
    const muons = calculator.calculate({
      initial: ['electron', 'positron'],
      final: ['muon', 'antiMuon'],
      centerOfMassEnergyInGev: 10,
    });
    expect(muons.diagrams.map((diagram) => diagram.propagators[0]?.particle).sort()).toEqual([
      'higgsBoson',
      'photon',
      'zBoson',
    ]);
    const bhabha = calculator.calculate({
      initial: ['electron', 'positron'],
      final: ['electron', 'positron'],
      centerOfMassEnergyInGev: 10,
    });
    expect(new Set(bhabha.diagrams.map((diagram) => textIn(diagram.channel, 'ru')))).toEqual(
      new Set(['s-канал', 't-канал']),
    );
    expect(bhabha.notes.map((note) => note.en).join(' ')).toContain('0.99');
  });

  it('refuses processes without diagrams and composite particles', () => {
    expect(() =>
      calculator.calculate({
        initial: ['electron', 'positron'],
        final: ['positron', 'muon'],
        centerOfMassEnergyInGev: 10,
      }),
    ).toThrow(ProcessError);
    expect(() =>
      calculator.calculate({
        initial: ['proton', 'proton'],
        final: ['muon', 'antiMuon'],
        centerOfMassEnergyInGev: 10,
      }),
    ).toThrow(/составная/);
  });

  it('serves the Lagrangian with derived masses equal to the inputs', () => {
    const view = calculator.lagrangian();
    const value = (name: string): number =>
      view.parameters.find((parameter) => parameter.name === name)?.value ?? 0;
    expect(value('wMassFromLagrangian')).toBeCloseTo(value('wMass'), 10);
    expect(view.vertices.length).toBeGreaterThan(20);
    expect(standardModelParameters('fermiConstant').vacuumExpectationValueInGev).toBeCloseTo(
      246.22,
      2,
    );
  });
});
