/* ProcessCalculator: the facade over the Lagrangian and the Feynman layer; caches a model per coupling scheme and scale, serves the Lagrangian view and computes tree-level cross sections and widths with diagrams and PDG references. */
import { particleSpec } from '@standard-model/constants';
import {
  LocalizedError,
  localizedText,
  type ComplexValue,
  type CouplingScheme,
  type DiagramView,
  type LagrangianResponse,
  type ParticleName,
  type ProcessRequest,
  type ProcessResult,
  type VertexView,
  type LocalizedText,
} from '@standard-model/contracts';
import { widthInGevToMeanLifeInSeconds } from '@standard-model/utils';
import {
  FERMION_MULTIPLETS,
  LAGRANGIAN_TERMS,
  parameterTable,
  standardModelParameters,
} from '../lagrangian/standard-model.js';
import { deriveLagrangian, type Vertex } from '../lagrangian/vertices.js';
import { FeynmanModel, listDiagrams } from './amplitude.js';
import {
  averagingFactor,
  measuredPartialWidth,
  ProcessKinematics,
  symmetryFactor,
} from './observables.js';

const SCALE_ROUNDING_DIGITS = 4;
const DEFAULT_CUT_FOR_MASSLESS_EXCHANGE = 0.99;
const MOMENTUM_LABELS = ['p₁', 'p₂', 'p₃', 'p₄', 'p₅'];
const STRUCTURE_LATEX: Readonly<Record<Vertex['structure'], string>> = {
  fermionFermionVector: '\\gamma^\\mu\\,(c_L P_L + c_R P_R)',
  fermionFermionScalar: 'c_S',
  tripleGauge:
    'C\\,[g^{\\mu\\nu}(k_1-k_2)^\\rho + g^{\\nu\\rho}(k_2-k_3)^\\mu + g^{\\rho\\mu}(k_3-k_1)^\\nu]',
  quarticGauge:
    'K_{12}\\,g^{\\mu\\nu}g^{\\rho\\sigma} + K_{13}\\,g^{\\mu\\rho}g^{\\nu\\sigma} + K_{14}\\,g^{\\mu\\sigma}g^{\\nu\\rho}',
  vectorVectorScalar: 'C\\,g^{\\mu\\nu}',
  vectorVectorScalarScalar: 'C\\,g^{\\mu\\nu}',
  tripleScalar: 'C',
  quarticScalar: 'C',
};
const FACTOR_NAMES: Readonly<Record<Vertex['structure'], readonly string[]>> = {
  fermionFermionVector: ['c_L', 'c_R'],
  fermionFermionScalar: ['c_S'],
  tripleGauge: ['C'],
  quarticGauge: ['K_12', 'K_13', 'K_14'],
  vectorVectorScalar: ['C'],
  vectorVectorScalarScalar: ['C'],
  tripleScalar: ['C'],
  quarticScalar: ['C'],
};

export class ProcessError extends LocalizedError {}

function isElementary(particle: ParticleName): boolean {
  return particleSpec(particle).constituents === null;
}

function anti(particle: ParticleName): ParticleName {
  return particleSpec(particle).antiparticleName;
}

function processLabel(initial: readonly ParticleName[], final: readonly ParticleName[]): string {
  const symbol = (particle: ParticleName): string => particleSpec(particle).symbol;
  return `${initial.map(symbol).join(' ')} → ${final.map(symbol).join(' ')}`;
}

export class ProcessCalculator {
  private readonly models = new Map<string, FeynmanModel>();

  model(scheme: CouplingScheme, scaleInGev: number | null = null): FeynmanModel {
    const scale =
      scheme === 'fermiConstant'
        ? null
        : Number((scaleInGev ?? 0).toPrecision(SCALE_ROUNDING_DIGITS));
    const key = `${scheme}:${String(scale)}`;
    const cached = this.models.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const parameters = standardModelParameters(scheme, scale);
    const model = new FeynmanModel(parameters, deriveLagrangian(parameters).vertices);
    this.models.set(key, model);
    return model;
  }

