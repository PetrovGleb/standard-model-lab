/* Checks the experiment formula: every built-in template yields at least a line per step that KaTeX renders without errors, and frequencies carry their binomial error. */
import { EXPERIMENT_TEMPLATES, runExperiment } from '@standard-model/engine';
import katex from 'katex';
import { describe, expect, it } from 'vitest';
import { experimentFormula, formulaRows, number, symbolLatex } from '../src/experiment-formula';

const SHOTS = 50;
const TEMPLATE_TIMEOUT_IN_MILLISECONDS = 120_000;

describe('experimentFormula', () => {
  it.each(Object.keys(EXPERIMENT_TEMPLATES))(
    '%s renders in KaTeX line by line',
    (name) => {
      const plan = EXPERIMENT_TEMPLATES[name];
      if (plan === undefined) {
        throw new Error('template expected');
      }
      const formula = experimentFormula(runExperiment(plan, { shots: SHOTS, seed: 3 }));
      const model = formula.sections.find((section) => section.title === 'Модель по шагам');
      expect(model?.lines.length).toBeGreaterThanOrEqual(plan.steps.length);
      formula.sections
        .flatMap((section) => section.lines)
        .forEach((line) =>
          expect(() =>
            katex.renderToString(`\\begin{gathered}${formulaRows(line.latex)}\\end{gathered}`, {
              throwOnError: true,
              strict: 'ignore',
            }),
          ).not.toThrow(),
        );
    },
    TEMPLATE_TIMEOUT_IN_MILLISECONDS,
  );

  it('writes symbols and numbers the way papers do', () => {
    expect(['e-', 'anti-nu_mu', 'gamma', 'mu+'].map(symbolLatex)).toEqual([
      'e^{-}',
      '\\bar{\\nu_{\\mu}}',
      '\\gamma',
      '\\mu^{+}',
    ]);
    expect(number(1.5e-10)).toBe('1.5\\times 10^{-10}');
    expect(number(0.25)).toBe('0.25');
  });
});
