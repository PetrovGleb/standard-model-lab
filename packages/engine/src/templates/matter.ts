/* Templates of the matter stage: silver atoms in a Stern–Gerlach magnet, Doppler cooling of sodium, ultraviolet ionization of hydrogen, gamma photodisintegration of the deuteron, microwave heating of water vapour, thermal dissociation of hydrogen molecules, the alpha decay of uranium-238,
   water and carbon dioxide phases in preset media and hydrogen in the relic radiation of the recombination epoch. */
import {
  ENVIRONMENT_PRESETS,
  PLANCK_CONSTANT_IN_EV_PER_HERTZ,
  SPEED_OF_LIGHT_IN_VACUUM,
  atomName,
  defaultMassNumber,
  particleSpec,
} from '@standard-model/constants';
import type {
  EnvironmentPreset,
  InfluenceStep,
  NumberOrParameter,
} from '@standard-model/contracts';
import { experiment } from '../experiment/experiment-builder.js';

const SILVER = 47;
const SILVER_MASS_NUMBER = 107;
const SODIUM = 11;
const SODIUM_BEAM_SPEED_IN_METERS_PER_SECOND = 30;
const COOLING_TIME_IN_SECONDS = 5e-3;
const LOW_SATURATION = 0.1;
const OPTIMAL_DETUNING_IN_LINEWIDTHS = -0.5;
const HYDROGEN = 1;
const OXYGEN = 8;
const HELIUM_LAMP_PHOTON_ENERGY_IN_EV = 21.2;
const LAMP_POWER_IN_WATTS = 1e-3;
const FOCUSED_SPOT_IN_SQUARE_METERS = 1e-10;
const LAMP_EXPOSURE_IN_SECONDS = 1e-3;
const GAMMA_PHOTON_ENERGY_IN_EV = 4e6;
const GAMMA_POWER_IN_WATTS = 1e9;
const GAMMA_EXPOSURE_IN_SECONDS = 0.3;
const MICROWAVE_FREQUENCY_IN_HERTZ = 2.45e9;
const MICROWAVE_POWER_IN_WATTS = 1000;
const OVEN_CROSS_SECTION_IN_SQUARE_METERS = 0.1;
const MICROWAVE_EXPOSURE_IN_SECONDS = 1;
const ROOM_TEMPERATURE_IN_KELVIN = 293;
const ATMOSPHERIC_NUMBER_DENSITY_PER_CUBIC_METER = 2.5e25;
const HELIUM_COLLISION_CROSS_SECTION_IN_SQUARE_METERS = 3e-19;
const FLAME_TEMPERATURE_IN_KELVIN = 3500;
const DISSOCIATION_WAIT_IN_SECONDS = 1e-9;
const WATER_FORMATION_TEMPERATURE_IN_KELVIN = 2000;
const ATOMIC_HYDROGEN_DENSITY_PER_CUBIC_METER = 1e24;
const OXYGEN_MASS_NUMBER = 16;
const FIRST_LOOK_IN_SECONDS = 5e-9;
const SECOND_LOOK_IN_SECONDS = 2.5e-8;
const LAST_LOOK_IN_SECONDS = 1e-6;
const BUFFER_HELIUM_DENSITY_PER_CUBIC_METER = 1e25;
const NITROGEN = 7;
const NITROGEN_MASS_NUMBER = 14;
const AMMONIA_TEMPERATURE_IN_KELVIN = 1000;
const URANIUM = 92;
const URANIUM_MASS_NUMBER = 238;

function frequencyOf(photonEnergyInEv: number): number {
  return photonEnergyInEv / PLANCK_CONSTANT_IN_EV_PER_HERTZ.value;
}

function momentumForSpeed(protons: number, speedInMetersPerSecond: number): number {
  const mass = particleSpec(atomName(protons, defaultMassNumber(protons), 0)).massInGev.value;
  return (mass * speedInMetersPerSecond) / SPEED_OF_LIGHT_IN_VACUUM.value;
}

const WATER = {
  atoms: [{ protons: OXYGEN }, { protons: HYDROGEN }, { protons: HYDROGEN }],
  bonds: [
    { first: 0, second: 1, order: 1 },
    { first: 0, second: 2, order: 1 },
  ],
} as const;

