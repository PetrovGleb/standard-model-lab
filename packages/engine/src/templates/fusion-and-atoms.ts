/* Templates: fusion of light nuclei from their measured S-factors and atoms from radiative recombination; a deuteron beam on tritium, a D–T plasma, the first steps of the solar pp chain and the whole chain to helium-4 in a three-component gas, neutron capture in hydrogen, recombination of a hydrogen plasma, the ionization balance of hydrogen in a dense electron gas, photoionization and antihydrogen. */
import {
  ELECTRON_VOLT,
  LOSCHMIDT_CONSTANT_AT_273_15_K_101_325_KPA,
  SPEED_OF_LIGHT_IN_VACUUM,
  nucleusName,
  particleSpec,
} from '@standard-model/constants';
import type { ParticleName } from '@standard-model/contracts';
import { EV_PER_GEV } from '@standard-model/utils';
import { experiment } from '../experiment/experiment-builder.js';

const GEV_PER_KEV = 1e-6;
const HYDROGEN = 1;
const DEUTERIUM_MASS_NUMBER = 2;
const TRITIUM_MASS_NUMBER = 3;
const GEV_PER_EV = 1e-9;
const SPECTRUM_BINS = 50;
const DEUTERON_BEAM_ENERGY_IN_KEV = 100;
const PLASMA_TEMPERATURE_IN_KELVIN = 1.74e8;
const PLASMA_DENSITY_PER_CUBIC_METER = 1e20;
const SOLAR_CORE_TEMPERATURE_IN_KELVIN = 1.57e7;
const SOLAR_CORE_PROTON_DENSITY_PER_CUBIC_METER = 3e31;
const SECONDS_PER_BILLION_YEARS = 3.156e16;
const TEN_BILLION_YEARS_IN_SECONDS = 10 * SECONDS_PER_BILLION_YEARS;
const SOLAR_CORE_HELION_FRACTION = 1e-5;
const SOLAR_CORE_HELION_DENSITY_PER_CUBIC_METER =
  SOLAR_CORE_PROTON_DENSITY_PER_CUBIC_METER * SOLAR_CORE_HELION_FRACTION;
const SOLAR_CORE_ELECTRON_DENSITY_PER_CUBIC_METER =
  SOLAR_CORE_PROTON_DENSITY_PER_CUBIC_METER +
  particleSpec('helion').electricChargeInElementaryUnits *
    SOLAR_CORE_HELION_DENSITY_PER_CUBIC_METER;
const SOLAR_CORE_MASS_DENSITY_IN_KILOGRAMS_PER_CUBIC_METER = 1.5e5;
const SOLAR_CORE_HYDROGEN_MASS_FRACTION = 0.34;
const SOLAR_CORE_HELIUM_MASS_FRACTION = 0.64;
const SOLAR_CORE_HELION_TO_HYDROGEN_NUMBER_RATIO = 3e-5;
const SECONDS_PER_HUNDRED_THOUSAND_YEARS = SECONDS_PER_BILLION_YEARS / 1e4;
const STAR_STAGE_WAITS_IN_SECONDS = {
  capture: 1e-9,
  firstFusion: SECONDS_PER_BILLION_YEARS,
  deuteronBurn: 1,
  helionBurn: SECONDS_PER_HUNDRED_THOUSAND_YEARS,
};
function massInKilograms(name: ParticleName): number {
  return (
    (particleSpec(name).massInGev.value * EV_PER_GEV * ELECTRON_VOLT.value) /
    SPEED_OF_LIGHT_IN_VACUUM.value ** 2
  );
}
const STAR_SPECIES_MASS_IN_KILOGRAMS = {
  proton: massInKilograms('proton'),
  alphaParticle: massInKilograms('alphaParticle'),
};
const STAR_PROTON_DENSITY_PER_CUBIC_METER =
  (SOLAR_CORE_HYDROGEN_MASS_FRACTION * SOLAR_CORE_MASS_DENSITY_IN_KILOGRAMS_PER_CUBIC_METER) /
  STAR_SPECIES_MASS_IN_KILOGRAMS.proton;
const STAR_ALPHA_DENSITY_PER_CUBIC_METER =
  (SOLAR_CORE_HELIUM_MASS_FRACTION * SOLAR_CORE_MASS_DENSITY_IN_KILOGRAMS_PER_CUBIC_METER) /
  STAR_SPECIES_MASS_IN_KILOGRAMS.alphaParticle;
const STAR_HELION_DENSITY_PER_CUBIC_METER =
  STAR_PROTON_DENSITY_PER_CUBIC_METER * SOLAR_CORE_HELION_TO_HYDROGEN_NUMBER_RATIO;
const STAR_ELECTRON_DENSITY_PER_CUBIC_METER =
  STAR_PROTON_DENSITY_PER_CUBIC_METER +
  particleSpec('alphaParticle').electricChargeInElementaryUnits *
    STAR_ALPHA_DENSITY_PER_CUBIC_METER +
  particleSpec('helion').electricChargeInElementaryUnits * STAR_HELION_DENSITY_PER_CUBIC_METER;
