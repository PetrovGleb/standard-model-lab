/* Generates src/codata.generated.ts from data/codata2022.json: one typed, named Quantity per CODATA entry. Run with pnpm generate:codata. */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toConstantName } from '../src/constant-name.js';

interface CodataEntry {
  readonly name: string;
  readonly value: number;
  readonly uncertainty: number | null;
  readonly exact: boolean;
  readonly unit: string;
}

interface CodataFile {
  readonly source: string;
  readonly count: number;
  readonly constants: readonly CodataEntry[];
}

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const inputPath = join(packageRoot, 'data', 'codata2022.json');
const outputPath = join(packageRoot, 'src', 'codata.generated.ts');

const codata = JSON.parse(readFileSync(inputPath, 'utf8')) as CodataFile;

const seenNames = new Map<string, string>();

function renderEntry(entry: CodataEntry): string {
  const constantName = toConstantName(entry.name);
  const clash = seenNames.get(constantName);
  if (clash !== undefined) {
    throw new Error(
      `Constant name ${constantName} produced by both "${clash}" and "${entry.name}"`,
    );
  }
  seenNames.set(constantName, entry.name);
  return [
    `export const ${constantName}: Quantity = {`,
    `  value: ${String(entry.value)},`,
    `  uncertainty: ${entry.uncertainty === null ? 'null' : String(entry.uncertainty)},`,
    `  exact: ${String(entry.exact)},`,
    `  unit: ${JSON.stringify(entry.unit)},`,
    `  source: 'CODATA2022',`,
    `  sourceName: ${JSON.stringify(entry.name)},`,
    `};`,
  ].join('\n');
}

const header = `/* Generated from data/codata2022.json by scripts/generate-codata.ts. Do not edit by hand; run pnpm generate:codata. */`;
const body = codata.constants.map(renderEntry).join('\n\n');
const footer = `export const CODATA_CONSTANT_COUNT = ${String(codata.constants.length)};`;

writeFileSync(
  outputPath,
  `${header}\nimport type { Quantity } from '@standard-model/contracts';\n\n${body}\n\n${footer}\n`,
);

console.log(`Wrote ${String(codata.constants.length)} constants to ${outputPath}`);
