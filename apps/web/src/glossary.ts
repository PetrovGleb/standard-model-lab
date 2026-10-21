/* Bilingual glossary for the English identifiers the engine uses: template categories, operations, influences, parameters, statistics, observables, states, particles; each record reads the active interface language. */
import type { TemplateCategory } from '@standard-model/contracts';
import { bilingual, say } from './language';

export const TEMPLATE_CATEGORY_LABELS = bilingual<TemplateCategory>({
  spin: ['Спин и запутанность', 'Spin and entanglement'],
  interference: ['Интерференция', 'Interference'],
  decays: ['Распады', 'Decays'],
  neutrinos: ['Нейтрино', 'Neutrinos'],
  colliders: ['Коллайдеры', 'Colliders'],
  confinement: ['Конфайнмент', 'Confinement'],
  protons: ['Протоны', 'Protons'],
  space: ['Куб пространства', 'Space cube'],
  nuclear: ['Ядра и термояд', 'Nuclei and fusion'],
  atoms: ['Атомы', 'Atoms'],
  molecules: ['Молекулы', 'Molecules'],
  radiation: ['Излучение', 'Radiation'],
  chemistry: ['Химия и горение', 'Chemistry and fire'],
});

export const READING_LABELS = bilingual<string>({
  internalTemperatureInKelvin: ['Т внутренняя, К', 'T internal, K'],
  kineticTemperatureInKelvin: ['Т кинетическая, К', 'T kinetic, K'],
  protons: ['Протонов Z', 'Protons Z'],
  neutrons: ['Нейтронов N', 'Neutrons N'],
  electrons: ['Электронов', 'Electrons'],
  bindingEnergyPerNucleonInMev: ['B/A, МэВ', 'B/A, MeV'],
  halfLifeInSeconds: ['T½, с', 'T½, s'],
  neutronSeparationEnergyInMev: ['Sₙ, МэВ', 'Sₙ, MeV'],
  protonSeparationEnergyInMev: ['Sₚ, МэВ', 'Sₚ, MeV'],
  ionizationEnergyInEv: ['Энергия ионизации, эВ', 'Ionization energy, eV'],
  landeFactor: ['g_J', 'g_J'],
  magneticMomentInBohrMagnetons: ['μ, μ_B', 'μ, μ_B'],
  atomCount: ['Атомов', 'Atoms'],
  bondCount: ['Связей', 'Bonds'],
  massInDaltons: ['Масса, Да', 'Mass, Da'],
  dipoleMomentInDebye: ['Диполь, Д', 'Dipole, D'],
  meanBondLengthInAngstrom: ['Длина связи, Å', 'Bond length, Å'],
  bondEnergyInEv: ['Энергия связей, эВ', 'Bond energy, eV'],
  weakestBondInEv: ['Слабейшая связь, эВ', 'Weakest bond, eV'],
  largestRotationalConstantInGigahertz: ['B вращ., ГГц', 'B rot., GHz'],
  vibrationalModeCount: ['Колебательных мод', 'Vibrational modes'],
  lowestWavenumberInInverseCentimeters: ['Младшая мода, см⁻¹', 'Lowest mode, cm⁻¹'],
  highestWavenumberInInverseCentimeters: ['Старшая мода, см⁻¹', 'Highest mode, cm⁻¹'],
  vibrationalQuanta: ['Колебательных квантов', 'Vibrational quanta'],
});

export const OPERATION_GLOSSARY = bilingual<string>({
  create: ['Создать частицу', 'Create a particle'],
  createNucleus: [
    'Создать атомное ядро любого нуклида из NUBASE2020: масса, спин, четность, период полураспада и распады',
    'Create a nucleus of any NUBASE2020 nuclide: mass, spin, parity, half-life and decays',
  ],
  createAtom: [
    'Создать атом или ион любого элемента: ядро плюс электроны с энергиями ионизации NIST',
    'Create an atom or ion of any element: a nucleus plus electrons with NIST ionization energies',
  ],
  createMolecule: [
    'Собрать молекулу из атомов и связей: геометрия, колебания, диполь и энергия связей считаются сами',
    'Build a molecule from atoms and bonds: geometry, vibrations, dipole and bond energies are computed',
  ],
  entangle: ['Запутать две частицы', 'Entangle two particles'],
  influence: ['Воздействие на частицы или окружение', 'Act on particles or the environment'],
  evolve: ['Эволюция во времени', 'Evolve in time'],
  measure: ['Измерение наблюдаемой', 'Measure an observable'],
  combine: [
    'Собрать составную частицу из составляющих, например протон из u u d; без динамики связывания',
    'Build a composite particle from its constituents, e.g. a proton from u u d; no binding dynamics',
  ],
  diffract: [
    'Пропустить частицу через две щели и записать, куда она попала на экране, в микрометрах',
    'Send a particle through two slits and record where it lands on the screen, in micrometers',
  ],
  collide: [
    'Столкнуть две частицы при их энергии и записать канал, √s и угол',
    'Collide two particles at their energy and record the channel, √s and angle',
  ],
  place: [
    'Поместить массивную частицу в куб как облако вероятности',
    'Put a massive particle into the cube as a probability cloud',
  ],
  propagate: [
    'Облака в кубе эволюционируют по уравнению Шредингера; перекрытые электрон и позитрон могут аннигилировать',
    'Clouds in the cube evolve by the Schrödinger equation; an overlapping electron and positron can annihilate',
  ],
  measurePosition: [
    'Найти частицу в кубе по |ψ|² и схлопнуть облако',
    'Find the particle in the cube by |ψ|² and collapse the cloud',
  ],
  measureSystem: [
    'Записать, какие частицы сейчас есть в системе: так видно аннигиляцию, распад или слияние',
    'Record which particles are in the system now: shows annihilation, decay or fusion',
  ],
  decay: ['Распад частицы', 'Particle decay'],
});

