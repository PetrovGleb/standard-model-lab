/* Typed access to complexity.generated.json: the measured first shot, the mean of the later shots and the step shares of each built-in template (pnpm measure:templates). */
import complexityJson from './complexity.generated.json' with { type: 'json' };

export interface MeasuredComplexity {
  readonly firstShotMilliseconds?: number;
  readonly meanShotMilliseconds: number;
  readonly stepShares: readonly number[];
}

const file = complexityJson as unknown as {
  readonly complexity: Readonly<Record<string, MeasuredComplexity>>;
};

export function templateComplexity(name: string): MeasuredComplexity | null {
  return file.complexity[name] ?? null;
}
