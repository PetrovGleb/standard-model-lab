/* Generates data/pdf/nnpdf23-lo-qed.generated.json from the verbatim LHAPDF lhagrid1 files of NNPDF2.3 LO QED, member 0: x and Q grids, flavours, x·f values and the alpha_s table. Run with pnpm generate:pdf. */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SET_NAME = 'NNPDF23_lo_as_0130_qed';
const MEMBER = '0000';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const setDirectory = join(packageRoot, 'data', 'pdf', SET_NAME);
const info = readFileSync(join(setDirectory, `${SET_NAME}.info`), 'utf8');
const grid = readFileSync(join(setDirectory, `${SET_NAME}_${MEMBER}.dat`), 'utf8');

function infoField(name: string): string {
  const line = info.split('\n').find((entry) => entry.startsWith(`${name}:`));
  if (line === undefined) {
    throw new Error(`${name} is missing in the .info file`);
  }
  return line.slice(name.length + 1).trim();
}

function numberList(text: string): number[] {
  return text
    .replace(/[[\]]/g, '')
    .split(/[\s,]+/)
    .filter((token) => token !== '')
    .map(Number);
}

const blocks = grid
  .split('---')
  .slice(1)
  .filter((block) => block.trim() !== '');
if (blocks.length !== 1) {
  throw new Error(`Expected one subgrid, found ${String(blocks.length)}`);
}
const [block] = blocks;
const lines = (block ?? '')
  .trim()
  .split('\n')
  .filter((line) => line.trim() !== '');
const [xLine, qLine, flavorLine, ...rows] = lines;
const xKnots = numberList(xLine ?? '');
const qKnots = numberList(qLine ?? '');
const flavors = numberList(flavorLine ?? '');
if (rows.length !== xKnots.length * qKnots.length) {
  throw new Error(
    `Expected ${String(xKnots.length * qKnots.length)} rows, found ${String(rows.length)}`,
  );
}
const values = rows.flatMap((row) => {
  const columns = numberList(row);
  if (columns.length !== flavors.length) {
    throw new Error('Row width does not match the flavour list');
  }
  return columns;
});

const output = {
  set: SET_NAME,
  member: Number(MEMBER),
  description: infoField('SetDesc').replace(/^"|"$/g, ''),
  authors: infoField('Authors'),
  reference:
    'R. D. Ball et al. (NNPDF Collaboration), Nucl. Phys. B 877 (2013) 290, arXiv:1308.0598',
  source: `https://lhapdfsets.web.cern.ch/current/${SET_NAME}.tar.gz, files ${SET_NAME}.info and ${SET_NAME}_${MEMBER}.dat copied verbatim`,
  layout: 'values[(xIndex * qs.length + qIndex) * flavors.length + flavorIndex] = x * f(x, Q)',
  hadronPdgId: Number(infoField('Particle')),
  xs: xKnots,
  qsInGev: qKnots,
  flavors,
  values,
  alphaS: {
    zMassInGev: Number(infoField('MZ')),
    valueAtZMass: Number(infoField('AlphaS_MZ')),
    qsInGev: numberList(infoField('AlphaS_Qs')),
    values: numberList(infoField('AlphaS_Vals')),
  },
};

writeFileSync(
  join(packageRoot, 'data', 'pdf', 'nnpdf23-lo-qed.generated.json'),
  `${JSON.stringify(output)}\n`,
);
console.log(
  `wrote ${String(xKnots.length)} x ${String(qKnots.length)} x ${String(flavors.length)} grid values`,
);
