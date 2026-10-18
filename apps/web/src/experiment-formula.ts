/* Experiment formula: the mathematical model of a finished run as LaTeX, one line per executed step with the resolved values, plus the measured statistics with their errors; also a standalone .tex document. */
import type {
  EntangledState,
  ExperimentResult,
  ExperimentStep,
  ParticleView,
  SpinPreparation,
  SystemFrame,
  Vector3,
} from '@standard-model/contracts';
import { WAVEPACKET_SHAPE_LABELS } from './glossary';
import { bilingual, localize, say } from './language';
import { formatValue } from './plan-edits';

export interface FormulaLine {
  readonly latex: string;
  readonly note: string;
}

export interface FormulaSection {
  readonly title: string;
  readonly lines: readonly FormulaLine[];
}

export interface ExperimentFormula {
  readonly title: string;
  readonly sections: readonly FormulaSection[];
}

const SIGNIFICANT_DIGITS = 6;
const FREQUENCY_KEY = /^(.*)\[([^\]]*)\]$/;
const MAXIMUM_DIAGRAM_TERMS = 6;

const SPIN_KETS: Readonly<Record<SpinPreparation, string>> = {
  up: '|{\\uparrow_z}\\rangle',
  down: '|{\\downarrow_z}\\rangle',
  plusX:
    '|{+x}\\rangle = \\tfrac{1}{\\sqrt2}\\left(|{\\uparrow}\\rangle + |{\\downarrow}\\rangle\\right)',
  minusX:
    '|{-x}\\rangle = \\tfrac{1}{\\sqrt2}\\left(|{\\uparrow}\\rangle - |{\\downarrow}\\rangle\\right)',
  plusY:
    '|{+y}\\rangle = \\tfrac{1}{\\sqrt2}\\left(|{\\uparrow}\\rangle + i|{\\downarrow}\\rangle\\right)',
  minusY:
    '|{-y}\\rangle = \\tfrac{1}{\\sqrt2}\\left(|{\\uparrow}\\rangle - i|{\\downarrow}\\rangle\\right)',
};

const ENTANGLED_KETS: Readonly<Record<EntangledState, string>> = {
  spinSinglet:
    '\\tfrac{1}{\\sqrt2}\\left(|{\\uparrow\\downarrow}\\rangle - |{\\downarrow\\uparrow}\\rangle\\right)',
  spinTripletZero:
    '\\tfrac{1}{\\sqrt2}\\left(|{\\uparrow\\downarrow}\\rangle + |{\\downarrow\\uparrow}\\rangle\\right)',
  bellPhiPlus: '\\tfrac{1}{\\sqrt2}\\left(|00\\rangle + |11\\rangle\\right)',
  bellPhiMinus: '\\tfrac{1}{\\sqrt2}\\left(|00\\rangle - |11\\rangle\\right)',
  bellPsiPlus: '\\tfrac{1}{\\sqrt2}\\left(|01\\rangle + |10\\rangle\\right)',
  bellPsiMinus: '\\tfrac{1}{\\sqrt2}\\left(|01\\rangle - |10\\rangle\\right)',
};

const BASIS_KETS = ['|00\\rangle', '|01\\rangle', '|10\\rangle', '|11\\rangle'];

const ORBITAL_FORMULAS: Readonly<Record<string, string>> = {
  hydrogen2s: '\\psi_{2s} = \\frac{(2 - r/a)\\,e^{-r/2a}}{4\\sqrt{2\\pi a^3}}',
  hydrogen2p: '\\psi_{2p_z} = \\frac{z\\,e^{-r/2a}}{\\sqrt{32\\pi a^5}}',
  hydrogen3d: '\\psi_{3d_{z^2}} \\propto \\frac{3z^2 - r^2}{a^2}\\,e^{-r/3a}',
  hydrogen1s2p:
    '\\psi = \\tfrac{1}{\\sqrt2}\\left(\\psi_{1s} + \\psi_{2p_z}\\right),\\quad \\langle z\\rangle(t) = \\langle z\\rangle_0 \\cos\\frac{\\Delta E\\,t}{\\hbar}',
};

