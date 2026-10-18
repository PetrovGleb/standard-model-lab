/* Shared quantum-number tables and helpers used by the particle catalog files. */
import type {
  ChiralValue,
  FlavorNumbers,
  LeptonFamilyNumbers,
  Quantity,
} from '@standard-model/contracts';
import { scaleQuantity } from '../quantity-scaling.js';

export const GEV_PER_MEV = 1e-3;

export const SPIN_ZERO = 0;
export const SPIN_HALF = 0.5;
export const SPIN_ONE = 1;

export const QUARK_BARYON_NUMBER = 1 / 3;

export const NO_LEPTON_NUMBERS: LeptonFamilyNumbers = { electron: 0, muon: 0, tau: 0 };
export const NO_FLAVOR_NUMBERS: FlavorNumbers = {
  strangeness: 0,
  charm: 0,
  bottomness: 0,
  topness: 0,
};

export const UP_TYPE_WEAK_ISOSPIN: ChiralValue = { leftHanded: 1 / 2, rightHanded: 0 };
export const UP_TYPE_HYPERCHARGE: ChiralValue = { leftHanded: 1 / 3, rightHanded: 4 / 3 };
export const DOWN_TYPE_WEAK_ISOSPIN: ChiralValue = { leftHanded: -1 / 2, rightHanded: 0 };
export const DOWN_TYPE_HYPERCHARGE: ChiralValue = { leftHanded: 1 / 3, rightHanded: -2 / 3 };
export const NEUTRINO_WEAK_ISOSPIN: ChiralValue = { leftHanded: 1 / 2, rightHanded: null };
export const NEUTRINO_HYPERCHARGE: ChiralValue = { leftHanded: -1, rightHanded: null };
export const CHARGED_LEPTON_WEAK_ISOSPIN: ChiralValue = { leftHanded: -1 / 2, rightHanded: 0 };
export const CHARGED_LEPTON_HYPERCHARGE: ChiralValue = { leftHanded: -1, rightHanded: -2 };

export function sameForBothChiralities(value: number): ChiralValue {
  return { leftHanded: value, rightHanded: value };
}

export function mevQuantityToGev(quantityInMev: Quantity): Quantity {
  return scaleQuantity(quantityInMev, GEV_PER_MEV, 'GeV');
}