const MASSIVE_STAR_CORE_TEMPERATURE_IN_KELVIN = 2e7;
const MASSIVE_STAR_CORE_PROTON_DENSITY_PER_CUBIC_METER = 3e31;
const MASSIVE_STAR_CORE_ALPHA_DENSITY_PER_CUBIC_METER = 1e31;
const MASSIVE_STAR_CORE_ELECTRON_DENSITY_PER_CUBIC_METER =
  MASSIVE_STAR_CORE_PROTON_DENSITY_PER_CUBIC_METER +
  particleSpec('alphaParticle').electricChargeInElementaryUnits *
    MASSIVE_STAR_CORE_ALPHA_DENSITY_PER_CUBIC_METER;
const CNO_STAGE_WAITS_IN_SECONDS = {
  firstCapture: SECONDS_PER_BILLION_YEARS / 1e4,
  bottleneck: SECONDS_PER_BILLION_YEARS / 1e3,
  fullCycle: SECONDS_PER_BILLION_YEARS / 1e2,
};
const CARBON = 6;
const CARBON_MASS_NUMBER = 12;
const HELIUM_CORE_TEMPERATURE_IN_KELVIN = 1.5e8;
const HELIUM_CORE_ALPHA_DENSITY_PER_CUBIC_METER = 5e33;
const HELIUM_CORE_ELECTRON_DENSITY_PER_CUBIC_METER =
  particleSpec('alphaParticle').electricChargeInElementaryUnits *
  HELIUM_CORE_ALPHA_DENSITY_PER_CUBIC_METER;
const HELIUM_BURNING_IN_SECONDS = SECONDS_PER_BILLION_YEARS / 1e5;
const SECONDS_PER_YEAR = SECONDS_PER_BILLION_YEARS / 1e9;
const IRON = 26;
const IRON_MASS_NUMBER = 56;
const S_PROCESS_NEUTRON_DENSITY_PER_CUBIC_METER = 1e14;
const S_PROCESS_HELIUM_DENSITY_PER_CUBIC_METER = 1e30;
const S_PROCESS_ELECTRON_DENSITY_PER_CUBIC_METER =
  particleSpec('alphaParticle').electricChargeInElementaryUnits *
  S_PROCESS_HELIUM_DENSITY_PER_CUBIC_METER;
const S_PROCESS_TEMPERATURE_IN_KELVIN = 3e8;
const S_PROCESS_STAGE_WAITS_IN_SECONDS = {
  early: 50 * SECONDS_PER_YEAR,
  middle: 450 * SECONDS_PER_YEAR,
  late: 1500 * SECONDS_PER_YEAR,
};
const S_PROCESS_SHOTS = 500;
const CARBON_BURNING_TEMPERATURE_IN_KELVIN = 8e8;
const CARBON_BURNING_CARBON_DENSITY_PER_CUBIC_METER = 1e34;
const CARBON_BURNING_ELECTRON_DENSITY_PER_CUBIC_METER =
  CARBON * CARBON_BURNING_CARBON_DENSITY_PER_CUBIC_METER;
const CARBON_BURNING_IN_SECONDS = 100 * SECONDS_PER_YEAR;
const EARLY_UNIVERSE_PROTON_DENSITY_PER_CUBIC_METER = 1e25;
const EARLY_UNIVERSE_NEUTRON_TO_PROTON_RATIO = 0.2;
const EARLY_UNIVERSE_HOT_TEMPERATURE_IN_KELVIN = 1.2e9;
const EARLY_UNIVERSE_COOL_TEMPERATURE_IN_KELVIN = 7e8;
const EARLY_UNIVERSE_HOT_WAIT_IN_SECONDS = 100;
const EARLY_UNIVERSE_COOL_WAIT_IN_SECONDS = 300;
const ROOM_TEMPERATURE_IN_KELVIN = 293;
const WATER_HYDROGEN_DENSITY_PER_CUBIC_METER = 6.7e28;
const NEUTRON_WAIT_IN_SECONDS = 2e-4;
const LAB_PLASMA_TEMPERATURE_IN_KELVIN = 1e4;
const LAB_PLASMA_ELECTRON_DENSITY_PER_CUBIC_METER = 1e20;
const RECOMBINATION_WAIT_IN_SECONDS = 0.02;
const HALF_IONIZED_TEMPERATURE_IN_KELVIN = 2.6e4;
const BALANCE_WAIT_IN_SECONDS = 1e-6;
const PHOTON_ENERGY_IN_EV = 20;
const SLOW_POSITRON_ENERGY_IN_EV = 1;

function momentumForKineticEnergy(particle: ParticleName, kineticInGev: number): number {
  const mass = particleSpec(particle).massInGev.value;
  return Math.sqrt((kineticInGev + mass) ** 2 - mass * mass);
}