export const OPERATION_TITLES = bilingual<string>({
  create: ['Создать частицу', 'Create particle'],
  createNucleus: ['Создать ядро', 'Create nucleus'],
  createAtom: ['Создать атом', 'Create atom'],
  createMolecule: ['Создать молекулу', 'Create molecule'],
  entangle: ['Запутать', 'Entangle'],
  influence: ['Воздействие', 'Influence'],
  evolve: ['Эволюция', 'Evolution'],
  measure: ['Измерить', 'Measure'],
  combine: ['Собрать', 'Combine'],
  diffract: ['Две щели', 'Two slits'],
  collide: ['Столкнуть', 'Collide'],
  place: ['В куб', 'Into cube'],
  propagate: ['Эволюция в кубе', 'Evolve in cube'],
  measurePosition: ['Найти положение', 'Find position'],
  measureSystem: ['Замер системы', 'System snapshot'],
  decay: ['Распад', 'Decay'],
});

export const INFLUENCE_GLOSSARY = bilingual<string>({
  setTemperature: [
    'Задать температуру окружения и среды вокруг целей, К',
    'Set the temperature of the environment and the medium around the targets, K',
  ],
  cool: [
    'Охладить окружение и среду вокруг целей на величину, К',
    'Cool the environment and the medium around the targets by an amount, K',
  ],
  heat: [
    'Нагреть окружение и среду вокруг целей на величину, К: среда уже задана — можно нагреть только часть частиц',
    'Heat the environment and the medium around the targets by an amount, K: with a medium set you can heat only some of the particles',
  ],
  applyMagneticField: [
    'Приложить однородное магнитное поле, Тл',
    'Apply a uniform magnetic field, T',
  ],
  removeMagneticField: ['Убрать магнитное поле', 'Remove the magnetic field'],
  applyElectricField: [
    'Приложить однородное электрическое поле, В/м',
    'Apply a uniform electric field, V/m',
  ],
  setCoherenceTimes: [
    'Задать времена когерентности T2 и T1, с',
    'Set the coherence times T2 and T1, s',
  ],
  setMedium: [
    'Заполнить пространство средой из частиц одного или нескольких видов',
    'Fill space with a medium of one or more particle species',
  ],
  boost: ['Буст Лоренца долями скорости света', 'Lorentz boost in fractions of the speed of light'],
  rotateSpin: ['Повернуть спин вокруг оси', 'Rotate the spin about an axis'],
  thermalize: [
    'Термализовать спин по распределению Больцмана',
    'Thermalize the spin to the Boltzmann distribution',
  ],
  randomize: ['Случайное состояние спина', 'Random spin state'],
  evolve: ['Эволюция во времени', 'Evolve in time'],
  travel: ['Пролететь расстояние со своей скоростью, км', 'Travel a distance at its own speed, km'],
  irradiate: [
    'Облучить: частота задает энергию фотона (СВЧ, ИК, свет, УФ, рентген, гамма), мощность и площадь пучка — поток',
    'Irradiate: the frequency sets the photon energy (microwave, IR, light, UV, X-ray, gamma), the power and beam area set the flux',
  ],
  laserCool: [
    'Лазерное доплеровское охлаждение атома или иона на его линии из NIST',
    'Laser Doppler cooling of an atom or ion on its NIST line',
  ],
  placeBody: [
    'Поместить в куб тело со средой: шар или куб заданного размера вокруг центра; точка видит среду самого маленького тела, в котором лежит',
    'Place a body of a medium in the cube: a ball or a box of a given size around a centre; a point sees the medium of the smallest body that holds it',
  ],
  electrolyze: [
    'Электролиз: электроды под напряжением, ток и время по закону Фарадея; молекула распадается на элементы выше своего напряжения разложения',
    'Electrolysis: electrodes at a voltage, current and time by Faraday law; a molecule splits into its elements above its decomposition voltage',
  ],
});

