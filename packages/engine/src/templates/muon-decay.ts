/* Template: muon at rest decays through a virtual W; reports the mean lab time, the decay channel frequency and the mean electron energy. */
import { experiment } from '../experiment/experiment-builder.js';

export const MUON_DECAY_TEMPLATE = experiment('muonDecay')
  .describe(
    'Мюон в покое распадается через виртуальный W за разыгранное время; энергия электрона следует из амплитуды диаграммы, средняя 0.7 от края спектра',
  )
  .create('muon', 'muon')
  .decay('muon', 'decay')
  .report('mean', ['decay.labTimeInSeconds'], 'meanLabTimeInSeconds')
  .report('mean', ['decay.product[0].energyInGev'], 'meanElectronEnergyInGev')
  .report('frequency', ['decay'], 'channel')
  .build();
