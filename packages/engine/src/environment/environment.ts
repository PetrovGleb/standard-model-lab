/* ImmutableEnvironment: the Environment contract backed by a map of aspects; every change returns a new instance. */
import type {
  Environment,
  EnvironmentAspectKey,
  EnvironmentAspects,
} from '@standard-model/contracts';

export class ImmutableEnvironment implements Environment {
  private constructor(private readonly aspects: ReadonlyMap<EnvironmentAspectKey, unknown>) {}

  static from(initial: Partial<EnvironmentAspects> = {}): ImmutableEnvironment {
    const entries = Object.entries(initial) as ReadonlyArray<
      readonly [EnvironmentAspectKey, unknown]
    >;
    return new ImmutableEnvironment(new Map(entries.filter(([, value]) => value !== undefined)));
  }

  get aspectKeys(): readonly EnvironmentAspectKey[] {
    return [...this.aspects.keys()];
  }

  get<TKey extends EnvironmentAspectKey>(key: TKey): EnvironmentAspects[TKey] | undefined {
    return this.aspects.get(key) as EnvironmentAspects[TKey] | undefined;
  }

  with<TKey extends EnvironmentAspectKey>(key: TKey, value: EnvironmentAspects[TKey]): Environment {
    const next = new Map(this.aspects);
    next.set(key, value);
    return new ImmutableEnvironment(next);
  }

  without(key: EnvironmentAspectKey): Environment {
    const next = new Map(this.aspects);
    next.delete(key);
    return new ImmutableEnvironment(next);
  }
}

export function createEnvironment(initial: Partial<EnvironmentAspects> = {}): Environment {
  return ImmutableEnvironment.from(initial);
}
