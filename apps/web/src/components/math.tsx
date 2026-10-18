/* Math: lazily loaded KaTeX shared by the formula panel and the Lagrangian page; shows the LaTeX source until the renderer arrives. */
import 'katex/dist/katex.min.css';
import { useEffect, useState } from 'react';

export type MathRenderer = (latex: string, display?: boolean) => string;

export function useMathRenderer(): MathRenderer | null {
  const [render, setRender] = useState<MathRenderer | null>(null);
  useEffect(() => {
    let active = true;
    void import('katex').then(({ default: katex }) => {
      if (active) {
        setRender(
          () =>
            (latex: string, display = true) =>
              katex.renderToString(latex, {
                displayMode: display,
                throwOnError: false,
                strict: 'ignore',
              }),
        );
      }
    });
    return () => {
      active = false;
    };
  }, []);
  return render;
}

export function MathBlock({
  latex,
  render,
  display = true,
}: {
  readonly latex: string;
  readonly render: MathRenderer | null;
  readonly display?: boolean;
}) {
  if (render === null) {
    return <code>{latex}</code>;
  }
  return display ? (
    <div className="formula-math" dangerouslySetInnerHTML={{ __html: render(latex, true) }} />
  ) : (
    <span dangerouslySetInnerHTML={{ __html: render(latex, false) }} />
  );
}
