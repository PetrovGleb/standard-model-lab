# Standard Model Lab

**🌐 [English](#english) · [Русский](#русский)**

A TypeScript engine that simulates Standard Model particles and their evolution from fundamental
laws, with a NestJS API, a React lab in the browser and Postgres for run history. You build any
medium and any influence, run real experiments and climb the levels from quarks to nuclei, atoms,
molecules and chemistry. Data: NIST CODATA 2022 and PDG 2026 as transcribed in
`docs/STANDARD_MODEL_REFERENCE.md`. Overview: `docs/overview/standard-model-lab-overview.pdf`.

---

## English

_[Switch to Русский](#русский) · The interface language (Russian or English) is picked in the app header and remembered in the browser._

### What it is

Standard Model Lab turns the particle physics of the Standard Model into something you can run.
The engine builds particles as classes with real properties, puts them in a quantum register
(spin, polarization, flavor, entanglement, measurement and collapse), places them in a medium with
temperature, fields and background matter, applies influences, and runs an experiment as a pipeline
of steps. Every number traces back to NIST CODATA 2022 or PDG 2026 — nothing is hand-tuned.

The web lab is the front door; the same engine also ships as a desktop app and behind the API.

### How to use it

The app has five tabs across the top:

- **Templates** — the fastest way in. Pick a ready-made experiment — CHSH and the singlet
  correlation, two-slit interference, Stern–Gerlach, Larmor precession, neutrino oscillation,
  muon decay, collisions and hadron colliders, fusion, fission, radiation in matter, chemistry —
  set its parameters, press run, read the result. Start here to see what the engine can do.
- **Builder** — build your own experiment from nothing. On a pan-and-zoom canvas you define the
  run settings, the parameters and their use, the space (medium, fields, background matter), the
  steps, and the report. Edit each block as a form or as JSON against a sticky schema. A live
  estimate shows the run cost before you commit. Drafts are kept in tabs so several experiments
  stay open at once.
- **Results** — while a run computes you see the step diagram and live progress (first the one
  simulation being timed, then the remaining time and the simulation count); when it finishes, the
  experiment, its parameters and steps sit above the result, with a way straight back to the
  builder.
- **Runs** — the history. Every run is stored in Postgres with its status; open any past run and
  its full stored result comes back.
- **Lagrangian** — the Standard Model Lagrangian exactly as the engine uses it: terms, multiplets,
  parameters with their mass checks, the derived vertices, and a tree-level process calculator with
  diagrams, dσ/dcosθ and a comparison against PDG.

A typical path: run a couple of **Templates** to get a feel, open one in the **Builder** to change
the medium or an influence, run it and watch **Results**, then find it later under **Runs**. Use
**Lagrangian** when you want the theory behind a vertex rather than a simulation.

The deterministic physics (particle properties, Born probabilities) is exact; everything stochastic
runs as seeded Monte Carlo, so the same inputs always give the same result.

---

## Русский

_[Switch to English](#english) · Язык интерфейса (русский или английский) выбирается в шапке приложения и запоминается в браузере._

### Что это

Standard Model Lab превращает физику элементарных частиц Стандартной модели в то, что можно
запустить. Движок строит частицы как классы с реальными свойствами, помещает их в квантовый
регистр (спин, поляризация, аромат, запутанность, измерение и коллапс), ставит в среду с
температурой, полями и фоновым веществом, прикладывает воздействия и прогоняет эксперимент как
конвейер шагов. Каждое число восходит к NIST CODATA 2022 или PDG 2026 — вручную ничего не
подогнано.

Веб-лаборатория — главный вход; тот же движок поставляется и как десктоп-приложение, и за API.

### Как пользоваться

Вверху приложения пять вкладок:

- **Шаблоны** — самый быстрый вход. Выбираешь готовый эксперимент — CHSH и синглетная корреляция,
  двухщелевая интерференция, Штерн–Герлах, ларморовская прецессия, осцилляции нейтрино, распад
  мюона, столкновения и адронные коллайдеры, синтез, деление, прохождение излучения через
  вещество, химия — задаёшь параметры, жмёшь запуск, читаешь результат. Начинать стоит отсюда,
  чтобы увидеть, что движок умеет.
- **Конструктор** — собираешь свой эксперимент с нуля. На холсте с панорамированием и зумом задаёшь
  настройки запуска, параметры и их использование, пространство (среда, поля, фоновое вещество),
  шаги и отчёт. Каждый блок правится формой или JSON по закреплённой схеме. Живая оценка показывает
  стоимость прогона до запуска. Черновики держатся во вкладках — сразу открыто несколько
  экспериментов.
- **Результаты** — пока идёт расчёт, виден диаграмма шагов и прогресс в реальном времени (сначала
  одна симуляция, по которой замеряется время, потом остаток времени и число симуляций); по
  завершении сверху эксперимент, его параметры и шаги, под ними результат и кнопка обратно в
  конструктор.
- **Запуски** — история. Каждый прогон хранится в Postgres со своим статусом; открываешь любой
  прошлый запуск — и возвращается его полный сохранённый результат.
- **Лагранжиан** — лагранжиан Стандартной модели ровно в том виде, в каком его использует движок:
  члены, мультиплеты, параметры с проверками масс, производные вершины и калькулятор процессов на
  древесном уровне с диаграммами, dσ/dcosθ и сравнением с PDG.

Типичный путь: запустить пару **Шаблонов**, чтобы освоиться, открыть один в **Конструкторе**,
поменять среду или воздействие, запустить и смотреть **Результаты**, а позже найти его в
**Запусках**. **Лагранжиан** — когда нужна теория за вершиной, а не симуляция.

Детерминированная физика (свойства частиц, борновские вероятности) точна; всё случайное считается
как Монте-Карло с зерном, поэтому одни и те же входные данные всегда дают один и тот же результат.

---

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
