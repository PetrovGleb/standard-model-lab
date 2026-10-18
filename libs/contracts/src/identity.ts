/* Identity contract: deterministic id generation for particles and runs, injected so prefixes and ordering stay reproducible. */
export interface IdGenerator {
  next(prefix: string): string;
}
