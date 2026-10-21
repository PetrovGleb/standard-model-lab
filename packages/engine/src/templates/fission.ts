/* Templates of nuclear fission chains: neutrons in a ball of uranium-235 metal multiply generation after generation once the ball is larger than its critical size, the same neutrons in natural
   uranium die out, and in the cube a subcritical core inside a uranium-238 tamper behind mirror walls runs away; every collision, fission, crossing and escape comes from the ENDF/B-VIII.0 data and
   the geometry, nothing in the templates says when a chain grows. */
import { elementRecord } from '@standard-model/constants';
import { experiment, type ExperimentBuilder } from '../experiment/experiment-builder.js';

const URANIUM = 92;
const FISSILE_MASS_NUMBER = 235;
const URANIUM_METAL_ATOMS_PER_CUBIC_METER = 4.83e28;
const CORE_DIAMETER_IN_METERS = 0.3;
const ROOM_TEMPERATURE_IN_KELVIN = 293;
const STANDARD_ATMOSPHERE_IN_PASCALS = 101325;
const SEED_NEUTRONS = 4;
const SEED_MOMENTUM_IN_GEV = 0.0613;
const GENERATION_IN_SECONDS = 1e-8;
const GENERATIONS = 8;
const FISSION_SHOTS = 200;
const NANOSECONDS_PER_SECOND = 1e9;
const CUBE_CELLS = 32;
const CUBE_CELL_IN_METERS = 0.01;
const CUBE_CORE_DIAMETER_IN_METERS = 0.13;
const TAMPER_EDGE_IN_METERS = 0.2;
const CUBE_FRAME_IN_SECONDS = 1e-8;
const CUBE_FRAMES = 16;
const CUBE_REPORT_EVERY = 4;
const CUBE_SHOTS = 100;

const naturalAbundance =
  elementRecord(URANIUM)?.isotopes.find((isotope) => isotope.massNumber === FISSILE_MASS_NUMBER)
    ?.abundance ?? 0;
const FERTILE_MASS_NUMBER =
  [...(elementRecord(URANIUM)?.isotopes ?? [])].sort(
    (first, second) => second.abundance - first.abundance,
  )[0]?.massNumber ?? FISSILE_MASS_NUMBER;

function generations(builder: ExperimentBuilder): ExperimentBuilder {
  return Array.from({ length: GENERATIONS }, (unused, index) => index + 1).reduce(
    (chain, generation) =>
      chain
        .evolve(GENERATION_IN_SECONDS)
        .measureSystem(`generation${String(generation)}`)
        .report(
          'mean',
          [`generation${String(generation)}.count.neutron`],
          `Нейтронов через ${String(Math.round(generation * GENERATION_IN_SECONDS * NANOSECONDS_PER_SECOND))} нс`,
        ),
    builder,
  );
}

function seeded(builder: ExperimentBuilder): ExperimentBuilder {
  return builder.create('neutron', 'neutron', {
    momentumInGev: { x: 0, y: 0, z: SEED_MOMENTUM_IN_GEV },
    count: SEED_NEUTRONS,
  });
}

