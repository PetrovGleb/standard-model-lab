/* Templates of chemistry with many atoms: a methane farm of carbon atoms in atomic hydrogen, carbon vapour clustering into chains, carbon burning in atomic oxygen and a primordial soup of
   carbon, nitrogen and oxygen in hot hydrogen; every bond comes from the same association law, the templates only set the medium and the atoms. */
import {
  AVOGADRO_CONSTANT,
  ENVIRONMENT_PRESETS,
  MOLECULE_CATALOG,
} from '@standard-model/constants';
import type { BondOrder } from '@standard-model/contracts';
import { experiment, type ExperimentBuilder } from '../experiment/experiment-builder.js';
import { HYDROXIDE } from '../molecules/proton-transfer.js';

const HYDROGEN_DENSITY_PER_CUBIC_METER = 1e24;
const CARBON = 6;
const CARBON_MASS_NUMBER = 12;
const NITROGEN = 7;
const NITROGEN_MASS_NUMBER = 14;
const OXYGEN = 8;
const OXYGEN_MASS_NUMBER = 16;
const FARM_ATOMS = 20;
const FARM_TEMPERATURE_IN_KELVIN = 1000;
const VAPOR_ATOMS = 20;
const VAPOR_TEMPERATURE_IN_KELVIN = 3000;
const VAPOR_DENSITY_PER_CUBIC_METER = 1e24;
const BURNING_ATOMS = 12;
const BURNING_TEMPERATURE_IN_KELVIN = 1500;
const OXYGEN_DENSITY_PER_CUBIC_METER = 1e24;
const SOUP_ATOMS_PER_ELEMENT = 6;
const SOUP_TEMPERATURE_IN_KELVIN = 1000;
const FIRST_LOOK_IN_SECONDS = 5e-9;
const NANOSECONDS_PER_SECOND = 1e9;
const LAST_LOOK_IN_SECONDS = 1e-6;
const VAPOR_LOOK_IN_SECONDS = 1e-8;
const BURNING_LAST_LOOK_IN_SECONDS = 3e-5;
const CHEMISTRY_SHOTS = 2000;
const PRESS_SHOTS = 100;
const HYDROGEN_MOLECULE = 'molecule:1-1,1-1;0-1-1';
const OXYGEN_MOLECULE = 'molecule:8-16,8-16;0-1-2';
const HYDROGEN = 1;
const HYDROGEN_MASS_NUMBER = 1;
const MIXTURE_HYDROGEN_DENSITY_PER_CUBIC_METER = 4e24;
const MIXTURE_OXYGEN_DENSITY_PER_CUBIC_METER = 2e24;
const IGNITION_TEMPERATURE_IN_KELVIN = 1200;
const SPARK_ATOMS = 3;
const GENERATION_IN_SECONDS = 2e-7;
const GENERATIONS = 6;
const COAL_ATOMS = 6;
const COAL_TEMPERATURE_IN_KELVIN = 1000;
const COAL_OXYGEN_DENSITY_PER_CUBIC_METER = 4e24;
const COAL_FIRST_LOOK_IN_SECONDS = 1e-6;
const COAL_LAST_LOOK_IN_SECONDS = 1e-4;
const WATER_MOLECULE = 'molecule:8-16,1-1,1-1;0-1-1,0-2-1';
const AIR_DENSITY_PER_CUBIC_METER = 2.5e25;
const SOLUTION_TEMPERATURE_IN_KELVIN = 298.15;
const SOLUTION_SHOTS = 1000;
const SOLUTION_WAIT_IN_SECONDS = 1e-9;
const LITERS_PER_CUBIC_METER = 1000;
const ACID_MOLARITY = 0.1;
const HYDROGEN_FLUORIDE = 9;
const FLUORINE_MASS_NUMBER = 19;
const CHLORINE = 17;
const CHLORINE_MASS_NUMBER = 35;
const SODIUM = 11;
const SODIUM_MASS_NUMBER = 23;
const ELECTROLYSIS_MOLECULES = 6;
const ELECTROLYSIS_VOLTAGE_IN_VOLTS = 3;
const ELECTROLYSIS_CURRENT_IN_AMPERES = 1;
const ELECTROLYSIS_TIME_IN_SECONDS = 1e-3;
const STANDARD_ATMOSPHERE_IN_PASCALS = 101325;
const ROOM_TEMPERATURE_IN_KELVIN = 293;
const PRESS_PRESSURE_IN_PASCALS = 6e9;
const PRESS_TEMPERATURE_IN_KELVIN = 1700;
const MELT_TEMPERATURE_IN_KELVIN = 5000;
const GRAPHITE_NUMBER_DENSITY_PER_CUBIC_METER = 1.1e29;

