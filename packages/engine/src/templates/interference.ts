/* Templates: two-slit interference with electrons and cold neutrons, with which-path detection, gas decoherence and the delayed-choice quantum eraser, and Malus's law for photon polarization. */
import { PLANCK_CONSTANT_IN_EV_PER_HERTZ, SPEED_OF_LIGHT } from '@standard-model/constants';
import { EV_PER_GEV } from '@standard-model/utils';
import { experiment } from '../experiment/experiment-builder.js';

const ELECTRON_50_KEV_MOMENTUM_IN_GEV = 2.315e-4;
const COLD_NEUTRON_MOMENTUM_IN_GEV = 6.72e-7;
const SCREEN_BINS = 160;

function twoSlit(name: string, description: string) {
  return experiment(name)
    .describe(description)
    .parameter('momentumInGev', ELECTRON_50_KEV_MOMENTUM_IN_GEV)
    .parameter('slitSeparationInMeters', 1e-6)
    .parameter('slitWidthInMeters', 2e-7)
    .parameter('screenDistanceInMeters', 1);
}

export const DOUBLE_SLIT_TEMPLATE = twoSlit(
  'doubleSlit',
  'Электроны 50 кэВ проходят две щели 0.2 мкм на расстоянии 1 мкм и попадают в экран через 1 м; полосы с шагом λL/d',
)
  .parameter('whichPathDetector', 0)
  .create('electron', 'electron', { momentumInGev: { x: 0, y: 0, z: '{{momentumInGev}}' } })
  .diffract(
    'electron',
    {
      slitSeparationInMeters: '{{slitSeparationInMeters}}',
      slitWidthInMeters: '{{slitWidthInMeters}}',
      screenDistanceInMeters: '{{screenDistanceInMeters}}',
      whichPathDetector: '{{whichPathDetector}}',
    },
    'screen',
  )
  .report('histogram', ['screen'], 'Положение на экране, мкм', SCREEN_BINS)
  .report('standardDeviation', ['screen'], 'Ширина картины, мкм')
  .build();

export const DOUBLE_SLIT_WHICH_PATH_TEMPLATE = twoSlit(
  'doubleSlitWhichPath',
  'Тот же опыт с детектором пути у щелей: информация о пути уничтожает интерференцию, остается огибающая одной щели',
)
  .parameter('whichPathDetector', 1)
  .create('electron', 'electron', { momentumInGev: { x: 0, y: 0, z: '{{momentumInGev}}' } })
  .diffract(
    'electron',
    {
      slitSeparationInMeters: '{{slitSeparationInMeters}}',
      slitWidthInMeters: '{{slitWidthInMeters}}',
      screenDistanceInMeters: '{{screenDistanceInMeters}}',
      whichPathDetector: '{{whichPathDetector}}',
    },
    'screen',
  )
  .report('histogram', ['screen'], 'Положение на экране, мкм', SCREEN_BINS)
  .report('standardDeviation', ['screen'], 'Ширина картины, мкм')
  .build();

export const DOUBLE_SLIT_IN_GAS_TEMPLATE = twoSlit(
  'doubleSlitInGas',
  'Двухщелевой опыт в разреженном водороде: столкновения с газом декогерируют электрон, видность полос падает как exp(−n σ v t)',
)
  .parameter('gasDensityPerCubicMeter', 1e19)
  .parameter('crossSectionInSquareMeters', 1e-19)
  .create('electron', 'electron', { momentumInGev: { x: 0, y: 0, z: '{{momentumInGev}}' } })
  .influence('setMedium', {
    components: [
      {
        species: 'proton',
        numberDensityPerCubicMeter: '{{gasDensityPerCubicMeter}}',
        crossSectionInSquareMeters: '{{crossSectionInSquareMeters}}',
      },
    ],
    temperatureInKelvin: 300,
  })
  .diffract(
    'electron',
    {
      slitSeparationInMeters: '{{slitSeparationInMeters}}',
      slitWidthInMeters: '{{slitWidthInMeters}}',
      screenDistanceInMeters: '{{screenDistanceInMeters}}',
      whichPathDetector: 0,
    },
    'screen',
  )
  .report('histogram', ['screen'], 'Положение на экране, мкм', SCREEN_BINS)
  .build();

