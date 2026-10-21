/* Icon vocabulary of the builder: one SML icon per operation, field kind, influence parameter and template category, plus a label component that shows them. */
import type { ExperimentStep, TemplateCategory } from '@standard-model/contracts';
import type { ReactNode } from 'react';
import { Diamond, FlaskConical, Swords, type LucideIcon } from 'lucide-react';
import { sml, type IconComponent } from './components/sml-icon';

const OPERATION_ICON_SIZE = 22;
const OPERATION_ICON_STROKE = 2.25;

function fromLucide(icon: LucideIcon): IconComponent {
  const Icon = icon;
  return ({ size, strokeWidth, className, x, y, ...aria }) => (
    <Icon size={size} strokeWidth={strokeWidth} className={className} x={x} y={y} {...aria} />
  );
}

export type OperationName = ExperimentStep['operation'];

export const TEMPLATE_CATEGORY_ICONS: Readonly<Record<TemplateCategory, IconComponent>> = {
  spin: sml('cat-spin'),
  interference: sml('cat-interference'),
  decays: sml('cat-decays'),
  neutrinos: sml('neutrino'),
  colliders: sml('cat-colliders'),
  confinement: sml('cat-confinement'),
  protons: sml('cat-protons'),
  space: sml('cat-space'),
  nuclear: sml('cat-nuclear'),
  atoms: sml('cat-atoms'),
  molecules: sml('cat-molecules'),
  radiation: sml('cat-radiation'),
  chemistry: fromLucide(FlaskConical),
};

export const OPERATION_ICONS: Readonly<Record<OperationName, IconComponent>> = {
  create: sml('create-particle'),
  createNucleus: sml('create-nucleus'),
  createAtom: sml('create-atom'),
  createMolecule: sml('create-molecule'),
  entangle: sml('entangle'),
  influence: sml('influence'),
  evolve: sml('evolve'),
  measure: sml('measure'),
  combine: sml('combine'),
  diffract: sml('diffract'),
  collide: fromLucide(Swords),
  place: sml('place'),
  propagate: sml('propagate'),
  measurePosition: sml('measure-position'),
  measureSystem: sml('measure-system'),
  keyframe: fromLucide(Diamond),
  decay: sml('decay'),
};

export const FIELD_ICONS = {
  label: sml('label'),
  count: sml('duplicate'),
  particleClass: sml('composite'),
  matter: sml('matter'),
  particle: sml('particle'),
  spin: sml('spin'),
  momentum: sml('momentum'),
  target: sml('position'),
  stateFamily: sml('superposition'),
  state: sml('entanglement'),
  observable: sml('measure'),
  category: sml('filter'),
  influence: sml('influence'),
  duration: sml('evolve'),
  angle: sml('angle'),
  record: sml('record'),
  element: sml('element'),
  isotope: sml('isotope'),
  massNumber: sml('mass-number'),
  charge: sml('electric-charge'),
  atom: sml('add-atom'),
  bond: sml('add-bond'),
  bondOrder: sml('bond-double'),
  search: sml('search'),
} as const satisfies Readonly<Record<string, IconComponent>>;

const PARAMETER_ICONS: readonly (readonly [(name: string) => boolean, IconComponent])[] = [
  [(name) => name.endsWith('InTesla'), sml('magnetic-field')],
  [(name) => name.endsWith('InVoltsPerMeter'), sml('electric-field')],
  [(name) => name.includes('Kelvin'), sml('temperature')],
  [(name) => name === 'durationInSeconds', sml('evolve')],
  [(name) => name.endsWith('TimeInSeconds'), sml('coherence-time')],
  [(name) => name === 'species' || name === 'numberDensityPerCubicMeter', sml('medium-gas')],
  [(name) => name === 'crossSectionInSquareMeters', sml('cross-section')],
  [(name) => name.endsWith('VelocityInMetersPerSecond'), sml('velocity')],
  [(name) => name.endsWith('Fraction'), sml('boost')],
  [(name) => name.endsWith('Degrees'), sml('angle')],
  [(name) => name === 'angleRadians', sml('rotate-spin')],
  [(name) => name === 'potentialEnergyInEv', sml('potential')],
  [(name) => name === 'nuclearCharge', sml('proton-count')],
  [(name) => name.startsWith('slit') || name === 'screenDistanceInMeters', sml('double-slit')],
  [(name) => name === 'distanceInKilometers', sml('travel')],
  [(name) => name.endsWith('InMeters'), sml('space-cube')],
  [(name) => name === 'frequencyInHertz', sml('frequency')],
  [(name) => name === 'powerInWatts', sml('power')],
  [(name) => name === 'beamAreaInSquareMeters', sml('beam')],
  [(name) => name === 'detuningInLinewidths', sml('detuning')],
  [(name) => name === 'saturationParameter', sml('intensity')],
];

export function parameterIcon(name: string): IconComponent {
  return PARAMETER_ICONS.find(([matches]) => matches(name))?.[1] ?? sml('parameter');
}

export function FieldLabel({
  icon,
  children,
}: {
  readonly icon: IconComponent;
  readonly children: ReactNode;
}) {
  const Icon = icon;
  return (
    <span className="field-label">
      <Icon aria-hidden="true" size={16} />
      {children}
    </span>
  );
}

export function OperationBadge({
  operation,
  size = OPERATION_ICON_SIZE,
}: {
  readonly operation: OperationName;
  readonly size?: number;
}) {
  const Icon = OPERATION_ICONS[operation];
  return (
    <span className={`op-badge op-${operation}`}>
      <Icon aria-hidden="true" size={size} strokeWidth={OPERATION_ICON_STROKE} />
    </span>
  );
}