function addAtoms(
  builder: ExperimentBuilder,
  label: string,
  protons: number,
  massNumber: number,
  count: number,
): ExperimentBuilder {
  return builder.createAtom(label, protons, { massNumber, count });
}

function gas(species: string, density: string, temperature: string) {
  return {
    components: [{ species, numberDensityPerCubicMeter: density }],
    temperatureInKelvin: temperature,
    reactionMode: 'allReactionsInStep',
  };
}

export const METHANE_FARM_TEMPLATE = addAtoms(
  experiment('methaneFarm')
    .describe(
      'Двадцать атомов углерода в газе атомарного водорода при 1000 К. Углерод четырехвалентен, водород одновалентен, и закон связывания собирает каждый атом по шагам: CH, CH₂, CH₃ и метан CH₄, после которого пятый водород уже не пристает. Скорость соединения следует из детального равновесия с распадом связи C–H 411 кДж/моль. Через 5 нс в системе пестрая смесь радикалов, к микросекунде — двадцать молекул метана. На сцене одинаковые молекулы собираются в одну метку «×20 CH₄»',
    )
    .categorize('chemistry', 'molecules')
    .shots(CHEMISTRY_SHOTS)
    .parameter('temperatureInKelvin', FARM_TEMPERATURE_IN_KELVIN)
    .parameter('hydrogenDensityPerCubicMeter', HYDROGEN_DENSITY_PER_CUBIC_METER)
    .influence('setTemperature', { temperatureInKelvin: '{{temperatureInKelvin}}' })
    .influence(
      'setMedium',
      gas('hydrogenAtom', '{{hydrogenDensityPerCubicMeter}}', '{{temperatureInKelvin}}'),
    ),
  'carbon',
  CARBON,
  CARBON_MASS_NUMBER,
  FARM_ATOMS,
)
  .evolve(FIRST_LOOK_IN_SECONDS)
  .measureSystem('afterFiveNanoseconds')
  .evolve(LAST_LOOK_IN_SECONDS)
  .measureSystem('afterMicrosecond')
  .report('mean', ['afterFiveNanoseconds.count.CH4'], 'Молекул CH₄ через 5 нс')
  .report('mean', ['afterMicrosecond.count.CH4'], 'Молекул CH₄ через микросекунду')
  .report('mean', ['afterMicrosecond.particleCount'], 'Частиц через микросекунду')
  .build();

export const CARBON_VAPOR_CLUSTERS_TEMPLATE = addAtoms(
  experiment('carbonVaporClusters')
    .describe(
      'Двадцать атомов углерода в углеродном паре при 3000 К. Атом пара тоже четырехвалентен, и связь между двумя атомами углерода сразу берет все свободные валентности, какие может: C + C дает C≡C, дальше к концам цепочки пристают новые атомы. Кластер берет атомы из пара, а при распаде отдает осколки, поэтому частиц становится больше, чем было атомов. Так в остывающем паре рождаются кластеры C₂–C₅ — первая стадия сажи, углеродных нанотрубок и фуллеренов. Закон тот же, что собирал метан; меняйте температуру: горячий пар держит атомы порознь, холодный слипается в длинные цепочки',
    )
    .categorize('chemistry', 'molecules')
    .shots(CHEMISTRY_SHOTS)
    .parameter('temperatureInKelvin', VAPOR_TEMPERATURE_IN_KELVIN)
    .parameter('carbonVaporDensityPerCubicMeter', VAPOR_DENSITY_PER_CUBIC_METER)
    .influence('setTemperature', { temperatureInKelvin: '{{temperatureInKelvin}}' })
    .influence(
      'setMedium',
      gas('atom:6:12:0', '{{carbonVaporDensityPerCubicMeter}}', '{{temperatureInKelvin}}'),
    ),
  'carbon',
  CARBON,
  CARBON_MASS_NUMBER,
  VAPOR_ATOMS,
)
  .evolve(VAPOR_LOOK_IN_SECONDS)
  .measureSystem('afterTenNanoseconds')
  .evolve(LAST_LOOK_IN_SECONDS)
  .measureSystem('afterMicrosecond')
  .report('frequency', ['afterMicrosecond.heaviest'], 'Самый тяжелый кластер через микросекунду')
  .report('mean', ['afterMicrosecond.count.C2'], 'Молекул C₂')
  .report('mean', ['afterMicrosecond.count.C3'], 'Кластеров C₃')
  .report('mean', ['afterMicrosecond.particleCount'], 'Частиц через микросекунду')
  .build();

