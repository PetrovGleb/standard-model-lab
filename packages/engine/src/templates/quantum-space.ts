/* Templates in the spatial cube: the hydrogen 1s, 2s, 2p and 3d clouds, a spreading free packet, tunnelling through a barrier and as a movie, a packet in a harmonic trap, an electron–positron pair
   annihilating in a trap, a double slit, an electron wave around a proton, tunnelling between two wells, a sloshing 1s + 2p dipole, a Schrödinger cat in a trap and fractional revivals in a box;
   momenta, widths, periods and revival times follow from CODATA. */
import type { NumberOrParameter } from '@standard-model/contracts';
import {
  BOHR_RADIUS,
  ELECTRON_MASS_ENERGY_EQUIVALENT_IN_MEV,
  PLANCK_CONSTANT_IN_EV_PER_HERTZ,
  REDUCED_PLANCK_CONSTANT_IN_EV_SECOND,
  RYDBERG_CONSTANT_TIMES_PLANCK_CONSTANT_TIMES_SPEED_OF_LIGHT_IN_EV,
  SPEED_OF_LIGHT_IN_VACUUM,
} from '@standard-model/constants';
import { EV_PER_GEV } from '@standard-model/utils';
import { experiment, type ExperimentBuilder } from '../experiment/experiment-builder.js';

const POSITION_BINS = 48;
const ELECTRON_FIVE_EV_MOMENTUM_IN_GEV = 2.2605e-6;

export const HYDROGEN_ATOM_TEMPLATE = experiment('hydrogenAtom')
  .describe(
    'Электрон в основном состоянии атома водорода: облако 1s, радиус чаще всего около боровского 0.053 нм, в среднем 1.5 радиуса',
  )
  .space({ gridPointsPerAxis: 64, cellSizeInMeters: 2e-11, potential: 'coulomb', nuclearCharge: 1 })
  .create('electron', 'electron')
  .place('electron', { x: 0, y: 0, z: 0 }, BOHR_RADIUS.value, 'groundState')
  .measurePosition('electron', 'position')
  .report('histogram', ['position.r'], 'Расстояние от ядра, м', POSITION_BINS)
  .report('mean', ['position.r'], 'Средний радиус, м')
  .build();

export const WAVEPACKET_SPREADING_TEMPLATE = experiment('wavepacketSpreading')
  .describe(
    'Свободный электрон, локализованный в 0.1 нм, расплывается: через 0.3 фс ширина вырастает примерно вдвое, σ(t) = σ₀·√(1 + (ħt/2mσ₀²)²)',
  )
  .parameter('durationInSeconds', 3e-16)
  .space({ gridPointsPerAxis: 32, cellSizeInMeters: 4e-11, potential: 'free' })
  .create('electron', 'electron')
  .place('electron', { x: 0, y: 0, z: 0 }, 1e-10)
  .propagate('{{durationInSeconds}}')
  .measurePosition('electron', 'position')
  .report('histogram', ['position.x'], 'Координата x, м', POSITION_BINS)
  .report('standardDeviation', ['position.x'], 'Ширина σx, м')
  .build();

export const QUANTUM_TUNNELING_TEMPLATE = experiment('quantumTunneling')
  .describe(
    'Электрон 5 эВ налетает на барьер 10 эВ толщиной 0.1 нм: классически отражается, квантово примерно треть пакета проходит насквозь',
  )
  .parameter('momentumInGev', ELECTRON_FIVE_EV_MOMENTUM_IN_GEV)
  .parameter('barrierHeightInEv', 10)
  .parameter('durationInSeconds', 6e-16)
  .space({
    gridPointsPerAxis: 32,
    cellSizeInMeters: 5e-11,
    potential: 'barrier',
    potentialEnergyInEv: '{{barrierHeightInEv}}',
    barrierThicknessInMeters: 1e-10,
  })
  .create('electron', 'electron', { momentumInGev: { x: '{{momentumInGev}}', y: 0, z: 0 } })
  .place('electron', { x: -4e-10, y: 0, z: 0 }, 1.5e-10)
  .propagate('{{durationInSeconds}}')
  .measurePosition('electron', 'position')
  .report('histogram', ['position.x'], 'Координата x после встречи с барьером, м', POSITION_BINS)
  .report('mean', ['position.x'], 'Средняя координата x, м')
  .build();

