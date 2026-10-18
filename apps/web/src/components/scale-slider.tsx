/* ScaleSlider: a logarithmic scale under numeric fields: decade ticks, real-world landmarks with their names, and one handle per value (a field, or every component of a medium) that can be dragged, clicked to or moved with the arrow keys. */
import type { ScaleLandmark } from '@standard-model/contracts';
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useElementSize } from '../hooks/use-element-size';
import { formatNumber } from '../format';
import { localize, say } from '../language';
import {
  HIDDEN_ROW,
  decadeTicks,
  labelRows,
  logScaleOf,
  nearestLandmark,
  scaleFraction,
  valueAtFraction,
} from '../scale';

export interface ScaleHandle {
  readonly value: number;
  readonly label?: string;
}

interface Props {
  readonly handles: readonly ScaleHandle[];
  readonly landmarks: readonly ScaleLandmark[];
  readonly unit: string;
  readonly onChange: (index: number, value: number) => void;
}

const FALLBACK_SIZE = { width: 520, height: 120 };
const SIDE_PADDING = 18;
const LABEL_ROWS = 3;
const ROW_HEIGHT = 15;
const TOP_PADDING = 12;
const LEADER_GAP = 6;
const TICK_HALF = 5;
const TICK_LABEL_OFFSET = 22;
const VALUE_LABEL_OFFSET = 36;
const BOTTOM_PADDING = 8;
const VALUE_ROW_HEIGHT = 14;
const CHARACTER_WIDTH = 6.8;
const PIXELS_PER_TICK = 70;
const HANDLE_RADIUS = 7;
const LANDMARK_RADIUS = 3.5;
const KEY_STEP_FRACTION = 0.02;
const SUPERSCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

function power(exponent: number): string {
  if (exponent === 0) {
    return '1';
  }
  const digits = String(Math.abs(exponent))
    .split('')
    .map((digit) => SUPERSCRIPTS[Number(digit)] ?? digit)
    .join('');
  return `10${exponent < 0 ? '⁻' : ''}${digits}`;
}

