/* CatalogService: vocabularies the web client needs to build plans, particles with their observables, influence definitions, names, and the measured nuclides of one element on request. */
import { Injectable } from '@nestjs/common';
import {
  ENVIRONMENT_PRESETS,
  ENVIRONMENT_SCALES,
  BOHR_RADIUS,
  PLANCK_LENGTH,
  PROTON_RMS_CHARGE_RADIUS,
  REDUCED_COMPTON_WAVELENGTH,
  MATTER_DATA,
  MOLECULE_CATALOG,
  MOLECULE_CATEGORIES,
  MOLECULE_GROUPS,
  PLANCK_CONSTANT_IN_EV_PER_HERTZ,
  defaultMassNumber,
  electronAffinityInEv,
  elementNameInRussian,
  maximumValence,
  measuredNuclides,
  particleSpec,
} from '@standard-model/constants';
import {
  ENTANGLED_STATES,
  OBSERVABLE_NAMES,
  PARTICLE_NAMES,
  REPORT_STATISTICS,
  SPIN_PREPARATIONS,
  TEMPLATE_CATEGORIES,
  localizedText,
  type CatalogResponse,
  type ElementEntry,
  type MoleculeCatalogEntry,
  type NuclideEntry,
  type ParticleCatalogEntry,
  type LocalizedText,
  type ParticleName,
} from '@standard-model/contracts';
import {
  candidateChannels,
  createDefaultInfluenceRegistry,
  catalogMoleculeTraits,
  createEngine,
  isRadical,
  validateMoleculeStructure,
  VALID_GRID_SIZES,
} from '@standard-model/engine';
import { POTENTIAL_KINDS, SPACE_WALLS } from '@standard-model/contracts';
import { buildPresets } from './presets.js';

const OPERATIONS = [
  'create',
  'createNucleus',
  'createAtom',
  'createMolecule',
  'entangle',
  'influence',
  'evolve',
  'measure',
  'combine',
  'diffract',
  'collide',
  'place',
  'propagate',
  'measurePosition',
  'measureSystem',
  'decay',
] as const;
const CATALOG_SEED = 0;

function elementEntries(): readonly ElementEntry[] {
  return MATTER_DATA.elements.map((element) => {
    const neutral = element.stages[0];
    return {
      protons: element.protons,
      symbol: element.symbol,
      name: element.name,
      defaultMassNumber: defaultMassNumber(element.protons),
      maximumValence: maximumValence(element.protons),
      standardAtomicWeight: element.standardAtomicWeight,
      isotopes: element.isotopes,
      groundLevel: neutral?.groundLevel ?? '',
      groundShells: neutral?.groundShells ?? '',
      ionizationEnergyInEv: neutral?.ionizationEnergyInEv ?? null,
      coolable: MATTER_DATA.coolingTransitions.some(
        (transition) => transition.protons === element.protons,
      ),
      electronAffinityInEv: electronAffinityInEv(element.protons),
      label: localizedText(elementNameInRussian(element.protons) ?? element.name, element.name),
    };
  });
}

function moleculeEntries(): readonly MoleculeCatalogEntry[] {
  return MOLECULE_CATALOG.filter(
    (entry) => validateMoleculeStructure(entry.structure) === null,
  ).map((entry) => {
    const traits = catalogMoleculeTraits(entry.key);
    return {
      key: entry.key,
      name: entry.name,
      formula: entry.formula,
      label: localizedText(entry.ru, entry.en),
      category: entry.category,
      radical: isRadical(entry.structure),
      ...(traits === null ? {} : { massInDaltons: traits.massInDaltons, linear: traits.linear }),
    };
  });
}

function nuclideEntries(protons: number): readonly NuclideEntry[] {
  return measuredNuclides(protons).map((nuclide) => ({
    massNumber: nuclide.massNumber,
    stable: nuclide.stable,
    halfLifeInSeconds: nuclide.halfLifeInSeconds,
    halfLifeText: nuclide.halfLifeText,
    spinParity: nuclide.spinParity,
    decayMode: nuclide.decayModes[0]?.mode ?? null,
    abundancePercent: nuclide.abundancePercent,
  }));
}

function particleEntries(): readonly ParticleCatalogEntry[] {
  const engine = createEngine({ seed: CATALOG_SEED });
  return PARTICLE_NAMES.map((name) => ({
    ...particleSpec(name),
    observables: engine.particles.create(name).observables,
  }));
}

