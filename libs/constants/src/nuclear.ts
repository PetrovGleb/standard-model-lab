/* Typed access to data/nuclear.json: light nuclei, fusion cross-section parametrizations, neutron capture and scattering, atomic ionization energies, each with its published source. */
import nuclearData from '../data/nuclear.json' with { type: 'json' };

export const NUCLEAR_DATA = nuclearData;
