/* Photon absorption cross sections: Verner 1996 shell fits for atoms and ions up to zinc and the Kramers hydrogenic law beyond, Klein–Nishina scattering on bound electrons, the zero-range Bethe–Peierls deuteron photodisintegration and the giant dipole resonance of heavier nuclei normalized by the TRK sum rule, with separation energies from AME2020 masses. */
import {
  BOHR_RADIUS,
  CLASSICAL_ELECTRON_RADIUS,
  ELECTRON_MASS_ENERGY_EQUIVALENT_IN_MEV,
  FINE_STRUCTURE_CONSTANT,
  MATTER_DATA,
  NEUTRON_MASS_ENERGY_EQUIVALENT_IN_MEV,
  PROTON_MASS_ENERGY_EQUIVALENT_IN_MEV,
  REDUCED_PLANCK_CONSTANT_TIMES_SPEED_OF_LIGHT_IN_MEV_FEMTOMETER,
  RYDBERG_CONSTANT_TIMES_PLANCK_CONSTANT_TIMES_SPEED_OF_LIGHT_IN_EV,
  atomName,
  nuclideRecord,
  restMassInGev,
} from '@standard-model/constants';

const SQUARE_METERS_PER_MEGABARN = 1e-22;
const SQUARE_METERS_PER_SQUARE_FEMTOMETER = 1e-30;
const EV_PER_MEV = 1e6;
const MEV_PER_GEV = 1e3;
const VERNER_MAXIMUM_PROTONS = 30;
const VERNER_SEVEN_SHELL_ELEMENTS = [20, 21, 22, 25, 26];
const VERNER_NO_INNER_EDGE_ELEMENTS = [15, 17, 19];
const VERNER_IRON = 26;
const VERNER_SEVEN_SHELLS = 7;
const VERNER_ARGON = 18;
const VERNER_EXPONENT_OFFSET = 5.5;
const UNREACHABLE_EDGE_IN_EV = 1e30;
const KRAMERS_PHOTOIONIZATION_FACTOR = 64 / (3 * Math.sqrt(3));
const THOMSON_LIMIT_PHOTON_RATIO = 1e-4;
const DEUTERON_PROTONS = 1;
const DEUTERON_MASS_NUMBER = 2;
const GIANT_DIPOLE_VOLUME_COEFFICIENT_IN_MEV = 31.2;
const GIANT_DIPOLE_SURFACE_COEFFICIENT_IN_MEV = 20.6;
const GIANT_DIPOLE_WIDTH_IN_MEV = 5;

function vernerShell(
  protons: number,
  electrons: number,
  shell: number,
  energyInEv: number,
): number {
  const tables = MATTER_DATA.photoionization;
  const inner = tables.innerShellFits[`${String(protons)}:${String(electrons)}:${String(shell)}`];
  if (inner === undefined) {
    return 0;
  }
  const [threshold = 0, scale = 1, peak = 0, shape = 1, power = 0, width = 0] = inner;
  if (energyInEv < threshold) {
    return 0;
  }
  let outer = tables.totalShellCount[electrons - 1] ?? 0;
  if (protons === electrons && protons > VERNER_ARGON) {
    outer = VERNER_SEVEN_SHELLS;
  }
  if (protons === electrons + 1 && VERNER_SEVEN_SHELL_ELEMENTS.includes(protons)) {
    outer = VERNER_SEVEN_SHELLS;
  }
  if (shell > outer) {
    return 0;
  }
  const innermost = tables.innerShellCount[electrons - 1] ?? 0;
  const innerEdge =
    VERNER_NO_INNER_EDGE_ELEMENTS.includes(protons) || (protons > 20 && protons !== VERNER_IRON)
      ? 0
      : electrons < 3
        ? UNREACHABLE_EDGE_IN_EV
        : (tables.innerShellFits[
            `${String(protons)}:${String(electrons)}:${String(innermost)}`
          ]?.[0] ?? 0);
  if (shell < outer && shell > innermost && energyInEv < innerEdge) {
    return 0;
  }
  if (shell <= innermost || energyInEv >= innerEdge) {
    const exponent = -power;
    const ratio = energyInEv / scale;
    const order =
      -0.5 * exponent -
      (tables.shellOrbitalQuantumNumbers[shell - 1] ?? 0) -
      VERNER_EXPONENT_OFFSET;
    return (
      peak *
      ((ratio - 1) ** 2 + width ** 2) *
      ratio ** order *
      (Math.sqrt(ratio / shape) + 1) ** exponent
    );
  }
  const outerFit = tables.outerShellFits[`${String(protons)}:${String(electrons)}`];
  if (outerFit === undefined) {
    return 0;
  }
  const [
    scaleOuter = 1,
    peakOuter = 0,
    shapeOuter = 1,
    powerOuter = 0,
    widthOuter = 0,
    offset = 0,
    smoothing = 0,
  ] = outerFit;
  const exponent = -powerOuter;
  const order = -0.5 * exponent - VERNER_EXPONENT_OFFSET;
  const shifted = energyInEv / scaleOuter - offset;
  const smooth = Math.sqrt(shifted * shifted + smoothing * smoothing);
  return (
    peakOuter *
    ((shifted - 1) ** 2 + widthOuter ** 2) *
    smooth ** order *
    (1 + Math.sqrt(smooth / shapeOuter)) ** exponent
  );
}

