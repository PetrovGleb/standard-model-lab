/* Tree amplitudes by off-shell recursion over the derived vertices: currents of every subset of external legs are joined at three- and four-point vertices, with fermion signs from leg ordering; the same recursion lists the Feynman diagrams. */
import { particleSpec } from '@standard-model/constants';
import {
  localizedText,
  type DiagramLine,
  type DiagramView,
  type LocalizedText,
  type ParticleName,
} from '@standard-model/contracts';
import type { StandardModelParameters } from '../lagrangian/standard-model.js';
import type { Vertex } from '../lagrangian/vertices.js';
import {
  accumulate,
  chiralApply,
  complexPair,
  minkowskiProduct,
  pairMultiply,
  realFourVector,
  rowTimesColumn,
  scaleArray,
  slashColumn,
  slashRow,
  SPINOR_COMPONENTS,
  vectorCurrent,
  type ComplexPair,
} from './dirac.js';
import {
  columnPropagate,
  rowPropagate,
  scalarPropagate,
  vectorPropagate,
  type FourMomentum,
} from './external-states.js';

export type SpeciesKind = 'column' | 'row' | 'vector' | 'scalar';

export interface Species {
  readonly key: string;
  readonly particle: ParticleName;
  readonly color: number;
  readonly kind: SpeciesKind;
  readonly massInGev: number;
  readonly widthInGev: number;
}

interface VertexEntry {
  readonly vertex: Vertex;
  readonly childRoles: readonly number[];
  readonly missingRole: number;
  readonly output: string;
}

export interface ExternalLeg {
  readonly species: Species;
  readonly momentum: FourMomentum;
  readonly wave: Float64Array;
}

const VECTOR_SIZE = 2 * SPINOR_COMPONENTS;
const MAXIMUM_DIAGRAMS = 400;

export function speciesKey(particle: ParticleName, color: number): string {
  return `${particle}#${String(color)}`;
}

function kindOf(particle: ParticleName): SpeciesKind {
  const spec = particleSpec(particle);
  if (spec.statistics === 'fermiDirac') {
    return spec.pdgId > 0 ? 'column' : 'row';
  }
  return spec.spinInReducedPlanckUnits === 0 ? 'scalar' : 'vector';
}

function sumMomenta(momenta: readonly FourMomentum[]): FourMomentum {
  return momenta.reduce<FourMomentum>(
    (total, momentum) => [
      total[0] + momentum[0],
      total[1] + momentum[1],
      total[2] + momentum[2],
      total[3] + momentum[3],
    ],
    [0, 0, 0, 0],
  );
}

function negated(momentum: FourMomentum): FourMomentum {
  return [-momentum[0], -momentum[1], -momentum[2], -momentum[3]];
}

function difference(first: FourMomentum, second: FourMomentum): FourMomentum {
  return [first[0] - second[0], first[1] - second[1], first[2] - second[2], first[3] - second[3]];
}

function pair(value: { readonly real: number; readonly imaginary: number }): ComplexPair {
  return complexPair(value.real, value.imaginary);
}

function bits(mask: number): number[] {
  const result: number[] = [];
  for (let index = 0; mask >> index > 0; index += 1) {
    if ((mask >> index) & 1) {
      result.push(index);
    }
  }
  return result;
}

function popcount(mask: number): number {
  return bits(mask).length;
}

export class FeynmanModel {
  private readonly speciesByKey = new Map<string, Species>();
  private readonly index = new Map<string, VertexEntry[]>();
  private readonly particleIndex = new Map<
    string,
    { readonly vertex: Vertex; readonly missing: ParticleName }[]
  >();

  constructor(
    readonly parameters: StandardModelParameters,
    readonly vertices: readonly Vertex[],
  ) {
    vertices.forEach((vertex) => this.indexVertex(vertex));
  }

