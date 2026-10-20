/* Physical presets for the builder's numeric fields: natural, laboratory and theoretical scales, computed from CODATA and the catalog where possible. */
import {
  ATOMIC_UNIT_OF_ELECTRIC_FIELD,
  BOLTZMANN_CONSTANT,
  BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN,
  ELECTRON_GYROMAGNETIC_RATIO,
  ELECTRON_MASS,
  ELEMENTARY_CHARGE,
  LOSCHMIDT_CONSTANT_AT_273_15_K_101_325_KPA,
  NEWTONIAN_CONSTANT_OF_GRAVITATION,
  PARTICLE_CATALOG,
  PLANCK_MASS_ENERGY_EQUIVALENT_IN_GEV,
  PLANCK_TEMPERATURE,
  PLANCK_TIME,
  PROTON_GYROMAGNETIC_RATIO,
  REDUCED_PLANCK_CONSTANT,
  SPEED_OF_LIGHT,
  THOMSON_CROSS_SECTION,
  PLANCK_CONSTANT_IN_EV_PER_HERTZ,
  coolingTransitionOf,
  particleSpec,
} from '@standard-model/constants';
import {
  PARTICLE_NAMES,
  localizedText,
  type LocalizedText,
  type ParticleName,
  type Preset,
  type PresetCatalog,
} from '@standard-model/contracts';

const EV_PER_GEV = 1e9;
const ROOM_TEMPERATURE_IN_KELVIN = 293;
const SOLAR_MASS_IN_KILOGRAMS = 1.989e30;
const LHC_PROTON_ENERGY_IN_GEV = 6800;
const METERS_PER_NANOMETER = 1e-9;
const MICROWAVE_OVEN_IN_HERTZ = 2.45e9;
const CARBON_DIOXIDE_LASER_IN_METERS = 10.6e-6;
const HYDROXYL_STRETCH_IN_METERS = 3e-6;
const GREEN_LASER_IN_METERS = 532e-9;
const MERCURY_LAMP_IN_METERS = 253.7e-9;
const HELIUM_LAMP_IN_EV = 21.2;
const SOFT_X_RAY_IN_EV = 1e3;
const HARD_X_RAY_IN_EV = 1e4;
const COBALT_GAMMA_IN_EV = 1.33e6;
const DEUTERON_GAMMA_IN_EV = 4e6;
const GIANT_RESONANCE_GAMMA_IN_EV = 15e6;
const SODIUM = 11;

const sodiumLine = coolingTransitionOf(SODIUM, 0)?.wavelengthInNanometers ?? 0;

function fromWavelength(wavelengthInMeters: number): number {
  return SPEED_OF_LIGHT.value / wavelengthInMeters;
}

function fromPhotonEnergy(photonEnergyInEv: number): number {
  return photonEnergyInEv / PLANCK_CONSTANT_IN_EV_PER_HERTZ.value;
}

type Bilingual = string | readonly [string, string];

function bilingualText(text: Bilingual): LocalizedText {
  return typeof text === 'string' ? localizedText(text, text) : localizedText(text[0], text[1]);
}

function preset(label: Bilingual, value: number, note: Bilingual): Preset {
  return { label: bilingualText(label), value, note: bilingualText(note) };
}

function thermalMomentumInGev(massInGev: number, temperatureInKelvin: number): number {
  const thermalEnergyInGev =
    (BOLTZMANN_CONSTANT_IN_EV_PER_KELVIN.value * temperatureInKelvin) / EV_PER_GEV;
  return Math.sqrt(3 * massInGev * thermalEnergyInGev);
}

function momentumFromKineticEnergyInGev(massInGev: number, kineticEnergyInGev: number): number {
  return Math.sqrt(kineticEnergyInGev * kineticEnergyInGev + 2 * kineticEnergyInGev * massInGev);
}

function hawkingTemperatureInKelvin(massInKilograms: number): number {
  return (
    (REDUCED_PLANCK_CONSTANT.value * SPEED_OF_LIGHT.value ** 3) /
    (8 *
      Math.PI *
      NEWTONIAN_CONSTANT_OF_GRAVITATION.value *
      massInKilograms *
      BOLTZMANN_CONSTANT.value)
  );
}

