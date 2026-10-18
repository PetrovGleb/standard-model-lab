/* MatterStepFields: forms for createNucleus, createAtom and createMolecule; nuclei, atoms, ions and catalogue molecules or molecular ions come from the species picker, and the molecule
   configurator checks atoms with isotopes and formal charges, bonds of order 1–3, valence and connectivity and shows the Hill formula with the ion charge. */
import type {
  BondOrder,
  CatalogResponse,
  CreateAtomStep,
  CreateMoleculeStep,
  CreateNucleusStep,
  ElementEntry,
  ExperimentStep,
  MoleculeBond,
  SpinPreparation,
} from '@standard-model/contracts';
import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { SPIN_PREPARATION_GLOSSARY } from '../glossary';
import { FIELD_ICONS, FieldLabel } from '../icons';
import {
  atomFromSpecies,
  formalChargeAt,
  formalChargeOptions,
  moleculeChargeText,
  moleculeFormula,
  moleculeFromSpecies,
  moleculeProblems,
  valenceUsed,
  withFormalCharge,
  withFormalCharges,
  withoutAtom,
} from '../molecule-edits';
import { speciesSymbolResolver } from '../species';
import {
  atomSpecies,
  atomStepFields,
  elementName,
  nucleusStepFields,
  speciesCaption,
} from '../species-tree';
import { SpeciesPicker } from './species-picker';
import { MomentumField } from './momentum-field';
import { Select } from './select';
import { SmlIcon } from './sml-icon';
import { bilingual, say } from '../language';

const NO_SPIN = 'none';
const BOND_ORDER_LABELS = bilingual<string>({
  '1': ['одинарная —', 'single —'],
  '2': ['двойная =', 'double ='],
  '3': ['тройная ≡', 'triple ≡'],
});

const FORMAL_CHARGE_LABELS: Readonly<Record<string, string>> = {
  '-1': '−1',
  '0': '0',
  '1': '+1',
};

function formalChargeTitle(): string {
  return say(
    'Формальный заряд атома: −1 у аниона (OH⁻), +1 у катиона (H₃O⁺, NH₄⁺)',
    'Formal charge of the atom: −1 in an anion (OH⁻), +1 in a cation (H₃O⁺, NH₄⁺)',
  );
}

function atomMomentumPresets(): readonly { label: string; value: number; note: string }[] {
  return [
    { label: say('в покое', 'at rest'), value: 0, note: '' },
    { label: say('1 кэВ/c', '1 keV/c'), value: 1e-6, note: '' },
    { label: say('1 МэВ/c', '1 MeV/c'), value: 1e-3, note: '' },
    { label: say('1 ГэВ/c', '1 GeV/c'), value: 1, note: '' },
  ];
}

type MatterStep = CreateNucleusStep | CreateAtomStep | CreateMoleculeStep;

interface Props {
  readonly step: MatterStep;
  readonly catalog: CatalogResponse;
  readonly parameters: readonly string[];
  readonly onChange: (step: ExperimentStep) => void;
}

function elementOf(catalog: CatalogResponse, protons: number): ElementEntry | undefined {
  return catalog.elements.find((element) => element.protons === protons);
}

function isotopeHint(element: ElementEntry | undefined): string {
  if (element === undefined) {
    return '';
  }
  return element.isotopes.length === 0
    ? say(
        `стабильных нет, по умолчанию самый долгоживущий: A = ${String(element.defaultMassNumber)}`,
        `no stable isotopes, the longest-lived by default: A = ${String(element.defaultMassNumber)}`,
      )
    : `${say('природные', 'natural')}: ${element.isotopes
        .map(
          (isotope) =>
            `${String(isotope.massNumber)} (${(isotope.abundance * 100).toPrecision(3)} %)`,
        )
        .join(', ')}`;
}

function LabelField({ step, onChange }: Pick<Props, 'step' | 'onChange'>) {
  return (
    <label
      data-tooltip={say(
        'Имя, по которому на объект ссылаются следующие шаги',
        'The name later steps use to refer to the object',
      )}
    >
      <FieldLabel icon={FIELD_ICONS.label}>{say('Метка', 'Label')}</FieldLabel>
      <input
        value={step.label}
        onChange={(event) => onChange({ ...step, label: event.target.value })}
      />
    </label>
  );
}

