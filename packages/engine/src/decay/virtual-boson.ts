/* Decays into two heavy bosons below their threshold, such as H → W W* and H → Z Z*: one boson stays real, the other is virtual and leaves as a fermion pair; sub-channels and their shares come from the 1→3 tree widths of the Lagrangian. */
import { particleSpec } from '@standard-model/constants';
import type { ParticleName } from '@standard-model/contracts';
import { ProcessKinematics } from '../feynman/observables.js';
import { SHARED_PROCESS_CALCULATOR } from '../feynman/process-calculator.js';
import { fermionPairsWithCharge } from './spectator.js';

const QUADRATURE_NODES = 12;

export interface VirtualBosonResolution {
  readonly products: readonly [ParticleName, ParticleName, ParticleName];
  readonly widthInGev: number;
}

const resolutions = new Map<string, readonly VirtualBosonResolution[]>();

function isMassiveBoson(name: ParticleName): boolean {
  const spec = particleSpec(name);
  return spec.family === 'gaugeBoson' && spec.massInGev.value > 0;
}

export function virtualBosonResolutions(
  parent: ParticleName,
  pair: readonly ParticleName[],
): readonly VirtualBosonResolution[] {
  const key = `${parent}:${[...pair].sort().join('+')}`;
  const cached = resolutions.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const model = SHARED_PROCESS_CALCULATOR.model('fermiConstant');
  const kinematics = new ProcessKinematics(model);
  const parentMass = model.massOf(parent);
  const seen = new Set<string>();
  const options =
    pair.length !== 2
      ? []
      : pair.flatMap((virtual, index) => {
          const real = pair[1 - index];
          if (real === undefined || !isMassiveBoson(virtual)) {
            return [];
          }
          return fermionPairsWithCharge(
            particleSpec(virtual).electricChargeInElementaryUnits,
          ).flatMap(([first, second]): VirtualBosonResolution[] => {
            const products = [real, first, second] as const;
            const productKey = [...products].sort().join('+');
            if (
              seen.has(productKey) ||
              model.massOf(real) + model.massOf(first) + model.massOf(second) >= parentMass ||
              SHARED_PROCESS_CALCULATOR.diagrams(model, [parent], products).length === 0
            ) {
              return [];
            }
            seen.add(productKey);
            const widthInGev = kinematics.threeBodyWidth(parent, products, QUADRATURE_NODES);
            return widthInGev > 0 ? [{ products, widthInGev }] : [];
          });
        });
  resolutions.set(key, options);
  return options;
}