function schwingerFieldInTesla(): number {
  return (
    (ELECTRON_MASS.value ** 2 * SPEED_OF_LIGHT.value ** 2) /
    (ELEMENTARY_CHARGE.value * REDUCED_PLANCK_CONSTANT.value)
  );
}

function genericMomentum(): readonly Preset[] {
  return [
    preset(['В покое', 'At rest'], 0, ['Импульс ноль', 'Zero momentum']),
    preset(['Планковская энергия', 'Planck energy'], PLANCK_MASS_ENERGY_EQUIVALENT_IN_GEV.value, [
      'Масштаб квантовой гравитации, CODATA',
      'Quantum gravity scale, CODATA',
    ]),
    preset(['Предел ГЗК для космических лучей', 'GZK limit for cosmic rays'], 5e10, [
      'Порог взаимодействия с реликтовым излучением, приближенно',
      'Threshold of interaction with the CMB, approximate',
    ]),
    preset(['Частица Oh-My-God', 'Oh-My-God particle'], 3.2e11, [
      'Самый энергичный зарегистрированный космический луч, 1991, приближенно',
      'The most energetic cosmic ray ever recorded, 1991, approximate',
    ]),
    preset(['Колено спектра космических лучей', 'Knee of the cosmic-ray spectrum'], 3e6, [
      'Приближенно',
      'Approximate',
    ]),
    preset(['Энергия пучка LHC', 'LHC beam energy'], LHC_PROTON_ENERGY_IN_GEV, [
      'Протон в Run 3, 6.8 ТэВ',
      'Proton in Run 3, 6.8 TeV',
    ]),
  ];
}

