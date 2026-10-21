/* Hints: the RU/EN explanations shown on hover across the app, for the environment, conserved quantities, particle readings, results, templates, the plan schema and the species
   picker, gathered in one place so the same notion is explained in the same words everywhere. */
import { bilingual, say } from './language';

export const HINTS = bilingual({
  scopeWhole: [
    'Общее окружение: в нём находятся все частицы, созданные до и после этого шага',
    'Shared environment: every particle created before or after this step is inside it',
  ],
  scopeOnly: [
    'Область окружения только для перечисленных частиц: её открыло воздействие с целями',
    'An environment region for the listed particles only, opened by an influence with targets',
  ],
  temperature: [
    'Температура среды в кельвинах: от неё скорости частиц среды, заселённость уровней и скорости реакций',
    'Medium temperature in kelvin: it sets the speeds of the medium particles, level populations and reaction rates',
  ],
  pressure: [
    'Давление в паскалях; без явного значения это идеальный газ Σ n k T. Давление решает агрегатное состояние, скорости реакций решают концентрации',
    'Pressure in pascals; without a given value it is the ideal gas Σ n k T. Pressure decides the aggregate state, densities decide the reaction rates',
  ],
  radiationTemperature: [
    'Температура фотонного газа, излучения абсолютно чёрного тела: тепловые фотоны ионизуют атомы и разбивают ядра',
    'Temperature of the photon gas, black-body radiation: thermal photons ionize atoms and break nuclei',
  ],
  flow: [
    'Скорость движения среды как целого относительно лаборатории',
    'Speed of the medium as a whole relative to the laboratory',
  ],
  thickness: [
    'Диаметр шара, который заполняет среда: вылетевшая за край частица её покидает, поглощённая энергия нагревает шар',
    'Diameter of the ball the medium fills: a particle that crosses the edge leaves it, absorbed energy heats the ball',
  ],
  bodySize: [
    'Размер тела: диаметр шара или цилиндра, ребро куба',
    'Size of the body: the ball or cylinder diameter, the box edge',
  ],
  bodyHeight: ['Высота цилиндра вдоль оси z', 'Height of the cylinder along the z axis'],
  mediumPath: [
    'Тело среды, в котором лежит частица, и тела вокруг него, от внутреннего к внешнему',
    'The body of a medium the particle lies in and the bodies around it, from the inner to the outer one',
  ],
  bodyParent: [
    'Тело, внутри которого лежит это тело: снаружи от него частица видит среду родителя',
    'The body this body lies in: outside it a particle sees the parent medium',
  ],
  bodyCenter: ['Центр тела в пространстве', 'Centre of the body in space'],
  absorbedEnergy: [
    'Энергия излучения и частиц, которую среда поглотила за опыт; от неё выросла температура шара',
    'Energy of radiation and particles the medium has absorbed so far; it raised the temperature of the ball',
  ],
  componentDensity: [
    'Концентрация: сколько частиц этого вида в кубическом метре. Это фон: такие частицы не показываются по одной и не входят в сохраняющиеся величины',
    'Number density: how many particles of this kind per cubic metre. It is a background: these particles are not shown one by one and are not counted in the conserved quantities',
  ],
  reactionAll: [
    'Все реакции за шаг: продукт реакции может реагировать дальше в оставшееся время шага, цепочка идёт до конца окна',
    'All reactions in a step: a product may react again in the rest of the step, the chain runs to the end of the window',
  ],
  reactionOne: [
    'Одна реакция за шаг: продукты ждут следующего шага эволюции',
    'One reaction per step: the products wait for the next evolution step',
  ],
  conservedSection: [
    'Суммы по живым частицам системы. Законы движка сохраняют их в каждой реакции и распаде; частицы среды не считаются. Ноль — когда живых частиц нет или вклады скомпенсированы',
    'Sums over the alive particles of the system. The laws of the engine keep them in every reaction and decay; medium particles are not counted. Zero means nothing is alive or the parts cancel',
  ],
  charge: [
    'Электрический заряд Q в единицах элементарного заряда e, сумма по живым частицам',
    'Electric charge Q in units of the elementary charge e, summed over the alive particles',
  ],
  baryonNumber: [
    'Барионное число B: +1 у протона и нейтрона, +1/3 у кварка, −1 у антибарионов; сохраняется во всех процессах Стандартной модели',
    'Baryon number B: +1 for a proton and a neutron, +1/3 for a quark, −1 for antibaryons; kept by every Standard Model process',
  ],
  leptonNumbers: [
    'Лептонные числа Lₑ, Lμ, Lτ: +1 у электрона и электронного нейтрино, −1 у их античастиц, так же для μ и τ; по отдельности их меняют только осцилляции нейтрино',
    'Lepton numbers Lₑ, Lμ, Lτ: +1 for the electron and the electron neutrino, −1 for their antiparticles, the same for μ and τ; only neutrino oscillations change them one by one',
  ],
  totalEnergy: [
    'Полная энергия живых частиц в ГэВ: массы покоя плюс кинетическая. Энергия, отданная среде, сюда не входит',
    'Total energy of the alive particles in GeV: rest masses plus kinetic energy. Energy given to the medium is not included',
  ],
  collapseOdds: [
    'Вероятности исходов по правилу Борна до измерения; выделен исход, который выпал в этом выстреле',
    'Born-rule probabilities of the outcomes before the measurement; the outcome drawn in this shot is highlighted',
  ],
  environmentSection: [
    'Окружение текущего кадра: общие аспекты и области для отдельных частиц',
    'Environment of the current frame: shared aspects and regions for some particles',
  ],
  particlesSection: [
    'Живые частицы кадра; частицы в одинаковом состоянии собраны в одну группу',
    'Alive particles of the frame; particles in the same state are gathered into one group',
  ],
  shotKicker: [
    'Показан один выстрел, один прогон плана с этим seed. Статистика по всем выстрелам — в блоке «Результат»',
    'One shot is shown, one run of the plan with this seed. Statistics over all shots are in the Result block',
  ],
  frameCounter: [
    'Номер показанного кадра из числа шагов плана; кадр 0 — пустая система до первого шага',
    'Number of the frame shown out of the plan steps; frame 0 is the empty system before the first step',
  ],
  traceTabs: [
    'Прослежены несколько выстрелов с разными исходами: выберите, чей путь смотреть',
    'Several shots with different outcomes were traced: pick the one to follow',
  ],
  avatar: [
    'Символ частицы; цвет — её семейство: кварки, лептоны, бозоны, адроны, ядра, атомы, молекулы',
    'Particle symbol; the colour is its family: quarks, leptons, bosons, hadrons, nuclei, atoms, molecules',
  ],
  phaseBadge: [
    'Агрегатное состояние в условиях окружения: по критической точке, плавлению и кривой давления пара из данных NIST и CRC, иначе по оценке. Плазма — когда частица заряжена или kT больше десятой энергии ионизации',
    'Aggregate state in the conditions of the environment: from the critical point, melting and vapour curve of the NIST and CRC data, otherwise an estimate. Plasma means charged, or kT above a tenth of the ionization energy',
  ],
  particleLabel: [
    'Метка частицы: по ней шаги плана обращаются к ней; ниже вид, изотоп и заряд',
    'Particle label: the plan steps refer to the particle by it; below are its kind, isotope and charge',
  ],
  particleGroup: [
    'Группа частиц в одинаковом состоянии: одна карточка вместо многих, метки первой и последней',
    'A group of particles in the same state: one card instead of many, with the first and last labels',
  ],
  compositionGroup: [
    'Из чего состоит частица: протоны, нейтроны, электроны, атомы и связи',
    'What the particle is made of: protons, neutrons, electrons, atoms and bonds',
  ],
  energiesGroup: [
    'Полная энергия и энергии связи: ионизация, связь нуклонов, отделение нуклона, химические связи',
    'Total energy and binding energies: ionization, nucleon binding, nucleon separation, chemical bonds',
  ],
  structureGroup: [
    'Строение молекулы или ядра: масса, диполь, длины связей, вращение, колебания, период полураспада',
    'Structure of the molecule or nucleus: mass, dipole, bond lengths, rotation, vibrations, half-life',
  ],
  magnetismGroup: [
    'Магнитные свойства основного уровня: фактор Ланде и магнитный момент',
    'Magnetic properties of the ground level: Landé factor and magnetic moment',
  ],
  motionGroup: [
    'Как частица движется: импульс, лоренц-фактор, собственное время и температуры',
    'How the particle moves: momentum, Lorentz factor, proper time and temperatures',
  ],
  protons: [
    'Число протонов Z — заряд ядра; оно задаёт химический элемент',
    'Proton number Z, the charge of the nucleus; it sets the chemical element',
  ],
  neutrons: [
    'Число нейтронов N; массовое число A = Z + N задаёт изотоп',
    'Neutron number N; the mass number A = Z + N sets the isotope',
  ],
  electrons: [
    'Число электронов: у нейтрального атома равно Z, у катиона меньше, у аниона больше',
    'Number of electrons: Z for a neutral atom, fewer for a cation, more for an anion',
  ],
  atomCount: ['Число атомов в молекуле', 'Number of atoms in the molecule'],
  bondCount: [
    'Число химических связей между атомами молекулы',
    'Number of chemical bonds between the atoms of the molecule',
  ],
  totalEnergyOfParticle: [
    'Полная энергия E = √(m²c⁴ + p²c²) в ГэВ: масса покоя плюс кинетическая',
    'Total energy E = √(m²c⁴ + p²c²) in GeV: rest mass plus kinetic energy',
  ],
  momentum: ['Модуль импульса в ГэВ/c', 'Magnitude of the momentum in GeV/c'],
  lorentzFactor: [
    'Лоренц-фактор γ = E/mc²: 1 в покое, растёт со скоростью; ∞ у безмассовых частиц',
    'Lorentz factor γ = E/mc²: 1 at rest, grows with speed; ∞ for massless particles',
  ],
  properTime: [
    'Собственное время: сколько прошло на часах самой частицы с её рождения; при γ > 1 оно отстаёт от лабораторного',
    'Proper time: how much has passed on the particle’s own clock since it was born; with γ > 1 it lags the laboratory time',
  ],
  kineticTemperature: [
    'Кинетическая температура: у газа такой температуры средняя энергия поступательного движения равна энергии частицы, 3/2 kT',
    'Kinetic temperature: a gas at this temperature has the particle’s translational energy as its mean, 3/2 kT',
  ],
  internalTemperature: [
    'Внутренняя температура молекулы: заселённость её вращений и колебаний',
    'Internal temperature of the molecule: how its rotations and vibrations are populated',
  ],
  quantumState: [
    'Квантовый слот частицы: чистота 1 у чистого состояния и меньше у смешанного, энтропия в битах, вектор Блоха — направление состояния на сфере',
    'Quantum slot of the particle: purity 1 for a pure state and less for a mixed one, entropy in bits, the Bloch vector is the direction of the state on the sphere',
  ],
  resultKicker: [
    'Выстрелы — сколько раз прогнан план; seed — зерно генератора случайных чисел, тот же seed повторяет результат; «заняло» — время всего прогона',
    'Shots: how many times the plan ran; seed: the random generator seed, the same seed repeats the result; took: time of the whole run',
  ],
  shotTime: ['Среднее время одного выстрела в этом прогоне', 'Mean time of one shot in this run'],
  timeShare: [
    'Доля времени одного выстрела, которую занимает этот шаг, по замеру этого прогона',
    'Share of one shot’s time spent in this step, measured in this run',
  ],
  scalarTile: [
    'Статистика отчёта, посчитанная по всем выстрелам',
    'A report statistic computed over all shots',
  ],
  histogram: [
    'Распределение записанной величины по всем выстрелам',
    'Distribution of the recorded value over all shots',
  ],
  chartMeta: [
    'Среднее, стандартное отклонение σ и N — число выстрелов, в которых величина записана',
    'Mean, standard deviation σ and N, the number of shots that recorded the value',
  ],
  sigmaBand: [
    'Полоса от среднего минус σ до среднего плюс σ: там около двух третей выстрелов для нормального распределения',
    'Band from the mean minus σ to the mean plus σ: about two thirds of the shots for a normal distribution',
  ],
  meanLine: ['Среднее значение по выстрелам', 'Mean value over the shots'],
  outcomeBars: [
    'Частоты исходов по всем выстрелам: доля и число выстрелов с этим исходом',
    'Outcome frequencies over all shots: share and number of shots with this outcome',
  ],
  builtInTemplate: [
    'Встроенный шаблон: поставляется с движком',
    'Built-in template: ships with the engine',
  ],
  savedTemplate: [
    'Сохранённый шаблон: вы сохранили его из конструктора',
    'Saved template: you saved it from the builder',
  ],
  stepCount: ['Число шагов плана', 'Number of plan steps'],
  categoryChip: [
    'Показать шаблоны этой категории; число — сколько их',
    'Show the templates of this category; the number is how many there are',
  ],
  particleWeight: [
    'Сколько настоящих частиц стоит за каждой смоделированной: энергия, которую частицы отдают средам, и нагрев умножаются на этот вес. Так сотня нейтронов может греть реактор, как 10¹⁴ настоящих',
    'How many real particles each simulated one stands for: the energy particles hand to media and the heating are multiplied by this weight. This way a hundred neutrons can heat a reactor like 10¹⁴ real ones',
  ],
  shots: [
    'Сколько раз прогнать эксперимент; статистическая погрешность падает как 1/√N',
    'How many times to run the experiment; the statistical error falls as 1/√N',
  ],
  seed: [
    'Зерно генератора случайных чисел: тот же seed даёт тот же результат',
    'Seed of the random number generator: the same seed gives the same result',
  ],
  parameter: [
    'Параметр плана: подставляется в шаги вместо {{имени}}',
    'Plan parameter: substituted into the steps in place of {{name}}',
  ],
  parameterUsage: ['Шаги, которые используют этот параметр', 'Steps that use this parameter'],
  reportLine: [
    'Строка отчёта: какую статистику посчитать по каким записям',
    'Report line: which statistic to compute over which records',
  ],
  runStatus: [
    'Состояние прогона: в очереди, идёт, готов или ошибка',
    'Run state: queued, running, finished or failed',
  ],
  runElapsed: ['Сколько длился прогон', 'How long the run took'],
  runStarted: ['Когда прогон начался', 'When the run started'],
  forecastTotal: [
    'Прогноз всего прогона: среднее время выстрела из пробного прогона, умноженное на число выстрелов, плюс трассировка нескольких выстрелов для плеера',
    'Forecast of the whole run: the mean shot time from a pilot run times the number of shots, plus tracing a few shots for the player',
  ],
  forecastDetail: [
    'Из чего сложился прогноз: время одного выстрела и сколько пробных выстрелов его измерили',
    'What the forecast is made of: the time of one shot and how many pilot shots measured it',
  ],
  schemaCounts: [
    'Шагов в плане и меток — имён частиц, которые создают шаги; группа даёт метку каждому участнику',
    'Steps in the plan and labels, the names of the particles the steps create; a group gives every member a label',
  ],
  legendInfluence: [
    'Пунктирная рамка: на какие частицы действует окружение или воздействие',
    'Dashed frame: which particles an environment or influence acts on',
  ],
  legendLife: [
    'Вертикальная линия: жизнь частицы с меткой от создания до распада или реакции',
    'Vertical line: the life of a labelled particle from creation to decay or reaction',
  ],
  particleMeta: [
    'Масса покоя и электрический заряд в единицах e, по PDG 2026',
    'Rest mass and electric charge in units of e, from PDG 2026',
  ],
  stableNuclide: [
    'Стабильный нуклид: распада не наблюдали (NUBASE2020)',
    'Stable nuclide: no decay observed (NUBASE2020)',
  ],
  nuclideMeta: [
    'Распространённость в природе — доля атомов элемента с этим изотопом; спин ядра в единицах ħ',
    'Natural abundance, the share of the element’s atoms with this isotope; nuclear spin in units of ħ',
  ],
  moleculeMeta: [
    'Масса в дальтонах для самых распространённых изотопов; радикал — нечётное число электронов, есть неспаренный; линейная — все атомы на одной прямой',
    'Mass in daltons for the most abundant isotopes; radical means an odd number of electrons, one unpaired; linear means all atoms on one line',
  ],
  atomMeta: [
    'Нейтральный атом: Z протонов и столько же электронов; для изотопа указана его доля в природе',
    'Neutral atom: Z protons and as many electrons; an isotope shows its natural share',
  ],
  ionMeta: [
    'Заряд иона: сколько электронов снято (+) или добавлено (−); энергия ионизации и сродство к электрону из NIST и CRC',
    'Ion charge: how many electrons are removed (+) or added (−); ionization energy and electron affinity from NIST and CRC',
  ],
  groupChip: [
    'Показать группу молекул; число — сколько их в каталоге',
    'Show a group of molecules; the number is how many the catalogue holds',
  ],
  familyChip: [
    'Оставить только это семейство; число — сколько частиц',
    'Keep only this family; the number is how many particles',
  ],
  quickElements: [
    'Элементы из готовых сред, простых веществ каталога и ваших недавних выборов',
    'Elements of the preset media, the simple substances of the catalogue and your recent picks',
  ],
  recentPicks: [
    'Вещества, которые вы недавно выбирали на этом устройстве',
    'Species you picked recently on this device',
  ],
});

