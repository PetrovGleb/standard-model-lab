# Standard Model Lab

A TypeScript engine that simulates Standard Model particles and their evolution from fundamental
laws, with a NestJS API, a React lab in the browser and Postgres for run history. You build any
medium and any influence, run real experiments and climb the levels from quarks to nuclei, atoms,
molecules and chemistry. Data: NIST CODATA 2022 and PDG 2026 as transcribed in
`docs/STANDARD_MODEL_REFERENCE.md`. Overview: `docs/overview/standard-model-lab-overview.pdf`.

## Quick start in Docker

Needs Docker with Compose.

```bash
git clone git@github.com:PetrovGleb/standard-model-lab.git
cd standard-model-lab
cp .env.example .env
docker compose up --build
```

- Web: http://localhost:5173
- API: http://localhost:3000/api, health at http://localhost:3000/api/health
- Postgres: localhost:5433 with the database, user and password from `.env`

The API creates and updates its tables on start, no migrations to run. `docker compose down` stops
the stack; `docker compose down -v` also deletes the database volume.

## Run locally for development

Needs Node 22 (`.nvmrc`), pnpm 10 (through corepack) and Docker for Postgres.

```bash
cp .env.example .env
nvm use
corepack enable
pnpm install
docker compose up -d postgres
pnpm dev:api
pnpm dev:web
```

Run `pnpm dev:api` and `pnpm dev:web` in two terminals. The API listens on `API_PORT` from `.env`
(3000); the web dev server opens on http://localhost:5173 and proxies `/api` to `API_URL`
(default http://localhost:3000). Other ports:

```bash
API_PORT=3001 pnpm dev:api
API_URL=http://localhost:3001 pnpm dev:web
```

Restart the API after changing the engine or the API; the web reloads by itself.

## Configuration

`.env` (copied from `.env.example`) holds everything:

| Variable                                            | Default             | Meaning                                     |
| --------------------------------------------------- | ------------------- | ------------------------------------------- |
| `POSTGRES_HOST`                                     | `localhost`         | database host for the local API             |
| `POSTGRES_PORT`                                     | `5433`              | host port of Postgres (5432 is often taken) |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | `standard_model`, … | database credentials                        |
| `API_PORT`                                          | `3000`              | API port                                    |
| `WEB_PORT`                                          | `5173`              | web port in Docker                          |

## Checks

```bash
pnpm check
```

Typecheck, lint and all tests. The API end-to-end test runs only when the database variables are
in the environment, so load `.env` first to include it:

```bash
set -a && . ./.env && set +a && pnpm check
```

## Data generators

The generated data is committed; rerun a generator only after changing its source.

- `pnpm generate:codata`: constants from `libs/constants/data/codata2022.json`
- `pnpm generate:matter`, `pnpm generate:reaclib`, `pnpm generate:pdf`: matter, reaction rates and
  parton distributions
- `pnpm fetch:endf` then `pnpm generate:endf`: neutron cross sections from ENDF/B-VIII.0
- `pnpm generate:molecules`: precomputed traits of the molecule catalogue
- `pnpm measure:templates`: time per shot of every built-in template

## Desktop app (.app and .exe)

```bash
pnpm package
pnpm package mac-arm64
```

The first builds all targets, the second one of `mac-arm64`, `mac-x64` or `win-x64`. The build
runs on a Mac without Docker or Wine and writes to `release/`:

- `release/mac-arm64/mac-arm64/Standard Model Lab.app` and its zip (Apple Silicon);
- `release/mac-x64/mac/Standard Model Lab.app` and its zip (Intel Macs);
- `release/win-x64/Standard Model Lab <version>.exe`, a portable exe that runs without installing.

Each app carries Electron, the API (minified JS bundle) and Postgres 17. On first launch it creates
its database in the user folder (`~/Library/Application Support/Standard Model Lab` or
`%APPDATA%\Standard Model Lab`); history survives restarts. Nothing else needs to be installed.

The apps are not signed with a developer certificate. On first launch:

- Mac: right-click the app → «Открыть» → «Открыть», or run `xattr -cr "Standard Model Lab.app"`
  after unpacking the zip.
- Windows: SmartScreen → «Подробнее» → «Выполнить в любом случае».

## Documentation

- `docs/ARCHITECTURE.md`: packages, layers, injection points and where a new thing goes.
- `docs/DETAILED_ARCHITECTURE.md`: every data source, law, interaction, API route and view.
- `docs/EVOLUTION.md`: one entry per change with the reason and how it was verified.
- `docs/ROADMAP.md`: step order. `docs/NAMING.md`: naming.
- `CLAUDE.md`: house rules for code.
