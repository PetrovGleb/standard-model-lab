/* Subsection: a framed group of fields inside a card or an open step, with a tinted header strip that names the group and summarises its content so it reads without opening every field. */
import type { ReactNode } from 'react';
import type { IconComponent } from './sml-icon';

interface Props {
  readonly icon: IconComponent;
  readonly title: string;
  readonly summary?: string;
  readonly className?: string;
  readonly children: ReactNode;
}

export function Subsection({ icon, title, summary, className, children }: Props) {
  const Icon = icon;
  return (
    <section className={className === undefined ? 'subsection' : `subsection ${className}`}>
      <header className="subsection-head">
        <Icon aria-hidden="true" size={16} />
        <span>{title}</span>
        {summary !== undefined && summary !== '' && (
          <span className="subsection-summary">{summary}</span>
        )}
      </header>
      <div className="subsection-body">{children}</div>
    </section>
  );
}
