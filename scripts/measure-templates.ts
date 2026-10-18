/* Measures every built-in template with a short pilot run and writes packages/engine/src/templates/complexity.generated.json: the first shot, the mean of the later shots on this machine and the share of each step, so the template list can show how heavy a template is before it runs. */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EXPERIMENT_TEMPLATES, estimateRun } from '../packages/engine/src/index.js';

const target = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'packages',
  'engine',
  'src',
  'templates',
  'complexity.generated.json',
);
const SIGNIFICANT_DIGITS = 3;

const rounded = (value: number): number => Number(value.toPrecision(SIGNIFICANT_DIGITS));
const complexity = Object.fromEntries(
  Object.entries(EXPERIMENT_TEMPLATES).map(([name, plan]) => {
    const estimate = estimateRun(plan);
    const total = estimate.stepMeanMilliseconds.reduce((sum, value) => sum + value, 0);
    console.log(`${name}: ${estimate.meanShotMilliseconds.toFixed(3)} ms per shot`);
    return [
      name,
      {
        firstShotMilliseconds: rounded(estimate.firstShotMilliseconds),
        meanShotMilliseconds: rounded(estimate.meanShotMilliseconds),
        stepShares: estimate.stepMeanMilliseconds.map((value) =>
          rounded(total > 0 ? value / total : 0),
        ),
      },
    ];
  }),
);
writeFileSync(
  target,
  `${JSON.stringify({ machine: process.arch, measuredAt: new Date().toISOString().slice(0, 10), complexity }, null, 1)}\n`,
);