  lagrangian(
    scheme: CouplingScheme = 'fermiConstant',
    scaleInGev: number | null = null,
  ): LagrangianResponse {
    const model = this.model(scheme, scaleInGev);
    const derived = deriveLagrangian(model.parameters);
    const seen = new Set<string>();
    const vertices: VertexView[] = derived.vertices.flatMap((vertex) => {
      const particles = vertex.legs.map((leg) => leg.particle);
      const key = `${vertex.structure}:${[...particles].sort().join(',')}`;
      if (seen.has(key)) {
        return [];
      }
      seen.add(key);
      const couplings: Record<string, ComplexValue> = Object.fromEntries(
        (FACTOR_NAMES[vertex.structure] ?? []).map((name, index) => [
          name,
          vertex.factors[index] ?? { real: 0, imaginary: 0 },
        ]),
      );
      return [
        {
          particles,
          structure: vertex.structure,
          latex: STRUCTURE_LATEX[vertex.structure],
          couplings,
        },
      ];
    });
    return {
      scheme,
      scaleInGev: model.parameters.scaleInGev,
      terms: LAGRANGIAN_TERMS,
      multiplets: FERMION_MULTIPLETS.map(({ mixing, ...view }) => {
        void mixing;
        return view;
      }),
      parameters: parameterTable(
        model.parameters,
        derived.masses.wMassInGev,
        derived.masses.zMassInGev,
        derived.masses.photonMassInGev,
      ),
      vertices,
    };
  }

  diagrams(
    model: FeynmanModel,
    initial: readonly ParticleName[],
    final: readonly ParticleName[],
  ): readonly DiagramView[] {
    return listDiagrams(model, [...initial, ...final.map(anti)], MOMENTUM_LABELS, initial.length);
  }

  calculate(request: ProcessRequest): ProcessResult {
    const { initial, final } = request;
    [...initial, ...final].forEach((particle) => {
      if (!isElementary(particle)) {
        throw new ProcessError(
          localizedText(
            `${particle} — составная частица, ее нет в лагранжиане; считайте процессы с кварками и глюонами`,
            `${particle} is a composite particle and is not in the Lagrangian; compute processes with quarks and gluons`,
          ),
        );
      }
    });
    if (initial.length === 1) {
      return this.width(initial[0] as ParticleName, final, request.scheme ?? 'fermiConstant');
    }
    if (initial.length === 2 && final.length === 2) {
      return this.crossSection(request);
    }
    throw new ProcessError(
      localizedText(
        'Доступны распады 1→2, 1→3 и столкновения 2→2',
        'Available: decays 1→2, 1→3 and collisions 2→2',
      ),
    );
  }

  private width(
    parent: ParticleName,
    final: readonly ParticleName[],
    scheme: CouplingScheme,
  ): ProcessResult {
    const model = this.model(scheme, this.model('fermiConstant').massOf(parent));
    const diagrams = this.diagrams(model, [parent], final);
    if (diagrams.length === 0) {
      throw new ProcessError(
        localizedText(
          `${processLabel([parent], final)}: на древесном уровне нет ни одной диаграммы`,
          `${processLabel([parent], final)}: there is no diagram at tree level`,
        ),
      );
    }
    const kinematics = new ProcessKinematics(model);
    let value: number;
    if (final.length === 2) {
      value = kinematics.twoBodyWidth(parent, final as [ParticleName, ParticleName]);
    } else if (final.length === 3) {
      value = kinematics.threeBodyWidth(
        parent,
        final as [ParticleName, ParticleName, ParticleName],
      );
    } else {
      throw new ProcessError(
        localizedText(
          'Распады считаются в два или три тела',
          'Decays are computed into two or three bodies',
        ),
      );
    }
    const measured = measuredPartialWidth(parent, final);
    const notes: LocalizedText[] = [];
    if (value === 0) {
      notes.push(
        localizedText(
          'Распад кинематически закрыт: сумма масс продуктов больше массы частицы',
          'The decay is kinematically closed: the product masses add up to more than the particle mass',
        ),
      );
    }
    if (final.some((particle) => particleSpec(particle).family === 'quark')) {
      notes.push(
        localizedText(
          'Древесный уровень без КХД-поправок: адронные ширины занижены примерно на α_s/π ≈ 4%',
          'Tree level without QCD corrections: hadronic widths are low by about α_s/π ≈ 4%',
        ),
      );
    }
    if (final.length === 3) {
      notes.push(
        localizedText(
          'Резонансы внутри трехчастичного распада интегрируются квадратурой без отображения; узкие пики считаются грубо',
          'Resonances inside a three-body decay are integrated by quadrature without a mapping; narrow peaks are computed roughly',
        ),
      );
    }
    return {
      kind: 'width',
      process: processLabel([parent], final),
      diagrams,
      scheme,
      value,
      unit: 'GeV',
      lifetimeInSeconds: value > 0 ? widthInGevToMeanLifeInSeconds(value) : null,
      angularDistribution: null,
      averagedStates: averagingFactor([parent]),
      symmetryFactor: symmetryFactor(final),
      reference:
        measured === null
          ? null
          : {
              label: localizedText(
                'PDG 2026: полная ширина × доля канала',
                'PDG 2026: total width × channel fraction',
              ),
              value: measured.value,
              uncertainty: measured.uncertainty,
            },
      notes,
    };
  }