export const CARBON_IN_ATOMIC_OXYGEN_TEMPLATE = addAtoms(
  experiment('carbonInAtomicOxygen')
    .describe(
      'Двенадцать атомов углерода в газе атомарного кислорода при 1500 К. Кислород двухвалентен, поэтому первая же связь двойная: C + O → C=O, у углерода остаются две свободные валентности, и второй кислород дает O=C=O. На этом углерод насыщен, и CO₃ не возникает. Первая связь возникает за наносекунды, вторая в тысячу раз медленнее: статистическая сумма CO₂ мала по сравнению с CO и O, как и в настоящем пламени, где CO догорает последним. Через 5 нс в системе угарный газ CO, к 30 мкс — углекислый газ CO₂',
    )
    .categorize('chemistry', 'molecules')
    .shots(CHEMISTRY_SHOTS)
    .parameter('temperatureInKelvin', BURNING_TEMPERATURE_IN_KELVIN)
    .parameter('oxygenDensityPerCubicMeter', OXYGEN_DENSITY_PER_CUBIC_METER)
    .influence('setTemperature', { temperatureInKelvin: '{{temperatureInKelvin}}' })
    .influence(
      'setMedium',
      gas('atom:8:16:0', '{{oxygenDensityPerCubicMeter}}', '{{temperatureInKelvin}}'),
    ),
  'carbon',
  CARBON,
  CARBON_MASS_NUMBER,
  BURNING_ATOMS,
)
  .evolve(FIRST_LOOK_IN_SECONDS)
  .measureSystem('afterFiveNanoseconds')
  .evolve(BURNING_LAST_LOOK_IN_SECONDS)
  .measureSystem('afterThirtyMicroseconds')
  .report('mean', ['afterFiveNanoseconds.count.CO'], 'Молекул CO через 5 нс')
  .report('mean', ['afterThirtyMicroseconds.count.CO'], 'Молекул CO через 30 мкс')
  .report('mean', ['afterThirtyMicroseconds.count.CO2'], 'Молекул CO₂ через 30 мкс')
  .build();

export const PRIMORDIAL_SOUP_TEMPLATE = addAtoms(
  addAtoms(
    addAtoms(
      experiment('primordialSoup')
        .describe(
          'Первичный бульон: по шесть атомов углерода, азота и кислорода в горячем атомарном водороде при 1000 К. Один и тот же закон связывания по свободным валентностям делает из углерода метан CH₄, из азота аммиак NH₃, из кислорода воду H₂O — три молекулы, с которых начинают опыт Миллера–Юри и химию газопылевых облаков. Счетчики показывают, сколько каждой молекулы набралось за микросекунду',
        )
        .categorize('chemistry', 'molecules')
        .shots(CHEMISTRY_SHOTS)
        .parameter('temperatureInKelvin', SOUP_TEMPERATURE_IN_KELVIN)
        .parameter('hydrogenDensityPerCubicMeter', HYDROGEN_DENSITY_PER_CUBIC_METER)
        .influence('setTemperature', { temperatureInKelvin: '{{temperatureInKelvin}}' })
        .influence(
          'setMedium',
          gas('hydrogenAtom', '{{hydrogenDensityPerCubicMeter}}', '{{temperatureInKelvin}}'),
        ),
      'carbon',
      CARBON,
      CARBON_MASS_NUMBER,
      SOUP_ATOMS_PER_ELEMENT,
    ),
    'nitrogen',
    NITROGEN,
    NITROGEN_MASS_NUMBER,
    SOUP_ATOMS_PER_ELEMENT,
  ),
  'oxygen',
  OXYGEN,
  OXYGEN_MASS_NUMBER,
  SOUP_ATOMS_PER_ELEMENT,
)
  .evolve(FIRST_LOOK_IN_SECONDS)
  .measureSystem('afterFiveNanoseconds')
  .evolve(LAST_LOOK_IN_SECONDS)
  .measureSystem('afterMicrosecond')
  .report('mean', ['afterMicrosecond.count.CH4'], 'Метан CH₄')
  .report('mean', ['afterMicrosecond.count.H3N'], 'Аммиак NH₃')
  .report('mean', ['afterMicrosecond.count.H2O'], 'Вода H₂O')
  .report('mean', ['afterMicrosecond.particleCount'], 'Частиц через микросекунду')
  .build();