export function photoionizationCrossSectionInSquareMeters(
  protons: number,
  electrons: number,
  photonEnergyInEv: number,
  ionizationEnergyInEv: number,
): number {
  if (electrons < 1 || photonEnergyInEv < ionizationEnergyInEv) {
    return 0;
  }
  if (protons <= VERNER_MAXIMUM_PROTONS) {
    let total = 0;
    for (let shell = 1; shell <= VERNER_SEVEN_SHELLS; shell += 1) {
      total += vernerShell(protons, electrons, shell, photonEnergyInEv);
    }
    return total * SQUARE_METERS_PER_MEGABARN;
  }
  const rydberg = RYDBERG_CONSTANT_TIMES_PLANCK_CONSTANT_TIMES_SPEED_OF_LIGHT_IN_EV.value;
  return (
    KRAMERS_PHOTOIONIZATION_FACTOR *
    FINE_STRUCTURE_CONSTANT.value *
    BOHR_RADIUS.value ** 2 *
    (ionizationEnergyInEv / photonEnergyInEv) ** 3 *
    (rydberg / ionizationEnergyInEv)
  );
}

export function comptonCrossSectionInSquareMeters(photonEnergyInEv: number): number {
  const ratio = photonEnergyInEv / (ELECTRON_MASS_ENERGY_EQUIVALENT_IN_MEV.value * EV_PER_MEV);
  const thomson = (8 * Math.PI * CLASSICAL_ELECTRON_RADIUS.value ** 2) / 3;
  if (ratio < THOMSON_LIMIT_PHOTON_RATIO) {
    return thomson * (1 - 2 * ratio);
  }
  const doubled = 1 + 2 * ratio;
  const logarithm = Math.log(doubled);
  return (
    2 *
    Math.PI *
    CLASSICAL_ELECTRON_RADIUS.value ** 2 *
    (((1 + ratio) / ratio ** 2) * ((2 * (1 + ratio)) / doubled - logarithm / ratio) +
      logarithm / (2 * ratio) -
      (1 + 3 * ratio) / doubled ** 2)
  );
}

export type EmittedNucleon = 'neutron' | 'proton';

export function separationEnergyInMev(
  protons: number,
  massNumber: number,
  emitted: EmittedNucleon,
): number | null {
  const daughterProtons = emitted === 'proton' ? protons - 1 : protons;
  if (nuclideRecord(daughterProtons, massNumber - 1) === null || massNumber < 2) {
    return null;
  }
  const parent = restMassInGev(atomName(protons, massNumber, protons));
  const daughter = restMassInGev(atomName(daughterProtons, massNumber - 1, daughterProtons));
  const nucleon =
    emitted === 'proton'
      ? PROTON_MASS_ENERGY_EQUIVALENT_IN_MEV.value
      : NEUTRON_MASS_ENERGY_EQUIVALENT_IN_MEV.value;
  return (daughter - parent) * MEV_PER_GEV + nucleon;
}

export interface PhotonuclearChannel {
  readonly emitted: EmittedNucleon;
  readonly crossSectionInSquareMeters: number;
  readonly separationEnergyInMev: number;
}

export function photonuclearChannel(
  protons: number,
  massNumber: number,
  photonEnergyInEv: number,
): PhotonuclearChannel | null {
  const energy = photonEnergyInEv / EV_PER_MEV;
  const thresholds = (['neutron', 'proton'] as const)
    .map((emitted) => ({ emitted, threshold: separationEnergyInMev(protons, massNumber, emitted) }))
    .filter(
      (entry): entry is { emitted: EmittedNucleon; threshold: number } =>
        entry.threshold !== null && entry.threshold > 0 && energy > entry.threshold,
    )
    .sort((first, second) => first.threshold - second.threshold);
  const open = thresholds[0];
  if (open === undefined) {
    return null;
  }
  const hbarC = REDUCED_PLANCK_CONSTANT_TIMES_SPEED_OF_LIGHT_IN_MEV_FEMTOMETER.value;
  const nucleonMass = PROTON_MASS_ENERGY_EQUIVALENT_IN_MEV.value;
  if (protons === DEUTERON_PROTONS && massNumber === DEUTERON_MASS_NUMBER) {
    const binding = open.threshold;
    const squareFemtometers =
      (((8 * Math.PI) / 3) *
        FINE_STRUCTURE_CONSTANT.value *
        (hbarC ** 2 / nucleonMass) *
        (Math.sqrt(binding) * (energy - binding) ** 1.5)) /
      energy ** 3;
    return {
      emitted: open.emitted,
      crossSectionInSquareMeters: squareFemtometers * SQUARE_METERS_PER_SQUARE_FEMTOMETER,
      separationEnergyInMev: binding,
    };
  }
  const neutrons = massNumber - protons;
  const sumRule =
    ((2 * Math.PI ** 2 * FINE_STRUCTURE_CONSTANT.value * hbarC ** 2) / nucleonMass) *
    ((neutrons * protons) / massNumber);
  const resonance =
    GIANT_DIPOLE_VOLUME_COEFFICIENT_IN_MEV * massNumber ** (-1 / 3) +
    GIANT_DIPOLE_SURFACE_COEFFICIENT_IN_MEV * massNumber ** (-1 / 6);
  const peak = (2 * sumRule) / (Math.PI * GIANT_DIPOLE_WIDTH_IN_MEV);
  const squareFemtometers =
    peak /
    (1 + (energy ** 2 - resonance ** 2) ** 2 / (energy ** 2 * GIANT_DIPOLE_WIDTH_IN_MEV ** 2));
  return {
    emitted: open.emitted,
    crossSectionInSquareMeters: squareFemtometers * SQUARE_METERS_PER_SQUARE_FEMTOMETER,
    separationEnergyInMev: open.threshold,
  };
}