export function ScaleSlider({ handles, landmarks, unit, onChange }: Props) {
  const [{ width }, attach] = useElementSize(FALLBACK_SIZE);
  const dragged = useRef<number | null>(null);
  const [focused, setFocused] = useState(0);
  const positive = handles.map((handle) => handle.value).filter((value) => value > 0);
  const scale = logScaleOf(landmarks, positive.length === 0 ? undefined : Math.min(...positive));
  const widened = logScaleOf(landmarks, positive.length === 0 ? undefined : Math.max(...positive));
  const span = {
    lowExponent: Math.min(scale.lowExponent, widened.lowExponent),
    highExponent: Math.max(scale.highExponent, widened.highExponent),
  };
  const trackWidth = Math.max(1, width - 2 * SIDE_PADDING);
  const xOf = (fraction: number): number => SIDE_PADDING + fraction * trackWidth;
  const labels = landmarks.map((landmark) => localize(landmark.label));
  const centers = landmarks.map((landmark) => xOf(scaleFraction(landmark.value, span)));
  const labelWidths = labels.map((label) => label.length * CHARACTER_WIDTH);
  const labelCenters = centers.map((center, index) => {
    const half = (labelWidths[index] ?? 0) / 2;
    return Math.min(width - half, Math.max(half, center));
  });
  const rows = labelRows(labelCenters, labelWidths, LABEL_ROWS);
  const lineY = TOP_PADDING + LABEL_ROWS * ROW_HEIGHT + LEADER_GAP;
  const height =
    lineY + VALUE_LABEL_OFFSET + (handles.length > 1 ? VALUE_ROW_HEIGHT : 0) + BOTTOM_PADDING;
  const ticks = decadeTicks(span, Math.max(2, Math.floor(trackWidth / PIXELS_PER_TICK)));
  const single = handles.length === 1;
  const handleXs = handles.map((handle) => xOf(scaleFraction(handle.value, span)));
  const nearest = single ? nearestLandmark(handles[0]?.value ?? 0, landmarks) : undefined;
  const handleText = (handle: ScaleHandle): string =>
    `${handle.label === undefined ? '' : `${handle.label} `}${formatNumber(handle.value)}${single ? ` ${unit}` : ''}`;
  const fractionAt = (event: PointerEvent<SVGSVGElement>): number => {
    const box = event.currentTarget.getBoundingClientRect();
    return (event.clientX - box.left - SIDE_PADDING) / trackWidth;
  };
  const closestHandle = (x: number): number =>
    handleXs.reduce(
      (best, handleX, index) =>
        Math.abs(handleX - x) < Math.abs((handleXs[best] ?? 0) - x) ? index : best,
      0,
    );
  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>): void => {
    const direction =
      event.key === 'ArrowRight' || event.key === 'ArrowUp'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
          ? -1
          : 0;
    const handle = handles[focused];
    if (direction !== 0 && handle !== undefined) {
      event.preventDefault();
      onChange(
        focused,
        valueAtFraction(scaleFraction(handle.value, span) + direction * KEY_STEP_FRACTION, span),
      );
    }
    if (event.key === 'Tab' && !event.shiftKey && focused < handles.length - 1) {
      event.preventDefault();
      setFocused(focused + 1);
    }
  };

  return (
    <div className="scale" ref={attach} onClick={(event) => event.preventDefault()}>
      <svg
        width={width}
        height={height}
        role="slider"
        tabIndex={0}
        aria-label={say('Шкала значений', 'Value scale')}
        aria-valuenow={handles[focused]?.value}
        aria-valuetext={handles.map(handleText).join('; ')}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          const fraction = fractionAt(event);
          const index = closestHandle(xOf(fraction));
          dragged.current = index;
          setFocused(index);
          onChange(index, valueAtFraction(fraction, span));
        }}
        onPointerMove={(event) => {
          if (dragged.current !== null) {
            onChange(dragged.current, valueAtFraction(fractionAt(event), span));
          }
        }}
        onPointerUp={() => {
          dragged.current = null;
        }}
        onPointerCancel={() => {
          dragged.current = null;
        }}
      >
        <line className="scale-track" x1={xOf(0)} x2={xOf(1)} y1={lineY} y2={lineY} />
        {ticks.map((exponent) => {
          const x = xOf(scaleFraction(10 ** exponent, span));
          return (
            <g key={exponent} className="scale-decade">
              <line x1={x} x2={x} y1={lineY - TICK_HALF} y2={lineY + TICK_HALF} />
              <text x={x} y={lineY + TICK_LABEL_OFFSET} textAnchor="middle">
                {power(exponent)}
              </text>
            </g>
          );
        })}
        {landmarks.map((landmark, index) => {
          const x = centers[index] ?? 0;
          const row = rows[index] ?? HIDDEN_ROW;
          const labelY = TOP_PADDING + Math.max(row, 0) * ROW_HEIGHT;
          return (
            <g
              key={landmark.value}
              className={landmark === nearest ? 'scale-landmark current' : 'scale-landmark'}
              data-tooltip={`${labels[index] ?? ''}: ${formatNumber(landmark.value)} ${unit}`}
              onPointerDown={(event) => {
                event.stopPropagation();
                onChange(focused, landmark.value);
              }}
            >
              {row !== HIDDEN_ROW && (
                <line x1={x} x2={x} y1={labelY + 3} y2={lineY - LANDMARK_RADIUS} />
              )}
              <circle cx={x} cy={lineY} r={LANDMARK_RADIUS} />
              {row !== HIDDEN_ROW && (
                <text x={labelCenters[index] ?? x} y={labelY} textAnchor="middle">
                  {labels[index]}
                </text>
              )}
            </g>
          );
        })}
        {handles.map((handle, index) => {
          const handleX = handleXs[index] ?? 0;
          const text = handleText(handle);
          return (
            <g key={index} className={index === focused ? 'scale-handle focused' : 'scale-handle'}>
              <circle cx={handleX} cy={lineY} r={HANDLE_RADIUS} />
              <text
                x={handleX}
                y={lineY + VALUE_LABEL_OFFSET + (index % 2) * VALUE_ROW_HEIGHT}
                textAnchor={handleX < xOf(0.1) ? 'start' : handleX > xOf(0.9) ? 'end' : 'middle'}
              >
                {nearest === undefined ? text : `${text} · ${localize(nearest.label)}`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