export const SILVER_STERN_GERLACH_TEMPLATE = experiment('silverSternGerlach')
  .describe(
    'Опыт Штерна и Герлаха 1922 года на атомах серебра. Основной уровень Ag по NIST — 5s ²S₁/₂: J = ½, фактор Ланде g ≈ 2, поэтому пучок расщепляется на две компоненты. Атом готовится со спином вверх и измеряется по оси, наклоненной на polarAngleDegrees',
  )
  .categorize('atoms', 'spin')
  .parameter('polarAngleDegrees', 90)
  .createAtom('silver', SILVER, { massNumber: SILVER_MASS_NUMBER, spin: 'up' })
  .measure('silver', 'spin', 'spin', {
    polarAngleDegrees: '{{polarAngleDegrees}}',
    azimuthDegrees: 0,
  })
  .measureSystem('atom')
  .report('frequency', ['spin'], 'Проекция J на ось магнита')
  .report('mean', ['atom.silver.landeFactor'], 'Фактор Ланде g_J')
  .report('mean', ['atom.silver.magneticMomentInBohrMagnetons'], 'Магнитный момент, μ_B')
  .build();

export const SODIUM_LASER_COOLING_TEMPLATE = experiment('sodiumLaserCooling')
  .describe(
    'Доплеровское охлаждение атома натрия на линии D2 (589 нм, A из NIST). Шесть встречных пучков с красной отстройкой тормозят атом: сначала постоянной силой рассеяния, затем вязким трением до доплеровского предела ħΓ(1 + s + 4δ²/Γ²)/(8k|δ|/Γ), около 240 мкК при малой мощности',
  )
  .categorize('atoms', 'radiation')
  .parameter('detuningInLinewidths', OPTIMAL_DETUNING_IN_LINEWIDTHS)
  .parameter('saturationParameter', LOW_SATURATION)
  .parameter('speedInMetersPerSecond', SODIUM_BEAM_SPEED_IN_METERS_PER_SECOND)
  .parameter('momentumInGev', momentumForSpeed(SODIUM, SODIUM_BEAM_SPEED_IN_METERS_PER_SECOND))
  .createAtom('sodium', SODIUM, { momentumInGev: { x: 0, y: 0, z: '{{momentumInGev}}' } })
  .measureSystem('before')
  .influence(
    'laserCool',
    {
      detuningInLinewidths: '{{detuningInLinewidths}}',
      saturationParameter: '{{saturationParameter}}',
      durationInSeconds: COOLING_TIME_IN_SECONDS,
    },
    ['sodium'],
  )
  .measureSystem('after')
  .report('mean', ['before.sodium.kineticTemperatureInKelvin'], 'Температура до охлаждения, К')
  .report('mean', ['after.sodium.kineticTemperatureInKelvin'], 'Температура после охлаждения, К')
  .report(
    'histogram',
    ['after.sodium.kineticTemperatureInKelvin'],
    'Разброс температур после, К',
    40,
  )
  .build();

export const HYDROGEN_ULTRAVIOLET_IONIZATION_TEMPLATE = experiment('hydrogenUltravioletIonization')
  .describe(
    'Атом водорода под жестким ультрафиолетом гелиевой лампы (21.2 эВ) в фокусе. Порог ионизации 13.6 эВ из NIST; сечение фотоионизации — подгонка Вернера 1996. Ниже порога, например на 254 нм, атом свет не поглощает',
  )
  .categorize('atoms', 'radiation')
  .parameter('frequencyInHertz', frequencyOf(HELIUM_LAMP_PHOTON_ENERGY_IN_EV))
  .parameter('powerInWatts', LAMP_POWER_IN_WATTS)
  .createAtom('hydrogen', HYDROGEN)
  .influence(
    'irradiate',
    {
      frequencyInHertz: '{{frequencyInHertz}}',
      powerInWatts: '{{powerInWatts}}',
      beamAreaInSquareMeters: FOCUSED_SPOT_IN_SQUARE_METERS,
      durationInSeconds: LAMP_EXPOSURE_IN_SECONDS,
    },
    ['hydrogen'],
  )
  .measureSystem('after')
  .report('frequency', ['after'], 'Что осталось после облучения')
  .build();