function pressed(pressure: string, temperature: string) {
  return {
    components: [
      { species: 'atom:6:12:0', numberDensityPerCubicMeter: '{{carbonDensityPerCubicMeter}}' },
    ],
    temperatureInKelvin: temperature,
    pressureInPascals: pressure,
  };
}

export const DIAMOND_UNDER_PRESSURE_TEMPLATE = experiment('diamondUnderPressure')
  .describe(
    'Один и тот же углерод в трех условиях. Агрегатное состояние элемента с несколькими твердыми формами следует его фазовой диаграмме: кривая пара от тройной точки, линия равновесия графит–алмаз, измеренная Кеннеди и Кеннеди (P = 1,94 ГПа + 2,5 МПа/К·(T − 273 К)), и своя кривая плавления у каждой формы. При 1 атм и комнатной температуре углерод — графит (алмаз в кольце метастабилен и живет только потому, что перестройка решетки заторможена). В прессе при 6 ГПа и 1700 К, как в синтезе HPHT, устойчив алмаз. При 5000 К углерод плавится. Двигайте давление и температуру: граница графит–алмаз смещается на 2,5 МПа на каждый кельвин',
  )
  .categorize('chemistry')
  .shots(PRESS_SHOTS)
  .parameter('roomPressureInPascals', STANDARD_ATMOSPHERE_IN_PASCALS)
  .parameter('roomTemperatureInKelvin', ROOM_TEMPERATURE_IN_KELVIN)
  .parameter('pressPressureInPascals', PRESS_PRESSURE_IN_PASCALS)
  .parameter('pressTemperatureInKelvin', PRESS_TEMPERATURE_IN_KELVIN)
  .parameter('meltTemperatureInKelvin', MELT_TEMPERATURE_IN_KELVIN)
  .parameter('carbonDensityPerCubicMeter', GRAPHITE_NUMBER_DENSITY_PER_CUBIC_METER)
  .createAtom('carbon', CARBON, { massNumber: CARBON_MASS_NUMBER })
  .influence('setMedium', pressed('{{roomPressureInPascals}}', '{{roomTemperatureInKelvin}}'))
  .measureSystem('atRoom')
  .influence('setMedium', pressed('{{pressPressureInPascals}}', '{{pressTemperatureInKelvin}}'))
  .measureSystem('inPress')
  .influence('setMedium', pressed('{{pressPressureInPascals}}', '{{meltTemperatureInKelvin}}'))
  .measureSystem('inMelt')
  .report('frequency', ['atRoom.carbon.allotrope'], 'Форма углерода при 1 атм')
  .report('frequency', ['inPress.carbon.allotrope'], 'Форма углерода в прессе')
  .report('frequency', ['inMelt.carbon.phase'], 'Углерод при 5000 К')
  .build();

function generations(builder: ExperimentBuilder): ExperimentBuilder {
  return Array.from({ length: GENERATIONS }, (unused, index) => index + 1).reduce(
    (chain, generation) =>
      chain
        .evolve(GENERATION_IN_SECONDS)
        .measureSystem(`generation${String(generation)}`)
        .report(
          'mean',
          [`generation${String(generation)}.particleCount`],
          `Частиц через ${String(Math.round(generation * GENERATION_IN_SECONDS * NANOSECONDS_PER_SECOND))} нс`,
        ),
    builder,
  );
}

