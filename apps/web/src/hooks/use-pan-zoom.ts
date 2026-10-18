/* usePanZoom: shared camera gestures for canvases (the system stage, the plan schema): drag to pan once the pointer travels past a threshold so clicks still reach the content, two-finger pinch or ctrl-wheel to zoom at the cursor, and a wheel that pans the canvas while it can move and scrolls the page when it cannot. */
import {
  useCallback,
  useRef,
  type MouseEvent,
  type MutableRefObject,
  type PointerEvent,
} from 'react';
import { zoomedAt, type StageView, type StageViewport } from '../system-stage';

const DRAG_THRESHOLD_IN_PIXELS = 4;
const PINCH_ZOOM_RATE = 0.01;
const MOVE_TOLERANCE = 1e-6;

export type WheelPanning = 'horizontal' | 'both';

interface Options {
  readonly viewRef: MutableRefObject<StageView>;
  readonly viewport: StageViewport;
  readonly move: (view: StageView) => StageView;
  readonly wheel: WheelPanning;
}

interface PointerPosition {
  readonly x: number;
  readonly y: number;
}

function moved(before: StageView, after: StageView): boolean {
  return (
    Math.abs(before.zoom - after.zoom) > MOVE_TOLERANCE ||
    Math.abs(before.panX - after.panX) > MOVE_TOLERANCE ||
    Math.abs(before.panY - after.panY) > MOVE_TOLERANCE
  );
}

export function usePanZoom({ viewRef, viewport, move, wheel }: Options) {
  const latest = useRef({ viewport, move, wheel });
  latest.current = { viewport, move, wheel };
  const pointers = useRef(new Map<number, PointerPosition>());
  const travelled = useRef(0);
  const dragging = useRef(false);

  const attachWheel = useCallback(
    (element: HTMLElement | null) => {
      if (element === null) {
        return undefined;
      }
      const onWheel = (event: WheelEvent): void => {
        const options = latest.current;
        const bounds = element.getBoundingClientRect();
        const current = viewRef.current;
        if (event.ctrlKey) {
          event.preventDefault();
          options.move(
            zoomedAt(
              current,
              Math.exp(-event.deltaY * PINCH_ZOOM_RATE),
              (event.clientX - bounds.left) / bounds.width,
              (event.clientY - bounds.top) / bounds.height,
              options.viewport,
            ),
          );
          return;
        }
        const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
        if (options.wheel === 'horizontal' && !horizontal) {
          return;
        }
        const unitsPerPixel = options.viewport.width / current.zoom / bounds.width;
        const after = options.move({
          ...current,
          panX: current.panX + event.deltaX * unitsPerPixel,
          panY:
            options.wheel === 'both' ? current.panY + event.deltaY * unitsPerPixel : current.panY,
        });
        if (moved(current, after)) {
          event.preventDefault();
        }
      };
      element.addEventListener('wheel', onWheel, { passive: false });
      return () => element.removeEventListener('wheel', onWheel);
    },
    [viewRef],
  );

  const onPointerDown = (event: PointerEvent<HTMLElement>): void => {
    if (pointers.current.size === 0) {
      travelled.current = 0;
      dragging.current = false;
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>): void => {
    const last = pointers.current.get(event.pointerId);
    if (last === undefined) {
      return;
    }
    const other = [...pointers.current].find(([pointerId]) => pointerId !== event.pointerId)?.[1];
    travelled.current += Math.hypot(event.clientX - last.x, event.clientY - last.y);
    if (!dragging.current && other === undefined && travelled.current < DRAG_THRESHOLD_IN_PIXELS) {
      return;
    }
    if (!dragging.current) {
      dragging.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const options = latest.current;
    const bounds = event.currentTarget.getBoundingClientRect();
    const current = viewRef.current;
    if (other === undefined) {
      const unitsPerPixel = options.viewport.width / current.zoom / bounds.width;
      options.move({
        ...current,
        panX: current.panX - (event.clientX - last.x) * unitsPerPixel,
        panY: current.panY - (event.clientY - last.y) * unitsPerPixel,
      });
    } else {
      options.move(
        zoomedAt(
          current,
          Math.hypot(event.clientX - other.x, event.clientY - other.y) /
            Math.max(1, Math.hypot(last.x - other.x, last.y - other.y)),
          ((event.clientX + other.x) / 2 - bounds.left) / bounds.width,
          ((event.clientY + other.y) / 2 - bounds.top) / bounds.height,
          options.viewport,
        ),
      );
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };

  const onPointerEnd = (event: PointerEvent<HTMLElement>): void => {
    pointers.current.delete(event.pointerId);
  };

  const onClickCapture = (event: MouseEvent<HTMLElement>): void => {
    if (dragging.current) {
      event.stopPropagation();
      event.preventDefault();
      dragging.current = false;
    }
  };

  const zoomBy = (factor: number): StageView =>
    latest.current.move(zoomedAt(viewRef.current, factor, 0.5, 0.5, latest.current.viewport));

  return {
    attachWheel,
    zoomBy,
    gestures: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onClickCapture,
    },
  };
}
