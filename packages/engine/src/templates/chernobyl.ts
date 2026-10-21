/* Templates of the RBMK lattice of Chernobyl unit 4: a cube with mirror walls is one repeating cell of an endless core, eight homogenised fuel channels of burnt uranium dioxide with
   xenon, samarium and boiling water around a control-rod channel in graphite. In the stable one a boron carbide rod holds the chain; in the disaster one the rods are out, graphite displacers
   stand in their channels and the coolant boils into steam. Every collision, absorption and fission comes from ENDF/B-VIII.0; nothing in the plan says whether the chain grows. */
import { ATOMIC_MASS_CONSTANT, elementRecord } from '@standard-model/constants';
import { FEMTOMETERS_PER_METER } from '@standard-model/utils';
import type { KeyframeWatch } from '@standard-model/contracts';
import { experiment, type ExperimentBuilder } from '../experiment/experiment-builder.js';
import {
  SEED_MOMENTUM_IN_GEV,
  WATER_MOLECULE,
  WATER_MOLECULES_PER_CUBIC_METER,
} from './fission.js';

const HYDROGEN = 1;
const BORON = 5;
const CARBON = 6;
const OXYGEN = 8;
const URANIUM = 92;
const PLUTONIUM = 94;
const FISSILE_URANIUM = 235;
const FERTILE_URANIUM = 238;
const FISSILE_PLUTONIUM = 239;
const FERTILE_PLUTONIUM = 240;
const XENON = 54;
const SAMARIUM = 62;
const XENON_POISON = 135;
const SAMARIUM_POISON = 149;
const CARBON_MASS_NUMBER = 12;
const OXYGEN_MASS_NUMBER = 16;
const LIGHT_BORON = 10;
const HEAVY_BORON = 11;
const OXYGEN_PER_OXIDE = 2;
const BORON_PER_CARBIDE = 4;
const HYDROGEN_PER_WATER = 2;
const LATTICE_PITCH_IN_METERS = 0.25;
const SITES_PER_SIDE = 3;
const CELL_EDGE_IN_METERS = SITES_PER_SIDE * LATTICE_PITCH_IN_METERS;
const GRID_POINTS_PER_AXIS = 32;
const CHANNEL_DIAMETER_IN_METERS = 0.08;
const ROD_DIAMETER_IN_METERS = 0.07;
const CRITICAL_ROD_INSERTION_IN_METERS = 0.3;
const GRAPHITE_DENSITY_IN_KILOGRAMS_PER_CUBIC_METER = 1700;
const OXIDE_DENSITY_IN_KILOGRAMS_PER_CUBIC_METER = 10400;
const CARBIDE_DENSITY_IN_KILOGRAMS_PER_CUBIC_METER = 1800;
const SATURATED_WATER_DENSITY_IN_KILOGRAMS_PER_CUBIC_METER = 740;
const SATURATED_STEAM_DENSITY_IN_KILOGRAMS_PER_CUBIC_METER = 36.5;
const FUEL_FRACTION_OF_CHANNEL = 0.52;
const BURNT_FISSILE_URANIUM_FRACTION = 0.011;
const BRED_PLUTONIUM_FRACTION = 0.003;
const HEAVY_PLUTONIUM_FRACTION = 0.0008;
const EQUILIBRIUM_XENON_FRACTION = 1.8e-7;
const EQUILIBRIUM_SAMARIUM_FRACTION = 1.2e-6;
const XENON_PIT_FACTOR = 1.5;
const GRAPHITE_TEMPERATURE_IN_KELVIN = 900;
const COOLANT_TEMPERATURE_IN_KELVIN = 558;
const ROD_COOLANT_TEMPERATURE_IN_KELVIN = 323;
const SEED_NEUTRONS_PER_CHANNEL = 8;
const FRAME_IN_SECONDS = 1e-3;
const FRAMES = 12;
const FRAMES_BEFORE_BOILING = 4;
const REPORT_EVERY = 4;
const SHOTS = 12;
const MILLISECONDS_PER_SECOND = 1000;
const REACTOR_THERMAL_POWER_IN_WATTS = 3.2e9;
const REACTOR_FUEL_CHANNELS = 1661;
const CORE_HEIGHT_IN_METERS = 7;
const SAMPLED_CHANNEL_POWER_IN_WATTS = 4.19e-8;
const PARTICLE_WEIGHT =
  ((REACTOR_THERMAL_POWER_IN_WATTS / REACTOR_FUEL_CHANNELS) *
    (CELL_EDGE_IN_METERS / CORE_HEIGHT_IN_METERS)) /
  SAMPLED_CHANNEL_POWER_IN_WATTS;
