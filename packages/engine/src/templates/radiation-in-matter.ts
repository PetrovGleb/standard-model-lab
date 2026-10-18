/* Templates of radiation in a medium of finite size: a hundred gamma photons crossing a lead ball and dying out as exp(−μ·r), an alpha particle stopped in water within its Bethe range, and an
   X-ray beam heating a water ball by the energy its photons leave inside; the medium takes the absorbed energy and warms by its heat capacity. */
import { PLANCK_CONSTANT_IN_EV_PER_HERTZ, particleSpec } from '@standard-model/constants';
import { experiment } from '../experiment/experiment-builder.js';

const GAMMA_PHOTONS = 100;
const GAMMA_ENERGY_IN_GEV = 1e-3;
const LEAD_NUMBER_DENSITY_PER_CUBIC_METER = 3.3e28;
const LEAD_BALL_DIAMETER_IN_METERS = 0.02;
const LEAD = 'atom:82:208:0';
const ROOM_TEMPERATURE_IN_KELVIN = 293;
const FLIGHT_IN_SECONDS = 1e-9;
const ALPHA_KINETIC_ENERGY_IN_GEV = 5e-3;
const WATER_MOLECULE = 'molecule:8-16,1-1,1-1;0-1-1,0-2-1';
const WATER_NUMBER_DENSITY_PER_CUBIC_METER = 3.34e28;
const STANDARD_ATMOSPHERE_IN_PASCALS = 101325;
const WATER_DROP_DIAMETER_IN_METERS = 1e-3;
const WATER_BALL_DIAMETER_IN_METERS = 0.01;
const XRAY_ENERGY_IN_EV = 1e4;
const XRAY_POWER_IN_WATTS = 100;
const XRAY_BEAM_AREA_IN_SQUARE_METERS = 1e-5;
const XRAY_EXPOSURE_IN_SECONDS = 1;
const RADIATION_SHOTS = 1000;

const alphaMass = particleSpec('alphaParticle').massInGev.value;
const ALPHA_MOMENTUM_IN_GEV = Math.sqrt(
  ALPHA_KINETIC_ENERGY_IN_GEV ** 2 + 2 * ALPHA_KINETIC_ENERGY_IN_GEV * alphaMass,
);

export const GAMMA_SHIELD_TEMPLATE = experiment('gammaShield')
  .describe(
    'Сто гамма-квантов с энергией 1 МэВ вылетают из центра свинцового шара диаметром 2 см. Среда теперь имеет размер: квант проходит до края радиус шара и поглощается с вероятностью 1 − exp(−μ·r), где коэффициент μ = n·σ складывается из фотоэффекта (Вернер, а для свинца водородоподобный Крамерс) и комптоновского рассеяния на 82 электронах атома (Клейн–Нишина). Поглощенный квант исчезает, его энергия уходит в свинец и нагревает его по теплоемкости Дюлонга–Пти. Меняйте диаметр шара: каждые 1,2 см свинца ослабляют поток примерно вдвое. Рассеянный квант здесь считается поглощенным, а фотоэффект на внутренних оболочках свинца не учтен, поэтому ослабление чуть слабее измеренного',
  )
  .categorize('radiation')
  .shots(RADIATION_SHOTS)
  .parameter('leadBallDiameterInMeters', LEAD_BALL_DIAMETER_IN_METERS)
  .parameter('leadDensityPerCubicMeter', LEAD_NUMBER_DENSITY_PER_CUBIC_METER)
  .influence('setMedium', {
    components: [{ species: LEAD, numberDensityPerCubicMeter: '{{leadDensityPerCubicMeter}}' }],
    temperatureInKelvin: ROOM_TEMPERATURE_IN_KELVIN,
    pressureInPascals: STANDARD_ATMOSPHERE_IN_PASCALS,
    thicknessInMeters: '{{leadBallDiameterInMeters}}',
  })
  .create('gamma', 'photon', {
    momentumInGev: { x: 0, y: 0, z: GAMMA_ENERGY_IN_GEV },
    count: GAMMA_PHOTONS,
  })
  .evolve(FLIGHT_IN_SECONDS)
  .measureSystem('after')
  .report('mean', ['after.count.photon'], 'Квантов вылетело из шара')
  .report('mean', ['after.medium.absorbedEnergyInJoules'], 'Энергия, оставленная в свинце, Дж')
  .build();