export const ASPECT_HINTS: Readonly<Record<string, string>> = bilingual({
  medium: [
    'Статистическая среда: газ, жидкость или плазма из фоновых частиц с одной температурой. Её частицы входят в законы как концентрации: столкновения, реакции, ионизация, фазы',
    'Statistical medium: a gas, liquid or plasma of background particles at one temperature. Its particles enter the laws as densities: collisions, reactions, ionization, phases',
  ],
  temperature: [
    'Тепловая баня: частицы приходят к этой температуре и населяют уровни по Больцману',
    'Heat bath: particles relax to this temperature and populate levels by Boltzmann',
  ],
  magneticField: [
    'Однородное магнитное поле: расщепление Зеемана, ларморова прецессия спина, сила Лоренца на заряд',
    'Uniform magnetic field: Zeeman splitting, Larmor precession of the spin, Lorentz force on a charge',
  ],
  electricField: [
    'Однородное электрическое поле: ускоряет заряженные частицы силой qE',
    'Uniform electric field: accelerates charged particles with the force qE',
  ],
  coherenceTimes: [
    'Времена потери фазы и релаксации: как быстро квантовое состояние становится смешанным и уходит к равновесию',
    'Dephasing and relaxation times: how fast a quantum state becomes mixed and relaxes to equilibrium',
  ],
  neutrinoMixing: [
    'Параметры осцилляций нейтрино PDG: углы смешивания и разности квадратов масс',
    'PDG neutrino oscillation parameters: mixing angles and mass-squared differences',
  ],
});

