/* Charge conjugation of a ParticleSpec: builds the antiparticle by flipping every additive quantum number. */
import type {
  ChiralValue,
  ColorRepresentation,
  DecayProduct,
  ParticleName,
  ParticleSpec,
  Quantity,
} from '@standard-model/contracts';

function negate(value: number): number {
  return value === 0 ? 0 : -value;
}

function negateChiral(value: ChiralValue): ChiralValue {
  return {
    leftHanded: negate(value.leftHanded),
    rightHanded: value.rightHanded === null ? null : negate(value.rightHanded),
  };
}

function negateQuantity(quantity: Quantity | null): Quantity | null {
  return quantity === null ? null : { ...quantity, value: negate(quantity.value) };
}

function conjugateColor(representation: ColorRepresentation): ColorRepresentation {
  if (representation === 'triplet') {
    return 'antitriplet';
  }
  if (representation === 'antitriplet') {
    return 'triplet';
  }
  return representation;
}

function isFermion(spec: ParticleSpec): boolean {
  return spec.statistics === 'fermiDirac';
}

export type AntiparticleLookup = (product: DecayProduct) => DecayProduct;

export function conjugateParticleSpec(
  spec: ParticleSpec,
  antiparticleSymbol: string,
  antiparticleOf: AntiparticleLookup,
): ParticleSpec {
  return {
    ...spec,
    name: spec.antiparticleName,
    symbol: antiparticleSymbol,
    pdgId: -spec.pdgId,
    electricChargeInElementaryUnits: negate(spec.electricChargeInElementaryUnits),
    parity: spec.parity !== null && isFermion(spec) ? (negate(spec.parity) as 1 | -1) : spec.parity,
    colorRepresentation: conjugateColor(spec.colorRepresentation),
    baryonNumber: negate(spec.baryonNumber),
    leptonNumbers: {
      electron: negate(spec.leptonNumbers.electron),
      muon: negate(spec.leptonNumbers.muon),
      tau: negate(spec.leptonNumbers.tau),
    },
    isospin:
      spec.isospin === null
        ? null
        : { total: spec.isospin.total, thirdComponent: negate(spec.isospin.thirdComponent) },
    flavorNumbers: {
      strangeness: negate(spec.flavorNumbers.strangeness),
      charm: negate(spec.flavorNumbers.charm),
      bottomness: negate(spec.flavorNumbers.bottomness),
      topness: negate(spec.flavorNumbers.topness),
    },
    weakIsospinThirdComponent: negateChiral(spec.weakIsospinThirdComponent),
    weakHypercharge: negateChiral(spec.weakHypercharge),
    magneticMomentInJoulesPerTesla: negateQuantity(spec.magneticMomentInJoulesPerTesla),
    decays: spec.decays.map((channel) => ({
      ...channel,
      products: channel.products.map(antiparticleOf),
    })),
    antiparticleName: spec.name,
    isSelfConjugate: false,
    constituents:
      spec.constituents === null
        ? null
        : spec.constituents.map((constituent) => antiparticleOf(constituent) as ParticleName),
  };
}
