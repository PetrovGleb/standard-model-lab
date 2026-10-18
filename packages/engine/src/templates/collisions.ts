/* Templates: collisions computed from the tree diagrams of the Lagrangian; the Z resonance with quarks fragmenting into mesons, the forward-backward asymmetry, annihilation at rest, Compton scattering, photon–photon pairs, Bhabha scattering, W-pair production and Higgs-strahlung. */
import { PARTICLE_CATALOG } from '@standard-model/constants';
import { experiment } from '../experiment/experiment-builder.js';

const Z_PEAK_BEAM_ENERGY_IN_GEV = PARTICLE_CATALOG.zBoson.massInGev.value / 2;
const DETECTOR_TIME_IN_SECONDS = 1e-9;
const MULTIPLICITY_BINS = 40;
const HADRONIC_EVENT = { record: 'detector.hadronic', equals: 1 } as const;
const LEP2_BEAM_ENERGY_IN_GEV = 100;
const HIGGS_FACTORY_BEAM_ENERGY_IN_GEV = 125;
const B_FACTORY_BEAM_ENERGY_IN_GEV = 5.29;

const ANGLE_BINS = 40;
const ENERGY_BINS = 50;

function beams(name: string, beamEnergyInGev: number) {
  return experiment(name)
    .parameter('beamEnergyInGev', beamEnergyInGev)
    .parameter('backwardMomentumInGev', -beamEnergyInGev)
    .create('electron', 'electron', { momentumInGev: { x: 0, y: 0, z: '{{beamEnergyInGev}}' } })
    .create('positron', 'positron', {
      momentumInGev: { x: 0, y: 0, z: '{{backwardMomentumInGev}}' },
    });
}

export const Z_RESONANCE_TEMPLATE = beams('zResonance', Z_PEAK_BEAM_ENERGY_IN_GEV)
  .describe(
    'e⁻e⁺ по 45.6 ГэВ, как на LEP. Каналы и сечения считаются по древесным диаграммам лагранжиана: обмен γ, Z и h в s-канале, у e⁺e⁻ еще t-канал в акцептансе |cos θ| < 0.95. Пара кварков натягивает струну Лунда, она рвется на мезоны, короткоживущие распадаются за наносекунду; детектор видит π±, K±, K_L, γ. Без партонного ливня заряженных частиц около 13 против 20.8 на LEP',
  )
  .collide(['electron', 'positron'], 'collision')
  .evolve(DETECTOR_TIME_IN_SECONDS)
  .measureSystem('detector')
  .report('frequency', ['collision'], 'Что родилось')
  .report('frequency', ['detector'], 'Что видит детектор')
  .report('mean', ['collision.crossSectionInNanobarns'], 'Полное сечение, нб')
  .report('histogram', ['collision.cosThetaStar'], 'cos θ* первого продукта', ANGLE_BINS)
  .report(
    'mean',
    ['detector.chargedCount'],
    'Заряженных частиц в адронном событии',
    undefined,
    HADRONIC_EVENT,
  )
  .report(
    'histogram',
    ['detector.chargedCount'],
    'Заряженная множественность адронных событий',
    MULTIPLICITY_BINS,
    HADRONIC_EVENT,
  )
  .report('mean', ['detector.count.pionPlus'], 'π⁺ на событие')
  .report('mean', ['detector.count.kaonPlus'], 'K⁺ на событие')
  .report('mean', ['detector.count.kaonLong'], 'K_L на событие')
  .build();

export const FORWARD_BACKWARD_ASYMMETRY_TEMPLATE = beams('forwardBackwardAsymmetry', 14.5)
  .describe(
    'e⁺e⁻ → μ⁺μ⁻ при √s = 29 ГэВ, как на PEP и PETRA: в амплитуде складываются диаграммы с γ и Z, их интерференция дает асимметрию вперед-назад около −6%',
  )
  .collide(['electron', 'positron'], 'collision', 'muon+antiMuon')
  .report('mean', ['collision.crossSectionInNanobarns'], 'Сечение μ⁺μ⁻, нб')
  .report('histogram', ['collision.cosThetaStar'], 'cos θ* первого продукта', ANGLE_BINS)
  .report(
    'mean',
    ['collision.cosThetaStar'],
    'Средний cos θ*; асимметрия вперед-назад A_FB = 3/2 · ⟨cos θ⟩',
  )
  .build();

export const ANNIHILATION_AT_REST_TEMPLATE = experiment('annihilationAtRest')
  .describe(
    'Электрон и позитрон в покое аннигилируют в два фотона по 511 кэВ через t- и u-диаграммы с обменом электроном; фотоны разлетаются назад-назад с запутанными поляризациями',
  )
  .create('electron', 'electron')
  .create('positron', 'positron')
  .collide(['electron', 'positron'], 'collision')
  .measure('collision.0', 'polarization', 'firstPolarization')
  .measure('collision.1', 'polarization', 'secondPolarization')
  .report('frequency', ['collision'], 'Продукты')
  .report('mean', ['collision.product[0].energyInGev'], 'Энергия фотона, ГэВ')
  .report(
    'probabilitySameSign',
    ['firstPolarization', 'secondPolarization'],
    'Одинаковые поляризации',
  )
  .build();

