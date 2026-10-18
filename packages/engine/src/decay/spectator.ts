/* Spectator model of weak heavy-hadron decays: the heaviest quark decays through a virtual W at tree level while the other constituents watch; channels list the daughter quark, the two W products and the spectators, with shares from the 1→3 tree widths of the Lagrangian. */
import { particleSpec } from '@standard-model/constants';
import {
  PARTICLE_NAMES,
  type DecayChannel,
  type ParticleName,
  type ParticleSpec,
} from '@standard-model/contracts';
import { ProcessKinematics } from '../feynman/observables.js';
import { SHARED_PROCESS_CALCULATOR } from '../feynman/process-calculator.js';

const CONSERVATION_TOLERANCE = 1e-9;
const W_CHARGE_MAGNITUDE = 1;
const SPECTATOR_QUADRATURE_NODES = 12;
const FERMION_FAMILIES = new Set(['quark', 'chargedLepton', 'neutrino']);

interface QuarkDecay {
  readonly products: readonly [ParticleName, ParticleName, ParticleName];
  readonly widthInGev: number;
}

const quarkDecays = new Map<ParticleName, readonly QuarkDecay[]>();
const mesonChannels = new Map<ParticleName, readonly DecayChannel[]>();

function charge(name: ParticleName): number {
  return particleSpec(name).electricChargeInElementaryUnits;
}

function leptonNumbersVanish(names: readonly ParticleName[]): boolean {
  return (['electron', 'muon', 'tau'] as const).every(
    (flavor) =>
      Math.abs(names.reduce((sum, name) => sum + particleSpec(name).leptonNumbers[flavor], 0)) <
      CONSERVATION_TOLERANCE,
  );
}

const ELEMENTARY_FERMIONS = PARTICLE_NAMES.filter(
  (name) =>
    particleSpec(name).constituents === null && FERMION_FAMILIES.has(particleSpec(name).family),
);

export function fermionPairsWithCharge(
  totalCharge: number,
): readonly (readonly [ParticleName, ParticleName])[] {
  return ELEMENTARY_FERMIONS.flatMap((first, index) =>
    ELEMENTARY_FERMIONS.slice(index + 1).flatMap((second) =>
      Math.abs(charge(first) + charge(second) - totalCharge) < CONSERVATION_TOLERANCE &&
      Math.abs(particleSpec(first).baryonNumber + particleSpec(second).baryonNumber) <
        CONSERVATION_TOLERANCE &&
      leptonNumbersVanish([first, second])
        ? [[first, second] as const]
        : [],
    ),
  );
}

function anti(name: ParticleName): ParticleName {
  return particleSpec(name).antiparticleName;
}

function decaysOfQuark(heavy: ParticleName): readonly QuarkDecay[] {
  const cached = quarkDecays.get(heavy);
  if (cached !== undefined) {
    return cached;
  }
  if (particleSpec(heavy).pdgId < 0) {
    const conjugated = decaysOfQuark(anti(heavy)).map((decay) => ({
      products: decay.products.map(anti) as unknown as readonly [
        ParticleName,
        ParticleName,
        ParticleName,
      ],
      widthInGev: decay.widthInGev,
    }));
    quarkDecays.set(heavy, conjugated);
    return conjugated;
  }
  const model = SHARED_PROCESS_CALCULATOR.model('fermiConstant');
  const kinematics = new ProcessKinematics(model);
  const heavyMass = model.massOf(heavy);
  const daughters = ELEMENTARY_FERMIONS.filter(
    (name) =>
      particleSpec(name).family === 'quark' &&
      particleSpec(name).pdgId > 0 &&
      Math.abs(Math.abs(charge(heavy) - charge(name)) - W_CHARGE_MAGNITUDE) <
        CONSERVATION_TOLERANCE &&
      model.massOf(name) < heavyMass,
  );
  const decays = daughters.flatMap((daughter) =>
    fermionPairsWithCharge(charge(heavy) - charge(daughter)).flatMap(
      ([first, second]): QuarkDecay[] => {
        const products = [daughter, first, second] as const;
        if (
          model.massOf(daughter) + model.massOf(first) + model.massOf(second) >= heavyMass ||
          SHARED_PROCESS_CALCULATOR.diagrams(model, [heavy], products).length === 0
        ) {
          return [];
        }
        const widthInGev = kinematics.threeBodyWidth(heavy, products, SPECTATOR_QUADRATURE_NODES);
        return widthInGev > 0 ? [{ products, widthInGev }] : [];
      },
    ),
  );
  quarkDecays.set(heavy, decays);
  return decays;
}

export function heavyConstituents(spec: ParticleSpec): {
  readonly heavy: ParticleName;
  readonly spectators: readonly ParticleName[];
} | null {
  const constituents = spec.constituents ?? [];
  if (
    (spec.family !== 'meson' && spec.family !== 'baryon') ||
    constituents.length < 2 ||
    (spec.flavorNumbers.charm === 0 && spec.flavorNumbers.bottomness === 0)
  ) {
    return null;
  }
  const heavy = constituents.reduce((heaviest, name) =>
    particleSpec(name).massInGev.value > particleSpec(heaviest).massInGev.value ? name : heaviest,
  );
  const position = constituents.indexOf(heavy);
  return {
    heavy,
    spectators: constituents.filter((name, index) => index !== position),
  };
}

export function spectatorChannels(spec: ParticleSpec): readonly DecayChannel[] {
  const cached = mesonChannels.get(spec.name);
  if (cached !== undefined) {
    return cached;
  }
  const constituents = heavyConstituents(spec);
  const decays = constituents === null ? [] : decaysOfQuark(constituents.heavy);
  const totalWidth = decays.reduce((sum, decay) => sum + decay.widthInGev, 0);
  const channels: readonly DecayChannel[] =
    constituents === null || totalWidth === 0
      ? []
      : decays.map((decay) => ({
          products: [...decay.products, ...constituents.spectators],
          branchingFraction: {
            value: decay.widthInGev / totalWidth,
            uncertainty: null,
            exact: false,
            unit: '',
            source: 'derived',
            sourceName: `spectator model: ${decay.products.join(' ')} tree width share`,
          },
        }));
  mesonChannels.set(spec.name, channels);
  return channels;
}
