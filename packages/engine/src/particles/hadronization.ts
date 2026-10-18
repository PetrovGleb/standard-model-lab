/* Hadronization: colour confinement after the time ħ/Λ_QCD; quark triplets carrying net baryon number bind into the matching catalog baryon (mass from the gluon field), the closest in momentum first; the other colour triplets (quarks, antidiquarks) and antitriplets (antiquarks, diquarks) join into colour-singlet strings, lightest pair first, each gluon splits into a quark–antiquark pair inside the nearest string, and every string fragments into mesons and baryons; colour left without a partner leaves as a jet. */
import {
  PDG_2026,
  REDUCED_PLANCK_CONSTANT_IN_EV_SECOND,
  particleSpec,
} from '@standard-model/constants';
import type {
  ColorRepresentation,
  FourMomentumInGev,
  Particle,
  Vector3,
} from '@standard-model/contracts';
import { addVectors, EV_PER_GEV, invariantMassInGev, scaleVector } from '@standard-model/utils';
import type { QuantumCore } from '../quantum/quantum-core.js';
import { compositeFor, type Combinations } from './combinations.js';
import type { ParticleFactory } from './particle-factory.js';
import type {
  ColorString,
  FragmentHadron,
  StringEnd,
  StringFragmentation,
} from './string-fragmentation.js';

export const HADRONIZATION_TIME_IN_SECONDS =
  REDUCED_PLANCK_CONSTANT_IN_EV_SECOND.value /
  (PDG_2026.couplings.qcdScaleInGev.value * EV_PER_GEV);

const HALF = 0.5;
const BARYON_COLOR_ENDS = 3;

export interface BaryonFormation {
  readonly constituents: readonly Particle[];
  readonly hadron: Particle;
  readonly fieldEnergyInGev: number;
}

export interface StringHadronization {
  readonly partons: readonly Particle[];
  readonly hadrons: readonly Particle[];
  readonly stringMassInGev: number;
  readonly fieldEnergyInGev: number;
}

export interface HadronJet {
  readonly parton: Particle;
  readonly energyInGev: number;
}

export interface HadronizationResult {
  readonly baryons: readonly BaryonFormation[];
  readonly strings: readonly StringHadronization[];
  readonly jets: readonly HadronJet[];
}

interface Endpoint {
  readonly parton: Particle;
  readonly end: StringEnd;
}

interface PartonString {
  readonly quark: Endpoint;
  readonly antiquark: Endpoint;
}

function isColored(particle: Particle): boolean {
  return particle.spec.colorRepresentation !== 'singlet';
}

function colorExcess(partons: readonly Particle[]): number {
  return partons.reduce((total, parton) => {
    switch (parton.spec.colorRepresentation) {
      case 'triplet':
        return total + 1;
      case 'antitriplet':
        return total - 1;
      default:
        return total;
    }
  }, 0);
}

function triples<T>(items: readonly T[]): readonly (readonly [T, T, T])[] {
  return items.flatMap((first, firstIndex) =>
    items
      .slice(firstIndex + 1)
      .flatMap((second, secondIndex) =>
        items.slice(firstIndex + secondIndex + 2).map((third) => [first, second, third] as const),
      ),
  );
}

function sum(momenta: readonly FourMomentumInGev[]): FourMomentumInGev {
  return momenta.reduce((total, momentum) => ({
    energy: total.energy + momentum.energy,
    momentum: addVectors(total.momentum, momentum.momentum),
  }));
}

function pairMass(first: Endpoint, second: Endpoint): number {
  return invariantMassInGev(sum([first.end.fourMomentumInGev, second.end.fourMomentumInGev]));
}

function endpoint(parton: Particle): Endpoint {
  return {
    parton,
    end: { flavor: parton.spec.name, fourMomentumInGev: parton.kinematics.fourMomentumInGev },
  };
}

function midpoint(partons: readonly Particle[]): Vector3 {
  return scaleVector(
    partons.reduce((total, parton) => addVectors(total, parton.kinematics.positionInFemtometers), {
      x: 0,
      y: 0,
      z: 0,
    }),
    1 / partons.length,
  );
}

