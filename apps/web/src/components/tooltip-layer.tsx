/* TooltipLayer: one custom tooltip for every element carrying data-tooltip, shown 200 ms after hover or keyboard focus. */
import { useEffect, useState } from 'react';

const SHOW_DELAY_MS = 200;
const OFFSET_PX = 10;
const VIEWPORT_MARGIN_PX = 8;
const ESTIMATED_HEIGHT_PX = 72;

interface TooltipState {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly above: boolean;
}

function placement(target: Element): Omit<TooltipState, 'text'> {
  const rect = target.getBoundingClientRect();
  const above = rect.bottom + OFFSET_PX + ESTIMATED_HEIGHT_PX > window.innerHeight;
  const x = Math.min(
    Math.max(rect.left + rect.width / 2, VIEWPORT_MARGIN_PX),
    window.innerWidth - VIEWPORT_MARGIN_PX,
  );
  return { x, y: above ? rect.top - OFFSET_PX : rect.bottom + OFFSET_PX, above };
}

export function TooltipLayer() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    let timer: number | null = null;
    let current: Element | null = null;

    const hide = (): void => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
      current = null;
      setTooltip(null);
    };

    const schedule = (target: Element | null): void => {
      if (target === null) {
        hide();
        return;
      }
      if (target === current) {
        return;
      }
      hide();
      const text = target.getAttribute('data-tooltip');
      if (text === null || text === '') {
        return;
      }
      current = target;
      timer = window.setTimeout(() => setTooltip({ text, ...placement(target) }), SHOW_DELAY_MS);
    };

    const fromEvent = (event: Event): Element | null =>
      event.target instanceof Element ? event.target.closest('[data-tooltip]') : null;

    const onMouseOver = (event: MouseEvent): void => schedule(fromEvent(event));
    const onFocusIn = (event: FocusEvent): void => schedule(fromEvent(event));
    const onFocusOut = (): void => hide();
    const onMouseLeave = (): void => hide();
    const onMouseDown = (): void => hide();
    const onScroll = (): void => hide();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        hide();
      }
    };

    document.addEventListener('mouseover', onMouseOver);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    document.documentElement.addEventListener('mouseleave', onMouseLeave);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      hide();
      document.removeEventListener('mouseover', onMouseOver);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
      document.documentElement.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, []);

  if (tooltip === null) {
    return null;
  }
  return (
    <div
      className={tooltip.above ? 'tooltip above' : 'tooltip'}
      role="tooltip"
      style={{ left: tooltip.x, top: tooltip.y }}
    >
      {tooltip.text}
    </div>
  );
}
