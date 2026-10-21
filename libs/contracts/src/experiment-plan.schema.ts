/* ajv JSON Schema for ExperimentPlan, typed against the TypeScript types, and the compiled validator. */
import { Ajv, type JSONSchemaType } from 'ajv';
import {
  ENTANGLED_STATES,
  GRID_SIZES,
  POTENTIAL_KINDS,
  SPACE_WALLS,
  WAVEPACKET_SHAPES,
  REPORT_STATISTICS,
  SPIN_PREPARATIONS,
  TEMPLATE_CATEGORIES,
  BOND_ORDERS,
  type CreateAtomStep,
  type CreateMoleculeStep,
  type CreateNucleusStep,
  type CollideStep,
  type CombineStep,
  type MeasurePositionStep,
  type MeasureSystemStep,
  type PlaceStep,
  type PropagateStep,
  type SpaceSpec,
  type DiffractStep,
  type CreateStep,
  type DecayStep,
  type EntangleStep,
  type EvolveStep,
  type ExperimentPlan,
  type ExperimentStep,
  type InfluenceStep,
  type MeasurementAxis,
  type MeasureStep,
  type NumberOrParameter,
  type ParameterizableVector3,
  type ReportSpec,
} from './experiment-plan.js';
import { PARTICLE_NAMES } from './particle-spec.js';
import { OBSERVABLE_NAMES } from './quantum.js';

const PARAMETER_REFERENCE_PATTERN = '^\\{\\{[A-Za-z][A-Za-z0-9]*\\}\\}$';

const numberOrParameterSchema: JSONSchemaType<NumberOrParameter> = {
  type: ['number', 'string'],
  pattern: PARAMETER_REFERENCE_PATTERN,
};

const vector3Schema: JSONSchemaType<ParameterizableVector3> = {
  type: 'object',
  properties: {
    x: numberOrParameterSchema,
    y: numberOrParameterSchema,
    z: numberOrParameterSchema,
  },
  required: ['x', 'y', 'z'],
  additionalProperties: false,
};

const measurementAxisSchema: JSONSchemaType<MeasurementAxis> = {
  type: 'object',
  properties: {
    polarAngleDegrees: numberOrParameterSchema,
    azimuthDegrees: numberOrParameterSchema,
  },
  required: ['polarAngleDegrees', 'azimuthDegrees'],
  additionalProperties: false,
};

const stringListSchema = { type: 'array', items: { type: 'string' }, minItems: 1 } as const;

const createStepSchema: JSONSchemaType<CreateStep> = {
  type: 'object',
  properties: {
    operation: { type: 'string', const: 'create' },
    label: { type: 'string', minLength: 1 },
    particle: { type: 'string', enum: PARTICLE_NAMES },
    count: { ...numberOrParameterSchema, nullable: true },
    momentumInGev: { ...vector3Schema, nullable: true },
    positionInFemtometers: { ...vector3Schema, nullable: true },
    spin: { type: 'string', enum: SPIN_PREPARATIONS, nullable: true },
    spinDirection: {
      type: 'object',
      properties: {
        polarAngleDegrees: { type: 'number' },
        azimuthDegrees: { type: 'number' },
      },
      required: ['polarAngleDegrees', 'azimuthDegrees'],
      additionalProperties: false,
      nullable: true,
    },
  },
  required: ['operation', 'label', 'particle'],
  additionalProperties: false,
};

const createNucleusStepSchema: JSONSchemaType<CreateNucleusStep> = {
  type: 'object',
  properties: {
    operation: { type: 'string', const: 'createNucleus' },
    label: { type: 'string', minLength: 1 },
    protons: { type: 'integer', minimum: 0 },
    massNumber: { type: 'integer', minimum: 1 },
    count: { ...numberOrParameterSchema, nullable: true },
    momentumInGev: { ...vector3Schema, nullable: true },
    positionInFemtometers: { ...vector3Schema, nullable: true },
  },
  required: ['operation', 'label', 'protons', 'massNumber'],
  additionalProperties: false,
};

const createAtomStepSchema: JSONSchemaType<CreateAtomStep> = {
  type: 'object',
  properties: {
    operation: { type: 'string', const: 'createAtom' },
    label: { type: 'string', minLength: 1 },
    protons: { type: 'integer', minimum: 1 },
    massNumber: { type: 'integer', minimum: 1, nullable: true },
    charge: { type: 'integer', minimum: 0, nullable: true },
    count: { ...numberOrParameterSchema, nullable: true },
    momentumInGev: { ...vector3Schema, nullable: true },
    positionInFemtometers: { ...vector3Schema, nullable: true },
    spin: { type: 'string', enum: SPIN_PREPARATIONS, nullable: true },
  },
  required: ['operation', 'label', 'protons'],
  additionalProperties: false,
};