export const DEUTERON_PHOTODISINTEGRATION_TEMPLATE = experiment('deuteronPhotodisintegration')
  .describe(
    'Гамма-квант 4 МэВ расщепляет дейтрон на протон и нейтрон: γ + d → p + n. Порог 2.22 МэВ — энергия связи дейтрона из масс AME2020, сечение — формула Бете–Пайерлса в приближении нулевого радиуса. Пучок сфокусирован и мощность завышена, чтобы событий было много',
  )
  .categorize('nuclear', 'radiation')
  .parameter('frequencyInHertz', frequencyOf(GAMMA_PHOTON_ENERGY_IN_EV))
  .createNucleus('deuteron', HYDROGEN, 2)
  .influence(
    'irradiate',
    {
      frequencyInHertz: '{{frequencyInHertz}}',
      powerInWatts: GAMMA_POWER_IN_WATTS,
      beamAreaInSquareMeters: FOCUSED_SPOT_IN_SQUARE_METERS,
      durationInSeconds: GAMMA_EXPOSURE_IN_SECONDS,
    },
    ['deuteron'],
  )
  .measureSystem('after')
  .report('frequency', ['after'], 'Продукты')
  .build();

export const MICROWAVE_WATER_VAPOR_TEMPLATE = experiment('microwaveWaterVapor')
  .describe(
    'Молекула воды из конфигуратора: O с двумя одинарными связями к H. Геометрия, колебания и диполь считаются по силовому полю UFF и зарядам QEq. В микроволновом поле 2.45 ГГц полярная молекула поворачивается вслед за полем, столкновения с гелием тормозят поворот (релаксация Дебая), и энергия уходит в нагрев',
  )
  .categorize('molecules', 'radiation')
  .parameter('powerInWatts', MICROWAVE_POWER_IN_WATTS)
  .influence('setTemperature', { temperatureInKelvin: ROOM_TEMPERATURE_IN_KELVIN })
  .influence('setMedium', {
    components: [
      {
        species: 'heliumAtom',
        numberDensityPerCubicMeter: ATMOSPHERIC_NUMBER_DENSITY_PER_CUBIC_METER,
        crossSectionInSquareMeters: HELIUM_COLLISION_CROSS_SECTION_IN_SQUARE_METERS,
      },
    ],
    temperatureInKelvin: ROOM_TEMPERATURE_IN_KELVIN,
  })
  .createMolecule('water', WATER.atoms, WATER.bonds)
  .measureSystem('before')
  .influence(
    'irradiate',
    {
      frequencyInHertz: MICROWAVE_FREQUENCY_IN_HERTZ,
      powerInWatts: '{{powerInWatts}}',
      beamAreaInSquareMeters: OVEN_CROSS_SECTION_IN_SQUARE_METERS,
      durationInSeconds: MICROWAVE_EXPOSURE_IN_SECONDS,
    },
    ['water'],
  )
  .measureSystem('after')
  .report('mean', ['before.water.internalTemperatureInKelvin'], 'Внутренняя температура до, К')
  .report('mean', ['after.water.internalTemperatureInKelvin'], 'Внутренняя температура после, К')
  .report('mean', ['after.water.dipoleMomentInDebye'], 'Дипольный момент, Д')
  .report(
    'mean',
    ['after.water.highestWavenumberInInverseCentimeters'],
    'Старшая колебательная мода, см⁻¹',
  )
  .build();

export const WATER_FROM_ATOMS_TEMPLATE = experiment('waterFromAtoms')
  .describe(
    'Атом кислорода в газе атомарного водорода. Связь возникает, когда у обоих атомов есть свободная валентность: O + H → OH, затем OH + H → H₂O, а H₂O + H уже ничего не дает — у кислорода две валентности. Скорость соединения следует из детального равновесия с распадом связи: константа равновесия считается из статистических сумм (масса, моменты инерции, колебания, основной уровень атома) и энергии связи O–H 464 кДж/моль. За несколько наносекунд появляется OH, за микросекунду — вода. Поднимите температуру: при 4000 К вода, OH и атомы кислорода живут вместе, при 5000 К молекула разваливается обратно на атомы',
  )
  .categorize('molecules')
  .parameter('temperatureInKelvin', WATER_FORMATION_TEMPERATURE_IN_KELVIN)
  .parameter('hydrogenDensityPerCubicMeter', ATOMIC_HYDROGEN_DENSITY_PER_CUBIC_METER)
  .influence('setTemperature', { temperatureInKelvin: '{{temperatureInKelvin}}' })
  .influence('setMedium', {
    components: [
      { species: 'hydrogenAtom', numberDensityPerCubicMeter: '{{hydrogenDensityPerCubicMeter}}' },
    ],
    temperatureInKelvin: '{{temperatureInKelvin}}',
    reactionMode: 'allReactionsInStep',
  })
  .createAtom('oxygen', OXYGEN, { massNumber: OXYGEN_MASS_NUMBER })
  .evolve(FIRST_LOOK_IN_SECONDS)
  .measureSystem('afterFiveNanoseconds')
  .evolve(SECOND_LOOK_IN_SECONDS)
  .measureSystem('afterThirtyNanoseconds')
  .evolve(LAST_LOOK_IN_SECONDS)
  .measureSystem('afterMicrosecond')
  .report('frequency', ['afterFiveNanoseconds'], 'Через 5 нс')
  .report('frequency', ['afterThirtyNanoseconds'], 'Через 30 нс')
  .report('frequency', ['afterMicrosecond'], 'Через микросекунду')
  .build();