export const NEUTRON_DOUBLE_SLIT_TEMPLATE = experiment('neutronDoubleSlit')
  .describe(
    'Опыт Цайлингера 1988: холодные нейтроны с длиной волны 1.85 нм, щели 22 мкм на расстоянии 126 мкм, экран через 5 м',
  )
  .parameter('momentumInGev', COLD_NEUTRON_MOMENTUM_IN_GEV)
  .parameter('slitSeparationInMeters', 1.26e-4)
  .parameter('slitWidthInMeters', 2.2e-5)
  .parameter('screenDistanceInMeters', 5)
  .create('neutron', 'neutron', { momentumInGev: { x: 0, y: 0, z: '{{momentumInGev}}' } })
  .diffract(
    'neutron',
    {
      slitSeparationInMeters: '{{slitSeparationInMeters}}',
      slitWidthInMeters: '{{slitWidthInMeters}}',
      screenDistanceInMeters: '{{screenDistanceInMeters}}',
      whichPathDetector: 0,
    },
    'screen',
  )
  .report('histogram', ['screen'], 'Положение на экране, мкм', SCREEN_BINS)
  .build();

export const MALUS_LAW_TEMPLATE = experiment('malusLaw')
  .describe(
    'Фотон с горизонтальной поляризацией проходит поляризатор; азимут на сфере Пуанкаре вдвое больше угла поляризатора, пропускание cos² угла',
  )
  .parameter('poincareAzimuthDegrees', 90)
  .create('photon', 'photon', { spin: 'plusX', momentumInGev: { x: 0, y: 0, z: 2e-9 } })
  .measure('photon', 'polarization', 'polarizer', {
    polarAngleDegrees: 90,
    azimuthDegrees: '{{poincareAzimuthDegrees}}',
  })
  .report('frequency', ['polarizer'], 'Прошел поляризатор')
  .build();

const DOWN_CONVERTED_WAVELENGTH_IN_METERS = 702e-9;
const DOWN_CONVERTED_PHOTON_MOMENTUM_IN_GEV =
  (PLANCK_CONSTANT_IN_EV_PER_HERTZ.value * SPEED_OF_LIGHT.value) /
  DOWN_CONVERTED_WAVELENGTH_IN_METERS /
  EV_PER_GEV;
const IDLER_DELAY_IN_SECONDS = 3.3e-8;
const PLUS_HALF = 0.5;
const MINUS_HALF = -0.5;

export const DELAYED_CHOICE_ERASER_TEMPLATE = experiment('delayedChoiceEraser')
  .describe(
    'Квантовый ластик с отложенным выбором (Kim, Scully, 1999): путь сигнального фотона записан в поляризации запутанного холостого фотона, который измеряют позже. На экране полос нет; среди совпадений с ластиком (ось 90°) — полосы и антиполосы; при оси 0° холостой фотон выдает путь, и полос нет ни в одной группе',
  )
  .parameter('momentumInGev', DOWN_CONVERTED_PHOTON_MOMENTUM_IN_GEV)
  .parameter('slitSeparationInMeters', 2e-4)
  .parameter('slitWidthInMeters', 5e-5)
  .parameter('screenDistanceInMeters', 1)
  .parameter('idlerPolarAngleDegrees', 90)
  .create('signal', 'photon', { momentumInGev: { x: 0, y: 0, z: '{{momentumInGev}}' } })
  .create('idler', 'photon', { momentumInGev: { x: 0, y: 0, z: '{{momentumInGev}}' } })
  .diffract(
    'signal',
    {
      slitSeparationInMeters: '{{slitSeparationInMeters}}',
      slitWidthInMeters: '{{slitWidthInMeters}}',
      screenDistanceInMeters: '{{screenDistanceInMeters}}',
      whichPathDetector: 0,
      pathMarker: 'idler',
    },
    'screen',
  )
  .evolve(IDLER_DELAY_IN_SECONDS, ['idler'])
  .measure('idler', 'polarization', 'idler', {
    polarAngleDegrees: '{{idlerPolarAngleDegrees}}',
    azimuthDegrees: 0,
  })
  .report('histogram', ['screen'], 'Все попадания на экран, мкм: полос нет', SCREEN_BINS)
  .report('histogram', ['screen'], 'Совпадения с холостым +½, мкм', SCREEN_BINS, {
    record: 'idler',
    equals: PLUS_HALF,
  })
  .report('histogram', ['screen'], 'Совпадения с холостым −½, мкм', SCREEN_BINS, {
    record: 'idler',
    equals: MINUS_HALF,
  })
  .build();