const WATCHED_CHANNEL = 'channel1';
const WATCHED_GRAPHITE = 'graphite';
const KEYFRAME_WATCH: readonly KeyframeWatch[] = [
  { target: WATCHED_CHANNEL, quantity: 'temperatureInKelvin' },
  { target: WATCHED_CHANNEL, quantity: 'absorbedEnergyInJoules' },
  { target: WATCHED_GRAPHITE, quantity: 'temperatureInKelvin' },
  { target: WATCHED_GRAPHITE, quantity: 'absorbedEnergyInJoules' },
  { target: 'system', quantity: 'count.neutron' },
  { target: 'system', quantity: 'pendingNeutrons' },
];

function atomicWeight(protons: number): number {
  return elementRecord(protons)?.standardAtomicWeight ?? 0;
}

function moleculesPerCubicMeter(
  densityInKilogramsPerCubicMeter: number,
  atomicWeights: readonly number[],
): number {
  return (
    densityInKilogramsPerCubicMeter /
    (atomicWeights.reduce((sum, weight) => sum + weight, 0) * ATOMIC_MASS_CONSTANT.value)
  );
}

function atom(protons: number, massNumber: number): string {
  return `atom:${String(protons)}:${String(massNumber)}:0`;
}

const lightBoronAbundance =
  elementRecord(BORON)?.isotopes.find((isotope) => isotope.massNumber === LIGHT_BORON)?.abundance ??
  0;
const graphiteAtoms = moleculesPerCubicMeter(GRAPHITE_DENSITY_IN_KILOGRAMS_PER_CUBIC_METER, [
  atomicWeight(CARBON),
]);
const heavyAtomsInChannel =
  FUEL_FRACTION_OF_CHANNEL *
  moleculesPerCubicMeter(OXIDE_DENSITY_IN_KILOGRAMS_PER_CUBIC_METER, [
    atomicWeight(URANIUM),
    ...Array.from({ length: OXYGEN_PER_OXIDE }, () => atomicWeight(OXYGEN)),
  ]);
const waterWeights = [
  ...Array.from({ length: HYDROGEN_PER_WATER }, () => atomicWeight(HYDROGEN)),
  atomicWeight(OXYGEN),
];
const coolantInChannel = (densityInKilogramsPerCubicMeter: number): number =>
  (1 - FUEL_FRACTION_OF_CHANNEL) *
  moleculesPerCubicMeter(densityInKilogramsPerCubicMeter, waterWeights);
const carbideMolecules = moleculesPerCubicMeter(CARBIDE_DENSITY_IN_KILOGRAMS_PER_CUBIC_METER, [
  ...Array.from({ length: BORON_PER_CARBIDE }, () => atomicWeight(BORON)),
  atomicWeight(CARBON),
]);

const SITES = [-1, 0, 1]
  .flatMap((column) => [-1, 0, 1].map((row) => [column, row] as const))
  .filter(([column, row]) => column !== 0 || row !== 0);
const SEED_SITES = SITES.filter(([column, row]) => column === 0 || row === 0);

function channel(builder: ExperimentBuilder, index: number, coolant: string): ExperimentBuilder {
  const [column = 0, row = 0] = SITES[index] ?? [];
  return builder.influence('placeBody', {
    name: `channel${String(index + 1)}`,
    shape: 'cylinder',
    sizeInMeters: CHANNEL_DIAMETER_IN_METERS,
    heightInMeters: CELL_EDGE_IN_METERS,
    xCenterInMeters: column * LATTICE_PITCH_IN_METERS,
    yCenterInMeters: row * LATTICE_PITCH_IN_METERS,
    zCenterInMeters: 0,
    components: [
      {
        species: atom(URANIUM, FISSILE_URANIUM),
        numberDensityPerCubicMeter: '{{uranium235DensityPerCubicMeter}}',
      },
      {
        species: atom(URANIUM, FERTILE_URANIUM),
        numberDensityPerCubicMeter:
          heavyAtomsInChannel *
          (1 - BURNT_FISSILE_URANIUM_FRACTION - BRED_PLUTONIUM_FRACTION - HEAVY_PLUTONIUM_FRACTION),
      },
      {
        species: atom(PLUTONIUM, FERTILE_PLUTONIUM),
        numberDensityPerCubicMeter: heavyAtomsInChannel * HEAVY_PLUTONIUM_FRACTION,
      },
      {
        species: atom(XENON, XENON_POISON),
        numberDensityPerCubicMeter: '{{xenon135DensityPerCubicMeter}}',
      },
      {
        species: atom(SAMARIUM, SAMARIUM_POISON),
        numberDensityPerCubicMeter: heavyAtomsInChannel * EQUILIBRIUM_SAMARIUM_FRACTION,
      },
      {
        species: atom(PLUTONIUM, FISSILE_PLUTONIUM),
        numberDensityPerCubicMeter: '{{plutonium239DensityPerCubicMeter}}',
      },
      {
        species: atom(OXYGEN, OXYGEN_MASS_NUMBER),
        numberDensityPerCubicMeter: OXYGEN_PER_OXIDE * heavyAtomsInChannel,
      },
      { species: WATER_MOLECULE, numberDensityPerCubicMeter: `{{${coolant}}}` },
    ],
    temperatureInKelvin: COOLANT_TEMPERATURE_IN_KELVIN,
  });
}