const POTENTIALS: Readonly<Record<string, (frame: SystemFrame) => string>> = {
  free: () => 'V(\\vec r) = 0',
  barrier: (frame) =>
    `V(\\vec r) = V_0\\,\\Theta\\!\\left(\\tfrac{d}{2} - |x|\\right),\\quad V_0 = ${number(frame.space?.potentialEnergyInEv)}\\,\\mathrm{eV},\\ d = ${number(frame.space?.barrierThicknessInMeters)}\\,\\mathrm{m}`,
  harmonic: (frame) =>
    `V(\\vec r) = \\tfrac12 m\\omega^2 r^2,\\quad \\hbar\\omega = ${number(frame.space?.potentialEnergyInEv)}\\,\\mathrm{eV}`,
  coulomb: (frame) =>
    `V(\\vec r) = -\\frac{Z e^2}{4\\pi\\varepsilon_0\\sqrt{r^2 + a^2}},\\quad Z = ${number(frame.space?.nuclearCharge)},\\ a = \\tfrac{\\Delta x}{2}`,
  doubleSlit: (frame) =>
    `V(\\vec r) = V_0\\,\\Theta\\!\\left(\\tfrac{t}{2} - |x|\\right)\\left[1 - \\Theta\\!\\left(\\tfrac{w}{2} - \\left||y| - \\tfrac{d}{2}\\right|\\right)\\right],\\quad V_0 = ${number(frame.space?.potentialEnergyInEv)}\\,\\mathrm{eV},\\ t = ${number(frame.space?.barrierThicknessInMeters)},\\ w = ${number(frame.space?.slitWidthInMeters)},\\ d = ${number(frame.space?.slitSeparationInMeters)}\\,\\mathrm{m}`,
  doubleWell: (frame) =>
    `V(\\vec r) = V_0\\left[\\left(\\tfrac{x^2}{a^2} - 1\\right)^2 + \\tfrac{4(y^2 + z^2)}{a^2}\\right],\\quad V_0 = ${number(frame.space?.potentialEnergyInEv)}\\,\\mathrm{eV},\\ 2a = ${number(frame.space?.wellSeparationInMeters)}\\,\\mathrm{m}`,
  box: (frame) =>
    `V(\\vec r) = V_0\\,\\Theta\\!\\left(\\max(|x|, |y|, |z|) - \\tfrac{L}{2}\\right),\\quad V_0 = ${number(frame.space?.potentialEnergyInEv)}\\,\\mathrm{eV},\\ L = ${number(frame.space?.boxSizeInMeters)}\\,\\mathrm{m}`,
};

export function number(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '\\text{—}';
  }
  if (value === 0) {
    return '0';
  }
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  if (exponent >= -3 && exponent < 5) {
    return String(Number(value.toPrecision(SIGNIFICANT_DIGITS)));
  }
  const mantissa = Number((value / 10 ** exponent).toPrecision(SIGNIFICANT_DIGITS));
  return `${String(mantissa)}\\times 10^{${String(exponent)}}`;
}

const MIDDLE_DOT = '·';

export function text(value: string): string {
  return value
    .split(MIDDLE_DOT)
    .map(
      (part) =>
        `\\text{${part.replace(/[\\{}]/g, '').replace(/[_&%$#]/g, (character) => `\\${character}`)}}`,
    )
    .join('\\cdot ');
}

export function symbolLatex(symbol: string): string {
  const anti = symbol.startsWith('anti-');
  const core = anti ? symbol.slice('anti-'.length) : symbol;
  const charge = /[+-]$/.exec(core)?.[0];
  const base = (charge === undefined ? core : core.slice(0, -1))
    .replace(
      /^nu_(e|mu|tau)$/,
      (match, flavor: string) => `\\nu_{${flavor === 'e' ? 'e' : `\\${flavor}`}}`,
    )
    .replace(/^gamma$/, '\\gamma')
    .replace(/^mu$/, '\\mu')
    .replace(/^tau$/, '\\tau');
  const decorated = anti ? `\\bar{${base}}` : base;
  return charge === undefined ? decorated : `${decorated}^{${charge}}`;
}