export const PARAMETER_GLOSSARY = bilingual<string>({
  temperatureInKelvin: ['Температура, К', 'Temperature, K'],
  pressureInPascals: ['Давление, Па', 'Pressure, Pa'],
  radiationTemperatureInKelvin: ['Температура излучения, К', 'Radiation temperature, K'],
  byKelvin: ['На сколько кельвинов', 'By how many kelvin'],
  xInTesla: ['Компонента x поля, Тл', 'Field component x, T'],
  yInTesla: ['Компонента y поля, Тл', 'Field component y, T'],
  zInTesla: ['Компонента z поля, Тл', 'Field component z, T'],
  xInVoltsPerMeter: ['Компонента x поля, В/м', 'Field component x, V/m'],
  yInVoltsPerMeter: ['Компонента y поля, В/м', 'Field component y, V/m'],
  zInVoltsPerMeter: ['Компонента z поля, В/м', 'Field component z, V/m'],
  dephasingTimeInSeconds: ['Время дефазировки T2, с', 'Dephasing time T2, s'],
  relaxationTimeInSeconds: ['Время релаксации T1, с', 'Relaxation time T1, s'],
  species: ['Вид частиц компонента', 'Particle species of the component'],
  components: ['Компоненты среды', 'Medium components'],
  reactionMode: ['Реакции за шаг', 'Reactions per step'],
  numberDensityPerCubicMeter: ['Концентрация, м⁻³', 'Number density, m⁻³'],
  crossSectionInSquareMeters: ['Сечение взаимодействия, м²', 'Interaction cross section, m²'],
  xVelocityInMetersPerSecond: ['Скорость потока x, м/с', 'Flow velocity x, m/s'],
  yVelocityInMetersPerSecond: ['Скорость потока y, м/с', 'Flow velocity y, m/s'],
  zVelocityInMetersPerSecond: ['Скорость потока z, м/с', 'Flow velocity z, m/s'],
  xFraction: ['Скорость x в долях c', 'Velocity x in units of c'],
  yFraction: ['Скорость y в долях c', 'Velocity y in units of c'],
  zFraction: ['Скорость z в долях c', 'Velocity z in units of c'],
  polarAngleDegrees: ['Полярный угол оси, градусы', 'Polar angle of the axis, degrees'],
  azimuthDegrees: ['Азимут оси, градусы', 'Azimuth of the axis, degrees'],
  angleRadians: ['Угол поворота, радианы', 'Rotation angle, radians'],
  durationInSeconds: ['Длительность, с', 'Duration, s'],
  distanceInKilometers: ['Расстояние, км', 'Distance, km'],
  slitSeparationInMeters: ['Расстояние между щелями, м', 'Slit separation, m'],
  slitWidthInMeters: ['Ширина щели, м', 'Slit width, m'],
  screenDistanceInMeters: ['Расстояние до экрана, м', 'Distance to the screen, m'],
  cellSizeInMeters: ['Размер ячейки куба, м', 'Cube cell size, m'],
  widthInMeters: ['Ширина облака σ, м', 'Cloud width σ, m'],
  potentialEnergyInEv: [
    'Энергия потенциала, эВ: высота барьера или ħω ловушки',
    'Potential energy, eV: barrier height or trap ħω',
  ],
  barrierThicknessInMeters: ['Толщина барьера, м', 'Barrier thickness, m'],
  nuclearCharge: ['Заряд ядра Z', 'Nuclear charge Z'],
  wellSeparationInMeters: [
    'Расстояние между минимумами ям 2a, м',
    'Separation of the well minima 2a, m',
  ],
  boxSizeInMeters: ['Размер ящика L, м', 'Box size L, m'],
  frequencyInHertz: [
    'Частота излучения, Гц; энергия фотона E = hν',
    'Radiation frequency, Hz; photon energy E = hν',
  ],
  powerInWatts: ['Мощность пучка, Вт', 'Beam power, W'],
  beamAreaInSquareMeters: [
    'Площадь пучка, м²; интенсивность = мощность / площадь',
    'Beam area, m²; intensity = power / area',
  ],
  detuningInLinewidths: [
    'Отстройка лазера от резонанса в ширинах линии Γ, меньше нуля',
    'Laser detuning from resonance in linewidths Γ, below zero',
  ],
  saturationParameter: ['Параметр насыщения s = I/I_нас', 'Saturation parameter s = I/I_sat'],
  thicknessInMeters: [
    'Толщина среды, м: диаметр шара, который она заполняет',
    'Medium thickness, m: the diameter of the ball it fills',
  ],
  voltageInVolts: ['Напряжение, В', 'Voltage, V'],
  currentInAmperes: ['Ток, А', 'Current, A'],
  densityLaw: ['Плотность компонента', 'Component density'],
  shape: ['Форма тела', 'Body shape'],
  sizeInMeters: [
    'Размер тела, м: диаметр шара или ребро куба',
    'Body size, m: ball diameter or box edge',
  ],
  xCenterInMeters: ['Центр тела x, м', 'Body centre x, m'],
  yCenterInMeters: ['Центр тела y, м', 'Body centre y, m'],
  zCenterInMeters: ['Центр тела z, м', 'Body centre z, m'],
});

export const BODY_SHAPE_LABELS = bilingual<'ball' | 'box'>({
  ball: ['шар', 'ball'],
  box: ['куб', 'box'],
});

export const SPACE_WALL_LABELS = bilingual<'open' | 'reflecting'>({
  open: [
    'открытые: частицы улетают, волна гаснет у края',
    'open: particles fly out, a wave fades at the edge',
  ],
  reflecting: [
    'зеркальные из сверхвещества: частицы и волны отражаются без потерь',
    'mirrors of a super-material: particles and waves bounce back without loss',
  ],
});

export const DENSITY_LAW_LABELS = bilingual<'given' | 'thermalEquilibrium'>({
  given: ['задана числом', 'given as a number'],
  thermalEquilibrium: [
    'тепловое равновесие при температуре среды',
    'thermal equilibrium at the medium temperature',
  ],
});

export const MEDIUM_REACTION_MODES = bilingual<'oneReactionPerStep' | 'allReactionsInStep'>({
  oneReactionPerStep: [
    'Одна реакция за шаг: продукты реагируют со следующего шага',
    'One reaction per step: products react from the next step on',
  ],
  allReactionsInStep: [
    'Все реакции за шаг: ядро-продукт реагирует в остатке шага',
    'All reactions in the step: a product nucleus reacts in the rest of the step',
  ],
});

