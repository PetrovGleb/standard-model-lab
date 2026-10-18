/* Select: a dropdown over a known option list that keeps an unknown current value visible; labels and titles come from a glossary. */
interface Props {
  readonly value: string;
  readonly options: readonly string[];
  readonly onChange: (value: string) => void;
  readonly labels?: Readonly<Record<string, string>>;
  readonly titles?: Readonly<Record<string, string>>;
}

export function Select({ value, options, onChange, labels, titles }: Props) {
  const known = options.includes(value) || value === '' ? options : [value, ...options];
  return (
    <select
      value={value}
      data-tooltip={titles?.[value] ?? ''}
      onChange={(event) => onChange(event.target.value)}
    >
      {value === '' && <option value="">—</option>}
      {known.map((option) => (
        <option key={option} value={option} title={titles?.[option] ?? ''}>
          {labels?.[option] ?? option}
        </option>
      ))}
    </select>
  );
}
