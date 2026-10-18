/* EnvironmentLayer: every environment of a frame as an envelope around the particles it acts on, the shared one around all and regions around their members, nested by inclusion and cut into
   runs that share a badge; a legend of aspects sits on the border, gas dots drift faster the hotter the gas, and gas atoms fly into a particle that reacted with the gas in this frame. */
import type { SystemFrame } from '@standard-model/contracts';
import {
  environmentVisual,
  gasDotCount,
  gasDriftSeconds,
  type SymbolOf,
} from '../influence-visual';
import { say } from '../language';
import type { EnvelopeBox, StageNode } from '../system-stage';
import { SmlIcon } from './sml-icon';

const LEGEND_INDENT = 18;
const CHIP_HEIGHT = 22;
const CHIP_GAP = 6;
const CHIP_ICON = 14;
const CHIP_PADDING = 8;
const CAPTION_CHARACTER_WIDTH = 6.6;
const BADGE_WIDTH = 18;
const DOT_INSET = 14;
const GOLDEN_RATIO = 0.618034;
const DOT_SCATTER = 7;
const EXCHANGE_DOTS = 3;
const EXCHANGE_SPREAD = 26;
const EXCHANGE_SECONDS = 0.9;

interface Props {
  readonly frame: SystemFrame;
  readonly boxes: readonly EnvelopeBox[];
  readonly nodes: readonly StageNode[];
  readonly badges: ReadonlyMap<string, number>;
  readonly frameIndex: number;
  readonly symbolOf: SymbolOf;
}

function chipWidth(caption: string, badged: boolean): number {
  return (
    CHIP_PADDING * 3 +
    CHIP_ICON +
    caption.length * CAPTION_CHARACTER_WIDTH +
    (badged ? BADGE_WIDTH : 0)
  );
}

function legendOf(
  box: EnvelopeBox,
  badges: ReadonlyMap<string, number>,
  symbolOf: SymbolOf = (name) => name,
) {
  const visuals = box.run.envelope.aspects.map((aspect) => ({
    ...environmentVisual(aspect.aspect, aspect.value, symbolOf),
    badge: badges.get(aspect.signature),
    aspect,
  }));
  const widths = visuals.map((visual) => chipWidth(visual.caption, visual.badge !== undefined));
  const row = widths.reduce((sum, width) => sum + width, 0) + CHIP_GAP * (widths.length - 1);
  const start = Math.min(box.left + LEGEND_INDENT, box.right - LEGEND_INDENT - row);
  const chips = visuals.map((visual, index) => ({
    ...visual,
    width: widths[index] ?? 0,
    x: start + widths.slice(0, index).reduce((sum, width) => sum + width + CHIP_GAP, 0),
  }));
  return { visuals, chips, left: start, right: start + row };
}

export function legendExtent(
  box: EnvelopeBox,
  badges: ReadonlyMap<string, number>,
): { readonly left: number; readonly right: number } {
  const { left, right } = legendOf(box, badges);
  return { left, right };
}

function inside(
  pointX: number,
  pointY: number,
  box: Pick<EnvelopeBox, 'left' | 'right' | 'top' | 'bottom'>,
) {
  return pointX > box.left && pointX < box.right && pointY > box.top && pointY < box.bottom;
}

