/* Bond rearrangement between a particle and a molecule of the medium: an atom with a free valence pulls an atom or group off the partner across one bond (A + B–C → A–B + C, either side may donate). The barrier
   comes from bond-energy–bond-order (Johnston and Parr 1963): Pauling orders n + m = 1, E = D n^p with p from the bond and the viscosity wells of the noble gases closing its atoms' periods, half a Sato triplet between the end atoms;
   the rate is transition-state theory, (kT/h)·Q‡/(Q_A Q_BC)·exp(−E‡/kT), with a collinear complex whose internal factor is shared by both directions, so forward over reverse equals K(T). */
import {
  AVOGADRO_CONSTANT,
  BOLTZMANN_CONSTANT,
  BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN,
  ELECTRON_VOLT,
  PLANCK_CONSTANT,
  REDUCED_PLANCK_CONSTANT,
  atomName,
  bondEnergyInEv,
  closingNobleGasWell,
  moleculeName,
  type MoleculeStructure,
  type UffAtomType,
} from '@standard-model/constants';
import type { MediumAspect, ParticleName } from '@standard-model/contracts';
import {
  bondingStructureOf,
  freeValences,
  joined,
  partitionFunctionPerCubicMeter,
  rotationalPartitionOf,
  signature,
  speciesMassInKilograms,
  translationalPartitionPerCubicMeter,
} from './molecular-association.js';
import { bondAttemptFrequencyInHertz } from './molecular-behaviour.js';
import {
  molecularStructure,
  restLength,
  uffBondStiffnessInKcalPerMolePerSquareAngstrom,
  validateMoleculeStructure,
} from './molecular-structure.js';

const PAULING_LENGTH_IN_ANGSTROM = 0.26;
const TRIPLET_SHARE = 0.5;
const SATO_SECOND_TERM = 0.5;
const SINGLE_BOND = 1;
const MAXIMUM_BOND_ORDER = 3;
const PATH_POINTS = 400;
const REFINEMENT_STEPS = 60;
const GOLDEN_SECTION = (Math.sqrt(5) - 1) / 2;
const SMALLEST_ORDER = 1e-9;
const SIXTH_ROOT_OF_TWO = 2 ** (1 / 6);
const JOULES_PER_KILOCALORIE = 4184;
const KILOCALORIE_PER_MOLE_IN_EV =
  JOULES_PER_KILOCALORIE / AVOGADRO_CONSTANT.value / ELECTRON_VOLT.value;
const METERS_PER_ANGSTROM = 1e-10;

export interface TransferChannel {
  readonly partner: ParticleName;
  readonly products: readonly [ParticleName, ParticleName];
  readonly ratePerSecond: number;
  readonly barrierInEv: number;
  readonly reactionEnergyInEv: number;
}

export interface TransferGeometry {
  readonly acceptor: ParticleName;
  readonly donor: ParticleName;
  readonly acceptorProduct: ParticleName;
  readonly donorRemainder: ParticleName;
  readonly transferred: ParticleName;
  readonly acceptorAtom: number;
  readonly brokenBond: number;
  readonly formedBond: number;
  readonly transferredAtomInDonor: number;
  readonly donorAtom: number;
  readonly pathDegeneracy: number;
}

interface BondSide {
  readonly energyInEv: number;
  readonly restLengthInAngstrom: number;
  readonly exponent: number;
}

export interface TransferBarrier {
  readonly barrierInEv: number;
  readonly reactionEnergyInEv: number;
  readonly formedLengthInAngstrom: number;
  readonly brokenLengthInAngstrom: number;
}

interface Fragment {
  readonly structure: MoleculeStructure;
  readonly indexOf: ReadonlyMap<number, number>;
}

function fragmentName(structure: MoleculeStructure): ParticleName {
  const [only] = structure.atoms;
  return structure.bonds.length === 0 && only !== undefined
    ? atomName(only.protons, only.massNumber, 0)
    : moleculeName(structure);
}