export const URANIUM_CHAIN_REACTION_TEMPLATE = generations(
  seeded(
    experiment('uraniumChainReaction')
      .describe(
        'Цепная реакция деления в шаре из металлического урана-235 диаметром 30 см. В центр попадают четыре нейтрона по 2 МэВ. Каждый нейтрон летит свободный пробег 1/Σ, где Σ = n·σ(E) из библиотеки ENDF/B-VIII.0, рассеивается упруго и неупруго, захватывается или делит ядро. Осколки выбираются по независимым выходам ENDF, мгновенные нейтроны — по спектру деления, а энергия деления, около 200 МэВ, берется из масс AME именно этой пары осколков. Нейтрон, долетевший до края шара, улетает. Пока шар больше критического размера (около 17 см в диаметре), нейтронов от поколения к поколению становится в полтора раза больше: за 80 нс из четырех получаются сотни. Осколки тормозятся в металле и нагревают его. Уменьшите диаметр до 6 см — цепь угаснет. Настоящая бомба проходит так около 80 поколений за микросекунду, пока не разлетится; столько нейтронов поштучно не сосчитать, но рост за первые поколения тот же',
      )
      .categorize('nuclear')
      .shots(FISSION_SHOTS)
      .parameter('coreDiameterInMeters', CORE_DIAMETER_IN_METERS)
      .parameter('uraniumDensityPerCubicMeter', URANIUM_METAL_ATOMS_PER_CUBIC_METER)
      .influence('setMedium', {
        components: [
          {
            species: `atom:${String(URANIUM)}:${String(FISSILE_MASS_NUMBER)}:0`,
            numberDensityPerCubicMeter: '{{uraniumDensityPerCubicMeter}}',
          },
        ],
        temperatureInKelvin: ROOM_TEMPERATURE_IN_KELVIN,
        pressureInPascals: STANDARD_ATMOSPHERE_IN_PASCALS,
        thicknessInMeters: '{{coreDiameterInMeters}}',
      }),
  ),
)
  .report(
    'mean',
    [`generation${String(GENERATIONS)}.medium.absorbedEnergyInJoules`],
    'Выделилось в металле, Дж',
  )
  .report('mean', [`generation${String(GENERATIONS)}.particleCount`], 'Частиц в конце')
  .build();

export const NATURAL_URANIUM_TEMPLATE = generations(
  seeded(
    experiment('naturalUraniumChainDies')
      .describe(
        'Те же четыре нейтрона в шаре природного урана того же размера: урана-235 в нем 0,72%, остальное — уран-238 (доли по изотопному составу NIST). Уран-238 делится только нейтронами быстрее 1 МэВ, а неупругие столкновения быстро опускают их ниже порога; на медленных энергиях уран-238 нейтроны захватывает. Поэтому цепь затухает за пару поколений: так природный уран не взрывается, а реактору нужен замедлитель или обогащение',
      )
      .categorize('nuclear')
      .shots(FISSION_SHOTS)
      .parameter('coreDiameterInMeters', CORE_DIAMETER_IN_METERS)
      .parameter('uraniumDensityPerCubicMeter', URANIUM_METAL_ATOMS_PER_CUBIC_METER)
      .influence('setMedium', {
        components: [
          {
            species: `atom:${String(URANIUM)}:${String(FISSILE_MASS_NUMBER)}:0`,
            numberDensityPerCubicMeter: URANIUM_METAL_ATOMS_PER_CUBIC_METER * naturalAbundance,
          },
          {
            species: `atom:${String(URANIUM)}:${String(FERTILE_MASS_NUMBER)}:0`,
            numberDensityPerCubicMeter:
              URANIUM_METAL_ATOMS_PER_CUBIC_METER * (1 - naturalAbundance),
          },
        ],
        temperatureInKelvin: ROOM_TEMPERATURE_IN_KELVIN,
        pressureInPascals: STANDARD_ATMOSPHERE_IN_PASCALS,
        thicknessInMeters: '{{coreDiameterInMeters}}',
      }),
  ),
)
  .report(
    'mean',
    [`generation${String(GENERATIONS)}.medium.absorbedEnergyInJoules`],
    'Выделилось в металле, Дж',
  )
  .build();

function cubeFrames(builder: ExperimentBuilder): ExperimentBuilder {
  return Array.from({ length: CUBE_FRAMES }, (unused, index) => index + 1).reduce(
    (chain, frame) => {
      const measured = chain.evolve(CUBE_FRAME_IN_SECONDS).measureSystem(`frame${String(frame)}`);
      return frame % CUBE_REPORT_EVERY === 0
        ? measured.report(
            'mean',
            [`frame${String(frame)}.count.neutron`],
            `Нейтронов через ${String(Math.round(frame * CUBE_FRAME_IN_SECONDS * NANOSECONDS_PER_SECOND))} нс`,
          )
        : measured;
    },
    builder,
  );
}

