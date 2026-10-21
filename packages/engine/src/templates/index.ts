/* Barrel and registry of the built-in experiment templates. */
import type { ExperimentPlan, TemplateCategory } from '@standard-model/contracts';
import { CHSH_TEMPLATE } from './chsh.js';
import { CHEMISTRY_TEMPLATES } from './chemistry.js';
import { RADIATION_IN_MATTER_TEMPLATES } from './radiation-in-matter.js';
import { FISSION_TEMPLATES } from './fission.js';
import { CHERNOBYL_TEMPLATES } from './chernobyl.js';
import { QUARK_MATTER_TEMPLATES } from './quark-matter.js';
import {
  DEUTERON_PHOTODISINTEGRATION_TEMPLATE,
  HYDROGEN_THERMAL_DISSOCIATION_TEMPLATE,
  WATER_FROM_ATOMS_TEMPLATE,
  WATER_IN_HYDROGEN_BUBBLE_TEMPLATE,
  WATER_PHASES_TEMPLATE,
  CARBON_DIOXIDE_ON_PLANETS_TEMPLATE,
  RECOMBINATION_EPOCH_TEMPLATE,
  AMMONIA_FROM_ATOMS_TEMPLATE,
  HYDROGEN_ULTRAVIOLET_IONIZATION_TEMPLATE,
  MICROWAVE_WATER_VAPOR_TEMPLATE,
  SILVER_STERN_GERLACH_TEMPLATE,
  SODIUM_LASER_COOLING_TEMPLATE,
  URANIUM_ALPHA_DECAY_TEMPLATE,
} from './matter.js';
import {
  ANTIHYDROGEN_TEMPLATE,
  DEUTERIUM_TRITIUM_BEAM_TEMPLATE,
  DEUTERIUM_TRITIUM_PLASMA_TEMPLATE,
  HYDROGEN_PLASMA_BALANCE_TEMPLATE,
  HYDROGEN_RECOMBINATION_TEMPLATE,
  NEUTRON_CAPTURE_TEMPLATE,
  PHOTOIONIZATION_TEMPLATE,
  SOLAR_HELIUM_CHAIN_TEMPLATE,
  STAR_MATTER_EVOLUTION_TEMPLATE,
  HELIUM_THREE_BRANCHES_TEMPLATE,
  CNO_CYCLE_TEMPLATE,
  TRIPLE_ALPHA_TEMPLATE,
  S_PROCESS_IRON_TEMPLATE,
  CARBON_BURNING_TEMPLATE,
  FIRST_NUCLEI_AFTER_BIG_BANG_TEMPLATE,
  SOLAR_PROTON_CHAIN_TEMPLATE,
} from './fusion-and-atoms.js';
import {
  DRELL_YAN_TEMPLATE,
  HERA_DEEP_INELASTIC_TEMPLATE,
  LHC_JETS_TEMPLATE,
  LHC_TOP_PAIRS_TEMPLATE,
  TEVATRON_TOP_PAIRS_TEMPLATE,
} from './hadron-colliders.js';
import {
  ANNIHILATION_AT_REST_TEMPLATE,
  COMPTON_SCATTERING_TEMPLATE,
  FORWARD_BACKWARD_ASYMMETRY_TEMPLATE,
  PHOTON_COLLIDER_TEMPLATE,
  BHABHA_SCATTERING_TEMPLATE,
  W_PAIR_PRODUCTION_TEMPLATE,
  HIGGS_STRAHLUNG_TEMPLATE,
  Z_RESONANCE_TEMPLATE,
} from './collisions.js';
import {
  DOUBLE_SLIT_IN_CUBE_TEMPLATE,
  DOUBLE_WELL_TUNNELING_TEMPLATE,
  ELECTRON_WAVE_ON_PROTON_TEMPLATE,
  HARMONIC_OSCILLATOR_TEMPLATE,
  HYDROGEN_DIPOLE_OSCILLATION_TEMPLATE,
  HYDROGEN_ORBITAL_2P_TEMPLATE,
  HYDROGEN_ORBITAL_2S_TEMPLATE,
  HYDROGEN_ORBITAL_3D_TEMPLATE,
  PAIR_ANNIHILATION_IN_TRAP_TEMPLATE,
  HYDROGEN_ATOM_TEMPLATE,
  QUANTUM_CARPET_IN_BOX_TEMPLATE,
  QUANTUM_TUNNELING_TEMPLATE,
  SCHRODINGER_CAT_IN_TRAP_TEMPLATE,
  TUNNELING_MOVIE_TEMPLATE,
  WAVEPACKET_SPREADING_TEMPLATE,
} from './quantum-space.js';
import {
  DOUBLE_SLIT_IN_GAS_TEMPLATE,
  DOUBLE_SLIT_TEMPLATE,
  DOUBLE_SLIT_WHICH_PATH_TEMPLATE,
  DELAYED_CHOICE_ERASER_TEMPLATE,
  MALUS_LAW_TEMPLATE,
  NEUTRON_DOUBLE_SLIT_TEMPLATE,
} from './interference.js';
import {
  HIGGS_DECAYS_TEMPLATE,
  MICHEL_SPECTRUM_TEMPLATE,
  MUON_TIME_DILATION_TEMPLATE,
  NEUTRON_BETA_SPECTRUM_TEMPLATE,
  NEUTRON_FROM_QUARKS_TEMPLATE,
  PROTON_FROM_QUARKS_TEMPLATE,
  REACTOR_ANTINEUTRINO_TEMPLATE,
  B_MESON_DECAYS_TEMPLATE,
  STRING_FRAGMENTATION_TEMPLATE,
  W_BOSON_DECAYS_TEMPLATE,
  Z_BOSON_DECAYS_TEMPLATE,
} from './particle-physics.js';
import { SPIN_DEPHASING_TEMPLATE, THERMAL_POLARIZATION_TEMPLATE } from './spin-dynamics.js';
import { LARMOR_PRECESSION_TEMPLATE } from './larmor-precession.js';
import { MUON_DECAY_TEMPLATE } from './muon-decay.js';
import { NEUTRINO_OSCILLATION_TEMPLATE } from './neutrino-oscillation.js';
import { SINGLET_CORRELATION_TEMPLATE } from './singlet-correlation.js';
import { STERN_GERLACH_TEMPLATE } from './stern-gerlach.js';