export const HARMONIC_OSCILLATOR_TEMPLATE = experiment('harmonicOscillator')
  .describe(
    'Пакет, смещенный на 0.2 нм в ловушке с ħω = 1 эВ, за половину периода 2.07 фс перелетает на другую сторону и не расплывается',
  )
  .parameter('durationInSeconds', 2.067e-15)
  .space({
    gridPointsPerAxis: 32,
    cellSizeInMeters: 7e-11,
    potential: 'harmonic',
    potentialEnergyInEv: 1,
  })
  .create('electron', 'electron')
  .place('electron', { x: 2e-10, y: 0, z: 0 }, 1.95e-10)
  .propagate('{{durationInSeconds}}')
  .measurePosition('electron', 'position')
  .report('histogram', ['position.x'], 'Координата x, м', POSITION_BINS)
  .report('mean', ['position.x'], 'Средняя координата x, м')
  .build();

export const PAIR_ANNIHILATION_IN_TRAP_TEMPLATE = experiment('pairAnnihilationInTrap')
  .describe(
    'Электрон и позитрон в основном состоянии общей ловушки ħω = 10 эВ: облака перекрыты, за 1 нс примерно половина пар аннигилирует в два фотона по 511 кэВ; замер системы показывает, что осталось',
  )
  .parameter('trapQuantumInEv', 10)
  .parameter('waitInSeconds', 1e-9)
  .space({
    gridPointsPerAxis: 32,
    cellSizeInMeters: 4e-11,
    potential: 'harmonic',
    potentialEnergyInEv: '{{trapQuantumInEv}}',
  })
  .create('electron', 'electron')
  .create('positron', 'positron')
  .place('electron', { x: 0, y: 0, z: 0 }, 6.2e-11, 'groundState')
  .place('positron', { x: 0, y: 0, z: 0 }, 6.2e-11, 'groundState')
  .evolve('{{waitInSeconds}}')
  .measureSystem('system')
  .report('frequency', ['system'], 'Что осталось в системе')
  .build();

const EV_PER_MEV = 1e6;
const ELECTRON_REST_ENERGY_IN_EV = ELECTRON_MASS_ENERGY_EQUIVALENT_IN_MEV.value * EV_PER_MEV;
const HBAR_C_IN_EV_METERS =
  REDUCED_PLANCK_CONSTANT_IN_EV_SECOND.value * SPEED_OF_LIGHT_IN_VACUUM.value;
const H_C_IN_EV_METERS = PLANCK_CONSTANT_IN_EV_PER_HERTZ.value * SPEED_OF_LIGHT_IN_VACUUM.value;
const DOUBLE_WELL_CURVATURE = 8;
const LYMAN_ALPHA_SHARE_OF_RYDBERG = 3 / 4;
const REVIVAL_FACTOR = 4;
const HALF = 0.5;

function momentumForKineticEnergyInGev(kineticEnergyInEv: number): number {
  return Math.sqrt(2 * ELECTRON_REST_ENERGY_IN_EV * kineticEnergyInEv) / EV_PER_GEV;
}

function momentumForWavelengthInGev(wavelengthInMeters: number): number {
  return H_C_IN_EV_METERS / wavelengthInMeters / EV_PER_GEV;
}

function trapGroundWidthInMeters(quantumInEv: number): number {
  return HBAR_C_IN_EV_METERS / Math.sqrt(2 * ELECTRON_REST_ENERGY_IN_EV * quantumInEv);
}

function periodInSeconds(quantumInEv: number): number {
  return PLANCK_CONSTANT_IN_EV_PER_HERTZ.value / quantumInEv;
}

