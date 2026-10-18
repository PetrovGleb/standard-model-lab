/* In-place radix-2 complex FFT on separate real and imaginary arrays, and its 3D form applied axis by axis over an N×N×N cube. */
interface FftPlan {
  readonly size: number;
  readonly reversed: Uint32Array;
  readonly cosines: Float64Array;
  readonly sines: Float64Array;
}

const plans = new Map<number, FftPlan>();

function planFor(size: number): FftPlan {
  const cached = plans.get(size);
  if (cached !== undefined) {
    return cached;
  }
  if ((size & (size - 1)) !== 0) {
    throw new Error('FFT size must be a power of two');
  }
  const bits = Math.log2(size);
  const reversed = new Uint32Array(size);
  for (let index = 0; index < size; index += 1) {
    let value = 0;
    for (let bit = 0; bit < bits; bit += 1) {
      value = (value << 1) | ((index >> bit) & 1);
    }
    reversed[index] = value;
  }
  const cosines = new Float64Array(size / 2);
  const sines = new Float64Array(size / 2);
  for (let index = 0; index < size / 2; index += 1) {
    cosines[index] = Math.cos((2 * Math.PI * index) / size);
    sines[index] = Math.sin((2 * Math.PI * index) / size);
  }
  const plan = { size, reversed, cosines, sines };
  plans.set(size, plan);
  return plan;
}

export function fft1d(real: Float64Array, imaginary: Float64Array, inverse: boolean): void {
  const plan = planFor(real.length);
  const size = plan.size;
  for (let index = 0; index < size; index += 1) {
    const target = plan.reversed[index] ?? 0;
    if (target > index) {
      const swapReal = real[index] ?? 0;
      real[index] = real[target] ?? 0;
      real[target] = swapReal;
      const swapImaginary = imaginary[index] ?? 0;
      imaginary[index] = imaginary[target] ?? 0;
      imaginary[target] = swapImaginary;
    }
  }
  const sign = inverse ? 1 : -1;
  for (let length = 2; length <= size; length *= 2) {
    const half = length / 2;
    const stride = size / length;
    for (let start = 0; start < size; start += length) {
      for (let offset = 0; offset < half; offset += 1) {
        const cosine = plan.cosines[offset * stride] ?? 1;
        const sine = sign * (plan.sines[offset * stride] ?? 0);
        const evenIndex = start + offset;
        const oddIndex = evenIndex + half;
        const oddReal = real[oddIndex] ?? 0;
        const oddImaginary = imaginary[oddIndex] ?? 0;
        const turnedReal = oddReal * cosine - oddImaginary * sine;
        const turnedImaginary = oddReal * sine + oddImaginary * cosine;
        const evenReal = real[evenIndex] ?? 0;
        const evenImaginary = imaginary[evenIndex] ?? 0;
        real[evenIndex] = evenReal + turnedReal;
        imaginary[evenIndex] = evenImaginary + turnedImaginary;
        real[oddIndex] = evenReal - turnedReal;
        imaginary[oddIndex] = evenImaginary - turnedImaginary;
      }
    }
  }
  if (inverse) {
    for (let index = 0; index < size; index += 1) {
      real[index] = (real[index] ?? 0) / size;
      imaginary[index] = (imaginary[index] ?? 0) / size;
    }
  }
}

export function fft3d(
  real: Float64Array,
  imaginary: Float64Array,
  size: number,
  inverse: boolean,
): void {
  const lineReal = new Float64Array(size);
  const lineImaginary = new Float64Array(size);
  const strides = [1, size, size * size];
  strides.forEach((stride) => {
    const outer = stride === 1 ? size * size : stride === size ? size * size : size * size;
    for (let line = 0; line < outer; line += 1) {
      const base =
        stride === 1
          ? line * size
          : stride === size
            ? (line % size) + Math.floor(line / size) * size * size
            : line;
      for (let index = 0; index < size; index += 1) {
        lineReal[index] = real[base + index * stride] ?? 0;
        lineImaginary[index] = imaginary[base + index * stride] ?? 0;
      }
      fft1d(lineReal, lineImaginary, inverse);
      for (let index = 0; index < size; index += 1) {
        real[base + index * stride] = lineReal[index] ?? 0;
        imaginary[base + index * stride] = lineImaginary[index] ?? 0;
      }
    }
  });
}
