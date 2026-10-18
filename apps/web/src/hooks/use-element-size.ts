/* useElementSize: the live pixel size of an element, so SVG drawings keep text at real pixel size and canvases know their viewport. */
import { useCallback, useState } from 'react';

export interface ElementSize {
  readonly width: number;
  readonly height: number;
}

export function useElementSize(
  fallback: ElementSize,
): readonly [ElementSize, (element: Element | null) => (() => void) | undefined] {
  const [size, setSize] = useState(fallback);
  const attach = useCallback((element: Element | null) => {
    if (element === null) {
      return undefined;
    }
    const measure = (width: number, height: number): void => {
      if (width > 0 && height > 0) {
        setSize((current) =>
          current.width === width && current.height === height ? current : { width, height },
        );
      }
    };
    const box = element.getBoundingClientRect();
    measure(box.width, box.height);
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) {
        measure(entry.contentRect.width, entry.contentRect.height);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [size, attach];
}