export const READING_HINTS: Readonly<Record<string, string>> = bilingual({
  internalTemperatureInKelvin: [
    'Внутренняя температура молекулы: заселённость вращений и колебаний',
    'Internal temperature of the molecule: how rotations and vibrations are populated',
  ],
  kineticTemperatureInKelvin: [
    'Кинетическая температура: средняя энергия поступательного движения 3/2 kT',
    'Kinetic temperature: mean translational energy 3/2 kT',
  ],
  protons: ['Число протонов Z', 'Proton number Z'],
  neutrons: ['Число нейтронов N', 'Neutron number N'],
  electrons: ['Число электронов', 'Number of electrons'],
  bindingEnergyPerNucleonInMev: [
    'Энергия связи на нуклон B/A по массам AME2020: сколько энергии держит каждый нуклон; максимум около ⁵⁶Fe',
    'Binding energy per nucleon B/A from the AME2020 masses: how much energy holds each nucleon; the maximum is near ⁵⁶Fe',
  ],
  halfLifeInSeconds: [
    'Период полураспада T½ из NUBASE2020: за это время распадается половина таких ядер',
    'Half-life T½ from NUBASE2020: half of such nuclei decay in this time',
  ],
  neutronSeparationEnergyInMev: [
    'Энергия отделения нейтрона Sₙ: сколько нужно, чтобы вырвать один нейтрон',
    'Neutron separation energy Sₙ: what it takes to remove one neutron',
  ],
  protonSeparationEnergyInMev: [
    'Энергия отделения протона Sₚ: сколько нужно, чтобы вырвать один протон',
    'Proton separation energy Sₚ: what it takes to remove one proton',
  ],
  ionizationEnergyInEv: [
    'Энергия, нужная чтобы оторвать следующий электрон (NIST ASD)',
    'Energy needed to remove the next electron (NIST ASD)',
  ],
  landeFactor: [
    'Фактор Ланде g_J основного уровня: связывает магнитный момент с полным моментом J',
    'Landé factor g_J of the ground level: links the magnetic moment to the total angular momentum J',
  ],
  magneticMomentInBohrMagnetons: [
    'Магнитный момент в магнетонах Бора μ_B = eħ/2mₑ',
    'Magnetic moment in Bohr magnetons μ_B = eħ/2mₑ',
  ],
  atomCount: ['Число атомов в молекуле', 'Number of atoms in the molecule'],
  bondCount: ['Число связей в молекуле', 'Number of bonds in the molecule'],
  massInDaltons: [
    'Масса молекулы в дальтонах, атомных единицах массы',
    'Mass of the molecule in daltons, atomic mass units',
  ],
  dipoleMomentInDebye: [
    'Электрический дипольный момент в дебаях по равновесию зарядов QEq; оценка, у воды выходит выше измеренных 1.85 Д',
    'Electric dipole moment in debye from QEq charge equilibration; an estimate, water comes out above the measured 1.85 D',
  ],
  meanBondLengthInAngstrom: [
    'Средняя длина связи в ангстремах, 10⁻¹⁰ м, после минимизации силового поля UFF',
    'Mean bond length in ångström, 10⁻¹⁰ m, after minimising the UFF force field',
  ],
  bondEnergyInEv: ['Сумма энергий всех связей молекулы', 'Sum of the energies of all bonds'],
  weakestBondInEv: [
    'Энергия самой слабой связи: она первой рвётся при нагреве',
    'Energy of the weakest bond: it breaks first when heated',
  ],
  largestRotationalConstantInGigahertz: [
    'Наибольшая вращательная постоянная B = h/8π²I в гигагерцах: чем легче молекула, тем она больше',
    'Largest rotational constant B = h/8π²I in gigahertz: the lighter the molecule, the larger it is',
  ],
  vibrationalModeCount: [
    'Число нормальных колебаний: 3N − 6, у линейной молекулы 3N − 5',
    'Number of normal vibrations: 3N − 6, 3N − 5 for a linear molecule',
  ],
  lowestWavenumberInInverseCentimeters: [
    'Самая низкая частота колебания в обратных сантиметрах',
    'Lowest vibration frequency in inverse centimetres',
  ],
  highestWavenumberInInverseCentimeters: [
    'Самая высокая частота колебания, обычно растяжение связи с водородом',
    'Highest vibration frequency, usually a stretch of a bond to hydrogen',
  ],
  vibrationalQuanta: [
    'Сколько колебательных квантов возбуждено сейчас',
    'How many vibrational quanta are excited now',
  ],
});