const MATTER_NOTES = bilingual<'createNucleus' | 'createAtom' | 'createMolecule'>({
  createNucleus: [
    'Ядро: масса из AME2020 минус электроны и их связь по NIST, спин, четность и распады из NUBASE2020',
    'Nucleus: mass from AME2020 minus the electrons and their NIST binding, spin, parity and decays from NUBASE2020',
  ],
  createAtom: [
    'Атом или ион: ядро плюс электроны минус энергии ионизации NIST, спин — J основного уровня',
    'Atom or ion: the nucleus plus electrons minus the NIST ionization energies, spin is J of the ground level',
  ],
  createMolecule: [
    'Молекула: атомы минус энергии связей (OpenStax, иначе UFF), геометрия и колебания по силовому полю UFF',
    'Molecule: the atoms minus bond energies (OpenStax, else UFF), geometry and vibrations from the UFF force field',
  ],
});

function vector(value: Vector3): string {
  return `(${number(value.x)},\\ ${number(value.y)},\\ ${number(value.z)})`;
}

function particleIn(frame: SystemFrame | undefined, label: string): ParticleView | undefined {
  return frame?.particles.find((particle) => particle.label === label);
}

function named(frame: SystemFrame | undefined, label: string): string {
  const view = particleIn(frame, label);
  return view === undefined ? text(label) : `{${symbolLatex(view.symbol)}}_{${text(label)}}`;
}

function invariantMassSquared(first: ParticleView, second: ParticleView): number {
  const energy = first.energyInGev + second.energyInGev;
  const momentum = {
    x: first.momentumInGev.x + second.momentumInGev.x,
    y: first.momentumInGev.y + second.momentumInGev.y,
    z: first.momentumInGev.z + second.momentumInGev.z,
  };
  return energy * energy - momentum.x ** 2 - momentum.y ** 2 - momentum.z ** 2;
}

function collisionLine(before: SystemFrame | undefined, targets: readonly string[]): FormulaLine {
  const [first, second] = targets.map((label) => particleIn(before, label));
  const energy =
    first === undefined || second === undefined
      ? Number.NaN
      : Math.sqrt(Math.max(invariantMassSquared(first, second), 0));
  const kinds = new Set([first?.family, second?.family]);
  const photons = [first, second].filter((view) => view?.name === 'photon').length;
  const energyText = `\\sqrt{s} = ${number(energy)}\\,\\mathrm{GeV}`;
  if (photons === 2) {
    return {
      latex: `\\sigma_{\\gamma\\gamma\\to f\\bar f} = \\frac{\\pi r_e^2}{2}(1-\\beta^2)\\left[(3-\\beta^4)\\ln\\frac{1+\\beta}{1-\\beta} - 2\\beta(2-\\beta^2)\\right],\\quad ${energyText}`,
      note: say(
        'Брейт–Уилер: рождение пары двумя фотонами, β — скорость фермиона в системе центра масс',
        'Breit–Wheeler: pair creation by two photons, β is the fermion speed in the center-of-mass frame',
      ),
    };
  }
  if (photons === 1) {
    return {
      latex: `\\frac{d\\sigma}{d\\Omega} = \\frac{r_e^2}{2}\\left(\\frac{E'}{E}\\right)^2\\left(\\frac{E'}{E} + \\frac{E}{E'} - \\sin^2\\theta\\right),\\quad E' = \\frac{E}{1 + \\frac{E}{m_e c^2}(1-\\cos\\theta)},\\quad ${energyText}`,
      note: say(
        'Клейн–Нишина: комптоновское рассеяние, угол разыгрывается в системе покоя электрона',
        'Klein–Nishina: Compton scattering, the angle is sampled in the electron rest frame',
      ),
    };
  }
  if (kinds.has('chargedLepton')) {
    return {
      latex: `\\frac{d\\sigma}{d\\Omega}(e^+e^-\\to f\\bar f) = \\frac{\\alpha^2(s)}{4s}N_c\\left[A_0(1+\\cos^2\\theta) + A_1\\cos\\theta\\right]\\left(1+\\frac{\\alpha_s}{\\pi}\\right)_{q},\\quad A_0 = Q_f^2 - 2Q_f v_e v_f\\,\\mathrm{Re}\\,\\chi + (v_e^2+a_e^2)(v_f^2+a_f^2)|\\chi|^2,\\quad A_1 = -4Q_f a_e a_f\\,\\mathrm{Re}\\,\\chi + 8v_e a_e v_f a_f|\\chi|^2,\\quad \\chi = \\frac{1}{4\\sin^2\\theta_W\\cos^2\\theta_W}\\frac{s}{s - M_Z^2 + iM_Z\\Gamma_Z},\\quad ${energyText}`,
      note: say(
        'Аннигиляция через γ и Z с интерференцией, бегущая α(s); канал выбирается по доле сечения, e⁺e⁻ → γγ по детальному равновесию',
        'Annihilation through γ and Z with interference, running α(s); the channel is picked by its share of the cross section, e⁺e⁻ → γγ by detailed balance',
      ),
    };
  }
  return { latex: energyText, note: say('Столкновение', 'Collision') };
}