export const MEDIUM_COMPONENT_ACTIONS = bilingual<'addMediumComponent' | 'removeMediumComponent'>({
  addMediumComponent: ['Добавить компонент', 'Add component'],
  removeMediumComponent: ['Удалить компонент', 'Remove component'],
});

export const VECTOR_GROUP_TITLES = bilingual<string>({
  InTesla: ['Магнитное поле, Тл', 'Magnetic field, T'],
  InVoltsPerMeter: ['Электрическое поле, В/м', 'Electric field, V/m'],
  VelocityInMetersPerSecond: ['Поток среды, м/с', 'Medium flow, m/s'],
  CenterInMeters: ['Центр тела, м', 'Body centre, m'],
  Fraction: ['Скорость, доли c', 'Velocity, fractions of c'],
});

export const UNSET_PARAMETER_HINTS = bilingual<string>({
  pressureInPascals: [
    'не задано: давление идеального газа Σ n k T',
    'not set: the ideal-gas pressure Σ n k T',
  ],
  radiationTemperatureInKelvin: ['не задано: поля излучения нет', 'not set: no radiation field'],
  thicknessInMeters: [
    'не задано: среда бесконечна, ничего не вылетает и не нагревает ее',
    'not set: the medium is infinite, nothing leaves it and nothing heats it',
  ],
});

export interface NamedGroup {
  readonly label: string;
  readonly names: readonly string[];
}

function group(russian: string, english: string, names: readonly string[]): NamedGroup {
  return {
    get label() {
      return say(russian, english);
    },
    names,
  };
}

export const INFLUENCE_CATEGORIES: readonly NamedGroup[] = [
  group('Температура', 'Temperature', ['setTemperature', 'cool', 'heat']),
  group('Поля', 'Fields', ['applyMagneticField', 'removeMagneticField', 'applyElectricField']),
  group('Среда и когерентность', 'Medium and coherence', [
    'setMedium',
    'placeBody',
    'setCoherenceTimes',
  ]),
  group('Движение и время', 'Motion and time', ['boost', 'travel', 'evolve']),
  group('Спин', 'Spin', ['rotateSpin', 'thermalize', 'randomize']),
  group('Излучение и лазеры', 'Radiation and lasers', ['irradiate', 'laserCool']),
  group('Электричество и химия', 'Electricity and chemistry', ['electrolyze']),
];

export function influenceCategories(available: readonly string[]): readonly NamedGroup[] {
  const listed = new Set(INFLUENCE_CATEGORIES.flatMap((category) => category.names));
  const others = available.filter((name) => !listed.has(name));
  return others.length === 0
    ? INFLUENCE_CATEGORIES
    : [...INFLUENCE_CATEGORIES, group('Другие', 'Other', others)];
}

export const ENTANGLED_STATE_CATEGORIES: readonly NamedGroup[] = [
  group('Спиновые состояния', 'Spin states', ['spinSinglet', 'spinTripletZero']),
  group('Состояния Белла', 'Bell states', [
    'bellPhiPlus',
    'bellPhiMinus',
    'bellPsiPlus',
    'bellPsiMinus',
  ]),
];

export function groupOf(groups: readonly NamedGroup[], name: string): NamedGroup | undefined {
  return groups.find((candidate) => candidate.names.includes(name));
}

export const POTENTIAL_GLOSSARY = bilingual<string>({
  free: ['Свободное пространство', 'Free space'],
  barrier: ['Барьер, плоский слой по x', 'Barrier, a flat slab along x'],
  harmonic: ['Гармоническая ловушка', 'Harmonic trap'],
  coulomb: [
    'Кулоновский центр, ядро в середине куба',
    'Coulomb center, a nucleus in the middle of the cube',
  ],
  doubleSlit: [
    'Стена по x с двумя щелями вдоль z: высота, толщина, ширина щелей и расстояние между ними',
    'A wall across x with two slits along z: height, thickness, slit width and separation',
  ],
  doubleWell: [
    'Двойная яма V₀[((x/a)² − 1)² + 4(y² + z²)/a²]: барьер V₀ между двумя минимумами на ±a',
    'Double well V₀[((x/a)² − 1)² + 4(y² + z²)/a²]: a barrier V₀ between two minima at ±a',
  ],
  box: [
    'Ящик: внутри свободно, снаружи стенки высотой V₀',
    'A box: free inside, walls of height V₀ outside',
  ],
});

export const WAVEPACKET_SHAPE_LABELS = bilingual<string>({
  gaussian: ['гауссов пакет', 'Gaussian packet'],
  groundState: ['основное состояние', 'ground state'],
  hydrogen2s: ['орбиталь 2s водорода', 'hydrogen 2s orbital'],
  hydrogen2p: ['орбиталь 2p_z водорода', 'hydrogen 2p_z orbital'],
  hydrogen3d: ['орбиталь 3d_z² водорода', 'hydrogen 3d_z² orbital'],
  hydrogen1s2p: ['суперпозиция 1s + 2p_z', '1s + 2p_z superposition'],
  catState: ['кот: два пакета в ±центре', 'cat: two packets at ±center'],
});

