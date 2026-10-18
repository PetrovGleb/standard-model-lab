/* Templates: thermal spin polarization in a magnetic field and dephasing of a spin superposition over time. */
import { experiment } from '../experiment/experiment-builder.js';

export const THERMAL_POLARIZATION_TEMPLATE = experiment('thermalPolarization')
  .describe(
    'Электрон в поле B при температуре T: доля спинов вниз по полю растет при охлаждении как Больцман, ⟨2Sz⟩ = −tanh(μB/kT)',
  )
  .parameter('fieldInTesla', 1)
  .parameter('temperatureInKelvin', 1)
  .create('electron', 'electron', { spin: 'up' })
  .influence('applyMagneticField', { zInTesla: '{{fieldInTesla}}' })
  .influence('setTemperature', { temperatureInKelvin: '{{temperatureInKelvin}}' })
  .influence('thermalize', {}, ['electron'])
  .measure('electron', 'spin', 'spinZ')
  .report('frequency', ['spinZ'], 'Проекция спина')
  .report('mean', ['spinZ'], 'Средняя проекция, ħ')
  .build();

export const SPIN_DEPHASING_TEMPLATE = experiment('spinDephasing')
  .describe('Спин в суперпозиции вдоль x теряет когерентность со временем T2: ⟨Sx⟩ = ½·exp(−t/T2)')
  .parameter('dephasingTimeInSeconds', 1e-6)
  .parameter('durationInSeconds', 1e-6)
  .create('electron', 'electron', { spin: 'plusX' })
  .influence('setCoherenceTimes', { dephasingTimeInSeconds: '{{dephasingTimeInSeconds}}' })
  .evolve('{{durationInSeconds}}', ['electron'])
  .measure('electron', 'spin', 'spinX', { polarAngleDegrees: 90, azimuthDegrees: 0 })
  .report('mean', ['spinX'], 'Средняя проекция на x, ħ')
  .report('frequency', ['spinX'], 'Проекция спина на x')
  .build();
