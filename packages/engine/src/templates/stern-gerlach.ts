/* Template: Stern-Gerlach, spin up measured along a tilted axis; the plus frequency is cos squared of half the angle. */
import { experiment } from '../experiment/experiment-builder.js';

export const STERN_GERLACH_TEMPLATE = experiment('sternGerlach')
  .describe('Electron prepared spin up, measured along an axis tilted by polarAngleDegrees from z')
  .parameter('polarAngleDegrees', 90)
  .create('electron', 'electron', { spin: 'up' })
  .measure('electron', 'spin', 'spin', {
    polarAngleDegrees: '{{polarAngleDegrees}}',
    azimuthDegrees: 0,
  })
  .report('frequency', ['spin'], 'spin')
  .report('mean', ['spin'], 'meanSpin')
  .build();
