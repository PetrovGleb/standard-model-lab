/* Template: CHSH on four singlet pairs per shot, one pair per setting combination; the quantum value is 2 sqrt 2. */
import { experiment } from '../experiment/experiment-builder.js';

const PAIRS = [
  ['settingA', 'settingB'],
  ['settingA', 'settingBPrime'],
  ['settingAPrime', 'settingB'],
  ['settingAPrime', 'settingBPrime'],
] as const;

const builder = experiment('chsh')
  .describe(
    "Four spin singlets per shot measured with the CHSH setting pairs (a,b), (a,b'), (a',b), (a',b')",
  )
  .parameter('settingA', 0)
  .parameter('settingAPrime', 90)
  .parameter('settingB', 45)
  .parameter('settingBPrime', 135);

PAIRS.forEach(([settingA, settingB], pair) => {
  const labelA = `a${String(pair + 1)}`;
  const labelB = `b${String(pair + 1)}`;
  builder
    .create(labelA, 'electron')
    .create(labelB, 'electron')
    .entangle([labelA, labelB], 'spinSinglet')
    .measure(labelA, 'spin', labelA, { polarAngleDegrees: `{{${settingA}}}`, azimuthDegrees: 0 })
    .measure(labelB, 'spin', labelB, { polarAngleDegrees: `{{${settingB}}}`, azimuthDegrees: 0 })
    .report('correlation', [labelA, labelB], `correlation${String(pair + 1)}`);
});

export const CHSH_TEMPLATE = builder
  .report('chsh', ['a1', 'b1', 'a2', 'b2', 'a3', 'b3', 'a4', 'b4'], 'chsh')
  .build();
