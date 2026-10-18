/* Typed access to data/string-fragmentation.json: tuned Lund string parameters from the PYTHIA 8.3 manual, not physical constants. */
import fragmentationData from '../data/string-fragmentation.json' with { type: 'json' };

export const STRING_FRAGMENTATION = fragmentationData;
