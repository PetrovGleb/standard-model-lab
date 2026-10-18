/* SpeciesService: an in-memory index of every NUBASE2020 nucleus and every atom and ion with NIST data, searched by symbol, mass number, element name or charge in well under a millisecond. */
import { Injectable } from '@nestjs/common';
import {
  MATTER_DATA,
  atomName,
  defaultMassNumber,
  elementRecord,
  nucleusName,
} from '@standard-model/constants';
import type { SpeciesEntry, SpeciesKind, SpeciesSearchResponse } from '@standard-model/contracts';

const DEFAULT_LIMIT = 50;
const MAXIMUM_LIMIT = 500;

interface IndexedEntry {
  readonly entry: SpeciesEntry;
  readonly keys: readonly string[];
  readonly lifetimeRank: number;
}

function lifetimeRank(stable: boolean, abundance: number | null, halfLife: number | null): number {
  return stable
    ? Number.MAX_VALUE * Math.min(1, (abundance ?? 0) + Number.MIN_VALUE)
    : (halfLife ?? 0);
}

function chargeText(charge: number): string {
  return charge === 0 ? '' : charge === 1 ? '+' : `${String(charge)}+`;
}

function buildIndex(): readonly IndexedEntry[] {
  const nuclei = MATTER_DATA.nuclides
    .filter((nuclide) => nuclide.protons > 0)
    .map((nuclide): IndexedEntry => {
      const element = elementRecord(nuclide.protons);
      const mass = String(nuclide.massNumber);
      return {
        entry: {
          kind: 'nucleus',
          name: nucleusName(nuclide.protons, nuclide.massNumber),
          symbol: `${mass}${nuclide.symbol}`,
          elementName: element?.name ?? nuclide.symbol,
          protons: nuclide.protons,
          massNumber: nuclide.massNumber,
          charge: nuclide.protons,
          halfLifeText: nuclide.halfLifeText,
          stable: nuclide.stable,
          abundancePercent: nuclide.abundancePercent,
          spinParity: nuclide.spinParity,
        },
        lifetimeRank: lifetimeRank(
          nuclide.stable,
          nuclide.abundancePercent,
          nuclide.halfLifeInSeconds,
        ),
        keys: [
          `${nuclide.symbol}-${mass}`,
          `${mass}${nuclide.symbol}`,
          `${nuclide.symbol}${mass}`,
          element?.name ?? '',
          `z${String(nuclide.protons)}`,
        ].map((key) => key.toLowerCase()),
      };
    });
  const atoms = MATTER_DATA.elements.flatMap((element) => {
    const massNumber = defaultMassNumber(element.protons);
    const nuclide = MATTER_DATA.nuclides.find(
      (candidate) => candidate.protons === element.protons && candidate.massNumber === massNumber,
    );
    return element.stages
      .filter((stage) => stage.charge < element.protons)
      .map((stage): IndexedEntry => {
        const suffix = chargeText(stage.charge);
        return {
          entry: {
            kind: 'atom',
            name: atomName(element.protons, massNumber, stage.charge),
            symbol: `${element.symbol}${suffix}`,
            elementName: element.name,
            protons: element.protons,
            massNumber,
            charge: stage.charge,
            halfLifeText: nuclide?.halfLifeText ?? '',
            stable: nuclide?.stable ?? false,
            abundancePercent: nuclide?.abundancePercent ?? null,
            spinParity: stage.groundLevel,
          },
          lifetimeRank: Number.MAX_VALUE,
          keys: [
            `${element.symbol}${suffix}`,
            `${element.symbol}-${String(massNumber)}${suffix}`,
            element.name,
            `z${String(element.protons)}`,
          ].map((key) => key.toLowerCase()),
        };
      });
  });
  return [...atoms, ...nuclei];
}

@Injectable()
export class SpeciesService {
  private readonly index = buildIndex();

  search(query: string, kind: SpeciesKind | null, limit: number): SpeciesSearchResponse {
    const started = performance.now();
    const needle = query.trim().toLowerCase().replace(/\s+/g, '');
    const matches = this.index
      .filter((indexed) => kind === null || indexed.entry.kind === kind)
      .map((indexed) => {
        const exact = indexed.keys.some((key) => key === needle);
        const prefix = indexed.keys.some((key) => key.startsWith(needle));
        const contained = indexed.keys.some((key) => key.includes(needle));
        return { indexed, score: needle === '' ? 1 : exact ? 3 : prefix ? 2 : contained ? 1 : 0 };
      })
      .filter((match) => match.score > 0)
      .sort(
        (first, second) =>
          second.score - first.score ||
          first.indexed.entry.protons - second.indexed.entry.protons ||
          Number(second.indexed.entry.kind === 'atom') -
            Number(first.indexed.entry.kind === 'atom') ||
          second.indexed.lifetimeRank - first.indexed.lifetimeRank ||
          first.indexed.entry.massNumber - second.indexed.entry.massNumber ||
          first.indexed.entry.charge - second.indexed.entry.charge,
      );
    const capped = Math.min(Math.max(1, limit || DEFAULT_LIMIT), MAXIMUM_LIMIT);
    return {
      entries: matches.slice(0, capped).map((match) => match.indexed.entry),
      total: matches.length,
      elapsedMilliseconds: performance.now() - started,
    };
  }
}