export const DEUTERIUM_TRITIUM_BEAM_TEMPLATE = experiment('deuteriumTritiumBeam')
  .describe(
    'Пучок дейтронов 100 кэВ на тритиевой мишени. Канал выбирается по сечениям: синтез d + t → α + n идет через S-фактор Боша–Хейла под кулоновским барьером, а чаще ядра просто кулоновски рассеиваются. Нейтрон уносит 14.1 МэВ из 17.6 МэВ энергии реакции, ядро гелия 3.5 МэВ',
  )
  .parameter(
    'deuteronMomentumInGev',
    momentumForKineticEnergy('deuteron', DEUTERON_BEAM_ENERGY_IN_KEV * GEV_PER_KEV),
  )
  .createNucleus('deuteron', HYDROGEN, DEUTERIUM_MASS_NUMBER, {
    momentumInGev: { x: 0, y: 0, z: '{{deuteronMomentumInGev}}' },
  })
  .createNucleus('triton', HYDROGEN, TRITIUM_MASS_NUMBER)
  .collide(['deuteron', 'triton'], 'collision')
  .report('frequency', ['collision'], 'Что произошло')
  .report('mean', ['collision.kineticEnergyInKev'], 'Энергия в системе центра масс, кэВ')
  .report('mean', ['collision.crossSectionInNanobarns'], 'Полное сечение, нб')
  .report(
    'histogram',
    ['collision.product[1].kineticEnergyInKev'],
    'Кинетическая энергия второго продукта, кэВ',
    SPECTRUM_BINS,
  )
  .build();

export const DEUTERIUM_TRITIUM_PLASMA_TEMPLATE = experiment('deuteriumTritiumPlasma')
  .describe(
    'Дейтрон в тритиевой плазме при 15 кэВ (1.74·10⁸ К) и плотности 10²⁰ м⁻³, как в токамаке. Скорость синтеза n⟨σv⟩: сечение усредняется по Максвеллу, основной вклад дает пик Гамова около 40 кэВ. За секунду сливается несколько процентов ядер; критерий Лоусона требует удерживать плазму дольше',
  )
  .parameter('temperatureInKelvin', PLASMA_TEMPERATURE_IN_KELVIN)
  .parameter('numberDensityPerCubicMeter', PLASMA_DENSITY_PER_CUBIC_METER)
  .parameter('durationInSeconds', 1)
  .createNucleus('deuteron', HYDROGEN, DEUTERIUM_MASS_NUMBER)
  .influence('setMedium', {
    components: [
      { species: 'triton', numberDensityPerCubicMeter: '{{numberDensityPerCubicMeter}}' },
    ],
    temperatureInKelvin: '{{temperatureInKelvin}}',
  })
  .evolve('{{durationInSeconds}}')
  .measureSystem('system')
  .report('frequency', ['system'], 'Состав системы')
  .build();

export const SOLAR_PROTON_CHAIN_TEMPLATE = experiment('solarProtonChain')
  .describe(
    'Протон в ядре Солнца: 15.7 млн К, 3·10³¹ протонов и столько же электронов на м³. Слияние p + p → d e⁺ ν требует слабого распада внутри столкновения, поэтому S-фактор в 10²⁵ раз меньше, чем у d + t: за миллиард лет сливается около восьмой части протонов. Электроны той же среды не дают протону атома: при такой плотности соседние ионы ближе боровского радиуса, понижение континуума снимает связанные уровни, и протон все время голый. Формула Саха без учета давления плазмы держала бы его в атоме 17% времени. В режиме «одна реакция за шаг» родившийся дейтрон ждет следующего шага: за следующую секунду около 40% дейтронов захватывают протон и становятся гелием-3',
  )
  .parameter('temperatureInKelvin', SOLAR_CORE_TEMPERATURE_IN_KELVIN)
  .parameter('numberDensityPerCubicMeter', SOLAR_CORE_PROTON_DENSITY_PER_CUBIC_METER)
  .create('proton', 'proton')
  .influence('setMedium', {
    components: [
      { species: 'proton', numberDensityPerCubicMeter: '{{numberDensityPerCubicMeter}}' },
      { species: 'electron', numberDensityPerCubicMeter: '{{numberDensityPerCubicMeter}}' },
    ],
    temperatureInKelvin: '{{temperatureInKelvin}}',
    reactionMode: 'oneReactionPerStep',
  })
  .evolve(SECONDS_PER_BILLION_YEARS)
  .measureSystem('afterBillionYears')
  .evolve(1)
  .measureSystem('afterOneMoreSecond')
  .report('frequency', ['afterBillionYears'], 'Через миллиард лет')
  .report('frequency', ['afterOneMoreSecond'], 'Еще через секунду')
  .build();

