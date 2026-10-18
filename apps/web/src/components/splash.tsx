/* Splash: the opening animation laid over the app while it loads underneath. The mark assembles cell by cell, the wordmark slides out of it,
   then a slanted teal curtain drops over the screen and falls on down off it, uncovering the app; the splash then unmounts. */
import { useState, type AnimationEvent } from 'react';

const MARK_COLUMNS = 3;
const MARK_ROWS = 4;
const MARK_ORIGIN = 5;
const CELL_SIZE = 12;
const CELL_PITCH = 14;
const CELL_CORNER = 3;
const BOSON_RADIUS = 6;
const BOSON_CENTER_X = 53;
const CELL_STAGGER_MILLISECONDS = 45;
const FINAL_ANIMATIONS = new Set(['splash-curtain', 'splash-fade']);

const CELLS = Array.from({ length: MARK_ROWS * MARK_COLUMNS }, (unused, index) => ({
  row: Math.floor(index / MARK_COLUMNS),
  column: index % MARK_COLUMNS,
}));

const BOSONS = Array.from({ length: MARK_ROWS }, (unused, row) => row);

function delay(step: number): { readonly animationDelay: string } {
  return { animationDelay: `${String(step * CELL_STAGGER_MILLISECONDS)}ms` };
}

export function Splash() {
  const [visible, setVisible] = useState(true);
  if (!visible) {
    return null;
  }
  const finish = (event: AnimationEvent<HTMLDivElement>): void => {
    if (FINAL_ANIMATIONS.has(event.animationName)) {
      setVisible(false);
    }
  };
  return (
    <div className="splash" aria-hidden="true" onAnimationEnd={finish}>
      <div className="splash-backdrop">
        <div className="splash-logo">
          <svg className="splash-mark" viewBox="5 5 54 54">
            {CELLS.map(({ row, column }) => (
              <rect
                key={`${String(row)}-${String(column)}`}
                className="splash-cell"
                style={delay(row + column)}
                x={MARK_ORIGIN + column * CELL_PITCH}
                y={MARK_ORIGIN + row * CELL_PITCH}
                width={CELL_SIZE}
                height={CELL_SIZE}
                rx={CELL_CORNER}
              />
            ))}
            {BOSONS.map((row) => (
              <circle
                key={row}
                className="splash-boson"
                style={delay(MARK_COLUMNS + row)}
                cx={BOSON_CENTER_X}
                cy={MARK_ORIGIN + BOSON_RADIUS + row * CELL_PITCH}
                r={BOSON_RADIUS}
              />
            ))}
          </svg>
          <div className="splash-wordmark">
            <picture>
              <source
                srcSet="/brand/logo-horizontal-on-dark.svg"
                media="(prefers-color-scheme: dark)"
              />
              <img src="/brand/logo-horizontal-on-light.svg" alt="" />
            </picture>
          </div>
        </div>
      </div>
      <div className="splash-curtain" />
    </div>
  );
}