function momentumByParticle(): Readonly<Partial<Record<ParticleName, readonly Preset[]>>> {
  const byParticle: Partial<Record<ParticleName, readonly Preset[]>> = {};
  const massive = PARTICLE_NAMES.filter((name) => particleSpec(name).massInGev.value > 0);
  massive.forEach((name) => {
    const mass = particleSpec(name).massInGev.value;
    byParticle[name] = [
      preset(
        ['Тепловой импульс при 293 К', 'Thermal momentum at 293 K'],
        thermalMomentumInGev(mass, ROOM_TEMPERATURE_IN_KELVIN),
        [
          'sqrt(3 m k T) для частицы в равновесии при комнатной температуре',
          'sqrt(3 m k T) for a particle in equilibrium at room temperature',
        ],
      ),
    ];
  });
  const neutrinoPresets = [
    preset(['Солнечные нейтрино, pp-цепочка', 'Solar neutrinos, pp chain'], 4e-4, [
      'Около 0.4 МэВ, приближенно',
      'About 0.4 MeV, approximate',
    ]),
    preset(['Реакторные антинейтрино', 'Reactor antineutrinos'], 3e-3, [
      'Около 3 МэВ, приближенно',
      'About 3 MeV, approximate',
    ]),
    preset(['Нейтрино от сверхновой', 'Supernova neutrinos'], 1.5e-2, [
      'Около 15 МэВ, приближенно',
      'About 15 MeV, approximate',
    ]),
    preset(['Пучок T2K', 'T2K beam'], 0.6, [
      'Пик спектра, приближенно',
      'Spectrum peak, approximate',
    ]),
    preset(['Атмосферные нейтрино', 'Atmospheric neutrinos'], 1, [
      'Типичная энергия, приближенно',
      'Typical energy, approximate',
    ]),
    preset(['IceCube, ПэВ', 'IceCube, PeV'], 1e6, [
      'Нейтрино высоких энергий',
      'High-energy neutrinos',
    ]),
  ];
  (
    [
      'electronNeutrino',
      'muonNeutrino',
      'tauNeutrino',
      'electronAntineutrino',
      'muonAntineutrino',
      'tauAntineutrino',
    ] as const
  ).forEach((name) => {
    byParticle[name] = neutrinoPresets;
  });
  const electronMass = PARTICLE_CATALOG.electron.massInGev.value;
  const electronPresets = [
    ...(byParticle.electron ?? []),
    preset(
      ['Бета-электрон трития, край спектра', 'Tritium beta electron, spectrum endpoint'],
      momentumFromKineticEnergyInGev(electronMass, 18.6e-6),
      ['Кинетическая энергия 18.6 кэВ', 'Kinetic energy 18.6 keV'],
    ),
    preset(
      ['Электрон в ЭЛТ, 25 кВ', 'Electron in a CRT, 25 kV'],
      momentumFromKineticEnergyInGev(electronMass, 25e-6),
      ['Кинетическая энергия 25 кэВ', 'Kinetic energy 25 keV'],
    ),
    preset(
      ['Пучок LEP на пике Z', 'LEP beam at the Z peak'],
      PARTICLE_CATALOG.zBoson.massInGev.value / 2,
      ['Половина массы Z: √s = 91.19 ГэВ', 'Half the Z mass: √s = 91.19 GeV'],
    ),
    preset(['Пучок PETRA', 'PETRA beam'], 14.5, [
      '√s = 29 ГэВ, асимметрия μμ около −6%',
      '√s = 29 GeV, μμ asymmetry about −6%',
    ]),
    preset(['Пучок B-фабрики', 'B-factory beam'], 5.29, [
      '√s = 10.58 ГэВ, Υ(4S)',
      '√s = 10.58 GeV, Υ(4S)',
    ]),
    preset(['Электрон в LEP2', 'Electron in LEP2'], 104.5, [
      'Энергия пучка LEP2',
      'LEP2 beam energy',
    ]),
  ];
  byParticle.electron = electronPresets;
  byParticle.positron = electronPresets;
  const muonMass = PARTICLE_CATALOG.muon.massInGev.value;
  const muonPresets = [
    ...(byParticle.muon ?? []),
    preset(
      ['Мюон из распада пиона в покое', 'Muon from a pion decay at rest'],
      (PARTICLE_CATALOG.pionPlus.massInGev.value ** 2 - muonMass ** 2) /
        (2 * PARTICLE_CATALOG.pionPlus.massInGev.value),
      [
        'Двухчастичный распад π → μ ν, масса пиона из PDG 2026',
        'Two-body decay π → μ ν, pion mass from PDG 2026',
      ],
    ),
    preset(['Космический мюон на уровне моря', 'Cosmic muon at sea level'], 4, [
      'Средний импульс, приближенно',
      'Mean momentum, approximate',
    ]),
  ];
  byParticle.muon = muonPresets;
  byParticle.antiMuon = muonPresets;
  const protonMass = PARTICLE_CATALOG.proton.massInGev.value;
  const protonPresets = [
    ...(byParticle.proton ?? []),
    preset(
      ['Протон солнечного ветра', 'Solar wind proton'],
      (protonMass * 4e5) / SPEED_OF_LIGHT.value,
      ['Скорость 400 км/с', 'Speed 400 km/s'],
    ),
    preset(
      ['Тепловой протон в ядре Солнца', 'Thermal proton in the solar core'],
      thermalMomentumInGev(protonMass, 1.57e7),
      ['Температура 15.7 млн К', 'Temperature 15.7 million K'],
    ),
    preset(['Протон в LHC', 'Proton in the LHC'], LHC_PROTON_ENERGY_IN_GEV, [
      'Энергия пучка Run 3',
      'Run 3 beam energy',
    ]),
  ];
  byParticle.proton = protonPresets;
  byParticle.antiProton = protonPresets;
  const neutronMass = PARTICLE_CATALOG.neutron.massInGev.value;
  const neutronPresets = [
    ...(byParticle.neutron ?? []),
    preset(
      ['Тепловой нейтрон, 0.025 эВ', 'Thermal neutron, 0.025 eV'],
      momentumFromKineticEnergyInGev(neutronMass, 0.025e-9),
      ['Реакторный тепловой нейтрон', 'Reactor thermal neutron'],
    ),
    preset(
      ['Нейтрон деления, 2 МэВ', 'Fission neutron, 2 MeV'],
      momentumFromKineticEnergyInGev(neutronMass, 2e-3),
      ['Типичная энергия нейтрона деления', 'Typical fission neutron energy'],
    ),
  ];
  byParticle.neutron = neutronPresets;
  byParticle.antiNeutron = neutronPresets;
  byParticle.photon = [
    preset(['Реликтовое излучение', 'Cosmic microwave background'], 6.6e-13, [
      'Около 0.66 мэВ при 2.725 К',
      'About 0.66 meV at 2.725 K',
    ]),
    preset(['Видимый свет, 2 эВ', 'Visible light, 2 eV'], 2e-9, ['Зеленый свет', 'Green light']),
    preset(['Рентген, 10 кэВ', 'X-ray, 10 keV'], 1e-5, ['Медицинский рентген', 'Medical X-ray']),
    preset(['Гамма Co-60, 1.17 МэВ', 'Co-60 gamma, 1.17 MeV'], 1.17e-3, [
      'Линия распада кобальта-60',
      'Cobalt-60 decay line',
    ]),
    preset(
      ['Фотон аннигиляции 511 кэВ', '511 keV annihilation photon'],
      PARTICLE_CATALOG.electron.massInGev.value,
      ['Порог Брейта–Уилера при встречных фотонах', 'Breit–Wheeler threshold for head-on photons'],
    ),
    preset(['ТэВ гамма-квант', 'TeV gamma ray'], 1000, [
      'Наземные черенковские телескопы',
      'Ground-based Cherenkov telescopes',
    ]),
  ];
  (['wPlus', 'wMinus', 'zBoson', 'higgsBoson', 'top', 'antiTop'] as const).forEach((name) => {
    byParticle[name] = [
      ...(byParticle[name] ?? []),
      preset(
        [
          'Типичный поперечный импульс при рождении в LHC',
          'Typical transverse momentum when produced at the LHC',
        ],
        50,
        ['Приближенно', 'Approximate'],
      ),
    ];
  });
  (['up', 'down', 'strange', 'antiUp', 'antiDown', 'antiStrange'] as const).forEach((name) => {
    byParticle[name] = [
      ...(byParticle[name] ?? []),
      preset(['Ферми-движение в протоне', 'Fermi motion in the proton'], 0.3, [
        'Приближенно, кварк заперт',
        'Approximate, the quark is confined',
      ]),
    ];
  });
  return byParticle;
}