const DECAY_MODE_HINTS: Readonly<Record<string, string>> = bilingual({
  betaMinus: [
    'β⁻-распад: нейтрон превращается в протон, вылетают электрон и антинейтрино',
    'β⁻ decay: a neutron turns into a proton, an electron and an antineutrino fly out',
  ],
  betaPlus: [
    'β⁺-распад: протон превращается в нейтрон, вылетают позитрон и нейтрино',
    'β⁺ decay: a proton turns into a neutron, a positron and a neutrino fly out',
  ],
  helium: [
    'α-распад: ядро испускает ядро гелия-4',
    'α decay: the nucleus emits a helium-4 nucleus',
  ],
  capture: [
    'ε, электронный захват: ядро захватывает электрон своей оболочки',
    'ε, electron capture: the nucleus captures an electron of its shell',
  ],
  isomeric: [
    'Изомерный переход: возбуждённое ядро испускает гамма-квант',
    'Isomeric transition: an excited nucleus emits a gamma ray',
  ],
  fission: ['Спонтанное деление ядра', 'Spontaneous fission of the nucleus'],
  proton: ['Испускание протона', 'Proton emission'],
  twoProtons: ['Испускание двух протонов', 'Emission of two protons'],
  neutron: ['Испускание нейтрона', 'Neutron emission'],
  twoNeutrons: ['Испускание двух нейтронов', 'Emission of two neutrons'],
});