export const WATER_IN_HYDROGEN_BUBBLE_TEMPLATE = experiment('waterInHydrogenBubble')
  .describe(
    'Два атома кислорода в горячем гелии. Гелий — общая среда для всей системы: он инертен, у него нет свободной валентности. Вокруг первого атома — свой пузырь атомарного водорода: среда, заданная только для него, внутри заменяет гелий. За 30 нс первый атом набирает водород из пузыря, к микросекунде он — вода, а второй атом в гелии остается кислородом. На сцене видно, как оболочка пузыря вложена в общую оболочку гелия',
  )
  .categorize('molecules')
  .parameter('temperatureInKelvin', WATER_FORMATION_TEMPERATURE_IN_KELVIN)
  .parameter('heliumDensityPerCubicMeter', BUFFER_HELIUM_DENSITY_PER_CUBIC_METER)
  .parameter('hydrogenDensityPerCubicMeter', ATOMIC_HYDROGEN_DENSITY_PER_CUBIC_METER)
  .createAtom('inBubble', OXYGEN, { massNumber: OXYGEN_MASS_NUMBER })
  .createAtom('inHelium', OXYGEN, { massNumber: OXYGEN_MASS_NUMBER })
  .influence('setTemperature', { temperatureInKelvin: '{{temperatureInKelvin}}' })
  .influence('setMedium', {
    components: [
      { species: 'heliumAtom', numberDensityPerCubicMeter: '{{heliumDensityPerCubicMeter}}' },
    ],
    temperatureInKelvin: '{{temperatureInKelvin}}',
    reactionMode: 'allReactionsInStep',
  })
  .influence(
    'setMedium',
    {
      components: [
        {
          species: 'hydrogenAtom',
          numberDensityPerCubicMeter: '{{hydrogenDensityPerCubicMeter}}',
        },
      ],
      temperatureInKelvin: '{{temperatureInKelvin}}',
      reactionMode: 'allReactionsInStep',
    },
    ['inBubble'],
  )
  .evolve(SECOND_LOOK_IN_SECONDS)
  .measureSystem('afterThirtyNanoseconds')
  .evolve(LAST_LOOK_IN_SECONDS)
  .measureSystem('afterMicrosecond')
  .report('frequency', ['afterThirtyNanoseconds'], 'Через 30 нс')
  .report('frequency', ['afterMicrosecond'], 'Через микросекунду')
  .build();

export const AMMONIA_FROM_ATOMS_TEMPLATE = experiment('ammoniaFromAtoms')
  .describe(
    'Атом азота в газе атомарного водорода при 1000 К. Тот же закон, что собирал воду: связь возникает, пока у атома есть свободная валентность, а скорость следует из детального равновесия с распадом связи. У азота три валентности, поэтому за наносекунды появляются NH и NH₂, а к микросекунде — аммиак NH₃, и четвертый водород уже не пристает. Это тот же путь, которым атомы собираются в молекулы в межзвездных облаках и на поверхности катализатора; меняйте температуру и плотность водорода',
  )
  .categorize('molecules')
  .parameter('temperatureInKelvin', AMMONIA_TEMPERATURE_IN_KELVIN)
  .parameter('hydrogenDensityPerCubicMeter', ATOMIC_HYDROGEN_DENSITY_PER_CUBIC_METER)
  .influence('setTemperature', { temperatureInKelvin: '{{temperatureInKelvin}}' })
  .influence('setMedium', {
    components: [
      { species: 'hydrogenAtom', numberDensityPerCubicMeter: '{{hydrogenDensityPerCubicMeter}}' },
    ],
    temperatureInKelvin: '{{temperatureInKelvin}}',
    reactionMode: 'allReactionsInStep',
  })
  .createAtom('nitrogen', NITROGEN, { massNumber: NITROGEN_MASS_NUMBER })
  .evolve(FIRST_LOOK_IN_SECONDS)
  .measureSystem('afterFiveNanoseconds')
  .evolve(LAST_LOOK_IN_SECONDS)
  .measureSystem('afterMicrosecond')
  .report('frequency', ['afterFiveNanoseconds'], 'Через 5 нс')
  .report('frequency', ['afterMicrosecond'], 'Через микросекунду')
  .build();