export function buildPresets(): PresetCatalog {
  const electronLarmorPeriod = (2 * Math.PI) / ELECTRON_GYROMAGNETIC_RATIO.value;
  const protonLarmorPeriod = (2 * Math.PI) / PROTON_GYROMAGNETIC_RATIO.value;
  const muonMeanLife = PARTICLE_CATALOG.muon.meanLifeInSeconds?.value ?? 0;
  const neutronMeanLife = PARTICLE_CATALOG.neutron.meanLifeInSeconds?.value ?? 0;
  const tauMeanLife = PARTICLE_CATALOG.tau.meanLifeInSeconds?.value ?? 0;
  return {
    momentumInGev: genericMomentum(),
    momentumInGevByParticle: momentumByParticle(),
    durationInSeconds: [
      preset(['1 нс', '1 ns'], 1e-9, ''),
      preset(['1 мкс', '1 µs'], 1e-6, ''),
      preset(
        ['Пролет 1 м со скоростью света', '1 m at the speed of light'],
        1 / SPEED_OF_LIGHT.value,
        '',
      ),
      preset(
        [
          'Четверть периода Лармора электрона в 1 Тл',
          'Quarter of the electron Larmor period in 1 T',
        ],
        electronLarmorPeriod / 4,
        ['Поворот спина на 90°', 'Spin rotation by 90°'],
      ),
      preset(
        ['Период Лармора электрона в 1 Тл', 'Electron Larmor period in 1 T'],
        electronLarmorPeriod,
        '2π / γ_e',
      ),
      preset(
        ['Период Лармора протона в 1 Тл', 'Proton Larmor period in 1 T'],
        protonLarmorPeriod,
        '2π / γ_p',
      ),
      preset(['Время жизни тау', 'Tau lifetime'], tauMeanLife, 'PDG'),
      preset(['Время жизни мюона', 'Muon lifetime'], muonMeanLife, 'PDG'),
      preset(['Время жизни нейтрона', 'Neutron lifetime'], neutronMeanLife, 'PDG'),
      preset(['Планковское время', 'Planck time'], PLANCK_TIME.value, 'CODATA'),
      preset(['Возраст Вселенной', 'Age of the Universe'], 4.35e17, [
        '13.8 млрд лет, приближенно',
        '13.8 billion years, approximate',
      ]),
    ],
    magneticFieldInTesla: [
      preset(['Нет поля', 'No field'], 0, ''),
      preset(['Поле Земли', 'Earth field'], 5e-5, ['Приближенно', 'Approximate']),
      preset(['Томограф МРТ', 'MRI scanner'], 1.5, ''),
      preset(['Дипольный магнит LHC', 'LHC dipole magnet'], 8.33, ''),
      preset(['Рекордный стационарный лабораторный', 'Record steady laboratory field'], 45, [
        'Приближенно',
        'Approximate',
      ]),
      preset(['Белый карлик', 'White dwarf'], 1e3, ['Порядок величины', 'Order of magnitude']),
      preset(['Нейтронная звезда', 'Neutron star'], 1e8, [
        'Порядок величины',
        'Order of magnitude',
      ]),
      preset(['Критическое поле Швингера', 'Schwinger critical field'], schwingerFieldInTesla(), [
        'm_e² c² / (e ħ), рождение пар из вакуума',
        'm_e² c² / (e ħ), pair creation from the vacuum',
      ]),
      preset(['Магнетар', 'Magnetar'], 1e10, ['Порядок величины', 'Order of magnitude']),
    ],
    electricFieldInVoltsPerMeter: [
      preset(['Нет поля', 'No field'], 0, ''),
      preset(['Поле у поверхности Земли', 'Field at the Earth surface'], 100, [
        'Ясная погода, приближенно',
        'Fair weather, approximate',
      ]),
      preset(['Пробой воздуха', 'Air breakdown'], 3e6, ''),
      preset(
        ['Поле на боровском радиусе', 'Field at the Bohr radius'],
        ATOMIC_UNIT_OF_ELECTRIC_FIELD.value,
        ['Атомная единица поля, CODATA', 'Atomic unit of field, CODATA'],
      ),
      preset(
        ['Критическое поле Швингера', 'Schwinger critical field'],
        schwingerFieldInTesla() * SPEED_OF_LIGHT.value,
        'm_e² c³ / (e ħ)',
      ),
    ],
    temperatureInKelvin: [
      preset(['Разбавительный криостат', 'Dilution refrigerator'], 0.01, ['10 мК', '10 mK']),
      preset(
        [
          'Хокинговская температура черной дыры солнечной массы',
          'Hawking temperature of a solar-mass black hole',
        ],
        hawkingTemperatureInKelvin(SOLAR_MASS_IN_KILOGRAMS),
        'ħ c³ / (8π G M k)',
      ),
      preset(['Реликтовое излучение', 'Cosmic microwave background'], 2.725, ''),
      preset(['Жидкий гелий', 'Liquid helium'], 4.2, ''),
      preset(['Жидкий азот', 'Liquid nitrogen'], 77, ''),
      preset(['Комнатная', 'Room temperature'], ROOM_TEMPERATURE_IN_KELVIN, ''),
      preset(['Поверхность Солнца', 'Solar surface'], 5772, ''),
      preset(['Ядро Солнца', 'Solar core'], 1.57e7, ''),
      preset(['Кварк-глюонная плазма', 'Quark-gluon plasma'], 2e12, [
        'Около 170 МэВ, приближенно',
        'About 170 MeV, approximate',
      ]),
      preset(['Планковская температура', 'Planck temperature'], PLANCK_TEMPERATURE.value, 'CODATA'),
    ],
    coherenceTimeInSeconds: [
      preset(
        ['Сверхпроводящий кубит, T2 около 100 мкс', 'Superconducting qubit, T2 about 100 µs'],
        1e-4,
        ['Приближенно', 'Approximate'],
      ),
      preset(['NV-центр в алмазе, около 1 мс', 'NV center in diamond, about 1 ms'], 1e-3, [
        'Приближенно',
        'Approximate',
      ]),
      preset(['Ионный кубит, около 1 с', 'Trapped-ion qubit, about 1 s'], 1, [
        'Приближенно',
        'Approximate',
      ]),
      preset(['Ядерный спин в растворе, около 1 с', 'Nuclear spin in solution, about 1 s'], 1, [
        'Приближенно',
        'Approximate',
      ]),
    ],
    numberDensityPerCubicMeter: [
      preset(['Межгалактическая среда', 'Intergalactic medium'], 1, [
        'Порядок величины',
        'Order of magnitude',
      ]),
      preset(['Межзвездная среда', 'Interstellar medium'], 1e6, [
        'Порядок величины',
        'Order of magnitude',
      ]),
      preset(
        ['Воздух при нормальных условиях', 'Air at standard conditions'],
        LOSCHMIDT_CONSTANT_AT_273_15_K_101_325_KPA.value,
        ['Постоянная Лошмидта, CODATA', 'Loschmidt constant, CODATA'],
      ),
      preset(['Молекулы воды', 'Water molecules'], 3.3e28, ''),
      preset(['Протоны в ядре Солнца', 'Protons in the solar core'], 6e31, [
        'Порядок величины',
        'Order of magnitude',
      ]),
    ],
    crossSectionInSquareMeters: [
      preset(['Нейтрино на нуклоне при 1 ГэВ', 'Neutrino on a nucleon at 1 GeV'], 1e-42, [
        'Около 1e-38 см², приближенно',
        'About 1e-38 cm², approximate',
      ]),
      preset(
        ['Томсоновское рассеяние', 'Thomson scattering'],
        THOMSON_CROSS_SECTION.value,
        'CODATA',
      ),
      preset(['Неупругое pp при энергиях LHC', 'Inelastic pp at LHC energies'], 8e-30, [
        'Около 80 мб, приближенно',
        'About 80 mb, approximate',
      ]),
      preset(['Один барн', 'One barn'], 1e-28, ''),
    ],
    velocityFraction: [
      preset(['Орбитальная скорость Земли', 'Earth orbital speed'], 3e4 / SPEED_OF_LIGHT.value, [
        '30 км/с',
        '30 km/s',
      ]),
      preset(['Солнечный ветер', 'Solar wind'], 4e5 / SPEED_OF_LIGHT.value, [
        '400 км/с',
        '400 km/s',
      ]),
      preset('0.1 c', 0.1, ''),
      preset('0.5 c', 0.5, ''),
      preset('0.9 c', 0.9, ''),
      preset('0.99 c', 0.99, ''),
    ],
    velocityInMetersPerSecond: [
      preset(['Покой', 'Rest'], 0, ''),
      preset(['Тепловая скорость воздуха', 'Thermal speed of air'], 500, [
        'Приближенно',
        'Approximate',
      ]),
      preset(['Орбитальная скорость Земли', 'Earth orbital speed'], 3e4, ''),
      preset(['Солнечный ветер', 'Solar wind'], 4e5, ''),
    ],
    angleDegrees: [
      preset('0°', 0, ['Вдоль оси z', 'Along the z axis']),
      preset('45°', 45, ''),
      preset('90°', 90, ['Вдоль оси x при нулевом азимуте', 'Along the x axis at zero azimuth']),
      preset('120°', 120, [
        'Угол теста Белла с тремя установками',
        'Angle of the three-setting Bell test',
      ]),
      preset('135°', 135, ''),
      preset('180°', 180, ['Против оси z', 'Against the z axis']),
    ],
    angleRadians: [
      preset('π/2', Math.PI / 2, ''),
      preset('π', Math.PI, ['Переворот спина', 'Spin flip']),
      preset('2π', 2 * Math.PI, ['Спинор меняет знак', 'The spinor changes sign']),
      preset('4π', 4 * Math.PI, ['Спинор возвращается', 'The spinor returns']),
    ],
    distanceInKilometers: [
      preset('KamLAND', 180, ['Реакторные антинейтрино', 'Reactor antineutrinos']),
      preset('T2K', 295, ''),
      preset('NOvA', 810, ''),
      preset('DUNE', 1300, ''),
      preset(['Диаметр Земли', 'Earth diameter'], 12742, ''),
      preset(['Земля — Луна', 'Earth to Moon'], 384400, ''),
      preset(['Земля — Солнце', 'Earth to Sun'], 1.496e8, ''),
      preset(['Световой год', 'Light year'], 9.461e12, ''),
    ],
    shots: [
      preset('1 000', 1000, ['По умолчанию', 'Default']),
      preset('10 000', 10_000, ''),
      preset('100 000', 100_000, ''),
    ],
    slitSeparationInMeters: [
      preset(['1 мкм, электронная двущель', '1 µm, electron double slit'], 1e-6, [
        'Масштаб опытов с электронами',
        'Scale of electron experiments',
      ]),
      preset(['2 мкм, Йонссон 1961', '2 µm, Jönsson 1961'], 2e-6, [
        'Первый двухщелевой опыт с электронами, приближенно',
        'The first double-slit experiment with electrons, approximate',
      ]),
      preset(['126 мкм, нейтроны Цайлингера 1988', '126 µm, Zeilinger neutrons 1988'], 1.26e-4, [
        'Расстояние между центрами щелей',
        'Distance between the slit centers',
      ]),
      preset(['0.25 мм, свет', '0.25 mm, light'], 2.5e-4, [
        'Классический опыт Юнга, приближенно',
        'Classic Young experiment, approximate',
      ]),
    ],
    slitWidthInMeters: [
      preset(['0.2 мкм', '0.2 µm'], 2e-7, ['Для электронов 50 кэВ', 'For 50 keV electrons']),
      preset(['0.5 мкм', '0.5 µm'], 5e-7, ''),
      preset(['22 мкм, нейтроны Цайлингера', '22 µm, Zeilinger neutrons'], 2.2e-5, ''),
      preset(['0.05 мм, свет', '0.05 mm, light'], 5e-5, ''),
    ],
    cellSizeInMeters: [
      preset(['2 фм, ядро', '2 fm, nucleus'], 2e-15, [
        'Только для протона и нейтрона: 10 комптоновских длин нуклона',
        'Only for the proton and neutron: 10 nucleon Compton wavelengths',
      ]),
      preset(['5 пм, глубоко в атоме', '5 pm, deep inside an atom'], 5e-12, [
        'Для электрона нижний рабочий предел около 4 пм',
        'For an electron the lower working limit is about 4 pm',
      ]),
      preset(['15 пм, атом водорода', '15 pm, hydrogen atom'], 1.5e-11, [
        'Боровский радиус 53 пм умещается в 3.5 ячейки',
        'The 53 pm Bohr radius spans 3.5 cells',
      ]),
      preset(['50 пм, барьеры и ловушки', '50 pm, barriers and traps'], 5e-11, ''),
      preset(['0.2 нм, молекулы', '0.2 nm, molecules'], 2e-10, ''),
      preset(['1 нм, наноструктуры', '1 nm, nanostructures'], 1e-9, ''),
      preset(['10 нм, квантовые точки', '10 nm, quantum dots'], 1e-8, ''),
      preset(['0.1 мкм', '0.1 µm'], 1e-7, ''),
      preset(['1 мкм', '1 µm'], 1e-6, [
        'Медленные частицы, интерференция на микроструктурах',
        'Slow particles, interference on microstructures',
      ]),
    ],
    packetWidthInMeters: [
      preset(['0.1 нм', '0.1 nm'], 1e-10, ''),
      preset(['0.15 нм', '0.15 nm'], 1.5e-10, ''),
      preset(['0.5 нм', '0.5 nm'], 5e-10, ''),
      preset(['5 нм', '5 nm'], 5e-9, ''),
      preset(['0.5 мкм', '0.5 µm'], 5e-7, ''),
    ],
    spaceDurationInSeconds: [
      preset(['0.1 фс', '0.1 fs'], 1e-16, ''),
      preset(['0.3 фс', '0.3 fs'], 3e-16, [
        'Ширина пакета 0.1 нм удваивается',
        'A 0.1 nm packet doubles its width',
      ]),
      preset(['0.6 фс', '0.6 fs'], 6e-16, [
        'Электрон 5 эВ проходит 0.8 нм',
        'A 5 eV electron travels 0.8 nm',
      ]),
      preset(
        ['2.07 фс, полпериода ловушки 1 эВ', '2.07 fs, half period of a 1 eV trap'],
        2.067e-15,
        ['π / ω при ħω = 1 эВ', 'π / ω at ħω = 1 eV'],
      ),
      preset(['1 пс', '1 ps'], 1e-12, [
        'Для крупных ячеек и медленных частиц',
        'For large cells and slow particles',
      ]),
    ],
    potentialEnergyInEv: [
      preset(['1 эВ', '1 eV'], 1, ''),
      preset(['5 эВ', '5 eV'], 5, ''),
      preset(['10 эВ', '10 eV'], 10, ''),
      preset(
        ['13.6 эВ, энергия ионизации водорода', '13.6 eV, hydrogen ionization energy'],
        13.6,
        '',
      ),
    ],
    screenDistanceInMeters: [
      preset(['0.35 м', '0.35 m'], 0.35, ''),
      preset(['1 м', '1 m'], 1, ''),
      preset(['5 м, нейтроны Цайлингера', '5 m, Zeilinger neutrons'], 5, ''),
    ],
    frequencyInHertz: [
      preset(['2.45 ГГц, микроволновка', '2.45 GHz, microwave oven'], MICROWAVE_OVEN_IN_HERTZ, [
        'вращает полярные молекулы',
        'rotates polar molecules',
      ]),
      preset(
        ['10.6 мкм, CO₂-лазер', '10.6 µm, CO₂ laser'],
        fromWavelength(CARBON_DIOXIDE_LASER_IN_METERS),
        ['инфракрасный', 'infrared'],
      ),
      preset(
        ['3 мкм, валентные колебания O–H', '3 µm, O–H stretch'],
        fromWavelength(HYDROXYL_STRETCH_IN_METERS),
        ['инфракрасный', 'infrared'],
      ),
      preset(
        [
          `${sodiumLine.toFixed(1)} нм, линия D2 натрия`,
          `${sodiumLine.toFixed(1)} nm, sodium D2 line`,
        ],
        fromWavelength(sodiumLine * METERS_PER_NANOMETER),
        ['видимый, по NIST', 'visible, from NIST'],
      ),
      preset(
        ['532 нм, зеленый лазер', '532 nm, green laser'],
        fromWavelength(GREEN_LASER_IN_METERS),
        ['видимый', 'visible'],
      ),
      preset(
        ['254 нм, ртутная лампа', '254 nm, mercury lamp'],
        fromWavelength(MERCURY_LAMP_IN_METERS),
        ['ультрафиолет', 'ultraviolet'],
      ),
      preset(
        ['21.2 эВ, гелиевая лампа', '21.2 eV, helium lamp'],
        fromPhotonEnergy(HELIUM_LAMP_IN_EV),
        ['жесткий ультрафиолет', 'extreme ultraviolet'],
      ),
      preset(['1 кэВ', '1 keV'], fromPhotonEnergy(SOFT_X_RAY_IN_EV), [
        'мягкий рентген',
        'soft X-ray',
      ]),
      preset(['10 кэВ', '10 keV'], fromPhotonEnergy(HARD_X_RAY_IN_EV), ['рентген', 'X-ray']),
      preset(['1.33 МэВ, Co-60', '1.33 MeV, Co-60'], fromPhotonEnergy(COBALT_GAMMA_IN_EV), [
        'гамма',
        'gamma',
      ]),
      preset(['4 МэВ', '4 MeV'], fromPhotonEnergy(DEUTERON_GAMMA_IN_EV), [
        'выше порога дейтрона 2.22 МэВ',
        'above the 2.22 MeV deuteron threshold',
      ]),
      preset(['15 МэВ', '15 MeV'], fromPhotonEnergy(GIANT_RESONANCE_GAMMA_IN_EV), [
        'гигантский дипольный резонанс',
        'giant dipole resonance',
      ]),
    ],
    powerInWatts: [
      preset(['1 мВт, лазерная указка', '1 mW, laser pointer'], 1e-3, ''),
      preset(['1 Вт', '1 W'], 1, ''),
      preset(['1 кВт, микроволновка', '1 kW, microwave oven'], 1e3, ''),
      preset(['1 МВт', '1 MW'], 1e6, ''),
      preset(['1 ГВт', '1 GW'], 1e9, ''),
    ],
    beamAreaInSquareMeters: [
      preset(['фокус 10 мкм', '10 µm focus'], 1e-10, ''),
      preset(['1 мм²', '1 mm²'], 1e-6, ''),
      preset(['1 см²', '1 cm²'], 1e-4, ''),
      preset(['0.1 м², камера микроволновки', '0.1 m², microwave oven cavity'], 0.1, ''),
    ],
    detuningInLinewidths: [
      preset(
        ['−Γ/2, минимум доплеровского предела', '−Γ/2, minimum of the Doppler limit'],
        -0.5,
        '',
      ),
      preset('−Γ', -1, ''),
      preset('−2Γ', -2, ''),
      preset(['−5Γ, большой захват', '−5Γ, large capture'], -5, ''),
    ],
    saturationParameter: [
      preset('0.1', 0.1, ['слабый пучок, холоднее', 'weak beam, colder']),
      preset('1', 1, ['насыщение', 'saturation']),
      preset('10', 10, ['сильный пучок, быстрее', 'strong beam, faster']),
    ],
  };
}