function channels(builder: ExperimentBuilder, coolant: string): ExperimentBuilder {
  return SITES.reduce((chain, site, index) => channel(chain, index, coolant), builder);
}

function lattice(name: string, description: string, xenonFactor: number): ExperimentBuilder {
  return experiment(name)
    .describe(description)
    .categorize('space', 'nuclear')
    .shots(SHOTS)
    .weigh(PARTICLE_WEIGHT)
    .parameter(
      'uranium235DensityPerCubicMeter',
      heavyAtomsInChannel * BURNT_FISSILE_URANIUM_FRACTION,
    )
    .parameter('plutonium239DensityPerCubicMeter', heavyAtomsInChannel * BRED_PLUTONIUM_FRACTION)
    .parameter(
      'xenon135DensityPerCubicMeter',
      heavyAtomsInChannel * EQUILIBRIUM_XENON_FRACTION * xenonFactor,
    )
    .parameter(
      'coolantDensityPerCubicMeter',
      coolantInChannel(SATURATED_WATER_DENSITY_IN_KILOGRAMS_PER_CUBIC_METER),
    )
    .space({
      gridPointsPerAxis: GRID_POINTS_PER_AXIS,
      cellSizeInMeters: CELL_EDGE_IN_METERS / GRID_POINTS_PER_AXIS,
      potential: 'free',
      walls: 'reflecting',
    })
    .influence('placeBody', {
      name: 'graphite',
      shape: 'box',
      sizeInMeters: CELL_EDGE_IN_METERS,
      components: [
        { species: atom(CARBON, CARBON_MASS_NUMBER), numberDensityPerCubicMeter: graphiteAtoms },
      ],
      temperatureInKelvin: GRAPHITE_TEMPERATURE_IN_KELVIN,
    });
}

function rodChannel(builder: ExperimentBuilder): ExperimentBuilder {
  return builder.influence('placeBody', {
    name: 'rodChannel',
    shape: 'cylinder',
    sizeInMeters: CHANNEL_DIAMETER_IN_METERS,
    heightInMeters: CELL_EDGE_IN_METERS,
    components: [
      { species: WATER_MOLECULE, numberDensityPerCubicMeter: WATER_MOLECULES_PER_CUBIC_METER },
    ],
    temperatureInKelvin: ROD_COOLANT_TEMPERATURE_IN_KELVIN,
  });
}

function seeded(builder: ExperimentBuilder): ExperimentBuilder {
  return SEED_SITES.reduce(
    (chain, [column, row], index) =>
      chain.create(`seed${String(index + 1)}`, 'neutron', {
        momentumInGev: { x: 0, y: 0, z: SEED_MOMENTUM_IN_GEV },
        positionInFemtometers: {
          x: column * LATTICE_PITCH_IN_METERS * FEMTOMETERS_PER_METER,
          y: row * LATTICE_PITCH_IN_METERS * FEMTOMETERS_PER_METER,
          z: 0,
        },
        count: SEED_NEUTRONS_PER_CHANNEL,
      }),
    builder,
  );
}