  species(particle: ParticleName, color = 0): Species {
    const key = speciesKey(particle, color);
    const existing = this.speciesByKey.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const created: Species = {
      key,
      particle,
      color,
      kind: kindOf(particle),
      massInGev: this.massOf(particle),
      widthInGev: this.parameters.widthsInGev[particle] ?? 0,
    };
    this.speciesByKey.set(key, created);
    return created;
  }

  anti(species: Species): Species {
    return this.species(particleSpec(species.particle).antiparticleName, species.color);
  }

  massOf(particle: ParticleName): number {
    switch (particle) {
      case 'wPlus':
      case 'wMinus':
        return this.parameters.wMassInGev;
      case 'zBoson':
        return this.parameters.zMassInGev;
      case 'higgsBoson':
        return this.parameters.higgsMassInGev;
      default:
        return this.parameters.massesInGev[particle] ?? 0;
    }
  }

  entries(childKeys: readonly string[]): readonly VertexEntry[] {
    return this.index.get(childKeys.join('|')) ?? [];
  }

  particleEntries(childParticles: readonly ParticleName[]) {
    return this.particleIndex.get([...childParticles].sort().join('|')) ?? [];
  }

  private indexVertex(vertex: Vertex): void {
    const keys = vertex.legs.map((leg) => this.species(leg.particle, leg.color).key);
    const seen = new Set<string>();
    keys.forEach((missingKey, missingRole) => {
      const children = keys
        .map((key, role) => ({ key, role }))
        .filter((entry) => entry.role !== missingRole)
        .sort((first, second) => first.key.localeCompare(second.key));
      const childKey = children.map((child) => child.key).join('|');
      if (seen.has(`${childKey}>${missingKey}`)) {
        return;
      }
      seen.add(`${childKey}>${missingKey}`);
      const missingLeg = vertex.legs[missingRole];
      if (missingLeg === undefined) {
        return;
      }
      const output = this.anti(this.species(missingLeg.particle, missingLeg.color)).key;
      const list = this.index.get(childKey) ?? [];
      list.push({ vertex, childRoles: children.map((child) => child.role), missingRole, output });
      this.index.set(childKey, list);
      const particleChildren = children
        .map((child) => vertex.legs[child.role]?.particle as ParticleName)
        .sort()
        .join('|');
      const particleList = this.particleIndex.get(particleChildren) ?? [];
      const missingParticle = particleSpec(missingLeg.particle).antiparticleName;
      if (
        !particleList.some(
          (entry) =>
            entry.missing === missingParticle && entry.vertex.structure === vertex.structure,
        )
      ) {
        particleList.push({ vertex, missing: missingParticle });
        this.particleIndex.set(particleChildren, particleList);
      }
    });
  }
}

function fermionInversions(parts: readonly number[], fermionMask: number): number {
  let count = 0;
  parts.forEach((first, firstIndex) => {
    parts.slice(firstIndex + 1).forEach((second) => {
      bits(first & fermionMask).forEach((left) => {
        bits(second & fermionMask).forEach((right) => {
          if (left > right) {
            count += 1;
          }
        });
      });
    });
  });
  return count;
}

