/* Builds the structure of every catalogue molecule and writes packages/engine/src/molecules/molecule-traits.generated.json: mass in daltons to six digits and linearity. */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOLECULE_CATALOG } from '../libs/constants/src/index.js';
import { computedMoleculeTraits } from '../packages/engine/src/molecules/molecule-traits.js';

const target = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'packages',
  'engine',
  'src',
  'molecules',
  'molecule-traits.generated.json',
);
const SIGNIFICANT_DIGITS = 6;
const rounded = (value: number): number => Number(value.toPrecision(SIGNIFICANT_DIGITS));

const traits = Object.fromEntries(
  MOLECULE_CATALOG.map((entry) => {
    const computed = computedMoleculeTraits(entry.name);
    return [
      entry.key,
      {
        massInDaltons: rounded(computed.massInDaltons),
        linear: computed.linear,
      },
    ];
  }),
);
writeFileSync(target, `${JSON.stringify({ traits }, null, 1)}\n`);
console.log(`${String(Object.keys(traits).length)} molecules`);