export class Hadronization {
  private readonly remnantGroups = new WeakMap<Particle, string>();

  constructor(
    private readonly combinations: Combinations,
    private readonly quantum: QuantumCore,
    private readonly particles: ParticleFactory,
    private readonly fragmentation: StringFragmentation,
  ) {}

  joinRemnant(particle: Particle, group: string): void {
    this.remnantGroups.set(particle, group);
  }

  coloredPartons(particles: readonly Particle[]): readonly Particle[] {
    return particles.filter((particle) => particle.status === 'alive' && isColored(particle));
  }

  hadronize(particles: readonly Particle[]): HadronizationResult {
    let free = [...this.coloredPartons(particles)];
    const baryons: BaryonFormation[] = [];
    for (;;) {
      const excess = colorExcess(free);
      if (Math.round(Math.abs(excess) / BARYON_COLOR_ENDS) === 0) {
        break;
      }
      const wanted: ColorRepresentation = excess > 0 ? 'triplet' : 'antitriplet';
      const candidates = triples(
        free.filter(
          (particle) =>
            particle.spec.family === 'quark' && particle.spec.colorRepresentation === wanted,
        ),
      )
        .filter((triple) => compositeFor(triple.map((particle) => particle.spec.name)) !== null)
        .map((triple) => ({
          triple,
          mass: invariantMassInGev(
            sum(triple.map((particle) => particle.kinematics.fourMomentumInGev)),
          ),
        }))
        .sort((first, second) => first.mass - second.mass);
      const formed = candidates.find(({ triple }) => this.bindable(triple));
      if (formed === undefined) {
        break;
      }
      const energyBefore = formed.triple.reduce(
        (total, particle) => total + particle.kinematics.fourMomentumInGev.energy,
        0,
      );
      const hadron = this.combinations.combine(formed.triple);
      baryons.push({
        constituents: formed.triple,
        hadron,
        fieldEnergyInGev: hadron.kinematics.fourMomentumInGev.energy - energyBefore,
      });
      free = free.filter((particle) => !formed.triple.includes(particle));
    }
    const { strings, unpaired } = this.connect(free);
    const fragmented: StringHadronization[] = [];
    const leftovers = [...unpaired];
    strings.forEach((string) => {
      const colorString: ColorString = { quark: string.quark.end, antiquark: string.antiquark.end };
      const fragments =
        this.fragmentation.fragment(colorString) ??
        [this.fragmentation.collapse(colorString)].filter(
          (hadron): hadron is FragmentHadron => hadron !== null,
        );
      const partons = [...new Set([string.quark.parton, string.antiquark.parton])];
      if (fragments.length === 0) {
        leftovers.push(...partons);
        return;
      }
      const position = midpoint(partons);
      const hadrons = fragments.map((fragment) =>
        this.particles.create(fragment.name, {
          momentumInGev: fragment.fourMomentumInGev.momentum,
          positionInFemtometers: position,
        }),
      );
      const total = sum([
        colorString.quark.fourMomentumInGev,
        colorString.antiquark.fourMomentumInGev,
      ]);
      fragmented.push({
        partons,
        hadrons,
        stringMassInGev: invariantMassInGev(total),
        fieldEnergyInGev:
          hadrons.reduce(
            (energy, hadron) => energy + hadron.kinematics.fourMomentumInGev.energy,
            0,
          ) - total.energy,
      });
    });
    const jets = [...new Set(leftovers)]
      .filter((parton) => !fragmented.some((string) => string.partons.includes(parton)))
      .map((parton) => ({ parton, energyInGev: parton.kinematics.fourMomentumInGev.energy }));
    new Set([
      ...fragmented.flatMap((string) => string.partons),
      ...jets.map((jet) => jet.parton),
    ]).forEach((parton) => {
      this.release(parton);
      parton.markBound();
    });
    return { baryons, strings: fragmented, jets };
  }