function split(
  structure: MoleculeStructure,
  bondIndex: number,
): readonly [Fragment, Fragment] | null {
  const cut = structure.bonds[bondIndex];
  if (cut === undefined) {
    return null;
  }
  const kept = structure.bonds.filter((unused, index) => index !== bondIndex);
  const reached = new Set<number>([cut.first]);
  const queue = [cut.first];
  while (queue.length > 0) {
    const atom = queue.pop() ?? cut.first;
    kept.forEach((bond) => {
      const other = bond.first === atom ? bond.second : bond.second === atom ? bond.first : null;
      if (other !== null && !reached.has(other)) {
        reached.add(other);
        queue.push(other);
      }
    });
  }
  if (reached.has(cut.second)) {
    return null;
  }
  const piece = (inside: (atom: number) => boolean): Fragment => {
    const members = structure.atoms.map((unused, index) => index).filter(inside);
    const indexOf = new Map(members.map((atom, position) => [atom, position]));
    return {
      structure: {
        atoms: members.map((atom) => structure.atoms[atom] ?? { protons: 0, massNumber: 0 }),
        bonds: kept
          .filter((bond) => inside(bond.first))
          .map((bond) => ({
            first: indexOf.get(bond.first) ?? 0,
            second: indexOf.get(bond.second) ?? 0,
            order: bond.order,
          })),
      },
      indexOf,
    };
  };
  return [piece((atom) => reached.has(atom)), piece((atom) => !reached.has(atom))];
}

function wellExponent(
  energyInEv: number,
  restLengthInAngstrom: number,
  firstProtons: number,
  secondProtons: number,
): number {
  const first = closingNobleGasWell(firstProtons);
  const second = closingNobleGasWell(secondProtons);
  const wellInEv =
    BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value *
    Math.sqrt(first.wellDepthInKelvin * second.wellDepthInKelvin);
  const wellLengthInAngstrom =
    (SIXTH_ROOT_OF_TWO * (first.sigmaInAngstrom + second.sigmaInAngstrom)) / 2;
  const wellOrder = Math.exp(
    -(wellLengthInAngstrom - restLengthInAngstrom) / PAULING_LENGTH_IN_ANGSTROM,
  );
  return Math.log(wellInEv / energyInEv) / Math.log(wellOrder);
}

function bondSide(structureName: ParticleName, bondIndex: number): BondSide {
  const structure = molecularStructure(structureName);
  const bond = structure.bonds[bondIndex];
  const first = structure.atoms[bond?.first ?? 0];
  const second = structure.atoms[bond?.second ?? 0];
  if (bond === undefined || first === undefined || second === undefined) {
    throw new Error(`No bond ${String(bondIndex)} in ${structureName}`);
  }
  return {
    energyInEv: bond.dissociationEnergyInEv,
    restLengthInAngstrom: bond.restLengthInAngstrom,
    exponent: wellExponent(
      bond.dissociationEnergyInEv,
      bond.restLengthInAngstrom,
      first.protons,
      second.protons,
    ),
  };
}

function tripletRepulsionInEv(
  endFirst: UffAtomType,
  endSecond: UffAtomType,
  endEnergyInEv: number,
  distanceInAngstrom: number,
): number {
  const equilibrium = restLength(endFirst, endSecond, SINGLE_BOND);
  const stiffnessInEvPerSquareAngstrom =
    uffBondStiffnessInKcalPerMolePerSquareAngstrom(endFirst, endSecond, equilibrium) *
    KILOCALORIE_PER_MOLE_IN_EV;
  const morse = Math.sqrt(stiffnessInEvPerSquareAngstrom / (2 * endEnergyInEv));
  const decay = Math.exp(-morse * (distanceInAngstrom - equilibrium));
  return TRIPLET_SHARE * endEnergyInEv * decay * (1 + SATO_SECOND_TERM * decay);
}