export const HYDROGEN_THERMAL_DISSOCIATION_TEMPLATE = experiment('hydrogenThermalDissociation')
  .describe(
    'Молекула H₂ в тепловой бане. Каждая связь рвется с частотой своего колебания, умноженной на exp(−D/kT); энергия связи H–H 436 кДж/моль (OpenStax). При 3500 К за наносекунду распадается заметная доля молекул, при 1000 К — почти никто',
  )
  .categorize('molecules')
  .parameter('temperatureInKelvin', FLAME_TEMPERATURE_IN_KELVIN)
  .influence('setTemperature', { temperatureInKelvin: '{{temperatureInKelvin}}' })
  .createMolecule(
    'hydrogen',
    [{ protons: HYDROGEN }, { protons: HYDROGEN }],
    [{ first: 0, second: 1, order: 1 }],
  )
  .evolve(DISSOCIATION_WAIT_IN_SECONDS)
  .measureSystem('after')
  .report('frequency', ['after'], 'Молекула или атомы')
  .build();

export const URANIUM_ALPHA_DECAY_TEMPLATE = experiment('uraniumAlphaDecay')
  .describe(
    'Ядро урана-238 из таблицы NUBASE2020: период полураспада 4.46 млрд лет, мода — альфа-распад в торий-234. Энергия распада берется из масс AME2020 и делится между α-частицей и ядром отдачи',
  )
  .categorize('nuclear', 'decays')
  .createNucleus('uranium', URANIUM, URANIUM_MASS_NUMBER)
  .measureSystem('before')
  .decay('uranium', 'decay')
  .measureSystem('after')
  .report('frequency', ['after'], 'Продукты распада')
  .report('mean', ['before.uranium.bindingEnergyPerNucleonInMev'], 'Энергия связи на нуклон, МэВ')
  .report('histogram', ['decay.product[1].energyInGev'], 'Полная энергия α-частицы, ГэВ', 30)
  .build();

const CARBON = 6;
const CARBON_DIOXIDE = {
  atoms: [{ protons: CARBON }, { protons: OXYGEN }, { protons: OXYGEN }],
  bonds: [
    { first: 0, second: 1, order: 2 },
    { first: 0, second: 2, order: 2 },
  ],
} as const;
const ICE_TEMPERATURE_IN_KELVIN = 250;
const LIQUID_WATER_TEMPERATURE_IN_KELVIN = 300;
const STEAM_TEMPERATURE_IN_KELVIN = 400;
const IONIZING_RADIATION_TEMPERATURE_IN_KELVIN = 4000;
const THOUSANDS_OF_YEARS_IN_SECONDS = 1e11;

function presetNamed(name: string): EnvironmentPreset {
  const preset = ENVIRONMENT_PRESETS.find((candidate) => candidate.name === name);
  if (preset === undefined) {
    throw new Error(`environment preset ${name} expected`);
  }
  return preset;
}

function mediumOf(
  preset: EnvironmentPreset,
  overrides: Readonly<Record<string, NumberOrParameter>> = {},
): InfluenceStep['parameters'] {
  return {
    components: preset.components.map((component) => ({
      species: component.species,
      numberDensityPerCubicMeter: component.numberDensityPerCubicMeter,
    })),
    temperatureInKelvin: preset.temperatureInKelvin,
    pressureInPascals: preset.pressureInPascals,
    ...(preset.radiationTemperatureInKelvin === null
      ? {}
      : { radiationTemperatureInKelvin: preset.radiationTemperatureInKelvin }),
    ...overrides,
  };
}

const EARTH_AIR = presetNamed('earthSeaLevel');