function doubleWellQuantumInEv(barrierInEv: number, halfSeparationInMeters: number): number {
  return (
    (HBAR_C_IN_EV_METERS *
      Math.sqrt((DOUBLE_WELL_CURVATURE * barrierInEv) / ELECTRON_REST_ENERGY_IN_EV)) /
    halfSeparationInMeters
  );
}

function boxRevivalTimeInSeconds(boxSizeInMeters: number): number {
  return (
    (REVIVAL_FACTOR * ELECTRON_REST_ENERGY_IN_EV * boxSizeInMeters ** 2) /
    (Math.PI * HBAR_C_IN_EV_METERS * SPEED_OF_LIGHT_IN_VACUUM.value)
  );
}

function withFrames(
  builder: ExperimentBuilder,
  frames: number,
  durationInSeconds: NumberOrParameter,
): ExperimentBuilder {
  for (let frame = 0; frame < frames; frame += 1) {
    builder.propagate(durationInSeconds);
  }
  return builder;
}

const SLIT_WAVELENGTH_IN_METERS = 2.2e-10;
const SLIT_WALL_IN_EV = 150;
const SLIT_CELL_IN_METERS = 5e-11;
const SLIT_FRAMES = 6;

export const DOUBLE_SLIT_IN_CUBE_TEMPLATE = withFrames(
  experiment('doubleSlitInCube')
    .describe(
      'Электрон с длиной волны де Бройля 0.22 нм, около 31 эВ, налетает на стену высотой 150 эВ с двумя щелями шириной 0.1 нм на расстоянии 0.3 нм. Волна проходит сквозь обе щели сразу и интерферирует сама с собой: на проекции xy за стеной видны лучи, а распределение y показывает центральный максимум и боковые полосы под углом sin θ = λ/d. Отраженная часть пакета остается слева',
    )
    .parameter('momentumInGev', momentumForWavelengthInGev(SLIT_WAVELENGTH_IN_METERS))
    .parameter('frameDurationInSeconds', 5e-17)
    .space({
      gridPointsPerAxis: 32,
      cellSizeInMeters: SLIT_CELL_IN_METERS,
      potential: 'doubleSlit',
      potentialEnergyInEv: SLIT_WALL_IN_EV,
      barrierThicknessInMeters: 1e-10,
      slitWidthInMeters: 1e-10,
      slitSeparationInMeters: 3e-10,
    })
    .create('electron', 'electron', { momentumInGev: { x: '{{momentumInGev}}', y: 0, z: 0 } })
    .place('electron', { x: -3.5e-10, y: 0, z: 0 }, 1.5e-10),
  SLIT_FRAMES,
  '{{frameDurationInSeconds}}',
)
  .measurePosition('electron', 'position')
  .report('histogram', ['position.y'], 'Координата y, м', POSITION_BINS)
  .report('mean', ['position.x'], 'Средняя координата x, м')
  .build();

const PROTON_WAVE_ENERGY_IN_EV = 20;
const PROTON_WAVE_FRAMES = 6;

export const ELECTRON_WAVE_ON_PROTON_TEMPLATE = withFrames(
  experiment('electronWaveOnProton')
    .describe(
      'Свободный электрон 20 эВ пролетает мимо протона с прицельным расстоянием 0.1 нм, около двух боровских радиусов. Кулоновское притяжение закручивает волну вокруг ядра: часть пакета огибает протон, часть рассеивается веером, и за ним остается рябь интерференции падающей и рассеянной волн',
    )
    .parameter('momentumInGev', momentumForKineticEnergyInGev(PROTON_WAVE_ENERGY_IN_EV))
    .parameter('frameDurationInSeconds', 6e-17)
    .space({
      gridPointsPerAxis: 32,
      cellSizeInMeters: 5e-11,
      potential: 'coulomb',
      nuclearCharge: 1,
    })
    .create('electron', 'electron', { momentumInGev: { x: '{{momentumInGev}}', y: 0, z: 0 } })
    .place('electron', { x: -4e-10, y: 1e-10, z: 0 }, 1.2e-10),
  PROTON_WAVE_FRAMES,
  '{{frameDurationInSeconds}}',
)
  .measurePosition('electron', 'position')
  .report('histogram', ['position.y'], 'Координата y, м', POSITION_BINS)
  .report('mean', ['position.r'], 'Среднее расстояние от протона, м')
  .build();