export function transferBarrier(geometry: TransferGeometry): TransferBarrier {
  const formed = bondSide(geometry.acceptorProduct, geometry.formedBond);
  const broken = bondSide(geometry.donor, geometry.brokenBond);
  const product = molecularStructure(geometry.acceptorProduct);
  const donor = molecularStructure(geometry.donor);
  const formedBond = product.bonds[geometry.formedBond];
  const acceptorInProduct =
    formedBond === undefined
      ? undefined
      : product.atoms[
          formedBond.first === geometry.acceptorAtom ? formedBond.first : formedBond.second
        ];
  const endFirst = acceptorInProduct?.atomType;
  const endSecondAtom = donor.atoms[geometry.donorAtom];
  if (endFirst === undefined || endSecondAtom === undefined || acceptorInProduct === undefined) {
    throw new Error('Transfer geometry is incomplete');
  }
  const endEnergyInEv = bondEnergyInEv(
    acceptorInProduct.protons,
    endSecondAtom.protons,
    SINGLE_BOND,
  );
  const energyAt = (order: number): number => {
    const formedOrder = Math.min(Math.max(order, SMALLEST_ORDER), 1 - SMALLEST_ORDER);
    const brokenOrder = 1 - formedOrder;
    const formedLength =
      formed.restLengthInAngstrom - PAULING_LENGTH_IN_ANGSTROM * Math.log(formedOrder);
    const brokenLength =
      broken.restLengthInAngstrom - PAULING_LENGTH_IN_ANGSTROM * Math.log(brokenOrder);
    return (
      broken.energyInEv * (1 - brokenOrder ** broken.exponent) -
      formed.energyInEv * formedOrder ** formed.exponent +
      tripletRepulsionInEv(
        endFirst,
        endSecondAtom.atomType,
        endEnergyInEv,
        formedLength + brokenLength,
      )
    );
  };
  let best = 0;
  for (let point = 1; point < PATH_POINTS; point += 1) {
    if (energyAt(point / PATH_POINTS) > energyAt(best / PATH_POINTS)) {
      best = point;
    }
  }
  let low = Math.max(best - 1, 0) / PATH_POINTS;
  let high = Math.min(best + 1, PATH_POINTS) / PATH_POINTS;
  for (let step = 0; step < REFINEMENT_STEPS; step += 1) {
    const left = high - GOLDEN_SECTION * (high - low);
    const right = low + GOLDEN_SECTION * (high - low);
    if (energyAt(left) > energyAt(right)) {
      high = right;
    } else {
      low = left;
    }
  }
  const saddle = (low + high) / 2;
  const reactionEnergyInEv = broken.energyInEv - formed.energyInEv;
  return {
    barrierInEv: Math.max(energyAt(saddle), reactionEnergyInEv, 0),
    reactionEnergyInEv,
    formedLengthInAngstrom:
      formed.restLengthInAngstrom - PAULING_LENGTH_IN_ANGSTROM * Math.log(saddle),
    brokenLengthInAngstrom:
      broken.restLengthInAngstrom - PAULING_LENGTH_IN_ANGSTROM * Math.log(1 - saddle),
  };
}

function vibrationalFactor(
  structureName: ParticleName,
  bondIndex: number,
  thermal: number,
): number {
  const quantum =
    2 *
    Math.PI *
    REDUCED_PLANCK_CONSTANT.value *
    bondAttemptFrequencyInHertz(molecularStructure(structureName), bondIndex);
  return 1 / -Math.expm1(-quantum / thermal);
}

function internalFactor(name: ParticleName, temperatureInKelvin: number): number {
  return (
    partitionFunctionPerCubicMeter(name, temperatureInKelvin) /
    (translationalPartitionPerCubicMeter(speciesMassInKilograms(name), temperatureInKelvin) *
      rotationalPartitionOf(name, temperatureInKelvin))
  );
}

export function transferRateConstantInCubicMetersPerSecond(
  geometry: TransferGeometry,
  temperatureInKelvin: number,
): { readonly rateConstant: number; readonly barrier: TransferBarrier } {
  const barrier = transferBarrier(geometry);
  const thermal = BOLTZMANN_CONSTANT.value * temperatureInKelvin;
  const acceptorMass = speciesMassInKilograms(geometry.acceptor);
  const transferredMass = speciesMassInKilograms(geometry.transferred);
  const remainderMass = speciesMassInKilograms(geometry.donorRemainder);
  const totalMass = acceptorMass + transferredMass + remainderMass;
  const positions = [
    0,
    barrier.formedLengthInAngstrom * METERS_PER_ANGSTROM,
    (barrier.formedLengthInAngstrom + barrier.brokenLengthInAngstrom) * METERS_PER_ANGSTROM,
  ];
  const masses = [acceptorMass, transferredMass, remainderMass];
  const center =
    masses.reduce((sum, mass, index) => sum + mass * (positions[index] ?? 0), 0) / totalMass;
  const moment = masses.reduce(
    (sum, mass, index) => sum + mass * ((positions[index] ?? 0) - center) ** 2,
    0,
  );
  const complexRotation = (2 * moment * thermal) / REDUCED_PLANCK_CONSTANT.value ** 2;
  const complexInternal = Math.sqrt(
    ((internalFactor(geometry.acceptor, temperatureInKelvin) *
      internalFactor(geometry.donor, temperatureInKelvin)) /
      vibrationalFactor(geometry.donor, geometry.brokenBond, thermal)) *
      ((internalFactor(geometry.acceptorProduct, temperatureInKelvin) *
        internalFactor(geometry.donorRemainder, temperatureInKelvin)) /
        vibrationalFactor(geometry.acceptorProduct, geometry.formedBond, thermal)),
  );
  const complex =
    translationalPartitionPerCubicMeter(totalMass, temperatureInKelvin) *
    complexRotation *
    complexInternal;
  const reactants =
    partitionFunctionPerCubicMeter(geometry.acceptor, temperatureInKelvin) *
    partitionFunctionPerCubicMeter(geometry.donor, temperatureInKelvin);
  return {
    rateConstant:
      geometry.pathDegeneracy *
      (thermal / PLANCK_CONSTANT.value) *
      (complex / reactants) *
      Math.exp(
        -barrier.barrierInEv / (BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * temperatureInKelvin),
      ),
    barrier,
  };
}

