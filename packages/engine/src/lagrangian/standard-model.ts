/* The Standard Model Lagrangian as data: gauge group, fermion multiplets with quantum numbers from the particle catalog, the Higgs doublet, the written terms, and the parameters in the G_F or running-α scheme. */
import {
  FERMI_COUPLING_CONSTANT,
  PARTICLE_CATALOG,
  PDG_2026,
  particleSpec,
} from '@standard-model/constants';
import {
  localizedText,
  type CouplingScheme,
  type FermionMultipletView,
  type LagrangianParameter,
  type LagrangianTerm,
  type ParticleName,
} from '@standard-model/contracts';
import { runningAlpha, runningStrongCoupling } from '../collisions/cross-sections.js';
import { complex, complexMultiply, type ComplexNumber } from '../quantum/linear-algebra.js';

export interface FermionMultiplet extends FermionMultipletView {
  readonly mixing: 'ckm' | 'none';
}

const HIGGS_DOUBLET_HYPERCHARGE = PARTICLE_CATALOG.higgsBoson.weakHypercharge.leftHanded;
const MINIMUM_STRONG_SCALE_IN_GEV = 2;

function hyperchargeOf(name: ParticleName, chirality: 'left' | 'right'): number {
  const hypercharge = particleSpec(name).weakHypercharge;
  const value = chirality === 'left' ? hypercharge.leftHanded : hypercharge.rightHanded;
  if (value === null) {
    throw new Error(`${name} has no ${chirality}-handed field`);
  }
  return value;
}

function multiplet(
  name: string,
  latex: string,
  chirality: 'left' | 'right',
  colorRepresentation: 'singlet' | 'triplet',
  generations: readonly (readonly ParticleName[])[],
  mixing: 'ckm' | 'none' = 'none',
): FermionMultiplet {
  const first = generations[0]?.[0];
  if (first === undefined) {
    throw new Error(`${name} has no fields`);
  }
  const hypercharge = hyperchargeOf(first, chirality);
  generations.flat().forEach((member) => {
    if (hyperchargeOf(member, chirality) !== hypercharge) {
      throw new Error(`${member} does not share the hypercharge of ${name}`);
    }
  });
  return {
    name,
    latex,
    chirality,
    colorRepresentation,
    weakRepresentation: (generations[0]?.length ?? 1) === 2 ? 'doublet' : 'singlet',
    hypercharge,
    generations,
    mixing,
  };
}

export const FERMION_MULTIPLETS: readonly FermionMultiplet[] = [
  multiplet(
    'quarkDoublet',
    'Q_L',
    'left',
    'triplet',
    [
      ['up', 'down'],
      ['charm', 'strange'],
      ['top', 'bottom'],
    ],
    'ckm',
  ),
  multiplet('upSinglet', 'u_R', 'right', 'triplet', [['up'], ['charm'], ['top']]),
  multiplet('downSinglet', 'd_R', 'right', 'triplet', [['down'], ['strange'], ['bottom']]),
  multiplet('leptonDoublet', 'L_L', 'left', 'singlet', [
    ['electronNeutrino', 'electron'],
    ['muonNeutrino', 'muon'],
    ['tauNeutrino', 'tau'],
  ]),
  multiplet('electronSinglet', 'e_R', 'right', 'singlet', [['electron'], ['muon'], ['tau']]),
];

export const DIRAC_FERMIONS: readonly ParticleName[] = [
  'up',
  'down',
  'strange',
  'charm',
  'bottom',
  'top',
  'electron',
  'muon',
  'tau',
  'electronNeutrino',
  'muonNeutrino',
  'tauNeutrino',
];