function frames(builder: ExperimentBuilder, first: number, last: number): ExperimentBuilder {
  return Array.from({ length: last - first + 1 }, (unused, index) => first + index).reduce(
    (chain, frame) => {
      const measured = chain.evolve(FRAME_IN_SECONDS).measureSystem(`frame${String(frame)}`);
      return frame % REPORT_EVERY === 0
        ? measured.report(
            'mean',
            [`frame${String(frame)}.count.neutron`],
            `Нейтронов через ${String(Math.round(frame * FRAME_IN_SECONDS * MILLISECONDS_PER_SECOND))} мс`,
          )
        : measured;
    },
    builder,
  );
}

function closing(builder: ExperimentBuilder): ExperimentBuilder {
  return builder
    .report('mean', [`frame${String(FRAMES)}.pendingNeutrons`], 'Ждут запаздывающие нейтроны')
    .report(
      'mean',
      [`frame${String(FRAMES)}.channel1.absorbedEnergyInJoules`],
      'Выделилось в одном топливном канале, Дж',
    )
    .report(
      'mean',
      [`frame${String(FRAMES)}.graphite.absorbedEnergyInJoules`],
      'Получил графит, Дж',
    );
}

type Stage = (builder: ExperimentBuilder) => ExperimentBuilder;

function keyframe(name: string): Stage {
  return (builder) => builder.keyframe(name, KEYFRAME_WATCH);
}

function staged(builder: ExperimentBuilder, ...stages: readonly Stage[]): ExperimentBuilder {
  return stages.reduce((chain, stage) => stage(chain), builder);
}

function controlRod(builder: ExperimentBuilder): ExperimentBuilder {
  return builder.influence('placeBody', {
    name: 'rod',
    shape: 'cylinder',
    sizeInMeters: ROD_DIAMETER_IN_METERS,
    heightInMeters: '{{rodInsertionInMeters}}',
    components: [
      {
        species: atom(BORON, LIGHT_BORON),
        numberDensityPerCubicMeter: BORON_PER_CARBIDE * carbideMolecules * lightBoronAbundance,
      },
      {
        species: atom(BORON, HEAVY_BORON),
        numberDensityPerCubicMeter:
          BORON_PER_CARBIDE * carbideMolecules * (1 - lightBoronAbundance),
      },
      { species: atom(CARBON, CARBON_MASS_NUMBER), numberDensityPerCubicMeter: carbideMolecules },
    ],
    temperatureInKelvin: ROD_COOLANT_TEMPERATURE_IN_KELVIN,
  });
}

function displacer(builder: ExperimentBuilder): ExperimentBuilder {
  return builder.influence('placeBody', {
    name: 'displacer',
    shape: 'cylinder',
    sizeInMeters: ROD_DIAMETER_IN_METERS,
    heightInMeters: CELL_EDGE_IN_METERS,
    components: [
      { species: atom(CARBON, CARBON_MASS_NUMBER), numberDensityPerCubicMeter: graphiteAtoms },
    ],
    temperatureInKelvin: ROD_COOLANT_TEMPERATURE_IN_KELVIN,
  });
}

export const CHERNOBYL_STABLE_TEMPLATE = staged(
  lattice(
    'chernobylStable',
    'Реактор РБМК-1000, как 4-й блок Чернобыльской АЭС, в нормальной работе. Куб с ребром 75 см и зеркальными стенками — одна повторяющаяся ячейка бесконечной активной зоны: графитовая кладка, восемь топливных каналов с шагом 25 см и в центре канал стержня управления. Топливный канал диаметром 8 см — смесь диоксида урана и кипящей воды при 285 °C и 7 МПа (740 кг/м³). Уран был обогащен до 2%, но уже выгорел, как в апреле 1986 года: урана-235 осталось 1,1%, накопилось 0,3% плутония-239 и 0,08% плутония-240, а из осколков — ксенон-135 и самарий-149 в равновесных для полной мощности количествах. Графит замедляет нейтроны; вода в каналах тоже замедляет, но больше поглощает. Стержень управления — не графит, а карбид бора: бор-10 поглощает тепловой нейтрон в реакции (n,α) с сечением 3840 барн. Регулятор держит стержень введенным на 30 см из 75 см слоя. На этой глубине каждое поколение мгновенных нейтронов чуть меньше предыдущего, и за 12 мс число нейтронов почти не меняется. Недостающую долю дают запаздывающие нейтроны: около 0,7% нейтронов деления осколки испускают через секунды. Они копятся в счетчике «ждут запаздывающие нейтроны», и именно они делают реактор управляемым: мощность меняется за десятки секунд, а не за миллисекунды. Введите стержень на все 75 см — нейтронов станет меньше; уменьшите до 10 см — пойдет рост. Каждый смоделированный нейтрон стоит за 4,9·10¹² настоящих (вес частицы в настройках плана): тогда топливный канал получает свою долю мощности реактора 3200 МВт, около 200 кВт на 75 см канала. Ключевые кадры start, early и end следят за каналом channel1, графитом и числом нейтронов: в таблице результата видно, что канал за 12 мс набирает около 2 кДж и греется примерно на 20 К/с — в настоящем реакторе это тепло уносит вода, а в ячейке отвода тепла нет. Каждое столкновение, поглощение и деление — из ENDF/B-VIII.0 с восстановленными резонансами; остальных продуктов деления в ячейке нет',
    1,
  ).parameter('rodInsertionInMeters', CRITICAL_ROD_INSERTION_IN_METERS),
  (builder) => channels(builder, 'coolantDensityPerCubicMeter'),
  rodChannel,
  controlRod,
  seeded,
  keyframe('start'),
  (builder) => frames(builder, 1, FRAMES_BEFORE_BOILING),
  keyframe('early'),
  (builder) => frames(builder, FRAMES_BEFORE_BOILING + 1, FRAMES),
  keyframe('end'),
  closing,
).build();