export const HYDROGEN_OXYGEN_IGNITION_TEMPLATE = generations(
  addAtoms(
    experiment('hydrogenOxygenIgnition')
      .describe(
        'Гремучая смесь H₂ + O₂ (два к одному) и искра — три атома водорода. Атом со свободной валентностью отрывает атом у молекулы среды: H + O₂ → OH + O, O + H₂ → OH + H, OH + H₂ → H₂O + H. Барьер каждой реакции считается методом энергии и порядка связи (BEBO, Джонстон и Парр, 1963) из энергий связей, а скорость — теорией переходного состояния. Два первых шага рождают по два радикала вместо одного: цепь ветвится, и число частиц растет лавиной, а с ним вода. Барьер H + O₂ около 0,35 эВ, поэтому при 600 К за микросекунду почти ничего не происходит, а при 1200 К смесь вспыхивает. Обрыва цепей на стенках и тройных столкновений H + O₂ + M нет, поэтому холодная смесь не взрывается лишь потому, что медленна',
      )
      .categorize('chemistry')
      .shots(CHEMISTRY_SHOTS)
      .parameter('temperatureInKelvin', IGNITION_TEMPERATURE_IN_KELVIN)
      .parameter('hydrogenDensityPerCubicMeter', MIXTURE_HYDROGEN_DENSITY_PER_CUBIC_METER)
      .parameter('oxygenDensityPerCubicMeter', MIXTURE_OXYGEN_DENSITY_PER_CUBIC_METER)
      .influence('setTemperature', { temperatureInKelvin: '{{temperatureInKelvin}}' })
      .influence('setMedium', {
        components: [
          {
            species: HYDROGEN_MOLECULE,
            numberDensityPerCubicMeter: '{{hydrogenDensityPerCubicMeter}}',
          },
          {
            species: OXYGEN_MOLECULE,
            numberDensityPerCubicMeter: '{{oxygenDensityPerCubicMeter}}',
          },
        ],
        temperatureInKelvin: '{{temperatureInKelvin}}',
        reactionMode: 'allReactionsInStep',
      }),
    'spark',
    HYDROGEN,
    HYDROGEN_MASS_NUMBER,
    SPARK_ATOMS,
  ),
)
  .report('mean', [`generation${String(GENERATIONS)}.count.H2O`], 'Молекул воды в конце')
  .build();

export const CARBON_BURNS_IN_OXYGEN_TEMPLATE = addAtoms(
  experiment('carbonBurnsInOxygen')
    .describe(
      'Шесть атомов углерода в молекулярном кислороде при 1000 К. Свободная валентность углерода отрывает атом кислорода у молекулы O₂: C + O₂ → CO + O, это быстро. Угарный газ отрывает второй атом: CO + O₂ → CO₂ + O, это на порядки медленнее, и в реальном пламени CO тоже догорает последним. Каждая реакция оставляет свободный атом кислорода. Барьеры по методу энергии и порядка связи, скорости по теории переходного состояния; через микросекунду в системе CO, через 100 мкс появляется CO₂',
    )
    .categorize('chemistry')
    .shots(CHEMISTRY_SHOTS)
    .parameter('temperatureInKelvin', COAL_TEMPERATURE_IN_KELVIN)
    .parameter('oxygenDensityPerCubicMeter', COAL_OXYGEN_DENSITY_PER_CUBIC_METER)
    .influence('setTemperature', { temperatureInKelvin: '{{temperatureInKelvin}}' })
    .influence(
      'setMedium',
      gas(OXYGEN_MOLECULE, '{{oxygenDensityPerCubicMeter}}', '{{temperatureInKelvin}}'),
    ),
  'carbon',
  CARBON,
  CARBON_MASS_NUMBER,
  COAL_ATOMS,
)
  .evolve(COAL_FIRST_LOOK_IN_SECONDS)
  .measureSystem('afterMicrosecond')
  .evolve(COAL_LAST_LOOK_IN_SECONDS)
  .measureSystem('afterHundredMicroseconds')
  .report('mean', ['afterMicrosecond.count.CO'], 'Молекул CO через микросекунду')
  .report('mean', ['afterHundredMicroseconds.count.CO'], 'Молекул CO через 100 мкс')
  .report('mean', ['afterHundredMicroseconds.count.CO2'], 'Молекул CO₂ через 100 мкс')
  .build();

function waterSurface() {
  const ocean = ENVIRONMENT_PRESETS.find((preset) => preset.name === 'oceanSurface');
  const water = ocean?.components.find((component) => component.species === WATER_MOLECULE);
  if (ocean === undefined || water === undefined) {
    throw new Error('oceanSurface preset with water expected');
  }
  return { water: water.numberDensityPerCubicMeter, pressure: ocean.pressureInPascals };
}