export const SOLAR_HELIUM_CHAIN_TEMPLATE = experiment('solarHeliumChain')
  .describe(
    'Протон в газе ядра Солнца из трех компонентов: протоны 3·10³¹ м⁻³, гелий-3 с долей 10⁻⁵ и электроны для нейтральности, 15.7 млн К. Режим «все реакции за шаг»: родившееся ядро реагирует в остатке того же шага: за 10 млрд лет p + p → d e⁺ ν, за секунды d + p → ³He γ. Около 70% протонов доходят до ³He: столько успевает пройти первую, самую медленную реакцию. Дальше ³He неотличим от гелия-3 газа и растворяется в нем; его собственное горение смотрите в шаблоне starMatterEvolution. При плотности ядра Солнца атомов водорода нет: понижение континуума снимает связанные уровни, газ ионизован полностью',
  )
  .parameter('temperatureInKelvin', SOLAR_CORE_TEMPERATURE_IN_KELVIN)
  .parameter('protonDensityPerCubicMeter', SOLAR_CORE_PROTON_DENSITY_PER_CUBIC_METER)
  .parameter('helionDensityPerCubicMeter', SOLAR_CORE_HELION_DENSITY_PER_CUBIC_METER)
  .parameter('electronDensityPerCubicMeter', SOLAR_CORE_ELECTRON_DENSITY_PER_CUBIC_METER)
  .parameter('durationInSeconds', TEN_BILLION_YEARS_IN_SECONDS)
  .create('proton', 'proton')
  .influence('setMedium', {
    components: [
      { species: 'proton', numberDensityPerCubicMeter: '{{protonDensityPerCubicMeter}}' },
      { species: 'helion', numberDensityPerCubicMeter: '{{helionDensityPerCubicMeter}}' },
      { species: 'electron', numberDensityPerCubicMeter: '{{electronDensityPerCubicMeter}}' },
    ],
    temperatureInKelvin: '{{temperatureInKelvin}}',
    reactionMode: 'allReactionsInStep',
  })
  .evolve('{{durationInSeconds}}')
  .measureSystem('system')
  .report('mean', ['system.count.helion'], 'Ядер гелия-3 на один протон')
  .report('mean', ['system.count.deuteron'], 'Дейтронов на один протон')
  .report('frequency', ['system'], 'Состав системы')
  .build();

export const STAR_MATTER_EVOLUTION_TEMPLATE = experiment('starMatterEvolution')
  .describe(
    'История одного протона в горячем плотном газе звезды: водород, гелий-4, равновесная примесь гелия-3 и электроны. Все числа — параметры, законы те же, что для любой среды. По одной реакции за шаг, чтобы увидеть каждую стадию: за наносекунду видно, что атома водорода нет: понижение континуума в плотной плазме сняло его уровни, хотя Саха обещал бы атом 27% времени; за миллиард лет p + p → d e⁺ ν; за секунду d + p → ³He γ. Дальше ³He неотличим от гелия-3 газа и растворяется в нем; его горение по веткам pp-I, pp-II и pp-III смотрите в шаблоне heliumThreeBranches',
  )
  .parameter('temperatureInKelvin', SOLAR_CORE_TEMPERATURE_IN_KELVIN)
  .parameter('protonDensityPerCubicMeter', STAR_PROTON_DENSITY_PER_CUBIC_METER)
  .parameter('alphaDensityPerCubicMeter', STAR_ALPHA_DENSITY_PER_CUBIC_METER)
  .parameter('helionDensityPerCubicMeter', STAR_HELION_DENSITY_PER_CUBIC_METER)
  .parameter('electronDensityPerCubicMeter', STAR_ELECTRON_DENSITY_PER_CUBIC_METER)
  .create('proton', 'proton')
  .influence('setMedium', {
    components: [
      { species: 'proton', numberDensityPerCubicMeter: '{{protonDensityPerCubicMeter}}' },
      { species: 'alphaParticle', numberDensityPerCubicMeter: '{{alphaDensityPerCubicMeter}}' },
      { species: 'helion', numberDensityPerCubicMeter: '{{helionDensityPerCubicMeter}}' },
      { species: 'electron', numberDensityPerCubicMeter: '{{electronDensityPerCubicMeter}}' },
    ],
    temperatureInKelvin: '{{temperatureInKelvin}}',
    reactionMode: 'oneReactionPerStep',
  })
  .evolve(STAR_STAGE_WAITS_IN_SECONDS.capture)
  .measureSystem('hydrogenBalance')
  .evolve(STAR_STAGE_WAITS_IN_SECONDS.firstFusion)
  .measureSystem('afterBillionYears')
  .evolve(STAR_STAGE_WAITS_IN_SECONDS.deuteronBurn)
  .measureSystem('afterOneSecond')
  .report('frequency', ['hydrogenBalance'], 'Через наносекунду: атом или ион')
  .report('frequency', ['afterBillionYears'], 'Через миллиард лет')
  .report('frequency', ['afterOneSecond'], 'Еще через секунду')
  .report('mean', ['afterOneSecond.count.helion'], 'Ядер гелия-3 на один протон')
  .build();