export const WATER_PHASES_TEMPLATE = experiment('waterPhases')
  .describe(
    'Молекула воды в воздухе у уровня моря при трех температурах. Агрегатное состояние здесь закон, а не таблица по веществу: кривая давления пара проведена через критическую точку и точку кипения по Клаузиусу–Клапейрону, ниже точки плавления вещество твердое, выше критической температуры при давлении выше критического — сверхкритический флюид; критические точки из NIST WebBook. При 250 К лед, при 300 К жидкость, при 400 К пар. Поставьте давление 100 Па — и при 300 К вода станет паром, 30 МПа и 700 К дадут сверхкритический флюид. В замерах системы поле phase, в журнале — события смены фазы',
  )
  .categorize('molecules')
  .parameter('pressureInPascals', EARTH_AIR.pressureInPascals)
  .parameter('coldInKelvin', ICE_TEMPERATURE_IN_KELVIN)
  .parameter('warmInKelvin', LIQUID_WATER_TEMPERATURE_IN_KELVIN)
  .parameter('hotInKelvin', STEAM_TEMPERATURE_IN_KELVIN)
  .createMolecule('water', WATER.atoms, WATER.bonds)
  .influence(
    'setMedium',
    mediumOf(EARTH_AIR, {
      temperatureInKelvin: '{{coldInKelvin}}',
      pressureInPascals: '{{pressureInPascals}}',
    }),
  )
  .measureSystem('cold')
  .influence(
    'setMedium',
    mediumOf(EARTH_AIR, {
      temperatureInKelvin: '{{warmInKelvin}}',
      pressureInPascals: '{{pressureInPascals}}',
    }),
  )
  .measureSystem('warm')
  .influence(
    'setMedium',
    mediumOf(EARTH_AIR, {
      temperatureInKelvin: '{{hotInKelvin}}',
      pressureInPascals: '{{pressureInPascals}}',
    }),
  )
  .measureSystem('hot')
  .report('frequency', ['cold.phase'], 'Фаза воды в холоде')
  .report('frequency', ['warm.phase'], 'Фаза воды в тепле')
  .report('frequency', ['hot.phase'], 'Фаза воды в жаре')
  .build();

export const CARBON_DIOXIDE_ON_PLANETS_TEMPLATE = experiment('carbonDioxideOnPlanets')
  .describe(
    'Молекула CO₂ по очереди на поверхности Венеры (737 К, 9.2 МПа), Марса (210 К, 610 Па) и Земли у моря. Один и тот же закон фаз с критической точкой CO₂ (304 К, 7.38 МПа) дает на Венере сверхкритический флюид — там углекислота плотна как жидкость и течет как газ, — а на Марсе и Земле газ. Среды взяты из готовых пресетов по данным NASA и Стандартной атмосферы 1976; выберите в шаге среды другой пресет и посмотрите, где CO₂ замерзнет',
  )
  .categorize('molecules')
  .createMolecule('carbonDioxide', CARBON_DIOXIDE.atoms, CARBON_DIOXIDE.bonds)
  .influence('setMedium', mediumOf(presetNamed('venusSurface')))
  .measureSystem('onVenus')
  .influence('setMedium', mediumOf(presetNamed('marsSurface')))
  .measureSystem('onMars')
  .influence('setMedium', mediumOf(EARTH_AIR))
  .measureSystem('onEarth')
  .report('frequency', ['onVenus.phase'], 'Фаза CO₂ на Венере')
  .report('frequency', ['onMars.phase'], 'Фаза CO₂ на Марсе')
  .report('frequency', ['onEarth.phase'], 'Фаза CO₂ на Земле')
  .build();

export const RECOMBINATION_EPOCH_TEMPLATE = experiment('recombinationEpoch')
  .describe(
    'Атом водорода в плазме эпохи рекомбинации: протоны, электроны и ядра гелия с плотностями космологии Planck 2018 при z ≈ 1090 и реликтовое излучение; вещество и излучение в равновесии при одной температуре temperatureInKelvin. Фотоны планковского спектра ионизуют атом из основного состояния по сечениям Вернера, свободные электроны рекомбинируют по Крамерсу. При 4000 К излучение держит водород в основном ионизованным, при 3000 К он остается нейтральным: Вселенная становится прозрачной. Скорости связаны детальным балансом и сходятся к равновесию Саха; захват Лайман-альфа по Пиблсу не учтен',
  )
  .categorize('radiation')
  .parameter('temperatureInKelvin', IONIZING_RADIATION_TEMPERATURE_IN_KELVIN)
  .createAtom('hydrogen', HYDROGEN, { massNumber: defaultMassNumber(HYDROGEN) })
  .influence(
    'setMedium',
    mediumOf(presetNamed('recombinationEpoch'), {
      temperatureInKelvin: '{{temperatureInKelvin}}',
      radiationTemperatureInKelvin: '{{temperatureInKelvin}}',
    }),
  )
  .evolve(THOUSANDS_OF_YEARS_IN_SECONDS)
  .measureSystem('afterThousandsOfYears')
  .report('frequency', ['afterThousandsOfYears'], 'Водород через тысячи лет')
  .build();