function evaluateVertex(
  entry: VertexEntry,
  values: readonly (Float64Array | undefined)[],
  momenta: readonly FourMomentum[],
): Float64Array {
  const { vertex, missingRole } = entry;
  const factor = (index: number): ComplexPair =>
    pair(vertex.factors[index] ?? { real: 0, imaginary: 0 });
  const value = (role: number): Float64Array => values[role] ?? new Float64Array(VECTOR_SIZE);
  switch (vertex.structure) {
    case 'fermionFermionVector': {
      const left = factor(0);
      const right = vertex.factors.length > 1 ? factor(1) : left;
      if (missingRole === 2) {
        return vectorCurrent(value(0), chiralApply(value(1), left, right));
      }
      if (missingRole === 1) {
        return chiralApply(slashRow(value(0), value(2)), left, right);
      }
      return slashColumn(value(2), chiralApply(value(1), left, right));
    }
    case 'fermionFermionScalar': {
      const coupling = factor(0);
      if (missingRole === 2) {
        return pairMultiply(coupling, rowTimesColumn(value(0), value(1)));
      }
      const scalar = pairMultiply(coupling, value(2));
      return scaleArray(missingRole === 1 ? value(0) : value(1), scalar);
    }
    case 'tripleGauge': {
      const terms: readonly (readonly [number, number, number, FourMomentum])[] = [
        [0, 1, 2, difference(momenta[0] as FourMomentum, momenta[1] as FourMomentum)],
        [1, 2, 0, difference(momenta[1] as FourMomentum, momenta[2] as FourMomentum)],
        [2, 0, 1, difference(momenta[2] as FourMomentum, momenta[0] as FourMomentum)],
      ];
      const result = new Float64Array(VECTOR_SIZE);
      terms.forEach(([first, second, carrier, momentum]) => {
        const momentumVector = realFourVector(momentum);
        if (carrier === missingRole) {
          accumulate(
            result,
            scaleArray(momentumVector, minkowskiProduct(value(first), value(second))),
          );
        } else {
          const other = first === missingRole ? second : first;
          accumulate(
            result,
            scaleArray(value(other), minkowskiProduct(momentumVector, value(carrier))),
          );
        }
      });
      return scaleArray(result, factor(0));
    }
    case 'quarticGauge': {
      const pairings: readonly (readonly [number, number, number, number, number])[] = [
        [0, 1, 2, 3, 0],
        [0, 2, 1, 3, 1],
        [0, 3, 1, 2, 2],
      ];
      const result = new Float64Array(VECTOR_SIZE);
      pairings.forEach(([firstLeg, secondLeg, thirdLeg, fourthLeg, factorIndex]) => {
        const [partner, first, second] =
          firstLeg === missingRole
            ? [secondLeg, thirdLeg, fourthLeg]
            : secondLeg === missingRole
              ? [firstLeg, thirdLeg, fourthLeg]
              : thirdLeg === missingRole
                ? [fourthLeg, firstLeg, secondLeg]
                : [thirdLeg, firstLeg, secondLeg];
        accumulate(
          result,
          scaleArray(
            value(partner),
            pairMultiply(factor(factorIndex), minkowskiProduct(value(first), value(second))),
          ),
        );
      });
      return result;
    }
    case 'vectorVectorScalar': {
      if (missingRole === 2) {
        return pairMultiply(factor(0), minkowskiProduct(value(0), value(1)));
      }
      return scaleArray(value(missingRole === 0 ? 1 : 0), pairMultiply(factor(0), value(2)));
    }
    case 'vectorVectorScalarScalar': {
      if (missingRole >= 2) {
        const otherScalar = value(missingRole === 2 ? 3 : 2);
        return pairMultiply(
          factor(0),
          pairMultiply(minkowskiProduct(value(0), value(1)), otherScalar),
        );
      }
      return scaleArray(
        value(missingRole === 0 ? 1 : 0),
        pairMultiply(factor(0), pairMultiply(value(2), value(3))),
      );
    }
    case 'tripleScalar':
    case 'quarticScalar': {
      return [0, 1, 2, 3]
        .filter((role) => role !== missingRole && role < vertex.legs.length)
        .reduce((product, role) => pairMultiply(product, value(role)), factor(0));
    }
  }
}

function propagate(species: Species, value: Float64Array, momentum: FourMomentum): Float64Array {
  switch (species.kind) {
    case 'vector':
      return vectorPropagate(value, momentum, species.massInGev, species.widthInGev);
    case 'column':
      return columnPropagate(value, momentum, species.massInGev, species.widthInGev);
    case 'row':
      return rowPropagate(value, momentum, species.massInGev, species.widthInGev);
    case 'scalar':
      return scalarPropagate(value, momentum, species.massInGev, species.widthInGev);
  }
}

function contract(current: Float64Array, leg: ExternalLeg): ComplexPair {
  switch (leg.species.kind) {
    case 'column':
      return rowTimesColumn(current, leg.wave);
    case 'row':
      return rowTimesColumn(leg.wave, current);
    case 'vector':
      return minkowskiProduct(current, leg.wave);
    case 'scalar':
      return pairMultiply(current, leg.wave);
  }
}