export const STATISTIC_GLOSSARY = bilingual<string>({
  frequency: ['Частота каждого исхода записи', 'Frequency of each outcome of a record'],
  mean: ['Среднее значение записи', 'Mean value of a record'],
  probabilitySameSign: [
    'Доля выстрелов, где знаки двух записей совпали',
    'Share of shots where the signs of two records agree',
  ],
  correlation: [
    'Среднее произведение знаков двух записей',
    'Mean product of the signs of two records',
  ],
  chsh: [
    'Величина CHSH по четырем парам записей: (a,b), (a,b′), (a′,b), (a′,b′)',
    'CHSH value over four record pairs: (a,b), (a,b′), (a′,b), (a′,b′)',
  ],
  histogram: [
    'Распределение числовой записи по интервалам, рисуется графиком',
    'Distribution of a numeric record over bins, drawn as a chart',
  ],
  standardDeviation: [
    'Стандартное отклонение числовой записи',
    'Standard deviation of a numeric record',
  ],
});

export const OBSERVABLE_GLOSSARY = bilingual<string>({
  spin: ['Спин', 'Spin'],
  polarization: ['Поляризация', 'Polarization'],
  flavor: ['Аромат нейтрино', 'Neutrino flavor'],
});

export const ENTANGLED_STATE_GLOSSARY = bilingual<string>({
  spinSinglet: ['Спиновый синглет (|↑↓⟩ − |↓↑⟩)/√2', 'Spin singlet (|↑↓⟩ − |↓↑⟩)/√2'],
  spinTripletZero: [
    'Триплет с нулевой проекцией (|↑↓⟩ + |↓↑⟩)/√2',
    'Triplet with zero projection (|↑↓⟩ + |↓↑⟩)/√2',
  ],
  bellPhiPlus: ['Состояние Белла Φ⁺ (|00⟩ + |11⟩)/√2', 'Bell state Φ⁺ (|00⟩ + |11⟩)/√2'],
  bellPhiMinus: ['Состояние Белла Φ⁻ (|00⟩ − |11⟩)/√2', 'Bell state Φ⁻ (|00⟩ − |11⟩)/√2'],
  bellPsiPlus: ['Состояние Белла Ψ⁺ (|01⟩ + |10⟩)/√2', 'Bell state Ψ⁺ (|01⟩ + |10⟩)/√2'],
  bellPsiMinus: ['Состояние Белла Ψ⁻ (|01⟩ − |10⟩)/√2', 'Bell state Ψ⁻ (|01⟩ − |10⟩)/√2'],
});

export const SPIN_PREPARATION_GLOSSARY = bilingual<string>({
  none: ['Спин не готовить', 'Do not prepare the spin'],
  up: ['Спин вверх по оси z', 'Spin up along z'],
  down: ['Спин вниз по оси z', 'Spin down along z'],
  plusX: ['Спин вдоль +x', 'Spin along +x'],
  minusX: ['Спин вдоль −x', 'Spin along −x'],
  plusY: ['Спин вдоль +y', 'Spin along +y'],
  minusY: ['Спин вдоль −y', 'Spin along −y'],
});