const TUNNELING_ENERGY_IN_EV = 5;
const TUNNELING_FRAMES = 6;

export const TUNNELING_MOVIE_TEMPLATE = withFrames(
  experiment('tunnelingMovie')
    .describe(
      'Туннелирование кадр за кадром: электрон 5 эВ налетает на барьер 10 эВ толщиной 0.1 нм. Пакет упирается в стену, на ней возникает стоячая рябь от наложения падающей и отраженной волн, потом пакет делится на две части: примерно треть проходит насквозь и уходит вправо, остальное отражается влево',
    )
    .parameter('momentumInGev', momentumForKineticEnergyInGev(TUNNELING_ENERGY_IN_EV))
    .parameter('barrierHeightInEv', 10)
    .parameter('frameDurationInSeconds', 1e-16)
    .space({
      gridPointsPerAxis: 32,
      cellSizeInMeters: 5e-11,
      potential: 'barrier',
      potentialEnergyInEv: '{{barrierHeightInEv}}',
      barrierThicknessInMeters: 1e-10,
    })
    .create('electron', 'electron', { momentumInGev: { x: '{{momentumInGev}}', y: 0, z: 0 } })
    .place('electron', { x: -4e-10, y: 0, z: 0 }, 1.5e-10),
  TUNNELING_FRAMES,
  '{{frameDurationInSeconds}}',
)
  .measurePosition('electron', 'position')
  .report('histogram', ['position.x'], 'Координата x после встречи с барьером, м', POSITION_BINS)
  .report('mean', ['position.x'], 'Средняя координата x, м')
  .build();

const WELL_BARRIER_IN_EV = 6;
const WELL_HALF_SEPARATION_IN_METERS = 2.5e-10;
const WELL_FRAMES = 8;

export const DOUBLE_WELL_TUNNELING_TEMPLATE = withFrames(
  experiment('doubleWellTunneling')
    .describe(
      'Электрон в левой из двух ям, разделенных барьером 6 эВ; минимумы на расстоянии 0.5 нм. Нулевая энергия ямы ħω/2 около 3.8 эВ ниже барьера, классически электрон заперт слева. Квантово он туннелирует: примерно за 4 фс облако перетекает в правую яму и за 8 фс возвращается, как маятник из двух связанных состояний с расщеплением уровней',
    )
    .parameter('frameDurationInSeconds', 1.05e-15)
    .space({
      gridPointsPerAxis: 32,
      cellSizeInMeters: 4.5e-11,
      potential: 'doubleWell',
      potentialEnergyInEv: WELL_BARRIER_IN_EV,
      wellSeparationInMeters: 2 * WELL_HALF_SEPARATION_IN_METERS,
    })
    .create('electron', 'electron')
    .place(
      'electron',
      { x: -WELL_HALF_SEPARATION_IN_METERS, y: 0, z: 0 },
      trapGroundWidthInMeters(
        doubleWellQuantumInEv(WELL_BARRIER_IN_EV, WELL_HALF_SEPARATION_IN_METERS),
      ),
    ),
  WELL_FRAMES,
  '{{frameDurationInSeconds}}',
)
  .measurePosition('electron', 'position')
  .report('histogram', ['position.x'], 'Координата x, м', POSITION_BINS)
  .report('mean', ['position.x'], 'Средняя координата x, м')
  .build();

