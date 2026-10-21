/* Templates: decay spectra from tree amplitudes, time dilation, decay channels of W, Z and Higgs with quarks fragmenting into mesons, baryons formed by confinement, a Lund string, weak decays of the B meson, and reactor antineutrino disappearance. */
import { experiment } from '../experiment/experiment-builder.js';
import { HADRONIZATION_TIME_IN_SECONDS } from '../particles/hadronization.js';

const CONFINEMENT_WAIT_IN_SECONDS = 10 * HADRONIZATION_TIME_IN_SECONDS;
const DETECTOR_TIME_IN_SECONDS = 1e-9;
const MULTIPLICITY_BINS = 30;
const STRING_QUARK_ENERGY_IN_GEV = 10;

const SPECTRUM_BINS = 50;

export const MICHEL_SPECTRUM_TEMPLATE = experiment('michelSpectrum')
  .describe(
    'Мюон в покое распадается через виртуальный W. Энергия электрона разыгрывается по |M|² этой диаграммы, (p_μ·p_ν̄)(p_e·p_ν), что дает спектр Мишеля x²(3 − 2x) до края 52.8 МэВ',
  )
  .create('muon', 'muon')
  .decay('muon', 'decay')
  .report('histogram', ['decay.product[0].energyInGev'], 'Энергия электрона, ГэВ', SPECTRUM_BINS)
  .report('mean', ['decay.product[0].energyInGev'], 'Средняя энергия электрона, ГэВ')
  .report('histogram', ['decay.properTimeInSeconds'], 'Время жизни, с', SPECTRUM_BINS)
  .build();

export const MUON_TIME_DILATION_TEMPLATE = experiment('muonTimeDilation')
  .describe(
    'Космический мюон с импульсом 4 ГэВ: собственное время жизни 2.2 мкс, в лаборатории в γ раз дольше, пробег десятки километров',
  )
  .parameter('momentumInGev', 4)
  .create('muon', 'muon', { momentumInGev: { x: 0, y: 0, z: '{{momentumInGev}}' } })
  .decay('muon', 'decay')
  .report('mean', ['decay.properTimeInSeconds'], 'Собственное время, с')
  .report('mean', ['decay.labTimeInSeconds'], 'Лабораторное время, с')
  .report('mean', ['decay.decayLengthInMeters'], 'Средний пробег, м')
  .report('histogram', ['decay.decayLengthInMeters'], 'Пробег до распада, м', SPECTRUM_BINS)
  .build();

export const NEUTRON_BETA_SPECTRUM_TEMPLATE = experiment('neutronBetaSpectrum')
  .describe(
    'Свободный нейтрон распадается на протон, электрон и антинейтрино; спектр энергии электрона до 0.78 МэВ кинетической',
  )
  .create('neutron', 'neutron')
  .decay('neutron', 'decay')
  .report('histogram', ['decay.product[1].energyInGev'], 'Энергия электрона, ГэВ', SPECTRUM_BINS)
  .report('histogram', ['decay.properTimeInSeconds'], 'Время жизни нейтрона, с', SPECTRUM_BINS)
  .report('mean', ['decay.properTimeInSeconds'], 'Среднее время жизни, с')
  .build();

export const W_BOSON_DECAYS_TEMPLATE = experiment('wBosonDecays')
  .describe(
    'W⁺ распадается на лептон и нейтрино или на пару кварков; доли каналов по PDG 2026 с КХД-поправками, древесные ширины есть в калькуляторе на странице «Лагранжиан». Пара кварков рвет струну на мезоны, за наносекунду короткоживущие распадаются',
  )
  .create('w', 'wPlus')
  .decay('w', 'decay')
  .evolve(DETECTOR_TIME_IN_SECONDS)
  .measureSystem('detector')
  .report('frequency', ['decay'], 'Каналы распада W⁺')
  .report('frequency', ['detector'], 'Что видит детектор')
  .build();

export const Z_BOSON_DECAYS_TEMPLATE = experiment('zBosonDecays')
  .describe(
    'Z распадается на заряженные лептоны, нейтрино (невидимо) и адроны; доли каналов по PDG 2026. Ширины тех же каналов из вершин Z f̄ f совпадают с PDG до долей процента. Кварки фрагментируют в мезоны',
  )
  .create('z', 'zBoson')
  .decay('z', 'decay')
  .evolve(DETECTOR_TIME_IN_SECONDS)
  .measureSystem('detector')
  .report('frequency', ['decay'], 'Каналы распада Z')
  .report('frequency', ['detector'], 'Что видит детектор')
  .build();

export const HIGGS_DECAYS_TEMPLATE = experiment('higgsDecays')
  .describe(
    'Бозон Хиггса распадается сильнее всего в тяжелые частицы, связь Юкавы пропорциональна массе: b b̄, W W*, g g, τ τ, c c̄, Z Z*, γ γ. Доли — предсказание Стандартной модели (LHC Higgs WG, YR4, как в обзоре PDG): измерены пока не все каналы, g g и c c̄ напрямую не измерены, а измеренные доли в сумме не дают единицы. Распад в g g идет через петлю топ-кварка, γ γ и Z γ — через петли W и топа. Кварки и глюоны рвут струны на мезоны, b-кварки становятся B-мезонами, которые распадаются через W* за пикосекунды',
  )
  .create('higgs', 'higgsBoson')
  .decay('higgs', 'decay')
  .evolve(DETECTOR_TIME_IN_SECONDS)
  .measureSystem('detector')
  .report('frequency', ['decay'], 'Каналы распада Хиггса')
  .report('frequency', ['detector'], 'Что видит детектор')
  .build();

