/* ZoomToolbar: the zoom controls every canvas shares (the system stage, the plan schema): zoom out, the current percentage that resets to 100 %, zoom in, fit everything, and center without changing the zoom. */
import { Minus, Plus } from 'lucide-react';
import { say } from '../language';
import { SmlIcon } from './sml-icon';

const PERCENT = 100;
const ZOOM_STEP = 1.25;
const ZOOM_TOLERANCE = 1e-3;

interface Props {
  readonly zoom: number;
  readonly minimumZoom: number;
  readonly maximumZoom: number;
  readonly onZoomBy: (factor: number) => void;
  readonly onFit: () => void;
  readonly fitted: boolean;
  readonly onCenter?: () => void;
  readonly fitTooltip: string;
}

export function ZoomToolbar({
  zoom,
  minimumZoom,
  maximumZoom,
  onZoomBy,
  onFit,
  fitted,
  onCenter,
  fitTooltip,
}: Props) {
  return (
    <div className="zoom-toolbar" role="group" aria-label={say('Масштаб', 'Zoom')}>
      <button
        type="button"
        className="icon-button"
        aria-label={say('Уменьшить масштаб', 'Zoom out')}
        data-tooltip={say('Отдалить', 'Zoom out')}
        disabled={zoom <= minimumZoom + ZOOM_TOLERANCE}
        onClick={() => onZoomBy(1 / ZOOM_STEP)}
      >
        <Minus size={16} strokeWidth={2.25} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="zoom-level"
        aria-live="polite"
        data-tooltip={say(
          'Вернуть 100%. Щипок или ctrl + колесо меняют масштаб, перетаскивание двигает',
          'Back to 100%. A pinch or ctrl + wheel zooms, dragging moves',
        )}
        onClick={() => onZoomBy(1 / zoom)}
      >
        {Math.round(zoom * PERCENT)}%
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label={say('Увеличить масштаб', 'Zoom in')}
        data-tooltip={say('Приблизить', 'Zoom in')}
        disabled={zoom >= maximumZoom - ZOOM_TOLERANCE}
        onClick={() => onZoomBy(ZOOM_STEP)}
      >
        <Plus size={16} strokeWidth={2.25} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="zoom-fit"
        data-tooltip={fitTooltip}
        disabled={fitted}
        onClick={onFit}
      >
        {say('вписать', 'fit')}
      </button>
      {onCenter !== undefined && (
        <button
          type="button"
          className="icon-button"
          aria-label={say('По центру', 'Center')}
          data-tooltip={say(
            'Поставить по центру, не меняя масштаб',
            'Center without changing the zoom',
          )}
          onClick={onCenter}
        >
          <SmlIcon name="center-view" aria-hidden="true" size={18} />
        </button>
      )}
    </div>
  );
}
