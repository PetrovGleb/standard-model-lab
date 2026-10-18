/* InfluenceZone: on the system stage an influence step tints the area around the particles it acts on, sends its agent into that area (photon waves by spectral band, counter-propagating laser beams, field arrows, gas dots, a warm or cold bath), pulses the absorbers and names itself in a pill under the area. */
import type { InfluenceStep } from '@standard-model/contracts';
import { INFLUENCE_GLOSSARY } from '../glossary';
import { influenceVisual } from '../influence-visual';
import { nodeRadius, type StageNode } from '../system-stage';
import { SmlIcon } from './sml-icon';
import { say } from '../language';

const ZONE_MARGIN_X = 70;
const ZONE_ABOVE = 74;
const ZONE_BELOW = 82;
const STAGE_INSET = 14;
const PILL_GAP = 10;
const PILL_HEIGHT = 30;
const PILL_ICON = 20;
const PILL_PADDING = 12;
const CAPTION_CHARACTER_WIDTH = 7.3;
const WAVE_ROWS = [-30, 0, 30];
const WAVE_AMPLITUDE = 5;
const WAVE_SAMPLES = 90;
const ARROW_SIZE = 7;
const DASHED_WAVE_LENGTH = 26;
const PULSE_GAP = 10;
const FIELD_SPACING = 54;
const GAS_DOTS = 28;
const GOLDEN_RATIO = 0.618034;

interface Props {
  readonly step: InfluenceStep;
  readonly photonEnergyPerHertzInEv: number | null;
  readonly nodes: readonly StageNode[];
  readonly nodeY: number;
  readonly viewLeft: number;
  readonly viewRight: number;
  readonly height: number;
}

function wavePath(fromX: number, toX: number, y: number, waveLength: number): string {
  if (waveLength <= 0) {
    return `M ${String(fromX)} ${String(y)} L ${String(toX)} ${String(y)}`;
  }
  const points = Array.from({ length: WAVE_SAMPLES + 1 }, (unused, index) => {
    const x = fromX + ((toX - fromX) * index) / WAVE_SAMPLES;
    const phase = (2 * Math.PI * Math.abs(x - fromX)) / Math.max(waveLength, 1);
    return `${x.toFixed(1)} ${(y + WAVE_AMPLITUDE * Math.sin(phase)).toFixed(1)}`;
  });
  return `M ${points.join(' L ')}`;
}

function arrowHead(tipX: number, y: number, pointsRight: boolean): string {
  const back = pointsRight ? tipX - ARROW_SIZE : tipX + ARROW_SIZE;
  return `M ${String(back)} ${String(y - ARROW_SIZE * 0.7)} L ${String(tipX)} ${String(y)} L ${String(back)} ${String(y + ARROW_SIZE * 0.7)}`;
}