function NucleusFields({
  step,
  catalog,
  parameters,
  onChange,
}: Props & { readonly step: CreateNucleusStep }) {
  const element = elementOf(catalog, step.protons);
  const [picking, setPicking] = useState(false);
  const speciesSymbol = useMemo(() => speciesSymbolResolver(catalog), [catalog]);
  const species = atomSpecies(step.protons, step.massNumber, step.protons);
  return (
    <>
      <LabelField step={step} onChange={onChange} />
      <label
        data-tooltip={say(
          'Элемент и изотоп: Z протонов и A = Z + N нуклонов, проверяется по NUBASE2020',
          'Element and isotope: Z protons and A = Z + N nucleons, checked against NUBASE2020',
        )}
      >
        <FieldLabel icon={FIELD_ICONS.element}>{say('Ядро', 'Nucleus')}</FieldLabel>
        <button type="button" className="species-button" onClick={() => setPicking(true)}>
          <span className="species-avatar">{speciesSymbol(species)}</span>
          <span className="species-button-name">
            {speciesCaption(catalog, species, speciesSymbol)}
          </span>
        </button>
        <small className="hint">{isotopeHint(element)}</small>
      </label>
      <MomentumField
        value={step.momentumInGev}
        parameters={parameters}
        presets={atomMomentumPresets()}
        onChange={(momentumInGev) => onChange({ ...step, momentumInGev })}
      />
      {picking && (
        <SpeciesPicker
          source={catalog}
          symbolOf={speciesSymbol}
          scope="nucleus"
          allowMixtures={false}
          onClose={() => setPicking(false)}
          onPick={([first]) => {
            setPicking(false);
            const fields = first === undefined ? null : nucleusStepFields(first.species);
            if (fields !== null) {
              onChange({ ...step, ...fields });
            }
          }}
        />
      )}
    </>
  );
}

function AtomFields({
  step,
  catalog,
  parameters,
  onChange,
}: Props & { readonly step: CreateAtomStep }) {
  const element = elementOf(catalog, step.protons);
  const [picking, setPicking] = useState(false);
  const speciesSymbol = useMemo(() => speciesSymbolResolver(catalog), [catalog]);
  const species = atomSpecies(
    step.protons,
    step.massNumber ?? element?.defaultMassNumber ?? step.protons,
    step.charge ?? 0,
  );
  return (
    <>
      <LabelField step={step} onChange={onChange} />
      <label
        data-tooltip={say(
          'Элемент, изотоп и заряд: Z протонов, A нуклонов и сколько электронов снято',
          'Element, isotope and charge: Z protons, A nucleons and how many electrons are removed',
        )}
      >
        <FieldLabel icon={FIELD_ICONS.element}>{say('Атом или ион', 'Atom or ion')}</FieldLabel>
        <button type="button" className="species-button" onClick={() => setPicking(true)}>
          <span className="species-avatar">{speciesSymbol(species)}</span>
          <span className="species-button-name">
            {speciesCaption(catalog, species, speciesSymbol)}
          </span>
        </button>
        <small className="hint">{isotopeHint(element)}</small>
      </label>
      <label
        data-tooltip={say(
          'Проекция полного момента J основного уровня; у уровней с J = 0 готовить нечего',
          'Projection of the total angular momentum J of the ground level; levels with J = 0 have nothing to prepare',
        )}
      >
        <FieldLabel icon={FIELD_ICONS.spin}>{say('Спин', 'Spin')}</FieldLabel>
        <Select
          value={step.spin ?? NO_SPIN}
          options={[NO_SPIN, ...catalog.spinPreparations]}
          labels={{ [NO_SPIN]: say('не готовить', 'do not prepare') }}
          titles={SPIN_PREPARATION_GLOSSARY}
          onChange={(value) => {
            const { spin, ...rest } = step;
            void spin;
            onChange(value === NO_SPIN ? rest : { ...rest, spin: value as SpinPreparation });
          }}
        />
        {element !== undefined && (
          <small className="hint">
            {say('основной уровень нейтрального атома', 'ground level of the neutral atom')}{' '}
            {element.groundLevel}, {say('конфигурация', 'configuration')} {element.groundShells}
          </small>
        )}
      </label>
      <MomentumField
        value={step.momentumInGev}
        parameters={parameters}
        presets={atomMomentumPresets()}
        onChange={(momentumInGev) => onChange({ ...step, momentumInGev })}
      />
      {picking && (
        <SpeciesPicker
          source={catalog}
          symbolOf={speciesSymbol}
          scope="atom"
          allowMixtures={false}
          onClose={() => setPicking(false)}
          onPick={([first]) => {
            setPicking(false);
            const fields =
              first === undefined
                ? null
                : atomStepFields(
                    first.species,
                    (protons) => elementOf(catalog, protons)?.defaultMassNumber,
                  );
            if (fields !== null) {
              const { massNumber, charge, ...rest } = step;
              void massNumber;
              void charge;
              onChange({ ...rest, ...fields });
            }
          }}
        />
      )}
    </>
  );
}

