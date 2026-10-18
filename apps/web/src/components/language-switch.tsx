/* LanguageSwitch: the RU / EN segmented control in the header that switches the whole interface. */
import { LANGUAGES, type Language } from '@standard-model/contracts';
import { say } from '../language';

interface Props {
  readonly language: Language;
  readonly onChange: (language: Language) => void;
}

export function LanguageSwitch({ language, onChange }: Props) {
  return (
    <div
      className="language-switch"
      role="group"
      aria-label={say('Язык интерфейса', 'Interface language')}
      data-tooltip={say('Язык интерфейса', 'Interface language')}
    >
      {LANGUAGES.map((candidate) => (
        <button
          key={candidate}
          type="button"
          className={candidate === language ? 'active' : undefined}
          aria-pressed={candidate === language}
          onClick={() => onChange(candidate)}
        >
          {candidate.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