export function EnvironmentLayer({ frame, boxes, nodes, badges, frameIndex, symbolOf }: Props) {
  const reacted = new Set(
    frame.events
      .filter((event) => event.kind === 'reacted')
      .flatMap((event) => event.products ?? []),
  );
  return (
    <g className="environment-layer">
      {boxes.map((box) => {
        const { envelope } = box.run;
        const { visuals, chips } = legendOf(box, badges, symbolOf);
        const medium = envelope.aspects.find((aspect) => aspect.aspect === 'medium');
        const tone =
          visuals.find((visual) => visual.aspect.aspect === 'medium')?.tone ??
          visuals[0]?.tone ??
          'influence';
        const width = box.right - box.left;
        const height = box.bottom - box.top;
        const dots = medium === undefined || medium.value === null ? 0 : gasDotCount(medium.value);
        const drift = medium === undefined ? 0 : gasDriftSeconds(medium.value);
        const who = envelope.shared
          ? say('на всю систему', 'on the whole system')
          : box.run.members.join(', ');
        const replaced = boxes.filter(
          (other) =>
            other !== box &&
            other.run.envelope.depth < envelope.depth &&
            other.run.envelope.aspects.some((aspect) => aspect.aspect === 'medium') &&
            other.run.members.every((label) => box.run.members.includes(label)),
        );
        const targets =
          medium === undefined
            ? []
            : nodes.filter(
                (node) =>
                  !node.leaving &&
                  node.members.some((member) => reacted.has(member)) &&
                  box.run.members.includes(node.label),
              );
        return (
          <g
            key={`${envelope.key}#${String(box.run.first)}`}
            className={`environment-envelope tone-${tone}${envelope.shared ? ' shared' : ''}`}
            data-tooltip={say(
              `Окружение: ${visuals.map((visual) => visual.detail).join('; ')}. Действует ${who}`,
              `Environment: ${visuals.map((visual) => visual.detail).join('; ')}. Acts ${who}`,
            )}
          >
            <rect
              className="envelope-area"
              x={box.left}
              y={box.top}
              width={width}
              height={height}
              rx={26}
            />
            {Array.from({ length: dots }, (unused, index) => ({
              index,
              cx: box.left + DOT_INSET + ((index * GOLDEN_RATIO) % 1) * (width - 2 * DOT_INSET),
              cy:
                box.top +
                DOT_INSET +
                ((index * GOLDEN_RATIO * GOLDEN_RATIO * DOT_SCATTER) % 1) *
                  (height - 2 * DOT_INSET),
            }))
              .filter((dot) => !replaced.some((other) => inside(dot.cx, dot.cy, other)))
              .map((dot) => (
                <circle
                  key={dot.index}
                  className="envelope-gas"
                  r={2.2}
                  cx={dot.cx}
                  cy={dot.cy}
                  style={{
                    animationDuration: `${String(drift)}s`,
                    animationDelay: `${String(-((dot.index * GOLDEN_RATIO) % 1) * drift)}s`,
                  }}
                />
              ))}
            {targets.flatMap((node) =>
              Array.from({ length: EXCHANGE_DOTS }, (unused, index) => {
                const fromX = node.x + (index - 1) * EXCHANGE_SPREAD;
                return (
                  <circle
                    key={`${String(frameIndex)}-${node.key}-${String(index)}`}
                    className="envelope-exchange"
                    r={3.2}
                    cx={node.x}
                    cy={node.y}
                  >
                    <animate
                      attributeName="cx"
                      from={fromX}
                      to={node.x}
                      dur={`${String(EXCHANGE_SECONDS)}s`}
                      fill="freeze"
                    />
                    <animate
                      attributeName="cy"
                      from={box.top}
                      to={node.y}
                      dur={`${String(EXCHANGE_SECONDS)}s`}
                      fill="freeze"
                    />
                    <animate
                      attributeName="opacity"
                      from="1"
                      to="0"
                      dur={`${String(EXCHANGE_SECONDS)}s`}
                      fill="freeze"
                    />
                  </circle>
                );
              }),
            )}
            {chips.map((chip) => (
              <g
                key={chip.aspect.aspect}
                className="envelope-chip"
                transform={`translate(${String(chip.x)} ${String(box.top - CHIP_HEIGHT / 2)})`}
              >
                <rect width={chip.width} height={CHIP_HEIGHT} rx={CHIP_HEIGHT / 2} />
                <SmlIcon
                  name={chip.icon}
                  x={CHIP_PADDING}
                  y={(CHIP_HEIGHT - CHIP_ICON) / 2}
                  size={CHIP_ICON}
                />
                <text x={CHIP_PADDING * 2 + CHIP_ICON} y={CHIP_HEIGHT / 2 + 4}>
                  {chip.caption}
                </text>
                {chip.badge !== undefined && (
                  <text
                    className="envelope-badge"
                    x={chip.width - CHIP_PADDING - BADGE_WIDTH / 2}
                    y={CHIP_HEIGHT / 2 + 4}
                    textAnchor="middle"
                  >
                    {chip.badge}
                  </text>
                )}
              </g>
            ))}
          </g>
        );
      })}
    </g>
  );
}
