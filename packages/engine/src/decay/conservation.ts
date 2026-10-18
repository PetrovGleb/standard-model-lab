/* Additive quantum numbers of particle specs and the conservation check between a decaying parent and its products. */
import type {
  DecayChannel,
  DecayProduct,
  ParticleName,
  ParticleSpec,
} from '@standard-model/contracts';
import { INCLUSIVE_PRODUCTS } from '@standard-model/contracts';

export interface AdditiveQuantumNumbers {
  readonly electricCharge: number;
  readonly baryonNumber: number;
  readonly electronNumber: number;
  readonly muonNumber: number;
  readonly tauNumber: number;
}

const CONSERVATION_TOLERANCE = 1e-9;

export function additiveQuantumNumbers(spec: ParticleSpec): AdditiveQuantumNumbers {
  return {
    electricCharge: spec.electricChargeInElementaryUnits,
    baryonNumber: spec.baryonNumber,
    electronNumber: spec.leptonNumbers.electron,
    muonNumber: spec.leptonNumbers.muon,
    tauNumber: spec.leptonNumbers.tau,
  };
}

export function sumAdditiveQuantumNumbers(specs: readonly ParticleSpec[]): AdditiveQuantumNumbers {
  return specs.map(additiveQuantumNumbers).reduce(
    (total, numbers) => ({
      electricCharge: total.electricCharge + numbers.electricCharge,
      baryonNumber: total.baryonNumber + numbers.baryonNumber,
      electronNumber: total.electronNumber + numbers.electronNumber,
      muonNumber: total.muonNumber + numbers.muonNumber,
      tauNumber: total.tauNumber + numbers.tauNumber,
    }),
    { electricCharge: 0, baryonNumber: 0, electronNumber: 0, muonNumber: 0, tauNumber: 0 },
  );
}

export function conservationViolations(
  parent: ParticleSpec,
  products: readonly ParticleSpec[],
): readonly string[] {
  const before = additiveQuantumNumbers(parent);
  const after = sumAdditiveQuantumNumbers(products);
  return (Object.keys(before) as ReadonlyArray<keyof AdditiveQuantumNumbers>).filter(
    (key) => Math.abs(before[key] - after[key]) > CONSERVATION_TOLERANCE,
  );
}

export function isInclusiveProduct(product: DecayProduct): boolean {
  return (INCLUSIVE_PRODUCTS as readonly string[]).includes(product);
}

export function isExclusiveChannel(channel: DecayChannel): boolean {
  return channel.products.every((product) => !isInclusiveProduct(product));
}

export function exclusiveProductNames(channel: DecayChannel): readonly ParticleName[] {
  if (!isExclusiveChannel(channel)) {
    throw new Error('Channel contains inclusive products');
  }
  return channel.products as readonly ParticleName[];
}