export const LAGRANGIAN_TERMS: readonly LagrangianTerm[] = [
  {
    name: 'gauge',
    latex:
      '\\mathcal{L}_{\\text{gauge}} = -\\tfrac14 G^a_{\\mu\\nu}G^{a\\,\\mu\\nu} - \\tfrac14 W^i_{\\mu\\nu}W^{i\\,\\mu\\nu} - \\tfrac14 B_{\\mu\\nu}B^{\\mu\\nu},\\quad F^a_{\\mu\\nu} = \\partial_\\mu A^a_\\nu - \\partial_\\nu A^a_\\mu + g f^{abc}A^b_\\mu A^c_\\nu',
    note: localizedText(
      'Кинетические члены глюонов, W и B; неабелева часть дает вершины трех и четырех бозонов',
      'Kinetic terms of the gluons, W and B; the non-Abelian part gives the three- and four-boson vertices',
    ),
  },
  {
    name: 'fermion',
    latex:
      "\\mathcal{L}_{\\text{fermion}} = \\sum_{\\psi} \\bar\\psi\\, i\\gamma^\\mu D_\\mu \\psi,\\quad D_\\mu = \\partial_\\mu - i g_s T^a G^a_\\mu - i g\\, T^i W^i_\\mu - i g' \\tfrac{Y}{2} B_\\mu",
    note: localizedText(
      'Фермионы Q_L, u_R, d_R, L_L, e_R; ковариантная производная задает все калибровочные вершины фермионов',
      'Fermions Q_L, u_R, d_R, L_L, e_R; the covariant derivative sets all gauge vertices of the fermions',
    ),
  },
  {
    name: 'higgs',
    latex:
      '\\mathcal{L}_{\\text{Higgs}} = (D_\\mu\\Phi)^\\dagger(D^\\mu\\Phi) + \\mu^2\\Phi^\\dagger\\Phi - \\lambda(\\Phi^\\dagger\\Phi)^2,\\quad \\Phi = \\tfrac{1}{\\sqrt2}\\begin{pmatrix}0\\\\ v + h\\end{pmatrix}',
    note: localizedText(
      'Унитарная калибровка: голдстоуны съедены, W и Z получают массы, появляются вершины hVV, hhVV, hhh, hhhh',
      'Unitary gauge: the Goldstones are eaten, W and Z get masses, the hVV, hhVV, hhh, hhhh vertices appear',
    ),
  },
  {
    name: 'yukawa',
    latex:
      '\\mathcal{L}_{\\text{Yukawa}} = -\\sum_f \\frac{y_f}{\\sqrt2}(v + h)\\,\\bar f f,\\quad y_f = \\frac{\\sqrt2\\, m_f}{v}',
    note: localizedText(
      'В базисе масс; смешивание кварков вынесено в матрицу CKM в заряженном токе',
      'In the mass basis; quark mixing goes into the CKM matrix of the charged current',
    ),
  },
];

export interface StandardModelParameters {
  readonly scheme: CouplingScheme;
  readonly scaleInGev: number | null;
  readonly vacuumExpectationValueInGev: number;
  readonly weakCoupling: number;
  readonly hyperchargeCoupling: number;
  readonly electricCharge: number;
  readonly strongCoupling: number;
  readonly sineWeak: number;
  readonly cosineWeak: number;
  readonly higgsDoubletHypercharge: number;
  readonly wMassInGev: number;
  readonly zMassInGev: number;
  readonly higgsMassInGev: number;
  readonly higgsQuartic: number;
  readonly widthsInGev: Readonly<Partial<Record<ParticleName, number>>>;
  readonly ckm: readonly (readonly ComplexNumber[])[];
  readonly massesInGev: Readonly<Partial<Record<ParticleName, number>>>;
}

function ckmMatrix(): readonly (readonly ComplexNumber[])[] {
  const wolfenstein = PDG_2026.wolfenstein;
  const expansion = wolfenstein.expansionParameter.value;
  const amplitude = wolfenstein.amplitudeParameter.value;
  const apex = complex(
    wolfenstein.unitarityTriangleApexReal.value,
    wolfenstein.unitarityTriangleApexImaginary.value,
  );
  const sine12 = expansion;
  const sine23 = amplitude * expansion ** 2;
  const fourth = amplitude ** 2 * expansion ** 4;
  const denominator = complex(1 - fourth * apex.real, -fourth * apex.imaginary);
  const numeratorScale =
    (amplitude * expansion ** 3 * Math.sqrt(1 - fourth)) / Math.sqrt(1 - expansion ** 2);
  const denominatorNorm = denominator.real ** 2 + denominator.imaginary ** 2;
  const product = complexMultiply(apex, complex(denominator.real, -denominator.imaginary));
  const sine13WithPhase = complex(
    (numeratorScale * product.real) / denominatorNorm,
    (numeratorScale * product.imaginary) / denominatorNorm,
  );
  const sine13 = Math.hypot(sine13WithPhase.real, sine13WithPhase.imaginary);
  const cosine12 = Math.sqrt(1 - sine12 ** 2);
  const cosine23 = Math.sqrt(1 - sine23 ** 2);
  const cosine13 = Math.sqrt(1 - sine13 ** 2);
  const s13Phase = sine13WithPhase;
  const s13Conjugate = complex(sine13WithPhase.real, -sine13WithPhase.imaginary);
  const shifted = (real: number, value: ComplexNumber, factor: number): ComplexNumber =>
    complex(real + value.real * factor, value.imaginary * factor);
  return [
    [complex(cosine12 * cosine13), complex(sine12 * cosine13), s13Conjugate],
    [
      shifted(-sine12 * cosine23, s13Phase, -cosine12 * sine23),
      shifted(cosine12 * cosine23, s13Phase, -sine12 * sine23),
      complex(sine23 * cosine13),
    ],
    [
      shifted(sine12 * sine23, s13Phase, -cosine12 * cosine23),
      shifted(-cosine12 * sine23, s13Phase, -sine12 * cosine23),
      complex(cosine23 * cosine13),
    ],
  ];
}