export const COMPTON_SCATTERING_TEMPLATE = experiment('comptonScattering')
  .describe(
    'Гамма-квант Co-60 1.17 МэВ рассеивается на покоящемся электроне: сумма s- и u-диаграмм воспроизводит формулу Клейна–Нишины, сечение 0.195 б',
  )
  .parameter('photonEnergyInGev', 0.00117)
  .create('photon', 'photon', { momentumInGev: { x: 0, y: 0, z: '{{photonEnergyInGev}}' } })
  .create('electron', 'electron')
  .collide(['photon', 'electron'], 'scattering')
  .report(
    'histogram',
    ['scattering.product[1].energyInGev'],
    'Энергия рассеянного фотона, ГэВ',
    ENERGY_BINS,
  )
  .report(
    'histogram',
    ['scattering.cosThetaStar'],
    'cos θ* электрона отдачи в системе центра масс',
    ANGLE_BINS,
  )
  .report('mean', ['scattering.crossSectionInNanobarns'], 'Сечение, нб')
  .build();

export const PHOTON_COLLIDER_TEMPLATE = experiment('photonCollider')
  .describe(
    'Два встречных фотона по 1 МэВ рождают пару e⁺e⁻ по Брейту–Уилеру через t- и u-диаграммы; ниже 511 кэВ на фотон процесс закрыт',
  )
  .parameter('photonEnergyInGev', 0.001)
  .parameter('backwardPhotonInGev', -0.001)
  .create('first', 'photon', { momentumInGev: { x: 0, y: 0, z: '{{photonEnergyInGev}}' } })
  .create('second', 'photon', { momentumInGev: { x: 0, y: 0, z: '{{backwardPhotonInGev}}' } })
  .collide(['first', 'second'], 'collision')
  .report('frequency', ['collision'], 'Продукты')
  .report('mean', ['collision.crossSectionInNanobarns'], 'Сечение, нб')
  .report('histogram', ['collision.cosThetaStar'], 'cos θ* электрона', ANGLE_BINS)
  .build();

export const BHABHA_SCATTERING_TEMPLATE = beams('bhabhaScattering', B_FACTORY_BEAM_ENERGY_IN_GEV)
  .describe(
    'Рассеяние Баба e⁺e⁻ → e⁺e⁻ при √s = 10.58 ГэВ: t-канальный обмен фотоном дает резкий пик вперед, s-канал и знак интерференции видны в угловом распределении; акцептанс |cos θ| < 0.95',
  )
  .collide(['electron', 'positron'], 'collision', 'electron+positron')
  .report('histogram', ['collision.cosThetaStar'], 'cos θ* электрона', ANGLE_BINS)
  .report('mean', ['collision.crossSectionInNanobarns'], 'Сечение в акцептансе, нб')
  .build();

export const W_PAIR_PRODUCTION_TEMPLATE = beams('wPairProduction', LEP2_BEAM_ENERGY_IN_GEV)
  .describe(
    'LEP2: e⁺e⁻ → W⁺W⁻ при √s = 200 ГэВ, около 21 пб на древесном уровне. Диаграммы с γ, Z и обменом нейтрино по отдельности растут с энергией, а в сумме сокращаются: это проверка калибровочной структуры. W распадаются, кварки рвут струны на мезоны',
  )
  .collide(['electron', 'positron'], 'collision', 'wPlus+wMinus')
  .decay('collision.0', 'firstDecay')
  .decay('collision.1', 'secondDecay')
  .evolve(DETECTOR_TIME_IN_SECONDS)
  .measureSystem('detector')
  .report('mean', ['collision.crossSectionInNanobarns'], 'Сечение W⁺W⁻, нб')
  .report(
    'histogram',
    ['collision.cosThetaStar'],
    'cos θ* W⁺: пик вперед от обмена нейтрино',
    ANGLE_BINS,
  )
  .report('frequency', ['firstDecay'], 'Распад W⁺')
  .report('frequency', ['detector'], 'Что видит детектор')
  .build();

export const HIGGS_STRAHLUNG_TEMPLATE = beams('higgsStrahlung', HIGGS_FACTORY_BEAM_ENERGY_IN_GEV)
  .describe(
    'Фабрика Хиггса: e⁺e⁻ → Zh при √s = 250 ГэВ через s-канальный Z и вершину ZZh из |DΦ|², около 0.26 пб. Z и Хиггс распадаются, Хиггс чаще всего в b b̄; b-кварки становятся B-мезонами, а те распадаются через W*',
  )
  .collide(['electron', 'positron'], 'collision', 'zBoson+higgsBoson')
  .decay('collision.0', 'zDecay')
  .decay('collision.1', 'higgsDecay')
  .evolve(DETECTOR_TIME_IN_SECONDS)
  .measureSystem('detector')
  .report('mean', ['collision.crossSectionInNanobarns'], 'Сечение Zh, нб')
  .report('histogram', ['collision.cosThetaStar'], 'cos θ* Z', ANGLE_BINS)
  .report('frequency', ['higgsDecay'], 'Распад Хиггса')
  .report('frequency', ['detector'], 'Что видит детектор')
  .build();
