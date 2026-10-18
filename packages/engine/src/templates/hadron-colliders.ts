/* Templates: hadron colliders built on the parton structure of the proton; LHC jets, the Drell–Yan Z peak, top pairs at the LHC and the Tevatron, deep inelastic electron–proton scattering at HERA. */
import { experiment } from '../experiment/experiment-builder.js';

const DETECTOR_TIME_IN_SECONDS = 1e-9;
const LHC_BEAM_MOMENTUM_IN_GEV = 6800;
const TEVATRON_BEAM_MOMENTUM_IN_GEV = 980;
const HERA_ELECTRON_MOMENTUM_IN_GEV = 27.5;
const HERA_PROTON_MOMENTUM_IN_GEV = 920;
const JET_TRANSVERSE_MOMENTUM_IN_GEV = 50;
const LEPTON_TRANSVERSE_MOMENTUM_IN_GEV = 10;
const DEEP_INELASTIC_TRANSVERSE_MOMENTUM_IN_GEV = 5;
const COLLIDER_SHOTS = 1000;
const TOP_SHOTS = 500;
const MASS_BINS = 60;
const FRACTION_BINS = 40;
const MULTIPLICITY_BINS = 40;

function protonBeams(name: string, beamMomentumInGev: number, second: 'proton' | 'antiProton') {
  return experiment(name)
    .parameter('beamMomentumInGev', beamMomentumInGev)
    .parameter('backwardMomentumInGev', -beamMomentumInGev)
    .create('first', 'proton', { momentumInGev: { x: 0, y: 0, z: '{{beamMomentumInGev}}' } })
    .create('second', second, { momentumInGev: { x: 0, y: 0, z: '{{backwardMomentumInGev}}' } })
    .shots(COLLIDER_SHOTS);
}

export const LHC_JETS_TEMPLATE = protonBeams('lhcJets', LHC_BEAM_MOMENTUM_IN_GEV, 'proton')
  .describe(
    'Протоны LHC по 6.8 ТэВ. Протон не точка: шаг «Столкнуть» берет его партонную структуру NNPDF2.3 и разыгрывает жесткое рассеяние партонов по древесным диаграммам лагранжиана выше p_T = 50 ГэВ. Чаще всего рассеиваются глюоны; остатки протонов (дикварки, кварки) натягивают струны к струям, и через наносекунду детектор видит десятки адронов',
  )
  .parameter('minimumTransverseMomentumInGev', JET_TRANSVERSE_MOMENTUM_IN_GEV)
  .collide(['first', 'second'], 'collision', undefined, '{{minimumTransverseMomentumInGev}}')
  .evolve(DETECTOR_TIME_IN_SECONDS)
  .measureSystem('detector')
  .report('frequency', ['collision.partons'], 'Какие партоны столкнулись')
  .report('frequency', ['collision'], 'Что вылетело из жесткого процесса')
  .report('mean', ['collision.crossSectionInNanobarns'], 'Сечение выше порога p_T, нб')
  .report(
    'histogram',
    ['collision.firstMomentumFraction'],
    'Доля импульса x первого партона',
    FRACTION_BINS,
  )
  .report('histogram', ['collision.transverseMomentumInGev'], 'p_T струи, ГэВ', FRACTION_BINS)
  .report('mean', ['detector.chargedCount'], 'Заряженных частиц в событии')
  .report('histogram', ['detector.chargedCount'], 'Заряженная множественность', MULTIPLICITY_BINS)
  .build();

export const DRELL_YAN_TEMPLATE = protonBeams('drellYan', LHC_BEAM_MOMENTUM_IN_GEV, 'proton')
  .describe(
    'Процесс Дрелла–Яна на LHC: кварк одного протона и антикварк другого аннигилируют через γ* и Z в пару μ⁺μ⁻ (триггер канала, p_T мюонов > 10 ГэВ). Масса пары равна √ŝ партонов, поэтому гистограмма √ŝ показывает пик Z на 91 ГэВ поверх фотонного континуума. Изредка мюоны рождают два фотона из фотонных PDF протонов',
  )
  .collide(['first', 'second'], 'collision', 'muon+antiMuon', LEPTON_TRANSVERSE_MOMENTUM_IN_GEV)
  .evolve(DETECTOR_TIME_IN_SECONDS)
  .measureSystem('detector')
  .report('histogram', ['collision.hardEnergyInGev'], 'Масса пары μ⁺μ⁻, ГэВ', MASS_BINS)
  .report('mean', ['collision.crossSectionInNanobarns'], 'Сечение pp → μ⁺μ⁻ X, нб')
  .report('frequency', ['collision.partons'], 'Аннигилировавшие партоны')
  .report('frequency', ['detector'], 'Что видит детектор')
  .build();