export const NEUTRON_FROM_QUARKS_TEMPLATE = experiment('neutronFromQuarks')
  .describe(
    'Кварки u, d, d свободны, пока не прошло время ħ/Λ_QCD ≈ 3·10⁻²⁴ с; затем конфайнмент сам связывает их в бесцветный нейтрон, почти вся масса которого из энергии глюонного поля. У нейтрона измеряется спин, потом он распадается',
  )
  .create('u', 'up')
  .create('d1', 'down')
  .create('d2', 'down')
  .evolve(CONFINEMENT_WAIT_IN_SECONDS)
  .measure('neutron', 'spin', 'spin')
  .decay('neutron', 'decay')
  .report('frequency', ['spin'], 'Спин нейтрона')
  .report('frequency', ['decay'], 'Канал распада')
  .report('histogram', ['decay.product[1].energyInGev'], 'Энергия электрона, ГэВ', SPECTRUM_BINS)
  .build();

export const PROTON_FROM_QUARKS_TEMPLATE = experiment('protonFromQuarks')
  .describe(
    'Пять кварков u, u, d и u, ū: после ħ/Λ_QCD тройка uud сама связывается в протон, а лишняя пара u ū с импульсами ±1 ГэВ натягивает струну, которая рвется на пару мезонов; ρ и ω тут же распадаются на пионы. Замер системы показывает протон и пионы',
  )
  .create('first', 'up')
  .create('second', 'up')
  .create('third', 'down')
  .create('extra', 'up', { momentumInGev: { x: 0, y: 0, z: 1 } })
  .create('anti', 'antiUp', { momentumInGev: { x: 0, y: 0, z: -1 } })
  .evolve(DETECTOR_TIME_IN_SECONDS)
  .measureSystem('system')
  .measure('proton', 'spin', 'spin')
  .report('frequency', ['system'], 'Состав системы')
  .report('frequency', ['spin'], 'Спин протона')
  .build();

export const STRING_FRAGMENTATION_TEMPLATE = experiment('stringFragmentation')
  .describe(
    'Кварк u и антикварк ū по 10 ГэВ разлетаются: между ними натягивается цветовая струна, она рвется рождением пар u ū, d d̄, s s̄ с s/u = 0.217 и поперечными толчками σ = 0.335 ГэВ, доли импульса по функции Лунда f(z) = (1/z)(1 − z)^a exp(−b m_T²/z). Векторные мезоны, η и K_S распадаются за наносекунду. Меняйте энергию и смотрите, как растет множественность',
  )
  .parameter('quarkEnergyInGev', STRING_QUARK_ENERGY_IN_GEV)
  .parameter('antiquarkMomentumInGev', -STRING_QUARK_ENERGY_IN_GEV)
  .create('quark', 'up', { momentumInGev: { x: 0, y: 0, z: '{{quarkEnergyInGev}}' } })
  .create('antiquark', 'antiUp', {
    momentumInGev: { x: 0, y: 0, z: '{{antiquarkMomentumInGev}}' },
  })
  .evolve(DETECTOR_TIME_IN_SECONDS)
  .measureSystem('detector')
  .report('mean', ['detector.particleCount'], 'Частиц в конечном состоянии')
  .report('mean', ['detector.chargedCount'], 'Заряженных частиц')
  .report('histogram', ['detector.chargedCount'], 'Заряженная множественность', MULTIPLICITY_BINS)
  .report('mean', ['detector.count.pionPlus'], 'π⁺')
  .report('mean', ['detector.count.pionMinus'], 'π⁻')
  .report('mean', ['detector.count.kaonPlus'], 'K⁺')
  .report('mean', ['detector.count.kaonLong'], 'K_L')
  .report('mean', ['detector.photonCount'], 'Фотонов, в основном от π⁰ → γγ')
  .build();

export const B_MESON_DECAYS_TEMPLATE = experiment('bMesonDecays')
  .describe(
    'B⁺ = u b̄ в покое: b̄ распадается через виртуальный W⁺, u смотрит со стороны (модель спектатора). Каналы b̄ → c̄ ℓ⁺ ν, c̄ u d̄, c̄ c s̄ и подавленные CKM идут по древесным ширинам лагранжиана, кварки рвут струны на мезоны, D-мезоны распадаются дальше. На древесном уровне доля b̄ → c̄ e⁺ ν около 16% против 11% у PDG: не хватает КХД-поправок к адронной ширине',
  )
  .create('meson', 'bPlus')
  .decay('meson', 'decay')
  .evolve(DETECTOR_TIME_IN_SECONDS)
  .measureSystem('detector')
  .report('frequency', ['decay'], 'Распад на уровне кварков')
  .report('histogram', ['decay.properTimeInSeconds'], 'Время жизни B⁺, с', SPECTRUM_BINS)
  .report('mean', ['detector.chargedCount'], 'Заряженных частиц после каскада')
  .report('mean', ['detector.count.kaonMinus'], 'K⁻ на распад: след c̄ → s̄')
  .report('mean', ['detector.count.kaonPlus'], 'K⁺ на распад')
  .build();

export const REACTOR_ANTINEUTRINO_TEMPLATE = experiment('reactorAntineutrino')
  .describe(
    'Реакторные электронные антинейтрино 3 МэВ пролетают 180 км, как в KamLAND, и частично меняют аромат',
  )
  .parameter('energyInGev', 0.003)
  .parameter('baselineInKilometers', 180)
  .create('antineutrino', 'electronAntineutrino', {
    momentumInGev: { x: 0, y: 0, z: '{{energyInGev}}' },
  })
  .influence('travel', { distanceInKilometers: '{{baselineInKilometers}}' }, ['antineutrino'])
  .measure('antineutrino', 'flavor', 'flavor')
  .report('frequency', ['flavor'], 'Аромат на детекторе')
  .build();
