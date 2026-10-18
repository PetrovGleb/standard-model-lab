/* Decay of a nucleus while it sits in a medium: its spontaneous NUBASE channels at ln 2 / T½, capture of a continuum electron of the medium, whose rate is the laboratory electron-capture rate scaled by the electron density at the nucleus
   (Coulomb-enhanced thermal continuum over the K-shell density), and photodisintegration by the thermal photons of the medium at the REACLIB reverse rate. All become absorbing channels of the medium chain next to fusion. */
import {
  BOHR_RADIUS,
  BOLTZMANN_CONSTANT,
  ELECTRON_MASS,
  FINE_STRUCTURE_CONSTANT,
  SPEED_OF_LIGHT_IN_VACUUM,
  nuclideRecord,
  particleSpec,
} from '@standard-model/constants';
import type { MediumAspect, MediumComponent, ParticleName } from '@standard-model/contracts';
import { matterIdentity } from '@standard-model/constants';
import { isLepton } from './atomic-processes.js';
import { reaclibPhotodisintegrations } from './reaclib-rates.js';

const K_SHELL_ELECTRONS = 2;
const SLATER_K_SCREENING = 0.3;
const L_OVER_K_CAPTURE = 0.04;
const MAXWELL_QUADRATURE_POINTS = 64;
const MAXWELL_SPEED_SPAN_IN_SIGMAS = 6;
const ELECTRON_CAPTURE_MODES: ReadonlySet<string> = new Set(['EC']);

export interface DecayChannelInMedium {
  readonly nucleus: ParticleName;
  readonly products: readonly ParticleName[];
  readonly kind: 'spontaneous' | 'electronCapture' | 'photodisintegration';
  readonly ratePerSecond: number;
}

function laboratoryDecayRatePerSecond(nucleus: ParticleName): number {
  const identity = matterIdentity(nucleus);
  if (identity === null || identity.kind !== 'nucleus') {
    return 0;
  }
  const record = nuclideRecord(identity.protons, identity.massNumber);
  return record === null || record.halfLifeInSeconds === null
    ? 0
    : Math.LN2 / record.halfLifeInSeconds;
}

function electronCaptureFraction(nucleus: ParticleName): number {
  const identity = matterIdentity(nucleus);
  if (identity === null || identity.kind !== 'nucleus') {
    return 0;
  }
  const record = nuclideRecord(identity.protons, identity.massNumber);
  if (record === null) {
    return 0;
  }
  const known = record.decayModes.filter((mode) => mode.percent !== null);
  const total = known.reduce((sum, mode) => sum + (mode.percent ?? 0), 0);
  const capture = known
    .filter((mode) => ELECTRON_CAPTURE_MODES.has(mode.mode))
    .reduce((sum, mode) => sum + (mode.percent ?? 0), 0);
  return total > 0 ? capture / total : 0;
}

function coulombEnhancement(nuclearCharge: number, speedInMetersPerSecond: number): number {
  const sommerfeld =
    (nuclearCharge * FINE_STRUCTURE_CONSTANT.value * SPEED_OF_LIGHT_IN_VACUUM.value) /
    speedInMetersPerSecond;
  const argument = 2 * Math.PI * sommerfeld;
  return argument / -Math.expm1(-argument);
}

export function thermalCoulombEnhancement(
  nuclearCharge: number,
  temperatureInKelvin: number,
): number {
  const thermalSpeed = Math.sqrt(
    (BOLTZMANN_CONSTANT.value * temperatureInKelvin) / ELECTRON_MASS.value,
  );
  const step = (MAXWELL_SPEED_SPAN_IN_SIGMAS * thermalSpeed) / MAXWELL_QUADRATURE_POINTS;
  let weighted = 0;
  let weight = 0;
  for (let index = 0; index < MAXWELL_QUADRATURE_POINTS; index += 1) {
    const speed = (index + 1 / 2) * step;
    const density = speed * speed * Math.exp(-(speed * speed) / (2 * thermalSpeed * thermalSpeed));
    weighted += density * coulombEnhancement(nuclearCharge, speed);
    weight += density;
  }
  return weighted / weight;
}

export function kShellElectronDensityPerCubicMeter(nuclearCharge: number): number {
  const effectiveCharge = nuclearCharge - SLATER_K_SCREENING;
  return (
    ((K_SHELL_ELECTRONS * effectiveCharge ** 3) / (Math.PI * BOHR_RADIUS.value ** 3)) *
    (1 + L_OVER_K_CAPTURE)
  );
}

export function continuumElectronCaptureRatePerSecond(
  nucleus: ParticleName,
  electrons: MediumComponent,
  temperatureInKelvin: number,
): number {
  const fraction = electronCaptureFraction(nucleus);
  if (fraction === 0 || electrons.species !== 'electron' || !(temperatureInKelvin > 0)) {
    return 0;
  }
  const charge = particleSpec(nucleus).electricChargeInElementaryUnits;
  return (
    laboratoryDecayRatePerSecond(nucleus) *
    fraction *
    ((electrons.numberDensityPerCubicMeter *
      thermalCoulombEnhancement(charge, temperatureInKelvin)) /
      kShellElectronDensityPerCubicMeter(charge))
  );
}

export function decayChannelsInMedium(
  nucleus: ParticleName,
  medium: MediumAspect,
): readonly DecayChannelInMedium[] {
  const spec = particleSpec(nucleus);
  if (spec.family !== 'nucleus') {
    return [];
  }
  const spontaneousRate =
    laboratoryDecayRatePerSecond(nucleus) * (1 - electronCaptureFraction(nucleus));
  const spontaneous = spec.decays.flatMap((channel) =>
    channel.products.every(
      (product): product is ParticleName =>
        typeof product === 'string' && !['hadrons', 'invisible'].includes(product),
    )
      ? [
          {
            nucleus,
            products: channel.products as readonly ParticleName[],
            kind: 'spontaneous' as const,
            ratePerSecond: spontaneousRate * channel.branchingFraction.value,
          },
        ]
      : [],
  );
  const electrons = medium.components.find((component) => isLepton(component.species));
  const identity = matterIdentity(nucleus);
  const captured =
    electrons === undefined || identity === null || identity.kind !== 'nucleus'
      ? []
      : (() => {
          const rate = continuumElectronCaptureRatePerSecond(
            nucleus,
            electrons,
            medium.temperatureInKelvin,
          );
          const daughter = nuclideRecord(identity.protons - 1, identity.massNumber);
          return rate > 0 && daughter !== null
            ? [
                {
                  nucleus,
                  products: [
                    `nucleus:${String(identity.protons - 1)}:${String(identity.massNumber)}` as ParticleName,
                    'electronNeutrino' as ParticleName,
                  ],
                  kind: 'electronCapture' as const,
                  ratePerSecond: rate,
                },
              ]
            : [];
        })();
  const photodisintegrated = reaclibPhotodisintegrations(
    nucleus,
    medium.radiationTemperatureInKelvin ?? medium.temperatureInKelvin,
  ).map((entry) => ({
    nucleus,
    products: entry.products,
    kind: 'photodisintegration' as const,
    ratePerSecond: entry.ratePerSecond,
  }));
  return [...spontaneous, ...captured, ...photodisintegrated].filter(
    (channel) => channel.ratePerSecond > 0,
  );
}