export const HELIUM_THREE_BRANCHES_TEMPLATE = experiment('heliumThreeBranches')
  .describe(
    'Ядро гелия-3 в горячем плотном газе звезды: водород, гелий-4, примесь гелия-3 и электроны, все числа — параметры. Все реакции разом за сто тысяч лет: ветка pp-I, ³He + ³He → ⁴He + 2p, дает один ⁴He; ветка pp-II, ³He + ⁴He → ⁷Be γ, ведет к ⁷Be, который захватывает электрон газа в ⁷Li и сгорает с протоном в два ⁴He; редкая pp-III — ⁷Be + p → ⁸B γ и β⁺-распад ⁸B в два ⁴He. Доли веток задаются отношением скоростей: n(⁴He)⟨σv⟩₃₄ против n(³He)⟨σv⟩₃₃, а судьба ⁷Be — захватом электронов против захвата протона. Меняйте температуру, плотность и долю гелия: нейтрино ⁷Be и ⁸B следуют за ветками',
  )
  .parameter('temperatureInKelvin', SOLAR_CORE_TEMPERATURE_IN_KELVIN)
  .parameter('protonDensityPerCubicMeter', STAR_PROTON_DENSITY_PER_CUBIC_METER)
  .parameter('alphaDensityPerCubicMeter', STAR_ALPHA_DENSITY_PER_CUBIC_METER)
  .parameter('helionDensityPerCubicMeter', STAR_HELION_DENSITY_PER_CUBIC_METER)
  .parameter('electronDensityPerCubicMeter', STAR_ELECTRON_DENSITY_PER_CUBIC_METER)
  .parameter('helionBurnInSeconds', SECONDS_PER_HUNDRED_THOUSAND_YEARS)
  .create('helion', 'helion')
  .influence('setMedium', {
    components: [
      { species: 'proton', numberDensityPerCubicMeter: '{{protonDensityPerCubicMeter}}' },
      { species: 'alphaParticle', numberDensityPerCubicMeter: '{{alphaDensityPerCubicMeter}}' },
      { species: 'helion', numberDensityPerCubicMeter: '{{helionDensityPerCubicMeter}}' },
      { species: 'electron', numberDensityPerCubicMeter: '{{electronDensityPerCubicMeter}}' },
    ],
    temperatureInKelvin: '{{temperatureInKelvin}}',
    reactionMode: 'allReactionsInStep',
  })
  .evolve('{{helionBurnInSeconds}}')
  .measureSystem('fate')
  .report('mean', ['fate.count.alphaParticle'], 'Ядер гелия-4 на один ³He')
  .report('mean', ['fate.count.electronNeutrino'], 'Нейтрино на один ³He: ветки pp-II и pp-III')
  .report('mean', ['fate.count.positron'], 'Позитронов на один ³He: ветка pp-III')
  .report('mean', ['fate.count.helion'], 'Несгоревших ³He')
  .report('frequency', ['fate'], 'Судьба гелия-3')
  .build();

export const CNO_CYCLE_TEMPLATE = experiment('cnoCycle')
  .describe(
    'Ядро углерода-12 в ядре массивной звезды: водород, гелий и электроны при 20 млн К. Ни одна реакция не прописана вручную: скорости всех захватов протона берутся из библиотеки JINA REACLIB, распады — из NUBASE, и из них сам складывается цикл CNO: ¹²C(p,γ)¹³N, β⁺-распад за 10 минут в ¹³C, ¹³C(p,γ)¹⁴N, медленный ¹⁴N(p,γ)¹⁵O — узкое место цикла с временем около 4 млн лет, распад в ¹⁵N и ¹⁵N(p,α)¹²C, который возвращает углерод. За 100 тысяч лет виден первый захват, за миллион лет большинство ядер ждет в ¹⁴N, за 10 млн лет цикл делает оборот: четыре протона стали ⁴He, двумя позитронами и двумя нейтрино, а вернувшийся углерод за тысячи лет снова уходит в ¹⁴N — поэтому в равновесии цикла почти весь катализатор сидит в азоте, и CNO превращает углерод звезды в азот. Число ⁴He считает обороты. Поднимите температуру до 30 млн К — цикл ускорится в тысячу раз',
  )
  .parameter('temperatureInKelvin', MASSIVE_STAR_CORE_TEMPERATURE_IN_KELVIN)
  .parameter('protonDensityPerCubicMeter', MASSIVE_STAR_CORE_PROTON_DENSITY_PER_CUBIC_METER)
  .parameter('alphaDensityPerCubicMeter', MASSIVE_STAR_CORE_ALPHA_DENSITY_PER_CUBIC_METER)
  .parameter('electronDensityPerCubicMeter', MASSIVE_STAR_CORE_ELECTRON_DENSITY_PER_CUBIC_METER)
  .createNucleus('carbon', CARBON, CARBON_MASS_NUMBER)
  .influence('setMedium', {
    components: [
      { species: 'proton', numberDensityPerCubicMeter: '{{protonDensityPerCubicMeter}}' },
      { species: 'alphaParticle', numberDensityPerCubicMeter: '{{alphaDensityPerCubicMeter}}' },
      { species: 'electron', numberDensityPerCubicMeter: '{{electronDensityPerCubicMeter}}' },
    ],
    temperatureInKelvin: '{{temperatureInKelvin}}',
    reactionMode: 'allReactionsInStep',
  })
  .evolve(CNO_STAGE_WAITS_IN_SECONDS.firstCapture)
  .measureSystem('afterHundredThousandYears')
  .evolve(CNO_STAGE_WAITS_IN_SECONDS.bottleneck)
  .measureSystem('afterMillionYears')
  .evolve(CNO_STAGE_WAITS_IN_SECONDS.fullCycle)
  .measureSystem('afterTenMillionYears')
  .report('frequency', ['afterHundredThousandYears'], 'Через сто тысяч лет')
  .report('frequency', ['afterMillionYears'], 'Через миллион лет')
  .report('frequency', ['afterTenMillionYears'], 'Через десять миллионов лет')
  .report('mean', ['afterTenMillionYears.count.alphaParticle'], 'Оборотов цикла по числу ⁴He')
  .report('mean', ['afterTenMillionYears.count.positron'], 'Позитронов на одно ядро')
  .build();

