/* Composition root of the simulation engine: wires random source, particles, quantum core, environment dynamics and influences. */
import { MolecularDynamics } from './molecules/molecular-dynamics.js';
import { SolutionChemistry } from './molecules/solution-chemistry.js';
import { Deconfinement } from './particles/deconfinement.js';
import type {
  CollapseStrategy,
  DecoherenceContributor,
  Environment,
  HamiltonianContributor,
  Particle,
  RandomSource,
} from '@standard-model/contracts';
import { createRandomSource, createSequentialIdGenerator } from '@standard-model/utils';
import {
  AtomicProcesses,
  Collisions,
  NuclearReactions,
  PairAnnihilation,
  PartonCollisions,
  MediumChargeBalance,
  MediumReactions,
  NeutronTransport,
  ThermalNuclearReactions,
} from './collisions/index.js';
import { createDefaultMatrixElements, Decays } from './decay/index.js';
import { DoubleSlit } from './diffraction/index.js';
import { SpaceLab } from './space/index.js';
import {
  CollisionalDecoherenceContributor,
  Dynamics,
  NeutrinoFlavorContributor,
  PhenomenologicalDecoherenceContributor,
  QuantumJumpDecoherence,
  ZeemanContributor,
} from './environment/index.js';
import {
  createDefaultInfluenceRegistry,
  InfluenceRegistry,
  type EngineInfluenceContext,
} from './influence/index.js';
import {
  Combinations,
  createDefaultParticleRegistry,
  Hadronization,
  ParticleFactory,
  StringFragmentation,
} from './particles/index.js';
import {
  Measurement,
  ProjectiveCollapse,
  QuantumCore,
  QuantumRegisterManager,
  type ComplexMatrix,
  type StateVector,
} from './quantum/index.js';

export * from './collisions/index.js';
export * from './feynman/index.js';
export * from './lagrangian/index.js';
export * from './decay/index.js';
export * from './diffraction/index.js';
export * from './space/index.js';
export * from './environment/index.js';
export * from './experiment/index.js';
export * from './templates/index.js';
export * from './influence/index.js';
export * from './particles/index.js';
export * from './quantum/index.js';
export * from './molecules/molecular-structure.js';
export * from './molecules/molecule-traits.js';
export * from './molecules/molecular-behaviour.js';
export * from './molecules/molecular-association.js';
export * from './molecules/atom-transfer.js';
export * from './molecules/solution-chemistry.js';
export * from './molecules/proton-transfer.js';
export * from './particles/deconfinement.js';
export { chemicalChain, type ChemicalOutcome } from './molecules/molecular-dynamics.js';
export * from './radiation/photon-absorption.js';

export interface EngineOptions {
  readonly seed: number;
  readonly collapse?: CollapseStrategy<StateVector>;
  readonly extraHamiltonianContributors?: readonly HamiltonianContributor<ComplexMatrix>[];
  readonly extraDecoherenceContributors?: readonly DecoherenceContributor[];
}

export interface Engine {
  readonly random: RandomSource;
  readonly particles: ParticleFactory;
  readonly quantum: QuantumCore;
  readonly dynamics: Dynamics;
  readonly decays: Decays;
  readonly combinations: Combinations;
  readonly hadronization: Hadronization;
  readonly fragmentation: StringFragmentation;
  readonly mediumReactions: MediumReactions;
  readonly neutronTransport: NeutronTransport;
  readonly molecules: MolecularDynamics;
  readonly solutions: SolutionChemistry;
  readonly deconfinement: Deconfinement;
  readonly doubleSlit: DoubleSlit;
  readonly collisions: Collisions;
  readonly space: SpaceLab;
  readonly annihilation: PairAnnihilation;
  readonly influences: InfluenceRegistry;
  contextFor(environment: Environment, particles: readonly Particle[]): EngineInfluenceContext;
}

export function createEngine(options: EngineOptions): Engine {
  const random = createRandomSource(options.seed);
  const ids = createSequentialIdGenerator();
  const collapse = options.collapse ?? new ProjectiveCollapse();
  const quantum = new QuantumCore(
    new QuantumRegisterManager(ids),
    new Measurement(collapse, random),
  );
  const dynamics = new Dynamics(
    quantum,
    [
      new ZeemanContributor(),
      new NeutrinoFlavorContributor(),
      ...(options.extraHamiltonianContributors ?? []),
    ],
    [
      new PhenomenologicalDecoherenceContributor(),
      new CollisionalDecoherenceContributor(),
      ...(options.extraDecoherenceContributors ?? []),
    ],
    new QuantumJumpDecoherence(random),
  );
  const particles = new ParticleFactory(createDefaultParticleRegistry(), ids);
  const combinations = new Combinations(particles, quantum, random);
  const space = new SpaceLab(random);
  const fragmentation = new StringFragmentation(random);
  const hadronization = new Hadronization(combinations, quantum, particles, fragmentation);
  const collisions = new Collisions(particles, quantum, random, [
    new AtomicProcesses(particles, random),
    new NuclearReactions(particles, random),
    new PartonCollisions(particles, random, hadronization),
  ]);
  return {
    random,
    particles,
    quantum,
    dynamics,
    decays: new Decays(
      particles,
      quantum,
      dynamics,
      random,
      createDefaultMatrixElements(),
      fragmentation,
    ),
    combinations,
    hadronization,
    fragmentation,
    mediumReactions: new MediumReactions(
      new ThermalNuclearReactions(particles, random),
      new MediumChargeBalance(particles, random),
      particles,
      random,
    ),
    neutronTransport: new NeutronTransport(particles, random),
    molecules: new MolecularDynamics(random),
    solutions: new SolutionChemistry(random),
    deconfinement: new Deconfinement(
      (name, momentumInGev, from) =>
        particles.create(name, {
          momentumInGev,
          positionInFemtometers: from.kinematics.positionInFemtometers,
        }),
      random,
    ),
    doubleSlit: new DoubleSlit(dynamics, random),
    collisions,
    space,
    annihilation: new PairAnnihilation(quantum, collisions, space, random),
    influences: createDefaultInfluenceRegistry(),
    contextFor(environment, present) {
      return {
        environment,
        random,
        particlesById: new Map(present.map((particle) => [particle.id, particle])),
        quantum,
        dynamics,
        particles,
      };
    },
  };
}
