/* Template: spin singlet measured along two axes separated by an angle; same-sign probability is sin squared of half the angle. */
import { experiment } from '../experiment/experiment-builder.js';

export const SINGLET_CORRELATION_TEMPLATE = experiment('singletCorrelation')
  .describe(
    'Two electrons in the spin singlet, measured along axes separated by angleBetweenAxesDegrees',
  )
  .parameter('angleBetweenAxesDegrees', 120)
  .create('electronA', 'electron')
  .create('electronB', 'electron')
  .entangle(['electronA', 'electronB'], 'spinSinglet')
  .measure('electronA', 'spin', 'a', { polarAngleDegrees: 0, azimuthDegrees: 0 })
  .measure('electronB', 'spin', 'b', {
    polarAngleDegrees: '{{angleBetweenAxesDegrees}}',
    azimuthDegrees: 0,
  })
  .report('probabilitySameSign', ['a', 'b'], 'sameSign')
  .report('correlation', ['a', 'b'], 'correlation')
  .build();