  private crossSection(request: ProcessRequest): ProcessResult {
    const energy = request.centerOfMassEnergyInGev;
    if (energy === undefined || !(energy > 0)) {
      throw new ProcessError(
        localizedText(
          'Для столкновения нужна энергия в системе центра масс √s, ГэВ',
          'A collision needs the center-of-mass energy √s, GeV',
        ),
      );
    }
    const initial = request.initial as [ParticleName, ParticleName];
    const final = request.final as [ParticleName, ParticleName];
    const scheme = request.scheme ?? 'runningAlpha';
    const model = this.model(scheme, energy);
    const diagrams = this.diagrams(model, initial, final);
    if (diagrams.length === 0) {
      throw new ProcessError(
        localizedText(
          `${processLabel(initial, final)}: на древесном уровне нет ни одной диаграммы`,
          `${processLabel(initial, final)}: there is no diagram at tree level`,
        ),
      );
    }
    const notes: LocalizedText[] = [];
    const kinematics = new ProcessKinematics(model);
    const masslessExchange = kinematics.forwardSingular(initial, final, energy, diagrams);
    let cut = request.maximumAbsoluteCosine ?? 1;
    if (masslessExchange && cut >= 1) {
      cut = DEFAULT_CUT_FOR_MASSLESS_EXCHANGE;
      notes.push(
        localizedText(
          'Обмен безмассовой частицей в t- или u-канале: полное сечение расходится вперед, взят срез |cos θ| < 0.99, как акцептанс детектора',
          'Massless exchange in the t or u channel: the total cross section diverges forward, a cut |cos θ| < 0.99 is applied like a detector acceptance',
        ),
      );
    }
    const result = kinematics.crossSection(initial, final, energy, cut);
    if (result.crossSectionInNanobarns === 0) {
      notes.push(
        localizedText(
          'Ниже порога: энергии не хватает на массы конечных частиц',
          'Below threshold: the energy does not cover the final-state masses',
        ),
      );
    }
    if (!Number.isFinite(result.crossSectionInNanobarns)) {
      notes.push(
        localizedText(
          'Частицы в покое: σ расходится как 1/v, конечна скорость реакции σv',
          'Particles at rest: σ diverges as 1/v, the reaction rate σv is finite',
        ),
      );
    }
    if (final.some((particle) => particleSpec(particle).family === 'quark')) {
      notes.push(
        localizedText(
          'Кварки в конечном состоянии: древесный уровень без поправки 1 + α_s/π и без адронизации',
          'Quarks in the final state: tree level without the 1 + α_s/π correction and without hadronization',
        ),
      );
    }
    return {
      kind: 'crossSection',
      process: processLabel(initial, final),
      diagrams,
      scheme,
      value: result.crossSectionInNanobarns,
      unit: 'nb',
      lifetimeInSeconds: null,
      angularDistribution: {
        cosine: result.cosine,
        differentialInNanobarns: result.differentialInNanobarns,
      },
      averagedStates: averagingFactor(initial),
      symmetryFactor: symmetryFactor(final),
      reference: null,
      notes,
    };
  }
}

export const SHARED_PROCESS_CALCULATOR = new ProcessCalculator();
