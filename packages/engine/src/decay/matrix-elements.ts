/* Matrix-element weights on top of flat phase space: three-body decays of elementary particles are weighted by |M|² of their tree diagrams from the Lagrangian, normalised to the Dalitz maximum; explicit weights can still be registered. */
import { PARTICLE_CATALOG, particleSpec } from '@standard-model/constants';
import type { DecayProduct, ParticleName } from '@standard-model/contracts';
import { SHARED_PROCESS_CALCULATOR } from '../feynman/process-calculator.js';
import { ProcessKinematics } from '../feynman/observables.js';
import type { MatrixElementWeight } from './phase-space.js';

const MAXIMUM_SCAN_POINTS = 24;
const MAXIMUM_SAFETY = 1.2;

function channelKey(parent: ParticleName, products: readonly DecayProduct[]): string {
  return `${parent}:${products.join(',')}`;
}

function isElementary(product: DecayProduct): product is ParticleName {
  return product in PARTICLE_CATALOG && particleSpec(product as ParticleName).constituents === null;
}

export function amplitudeWeight(
  parent: ParticleName,
  products: readonly DecayProduct[],
): MatrixElementWeight | null {
  if (products.length !== 3 || !isElementary(parent) || !products.every(isElementary)) {
    return null;
  }
  const model = SHARED_PROCESS_CALCULATOR.model('fermiConstant');
  const triple = products as unknown as readonly [ParticleName, ParticleName, ParticleName];
  if (SHARED_PROCESS_CALCULATOR.diagrams(model, [parent], triple).length === 0) {
    return null;
  }
  const squared = new ProcessKinematics(model).threeBodySquared(parent, triple);
  const mass = model.massOf(parent);
  const [first, second, third] = triple.map((name) => model.massOf(name)) as [
    number,
    number,
    number,
  ];
  let maximum = 0;
  for (let row = 0; row <= MAXIMUM_SCAN_POINTS; row += 1) {
    const firstPair =
      (first + second) ** 2 +
      (((mass - third) ** 2 - (first + second) ** 2) * row) / MAXIMUM_SCAN_POINTS;
    for (let column = 0; column <= MAXIMUM_SCAN_POINTS; column += 1) {
      const secondPair =
        (second + third) ** 2 +
        (((mass - first) ** 2 - (second + third) ** 2) * column) / MAXIMUM_SCAN_POINTS;
      const value = squared(firstPair, secondPair);
      if (Number.isFinite(value)) {
        maximum = Math.max(maximum, value);
      }
    }
  }
  if (!(maximum > 0)) {
    return null;
  }
  const ceiling = maximum * MAXIMUM_SAFETY;
  return (energies, parentMass) => {
    const firstEnergy = energies[0] ?? 0;
    const thirdEnergy = energies[2] ?? 0;
    const firstPair = parentMass * parentMass + third * third - 2 * parentMass * thirdEnergy;
    const secondPair = parentMass * parentMass + first * first - 2 * parentMass * firstEnergy;
    return squared(firstPair, secondPair) / ceiling;
  };
}

export class MatrixElementRegistry {
  private readonly weights = new Map<string, MatrixElementWeight | null>();

  register(
    parent: ParticleName,
    products: readonly DecayProduct[],
    weight: MatrixElementWeight,
  ): this {
    this.weights.set(channelKey(parent, products), weight);
    return this;
  }

  lookup(parent: ParticleName, products: readonly DecayProduct[]): MatrixElementWeight | null {
    const key = channelKey(parent, products);
    if (!this.weights.has(key)) {
      this.weights.set(key, amplitudeWeight(parent, products));
    }
    return this.weights.get(key) ?? null;
  }
}

export function createDefaultMatrixElements(): MatrixElementRegistry {
  return new MatrixElementRegistry();
}