const WATER = waterSurface();
const ACID_DENSITY_PER_CUBIC_METER =
  ACID_MOLARITY * AVOGADRO_CONSTANT.value * LITERS_PER_CUBIC_METER;

function solution(extra: readonly { species: string; numberDensityPerCubicMeter: string }[] = []) {
  return {
    components: [
      { species: WATER_MOLECULE, numberDensityPerCubicMeter: '{{waterDensityPerCubicMeter}}' },
      ...extra,
    ],
    temperatureInKelvin: '{{temperatureInKelvin}}',
    pressureInPascals: '{{pressureInPascals}}',
  };
}

function diatomic(first: number, firstMass: number, second: number, secondMass: number) {
  return [
    [
      { protons: first, massNumber: firstMass },
      { protons: second, massNumber: secondMass },
    ],
    [{ first: 0, second: 1, order: 1 as const }],
  ] as const;
}

const [SALT_ATOMS, SALT_BONDS] = diatomic(
  SODIUM,
  SODIUM_MASS_NUMBER,
  CHLORINE,
  CHLORINE_MASS_NUMBER,
);
const [FLUORIDE_ATOMS, FLUORIDE_BONDS] = diatomic(
  HYDROGEN,
  HYDROGEN_MASS_NUMBER,
  HYDROGEN_FLUORIDE,
  FLUORINE_MASS_NUMBER,
);
const [CHLORIDE_ATOMS, CHLORIDE_BONDS] = diatomic(
  HYDROGEN,
  HYDROGEN_MASS_NUMBER,
  CHLORINE,
  CHLORINE_MASS_NUMBER,
);

export const SALT_IN_WATER_TEMPLATE = experiment('saltInWater')
  .describe(
    'Две молекулы поваренной соли NaCl: одна в воде, другая в сухом воздухе. В газе ионная связь держит молекулу целой: оторвать электрон у натрия и отдать хлору стоит больше, чем энергия связи. В воде ионы окружены диполями растворителя: энергия гидратации Na⁺ и Cl⁻ (Маркус, 1991) пересчитана на проницаемость воды ε = 78 по Борну и перекрывает цикл Борна–Габера — свободная энергия распада на ионы из статистических сумм, плюс ионизация натрия, минус сродство хлора к электрону, плюс гидратация. Соль в воде распадается на Na⁺ и Cl⁻, в воздухе остается молекулой',
  )
  .categorize('chemistry')
  .shots(SOLUTION_SHOTS)
  .parameter('temperatureInKelvin', SOLUTION_TEMPERATURE_IN_KELVIN)
  .parameter('waterDensityPerCubicMeter', WATER.water)
  .parameter('pressureInPascals', WATER.pressure)
  .createMolecule('inWater', SALT_ATOMS, SALT_BONDS)
  .createMolecule('inAir', SALT_ATOMS, SALT_BONDS)
  .influence('setMedium', {
    components: [
      {
        species: 'molecule:7-14,7-14;0-1-3',
        numberDensityPerCubicMeter: '{{airDensityPerCubicMeter}}',
      },
    ],
    temperatureInKelvin: '{{temperatureInKelvin}}',
  })
  .parameter('airDensityPerCubicMeter', AIR_DENSITY_PER_CUBIC_METER)
  .influence('setMedium', solution(), ['inWater'])
  .evolve(SOLUTION_WAIT_IN_SECONDS)
  .measureSystem('after')
  .report('frequency', ['after'], 'Что стало с солью')
  .build();

