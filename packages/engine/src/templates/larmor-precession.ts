/* Template: Larmor precession of an electron spin in a magnetic field along z, read out along y after a chosen time. */
import { ELECTRON_GYROMAGNETIC_RATIO } from '@standard-model/constants';
import { experiment } from '../experiment/experiment-builder.js';

export const ELECTRON_QUARTER_PERIOD_AT_ONE_TESLA_IN_SECONDS =
  Math.PI / (2 * ELECTRON_GYROMAGNETIC_RATIO.value);

export const LARMOR_PRECESSION_TEMPLATE = experiment('larmorPrecession')
  .describe(
    'Electron spin along +x precesses in a field along z; spin along y is measured after durationInSeconds',
  )
  .parameter('fieldInTesla', 1)
  .parameter('durationInSeconds', ELECTRON_QUARTER_PERIOD_AT_ONE_TESLA_IN_SECONDS)
  .create('electron', 'electron', { spin: 'plusX' })
  .influence('applyMagneticField', { zInTesla: '{{fieldInTesla}}' })
  .evolve('{{durationInSeconds}}', ['electron'])
  .measure('electron', 'spin', 'spinY', { polarAngleDegrees: 90, azimuthDegrees: 90 })
  .report('mean', ['spinY'], 'meanSpinY')
  .report('frequency', ['spinY'], 'spinY')
  .build();
