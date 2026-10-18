/* Checks the English interface: every glossary record, step description and influence caption of every built-in template comes out without a Cyrillic letter, and switching back restores Russian. */
import type { InfluenceStep } from '@standard-model/contracts';
import { EXPERIMENT_TEMPLATES } from '@standard-model/engine';
import { afterEach, describe, expect, it } from 'vitest';
import { formatNumber } from '../src/format';
import * as glossary from '../src/glossary';
import { influenceVisual } from '../src/influence-visual';
import { activeLanguage, bilingual, say, setActiveLanguage } from '../src/language';
import { describeStep, planWarnings } from '../src/plan-edits';
import { MATTER_KIND_LABELS, PARTICLE_CLASS_LABELS } from '../src/presets';

const CYRILLIC = /[А-Яа-яЁё]/;

function cyrillicIn(texts: readonly string[]): readonly string[] {
  return texts.filter((text) => CYRILLIC.test(text));
}

const STEPS = Object.values(EXPERIMENT_TEMPLATES).flatMap((plan) => plan.steps);

afterEach(() => {
  setActiveLanguage('ru');
});

describe('interface language', () => {
  it('starts in Russian outside a browser and reads the active language', () => {
    expect(activeLanguage()).toBe('ru');
    expect(say('да', 'yes')).toBe('да');
    const record = bilingual<'answer'>({ answer: ['да', 'yes'] });
    setActiveLanguage('en');
    expect(say('да', 'yes')).toBe('yes');
    expect(record.answer).toBe('yes');
    expect(Object.values(record)).toEqual(['yes']);
  });

  it('has an English text for every glossary entry', () => {
    setActiveLanguage('en');
    const records = Object.values(glossary).filter(
      (value): value is Readonly<Record<string, string>> =>
        typeof value === 'object' && !Array.isArray(value),
    );
    expect(records.length).toBeGreaterThan(10);
    const texts = [
      ...records.flatMap((record) => Object.values(record)),
      ...glossary.INFLUENCE_CATEGORIES.map((group) => group.label),
      ...glossary.ENTANGLED_STATE_CATEGORIES.map((group) => group.label),
      ...Object.values(PARTICLE_CLASS_LABELS),
      ...Object.values(MATTER_KIND_LABELS),
      formatNumber(null),
    ];
    expect(cyrillicIn(texts)).toEqual([]);
  });

  it('describes every step and pictures every influence of the templates in English', () => {
    setActiveLanguage('en');
    const influences = STEPS.filter(
      (step): step is InfluenceStep => step.operation === 'influence',
    );
    expect(influences.length).toBeGreaterThan(5);
    expect(
      cyrillicIn([
        ...STEPS.map((step) => describeStep(step)),
        ...influences.map((step) => influenceVisual(step).caption),
        ...influences.map((step) => influenceVisual(step, 4.1e-15).caption),
        ...planWarnings({ name: 'empty', parameters: {}, shots: 1, steps: [], report: [] }),
      ]),
    ).toEqual([]);
    setActiveLanguage('ru');
    expect(cyrillicIn(STEPS.map((step) => describeStep(step))).length).toBeGreaterThan(0);
  });
});