export const HYDROGEN_ORBITAL_2S_TEMPLATE = experiment('hydrogenOrbital2s')
  .describe(
    'Орбиталь 2s атома водорода: сферическое облако с узловой сферой на расстоянии двух боровских радиусов, где электрона не бывает никогда; внутри маленький шар, снаружи толстая оболочка. Средний радиус 6 боровских, 0.32 нм',
  )
  .space({
    gridPointsPerAxis: 64,
    cellSizeInMeters: 3.5e-11,
    potential: 'coulomb',
    nuclearCharge: 1,
  })
  .create('electron', 'electron')
  .place('electron', { x: 0, y: 0, z: 0 }, BOHR_RADIUS.value, 'hydrogen2s')
  .measurePosition('electron', 'position')
  .report('histogram', ['position.r'], 'Расстояние от ядра, м', POSITION_BINS)
  .report('mean', ['position.r'], 'Средний радиус, м')
  .build();

export const HYDROGEN_ORBITAL_2P_TEMPLATE = experiment('hydrogenOrbital2p')
  .describe(
    'Орбиталь 2p_z атома водорода: гантель из двух долей над и под ядром с узловой плоскостью z = 0, где плотность равна нулю. Средний радиус 5 боровских, 0.26 нм; распределение z двугорбое',
  )
  .space({
    gridPointsPerAxis: 64,
    cellSizeInMeters: 3.5e-11,
    potential: 'coulomb',
    nuclearCharge: 1,
  })
  .create('electron', 'electron')
  .place('electron', { x: 0, y: 0, z: 0 }, BOHR_RADIUS.value, 'hydrogen2p')
  .measurePosition('electron', 'position')
  .report('histogram', ['position.z'], 'Координата z, м', POSITION_BINS)
  .report('mean', ['position.r'], 'Средний радиус, м')
  .build();

export const HYDROGEN_ORBITAL_3D_TEMPLATE = experiment('hydrogenOrbital3d')
  .describe(
    'Орбиталь 3d_z² атома водорода: две доли вдоль оси z и пояс-бублик вокруг экватора, разделенные двумя узловыми конусами под углом 54.7° к оси. Средний радиус 10.5 боровских, 0.56 нм',
  )
  .space({
    gridPointsPerAxis: 64,
    cellSizeInMeters: 4.5e-11,
    potential: 'coulomb',
    nuclearCharge: 1,
  })
  .create('electron', 'electron')
  .place('electron', { x: 0, y: 0, z: 0 }, BOHR_RADIUS.value, 'hydrogen3d')
  .measurePosition('electron', 'position')
  .report('histogram', ['position.z'], 'Координата z, м', POSITION_BINS)
  .report('mean', ['position.r'], 'Средний радиус, м')
  .build();

const DIPOLE_FRAMES = 6;
const DIPOLE_PERIOD_IN_SECONDS = periodInSeconds(
  LYMAN_ALPHA_SHARE_OF_RYDBERG *
    RYDBERG_CONSTANT_TIMES_PLANCK_CONSTANT_TIMES_SPEED_OF_LIGHT_IN_EV.value,
);

export const HYDROGEN_DIPOLE_OSCILLATION_TEMPLATE = withFrames(
  experiment('hydrogenDipoleOscillation')
    .describe(
      'Атом водорода в равной суперпозиции 1s и 2p_z. Два уровня с разницей 10.2 эВ бьются с периодом h/ΔE = 0.41 фс: облако перетекает вверх и вниз вдоль z, как колеблющийся диполь, который и излучает линию Лайман-альфа 121.6 нм. За шесть кадров проходит полпериода, и облако оказывается внизу',
    )
    .parameter('frameDurationInSeconds', (HALF * DIPOLE_PERIOD_IN_SECONDS) / DIPOLE_FRAMES)
    .space({
      gridPointsPerAxis: 32,
      cellSizeInMeters: 3.5e-11,
      potential: 'coulomb',
      nuclearCharge: 1,
    })
    .create('electron', 'electron')
    .place('electron', { x: 0, y: 0, z: 0 }, BOHR_RADIUS.value, 'hydrogen1s2p'),
  DIPOLE_FRAMES,
  '{{frameDurationInSeconds}}',
)
  .measurePosition('electron', 'position')
  .report('histogram', ['position.z'], 'Координата z через полпериода, м', POSITION_BINS)
  .report('mean', ['position.z'], 'Средняя координата z, м')
  .build();