export const ACID_STRENGTH_TEMPLATE = experiment('acidStrength')
  .describe(
    'Фтороводород HF и хлороводород HCl в чистой воде и в кислоте (0,1 моль/л H⁺ и Cl⁻). Доля распавшихся молекул следует закону действующих масс: [X⁻]/[HX] = K/[H⁺], а K = exp(−ΔG/kT) считается тем же циклом Борна–Габера, что растворяет соль. Для HCl ΔG < 0 — сильная кислота, распадается и в кислоте. Для HF ΔG > 0, pKa выходит около 3,6 (измеренное 3,17): в чистой воде, где [H⁺] = 10⁻⁷, HF распадается почти весь, а в кислоте остается молекулой. Так pH среды решает судьбу растворенного вещества. Записи after.pH показывают кислотность каждой среды: pH чистой воды считается из ионного произведения воды IAPWS',
  )
  .categorize('chemistry')
  .shots(SOLUTION_SHOTS)
  .parameter('temperatureInKelvin', SOLUTION_TEMPERATURE_IN_KELVIN)
  .parameter('waterDensityPerCubicMeter', WATER.water)
  .parameter('pressureInPascals', WATER.pressure)
  .parameter('acidDensityPerCubicMeter', ACID_DENSITY_PER_CUBIC_METER)
  .createMolecule('fluorideInWater', FLUORIDE_ATOMS, FLUORIDE_BONDS)
  .createMolecule('chlorideInWater', CHLORIDE_ATOMS, CHLORIDE_BONDS)
  .createMolecule('fluorideInAcid', FLUORIDE_ATOMS, FLUORIDE_BONDS)
  .createMolecule('chlorideInAcid', CHLORIDE_ATOMS, CHLORIDE_BONDS)
  .influence('setMedium', solution())
  .influence(
    'setMedium',
    solution([
      { species: 'proton', numberDensityPerCubicMeter: '{{acidDensityPerCubicMeter}}' },
      { species: 'atom:17:35:-1', numberDensityPerCubicMeter: '{{acidDensityPerCubicMeter}}' },
    ]),
    ['fluorideInAcid', 'chlorideInAcid'],
  )
  .evolve(SOLUTION_WAIT_IN_SECONDS)
  .measureSystem('after')
  .report('frequency', ['after.heaviest'], 'Самая тяжелая частица')
  .report('mean', ['after.count.FH'], 'Молекул HF осталось')
  .report('mean', ['after.count.ClH'], 'Молекул HCl осталось')
  .report('mean', ['after.pH'], 'pH чистой воды')
  .build();

function catalogMolecule(key: string) {
  const entry = MOLECULE_CATALOG.find((molecule) => molecule.key === key);
  if (entry === undefined) {
    throw new Error(`${key} expected in the molecule catalogue`);
  }
  return {
    name: entry.name,
    atoms: entry.structure.atoms,
    bonds: entry.structure.bonds.map((bond) => ({ ...bond, order: bond.order as BondOrder })),
  };
}

const GLYCINE = catalogMolecule('glycine');
const SULFURIC_ACID = catalogMolecule('sulfuricAcid');

export const GLYCINE_ACROSS_PH_TEMPLATE = experiment('glycineAcrossPh')
  .describe(
    'Аминокислота глицин H₂N–CH₂–COOH в трех растворах. У нее две группы, которые обмениваются протонами с водой: карбоксил –COOH (pKa 2,35) и аминогруппа –NH₂, которая принимает протон (pKa иона –NH₃⁺ 9,78; King, 1951). Доля каждой формы при pH раствора следует закону действующих масс. Серная кислота 0,1 моль/л отдает первый протон полностью, второй с Ka = 1,2·10⁻², и баланс зарядов дает pH около 0,96: глицин присоединяет протон и становится катионом ⁺H₃N–CH₂–COOH. В чистой воде с pH 7 протон переходит с карбоксила на азот, и получается цвиттер-ион ⁺H₃N–CH₂–COO⁻, в целом нейтральный. В щелочи NaOH 0,1 моль/л с pH около 13 аминогруппа отдает протон, остается анион H₂N–CH₂–COO⁻. Протоны уходят к ионам H₃O⁺ и OH⁻ воды и приходят от них, а сами эти ионы остаются частью растворителя. Измените концентрацию кислоты: при pH 2,35 катионов и цвиттер-ионов поровну',
  )
  .categorize('chemistry')
  .shots(SOLUTION_SHOTS)
  .parameter('temperatureInKelvin', SOLUTION_TEMPERATURE_IN_KELVIN)
  .parameter('waterDensityPerCubicMeter', WATER.water)
  .parameter('pressureInPascals', WATER.pressure)
  .parameter('acidDensityPerCubicMeter', ACID_DENSITY_PER_CUBIC_METER)
  .parameter('baseDensityPerCubicMeter', ACID_DENSITY_PER_CUBIC_METER)
  .influence(
    'setMedium',
    solution([
      { species: SULFURIC_ACID.name, numberDensityPerCubicMeter: '{{acidDensityPerCubicMeter}}' },
    ]),
  )
  .createMolecule('inAcid', GLYCINE.atoms, GLYCINE.bonds)
  .createMolecule('inWater', GLYCINE.atoms, GLYCINE.bonds)
  .createMolecule('inBase', GLYCINE.atoms, GLYCINE.bonds)
  .influence('setMedium', solution(), ['inWater'])
  .influence(
    'setMedium',
    solution([
      { species: 'atom:11:23:1', numberDensityPerCubicMeter: '{{baseDensityPerCubicMeter}}' },
      { species: HYDROXIDE, numberDensityPerCubicMeter: '{{baseDensityPerCubicMeter}}' },
    ]),
    ['inBase'],
  )
  .evolve(SOLUTION_WAIT_IN_SECONDS)
  .measureSystem('after')
  .report('mean', ['after.count.C2H6NO2+'], 'Катионов ⁺H₃N–CH₂–COOH')
  .report('mean', ['after.count.C2H5NO2±'], 'Цвиттер-ионов ⁺H₃N–CH₂–COO⁻')
  .report('mean', ['after.count.C2H4NO2−'], 'Анионов H₂N–CH₂–COO⁻')
  .report('mean', ['after.count.C2H5NO2'], 'Нейтральных молекул H₂N–CH₂–COOH')
  .report('mean', ['after.pH'], 'pH серной кислоты')
  .build();