function forEachSplit(mask: number, visit: (parts: readonly number[]) => void): void {
  const lowest = mask & -mask;
  for (let first = (mask - 1) & mask; first > 0; first = (first - 1) & mask) {
    if ((first & lowest) === 0) {
      continue;
    }
    const rest = mask ^ first;
    visit([first, rest]);
    const restLowest = rest & -rest;
    for (let second = (rest - 1) & rest; second > 0; second = (second - 1) & rest) {
      if ((second & restLowest) === 0) {
        continue;
      }
      visit([first, second, rest ^ second]);
    }
  }
}

interface SkeletonStep {
  readonly entry: VertexEntry;
  readonly children: readonly number[];
  readonly childMasks: readonly number[];
  readonly sign: number;
  readonly output: number;
}

interface SkeletonGroup {
  readonly mask: number;
  readonly steps: readonly SkeletonStep[];
  readonly slots: readonly number[];
}

interface Skeleton {
  readonly slotSpecies: readonly Species[];
  readonly groups: readonly SkeletonGroup[];
  readonly externalSlots: readonly number[];
  readonly finalSlot: number | null;
}

const skeletons = new WeakMap<FeynmanModel, Map<string, Skeleton>>();

function buildSkeleton(model: FeynmanModel, species: readonly Species[]): Skeleton {
  const last = species.length - 1;
  const full = (1 << last) - 1;
  const fermionMask = species.reduce(
    (mask, item, index) =>
      item.kind === 'column' || item.kind === 'row' ? mask | (1 << index) : mask,
    0,
  );
  const slotSpecies: Species[] = [];
  const slotsByMask = new Map<number, Map<string, number>>();
  const slotOf = (mask: number, item: Species): number => {
    const perMask = slotsByMask.get(mask) ?? new Map<string, number>();
    slotsByMask.set(mask, perMask);
    const existing = perMask.get(item.key);
    if (existing !== undefined) {
      return existing;
    }
    slotSpecies.push(item);
    perMask.set(item.key, slotSpecies.length - 1);
    return slotSpecies.length - 1;
  };
  const externalSlots = species.slice(0, last).map((item, index) => slotOf(1 << index, item));
  const groups: SkeletonGroup[] = [];
  for (let mask = 1; mask <= full; mask += 1) {
    if (popcount(mask) < 2) {
      continue;
    }
    const steps: SkeletonStep[] = [];
    forEachSplit(mask, (parts) => {
      const available = parts.map((part) => [...(slotsByMask.get(part)?.entries() ?? [])]);
      if (available.some((list) => list.length === 0)) {
        return;
      }
      const sign = fermionInversions(parts, fermionMask) % 2 === 0 ? 1 : -1;
      const choose = (
        depth: number,
        chosen: { key: string; slot: number; part: number }[],
      ): void => {
        if (depth === parts.length) {
          const ordered = chosen
            .map((item, position) => ({ ...item, position }))
            .sort((first, second) =>
              first.key < second.key
                ? -1
                : first.key > second.key
                  ? 1
                  : first.position - second.position,
            );
          const kinds = chosen.map((item) => slotSpecies[item.slot]?.kind);
          const closesLineBackwards =
            kinds.length === 2 && kinds[0] === 'column' && kinds[1] === 'row';
          model.entries(ordered.map((item) => item.key)).forEach((entry) => {
            const [particle, color] = entry.output.split('#');
            steps.push({
              entry,
              children: ordered.map((item) => item.slot),
              childMasks: ordered.map((item) => item.part),
              sign: closesLineBackwards ? -sign : sign,
              output: slotOf(mask, model.species(particle as ParticleName, Number(color))),
            });
          });
          return;
        }
        (available[depth] ?? []).forEach(([key, slot]) =>
          choose(depth + 1, [...chosen, { key, slot, part: parts[depth] ?? 0 }]),
        );
      };
      choose(0, []);
    });
    groups.push({ mask, steps, slots: [...(slotsByMask.get(mask)?.values() ?? [])] });
  }
  const lastSpecies = species[last];
  const finalSlot =
    lastSpecies === undefined
      ? null
      : (slotsByMask.get(full)?.get(model.anti(lastSpecies).key) ?? null);
  return { slotSpecies, groups, externalSlots, finalSlot };
}