function stepLines(
  step: ExperimentStep,
  before: SystemFrame | undefined,
  after: SystemFrame | undefined,
): readonly FormulaLine[] {
  switch (step.operation) {
    case 'create': {
      const view = particleIn(after, step.label);
      const spin =
        step.spinDirection !== undefined
          ? `\\cos\\tfrac{\\theta}{2}|{\\uparrow}\\rangle + e^{i\\varphi}\\sin\\tfrac{\\theta}{2}|{\\downarrow}\\rangle,\\ \\theta = ${number(step.spinDirection.polarAngleDegrees)}^\\circ,\\ \\varphi = ${number(step.spinDirection.azimuthDegrees)}^\\circ`
          : step.spin === undefined
            ? null
            : SPIN_KETS[step.spin];
      return [
        {
          latex: `${named(after, step.label)}:\\quad p^\\mu = (E,\\ \\vec p) = \\left(${number(view?.energyInGev)},\\ ${view === undefined ? '' : vector(view.momentumInGev)}\\right)\\,\\mathrm{GeV}${spin === null ? '' : `,\\quad |\\chi\\rangle = ${spin}`}`,
          note: say(
            `Создание ${step.label}: масса и квантовые числа из PDG 2026, E² = p² + m²`,
            `Creation of ${step.label}: mass and quantum numbers from PDG 2026, E² = p² + m²`,
          ),
        },
      ];
    }
    case 'createNucleus':
    case 'createAtom':
    case 'createMolecule': {
      const view = particleIn(after, step.label);
      return [
        {
          latex: `${named(after, step.label)}:\\quad M = ${number(view?.massInGev)}\\,\\mathrm{GeV},\\quad q = ${number(view?.chargeInElementaryUnits)}\\,e,\\quad p^\\mu = \\left(${number(view?.energyInGev)},\\ ${view === undefined ? '' : vector(view.momentumInGev)}\\right)\\,\\mathrm{GeV}`,
          note: MATTER_NOTES[step.operation],
        },
      ];
    }
    case 'entangle': {
      const [first, second] = step.targets;
      const state =
        step.amplitudes === undefined
          ? ENTANGLED_KETS[step.state]
          : step.amplitudes.real
              .map((real, index) => {
                const imaginary = step.amplitudes?.imaginary[index] ?? 0;
                if (real === 0 && imaginary === 0) {
                  return null;
                }
                const coefficient =
                  imaginary === 0
                    ? number(real)
                    : `(${number(real)} ${imaginary < 0 ? '-' : '+'} ${number(Math.abs(imaginary))}i)`;
                return `${coefficient}\\,${BASIS_KETS[index] ?? ''}`;
              })
              .filter((term): term is string => term !== null)
              .join(' + ');
      return [
        {
          latex: `|\\Psi\\rangle_{${text(first ?? '')}\\,${text(second ?? '')}} = ${state}`,
          note: say(
            `Запутанное состояние ${step.amplitudes === undefined ? step.state : 'с точными амплитудами из прошлого эксперимента'}, наблюдаемая ${step.observable ?? 'spin'}`,
            `Entangled state ${step.amplitudes === undefined ? step.state : 'with the exact amplitudes of the previous experiment'}, observable ${step.observable ?? 'spin'}`,
          ),
        },
      ];
    }
    case 'influence': {
      const parameters = Object.entries(step.parameters ?? {})
        .map(
          ([key, value]) =>
            `${text(key)} = ${typeof value === 'number' ? number(value) : text(formatValue(value))}`,
        )
        .join(',\\ ');
      return [
        {
          latex: `\\hat H \\to \\hat H + \\hat H_{${text(step.influence)}}${parameters === '' ? '' : `,\\quad ${parameters}`}`,
          note: say(
            `Воздействие ${step.influence}: меняет окружение, гамильтониан или декогеренцию`,
            `Influence ${step.influence}: changes the environment, the Hamiltonian or the decoherence`,
          ),
        },
      ];
    }
    case 'evolve':
      return [
        {
          latex: `|\\psi(t)\\rangle = e^{-\\frac{i}{\\hbar}\\hat H t}|\\psi(0)\\rangle,\\quad \\rho \\to \\sum_k \\hat K_k \\rho \\hat K_k^\\dagger,\\quad t = ${number(Number(step.durationInSeconds))}\\,\\mathrm{s}`,
          note: say(
            'Эволюция: унитарная часть и декогеренция квантовыми скачками (операторы Крауса); частицы движутся на v·t',
            'Evolution: the unitary part and decoherence by quantum jumps (Kraus operators); particles move by v·t',
          ),
        },
      ];
    case 'measure': {
      const axis =
        step.axis === undefined
          ? 'z'
          : `\\hat n(${number(Number(step.axis.polarAngleDegrees))}^\\circ,\\ ${number(Number(step.axis.azimuthDegrees))}^\\circ)`;
      return [
        {
          latex: `P(m) = \\langle\\psi|\\hat\\Pi_m^{(${axis})}|\\psi\\rangle,\\qquad |\\psi\\rangle \\to \\frac{\\hat\\Pi_m|\\psi\\rangle}{\\sqrt{P(m)}}`,
          note: say(
            `Измерение ${step.observable} у ${step.target} по правилу Борна с коллапсом, запись ${step.record}`,
            `Measurement of ${step.observable} of ${step.target} by the Born rule with collapse, record ${step.record}`,
          ),
        },
      ];
    }
    case 'combine':
      return [
        {
          latex: `p^\\mu_{${text(step.label)}} = \\sum_i p^\\mu_i,\\quad i \\in \\{${step.targets.map(text).join(',\\ ')}\\}`,
          note: say(
            'Сборка составной частицы: сохранение четырехимпульса, спин неполяризован',
            'Composite particle: four-momentum is conserved, the spin is unpolarized',
          ),
        },
      ];
    case 'diffract':
      return [
        {
          latex: `I(\\theta) \\propto \\mathrm{sinc}^2\\!\\left(\\frac{\\pi a\\sin\\theta}{\\lambda}\\right)\\left[1 + V\\cos\\!\\left(\\frac{2\\pi d\\sin\\theta}{\\lambda}\\right)\\right],\\quad \\lambda = \\frac{h}{p},\\ V = e^{-\\Gamma t},\\ a = ${number(Number(step.slitWidthInMeters))}\\,\\mathrm{m},\\ d = ${number(Number(step.slitSeparationInMeters))}\\,\\mathrm{m},\\ L = ${number(Number(step.screenDistanceInMeters))}\\,\\mathrm{m}`,
          note: say(
            `Две щели по Фраунгоферу, видимость гасится декогеренцией и детектором пути; запись ${step.record}`,
            `Fraunhofer double slit, the visibility is washed out by decoherence and the which-path detector; record ${step.record}`,
          ),
        },
        ...(step.pathMarker === undefined
          ? []
          : [
              {
                latex: `|\\Psi\\rangle = \\int dx\\,\\big(\\psi_1(x)\\,|H\\rangle + \\psi_2(x)\\,|V\\rangle\\big)\\,|x\\rangle,\\quad P(x) \\propto |\\psi_1|^2 + |\\psi_2|^2,\\quad P(x \\mid \\pm) \\propto \\mathrm{sinc}^2\\!\\left(\\frac{\\pi a x}{\\lambda L}\\right)\\left[1 \\pm \\cos\\frac{2\\pi d x}{\\lambda L}\\right]`,
                note: say(
                  `Путь записан в ${step.pathMarker}: без отбора полос нет, в совпадениях с измерением ${step.pathMarker} под 45° — полосы и антиполосы, в базисе H/V — путь известен`,
                  `The path is written into ${step.pathMarker}: without selection there are no fringes, in coincidence with ${step.pathMarker} measured at 45° there are fringes and antifringes, in the H/V basis the path is known`,
                ),
              },
            ]),
      ];
    case 'collide': {
      const line = collisionLine(before, step.targets);
      const event = after?.events.find((candidate) => candidate.kind === 'collided');
      const diagrams = event?.diagrams ?? [];
      const symbol = (particle: string): string => {
        const view = [...(before?.particles ?? []), ...(after?.particles ?? [])].find(
          (candidate) => candidate.name === particle,
        );
        return view === undefined ? text(particle) : symbolLatex(view.symbol);
      };
      const terms = diagrams
        .slice(0, MAXIMUM_DIAGRAM_TERMS)
        .map((diagram) =>
          diagram.propagators.length === 0
            ? '\\mathcal{M}_{\\text{contact}}'
            : `\\mathcal{M}_{${diagram.propagators.map((propagator) => `{${symbol(propagator.particle)}}^{*}`).join('')}}`,
        );
      return [
        ...(terms.length === 0
          ? []
          : [
              {
                latex: `\\mathcal{M} = ${terms.join(' + ')}${diagrams.length > MAXIMUM_DIAGRAM_TERMS ? ' + \\dots' : ''},\\quad \\frac{d\\sigma}{d\\Omega} = \\frac{1}{64\\pi^2 s}\\frac{|\\vec p_f|}{|\\vec p_i|}\\,\\overline{\\sum}|\\mathcal{M}|^2`,
                note: `${say('Древесные диаграммы канала из лагранжиана', 'Tree diagrams of the channel from the Lagrangian')} (${String(diagrams.length)}): ${diagrams
                  .map(
                    (diagram) =>
                      `${localize(diagram.channel)} ${diagram.propagators.map((propagator) => propagator.particle).join(', ')}`,
                  )
                  .join(
                    '; ',
                  )}; ${say('спиральности и цвета просуммированы численно', 'helicities and colors are summed numerically')}`,
              },
            ]),
        { ...line, note: `${line.note}; ${say('запись', 'record')} ${step.record}` },
      ];
    }
    case 'place': {
      const center = `\\vec r_0 = ${vector({
        x: Number(step.centerInMeters.x),
        y: Number(step.centerInMeters.y),
        z: Number(step.centerInMeters.z),
      })}\\,\\mathrm{m}`;
      const orbital = ORBITAL_FORMULAS[step.shape];
      if (orbital !== undefined) {
        return [
          {
            latex: `${orbital},\\quad a = \\frac{a_0}{Z}\\frac{m_e}{m},\\quad ${center}`,
            note: say(
              `${step.target} в кубе: ${WAVEPACKET_SHAPE_LABELS[step.shape] ?? step.shape} у кулоновского центра`,
              `${step.target} in the cube: ${WAVEPACKET_SHAPE_LABELS[step.shape] ?? step.shape} around a Coulomb center`,
            ),
          },
        ];
      }
      if (step.shape === 'catState') {
        return [
          {
            latex: `\\psi(\\vec r, 0) \\propto e^{-\\frac{|\\vec r + \\vec r_0|^2}{4w^2} + \\frac{i}{\\hbar}\\vec p\\cdot\\vec r} + e^{-\\frac{|\\vec r - \\vec r_0|^2}{4w^2} - \\frac{i}{\\hbar}\\vec p\\cdot\\vec r},\\quad w = ${number(Number(step.widthInMeters))}\\,\\mathrm{m},\\ ${center}`,
            note: say(
              `${step.target} в кубе котом Шрёдингера: два пакета в ±r₀, которые летят навстречу друг другу`,
              `${step.target} in the cube as a Schrödinger cat: two packets at ±r₀ heading towards each other`,
            ),
          },
        ];
      }
      return [
        step.shape === 'groundState'
          ? {
              latex: `\\psi_0(\\vec r) = \\text{${say('основное состояние потенциала', 'ground state of the potential')}},\\quad \\psi_{1s} = \\frac{e^{-|\\vec r - \\vec r_0|/a}}{\\sqrt{\\pi a^3}},\\ a = \\frac{a_0}{Z}\\frac{m_e}{m},\\quad ${center}`,
              note: say(
                `${step.target} в кубе в основном состоянии: 1s для кулоновского центра, гауссиана для ловушки`,
                `${step.target} in the cube in its ground state: 1s for a Coulomb center, a Gaussian for a trap`,
              ),
            }
          : {
              latex: `\\psi(\\vec r, 0) = (2\\pi w^2)^{-3/4}\\exp\\!\\left(-\\frac{|\\vec r - \\vec r_0|^2}{4w^2} + \\frac{i}{\\hbar}\\vec p\\cdot\\vec r\\right),\\quad w = ${number(Number(step.widthInMeters))}\\,\\mathrm{m},\\ ${center}`,
              note: say(
                `${step.target} в кубе гауссовым пакетом с импульсом частицы`,
                `${step.target} in the cube as a Gaussian packet with the particle momentum`,
              ),
            },
      ];
    }
    case 'propagate':
      return [
        {
          latex: `i\\hbar\\,\\partial_t\\psi = \\left[-\\frac{\\hbar^2}{2m}\\nabla^2 + V(\\vec r)\\right]\\psi,\\quad ${after === undefined ? '' : ((POTENTIALS[after.space?.potential ?? 'free'] ?? POTENTIALS.free)?.(after) ?? '')},\\quad t = ${number(Number(step.durationInSeconds))}\\,\\mathrm{s}`,
          note: say(
            'Уравнение Шрёдингера на сетке методом расщепления оператора с БПФ, края куба поглощают',
            'The Schrödinger equation on a grid by FFT split-operator steps, the cube edges absorb',
          ),
        },
      ];
    case 'measureSystem':
      return [
        {
          latex: `\\mathcal{S} = \\{\\, i : \\text{${say('частица', 'particle')} } i \\text{ ${say('жива', 'alive')}} \\,\\},\\qquad \\Gamma_{e^+e^-\\to\\gamma\\gamma} = 4P_{\\text{singlet}}\\,\\pi r_e^2 c\\int \\rho_{-}\\rho_{+}\\,d^3r`,
          note: say(
            `Замер системы: состав без коллапса; аннигиляция перекрытых e⁻e⁺ набирается за время с этой скоростью; запись ${step.record}`,
            `System snapshot: the composition without collapse; annihilation of overlapping e⁻e⁺ accumulates over time at this rate; record ${step.record}`,
          ),
        },
      ];
    case 'measurePosition':
      return [
        {
          latex: `P(\\vec r_j) = |\\psi(\\vec r_j)|^2\\,\\Delta V,\\qquad \\psi \\to \\delta_{\\vec r, \\vec r_j}`,
          note: say(
            `Измерение положения ${step.target}: ячейка по правилу Борна, коллапс в нее; запись ${step.record}`,
            `Position measurement of ${step.target}: a cell by the Born rule, collapse into it; record ${step.record}`,
          ),
        },
      ];
    case 'decay':
      return [
        {
          latex: `P(t) = 1 - e^{-t/(\\gamma\\tau)},\\quad \\frac{\\Gamma_i}{\\Gamma} = \\mathrm{BR}_i,\\quad d\\Gamma \\propto |\\mathcal M|^2\\,d\\Phi_n`,
          note: say(
            `Распад ${step.target}: время по экспоненте с замедлением γ, канал по PDG, кинематика по фазовому объему`,
            `Decay of ${step.target}: exponential time with γ dilation, channel from PDG, kinematics from phase space`,
          ),
        },
      ];
  }
}