export const CHERNOBYL_DISASTER_TEMPLATE = staged(
  lattice(
    'chernobylDisaster',
    'Та же ячейка РБМК в ночь на 26 апреля 1986 года. После долгой работы на половинной мощности и провала до 30 МВт реактор попал в «йодную яму»: ксенона-135 в топливе примерно в полтора раза больше равновесного. Чтобы поднять мощность, операторы вынули почти все стержни. Под каждым стержнем РБМК висел графитовый вытеснитель, поэтому в канале стержня теперь стоит графит, а не карбид бора, и поглощающей воды там почти нет. Ячейка уже надкритична: за первые 4 мс нейтронов становится больше. На испытании выбега турбины насосы сбавили расход, и через 4 мс вода в топливных каналах вскипает: шаги placeBody заменяют ее паром (36,5 кг/м³ при 7 МПа). В РБМК замедляет графит, а вода в каналах больше поглощает нейтроны, чем замедляет, пар же почти ничего не поглощает. Поэтому при кипении реактивность растет — это положительный паровой коэффициент; плутоний-239 с резонансом деления на 0,3 эВ его усиливает. Реактор мгновенно-критичен: цепь растет на одних мгновенных нейтронах, за миллисекунды, и запаздывающие нейтроны ее уже не сдерживают. За 12 мс нейтронов становится почти втрое больше, а в стабильной ячейке их почти столько же, сколько в начале; в кубе видно, как вспыхивают осколки. Поставьте плотность пара равной плотности воды из coolantDensityPerCubicMeter — рост замедлится. С тем же весом частицы, что и в стабильной ячейке, ключевые кадры start, boiling и end показывают разгон в цифрах: после кипения средняя мощность канала channel1 растет примерно с 230 до 350 кВт, нагрев — с 27 до 110 К/с (у пара теплоемкость меньше, чем у воды), а нейтронов к 12 мс в два с половиной раза больше. Канал при замене воды паром остается тем же телом: его температура и накопленная энергия сохраняются. В реальности после нажатия АЗ-5 стержни пошли вниз, и графитовые концы сначала вытеснили воду из низа каналов, добавив еще реактивности; мощность выросла в сотни раз за несколько секунд, и пар разорвал реактор. Остальных продуктов деления в ячейке нет, поэтому запас реактивности здесь больше настоящего, и разгон быстрее',
    XENON_PIT_FACTOR,
  ).parameter(
    'steamDensityPerCubicMeter',
    coolantInChannel(SATURATED_STEAM_DENSITY_IN_KILOGRAMS_PER_CUBIC_METER),
  ),
  (builder) => channels(builder, 'coolantDensityPerCubicMeter'),
  rodChannel,
  displacer,
  seeded,
  keyframe('start'),
  (builder) => frames(builder, 1, FRAMES_BEFORE_BOILING),
  keyframe('boiling'),
  (builder) => channels(builder, 'steamDensityPerCubicMeter'),
  (builder) => frames(builder, FRAMES_BEFORE_BOILING + 1, FRAMES),
  keyframe('end'),
  closing,
).build();

export const CHERNOBYL_TEMPLATES = [CHERNOBYL_STABLE_TEMPLATE, CHERNOBYL_DISASTER_TEMPLATE];