export const CHAIN_REACTION_IN_CUBE_TEMPLATE = cubeFrames(
  seeded(
    experiment('chainReactionInCube')
      .describe(
        'Цепная реакция в кубе с ребром 32 см, стенки которого — зеркало из сверхвещества: любая частица отражается от них без потерь. В кубе два тела с разными средами: куб урана-238 с ребром 20 см, а в его центре шар урана-235 диаметром 13 см. Точка видит среду самого маленького тела, в котором лежит, поэтому в шаре — уран-235, а вокруг — оболочка из урана-238. Сам шар меньше критического размера (около 17 см): без оболочки и с открытыми стенками цепь из четырех нейтронов по 2 МэВ почти гаснет. Оболочка-тампер возвращает нейтроны рассеянием на тяжелых ядрах и сама делится быстрыми нейтронами, а нейтрон, пролетевший все, отражается от стенки и снова влетает в уран. В плеере видно, как нейтроны (синие) разлетаются, отскакивают от стенок, делят ядра, и на месте деления вспыхивают осколки (оранжевые). Каждое столкновение, деление и пересечение границы тела — из данных ENDF/B-VIII.0 и геометрии. Сделайте стенки открытыми в карточке куба, обнулите плотность оболочки или увеличьте шар до 17 см и сравните, сколько нейтронов через 160 нс',
      )
      .categorize('space', 'nuclear')
      .shots(CUBE_SHOTS)
      .parameter('coreDiameterInMeters', CUBE_CORE_DIAMETER_IN_METERS)
      .parameter('tamperEdgeInMeters', TAMPER_EDGE_IN_METERS)
      .parameter('tamperDensityPerCubicMeter', URANIUM_METAL_ATOMS_PER_CUBIC_METER)
      .space({
        gridPointsPerAxis: CUBE_CELLS,
        cellSizeInMeters: CUBE_CELL_IN_METERS,
        potential: 'free',
        walls: 'reflecting',
      })
      .influence('placeBody', {
        shape: 'box',
        sizeInMeters: '{{tamperEdgeInMeters}}',
        components: [
          {
            species: `atom:${String(URANIUM)}:${String(FERTILE_MASS_NUMBER)}:0`,
            numberDensityPerCubicMeter: '{{tamperDensityPerCubicMeter}}',
          },
        ],
        temperatureInKelvin: ROOM_TEMPERATURE_IN_KELVIN,
        pressureInPascals: STANDARD_ATMOSPHERE_IN_PASCALS,
      })
      .influence('placeBody', {
        shape: 'ball',
        sizeInMeters: '{{coreDiameterInMeters}}',
        components: [
          {
            species: `atom:${String(URANIUM)}:${String(FISSILE_MASS_NUMBER)}:0`,
            numberDensityPerCubicMeter: URANIUM_METAL_ATOMS_PER_CUBIC_METER,
          },
        ],
        temperatureInKelvin: ROOM_TEMPERATURE_IN_KELVIN,
        pressureInPascals: STANDARD_ATMOSPHERE_IN_PASCALS,
      }),
  ),
)
  .report('mean', [`frame${String(CUBE_FRAMES)}.particleCount`], 'Частиц в конце')
  .report(
    'mean',
    [`frame${String(CUBE_FRAMES)}.body2.absorbedEnergyInJoules`],
    'Выделилось в уране-235, Дж',
  )
  .report(
    'mean',
    [`frame${String(CUBE_FRAMES)}.body1.absorbedEnergyInJoules`],
    'Выделилось в оболочке, Дж',
  )
  .build();

export const FISSION_TEMPLATES = [
  URANIUM_CHAIN_REACTION_TEMPLATE,
  NATURAL_URANIUM_TEMPLATE,
  CHAIN_REACTION_IN_CUBE_TEMPLATE,
];