function resultLines(result: ExperimentResult): readonly FormulaLine[] {
  const frequencies = Object.entries(result.reportValues).flatMap(([key, value]) => {
    const match = FREQUENCY_KEY.exec(key);
    if (match === null || value === null) {
      return [];
    }
    const error = Math.sqrt((value * (1 - value)) / result.shots);
    return [
      {
        latex: `\\hat P\\left(${text(match[1] ?? '')} = ${text(match[2] ?? '')}\\right) = ${number(value)} \\pm ${number(error)}`,
        note: say('Частота исхода, ошибка √(P(1−P)/N)', 'Outcome frequency, error √(P(1−P)/N)'),
      },
    ];
  });
  const scalars = Object.entries(result.reportValues)
    .filter(([key]) => !FREQUENCY_KEY.test(key) && result.distributions[key] === undefined)
    .map(([key, value]) => ({
      latex: `${text(key)} = ${number(value)}`,
      note: say('Статистика отчета', 'Report statistic'),
    }));
  const distributions = Object.values(result.distributions).map((distribution) => ({
    latex: `\\langle ${text(distribution.record)}\\rangle = ${number(distribution.mean)} \\pm ${number(distribution.standardDeviation / Math.sqrt(Math.max(distribution.samples, 1)))},\\quad \\sigma = ${number(distribution.standardDeviation)},\\ n = ${String(distribution.samples)}`,
    note: say('Среднее с ошибкой σ/√n', 'Mean with error σ/√n'),
  }));
  return [
    {
      latex: `N = ${String(result.shots)},\\quad \\text{seed} = ${String(result.seed)},\\quad \\hat P(m) = \\frac{n_m}{N}`,
      note: say(
        'Монте-Карло: каждый выстрел — независимая квантовая траектория',
        'Monte Carlo: every shot is an independent quantum trajectory',
      ),
    },
    ...frequencies,
    ...scalars,
    ...distributions,
  ];
}

