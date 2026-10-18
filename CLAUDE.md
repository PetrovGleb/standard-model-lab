# standard-model

TypeScript engine for mathematical simulations of Standard Model particle behaviour: particle
classes with their properties and interactions, finite-dimensional quantum state (spin,
polarization, flavor), entanglement, measurement and collapse, environment and influences,
decays and kinematics, and an experiment pipeline runner. Data comes from NIST CODATA 2022 and
PDG 2026 as transcribed in `docs/STANDARD_MODEL_REFERENCE.md`.

## Rules for every file

- Line 1 is a single `/* ... */` block, at most 3 lines, saying what the file is and does.
  No other comment anywhere in the file. Enforced by `local/header-only-comments`.
- Identifiers are plain words. Never a Greek letter or a math symbol: `lorentzFactor` not
  `gamma`, `FINE_STRUCTURE_CONSTANT` not `alpha`, `polarAngleDegrees` not `theta`.
  Enforced by `id-denylist` and `id-length`.
- A physical quantity carries its unit in its name: `massInGev`, `meanLifeInSeconds`,
  `magneticFieldInTesla`, `numberDensityPerCubicMeter`.
- Internal unit system: natural units with energy in GeV. Convert at boundaries with
  `@standard-model/utils` units helpers. Environment parameters stay in SI (kelvin, tesla).
- Numbers are never retyped. CODATA values come from `libs/constants/src/codata.generated.ts`
  (regenerate with `pnpm generate:codata`), PDG values from `libs/constants/data/pdg2026.json`,
  preset media and critical points from `environments.json` and `critical-points.json`.
  Derived values are computed in code from those.
- No magic numbers inside formulas: name the factor or import the constant.

## Where things live

- `libs/contracts`: every type, interface, experiment plan schema (ajv) and Sequelize model.
- `libs/constants`: CODATA and PDG data, generated constants, aliases, particle catalog.
- `libs/utils`: units, seeded random, sampling, kinematics, statistics helpers.
- `packages/engine`: the physics. Layout: `particles`, `quantum`, `environment`, `influence`,
  `experiment`, `templates`. Framework-free, constructor injection, composition root
  `createEngine`.
- `apps/api`: NestJS over the engine, run with tsx; constructor dependencies use `@Inject(token)`
  because esbuild emits no decorator metadata. Database models come from
  `@standard-model/contracts/db`, never from the main contracts barrel.
- `apps/web`: React + Vite; imports contracts as types only and takes vocabularies from
  `GET /api/catalog`. Pure plan editing lives in `plan-edits.ts` and is tested.
- `docs/ARCHITECTURE.md` is the design; `docs/ROADMAP.md` is the step order.

## Design rules

- Particles are classes. Inheritance expresses taxonomy (Fermion, Lepton, Quark, Boson,
  CompositeParticle); behaviour is composed from capability interfaces and interaction objects.
- Quantum state is never stored inside a particle. A `QuantumRegister` owns the joint Hilbert
  space; a particle holds a slot. Entangling merges registers; measuring applies a projector
  tensored with identity to the whole register.
- Measurement and collapse are one shared service with an injected `CollapseStrategy` and
  `RandomSource`. Never per-particle collapse code.
- Environment is a set of aspects keyed by name. Each aspect brings its own Hamiltonian and
  decoherence contributors. Adding a parameter means adding a file, not editing others.
  Background particles are a statistical medium, never slots in the register.
- Randomness only through a seeded `RandomSource`. Never `Math.random`.
- External input (plans, API bodies) is validated with ajv; schemas are typed with
  `JSONSchemaType` against the TypeScript type.
- Postgres via sequelize-typescript with `sync()`, no migrations. Every `@Column` names its
  `DataType` explicitly.
- SOLID: small interfaces, strategies injected through constructors, registries for extension.
  Do not add an interface with a single implementation unless it is a designed injection point
  (`CollapseStrategy`, `DecoherenceModel`, `RandomSource`).

## Tests

- Deterministic checks first: particle properties, exact Born probabilities to 1e-12.
- Monte Carlo second: seeded, default 10 000 shots, tolerance from `statisticalTolerance`
  at 5 sigma. A result outside the tolerance window fails the test.
- Tests live next to the package in `test/*.test.ts`, run with `pnpm test`.

## Commands

`pnpm install`, `pnpm check` (typecheck + lint + test), `pnpm generate:codata`,
`pnpm db:sync`, `pnpm dev:api`, `pnpm dev:web`, `pnpm build:web`, `docker compose up --build`.

## Workflow

Each step is planned first and started only after approval. Finish a step with `pnpm check`.

## Documentation and evolution

- `docs/ARCHITECTURE.md` is the map: packages, layers, the injection points, where a new thing goes.
- `docs/DETAILED_ARCHITECTURE.md` is the feature-by-feature breakdown: every data source and the
  file it feeds, every law with its inputs, every kind of interaction (particles, fields, media,
  reactions, decays, molecules), the API and the database, the web views.
- `docs/EVOLUTION.md` is the project evolution protocol: one entry per change with what changed,
  why, and how it was verified. Append an entry in the same change that touches the code.
- Start every new chat by reading these three documents before touching code, and keep them true:
  a change that adds or alters behaviour updates the relevant section in the same change.
- The architecture is closed for modification and open for extension (the O of SOLID): add a new
  influence, aspect, law, mechanism, template or data file through the existing registries and
  contracts; do not change existing contracts, laws or public behaviour without an entry in
  `docs/EVOLUTION.md` that names the reason and the tests that guard the old behaviour.