const createMoleculeStepSchema: JSONSchemaType<CreateMoleculeStep> = {
  type: 'object',
  properties: {
    operation: { type: 'string', const: 'createMolecule' },
    label: { type: 'string', minLength: 1 },
    atoms: {
      type: 'array',
      minItems: 2,
      items: {
        type: 'object',
        properties: {
          protons: { type: 'integer', minimum: 1 },
          massNumber: { type: 'integer', minimum: 1, nullable: true },
        },
        required: ['protons'],
        additionalProperties: false,
      },
    },
    bonds: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        properties: {
          first: { type: 'integer', minimum: 0 },
          second: { type: 'integer', minimum: 0 },
          order: { type: 'integer', enum: BOND_ORDERS },
        },
        required: ['first', 'second', 'order'],
        additionalProperties: false,
      },
    },
    charges: {
      type: 'array',
      nullable: true,
      items: {
        type: 'object',
        properties: {
          atom: { type: 'integer', minimum: 0 },
          charge: { type: 'integer' },
        },
        required: ['atom', 'charge'],
        additionalProperties: false,
      },
    },
    count: { ...numberOrParameterSchema, nullable: true },
    momentumInGev: { ...vector3Schema, nullable: true },
    positionInFemtometers: { ...vector3Schema, nullable: true },
  },
  required: ['operation', 'label', 'atoms', 'bonds'],
  additionalProperties: false,
};

const entangleStepSchema: JSONSchemaType<EntangleStep> = {
  type: 'object',
  properties: {
    operation: { type: 'string', const: 'entangle' },
    targets: { ...stringListSchema, minItems: 2 },
    state: { type: 'string', enum: ENTANGLED_STATES },
    amplitudes: {
      type: 'object',
      properties: {
        real: { type: 'array', items: { type: 'number' } },
        imaginary: { type: 'array', items: { type: 'number' } },
      },
      required: ['real', 'imaginary'],
      additionalProperties: false,
      nullable: true,
    },
    observable: { type: 'string', enum: OBSERVABLE_NAMES, nullable: true },
  },
  required: ['operation', 'targets', 'state'],
  additionalProperties: false,
};

const influenceScalarSchema = { type: ['number', 'string', 'boolean'] } as const;

const influenceStepSchema: JSONSchemaType<InfluenceStep> = {
  type: 'object',
  properties: {
    operation: { type: 'string', const: 'influence' },
    influence: { type: 'string', minLength: 1 },
    targets: { ...stringListSchema, nullable: true },
    parameters: {
      type: 'object',
      additionalProperties: {
        anyOf: [
          influenceScalarSchema,
          {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: influenceScalarSchema,
              required: [],
            },
          },
        ],
      },
      required: [],
      nullable: true,
    },
  },
  required: ['operation', 'influence'],
  additionalProperties: false,
};

const evolveStepSchema: JSONSchemaType<EvolveStep> = {
  type: 'object',
  properties: {
    operation: { type: 'string', const: 'evolve' },
    durationInSeconds: numberOrParameterSchema,
    targets: { ...stringListSchema, nullable: true },
  },
  required: ['operation', 'durationInSeconds'],
  additionalProperties: false,
};

const measureStepSchema: JSONSchemaType<MeasureStep> = {
  type: 'object',
  properties: {
    operation: { type: 'string', const: 'measure' },
    target: { type: 'string', minLength: 1 },
    observable: { type: 'string', enum: OBSERVABLE_NAMES },
    axis: { ...measurementAxisSchema, nullable: true },
    record: { type: 'string', minLength: 1 },
  },
  required: ['operation', 'target', 'observable', 'record'],
  additionalProperties: false,
};

const combineStepSchema: JSONSchemaType<CombineStep> = {
  type: 'object',
  properties: {
    operation: { type: 'string', const: 'combine' },
    targets: { ...stringListSchema, minItems: 2 },
    label: { type: 'string', minLength: 1 },
  },
  required: ['operation', 'targets', 'label'],
  additionalProperties: false,
};

const diffractStepSchema: JSONSchemaType<DiffractStep> = {
  type: 'object',
  properties: {
    operation: { type: 'string', const: 'diffract' },
    target: { type: 'string', minLength: 1 },
    slitSeparationInMeters: numberOrParameterSchema,
    slitWidthInMeters: numberOrParameterSchema,
    screenDistanceInMeters: numberOrParameterSchema,
    whichPathDetector: numberOrParameterSchema,
    pathMarker: { type: 'string', minLength: 1, nullable: true },
    record: { type: 'string', minLength: 1 },
  },
  required: [
    'operation',
    'target',
    'slitSeparationInMeters',
    'slitWidthInMeters',
    'screenDistanceInMeters',
    'whichPathDetector',
    'record',
  ],
  additionalProperties: false,
};

const collideStepSchema: JSONSchemaType<CollideStep> = {
  type: 'object',
  properties: {
    operation: { type: 'string', const: 'collide' },
    targets: { ...stringListSchema, minItems: 2, maxItems: 2 },
    record: { type: 'string', minLength: 1 },
    channel: { type: 'string', minLength: 1, nullable: true },
    minimumTransverseMomentumInGev: { ...numberOrParameterSchema, nullable: true },
  },
  required: ['operation', 'targets', 'record'],
  additionalProperties: false,
};