export function experimentFormula(result: ExperimentResult): ExperimentFormula {
  const frames = result.systemReport?.frames ?? [];
  const model = frames.flatMap((frame, index) =>
    frame.step === null ? [] : stepLines(frame.step, frames[index - 1], frame),
  );
  const parameters = Object.entries(result.parameters).map(([key, value]) => ({
    latex: `${text(key)} = ${number(value)}`,
    note: say('Параметр плана', 'Plan parameter'),
  }));
  return {
    title: result.planName,
    sections: [
      ...(parameters.length === 0
        ? []
        : [{ title: say('Параметры', 'Parameters'), lines: parameters }]),
      { title: say('Модель по шагам', 'Model by step'), lines: model },
      { title: say('Результат', 'Result'), lines: resultLines(result) },
    ],
  };
}

const ROW_SEPARATOR = ',\\quad ';

export function formulaRows(latex: string): string {
  return latex.split(ROW_SEPARATOR).join(',\\\\ ');
}

export function formulaDocument(formula: ExperimentFormula): string {
  const body = formula.sections
    .map(
      (section) =>
        `\\section*{${section.title}}\n${section.lines
          .map(
            (line) =>
              `\\noindent ${line.note}\n\\begin{gather*}\n${formulaRows(line.latex)}\n\\end{gather*}`,
          )
          .join('\n\n')}`,
    )
    .join('\n\n');
  return `\\documentclass[11pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T2A]{fontenc}
\\usepackage[russian,english]{babel}
\\usepackage{amsmath,amssymb}
\\usepackage[margin=2cm]{geometry}
\\title{${formula.title.replace(/[_&%$#]/g, (character) => `\\${character}`)}}
\\date{Standard Model Lab, CODATA 2022, PDG 2026}
\\begin{document}
\\maketitle
${body}
\\end{document}
`;
}