export const LHC_TOP_PAIRS_TEMPLATE = protonBeams('lhcTopPairs', LHC_BEAM_MOMENTUM_IN_GEV, 'proton')
  .describe(
    'Пары топ-кварков на LHC: на 13.6 ТэВ они рождаются в основном слиянием глюонов gg → t t̄. Каждый t распадается раньше адронизации на W и b; b-кварки становятся B-мезонами. Древесное сечение около 0.5 нб против измеренных 0.85 нб: не хватает петлевых поправок',
  )
  .shots(TOP_SHOTS)
  .collide(['first', 'second'], 'collision', 'top+antiTop', 0)
  .decay('collision.0', 'topDecay')
  .decay('collision.1', 'antiTopDecay')
  .evolve(DETECTOR_TIME_IN_SECONDS)
  .measureSystem('detector')
  .report('mean', ['collision.crossSectionInNanobarns'], 'Сечение pp → t t̄, нб')
  .report('frequency', ['collision.partons'], 'Начальные партоны')
  .report('histogram', ['collision.hardEnergyInGev'], 'Масса пары t t̄, ГэВ', MASS_BINS)
  .report('frequency', ['topDecay'], 'Распад t')
  .build();

export const TEVATRON_TOP_PAIRS_TEMPLATE = protonBeams(
  'tevatronTopPairs',
  TEVATRON_BEAM_MOMENTUM_IN_GEV,
  'antiProton',
)
  .describe(
    'Тэватрон, протоны на антипротоны по 0.98 ТэВ: топ-кварки открыли здесь в 1995 году. При этой энергии доли импульса партонов велики, и t t̄ рождаются в основном аннигиляцией валентных q q̄ из протона и антипротона, а не слиянием глюонов, как на LHC',
  )
  .shots(TOP_SHOTS)
  .collide(['first', 'second'], 'collision', 'top+antiTop', 0)
  .report('mean', ['collision.crossSectionInNanobarns'], 'Сечение p p̄ → t t̄, нб')
  .report('frequency', ['collision.partons'], 'Начальные партоны')
  .report('histogram', ['collision.hardEnergyInGev'], 'Масса пары t t̄, ГэВ', MASS_BINS)
  .build();

export const HERA_DEEP_INELASTIC_TEMPLATE = experiment('heraDeepInelastic')
  .describe(
    'HERA: электрон 27.5 ГэВ навстречу протону 920 ГэВ. Электрон точечный, протон отдает кварк с долей импульса x; обмен γ и Z дает нейтральный ток e q → e q, обмен W заряженный ток e q → ν q′. Гистограмма x показывает партонные распределения, которые HERA и измерила',
  )
  .shots(COLLIDER_SHOTS)
  .parameter('electronMomentumInGev', -HERA_ELECTRON_MOMENTUM_IN_GEV)
  .parameter('protonMomentumInGev', HERA_PROTON_MOMENTUM_IN_GEV)
  .create('electron', 'electron', { momentumInGev: { x: 0, y: 0, z: '{{electronMomentumInGev}}' } })
  .create('proton', 'proton', { momentumInGev: { x: 0, y: 0, z: '{{protonMomentumInGev}}' } })
  .collide(
    ['electron', 'proton'],
    'collision',
    undefined,
    DEEP_INELASTIC_TRANSVERSE_MOMENTUM_IN_GEV,
  )
  .evolve(DETECTOR_TIME_IN_SECONDS)
  .measureSystem('detector')
  .report('frequency', ['collision'], 'Конечное состояние жесткого процесса')
  .report('frequency', ['collision.partons'], 'По какому партону ударил электрон')
  .report(
    'histogram',
    ['collision.secondMomentumFraction'],
    'Доля импульса x кварка',
    FRACTION_BINS,
  )
  .report('mean', ['collision.crossSectionInNanobarns'], 'Сечение выше p_T = 5 ГэВ, нб')
  .build();
