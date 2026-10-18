/* Template: a muon neutrino of given energy travels a baseline and its flavor is measured; PDG mixing unless overridden. */
import { experiment } from '../experiment/experiment-builder.js';

export const NEUTRINO_OSCILLATION_TEMPLATE = experiment('neutrinoOscillation')
  .describe(
    'Muon neutrino with energyInGev flies baselineInKilometers in vacuum, then its flavor is measured',
  )
  .parameter('energyInGev', 0.6)
  .parameter('baselineInKilometers', 295)
  .create('neutrino', 'muonNeutrino', { momentumInGev: { x: 0, y: 0, z: '{{energyInGev}}' } })
  .influence('travel', { distanceInKilometers: '{{baselineInKilometers}}' }, ['neutrino'])
  .measure('neutrino', 'flavor', 'flavor')
  .report('frequency', ['flavor'], 'flavor')
  .build();
