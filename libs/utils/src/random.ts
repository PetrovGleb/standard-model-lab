/* Seeded random source built on pure-rand xoroshiro128+, giving reproducible 53-bit uniform draws in [0, 1); the first outputs are discarded because small seeds start near all ones. */
import type { RandomSource } from '@standard-model/contracts';
import { xoroshiro128plus } from 'pure-rand/generator/xoroshiro128plus';

const UPPER_BITS = 27;
const LOWER_BITS = 26;
const LOWER_SCALE = 2 ** LOWER_BITS;
const UNIT_SCALE = 2 ** (UPPER_BITS + LOWER_BITS);
const GENERATOR_WORD_BITS = 32;
const WARM_UP_OUTPUTS = 32;

export function createRandomSource(seed: number): RandomSource {
  const generator = xoroshiro128plus(seed);
  for (let output = 0; output < WARM_UP_OUTPUTS; output += 1) {
    generator.next();
  }
  return {
    seed,
    nextUnit(): number {
      const upper = generator.next() >>> (GENERATOR_WORD_BITS - UPPER_BITS);
      const lower = generator.next() >>> (GENERATOR_WORD_BITS - LOWER_BITS);
      return (upper * LOWER_SCALE + lower) / UNIT_SCALE;
    },
  };
}