export * from './chsh.js';
export * from './matter.js';
export * from './collisions.js';
export * from './fusion-and-atoms.js';
export * from './hadron-colliders.js';
export * from './quantum-space.js';
export * from './interference.js';
export * from './particle-physics.js';
export * from './spin-dynamics.js';
export * from './larmor-precession.js';
export * from './english.js';
export * from './chemistry.js';
export * from './radiation-in-matter.js';
export * from './fission.js';
export * from './quark-matter.js';
export * from './complexity.js';
export * from './muon-decay.js';
export * from './neutrino-oscillation.js';
export * from './singlet-correlation.js';
export * from './stern-gerlach.js';

const MATTER_TEMPLATES: readonly ExperimentPlan[] = [
  SILVER_STERN_GERLACH_TEMPLATE,
  SODIUM_LASER_COOLING_TEMPLATE,
  HYDROGEN_ULTRAVIOLET_IONIZATION_TEMPLATE,
  DEUTERON_PHOTODISINTEGRATION_TEMPLATE,
  MICROWAVE_WATER_VAPOR_TEMPLATE,
  WATER_FROM_ATOMS_TEMPLATE,
  WATER_IN_HYDROGEN_BUBBLE_TEMPLATE,
  AMMONIA_FROM_ATOMS_TEMPLATE,
  HYDROGEN_THERMAL_DISSOCIATION_TEMPLATE,
  URANIUM_ALPHA_DECAY_TEMPLATE,
  WATER_PHASES_TEMPLATE,
  CARBON_DIOXIDE_ON_PLANETS_TEMPLATE,
  RECOMBINATION_EPOCH_TEMPLATE,
];

