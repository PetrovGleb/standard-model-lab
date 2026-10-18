/* PlanSchema: the plan diagram on a pan-and-zoom canvas shared with the system stage: it opens fitted to the width and aligned to the top, drags and pinches like the stage, scrolls with the wheel while it can move, and brings the active step into view. */
import type {
  ElementEntry,
  MoleculeCatalogEntry,
  ExperimentPlan,
  ParticleCatalogEntry,
} from '@standard-model/contracts';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useElementSize } from '../hooks/use-element-size';
import { usePanZoom } from '../hooks/use-pan-zoom';
import { say } from '../language';
import { speciesSymbolResolver } from '../species';
import type { StageView, StageViewport } from '../system-stage';
import { PlanDiagram, diagramLayout, diagramRowCenter, diagramSize } from './plan-diagram';
import { ZoomToolbar } from './zoom-toolbar';

const MINIMUM_ZOOM = 0.2;
const MAXIMUM_ZOOM = 3;
const PAN_MARGIN = 40;
const FALLBACK_SIZE = { width: 400, height: 480 };
const ROW_VISIBILITY_MARGIN = 60;

interface Props {
  readonly plan: ExperimentPlan;
  readonly particles: readonly ParticleCatalogEntry[];
  readonly elements: readonly ElementEntry[];
  readonly molecules?: readonly MoleculeCatalogEntry[] | undefined;
  readonly activeRow?: number | null;
  readonly onSelect?: (row: number) => void;
}

interface Camera extends StageView {
  readonly follow: boolean;
}

export function PlanSchema({
  plan,
  particles,
  elements,
  molecules,
  activeRow = null,
  onSelect,
}: Props) {
  const layout = useMemo(
    () => diagramLayout(plan, particles, elements),
    [plan, particles, elements],
  );
  const symbolOf = useMemo(
    () => speciesSymbolResolver({ particles, elements, molecules }),
    [particles, elements, molecules],
  );
  const content = diagramSize(layout);
  const [size, attachSize] = useElementSize(FALLBACK_SIZE);
  const [camera, setCamera] = useState<Camera>({ zoom: 1, panX: 0, panY: 0, follow: true });
  const viewport: StageViewport = {
    width: size.width,
    height: size.height,
    minimumZoom: MINIMUM_ZOOM,
    maximumZoom: MAXIMUM_ZOOM,
  };

  const clamp = (next: StageView): StageView => {
    const viewWidth = size.width / next.zoom;
    const viewHeight = size.height / next.zoom;
    const desiredLeft = size.width / 2 + next.panX - viewWidth / 2;
    const desiredTop = size.height / 2 + next.panY - viewHeight / 2;
    const left =
      content.width <= viewWidth
        ? (content.width - viewWidth) / 2
        : Math.min(content.width - viewWidth + PAN_MARGIN, Math.max(-PAN_MARGIN, desiredLeft));
    const top =
      content.height <= viewHeight
        ? 0
        : Math.min(content.height - viewHeight + PAN_MARGIN, Math.max(-PAN_MARGIN, desiredTop));
    return {
      zoom: next.zoom,
      panX: left + viewWidth / 2 - size.width / 2,
      panY: top + viewHeight / 2 - size.height / 2,
    };
  };
  const fitted = clamp({
    zoom: Math.min(1, Math.max(MINIMUM_ZOOM, size.width / content.width)),
    panX: Number.NEGATIVE_INFINITY,
    panY: Number.NEGATIVE_INFINITY,
  });
  const view: StageView = camera.follow ? fitted : clamp(camera);
  const viewRef = useRef<StageView>(view);
  viewRef.current = view;
  const move = (next: StageView): StageView => {
    const moved = clamp(next);
    viewRef.current = moved;
    setCamera({ ...moved, follow: false });
    return moved;
  };
  const panZoom = usePanZoom({ viewRef, viewport, move, wheel: 'both' });

  const viewWidth = size.width / view.zoom;
  const viewHeight = size.height / view.zoom;
  const viewLeft = size.width / 2 + view.panX - viewWidth / 2;
  const viewTop = size.height / 2 + view.panY - viewHeight / 2;

  const moveRef = useRef(move);
  moveRef.current = move;
  useEffect(() => {
    if (activeRow === null) {
      return;
    }
    const current = viewRef.current;
    const height = size.height / current.zoom;
    const top = size.height / 2 + current.panY - height / 2;
    const center = diagramRowCenter(activeRow);
    if (center < top + ROW_VISIBILITY_MARGIN || center > top + height - ROW_VISIBILITY_MARGIN) {
      moveRef.current({ ...current, panY: center - size.height / 2 });
    }
  }, [activeRow, size.height]);

  return (
    <div className="schema-canvas-frame">
      <ZoomToolbar
        zoom={view.zoom}
        minimumZoom={MINIMUM_ZOOM}
        maximumZoom={MAXIMUM_ZOOM}
        onZoomBy={(factor) => {
          panZoom.zoomBy(factor);
        }}
        onFit={() => setCamera({ ...camera, follow: true })}
        fitted={camera.follow}
        fitTooltip={say('Уместить схему по ширине', 'Fit the schema to the width')}
      />
      <div
        className="schema-canvas"
        ref={(element) => {
          const detachSize = attachSize(element);
          const detachWheel = panZoom.attachWheel(element);
          return () => {
            detachSize?.();
            detachWheel?.();
          };
        }}
        {...panZoom.gestures}
      >
        <PlanDiagram
          plan={plan}
          layout={layout}
          activeRow={activeRow}
          onSelect={onSelect}
          symbolOf={symbolOf}
          viewBox={[viewLeft, viewTop, viewWidth, viewHeight]}
        />
      </div>
    </div>
  );
}