export const TRIPLE_ALPHA_TEMPLATE = experiment('tripleAlpha')
  .describe(
    'Ядро гелия-4 в гелиевом ядре красного гиганта: 150 млн К, плотность около 30 т/м³. Два ядра не удерживаются — ⁸Be распадается за 10⁻¹⁶ с, поэтому углерод рождается только в тройном столкновении ⁴He + ⁴He + ⁴He → ¹²C + γ; его скорость из REACLIB растёт как квадрат плотности гелия и очень круто с температурой: при этих условиях ядро ждет около 600 лет. Родившийся углерод в том же гелии захватывает ещё одно ядро за сто тысяч лет: ¹²C(α,γ)¹⁶O — так в звездах делится судьба между углеродом и кислородом. За десять тысяч лет почти все ядра стали углеродом и каждое десятое пошло дальше в кислород; удлините время или поднимите температуру, и перевес уйдет к кислороду',
  )
  .parameter('temperatureInKelvin', HELIUM_CORE_TEMPERATURE_IN_KELVIN)
  .parameter('alphaDensityPerCubicMeter', HELIUM_CORE_ALPHA_DENSITY_PER_CUBIC_METER)
  .parameter('electronDensityPerCubicMeter', HELIUM_CORE_ELECTRON_DENSITY_PER_CUBIC_METER)
  .parameter('durationInSeconds', HELIUM_BURNING_IN_SECONDS)
  .create('alpha', 'alphaParticle')
  .influence('setMedium', {
    components: [
      { species: 'alphaParticle', numberDensityPerCubicMeter: '{{alphaDensityPerCubicMeter}}' },
      { species: 'electron', numberDensityPerCubicMeter: '{{electronDensityPerCubicMeter}}' },
    ],
    temperatureInKelvin: '{{temperatureInKelvin}}',
    reactionMode: 'allReactionsInStep',
  })
  .evolve('{{durationInSeconds}}')
  .measureSystem('system')
  .report('frequency', ['system'], 'Чем стало ядро гелия')
  .build();

export const S_PROCESS_IRON_TEMPLATE = experiment('sProcessIron')
  .describe(
    'Ядро железа-56 в гелиевой оболочке звезды-гиганта: нейтроны 10¹⁴ м⁻³, гелий, электроны, 300 млн К. Медленный s-процесс: ядро захватывает нейтрон раз в десяток лет (скорости из REACLIB), а когда изотоп становится нестабильным, β⁻-распад из NUBASE поднимает заряд на единицу. Так из железа по лестнице изотопов рождаются кобальт, никель, медь, цинк и дальше — до бария и свинца. Замер показывает самое тяжелое ядро через 50, 500 и 2000 лет; электроны в системе считают β⁻-распады. Выстрелов 500: каждый проходит сотни реакций',
  )
  .shots(S_PROCESS_SHOTS)
  .parameter('temperatureInKelvin', S_PROCESS_TEMPERATURE_IN_KELVIN)
  .parameter('neutronDensityPerCubicMeter', S_PROCESS_NEUTRON_DENSITY_PER_CUBIC_METER)
  .parameter('heliumDensityPerCubicMeter', S_PROCESS_HELIUM_DENSITY_PER_CUBIC_METER)
  .parameter('electronDensityPerCubicMeter', S_PROCESS_ELECTRON_DENSITY_PER_CUBIC_METER)
  .createNucleus('iron', IRON, IRON_MASS_NUMBER)
  .influence('setMedium', {
    components: [
      { species: 'neutron', numberDensityPerCubicMeter: '{{neutronDensityPerCubicMeter}}' },
      { species: 'alphaParticle', numberDensityPerCubicMeter: '{{heliumDensityPerCubicMeter}}' },
      { species: 'electron', numberDensityPerCubicMeter: '{{electronDensityPerCubicMeter}}' },
    ],
    temperatureInKelvin: '{{temperatureInKelvin}}',
    reactionMode: 'allReactionsInStep',
  })
  .evolve(S_PROCESS_STAGE_WAITS_IN_SECONDS.early)
  .measureSystem('afterFiftyYears')
  .evolve(S_PROCESS_STAGE_WAITS_IN_SECONDS.middle)
  .measureSystem('afterFiveHundredYears')
  .evolve(S_PROCESS_STAGE_WAITS_IN_SECONDS.late)
  .measureSystem('afterTwoThousandYears')
  .report('frequency', ['afterFiftyYears.heaviest'], 'Самое тяжелое ядро через 50 лет')
  .report('frequency', ['afterFiveHundredYears.heaviest'], 'Самое тяжелое ядро через 500 лет')
  .report('frequency', ['afterTwoThousandYears.heaviest'], 'Самое тяжелое ядро через 2000 лет')
  .report('mean', ['afterTwoThousandYears.count.electron'], 'Бета-распадов на пути')
  .report('mean', ['afterTwoThousandYears.heaviestMassNumber'], 'Массовое число через 2000 лет')
  .build();

