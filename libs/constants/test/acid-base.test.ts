/* Checks the transcription of data/acid-base.json against its verbatim sources: the Ka of OpenStax Chemistry 2e Appendix H, the complete first ionization of sulfuric acid in §14.5, the King 1951
   glycine pK rows of the IUPAC digitized dataset, and that every system names a catalogue molecule whose sites carry the hydrogens the steps take away. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACID_BASE_SYSTEMS, stepNegativeLogarithm } from '../src/chemistry-data.js';
import { MOLECULE_CATALOG } from '../src/molecule-catalog.js';

const RELATIVE_PRECISION = 1e-12;
const HYDROGEN = 1;
const REFERENCE_TEMPERATURE_IN_CELSIUS = '25';
const APPENDIX_H = new URL(
  '../data/acid-base/openstax-chemistry-2e-appendix-h.html',
  import.meta.url,
);
const SECTION_POLYPROTIC = new URL(
  '../data/acid-base/openstax-chemistry-2e-14-5.html',
  import.meta.url,
);
const GLYCINE_ROWS = new URL('../data/acid-base/iupac-pka-v2-4-glycine.csv', import.meta.url);
const KA_TEXT = /(\d+(?:\.\d+)?)[\s×]+10\s*−(\d+)/;

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function appendixConstants(): Map<string, number[]> {
  const html = readFileSync(APPENDIX_H, 'utf8');
  const table = html.slice(html.indexOf('<table'), html.indexOf('</table>'));
  const constants = new Map<string, number[]>();
  let acid = '';
  table
    .split(/<tr[\s>]/)
    .slice(1)
    .forEach((row) => {
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((cell) =>
        text(cell[1] ?? ''),
      );
      if (row.includes('rowspan') || cells.length > 3) {
        acid = cells[0] ?? '';
      }
      const match = KA_TEXT.exec(cells.join(' '));
      if (match !== null) {
        constants.set(acid, [
          ...(constants.get(acid) ?? []),
          Number(match[1]) * 10 ** -Number(match[2]),
        ]);
      }
    });
  return constants;
}

function csvFields(line: string): string[] {
  return [...line.matchAll(/("(?:[^"]|"")*"|[^,]*)(?:,|$)/g)]
    .map((match) => (match[1] ?? '').replace(/^"|"$/g, '').replace(/""/g, '"'))
    .slice(0, -1);
}

describe('acid–base data', () => {
  it('copies the Ka of OpenStax Appendix H and the complete first step of sulfuric acid', () => {
    const constants = appendixConstants();
    const openStax = ACID_BASE_SYSTEMS.filter((system) => constants.has(system.reference));
    expect(openStax.map((system) => system.molecule).sort()).toEqual(
      ['aceticAcid', 'formicAcid', 'phosphoricAcid', 'sulfuricAcid'].sort(),
    );
    openStax.forEach((system) => {
      const tabulated = constants.get(system.reference) ?? [];
      const written = system.steps.flatMap((step) =>
        step.complete === true ? [] : [step.acidConstant ?? 0],
      );
      expect(written.length).toBe(tabulated.length);
      written.forEach((value, index) =>
        expect(Math.abs(value / (tabulated[index] ?? 1) - 1)).toBeLessThan(RELATIVE_PRECISION),
      );
    });
    expect(text(readFileSync(SECTION_POLYPROTIC, 'utf8'))).toContain('complete dissociation');
    expect(stepNegativeLogarithm({ site: 0, complete: true })).toBe(Number.NEGATIVE_INFINITY);
  });

  it('copies the King 1951 glycine constants at 25 °C', () => {
    const [header = '', ...rows] = readFileSync(GLYCINE_ROWS, 'utf8').trimEnd().split('\n');
    const columns = csvFields(header);
    const field = (row: string[], name: string): string => row[columns.indexOf(name)] ?? '';
    const king = rows
      .map(csvFields)
      .filter(
        (row) =>
          field(row, 'ref') === 'K26' && field(row, 'T') === REFERENCE_TEMPERATURE_IN_CELSIUS,
      );
    const value = (type: string): number =>
      Number(field(king.find((row) => field(row, 'pka_type') === type) ?? [], 'pka_value'));
    const glycine = ACID_BASE_SYSTEMS.find((system) => system.molecule === 'glycine');
    expect(glycine?.steps.map((step) => step.negativeLogarithm)).toEqual([
      value('pKaH1'),
      value('pKa1'),
    ]);
  });

  it('names catalogue molecules and sites that hold the hydrogens the steps take', () => {
    ACID_BASE_SYSTEMS.forEach((system) => {
      const entry = MOLECULE_CATALOG.find((molecule) => molecule.key === system.molecule);
      expect(entry).toBeDefined();
      const hydrogens = (site: number): number =>
        (entry?.structure.bonds ?? []).filter((bond) => {
          const other = bond.first === site ? bond.second : bond.second === site ? bond.first : -1;
          return other >= 0 && entry?.structure.atoms[other]?.protons === HYDROGEN;
        }).length;
      const taken = new Map<number, number>();
      system.steps.forEach((step) => taken.set(step.site, (taken.get(step.site) ?? 0) + 1));
      taken.forEach((count, site) =>
        expect(
          hydrogens(site) + system.protonatedSites.filter((added) => added === site).length,
        ).toBeGreaterThanOrEqual(count),
      );
      system.steps.forEach((step) =>
        expect(
          [step.complete === true, step.acidConstant, step.negativeLogarithm].filter(
            (value) => value !== undefined && value !== false,
          ).length,
        ).toBe(1),
      );
    });
  });
});
