/* Checks the two languages of the engine: every template has a translation without Cyrillic in English, every trace text of a short run of every template, the Lagrangian and process notes and the plan errors come in both languages. */
import { LocalizedError, textIn } from '@standard-model/contracts';
import { describe, expect, it } from 'vitest';
import {
  EXPERIMENT_TEMPLATES,
  PlanCompilationError,
  SHARED_PROCESS_CALCULATOR,
  compilePlan,
  experiment,
  hasTemplateTranslation,
  localizeTemplate,
  runExperiment,
} from '../src/index.js';

const SHORT_RUN_SHOTS = 3;
const RUN_TIMEOUT_IN_MILLISECONDS = 240_000;
const Z_PEAK_ENERGY_IN_GEV = 91.19;

const CYRILLIC = /[А-Яа-яЁё]/;
const TEMPLATES = Object.values(EXPERIMENT_TEMPLATES);

describe('template languages', () => {
  it('translates every built-in template', () => {
    expect(
      TEMPLATES.filter((plan) => !hasTemplateTranslation(plan.name)).map((plan) => plan.name),
    ).toEqual([]);
  });

  it('gives every template an English description and English report labels', () => {
    const leftovers = TEMPLATES.map((plan) => localizeTemplate(plan, 'en')).flatMap((plan) =>
      [plan.description ?? '', ...plan.report.map((spec) => spec.label ?? '')]
        .filter((text) => CYRILLIC.test(text))
        .map((text) => `${plan.name}: ${text}`),
    );
    expect(leftovers).toEqual([]);
  });

  it('gives every template a Russian description and keeps the steps untouched', () => {
    TEMPLATES.forEach((plan) => {
      const russian = localizeTemplate(plan, 'ru');
      expect(CYRILLIC.test(russian.description ?? '')).toBe(true);
      expect(localizeTemplate(plan, 'en').steps).toBe(plan.steps);
    });
  });

  it(
    'writes every trace text of every template in English without Cyrillic',
    () => {
      const leftovers = TEMPLATES.flatMap((plan) => {
        const result = runExperiment(plan, { shots: SHORT_RUN_SHOTS, seed: 2 });
        const reports =
          result.systemReports ?? (result.systemReport === null ? [] : [result.systemReport]);
        return reports
          .flatMap((report) => [
            textIn(report.note, 'en'),
            ...report.frames.flatMap((frame) =>
              frame.events.flatMap((event) => [
                textIn(event.text, 'en'),
                ...(event.diagrams ?? []).map((diagram) => textIn(diagram.channel, 'en')),
              ]),
            ),
          ])
          .filter((text) => CYRILLIC.test(text))
          .map((text) => `${plan.name}: ${text}`);
      });
      expect(leftovers).toEqual([]);
    },
    RUN_TIMEOUT_IN_MILLISECONDS,
  );
});

describe('engine texts outside the trace', () => {
  it('gives the Lagrangian and the process calculator English notes', () => {
    const lagrangian = SHARED_PROCESS_CALCULATOR.lagrangian('fermiConstant', null);
    const process = SHARED_PROCESS_CALCULATOR.calculate({
      initial: ['electron', 'positron'],
      final: ['muon', 'antiMuon'],
      centerOfMassEnergyInGev: Z_PEAK_ENERGY_IN_GEV,
    });
    const width = SHARED_PROCESS_CALCULATOR.calculate({
      initial: ['zBoson'],
      final: ['up', 'antiUp'],
    });
    const texts = [
      ...lagrangian.terms.map((term) => term.note.en),
      ...lagrangian.parameters.map((parameter) => parameter.note.en),
      ...process.notes.map((note) => note.en),
      ...width.notes.map((note) => note.en),
      ...(width.reference === null ? [] : [width.reference.label.en]),
      ...process.diagrams.map((diagram) => textIn(diagram.channel, 'en')),
    ];
    expect(texts.filter((text) => CYRILLIC.test(text))).toEqual([]);
    expect(lagrangian.terms.some((term) => CYRILLIC.test(term.note.ru))).toBe(true);
  });

  it('raises plan errors in both languages', () => {
    const plan = experiment('broken')
      .create('electron', 'electron')
      .measure('ghost', 'spin', 'outcome')
      .build();
    try {
      compilePlan(plan);
      throw new Error('compilation should fail');
    } catch (error) {
      expect(error).toBeInstanceOf(PlanCompilationError);
      expect(error).toBeInstanceOf(LocalizedError);
      const text = (error as PlanCompilationError).text;
      expect(CYRILLIC.test(text.ru)).toBe(true);
      expect(CYRILLIC.test(text.en)).toBe(false);
      expect((error as Error).message).toContain(text.en);
    }
  });
});