export const CARBON_BURNING_TEMPLATE = experiment('carbonBurning')
  .describe(
    'Ядро углерода-12 в углеродном ядре массивной звезды после выгорания гелия: 800 млн К, плотность около 200 т/м³, среда — такие же ядра ¹²C и электроны. Два ядра углерода сливаются в возбужденный ²⁴Mg, который тут же сбрасывает частицу: ¹²C + ¹²C → ²⁰Ne + α или ²³Na + p, редко ²³Mg + n. Доли каналов берутся из REACLIB; при этих условиях ядро живет около полувека. За сто лет почти все ядра сгорели, и видно, как делятся неон и натрий — зола, из которой потом горят неон и кислород',
  )
  .parameter('temperatureInKelvin', CARBON_BURNING_TEMPERATURE_IN_KELVIN)
  .parameter('carbonDensityPerCubicMeter', CARBON_BURNING_CARBON_DENSITY_PER_CUBIC_METER)
  .parameter('electronDensityPerCubicMeter', CARBON_BURNING_ELECTRON_DENSITY_PER_CUBIC_METER)
  .parameter('durationInSeconds', CARBON_BURNING_IN_SECONDS)
  .createNucleus('carbon', CARBON, CARBON_MASS_NUMBER)
  .influence('setMedium', {
    components: [
      {
        species: nucleusName(CARBON, CARBON_MASS_NUMBER),
        numberDensityPerCubicMeter: '{{carbonDensityPerCubicMeter}}',
      },
      { species: 'electron', numberDensityPerCubicMeter: '{{electronDensityPerCubicMeter}}' },
    ],
    temperatureInKelvin: '{{temperatureInKelvin}}',
    reactionMode: 'allReactionsInStep',
  })
  .evolve('{{durationInSeconds}}')
  .measureSystem('system')
  .report('frequency', ['system.heaviest'], 'Что стало с углеродом')
  .report('frequency', ['system'], 'Состав системы')
  .build();

export const FIRST_NUCLEI_AFTER_BIG_BANG_TEMPLATE = experiment('firstNucleiAfterBigBang')
  .describe(
    'Нейтрон в первичной плазме через минуты после Большого взрыва: протоны, нейтроны и электроны, плотность барионов 10²⁵ м⁻³. Пока газ горяч, 1.2 млрд К, нейтрон захватывается протоном в дейтрон, но тепловые фотоны тут же разбивают его обратно: это дейтериевое узкое горлышко, скорость фотораспада из REACLIB. Когда газ остыл до 700 млн К, дейтрон выживает, и за минуты цепочка d + p → ³He, d + d, ³He + n → t и t + d доводит нейтрон до ⁴He. Температура каждой стадии — параметр: поднимите холодную до миллиарда, и гелий не соберется',
  )
  .parameter('protonDensityPerCubicMeter', EARLY_UNIVERSE_PROTON_DENSITY_PER_CUBIC_METER)
  .parameter(
    'neutronDensityPerCubicMeter',
    EARLY_UNIVERSE_PROTON_DENSITY_PER_CUBIC_METER * EARLY_UNIVERSE_NEUTRON_TO_PROTON_RATIO,
  )
  .parameter('hotTemperatureInKelvin', EARLY_UNIVERSE_HOT_TEMPERATURE_IN_KELVIN)
  .parameter('coolTemperatureInKelvin', EARLY_UNIVERSE_COOL_TEMPERATURE_IN_KELVIN)
  .create('neutron', 'neutron')
  .influence('setMedium', {
    components: [
      { species: 'proton', numberDensityPerCubicMeter: '{{protonDensityPerCubicMeter}}' },
      { species: 'neutron', numberDensityPerCubicMeter: '{{neutronDensityPerCubicMeter}}' },
      { species: 'electron', numberDensityPerCubicMeter: '{{protonDensityPerCubicMeter}}' },
    ],
    temperatureInKelvin: '{{hotTemperatureInKelvin}}',
    reactionMode: 'allReactionsInStep',
  })
  .evolve(EARLY_UNIVERSE_HOT_WAIT_IN_SECONDS)
  .measureSystem('whileHot')
  .influence('setMedium', {
    components: [
      { species: 'proton', numberDensityPerCubicMeter: '{{protonDensityPerCubicMeter}}' },
      { species: 'neutron', numberDensityPerCubicMeter: '{{neutronDensityPerCubicMeter}}' },
      { species: 'electron', numberDensityPerCubicMeter: '{{protonDensityPerCubicMeter}}' },
    ],
    temperatureInKelvin: '{{coolTemperatureInKelvin}}',
    reactionMode: 'allReactionsInStep',
  })
  .evolve(EARLY_UNIVERSE_COOL_WAIT_IN_SECONDS)
  .measureSystem('afterCooling')
  .report('frequency', ['whileHot.heaviest'], 'Пока горячо: самое тяжелое ядро')
  .report('frequency', ['afterCooling.heaviest'], 'После остывания: самое тяжелое ядро')
  .report('frequency', ['afterCooling'], 'Состав после остывания')
  .build();