const COMMON_COLLISION_PAIRS: readonly (readonly [ParticleName, ParticleName, LocalizedText])[] = [
  [
    'electron',
    'positron',
    localizedText(
      'аннигиляция и упругое рассеяние через γ, Z, h',
      'annihilation and elastic scattering through γ, Z, h',
    ),
  ],
  [
    'photon',
    'electron',
    localizedText('комптоновское рассеяние и рождение W', 'Compton scattering and W production'),
  ],
  [
    'photon',
    'positron',
    localizedText('комптоновское рассеяние и рождение W', 'Compton scattering and W production'),
  ],
  [
    'photon',
    'photon',
    localizedText('рождение пар фермионов и W⁺W⁻', 'production of fermion pairs and W⁺W⁻'),
  ],
  ['electron', 'electron', localizedText('рассеяние Мёллера', 'Møller scattering')],
  ['electron', 'muon', localizedText('упругое eμ-рассеяние', 'elastic eμ scattering')],
  [
    'electronNeutrino',
    'electron',
    localizedText(
      'рассеяние нейтрино на электроне через W и Z',
      'neutrino–electron scattering through W and Z',
    ),
  ],
  ['up', 'antiUp', localizedText('кварковая аннигиляция', 'quark annihilation')],
  [
    'gluon',
    'gluon',
    localizedText('глюонное рассеяние и рождение кварков', 'gluon scattering and quark production'),
  ],
];

@Injectable()
export class CatalogService {
  private readonly response: CatalogResponse = {
    particles: particleEntries(),
    influences: createDefaultInfluenceRegistry().definitions,
    observables: OBSERVABLE_NAMES,
    entangledStates: ENTANGLED_STATES,
    spinPreparations: SPIN_PREPARATIONS,
    statistics: REPORT_STATISTICS,
    operations: OPERATIONS,
    templateCategories: TEMPLATE_CATEGORIES,
    presets: buildPresets(),
    collisionPairs: COMMON_COLLISION_PAIRS.map(([first, second, process]) => ({
      particles: [first, second],
      process,
      channels: candidateChannels(first, second),
    })),
    scaleReferences: [
      {
        label: localizedText('Планковская длина', 'Planck length'),
        meters: PLANCK_LENGTH.value,
        simulated: false,
      },
      {
        label: localizedText('Радиус протона', 'Proton radius'),
        meters: PROTON_RMS_CHARGE_RADIUS.value,
        simulated: false,
      },
      {
        label: localizedText(
          'Приведенная комптоновская длина электрона',
          'Reduced Compton wavelength of the electron',
        ),
        meters: REDUCED_COMPTON_WAVELENGTH.value,
        simulated: false,
      },
      {
        label: localizedText('Боровский радиус', 'Bohr radius'),
        meters: BOHR_RADIUS.value,
        simulated: true,
      },
      { label: localizedText('Атом', 'Atom'), meters: 1e-10, simulated: true },
      { label: localizedText('Спираль ДНК', 'DNA helix'), meters: 2e-9, simulated: true },
      { label: localizedText('Вирус', 'Virus'), meters: 1e-7, simulated: true },
      {
        label: localizedText('Длина волны видимого света', 'Wavelength of visible light'),
        meters: 5e-7,
        simulated: true,
      },
      { label: localizedText('Бактерия', 'Bacterium'), meters: 2e-6, simulated: true },
    ],
    gridSizes: VALID_GRID_SIZES,
    potentials: POTENTIAL_KINDS,
    spaceWalls: SPACE_WALLS,
    elements: elementEntries(),
    environments: ENVIRONMENT_PRESETS,
    environmentScales: ENVIRONMENT_SCALES,
    photonEnergyPerHertzInEv: PLANCK_CONSTANT_IN_EV_PER_HERTZ.value,
    molecules: moleculeEntries(),
    moleculeCategories: MOLECULE_CATEGORIES.map((category) => ({
      key: category.key,
      label: localizedText(category.ru, category.en),
      group: category.group,
    })),
    moleculeGroups: MOLECULE_GROUPS.map((group) => ({
      key: group.key,
      label: localizedText(group.ru, group.en),
    })),
  };

  catalog(): CatalogResponse {
    return this.response;
  }

  nuclides(protons: number): readonly NuclideEntry[] {
    return nuclideEntries(protons);
  }
}