function nextBond(step: CreateMoleculeStep): MoleculeBond {
  const bonded = new Set(step.bonds.flatMap((bond) => [bond.first, bond.second]));
  const loose = step.atoms.findIndex((unused, index) => !bonded.has(index));
  const second = loose > 0 ? loose : Math.min(1, step.atoms.length - 1);
  return { first: 0, second, order: 1 };
}

type MoleculePicking =
  { readonly target: 'molecule' } | { readonly target: 'atom'; readonly index: number | null };

function MoleculeFields({
  step,
  catalog,
  parameters,
  onChange,
}: Props & { readonly step: CreateMoleculeStep }) {
  const [picking, setPicking] = useState<MoleculePicking | null>(null);
  const speciesSymbol = useMemo(() => speciesSymbolResolver(catalog), [catalog]);
  const defaultMassNumber = (protons: number): number | undefined =>
    elementOf(catalog, protons)?.defaultMassNumber;
  const takePick = (target: MoleculePicking, species: string): void => {
    if (target.target === 'molecule') {
      const molecule = moleculeFromSpecies(species, defaultMassNumber);
      if (molecule !== null) {
        onChange(
          withFormalCharges(
            { ...step, atoms: molecule.atoms, bonds: molecule.bonds },
            molecule.charges ?? [],
          ),
        );
      }
      return;
    }
    const atom = atomFromSpecies(species, defaultMassNumber);
    if (atom === null) {
      return;
    }
    onChange({
      ...step,
      atoms:
        target.index === null
          ? [...step.atoms, atom]
          : step.atoms.map((existing, position) => (position === target.index ? atom : existing)),
    });
  };
  const symbolOf = (protons: number): string =>
    elementOf(catalog, protons)?.symbol ?? `Z${String(protons)}`;
  const atomOptions = step.atoms.map((unused, index) => String(index));
  const atomLabels = Object.fromEntries(
    step.atoms.map((atom, index) => [
      String(index),
      `${String(index + 1)}. ${symbolOf(atom.protons)}`,
    ]),
  );
  const problems = moleculeProblems(
    step,
    (protons) => elementOf(catalog, protons)?.maximumValence ?? 0,
  );
  const updateBond = (position: number, bond: MoleculeBond): void =>
    onChange({
      ...step,
      bonds: step.bonds.map((existing, index) => (index === position ? bond : existing)),
    });
  return (
    <>
      <LabelField step={step} onChange={onChange} />
      <div className="molecule-summary wide-field">
        <SmlIcon name="formula" size={18} aria-hidden="true" />
        <strong>
          {moleculeFormula(step.atoms.map((atom) => symbolOf(atom.protons)))}
          {moleculeChargeText(step.charges)}
        </strong>
        <span className="muted">
          {say(
            `${String(step.atoms.length)} атомов, ${String(step.bonds.length)} связей`,
            `${String(step.atoms.length)} atoms, ${String(step.bonds.length)} bonds`,
          )}
        </span>
        <button
          type="button"
          className="catalog-button"
          data-tooltip={say(
            'Взять атомы и связи готовой молекулы из каталога',
            'Take the atoms and bonds of a ready molecule from the catalogue',
          )}
          onClick={() => setPicking({ target: 'molecule' })}
        >
          <SmlIcon name="molecule" size={16} aria-hidden="true" />
          {say('Из каталога', 'From the catalogue')}
        </button>
      </div>
      <fieldset className="molecule-atoms wide-field">
        <legend>
          <FieldLabel icon={FIELD_ICONS.atom}>{say('Атомы', 'Atoms')}</FieldLabel>
        </legend>
        {step.atoms.map((atom, index) => {
          const element = elementOf(catalog, atom.protons);
          const charge = String(formalChargeAt(step, index));
          return (
            <div key={index} className="molecule-row">
              <span className="atom-index">{index + 1}</span>
              <button
                type="button"
                className="species-button"
                data-tooltip={say('Выбрать элемент и изотоп', 'Choose the element and isotope')}
                onClick={() => setPicking({ target: 'atom', index })}
              >
                <span className="species-avatar">
                  {speciesSymbol(
                    atomSpecies(
                      atom.protons,
                      atom.massNumber ?? element?.defaultMassNumber ?? atom.protons,
                      0,
                    ),
                  )}
                </span>
                <span className="species-button-name">
                  {element === undefined
                    ? `Z = ${String(atom.protons)}`
                    : `${elementName(element)}-${String(atom.massNumber ?? element.defaultMassNumber)}`}
                </span>
              </button>
              <span
                className={
                  valenceUsed(step, index) > (element?.maximumValence ?? 0)
                    ? 'valence over'
                    : 'valence'
                }
                data-tooltip={say(
                  'Сумма порядков связей у атома и наибольшая валентность элемента',
                  'Sum of the bond orders at the atom and the largest valence of the element',
                )}
              >
                {valenceUsed(step, index)}/{element?.maximumValence ?? 0}
              </span>
              <Select
                value={charge}
                options={formalChargeOptions(atom.protons).map(String)}
                labels={FORMAL_CHARGE_LABELS}
                titles={{ [charge]: formalChargeTitle() }}
                onChange={(value) => onChange(withFormalCharge(step, index, Number(value)))}
              />
              <button
                type="button"
                className="icon-button"
                aria-label={say('Убрать атом', 'Remove atom')}
                disabled={step.atoms.length <= 2}
                onClick={() => onChange(withoutAtom(step, index))}
              >
                <SmlIcon name="delete" size={16} aria-hidden="true" />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className="add-step"
          onClick={() => setPicking({ target: 'atom', index: null })}
        >
          <SmlIcon name="add-atom" size={16} aria-hidden="true" />{' '}
          {say('Добавить атом', 'Add atom')}
        </button>
      </fieldset>
      <fieldset className="molecule-bonds wide-field">
        <legend>
          <FieldLabel icon={FIELD_ICONS.bond}>{say('Связи', 'Bonds')}</FieldLabel>
        </legend>
        {step.bonds.map((bond, position) => (
          <div key={position} className="molecule-row">
            <Select
              value={String(bond.first)}
              options={atomOptions}
              labels={atomLabels}
              onChange={(value) => updateBond(position, { ...bond, first: Number(value) })}
            />
            <Select
              value={String(bond.order)}
              options={['1', '2', '3']}
              labels={BOND_ORDER_LABELS}
              onChange={(value) =>
                updateBond(position, { ...bond, order: Number(value) as BondOrder })
              }
            />
            <Select
              value={String(bond.second)}
              options={atomOptions}
              labels={atomLabels}
              onChange={(value) => updateBond(position, { ...bond, second: Number(value) })}
            />
            <button
              type="button"
              className="icon-button"
              aria-label={say('Убрать связь', 'Remove bond')}
              disabled={step.bonds.length <= 1}
              onClick={() =>
                onChange({
                  ...step,
                  bonds: step.bonds.filter((unused, index) => index !== position),
                })
              }
            >
              <X size={16} strokeWidth={2.25} aria-hidden="true" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="add-step"
          onClick={() => onChange({ ...step, bonds: [...step.bonds, nextBond(step)] })}
        >
          <SmlIcon name="add-bond" size={16} aria-hidden="true" />{' '}
          {say('Добавить связь', 'Add bond')}
        </button>
      </fieldset>
      {problems.length > 0 && (
        <ul className="molecule-problems wide-field">
          {problems.map((problem) => (
            <li key={problem} className="error">
              {problem}
            </li>
          ))}
        </ul>
      )}
      <MomentumField
        value={step.momentumInGev}
        parameters={parameters}
        presets={atomMomentumPresets()}
        onChange={(momentumInGev) => onChange({ ...step, momentumInGev })}
      />
      {picking !== null && (
        <SpeciesPicker
          source={catalog}
          symbolOf={speciesSymbol}
          scope={picking.target === 'atom' ? 'moleculeAtom' : 'molecule'}
          allowMixtures={false}
          onClose={() => setPicking(null)}
          onPick={([first]) => {
            setPicking(null);
            if (first !== undefined) {
              takePick(picking, first.species);
            }
          }}
        />
      )}
    </>
  );
}

export function MatterStepFields(props: Props) {
  const { step } = props;
  switch (step.operation) {
    case 'createNucleus':
      return <NucleusFields {...props} step={step} />;
    case 'createAtom':
      return <AtomFields {...props} step={step} />;
    case 'createMolecule':
      return <MoleculeFields {...props} step={step} />;
  }
}