function skeletonFor(model: FeynmanModel, legs: readonly ExternalLeg[]): Skeleton {
  const key = legs.map((leg) => leg.species.key).join(',');
  const cache = skeletons.get(model) ?? new Map<string, Skeleton>();
  skeletons.set(model, cache);
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const built = buildSkeleton(
    model,
    legs.map((leg) => leg.species),
  );
  cache.set(key, built);
  return built;
}

export function treeAmplitude(model: FeynmanModel, legs: readonly ExternalLeg[]): ComplexPair {
  const last = legs.length - 1;
  const lastLeg = legs[last];
  if (lastLeg === undefined) {
    return complexPair(0);
  }
  const skeleton = skeletonFor(model, legs);
  if (skeleton.finalSlot === null) {
    return complexPair(0);
  }
  const full = (1 << last) - 1;
  const values: (Float64Array | undefined)[] = new Array<Float64Array | undefined>(
    skeleton.slotSpecies.length,
  );
  const momenta: FourMomentum[] = new Array<FourMomentum>(full + 1);
  legs.slice(0, last).forEach((leg, index) => {
    values[skeleton.externalSlots[index] ?? 0] = leg.wave;
    momenta[1 << index] = leg.momentum;
  });
  skeleton.groups.forEach((group) => {
    const lowest = group.mask & -group.mask;
    const rest = group.mask ^ lowest;
    momenta[group.mask] = sumMomenta([
      momenta[lowest] ?? [0, 0, 0, 0],
      momenta[rest] ?? [0, 0, 0, 0],
    ]);
    const ownMomentum = momenta[group.mask] ?? [0, 0, 0, 0];
    group.steps.forEach((step) => {
      const legCount = step.entry.vertex.legs.length;
      const roleValues: (Float64Array | undefined)[] = new Array<Float64Array | undefined>(
        legCount,
      );
      const roleMomenta: FourMomentum[] = new Array<FourMomentum>(legCount);
      step.children.forEach((slot, position) => {
        const role = step.entry.childRoles[position] ?? 0;
        roleValues[role] = values[slot];
        roleMomenta[role] = momenta[step.childMasks[position] ?? 0] ?? [0, 0, 0, 0];
      });
      if (
        roleValues.some((value, role) => role !== step.entry.missingRole && value === undefined)
      ) {
        return;
      }
      roleMomenta[step.entry.missingRole] = negated(ownMomentum);
      const result = evaluateVertex(step.entry, roleValues, roleMomenta);
      const signed = step.sign === 1 ? result : scaleArray(result, complexPair(-1));
      const existing = values[step.output];
      if (existing === undefined) {
        values[step.output] = Float64Array.from(signed);
      } else {
        accumulate(existing, signed);
      }
    });
    if (group.mask !== full) {
      group.slots.forEach((slot) => {
        const value = values[slot];
        const species = skeleton.slotSpecies[slot];
        if (value !== undefined && species !== undefined) {
          values[slot] = propagate(species, value, ownMomentum);
        }
      });
    }
  });
  const target = values[skeleton.finalSlot];
  return target === undefined ? complexPair(0) : contract(target, lastLeg);
}

interface DiagramNode {
  readonly mask: number;
  readonly particle: ParticleName;
  readonly children: readonly DiagramNode[];
}