const CATEGORIZED_TEMPLATES: readonly (readonly [ExperimentPlan, readonly TemplateCategory[]])[] = [
  [STERN_GERLACH_TEMPLATE, ['spin']],
  [SINGLET_CORRELATION_TEMPLATE, ['spin']],
  [CHSH_TEMPLATE, ['spin']],
  [LARMOR_PRECESSION_TEMPLATE, ['spin']],
  [MUON_DECAY_TEMPLATE, ['decays']],
  [NEUTRINO_OSCILLATION_TEMPLATE, ['neutrinos']],
  [DOUBLE_SLIT_TEMPLATE, ['interference']],
  [DOUBLE_SLIT_WHICH_PATH_TEMPLATE, ['interference']],
  [DELAYED_CHOICE_ERASER_TEMPLATE, ['interference', 'spin']],
  [DOUBLE_SLIT_IN_GAS_TEMPLATE, ['interference']],
  [NEUTRON_DOUBLE_SLIT_TEMPLATE, ['interference']],
  [MALUS_LAW_TEMPLATE, ['spin']],
  [MICHEL_SPECTRUM_TEMPLATE, ['decays']],
  [MUON_TIME_DILATION_TEMPLATE, ['decays']],
  [NEUTRON_BETA_SPECTRUM_TEMPLATE, ['decays']],
  [W_BOSON_DECAYS_TEMPLATE, ['decays']],
  [Z_BOSON_DECAYS_TEMPLATE, ['decays']],
  [HIGGS_DECAYS_TEMPLATE, ['decays']],
  [NEUTRON_FROM_QUARKS_TEMPLATE, ['confinement']],
  [PROTON_FROM_QUARKS_TEMPLATE, ['confinement']],
  [STRING_FRAGMENTATION_TEMPLATE, ['confinement']],
  [B_MESON_DECAYS_TEMPLATE, ['decays', 'confinement']],
  [REACTOR_ANTINEUTRINO_TEMPLATE, ['neutrinos', 'decays']],
  [THERMAL_POLARIZATION_TEMPLATE, ['spin']],
  [SPIN_DEPHASING_TEMPLATE, ['spin']],
  [Z_RESONANCE_TEMPLATE, ['colliders', 'confinement']],
  [FORWARD_BACKWARD_ASYMMETRY_TEMPLATE, ['colliders']],
  [ANNIHILATION_AT_REST_TEMPLATE, ['colliders']],
  [COMPTON_SCATTERING_TEMPLATE, ['colliders', 'radiation']],
  [PHOTON_COLLIDER_TEMPLATE, ['colliders']],
  [BHABHA_SCATTERING_TEMPLATE, ['colliders']],
  [W_PAIR_PRODUCTION_TEMPLATE, ['colliders']],
  [HIGGS_STRAHLUNG_TEMPLATE, ['colliders']],
  [LHC_JETS_TEMPLATE, ['protons', 'colliders']],
  [DRELL_YAN_TEMPLATE, ['protons', 'colliders']],
  [LHC_TOP_PAIRS_TEMPLATE, ['protons', 'colliders']],
  [TEVATRON_TOP_PAIRS_TEMPLATE, ['protons', 'colliders']],
  [HERA_DEEP_INELASTIC_TEMPLATE, ['protons', 'colliders']],
  [DEUTERIUM_TRITIUM_BEAM_TEMPLATE, ['nuclear']],
  [DEUTERIUM_TRITIUM_PLASMA_TEMPLATE, ['nuclear']],
  [SOLAR_PROTON_CHAIN_TEMPLATE, ['nuclear']],
  [SOLAR_HELIUM_CHAIN_TEMPLATE, ['nuclear']],
  [STAR_MATTER_EVOLUTION_TEMPLATE, ['nuclear', 'atoms']],
  [HELIUM_THREE_BRANCHES_TEMPLATE, ['nuclear']],
  [CNO_CYCLE_TEMPLATE, ['nuclear']],
  [TRIPLE_ALPHA_TEMPLATE, ['nuclear']],
  [S_PROCESS_IRON_TEMPLATE, ['nuclear']],
  [CARBON_BURNING_TEMPLATE, ['nuclear']],
  [FIRST_NUCLEI_AFTER_BIG_BANG_TEMPLATE, ['nuclear']],
  [NEUTRON_CAPTURE_TEMPLATE, ['nuclear']],
  [HYDROGEN_RECOMBINATION_TEMPLATE, ['atoms']],
  [HYDROGEN_PLASMA_BALANCE_TEMPLATE, ['atoms']],
  [PHOTOIONIZATION_TEMPLATE, ['atoms', 'radiation']],
  [ANTIHYDROGEN_TEMPLATE, ['atoms']],
  [HYDROGEN_ATOM_TEMPLATE, ['space', 'atoms']],
  [WAVEPACKET_SPREADING_TEMPLATE, ['space']],
  [QUANTUM_TUNNELING_TEMPLATE, ['space']],
  [HARMONIC_OSCILLATOR_TEMPLATE, ['space']],
  [PAIR_ANNIHILATION_IN_TRAP_TEMPLATE, ['space']],
  [DOUBLE_SLIT_IN_CUBE_TEMPLATE, ['space', 'interference']],
  [ELECTRON_WAVE_ON_PROTON_TEMPLATE, ['space']],
  [TUNNELING_MOVIE_TEMPLATE, ['space']],
  [DOUBLE_WELL_TUNNELING_TEMPLATE, ['space']],
  [HYDROGEN_ORBITAL_2S_TEMPLATE, ['space', 'atoms']],
  [HYDROGEN_ORBITAL_2P_TEMPLATE, ['space', 'atoms']],
  [HYDROGEN_ORBITAL_3D_TEMPLATE, ['space', 'atoms']],
  [HYDROGEN_DIPOLE_OSCILLATION_TEMPLATE, ['space', 'atoms']],
  [SCHRODINGER_CAT_IN_TRAP_TEMPLATE, ['space', 'interference']],
  [QUANTUM_CARPET_IN_BOX_TEMPLATE, ['space']],
];

export const EXPERIMENT_TEMPLATES: Readonly<Record<string, ExperimentPlan>> = Object.fromEntries([
  ...CATEGORIZED_TEMPLATES.map(([plan, categories]) => [plan.name, { ...plan, categories }]),
  ...MATTER_TEMPLATES.map((plan) => [plan.name, plan]),
  ...CHEMISTRY_TEMPLATES.map((plan) => [plan.name, plan]),
  ...RADIATION_IN_MATTER_TEMPLATES.map((plan) => [plan.name, plan]),
  ...FISSION_TEMPLATES.map((plan) => [plan.name, plan]),
  ...CHERNOBYL_TEMPLATES.map((plan) => [plan.name, plan]),
  ...QUARK_MATTER_TEMPLATES.map((plan) => [plan.name, plan]),
]);