function widths(): Readonly<Partial<Record<ParticleName, number>>> {
  return {
    wPlus: PDG_2026.widthsInGev.wBoson.value,
    wMinus: PDG_2026.widthsInGev.wBoson.value,
    zBoson: PDG_2026.widthsInGev.zBoson.value,
    higgsBoson: PDG_2026.widthsInGev.higgsBoson.value,
    top: PDG_2026.widthsInGev.top.value,
    antiTop: PDG_2026.widthsInGev.top.value,
  };
}

function masses(): Readonly<Partial<Record<ParticleName, number>>> {
  const entries = DIRAC_FERMIONS.flatMap((name) => {
    const mass = particleSpec(name).massInGev.value;
    return [
      [name, mass],
      [particleSpec(name).antiparticleName, mass],
    ] as const;
  });
  return Object.fromEntries(entries);
}

export function standardModelParameters(
  scheme: CouplingScheme = 'fermiConstant',
  scaleInGev: number | null = null,
): StandardModelParameters {
  const wMass = PARTICLE_CATALOG.wPlus.massInGev.value;
  const zMass = PARTICLE_CATALOG.zBoson.massInGev.value;
  const higgsMass = PARTICLE_CATALOG.higgsBoson.massInGev.value;
  const cosineWeak = wMass / zMass;
  const sineWeak = Math.sqrt(1 - cosineWeak * cosineWeak);
  const scale = scaleInGev ?? zMass;
  let weakCoupling: number;
  let vacuum: number;
  if (scheme === 'fermiConstant') {
    vacuum = 1 / Math.sqrt(Math.SQRT2 * FERMI_COUPLING_CONSTANT.value);
    weakCoupling = (2 * wMass) / vacuum;
  } else {
    const electric = Math.sqrt(4 * Math.PI * runningAlpha(scale * scale));
    weakCoupling = electric / sineWeak;
    vacuum = (2 * wMass) / weakCoupling;
  }
  const strongScale = Math.max(scale, MINIMUM_STRONG_SCALE_IN_GEV);
  return {
    scheme,
    scaleInGev: scheme === 'fermiConstant' ? null : scale,
    vacuumExpectationValueInGev: vacuum,
    weakCoupling,
    hyperchargeCoupling: (weakCoupling * sineWeak) / cosineWeak,
    electricCharge: weakCoupling * sineWeak,
    strongCoupling: Math.sqrt(4 * Math.PI * runningStrongCoupling(strongScale * strongScale)),
    sineWeak,
    cosineWeak,
    higgsDoubletHypercharge: HIGGS_DOUBLET_HYPERCHARGE,
    wMassInGev: wMass,
    zMassInGev: zMass,
    higgsMassInGev: higgsMass,
    higgsQuartic: (higgsMass * higgsMass) / (2 * vacuum * vacuum),
    widthsInGev: widths(),
    ckm: ckmMatrix(),
    massesInGev: masses(),
  };
}