const placeStepSchema: JSONSchemaType<PlaceStep> = {
  type: 'object',
  properties: {
    operation: { type: 'string', const: 'place' },
    target: { type: 'string', minLength: 1 },
    centerInMeters: vector3Schema,
    widthInMeters: numberOrParameterSchema,
    shape: { type: 'string', enum: WAVEPACKET_SHAPES },
  },
  required: ['operation', 'target', 'centerInMeters', 'widthInMeters', 'shape'],
  additionalProperties: false,
};

const propagateStepSchema: JSONSchemaType<PropagateStep> = {
  type: 'object',
  properties: {
    operation: { type: 'string', const: 'propagate' },
    durationInSeconds: numberOrParameterSchema,
  },
  required: ['operation', 'durationInSeconds'],
  additionalProperties: false,
};

const measurePositionStepSchema: JSONSchemaType<MeasurePositionStep> = {
  type: 'object',
  properties: {
    operation: { type: 'string', const: 'measurePosition' },
    target: { type: 'string', minLength: 1 },
    record: { type: 'string', minLength: 1 },
  },
  required: ['operation', 'target', 'record'],
  additionalProperties: false,
};

const measureSystemStepSchema: JSONSchemaType<MeasureSystemStep> = {
  type: 'object',
  properties: {
    operation: { type: 'string', const: 'measureSystem' },
    record: { type: 'string', minLength: 1 },
  },
  required: ['operation', 'record'],
  additionalProperties: false,
};

const spaceSchema: JSONSchemaType<SpaceSpec> = {
  type: 'object',
  properties: {
    gridPointsPerAxis: { type: 'integer', enum: GRID_SIZES },
    cellSizeInMeters: numberOrParameterSchema,
    potential: { type: 'string', enum: POTENTIAL_KINDS },
    potentialEnergyInEv: { ...numberOrParameterSchema, nullable: true },
    barrierThicknessInMeters: { ...numberOrParameterSchema, nullable: true },
    nuclearCharge: { ...numberOrParameterSchema, nullable: true },
    slitSeparationInMeters: { ...numberOrParameterSchema, nullable: true },
    slitWidthInMeters: { ...numberOrParameterSchema, nullable: true },
    wellSeparationInMeters: { ...numberOrParameterSchema, nullable: true },
    boxSizeInMeters: { ...numberOrParameterSchema, nullable: true },
    walls: { type: 'string', enum: SPACE_WALLS, nullable: true },
  },
  required: ['gridPointsPerAxis', 'cellSizeInMeters', 'potential'],
  additionalProperties: false,
};

const decayStepSchema: JSONSchemaType<DecayStep> = {
  type: 'object',
  properties: {
    operation: { type: 'string', const: 'decay' },
    target: { type: 'string', minLength: 1 },
    record: { type: 'string', minLength: 1, nullable: true },
  },
  required: ['operation', 'target'],
  additionalProperties: false,
};

const experimentStepSchema: JSONSchemaType<ExperimentStep> = {
  type: 'object',
  discriminator: { propertyName: 'operation' },
  required: ['operation'],
  oneOf: [
    createStepSchema,
    createNucleusStepSchema,
    createAtomStepSchema,
    createMoleculeStepSchema,
    entangleStepSchema,
    influenceStepSchema,
    evolveStepSchema,
    measureStepSchema,
    combineStepSchema,
    diffractStepSchema,
    collideStepSchema,
    placeStepSchema,
    propagateStepSchema,
    measurePositionStepSchema,
    measureSystemStepSchema,
    decayStepSchema,
  ],
};

const reportSpecSchema: JSONSchemaType<ReportSpec> = {
  type: 'object',
  properties: {
    statistic: { type: 'string', enum: REPORT_STATISTICS },
    records: stringListSchema,
    when: {
      type: 'object',
      properties: {
        record: { type: 'string', minLength: 1 },
        equals: { type: 'number' },
      },
      required: ['record', 'equals'],
      additionalProperties: false,
      nullable: true,
    },
    label: { type: 'string', nullable: true },
    bins: { type: 'integer', minimum: 2, maximum: 200, nullable: true },
  },
  required: ['statistic', 'records'],
  additionalProperties: false,
};

export const experimentPlanSchema: JSONSchemaType<ExperimentPlan> = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    description: { type: 'string', nullable: true },
    categories: {
      type: 'array',
      items: { type: 'string', enum: TEMPLATE_CATEGORIES },
      uniqueItems: true,
      nullable: true,
    },
    parameters: { type: 'object', additionalProperties: { type: 'number' }, required: [] },
    shots: { type: 'integer', minimum: 1 },
    seed: { type: 'integer', nullable: true },
    space: { ...spaceSchema, nullable: true },
    steps: { type: 'array', items: experimentStepSchema, minItems: 1 },
    report: { type: 'array', items: reportSpecSchema },
  },
  required: ['name', 'parameters', 'shots', 'steps', 'report'],
  additionalProperties: false,
};

const ajv = new Ajv({ allErrors: true, discriminator: true, strictTypes: false });

export const validateExperimentPlan = ajv.compile<ExperimentPlan>(experimentPlanSchema);

export function describePlanErrors(): string {
  return ajv.errorsText(validateExperimentPlan.errors, { separator: '; ' });
}