function formedBondIndex(product: ParticleName, first: number, second: number): number {
  return molecularStructure(product).bonds.findIndex(
    (bond) =>
      (bond.first === first && bond.second === second) ||
      (bond.first === second && bond.second === first),
  );
}

function canonicalBondIndex(
  name: ParticleName,
  structure: MoleculeStructure,
  index: number,
): number {
  const bond = structure.bonds[index];
  return bond === undefined ? -1 : formedBondIndex(name, bond.first, bond.second);
}

export function transferGeometries(
  acceptorName: ParticleName,
  donorName: ParticleName,
): readonly TransferGeometry[] {
  const acceptor = bondingStructureOf(acceptorName);
  const donor = bondingStructureOf(donorName);
  if (acceptor === null || donor === null || donor.bonds.length === 0) {
    return [];
  }
  const acceptorFree = freeValences(acceptor);
  const found = new Map<string, TransferGeometry>();
  donor.bonds.forEach((cut, bondIndex) => {
    const pieces = split(donor, bondIndex);
    if (pieces === null) {
      return;
    }
    [
      [cut.first, cut.second],
      [cut.second, cut.first],
    ].forEach(([transferredAtom = 0, donorAtom = 0]) => {
      const moving = pieces.find((piece) => piece.indexOf.has(transferredAtom));
      const remaining = pieces.find((piece) => piece.indexOf.has(donorAtom));
      const movingAtom = moving?.indexOf.get(transferredAtom);
      if (moving === undefined || remaining === undefined || movingAtom === undefined) {
        return;
      }
      const movingFree = freeValences(moving.structure)[movingAtom] ?? 0;
      acceptorFree.forEach((spare, acceptorAtom) => {
        if (spare < SINGLE_BOND) {
          return;
        }
        const order = Math.min(spare, movingFree, MAXIMUM_BOND_ORDER);
        const product = joined(acceptor, moving.structure, acceptorAtom, movingAtom, order);
        const key = `${signature(product)}|${signature(remaining.structure)}`;
        const known = found.get(key);
        if (known !== undefined) {
          found.set(key, { ...known, pathDegeneracy: known.pathDegeneracy + 1 });
          return;
        }
        if (validateMoleculeStructure(product) !== null) {
          return;
        }
        const acceptorProduct = moleculeName(product);
        const formedBond = formedBondIndex(
          acceptorProduct,
          acceptorAtom,
          movingAtom + acceptor.atoms.length,
        );
        const brokenBond = canonicalBondIndex(donorName, donor, bondIndex);
        if (formedBond >= 0 && brokenBond >= 0) {
          found.set(key, {
            acceptor: acceptorName,
            donor: donorName,
            acceptorProduct,
            donorRemainder: fragmentName(remaining.structure),
            transferred: fragmentName(moving.structure),
            acceptorAtom,
            brokenBond,
            formedBond,
            transferredAtomInDonor: transferredAtom,
            donorAtom,
            pathDegeneracy: 1,
          });
        }
      });
    });
  });
  return [...found.values()];
}

export function atomTransferChannels(
  name: ParticleName,
  medium: MediumAspect,
): readonly TransferChannel[] {
  const temperature = medium.temperatureInKelvin;
  if (!(temperature > 0) || bondingStructureOf(name) === null) {
    return [];
  }
  return medium.components.flatMap((component) => {
    const partner = component.species;
    const partnerStructure = bondingStructureOf(partner);
    if (
      partnerStructure === null ||
      partnerStructure.bonds.length === 0 ||
      !(component.numberDensityPerCubicMeter > 0)
    ) {
      return [];
    }
    const pulled = transferGeometries(name, partner).map((geometry) => ({
      geometry,
      products: [geometry.acceptorProduct, geometry.donorRemainder] as const,
    }));
    const given = transferGeometries(partner, name).map((geometry) => ({
      geometry,
      products: [geometry.donorRemainder, geometry.acceptorProduct] as const,
    }));
    return [...pulled, ...given].flatMap(({ geometry, products }) => {
      const { rateConstant, barrier } = transferRateConstantInCubicMetersPerSecond(
        geometry,
        temperature,
      );
      const ratePerSecond = rateConstant * component.numberDensityPerCubicMeter;
      return ratePerSecond > 0
        ? [
            {
              partner,
              products,
              ratePerSecond,
              barrierInEv: barrier.barrierInEv,
              reactionEnergyInEv: barrier.reactionEnergyInEv,
            },
          ]
        : [];
    });
  });
}