export function parameterTable(
  parameters: StandardModelParameters,
  derivedWMass: number,
  derivedZMass: number,
  derivedPhotonMass: number,
): readonly LagrangianParameter[] {
  const inputs: LagrangianParameter[] =
    parameters.scheme === 'fermiConstant'
      ? [
          {
            name: 'fermiConstant',
            latex: 'G_F',
            value: FERMI_COUPLING_CONSTANT.value,
            unit: 'GeV⁻²',
            origin: 'input',
            note: localizedText(
              'CODATA 2022, из времени жизни мюона',
              'CODATA 2022, from the muon lifetime',
            ),
          },
        ]
      : [
          {
            name: 'alpha',
            latex: `\\alpha(${String(parameters.scaleInGev)}\\,\\text{GeV})`,
            value: parameters.electricCharge ** 2 / (4 * Math.PI),
            unit: '',
            origin: 'input',
            note: localizedText(
              'Бегущая постоянная тонкой структуры на масштабе процесса',
              'Running fine-structure constant at the process scale',
            ),
          },
        ];
  return [
    ...inputs,
    {
      name: 'wMass',
      latex: 'M_W',
      value: parameters.wMassInGev,
      unit: 'GeV',
      origin: 'input',
      note: localizedText('PDG 2026', 'PDG 2026'),
    },
    {
      name: 'zMass',
      latex: 'M_Z',
      value: parameters.zMassInGev,
      unit: 'GeV',
      origin: 'input',
      note: localizedText('PDG 2026', 'PDG 2026'),
    },
    {
      name: 'higgsMass',
      latex: 'm_h',
      value: parameters.higgsMassInGev,
      unit: 'GeV',
      origin: 'input',
      note: localizedText('PDG 2026', 'PDG 2026'),
    },
    {
      name: 'vacuum',
      latex: 'v',
      value: parameters.vacuumExpectationValueInGev,
      unit: 'GeV',
      origin: 'derived',
      note:
        parameters.scheme === 'fermiConstant'
          ? localizedText('v = (√2 G_F)^{-1/2}', 'v = (√2 G_F)^{-1/2}')
          : localizedText('v = 2M_W / g', 'v = 2M_W / g'),
    },
    {
      name: 'sineSquaredWeak',
      latex: '\\sin^2\\theta_W',
      value: parameters.sineWeak ** 2,
      unit: '',
      origin: 'derived',
      note: localizedText('На массовой оболочке: 1 − M_W²/M_Z²', 'On shell: 1 − M_W²/M_Z²'),
    },
    {
      name: 'weakCoupling',
      latex: 'g',
      value: parameters.weakCoupling,
      unit: '',
      origin: 'derived',
      note: localizedText('Константа SU(2)', 'SU(2) coupling'),
    },
    {
      name: 'hyperchargeCoupling',
      latex: "g'",
      value: parameters.hyperchargeCoupling,
      unit: '',
      origin: 'derived',
      note: localizedText("Константа U(1)_Y: g' = g tanθ_W", "U(1)_Y coupling: g' = g tanθ_W"),
    },
    {
      name: 'electricCharge',
      latex: 'e',
      value: parameters.electricCharge,
      unit: '',
      origin: 'derived',
      note: localizedText('e = g sinθ_W', 'e = g sinθ_W'),
    },
    {
      name: 'strongCoupling',
      latex: 'g_s',
      value: parameters.strongCoupling,
      unit: '',
      origin: 'derived',
      note: localizedText(
        'Из α_s(M_Z) PDG с бегом на одной петле',
        'From the PDG α_s(M_Z) with one-loop running',
      ),
    },
    {
      name: 'higgsQuartic',
      latex: '\\lambda',
      value: parameters.higgsQuartic,
      unit: '',
      origin: 'derived',
      note: localizedText('λ = m_h² / 2v²', 'λ = m_h² / 2v²'),
    },
    {
      name: 'wMassFromLagrangian',
      latex: 'M_W^{\\mathcal{L}}',
      value: derivedWMass,
      unit: 'GeV',
      origin: 'check',
      note: localizedText(
        'Масса W из члена |DΦ|² после нарушения симметрии; должна совпасть с входной',
        'W mass from the |DΦ|² term after symmetry breaking; must match the input',
      ),
    },
    {
      name: 'zMassFromLagrangian',
      latex: 'M_Z^{\\mathcal{L}}',
      value: derivedZMass,
      unit: 'GeV',
      origin: 'check',
      note: localizedText('Масса Z оттуда же', 'Z mass from the same term'),
    },
    {
      name: 'photonMassFromLagrangian',
      latex: 'M_\\gamma^{\\mathcal{L}}',
      value: derivedPhotonMass,
      unit: 'GeV',
      origin: 'check',
      note: localizedText(
        'Фотон остается безмассовым: U(1) электромагнетизма не нарушена',
        'The photon stays massless: electromagnetic U(1) is unbroken',
      ),
    },
  ];
}