  private connect(partons: readonly Particle[]): {
    readonly strings: readonly PartonString[];
    readonly unpaired: readonly Particle[];
  } {
    const quarks = partons
      .filter((parton) => parton.spec.colorRepresentation === 'triplet')
      .map(endpoint);
    const antiquarks = partons
      .filter((parton) => parton.spec.colorRepresentation === 'antitriplet')
      .map(endpoint);
    const gluons = partons.filter((parton) => parton.spec.colorRepresentation === 'octet');
    const sameRemnant = (quark: Endpoint, antiquark: Endpoint): boolean => {
      const group = this.remnantGroups.get(quark.parton);
      return group !== undefined && group === this.remnantGroups.get(antiquark.parton);
    };
    const candidates = quarks
      .flatMap((quark) =>
        antiquarks
          .filter((antiquark) => !sameRemnant(quark, antiquark))
          .map((antiquark) => ({ quark, antiquark, mass: pairMass(quark, antiquark) })),
      )
      .sort((first, second) => first.mass - second.mass);
    let strings: PartonString[] = [];
    const used = new Set<Endpoint>();
    candidates.forEach(({ quark, antiquark }) => {
      if (!used.has(quark) && !used.has(antiquark)) {
        strings.push({ quark, antiquark });
        used.add(quark);
        used.add(antiquark);
      }
    });
    quarks
      .filter((quark) => !used.has(quark))
      .forEach((quark) => {
        const antiquark = antiquarks.find((candidate) => !used.has(candidate));
        if (antiquark === undefined) {
          return;
        }
        const index = strings.findIndex(
          (string) =>
            !sameRemnant(quark, string.antiquark) && !sameRemnant(string.quark, antiquark),
        );
        const partner = strings[index];
        if (partner === undefined || !sameRemnant(quark, antiquark)) {
          return;
        }
        strings.splice(
          index,
          1,
          { quark, antiquark: partner.antiquark },
          { quark: partner.quark, antiquark },
        );
        used.add(quark);
        used.add(antiquark);
      });
    const unpaired = [...quarks, ...antiquarks]
      .filter((end) => !used.has(end))
      .map((end) => end.parton);
    const halves = gluons.map((gluon) => this.split(gluon));
    if (strings.length === 0) {
      if (halves.length < 2) {
        return { strings, unpaired: [...unpaired, ...gluons] };
      }
      strings = halves.map((half, index) => ({
        quark: half.quark,
        antiquark: (halves[(index + 1) % halves.length] ?? half).antiquark,
      }));
      return { strings, unpaired };
    }
    halves.forEach((half) => {
      const cost = (string: PartonString): number =>
        pairMass(string.quark, half.antiquark) ** 2 + pairMass(half.quark, string.antiquark) ** 2;
      const nearest = strings.reduce((best, string) => (cost(string) < cost(best) ? string : best));
      strings = strings.flatMap((string) =>
        string === nearest
          ? [
              { quark: string.quark, antiquark: half.antiquark },
              { quark: half.quark, antiquark: string.antiquark },
            ]
          : [string],
      );
    });
    return { strings, unpaired };
  }

  private split(gluon: Particle): { readonly quark: Endpoint; readonly antiquark: Endpoint } {
    const flavor = this.fragmentation.sampleLightFlavor();
    const momentum = gluon.kinematics.fourMomentumInGev;
    const half: FourMomentumInGev = {
      energy: momentum.energy * HALF,
      momentum: scaleVector(momentum.momentum, HALF),
    };
    return {
      quark: { parton: gluon, end: { flavor, fourMomentumInGev: half } },
      antiquark: {
        parton: gluon,
        end: {
          flavor: particleSpec(flavor).antiparticleName,
          fourMomentumInGev: half,
        },
      },
    };
  }

  private bindable(triple: readonly Particle[]): boolean {
    return triple.every((particle) =>
      [...particle.quantumSlots.values()].every(
        (slot) => this.quantum.registers.byId(slot.registerId).slots.length === 1,
      ),
    );
  }

  private release(parton: Particle): void {
    [...parton.quantumSlots.values()].forEach((slot) => {
      const register = this.quantum.registers.byId(slot.registerId);
      if (register.slots.length === 1) {
        this.quantum.registers.dispose(register);
      }
    });
  }
}
