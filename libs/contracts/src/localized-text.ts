/* Text shipped in both interface languages: the engine and the API send Russian and English together (texts and errors) and the web client shows the one the user picked. */
export type Language = 'ru' | 'en';

export const LANGUAGES: readonly Language[] = ['ru', 'en'];

export interface LocalizedText {
  readonly ru: string;
  readonly en: string;
}

export function localizedText(russian: string, english: string): LocalizedText {
  return { ru: russian, en: english };
}

export class LocalizedError extends Error {
  constructor(readonly text: LocalizedText) {
    super(text.ru === text.en ? text.en : `${text.ru} / ${text.en}`);
  }
}

export function languageFrom(value: unknown): Language {
  return value === 'en' ? 'en' : 'ru';
}

export function textIn(text: LocalizedText | string, language: Language): string {
  return typeof text === 'string' ? text : text[language];
}
