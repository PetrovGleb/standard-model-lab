/* Checks that every physical preset of the catalog has both languages: Russian text in Russian and no Cyrillic letter in English. */
import { textIn } from '@standard-model/contracts';
import { describe, expect, it } from 'vitest';
import { buildPresets } from '../src/catalog/presets.js';

const CYRILLIC = /[А-Яа-яЁё]/;

describe('catalog presets', () => {
  it('carries an English label and note for every preset', () => {
    const catalog = buildPresets();
    const presets = Object.values(catalog).flatMap((entry) =>
      Array.isArray(entry) ? entry : Object.values(entry).flat(),
    );
    expect(presets.length).toBeGreaterThan(100);
    const texts = presets.flatMap((preset) => [preset.label, preset.note]);
    expect(texts.filter((text) => CYRILLIC.test(textIn(text, 'en')))).toEqual([]);
    expect(texts.some((text) => CYRILLIC.test(textIn(text, 'ru')))).toBe(true);
  });
});