export const ALPHA_IN_WATER_TEMPLATE = experiment('alphaInWater')
  .describe(
    'Альфа-частица с энергией 5 МэВ, как от распада радона, в капле воды диаметром 1 мм. Заряженная частица теряет энергию на ионизацию электронов среды по формуле Бете с энергией возбуждения по правилу Блоха (10 эВ на протон), и ее пробег — интеграл dE/(dE/dx) — около 40 мкм: альфа-частица останавливается внутри капли, не долетев до края. Вся ее кинетическая энергия, 8·10⁻¹³ Дж, уходит в воду. Поднимите энергию до 50 МэВ — пробег вырастет в десятки раз',
  )
  .categorize('radiation', 'nuclear')
  .shots(RADIATION_SHOTS)
  .parameter('dropDiameterInMeters', WATER_DROP_DIAMETER_IN_METERS)
  .parameter('alphaMomentumInGev', ALPHA_MOMENTUM_IN_GEV)
  .influence('setMedium', {
    components: [
      { species: WATER_MOLECULE, numberDensityPerCubicMeter: WATER_NUMBER_DENSITY_PER_CUBIC_METER },
    ],
    temperatureInKelvin: ROOM_TEMPERATURE_IN_KELVIN,
    pressureInPascals: STANDARD_ATMOSPHERE_IN_PASCALS,
    thicknessInMeters: '{{dropDiameterInMeters}}',
  })
  .create('alpha', 'alphaParticle', { momentumInGev: { x: 0, y: 0, z: '{{alphaMomentumInGev}}' } })
  .evolve(FLIGHT_IN_SECONDS)
  .measureSystem('after')
  .report('mean', ['after.alpha.momentumInGev'], 'Импульс альфа-частицы после, ГэВ')
  .report('mean', ['after.medium.absorbedEnergyInJoules'], 'Энергия, оставленная в воде, Дж')
  .build();

export const XRAY_HEATS_WATER_TEMPLATE = experiment('xrayHeatsWater')
  .describe(
    'Пучок рентгеновских квантов 10 кэВ мощностью 100 Вт светит секунду в водяной шар диаметром 1 см. Доля пучка, поглощенная средой, равна 1 − exp(−μ·d): на этой энергии вода почти непрозрачна из-за фотоэффекта на кислороде, и почти вся энергия остается в шаре. Теплоемкость жидкости по Дюлонгу–Пти — 3k на атом, 9k на молекулу воды, это 75 Дж/(моль·К), как у настоящей воды. Шар массой полграмма нагревается почти на 50 К. Замеры до и после показывают температуру среды и поглощенную энергию',
  )
  .categorize('radiation')
  .shots(RADIATION_SHOTS)
  .parameter('ballDiameterInMeters', WATER_BALL_DIAMETER_IN_METERS)
  .parameter('powerInWatts', XRAY_POWER_IN_WATTS)
  .influence('setMedium', {
    components: [
      { species: WATER_MOLECULE, numberDensityPerCubicMeter: WATER_NUMBER_DENSITY_PER_CUBIC_METER },
    ],
    temperatureInKelvin: ROOM_TEMPERATURE_IN_KELVIN,
    pressureInPascals: STANDARD_ATMOSPHERE_IN_PASCALS,
    thicknessInMeters: '{{ballDiameterInMeters}}',
  })
  .measureSystem('before')
  .influence('irradiate', {
    frequencyInHertz: XRAY_ENERGY_IN_EV / PLANCK_CONSTANT_IN_EV_PER_HERTZ.value,
    powerInWatts: '{{powerInWatts}}',
    beamAreaInSquareMeters: XRAY_BEAM_AREA_IN_SQUARE_METERS,
    durationInSeconds: XRAY_EXPOSURE_IN_SECONDS,
  })
  .measureSystem('after')
  .report('mean', ['before.medium.temperatureInKelvin'], 'Температура воды до, К')
  .report('mean', ['after.medium.temperatureInKelvin'], 'Температура воды после, К')
  .report('mean', ['after.medium.absorbedEnergyInJoules'], 'Поглощенная энергия, Дж')
  .build();

export const RADIATION_IN_MATTER_TEMPLATES = [
  GAMMA_SHIELD_TEMPLATE,
  ALPHA_IN_WATER_TEMPLATE,
  XRAY_HEATS_WATER_TEMPLATE,
];