const DECAY_MODE_KEYS: Readonly<Record<string, string>> = {
  'B-': 'betaMinus',
  'B+': 'betaPlus',
  A: 'helium',
  EC: 'capture',
  IT: 'isomeric',
  SF: 'fission',
  p: 'proton',
  '2p': 'twoProtons',
  n: 'neutron',
  '2n': 'twoNeutrons',
};

export function decayModeHint(mode: string | null): string {
  if (mode === null) {
    return HINTS.stableNuclide;
  }
  const key = DECAY_MODE_KEYS[mode];
  const meaning = key === undefined ? undefined : DECAY_MODE_HINTS[key];
  return meaning ?? say(`Мода распада ${mode} из NUBASE2020`, `Decay mode ${mode} from NUBASE2020`);
}

export const CLASS_HINTS: Readonly<Record<string, string>> = bilingual({
  bosons: [
    'Переносчики взаимодействий и бозон Хиггса: частицы с целым спином',
    'Force carriers and the Higgs boson: particles with integer spin',
  ],
  quarks: [
    'Кварки: фермионы с цветовым зарядом; поодиночке живут только выше температуры деконфайнмента',
    'Quarks: fermions with colour charge; alone they live only above the deconfinement temperature',
  ],
  leptons: [
    'Лептоны: электрон, мюон, тау и три нейтрино; сильного взаимодействия не чувствуют',
    'Leptons: electron, muon, tau and three neutrinos; they feel no strong force',
  ],
  hadrons: [
    'Адроны из связанных кварков: мезоны — кварк и антикварк, барионы — три кварка',
    'Hadrons of bound quarks: mesons are a quark and an antiquark, baryons three quarks',
  ],
  nuclei: [
    'Голые атомные ядра любого нуклида NUBASE2020, без электронов',
    'Bare atomic nuclei of any NUBASE2020 nuclide, without electrons',
  ],
  atoms: [
    'Атомы, ионы и изотопы любого элемента: ядро и электроны с энергиями ионизации NIST',
    'Atoms, ions and isotopes of any element: a nucleus and electrons with NIST ionization energies',
  ],
  molecules: [
    'Молекулы из каталога: структура проверена правилами валентности, масса из закона строения',
    'Catalogue molecules: the structure is checked by the valence rules, the mass comes from the structure law',
  ],
  mixtures: [
    'Готовые смеси из пресетов сред: добавляют все компоненты с их концентрациями',
    'Ready mixtures from the preset media: they add every component with its density',
  ],
});

export const KIND_HINTS: Readonly<Record<string, string>> = bilingual({
  matter: [
    'Вещество: обычные частицы, ядра, атомы и молекулы',
    'Matter: ordinary particles, nuclei, atoms and molecules',
  ],
  antimatter: [
    'Антивещество: античастицы с той же массой и противоположными зарядами; при встрече с веществом аннигилируют',
    'Antimatter: antiparticles with the same mass and opposite charges; they annihilate with matter',
  ],
});

export const MODE_HINTS: Readonly<Record<string, string>> = bilingual({
  neutral: [
    'Нейтральный атом самого распространённого изотопа: щелчок по элементу сразу его выбирает',
    'Neutral atom of the most abundant isotope: a click on an element picks it at once',
  ],
  ion: [
    'Ион: атом без части электронов (катион) или с лишним электроном (анион), либо голое ядро',
    'Ion: an atom missing some electrons (cation), with an extra electron (anion), or a bare nucleus',
  ],
  isotope: [
    'Изотоп: тот же элемент с другим числом нейтронов, стабильный или радиоактивный',
    'Isotope: the same element with another neutron count, stable or radioactive',
  ],
});
