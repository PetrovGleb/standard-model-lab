/* Ajv schema for process calculation requests: elementary particles in and out, energy, angular cut and coupling scheme. */
import { Ajv, type JSONSchemaType } from 'ajv';
import { COUPLING_SCHEMES, type ProcessRequest } from './lagrangian.js';
import { PARTICLE_NAMES } from './particle-spec.js';

const particleList = {
  type: 'array',
  items: { type: 'string', enum: PARTICLE_NAMES },
  minItems: 1,
  maxItems: 3,
} as const;

const processRequestSchema: JSONSchemaType<ProcessRequest> = {
  type: 'object',
  properties: {
    initial: { ...particleList, maxItems: 2 },
    final: { ...particleList, minItems: 2 },
    centerOfMassEnergyInGev: { type: 'number', exclusiveMinimum: 0, nullable: true },
    maximumAbsoluteCosine: { type: 'number', exclusiveMinimum: 0, maximum: 1, nullable: true },
    scheme: { type: 'string', enum: COUPLING_SCHEMES, nullable: true },
  },
  required: ['initial', 'final'],
  additionalProperties: false,
};

const ajv = new Ajv({ allErrors: true });

export const validateProcessRequest = ajv.compile<ProcessRequest>(processRequestSchema);

export function describeProcessRequestErrors(): string {
  return ajv.errorsText(validateProcessRequest.errors, { separator: '; ' });
}
