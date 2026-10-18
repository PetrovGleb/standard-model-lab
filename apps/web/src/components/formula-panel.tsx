/* FormulaPanel: the experiment's mathematical model and results rendered with KaTeX, with LaTeX copy and a standalone .tex download for publication. */
import type { ExperimentResult } from '@standard-model/contracts';
import { Copy } from 'lucide-react';
import { SmlIcon } from './sml-icon';
import { useMemo, useState } from 'react';
import { useMathRenderer } from './math';
import { experimentFormula, formulaDocument, formulaRows } from '../experiment-formula';
import { say, useLanguage } from '../language';

function download(name: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/x-tex' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name}.tex`;
  link.click();
  URL.revokeObjectURL(url);
}

export function FormulaPanel({ result }: { readonly result: ExperimentResult }) {
  const language = useLanguage();
  const formula = useMemo(() => experimentFormula(result), [result, language]);
  const mathRenderer = useMathRenderer();
  const render =
    mathRenderer === null
      ? null
      : (latex: string): string =>
          mathRenderer(`\\begin{gathered}${formulaRows(latex)}\\end{gathered}`);
  const [copied, setCopied] = useState(false);

  const source = formulaDocument(formula);

  return (
    <section className="card formula-panel">
      <div className="section-head">
        <h3
          data-tooltip={say(
            'Математическая модель прогона: что посчитано на каждом шаге и с какими значениями',
            'The mathematical model of the run: what was computed at each step and with which values',
          )}
        >
          <SmlIcon name="formula-latex" aria-hidden="true" size={18} />{' '}
          {say('Формула эксперимента', 'Experiment formula')}
        </h3>
        <div className="section-actions">
          <button
            type="button"
            className="small with-icon"
            data-tooltip={say(
              'Скопировать документ LaTeX целиком',
              'Copy the whole LaTeX document',
            )}
            onClick={() => {
              void navigator.clipboard.writeText(source).then(() => setCopied(true));
            }}
          >
            <Copy aria-hidden="true" size={16} />
            {copied ? say('Скопировано', 'Copied') : say('Копировать LaTeX', 'Copy LaTeX')}
          </button>
          <button
            type="button"
            className="small with-icon"
            data-tooltip={say(
              'Скачать самостоятельный .tex: компилируется pdflatex, кириллица через babel',
              'Download a standalone .tex: compiles with pdflatex, Cyrillic through babel',
            )}
            onClick={() => download(result.planName, source)}
          >
            <SmlIcon name="export" aria-hidden="true" size={16} />
            {say('Скачать .tex', 'Download .tex')}
          </button>
        </div>
      </div>
      {formula.sections.map((section) => (
        <div key={section.title} className="formula-section">
          <h4>{section.title}</h4>
          {section.lines.map((line, index) => (
            <figure key={index} className="formula-line">
              {render === null ? (
                <code>{line.latex}</code>
              ) : (
                <div
                  className="formula-math"
                  dangerouslySetInnerHTML={{ __html: render(line.latex) }}
                />
              )}
              <figcaption>{line.note}</figcaption>
            </figure>
          ))}
        </div>
      ))}
    </section>
  );
}