export function InfluenceZone({
  step,
  photonEnergyPerHertzInEv,
  nodes,
  nodeY,
  viewLeft,
  viewRight,
  height,
}: Props) {
  const visual = influenceVisual(step, photonEnergyPerHertzInEv);
  const targets =
    step.targets === undefined
      ? nodes.filter((node) => !node.leaving)
      : nodes.filter((node) =>
          node.members.some((member) => step.targets?.includes(member) === true),
        );
  const left =
    targets.length === 0
      ? viewLeft + STAGE_INSET
      : Math.min(...targets.map((node) => node.x)) - ZONE_MARGIN_X;
  const right =
    targets.length === 0
      ? viewRight - STAGE_INSET
      : Math.max(...targets.map((node) => node.x)) + ZONE_MARGIN_X;
  const heights = targets.length === 0 ? [nodeY] : targets.map((node) => node.y);
  const lowest = Math.min(...heights);
  const highest = Math.max(...heights);
  const top =
    targets.length > 0 && highest === lowest
      ? Math.max(STAGE_INSET, lowest - ZONE_ABOVE)
      : lowest - ZONE_ABOVE;
  const bottom =
    targets.length > 0 && highest === lowest
      ? Math.min(height - PILL_HEIGHT - PILL_GAP - STAGE_INSET, highest + ZONE_BELOW)
      : highest + ZONE_BELOW;
  const beamY = (lowest + highest) / 2;
  const zoneWidth = right - left;
  const zoneHeight = bottom - top;
  const pillWidth = PILL_PADDING * 3 + PILL_ICON + visual.caption.length * CAPTION_CHARACTER_WIDTH;
  const pillX = Math.min(
    viewRight - STAGE_INSET - pillWidth,
    Math.max(viewLeft + STAGE_INSET, left + zoneWidth / 2 - pillWidth / 2),
  );
  const pillY = bottom + PILL_GAP;
  const fromRight = step.influence === 'laserCool';
  const targetNames =
    targets.length === 0
      ? say('всю систему', 'the whole system')
      : targets.map((node) => node.label).join(', ');
  const beamTooltip = fromRight
    ? say(
        `Встречные лазерные пучки: ${visual.caption}. Атом рассеивает фотоны со стороны, куда летит, и тормозится`,
        `Counter-propagating laser beams: ${visual.caption}. The atom scatters photons from the side it moves toward and slows down`,
      )
    : say(
        `Поток фотонов: ${visual.caption}, летит к ${targetNames}`,
        `Photon flux: ${visual.caption}, heading to ${targetNames}`,
      );
  const waveClass =
    visual.waveLength >= DASHED_WAVE_LENGTH ? 'influence-wave dashed' : 'influence-wave';
  return (
    <g
      className={`influence-zone tone-${visual.tone} kind-${visual.kind}`}
      data-tooltip={say(
        `Зона воздействия «${visual.caption}»: ${INFLUENCE_GLOSSARY[step.influence] ?? step.influence}. Действует на ${targetNames}`,
        `Influence zone “${visual.caption}”: ${INFLUENCE_GLOSSARY[step.influence] ?? step.influence}. Acts on ${targetNames}`,
      )}
    >
      <rect
        className="influence-area"
        x={left}
        y={top}
        width={zoneWidth}
        height={zoneHeight}
        rx={26}
      />
      {visual.kind === 'beam' &&
        WAVE_ROWS.flatMap((offset) => [
          <g key={`left${String(offset)}`} className="influence-beam" data-tooltip={beamTooltip}>
            <path
              className="stage-hit"
              d={`M ${String(viewLeft)} ${String(beamY + offset)} L ${String(left)} ${String(beamY + offset)}`}
            />
            <path
              className={waveClass}
              d={wavePath(viewLeft, left - ARROW_SIZE, beamY + offset, visual.waveLength)}
            />
            <path className="influence-arrow" d={arrowHead(left, beamY + offset, true)} />
          </g>,
          ...(fromRight
            ? [
                <g
                  key={`right${String(offset)}`}
                  className="influence-beam reverse"
                  data-tooltip={beamTooltip}
                >
                  <path
                    className="stage-hit"
                    d={`M ${String(viewRight)} ${String(beamY + offset)} L ${String(right)} ${String(beamY + offset)}`}
                  />
                  <path
                    className={waveClass}
                    d={wavePath(viewRight, right + ARROW_SIZE, beamY + offset, visual.waveLength)}
                  />
                  <path className="influence-arrow" d={arrowHead(right, beamY + offset, false)} />
                </g>,
              ]
            : []),
        ])}
      {visual.kind === 'field' &&
        Array.from(
          { length: Math.max(1, Math.floor(zoneWidth / FIELD_SPACING)) },
          (unused, index) => {
            const x = left + FIELD_SPACING / 2 + index * FIELD_SPACING;
            return (
              <g
                key={index}
                className="influence-field"
                data-tooltip={`${say('Силовая линия поля', 'Field line')}: ${visual.caption}`}
              >
                <line className="stage-hit" x1={x} x2={x} y1={bottom - 10} y2={top + 12} />
                <line x1={x} x2={x} y1={bottom - 10} y2={top + 12} />
                <path
                  d={`M ${String(x - ARROW_SIZE * 0.7)} ${String(top + 12 + ARROW_SIZE)} L ${String(x)} ${String(top + 12)} L ${String(x + ARROW_SIZE * 0.7)} ${String(top + 12 + ARROW_SIZE)}`}
                />
              </g>
            );
          },
        )}
      {visual.kind === 'gas' &&
        Array.from({ length: GAS_DOTS }, (unused, index) => (
          <circle
            key={index}
            data-tooltip={`${say('Частица среды', 'Medium particle')}: ${visual.caption}`}
            className="influence-gas"
            r={2.5}
            cx={left + 12 + ((index * GOLDEN_RATIO) % 1) * (zoneWidth - 24)}
            cy={top + 12 + ((index * GOLDEN_RATIO * GOLDEN_RATIO * 7) % 1) * (zoneHeight - 24)}
          />
        ))}
      {targets.map((node) => (
        <circle
          key={node.key}
          data-tooltip={say(
            `${node.label} принимает воздействие «${visual.caption}»`,
            `${node.label} receives the influence “${visual.caption}”`,
          )}
          className="influence-pulse"
          cx={node.x}
          cy={node.y}
          r={nodeRadius(node.view.massInGev) + PULSE_GAP}
        />
      ))}
      <g
        className="influence-pill"
        data-tooltip={`${visual.caption}: ${INFLUENCE_GLOSSARY[step.influence] ?? step.influence}`}
      >
        <rect x={pillX} y={pillY} width={pillWidth} height={PILL_HEIGHT} rx={PILL_HEIGHT / 2} />
        <SmlIcon
          name={visual.icon}
          x={pillX + PILL_PADDING}
          y={pillY + (PILL_HEIGHT - PILL_ICON) / 2}
          size={PILL_ICON}
          strokeWidth={2}
          aria-hidden="true"
        />
        <text x={pillX + PILL_PADDING * 2 + PILL_ICON} y={pillY + PILL_HEIGHT / 2 + 4.5}>
          {visual.caption}
        </text>
      </g>
    </g>
  );
}
