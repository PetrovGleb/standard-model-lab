/* ExperimentBuilder: fluent TypeScript API that produces the same ExperimentPlan JSON a template or the UI would. */
import type {
  CatalogParticleName,
  MoleculeAtom,
  MoleculeBond,
  EntangledState,
  ExperimentPlan,
  ExperimentStep,
  InfluenceStep,
  MeasurementAxis,
  NumberOrParameter,
  ObservableName,
  ParameterizableVector3,
  ReportSpec,
  TemplateCategory,
  ReportStatistic,
  SpaceSpec,
  SpinPreparation,
  WavepacketShape,
  ReportCondition,
} from '@standard-model/contracts';

const DEFAULT_SHOTS = 1000;

export class ExperimentBuilder {
  private readonly parameters: Record<string, number> = {};
  private readonly steps: ExperimentStep[] = [];
  private readonly reports: ReportSpec[] = [];
  private shotCount = DEFAULT_SHOTS;
  private seedValue: number | undefined;
  private descriptionText: string | undefined;
  private categoryList: readonly TemplateCategory[] = [];
  private spaceSpec: SpaceSpec | undefined;

  constructor(private readonly name: string) {}

  categorize(...categories: readonly TemplateCategory[]): this {
    this.categoryList = categories;
    return this;
  }

  describe(description: string): this {
    this.descriptionText = description;
    return this;
  }

  parameter(name: string, defaultValue: number): this {
    this.parameters[name] = defaultValue;
    return this;
  }

  shots(shots: number): this {
    this.shotCount = shots;
    return this;
  }

  seed(seed: number): this {
    this.seedValue = seed;
    return this;
  }

  create(
    label: string,
    particle: CatalogParticleName,
    options: {
      spin?: SpinPreparation;
      momentumInGev?: ParameterizableVector3;
      count?: NumberOrParameter;
    } = {},
  ): this {
    this.steps.push({ operation: 'create', label, particle, ...options });
    return this;
  }

  entangle(
    targets: readonly [string, string],
    state: EntangledState,
    observable?: ObservableName,
  ): this {
    this.steps.push({
      operation: 'entangle',
      targets,
      state,
      ...(observable === undefined ? {} : { observable }),
    });
    return this;
  }

  influence(
    name: string,
    parameters?: InfluenceStep['parameters'],
    targets?: readonly string[],
  ): this {
    this.steps.push({
      operation: 'influence',
      influence: name,
      ...(parameters === undefined ? {} : { parameters }),
      ...(targets === undefined ? {} : { targets }),
    });
    return this;
  }

  evolve(durationInSeconds: NumberOrParameter, targets?: readonly string[]): this {
    this.steps.push({
      operation: 'evolve',
      durationInSeconds,
      ...(targets === undefined ? {} : { targets }),
    });
    return this;
  }

  measure(
    target: string,
    observable: ObservableName,
    record: string,
    axis?: MeasurementAxis,
  ): this {
    this.steps.push({
      operation: 'measure',
      target,
      observable,
      record,
      ...(axis === undefined ? {} : { axis }),
    });
    return this;
  }

  combine(targets: readonly string[], label: string): this {
    this.steps.push({ operation: 'combine', targets, label });
    return this;
  }

  space(spec: SpaceSpec): this {
    this.spaceSpec = spec;
    return this;
  }

  collide(
    targets: readonly [string, string],
    record: string,
    channel?: string,
    minimumTransverseMomentumInGev?: NumberOrParameter,
  ): this {
    this.steps.push({
      operation: 'collide',
      targets,
      record,
      ...(channel === undefined ? {} : { channel }),
      ...(minimumTransverseMomentumInGev === undefined ? {} : { minimumTransverseMomentumInGev }),
    });
    return this;
  }

  place(
    target: string,
    centerInMeters: ParameterizableVector3,
    widthInMeters: NumberOrParameter,
    shape: WavepacketShape = 'gaussian',
  ): this {
    this.steps.push({ operation: 'place', target, centerInMeters, widthInMeters, shape });
    return this;
  }

  propagate(durationInSeconds: NumberOrParameter): this {
    this.steps.push({ operation: 'propagate', durationInSeconds });
    return this;
  }

  measurePosition(target: string, record: string): this {
    this.steps.push({ operation: 'measurePosition', target, record });
    return this;
  }

  createNucleus(
    label: string,
    protons: number,
    massNumber: number,
    options: { momentumInGev?: ParameterizableVector3; count?: NumberOrParameter } = {},
  ): this {
    this.steps.push({ operation: 'createNucleus', label, protons, massNumber, ...options });
    return this;
  }

  createAtom(
    label: string,
    protons: number,
    options: {
      massNumber?: number;
      charge?: number;
      spin?: SpinPreparation;
      momentumInGev?: ParameterizableVector3;
      count?: NumberOrParameter;
    } = {},
  ): this {
    this.steps.push({ operation: 'createAtom', label, protons, ...options });
    return this;
  }

  createMolecule(
    label: string,
    atoms: readonly MoleculeAtom[],
    bonds: readonly MoleculeBond[],
    options: { momentumInGev?: ParameterizableVector3; count?: NumberOrParameter } = {},
  ): this {
    this.steps.push({ operation: 'createMolecule', label, atoms, bonds, ...options });
    return this;
  }

  measureSystem(record: string): this {
    this.steps.push({ operation: 'measureSystem', record });
    return this;
  }

  decay(target: string, record?: string): this {
    this.steps.push({ operation: 'decay', target, ...(record === undefined ? {} : { record }) });
    return this;
  }

  report(
    statistic: ReportStatistic,
    records: readonly string[],
    label?: string,
    bins?: number,
    when?: ReportCondition,
  ): this {
    this.reports.push({
      statistic,
      records,
      ...(label === undefined ? {} : { label }),
      ...(bins === undefined ? {} : { bins }),
      ...(when === undefined ? {} : { when }),
    });
    return this;
  }

  diffract(
    target: string,
    geometry: {
      readonly slitSeparationInMeters: NumberOrParameter;
      readonly slitWidthInMeters: NumberOrParameter;
      readonly screenDistanceInMeters: NumberOrParameter;
      readonly whichPathDetector: NumberOrParameter;
      readonly pathMarker?: string;
    },
    record: string,
  ): this {
    this.steps.push({ operation: 'diffract', target, ...geometry, record });
    return this;
  }

  build(): ExperimentPlan {
    return {
      name: this.name,
      ...(this.descriptionText === undefined ? {} : { description: this.descriptionText }),
      ...(this.categoryList.length === 0 ? {} : { categories: [...this.categoryList] }),
      parameters: { ...this.parameters },
      shots: this.shotCount,
      ...(this.seedValue === undefined ? {} : { seed: this.seedValue }),
      ...(this.spaceSpec === undefined ? {} : { space: this.spaceSpec }),
      steps: [...this.steps],
      report: [...this.reports],
    };
  }
}

export function experiment(name: string): ExperimentBuilder {
  return new ExperimentBuilder(name);
}