const CAT_TRAP_QUANTUM_IN_EV = 3;
const CAT_HALF_SEPARATION_IN_METERS = 3e-10;
const CAT_FRAMES = 4;

export const SCHRODINGER_CAT_IN_TRAP_TEMPLATE = withFrames(
  experiment('schrodingerCatInTrap')
    .describe(
      'Кот Шрёдингера: один электрон в суперпозиции двух пакетов на ±0.3 нм в ловушке ħω = 3 эВ. Каждый пакет катится к центру, через четверть периода 0.34 фс они накладываются, и в центре вспыхивают интерференционные полосы с шагом около 0.27 нм: это одна частица, интерферирующая сама с собой. Через полпериода пакеты меняются местами',
    )
    .parameter('trapQuantumInEv', CAT_TRAP_QUANTUM_IN_EV)
    .parameter('frameDurationInSeconds', periodInSeconds(CAT_TRAP_QUANTUM_IN_EV) / (2 * CAT_FRAMES))
    .space({
      gridPointsPerAxis: 32,
      cellSizeInMeters: 4e-11,
      potential: 'harmonic',
      potentialEnergyInEv: '{{trapQuantumInEv}}',
    })
    .create('electron', 'electron')
    .place(
      'electron',
      { x: CAT_HALF_SEPARATION_IN_METERS, y: 0, z: 0 },
      trapGroundWidthInMeters(CAT_TRAP_QUANTUM_IN_EV),
      'catState',
    ),
  CAT_FRAMES,
  '{{frameDurationInSeconds}}',
)
  .measurePosition('electron', 'position')
  .report('histogram', ['position.x'], 'Координата x через полпериода, м', POSITION_BINS)
  .report('standardDeviation', ['position.x'], 'Разброс x, м')
  .build();

const BOX_SIZE_IN_METERS = 6.4e-10;
const BOX_CELL_IN_METERS = 4e-11;
const BOX_WALL_IN_EV = 240;
const BOX_FRAMES = 4;

export const QUANTUM_CARPET_IN_BOX_TEMPLATE = withFrames(
  experiment('quantumCarpetInBox')
    .describe(
      'Квантовый ковер: узкий пакет в ящике 0.64 нм со стенками 240 эВ. Он расплывается и отражается от стен, волны складываются в узор, а затем пакет собирается снова: через восьмую часть времени возрождения T = 4mL²/πħ ≈ 5.1 фс видны копии, через четверть — две копии, через половину — зеркальное отражение исходного пакета. На сетке волна обращается в ноль на первой ячейке стены, поэтому L — ящик плюс одна ячейка',
    )
    .parameter(
      'frameDurationInSeconds',
      boxRevivalTimeInSeconds(BOX_SIZE_IN_METERS + BOX_CELL_IN_METERS) / (2 * BOX_FRAMES),
    )
    .space({
      gridPointsPerAxis: 32,
      cellSizeInMeters: BOX_CELL_IN_METERS,
      potential: 'box',
      potentialEnergyInEv: BOX_WALL_IN_EV,
      boxSizeInMeters: BOX_SIZE_IN_METERS,
    })
    .create('electron', 'electron')
    .place('electron', { x: -1e-10, y: 0, z: 0 }, 8e-11),
  BOX_FRAMES,
  '{{frameDurationInSeconds}}',
)
  .measurePosition('electron', 'position')
  .report(
    'histogram',
    ['position.x'],
    'Координата x через полвремени возрождения, м',
    POSITION_BINS,
  )
  .report('mean', ['position.x'], 'Средняя координата x, м')
  .build();