export function listDiagrams(
  model: FeynmanModel,
  particles: readonly ParticleName[],
  momentumLabels: readonly string[],
  incomingCount: number,
): readonly DiagramView[] {
  const last = particles.length - 1;
  const lastParticle = particles[last];
  if (lastParticle === undefined) {
    return [];
  }
  const full = (1 << last) - 1;
  const trees: Map<string, DiagramNode[]>[] = new Array<Map<string, DiagramNode[]>>(full + 1);
  particles.slice(0, last).forEach((particle, index) => {
    trees[1 << index] = new Map([[particle, [{ mask: 1 << index, particle, children: [] }]]]);
  });
  for (let mask = 1; mask <= full; mask += 1) {
    if (popcount(mask) < 2) {
      continue;
    }
    const nodes = new Map<string, DiagramNode[]>();
    forEachSplit(mask, (parts) => {
      const partTrees = parts.map((part) => trees[part]);
      if (partTrees.some((tree) => tree === undefined || tree.size === 0)) {
        return;
      }
      const choose = (depth: number, chosen: DiagramNode[][]): void => {
        if (depth === parts.length) {
          const childParticles = chosen.map((options) => options[0]?.particle as ParticleName);
          model.particleEntries(childParticles).forEach((entry) => {
            const combinations = chosen.reduce<DiagramNode[][]>(
              (accumulated, options) =>
                accumulated.flatMap((prefix) => options.map((option) => [...prefix, option])),
              [[]],
            );
            const list = nodes.get(entry.missing) ?? [];
            combinations
              .slice(0, MAXIMUM_DIAGRAMS)
              .forEach((children) => list.push({ mask, particle: entry.missing, children }));
            nodes.set(entry.missing, list);
          });
          return;
        }
        (partTrees[depth] ?? new Map<string, DiagramNode[]>()).forEach((options) =>
          choose(depth + 1, [...chosen, options]),
        );
      };
      choose(0, []);
    });
    trees[mask] = nodes;
  }
  const antiLast = particleSpec(lastParticle).antiparticleName;
  const roots = trees[full]?.get(antiLast) ?? [];
  const labelOf = (mask: number): string =>
    bits(mask)
      .map((index, position) => {
        const label = momentumLabels[index] ?? `p${String(index + 1)}`;
        const incoming = index < incomingCount;
        if (position === 0) {
          return incoming ? label : `−${label}`;
        }
        return ` ${incoming ? '+' : '−'} ${label}`;
      })
      .join('');
  const channelOf = (lines: readonly DiagramNode[]): LocalizedText => {
    if (incomingCount !== 2 || particles.length !== 4) {
      return lines.length === 0
        ? localizedText('контактная', 'contact')
        : localizedText(
            `${String(lines.length)} пропагатор(а)`,
            `${String(lines.length)} propagator${lines.length === 1 ? '' : 's'}`,
          );
    }
    const line = lines[0];
    if (line === undefined) {
      return localizedText('контактная', 'contact');
    }
    const indices = bits(line.mask);
    const withFirst = indices.includes(0) ? indices : bits(full ^ line.mask);
    if (withFirst.includes(1)) {
      return localizedText('s-канал', 's-channel');
    }
    return withFirst.includes(2)
      ? localizedText('t-канал', 't-channel')
      : localizedText('u-канал', 'u-channel');
  };
  const collect = (node: DiagramNode): { lines: DiagramNode[]; vertices: ParticleName[][] } => {
    if (node.children.length === 0) {
      return { lines: [], vertices: [] };
    }
    const nested = node.children.map(collect);
    return {
      lines: [...(node.mask === full ? [] : [node]), ...nested.flatMap((item) => item.lines)],
      vertices: [
        [
          ...node.children.map((child) => child.particle),
          particleSpec(node.particle).antiparticleName,
        ],
        ...nested.flatMap((item) => item.vertices),
      ],
    };
  };
  return roots.slice(0, MAXIMUM_DIAGRAMS).map((root) => {
    const { lines, vertices } = collect(root);
    return {
      channel: channelOf(lines),
      propagators: lines.map((line): DiagramLine => ({
        particle: line.particle,
        momentum: labelOf(line.mask),
      })),
      vertices,
    };
  });
}