export const PARTICLE_GLOSSARY = bilingual<string>({
  up: ['u-кварк', 'u quark'],
  down: ['d-кварк', 'd quark'],
  strange: ['s-кварк', 's quark'],
  charm: ['c-кварк', 'c quark'],
  bottom: ['b-кварк', 'b quark'],
  top: ['t-кварк', 't quark'],
  antiUp: ['анти-u-кварк', 'anti-u quark'],
  antiDown: ['анти-d-кварк', 'anti-d quark'],
  antiStrange: ['анти-s-кварк', 'anti-s quark'],
  antiCharm: ['анти-c-кварк', 'anti-c quark'],
  antiBottom: ['анти-b-кварк', 'anti-b quark'],
  antiTop: ['анти-t-кварк', 'anti-t quark'],
  electron: ['электрон', 'electron'],
  muon: ['мюон', 'muon'],
  tau: ['тау-лептон', 'tau lepton'],
  positron: ['позитрон', 'positron'],
  antiMuon: ['антимюон', 'antimuon'],
  antiTau: ['анти-тау', 'antitau'],
  electronNeutrino: ['электронное нейтрино', 'electron neutrino'],
  muonNeutrino: ['мюонное нейтрино', 'muon neutrino'],
  tauNeutrino: ['тау-нейтрино', 'tau neutrino'],
  electronAntineutrino: ['электронное антинейтрино', 'electron antineutrino'],
  muonAntineutrino: ['мюонное антинейтрино', 'muon antineutrino'],
  tauAntineutrino: ['тау-антинейтрино', 'tau antineutrino'],
  photon: ['фотон', 'photon'],
  gluon: ['глюон', 'gluon'],
  wPlus: ['W⁺-бозон', 'W⁺ boson'],
  wMinus: ['W⁻-бозон', 'W⁻ boson'],
  zBoson: ['Z-бозон', 'Z boson'],
  higgsBoson: ['бозон Хиггса', 'Higgs boson'],
  proton: ['протон', 'proton'],
  neutron: ['нейтрон', 'neutron'],
  antiProton: ['антипротон', 'antiproton'],
  antiNeutron: ['антинейтрон', 'antineutron'],
  pionPlus: ['π⁺-мезон', 'π⁺ meson'],
  pionMinus: ['π⁻-мезон', 'π⁻ meson'],
  pionZero: ['π⁰-мезон', 'π⁰ meson'],
  etaMeson: ['η-мезон', 'η meson'],
  rhoPlus: ['ρ⁺-мезон', 'ρ⁺ meson'],
  rhoMinus: ['ρ⁻-мезон', 'ρ⁻ meson'],
  rhoZero: ['ρ⁰-мезон', 'ρ⁰ meson'],
  omegaMeson: ['ω-мезон', 'ω meson'],
  etaPrimeMeson: ['η′-мезон', 'η′ meson'],
  phiMeson: ['φ-мезон', 'φ meson'],
  kaonPlus: ['K⁺-мезон', 'K⁺ meson'],
  kaonMinus: ['K⁻-мезон', 'K⁻ meson'],
  kaonShort: ['K-short, K⁰ₛ', 'K-short, K⁰ₛ'],
  kaonLong: ['K-long, K⁰ₗ', 'K-long, K⁰ₗ'],
  kaonStarPlus: ['K*⁺-мезон', 'K*⁺ meson'],
  kaonStarMinus: ['K*⁻-мезон', 'K*⁻ meson'],
  kaonStarZero: ['K*⁰-мезон', 'K*⁰ meson'],
  antiKaonStarZero: ['анти-K*⁰-мезон', 'anti-K*⁰ meson'],
  dPlus: ['D⁺-мезон', 'D⁺ meson'],
  dMinus: ['D⁻-мезон', 'D⁻ meson'],
  dZero: ['D⁰-мезон', 'D⁰ meson'],
  antiDZero: ['анти-D⁰-мезон', 'anti-D⁰ meson'],
  dStarPlus: ['D*⁺-мезон', 'D*⁺ meson'],
  dStarMinus: ['D*⁻-мезон', 'D*⁻ meson'],
  dStarZero: ['D*⁰-мезон', 'D*⁰ meson'],
  antiDStarZero: ['анти-D*⁰-мезон', 'anti-D*⁰ meson'],
  dSPlus: ['Dₛ⁺-мезон', 'Dₛ⁺ meson'],
  dSMinus: ['Dₛ⁻-мезон', 'Dₛ⁻ meson'],
  dSStarPlus: ['Dₛ*⁺-мезон', 'Dₛ*⁺ meson'],
  dSStarMinus: ['Dₛ*⁻-мезон', 'Dₛ*⁻ meson'],
  bPlus: ['B⁺-мезон', 'B⁺ meson'],
  bMinus: ['B⁻-мезон', 'B⁻ meson'],
  bZero: ['B⁰-мезон', 'B⁰ meson'],
  antiBZero: ['анти-B⁰-мезон', 'anti-B⁰ meson'],
  bStarPlus: ['B*⁺-мезон', 'B*⁺ meson'],
  bStarMinus: ['B*⁻-мезон', 'B*⁻ meson'],
  bStarZero: ['B*⁰-мезон', 'B*⁰ meson'],
  antiBStarZero: ['анти-B*⁰-мезон', 'anti-B*⁰ meson'],
  bSZero: ['Bₛ⁰-мезон', 'Bₛ⁰ meson'],
  antiBSZero: ['анти-Bₛ⁰-мезон', 'anti-Bₛ⁰ meson'],
  bSStarZero: ['Bₛ*⁰-мезон', 'Bₛ*⁰ meson'],
  antiBSStarZero: ['анти-Bₛ*⁰-мезон', 'anti-Bₛ*⁰ meson'],
  lambdaBaryon: ['Λ-барион', 'Λ baryon'],
  antiLambdaBaryon: ['анти-Λ-барион', 'anti-Λ baryon'],
  sigmaPlus: ['Σ⁺-барион', 'Σ⁺ baryon'],
  antiSigmaPlus: ['анти-Σ⁻-барион', 'anti-Σ⁻ baryon'],
  sigmaZero: ['Σ⁰-барион', 'Σ⁰ baryon'],
  antiSigmaZero: ['анти-Σ⁰-барион', 'anti-Σ⁰ baryon'],
  sigmaMinus: ['Σ⁻-барион', 'Σ⁻ baryon'],
  antiSigmaMinus: ['анти-Σ⁺-барион', 'anti-Σ⁺ baryon'],
  xiZero: ['Ξ⁰-барион', 'Ξ⁰ baryon'],
  antiXiZero: ['анти-Ξ⁰-барион', 'anti-Ξ⁰ baryon'],
  xiMinus: ['Ξ⁻-барион', 'Ξ⁻ baryon'],
  antiXiMinus: ['анти-Ξ⁺-барион', 'anti-Ξ⁺ baryon'],
  deltaPlusPlus: ['Δ⁺⁺-барион', 'Δ⁺⁺ baryon'],
  antiDeltaPlusPlus: ['анти-Δ⁻⁻-барион', 'anti-Δ⁻⁻ baryon'],
  deltaPlus: ['Δ⁺-барион', 'Δ⁺ baryon'],
  antiDeltaPlus: ['анти-Δ⁻-барион', 'anti-Δ⁻ baryon'],
  deltaZero: ['Δ⁰-барион', 'Δ⁰ baryon'],
  antiDeltaZero: ['анти-Δ⁰-барион', 'anti-Δ⁰ baryon'],
  deltaMinus: ['Δ⁻-барион', 'Δ⁻ baryon'],
  antiDeltaMinus: ['анти-Δ⁺-барион', 'anti-Δ⁺ baryon'],
  sigmaStarPlus: ['Σ*⁺-барион', 'Σ*⁺ baryon'],
  antiSigmaStarPlus: ['анти-Σ*⁻-барион', 'anti-Σ*⁻ baryon'],
  sigmaStarZero: ['Σ*⁰-барион', 'Σ*⁰ baryon'],
  antiSigmaStarZero: ['анти-Σ*⁰-барион', 'anti-Σ*⁰ baryon'],
  sigmaStarMinus: ['Σ*⁻-барион', 'Σ*⁻ baryon'],
  antiSigmaStarMinus: ['анти-Σ*⁺-барион', 'anti-Σ*⁺ baryon'],
  xiStarZero: ['Ξ*⁰-барион', 'Ξ*⁰ baryon'],
  antiXiStarZero: ['анти-Ξ*⁰-барион', 'anti-Ξ*⁰ baryon'],
  xiStarMinus: ['Ξ*⁻-барион', 'Ξ*⁻ baryon'],
  antiXiStarMinus: ['анти-Ξ*⁺-барион', 'anti-Ξ*⁺ baryon'],
  omegaMinus: ['Ω⁻-барион', 'Ω⁻ baryon'],
  antiOmegaMinus: ['анти-Ω⁺-барион', 'anti-Ω⁺ baryon'],
  lambdaCPlus: ['Λc⁺-барион', 'Λc⁺ baryon'],
  antiLambdaCPlus: ['анти-Λc⁻-барион', 'anti-Λc⁻ baryon'],
  sigmaCPlusPlus: ['Σc⁺⁺-барион', 'Σc⁺⁺ baryon'],
  antiSigmaCPlusPlus: ['анти-Σc⁻⁻-барион', 'anti-Σc⁻⁻ baryon'],
  sigmaCPlus: ['Σc⁺-барион', 'Σc⁺ baryon'],
  antiSigmaCPlus: ['анти-Σc⁻-барион', 'anti-Σc⁻ baryon'],
  sigmaCZero: ['Σc⁰-барион', 'Σc⁰ baryon'],
  antiSigmaCZero: ['анти-Σc⁰-барион', 'anti-Σc⁰ baryon'],
  sigmaCStarPlusPlus: ['Σc*⁺⁺-барион', 'Σc*⁺⁺ baryon'],
  antiSigmaCStarPlusPlus: ['анти-Σc*⁻⁻-барион', 'anti-Σc*⁻⁻ baryon'],
  sigmaCStarPlus: ['Σc*⁺-барион', 'Σc*⁺ baryon'],
  antiSigmaCStarPlus: ['анти-Σc*⁻-барион', 'anti-Σc*⁻ baryon'],
  sigmaCStarZero: ['Σc*⁰-барион', 'Σc*⁰ baryon'],
  antiSigmaCStarZero: ['анти-Σc*⁰-барион', 'anti-Σc*⁰ baryon'],
  xiCPlus: ['Ξc⁺-барион', 'Ξc⁺ baryon'],
  antiXiCPlus: ['анти-Ξc⁻-барион', 'anti-Ξc⁻ baryon'],
  xiCZero: ['Ξc⁰-барион', 'Ξc⁰ baryon'],
  antiXiCZero: ['анти-Ξc⁰-барион', 'anti-Ξc⁰ baryon'],
  xiCPrimePlus: ['Ξc′⁺-барион', 'Ξc′⁺ baryon'],
  antiXiCPrimePlus: ['анти-Ξc′⁻-барион', 'anti-Ξc′⁻ baryon'],
  xiCPrimeZero: ['Ξc′⁰-барион', 'Ξc′⁰ baryon'],
  antiXiCPrimeZero: ['анти-Ξc′⁰-барион', 'anti-Ξc′⁰ baryon'],
  xiCStarPlus: ['Ξc*⁺-барион', 'Ξc*⁺ baryon'],
  antiXiCStarPlus: ['анти-Ξc*⁻-барион', 'anti-Ξc*⁻ baryon'],
  xiCStarZero: ['Ξc*⁰-барион', 'Ξc*⁰ baryon'],
  antiXiCStarZero: ['анти-Ξc*⁰-барион', 'anti-Ξc*⁰ baryon'],
  omegaCZero: ['Ωc⁰-барион', 'Ωc⁰ baryon'],
  antiOmegaCZero: ['анти-Ωc⁰-барион', 'anti-Ωc⁰ baryon'],
  omegaCStarZero: ['Ωc*⁰-барион', 'Ωc*⁰ baryon'],
  antiOmegaCStarZero: ['анти-Ωc*⁰-барион', 'anti-Ωc*⁰ baryon'],
  lambdaBZero: ['Λb⁰-барион', 'Λb⁰ baryon'],
  antiLambdaBZero: ['анти-Λb⁰-барион', 'anti-Λb⁰ baryon'],
  sigmaBPlus: ['Σb⁺-барион', 'Σb⁺ baryon'],
  antiSigmaBPlus: ['анти-Σb⁻-барион', 'anti-Σb⁻ baryon'],
  sigmaBMinus: ['Σb⁻-барион', 'Σb⁻ baryon'],
  antiSigmaBMinus: ['анти-Σb⁺-барион', 'anti-Σb⁺ baryon'],
  sigmaBStarPlus: ['Σb*⁺-барион', 'Σb*⁺ baryon'],
  antiSigmaBStarPlus: ['анти-Σb*⁻-барион', 'anti-Σb*⁻ baryon'],
  sigmaBStarMinus: ['Σb*⁻-барион', 'Σb*⁻ baryon'],
  antiSigmaBStarMinus: ['анти-Σb*⁺-барион', 'anti-Σb*⁺ baryon'],
  xiBZero: ['Ξb⁰-барион', 'Ξb⁰ baryon'],
  antiXiBZero: ['анти-Ξb⁰-барион', 'anti-Ξb⁰ baryon'],
  xiBMinus: ['Ξb⁻-барион', 'Ξb⁻ baryon'],
  antiXiBMinus: ['анти-Ξb⁺-барион', 'anti-Ξb⁺ baryon'],
  xiBPrimeMinus: ['Ξb′⁻-барион', 'Ξb′⁻ baryon'],
  antiXiBPrimeMinus: ['анти-Ξb′⁺-барион', 'anti-Ξb′⁺ baryon'],
  xiBStarZero: ['Ξb*⁰-барион', 'Ξb*⁰ baryon'],
  antiXiBStarZero: ['анти-Ξb*⁰-барион', 'anti-Ξb*⁰ baryon'],
  xiBStarMinus: ['Ξb*⁻-барион', 'Ξb*⁻ baryon'],
  antiXiBStarMinus: ['анти-Ξb*⁺-барион', 'anti-Ξb*⁺ baryon'],
  omegaBMinus: ['Ωb⁻-барион', 'Ωb⁻ baryon'],
  antiOmegaBMinus: ['анти-Ωb⁺-барион', 'anti-Ωb⁺ baryon'],
  downDownSpinOne: ['дикварк dd, спин 1', 'dd diquark, spin 1'],
  antiDownDownSpinOne: ['антидикварк dd, спин 1', 'anti-dd diquark, spin 1'],
  upDownSpinZero: ['дикварк ud, спин 0', 'ud diquark, spin 0'],
  antiUpDownSpinZero: ['антидикварк ud, спин 0', 'anti-ud diquark, spin 0'],
  upDownSpinOne: ['дикварк ud, спин 1', 'ud diquark, spin 1'],
  antiUpDownSpinOne: ['антидикварк ud, спин 1', 'anti-ud diquark, spin 1'],
  upUpSpinOne: ['дикварк uu, спин 1', 'uu diquark, spin 1'],
  antiUpUpSpinOne: ['антидикварк uu, спин 1', 'anti-uu diquark, spin 1'],
  strangeDownSpinZero: ['дикварк sd, спин 0', 'sd diquark, spin 0'],
  antiStrangeDownSpinZero: ['антидикварк sd, спин 0', 'anti-sd diquark, spin 0'],
  strangeDownSpinOne: ['дикварк sd, спин 1', 'sd diquark, spin 1'],
  antiStrangeDownSpinOne: ['антидикварк sd, спин 1', 'anti-sd diquark, spin 1'],
  strangeUpSpinZero: ['дикварк su, спин 0', 'su diquark, spin 0'],
  antiStrangeUpSpinZero: ['антидикварк su, спин 0', 'anti-su diquark, spin 0'],
  strangeUpSpinOne: ['дикварк su, спин 1', 'su diquark, spin 1'],
  antiStrangeUpSpinOne: ['антидикварк su, спин 1', 'anti-su diquark, spin 1'],
  strangeStrangeSpinOne: ['дикварк ss, спин 1', 'ss diquark, spin 1'],
  antiStrangeStrangeSpinOne: ['антидикварк ss, спин 1', 'anti-ss diquark, spin 1'],
  deuteron: ['дейтрон, ядро ²H', 'deuteron, ²H nucleus'],
  antiDeuteron: ['антидейтрон', 'antideuteron'],
  triton: ['тритон, ядро ³H', 'triton, ³H nucleus'],
  antiTriton: ['антитритон', 'antitriton'],
  helion: ['гелион, ядро ³He', 'helion, ³He nucleus'],
  antiHelion: ['антигелион', 'antihelion'],
  alphaParticle: ['альфа-частица, ядро ⁴He', 'alpha particle, ⁴He nucleus'],
  antiAlphaParticle: ['анти-альфа-частица', 'anti-alpha particle'],
  hydrogenAtom: ['атом водорода', 'hydrogen atom'],
  antiHydrogenAtom: ['атом антиводорода', 'antihydrogen atom'],
  deuteriumAtom: ['атом дейтерия', 'deuterium atom'],
  antiDeuteriumAtom: ['атом антидейтерия', 'antideuterium atom'],
  tritiumAtom: ['атом трития', 'tritium atom'],
  antiTritiumAtom: ['атом антитрития', 'antitritium atom'],
  heliumThreeIon: ['ион гелия-3 ³He⁺', 'helium-3 ion ³He⁺'],
  antiHeliumThreeIon: ['антиион гелия-3', 'antihelium-3 ion'],
  heliumIon: ['ион гелия He⁺', 'helium ion He⁺'],
  antiHeliumIon: ['антиион гелия', 'antihelium ion'],
  heliumThreeAtom: ['атом гелия-3', 'helium-3 atom'],
  antiHeliumThreeAtom: ['атом антигелия-3', 'antihelium-3 atom'],
  heliumAtom: ['атом гелия', 'helium atom'],
  antiHeliumAtom: ['атом антигелия', 'antihelium atom'],
  hadrons: ['адроны', 'hadrons'],
  jet: ['струя', 'jet'],
});

export function describe(
  glossary: Readonly<Record<string, string>>,
  key: string,
  fallback = '',
): string {
  return glossary[key] ?? fallback;
}