export const NEUTRON_CAPTURE_TEMPLATE = experiment('neutronCaptureInHydrogen')
  .describe(
    'Тепловой нейтрон в водороде с плотностью атомов воды при комнатной температуре. Захват n + p → d + γ идет по закону 1/v с сечением 0.3326 б при 2200 м/с (NIST): за 0.2 мс захватывается около двух третей нейтронов, рождая дейтрон и гамма-квант 2.2 МэВ. Это первый шаг нуклеосинтеза',
  )
  .parameter('durationInSeconds', NEUTRON_WAIT_IN_SECONDS)
  .create('neutron', 'neutron')
  .influence('setMedium', {
    components: [
      { species: 'proton', numberDensityPerCubicMeter: WATER_HYDROGEN_DENSITY_PER_CUBIC_METER },
    ],
    temperatureInKelvin: ROOM_TEMPERATURE_IN_KELVIN,
  })
  .evolve('{{durationInSeconds}}')
  .measureSystem('system')
  .report('frequency', ['system'], 'Состав системы')
  .build();

export const HYDROGEN_RECOMBINATION_TEMPLATE = experiment('hydrogenRecombination')
  .describe(
    'Протон в электронном газе при 10⁴ К и 10²⁰ м⁻³: электрон захватывается с излучением фотона, скорость по сечению Крамерса, просуммированному по оболочкам. Так из плазмы рождаются атомы водорода; за 20 мс рекомбинирует около половины протонов',
  )
  .parameter('temperatureInKelvin', LAB_PLASMA_TEMPERATURE_IN_KELVIN)
  .parameter('durationInSeconds', RECOMBINATION_WAIT_IN_SECONDS)
  .create('proton', 'proton')
  .influence('setMedium', {
    components: [
      {
        species: 'electron',
        numberDensityPerCubicMeter: LAB_PLASMA_ELECTRON_DENSITY_PER_CUBIC_METER,
      },
    ],
    temperatureInKelvin: '{{temperatureInKelvin}}',
  })
  .evolve('{{durationInSeconds}}')
  .measureSystem('system')
  .report('frequency', ['system'], 'Состав системы')
  .build();

export const HYDROGEN_PLASMA_BALANCE_TEMPLATE = experiment('hydrogenPlasmaBalance')
  .describe(
    'Атом водорода в электронном газе плотности Лошмидта (2.69·10²⁵ м⁻³). Электронный удар отрывает электрон (аппроксимация Воронова 1997), обратно его возвращают радиационная и тройная рекомбинация; тройная выведена из детального равновесия с ионизацией, поэтому при такой плотности доля протонов идет по Саха: при 10⁴ К водород цел (протонов 10⁻⁵), при 2.6·10⁴ К протонов и атомов почти поровну, при 5·10⁴ К разбито 98%. Равновесие устанавливается за наносекунды. Меняйте температуру',
  )
  .parameter('temperatureInKelvin', HALF_IONIZED_TEMPERATURE_IN_KELVIN)
  .createAtom('hydrogen', HYDROGEN)
  .influence('setMedium', {
    components: [
      {
        species: 'electron',
        numberDensityPerCubicMeter: LOSCHMIDT_CONSTANT_AT_273_15_K_101_325_KPA.value,
      },
    ],
    temperatureInKelvin: '{{temperatureInKelvin}}',
  })
  .evolve(BALANCE_WAIT_IN_SECONDS)
  .measureSystem('system')
  .report('frequency', ['system'], 'Состав системы')
  .build();

export const PHOTOIONIZATION_TEMPLATE = experiment('photoionization')
  .describe(
    'Фотон 20 эВ на атоме водорода: энергии хватает, чтобы оторвать электрон (13.6 эВ). Сечение фотоионизации по Крамерсу около 2.5·10⁻¹⁸ см², томсоновское рассеяние на электроне в 10¹⁰ раз меньше. Фотоэлектрон уносит 20 − 13.6 = 6.4 эВ',
  )
  .parameter('photonMomentumInGev', PHOTON_ENERGY_IN_EV * GEV_PER_EV)
  .createAtom('atom', HYDROGEN)
  .create('photon', 'photon', { momentumInGev: { x: 0, y: 0, z: '{{photonMomentumInGev}}' } })
  .collide(['atom', 'photon'], 'collision')
  .report('frequency', ['collision'], 'Продукты')
  .report('mean', ['collision.crossSectionInNanobarns'], 'Сечение, нб')
  .report('mean', ['collision.product[1].kineticEnergyInKev'], 'Энергия фотоэлектрона, кэВ')
  .build();

export const ANTIHYDROGEN_TEMPLATE = experiment('antihydrogen')
  .describe(
    'Антипротон и медленный позитрон 1 эВ: как в экспериментах ALPHA в ЦЕРН, позитрон захватывается с излучением фотона и рождается атом антиводорода. Отбор канала оставляет только рекомбинацию: без него почти все встречи заканчиваются кулоновским рассеянием',
  )
  .parameter(
    'positronMomentumInGev',
    momentumForKineticEnergy('positron', SLOW_POSITRON_ENERGY_IN_EV * GEV_PER_EV),
  )
  .create('antiproton', 'antiProton')
  .create('positron', 'positron', { momentumInGev: { x: 0, y: 0, z: '{{positronMomentumInGev}}' } })
  .collide(['antiproton', 'positron'], 'collision', 'antiHydrogenAtom+photon')
  .report('frequency', ['collision'], 'Продукты')
  .report('mean', ['collision.crossSectionInNanobarns'], 'Сечение рекомбинации, нб')
  .build();