export const WATER_ELECTROLYSIS_TEMPLATE = experiment('waterElectrolysis')
  .describe(
    'Электролиз воды: шесть молекул H₂O в жидкой воде, электроды под напряжением, ток 1 А в течение миллисекунды. Молекула распадается на элементы, когда напряжение выше энергии разложения на один перенесенный электрон: энергии связей O–H минус энергии связей H–H и половины O=O, деленные на два электрона, — около 1,26 В (измеренный порог 1,23 В). Закон Фарадея дает число электронов I·t/e, их хватает на все молекулы. На катоде атомы водорода собираются в H₂, на аноде кислород — в O₂, потому что эти двухатомные газы — газы при комнатных условиях по закону агрегатных состояний. Поставьте 1 В — ничего не произойдет',
  )
  .categorize('chemistry')
  .shots(SOLUTION_SHOTS)
  .parameter('temperatureInKelvin', SOLUTION_TEMPERATURE_IN_KELVIN)
  .parameter('waterDensityPerCubicMeter', WATER.water)
  .parameter('pressureInPascals', WATER.pressure)
  .parameter('voltageInVolts', ELECTROLYSIS_VOLTAGE_IN_VOLTS)
  .influence('setMedium', solution())
  .createMolecule(
    'water',
    [
      { protons: OXYGEN, massNumber: OXYGEN_MASS_NUMBER },
      { protons: HYDROGEN, massNumber: HYDROGEN_MASS_NUMBER },
      { protons: HYDROGEN, massNumber: HYDROGEN_MASS_NUMBER },
    ],
    [
      { first: 0, second: 1, order: 1 },
      { first: 0, second: 2, order: 1 },
    ],
    { count: ELECTROLYSIS_MOLECULES },
  )
  .influence(
    'electrolyze',
    {
      voltageInVolts: '{{voltageInVolts}}',
      currentInAmperes: ELECTROLYSIS_CURRENT_IN_AMPERES,
      durationInSeconds: ELECTROLYSIS_TIME_IN_SECONDS,
    },
    ['water'],
  )
  .measureSystem('after')
  .report('mean', ['after.count.H2'], 'Молекул H₂')
  .report('mean', ['after.count.O2'], 'Молекул O₂')
  .report('mean', ['after.count.H2O'], 'Молекул H₂O осталось')
  .build();

export const CHEMISTRY_TEMPLATES = [
  SALT_IN_WATER_TEMPLATE,
  ACID_STRENGTH_TEMPLATE,
  GLYCINE_ACROSS_PH_TEMPLATE,
  WATER_ELECTROLYSIS_TEMPLATE,
  HYDROGEN_OXYGEN_IGNITION_TEMPLATE,
  CARBON_BURNS_IN_OXYGEN_TEMPLATE,
  DIAMOND_UNDER_PRESSURE_TEMPLATE,
  METHANE_FARM_TEMPLATE,
  CARBON_VAPOR_CLUSTERS_TEMPLATE,
  CARBON_IN_ATOMIC_OXYGEN_TEMPLATE,
  PRIMORDIAL_SOUP_TEMPLATE,
];
