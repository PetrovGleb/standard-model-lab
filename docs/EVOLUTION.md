# Project evolution protocol

This file is the memory of why the project looks the way it does. Every change that adds, removes
or alters behaviour gets an entry in the same change that touches the code: what changed, why, and
how it was verified. Entries are appended at the bottom of the current day; days are in order.

## Protocol

- One entry per coherent change, written when the change lands, not later.
- Fields: **What** (the files, laws, contracts or templates touched), **Why** (the request, the
  defect or the physics that forced it), **Verification** (the tests or runs that guard it).
- A change to an existing contract, law or public behaviour is marked `[modification]` and names
  the tests that keep the old behaviour where it must stay; everything else is `[extension]`.
- Data sources are recorded with their citation and the file they feed (see
  `docs/STANDARD_MODEL_REFERENCE.md` for the full table).
- The architecture is closed for modification since 2026-10-17: new behaviour goes through the
  registries and contracts described in `docs/ARCHITECTURE.md` and `docs/DETAILED_ARCHITECTURE.md`.

## 2026-10-15

- `[extension]` Foundation to experiment runner (roadmap steps 1–6). **What:** monorepo, contracts,
  CODATA generator and particle catalog, particle class hierarchy, quantum core with registers and
  collapse strategy, environment with aspects and contributors, decays, plan compiler and runner,
  first templates. **Why:** the engine the project exists for, built top-down in the order the
  user set. **Verification:** exact Born probabilities to 1e-12 and seeded Monte Carlo at five
  sigma from the oracle in `docs/STANDARD_MODEL_REFERENCE.md` §4.15.
- `[extension]` API and web (steps 7–8). **What:** NestJS over the engine with explicit injection
  tokens, Postgres via Sequelize `sync()`, React + Vite templates, builder and history.
  **Why:** a laboratory people can use without code. **Verification:** API end-to-end test
  against Postgres, web unit tests on pure plan editing.

## 2026-10-16

- `[extension]` Collisions, space cube, Lagrangian, strings, proton structure, fusion, matter
  (steps 9–13). **What:** tree-level collisions from the Lagrangian, N³ cube, Lund strings,
  NNPDF partons with remnants, light nuclei and S-factors, 3558 NUBASE nuclei, NIST atoms and
  ions, UFF molecules, radiation and laser cooling. **Why:** the user wants one engine for
  particles, nuclei, atoms and molecules with data from the published sources, never retyped.
  **Verification:** textbook cross sections and PDG widths, Bosch–Hale reactivity, NIST binding,
  water geometry and modes against experiment.
- `[extension]` Stage camera, loader layout, collisional ionization and Saha balance, full RU/EN
  localization, desktop packaging (Electron with embedded Postgres). **Why:** user requests of
  the day; a hydrogen atom in a plasma has to ionize and recombine by general laws, and the
  program is handed over to Russian and English speakers alike. **Verification:** Saha at
  2.6·10⁴ K at Loschmidt density, language tests that fail on Cyrillic in English output.
- `[modification]` Thermal dissociation under resonant infrared took the bond energy from the
  molecule's internal heat (`influence/radiation-influences.ts`). **Why:** the engine crashed with
  “decay kinematically forbidden” when a molecule heated past its bond energy. **Verification:**
  `matter.test.ts`, resonant infrared on water.

## 2026-10-17

- `[extension]` pp-II and pp-III branches: three Solar Fusion II S-factors in
  `libs/constants/data/nuclear.json` (³He(α,γ)⁷Be, ⁷Be(p,γ)⁸B, ⁷Li(p,α)⁴He), continuum electron
  capture of any EC nuclide in an electron gas (`collisions/nuclear-decay-in-medium.ts`), nuclear
  decays as channels of the medium chain, any NUBASE nucleus as a fusion partner. **Why:** the
  user asked that stars obey general laws rather than a Sun-shaped script. **Verification:**
  `star-matter.test.ts`: ⁷Be capture within 15% of Solar Fusion II eq. 40, branch shares against
  the rates at five sigma.
- `[modification]` The line in `allReactionsInStep` ends when a product is a species the medium
  already holds (`medium-reactions.ts`). **Why:** an alpha from pp-I kept re-entering the helium-3
  of the gas and doubled the helium count per proton. **Verification:** `medium-components.test.ts`
  (`solarHeliumChain` now ends at ³He), `star-matter.test.ts`.
- `[extension]` Bond formation in a gas by detailed balance (`molecules/molecular-association.ts`),
  ordinary valence by the octet and duet rules, `waterFromAtoms`. **Why:** the engine could only
  break molecules. **Verification:** `molecular-association.test.ts`: joining rate equals K(T)
  times the breaking rate to 1e-12, O/OH/H₂O equilibrium at five sigma.
- `[extension]` Environment regions: an influence aimed at particles opens a region for them
  (`ShotContext.scope`, `environmentFor`), products inherit regions, frames list regions, the
  stage draws nested envelopes always, gas exchange in events, `waterInHydrogenBubble`.
  **Why:** the user wants the medium visible at all times and media for part of the system.
  **Verification:** `environment-regions.test.ts`, `environment-envelopes.test.ts`.
- `[extension]` Duplicate step in the builder; carry-over button moved into the system state
  header. **Why:** user request. **Verification:** `plan-edits.test.ts`.
- `[extension]` JINA REACLIB (`libs/constants/data/reaclib/`, `pnpm generate:reaclib`,
  `collisions/reaclib-rates.ts`): 37 454 reactions between NUBASE nuclei in memory, two- and
  three-body channels with identical-partner factorials, weak leptons restored by charge,
  photodisintegration at reverse rates, S-factor tables kept for beams and as fallback.
  **Why:** fusion was a table of ten reactions; the user wants every nucleus to react by a law
  from a complete library, as decays do from NUBASE. **Verification:** `reaclib.test.ts`: the
  fit evaluated exactly, p+p within 1%, D–T within 3% and ³He+³He within 0.2% of the S-factor
  laws, pep/pp against Solar Fusion II eq. 41, triple alpha with its ½ n², deuteron
  photodisintegration.
- `[modification]` Neutron captures below T₉ = 0.01 are no longer continued as 1/v from the
  library (`reaclib-rates.ts`). **Why:** for heavy nuclei the keV cross section is resonant and a
  1/v continuation overshoots thermal captures a hundredfold (²³⁸U). The NIST 1/v table covers
  the thermal regime. **Verification:** `reaclib.test.ts`, `nuclei-and-atoms.test.ts`.
- `[modification]` Endothermic fusion and photodisintegration take threshold energy plus a thermal
  excess (`nuclear-reactions.ts`). **Why:** sampled relative energies below threshold crashed the
  kinematics. **Verification:** `nucleosynthesis.test.ts` (`firstNucleiAfterBigBang`).
- `[extension]` Continuum lowering in the charge chain (`medium-charge-balance.ts`): the smaller of
  Debye–Hückel and ion-sphere lowering removes bound levels; recombination into them is zero.
  **Why:** Saha alone left 27% of hydrogen neutral in the solar core and half of helium neutral
  in a giant's core; at these densities neighbouring ions sit closer than the Bohr radius.
  **Verification:** `medium-components.test.ts` (lowering above 13.6 eV in the solar core, below
  1 eV at Loschmidt density), `medium-charge-balance.test.ts` at 10²⁸ m⁻³.
- `[extension]` Medium species may be any known nucleus, atom or molecule
  (`influence-registry.ts`); `measureSystem` records `heaviest` and `heaviestMassNumber`.
  **Why:** carbon burning needs a medium of ¹²C; nucleosynthesis chains leave dozens of leptons in
  the composition string. **Verification:** `nucleosynthesis.test.ts`, `influences.test.ts`.
- `[extension]` Templates `cnoCycle`, `tripleAlpha`, `sProcessIron`, `carbonBurning`,
  `firstNucleiAfterBigBang`, `ammoniaFromAtoms`. **Why:** the laws above shown at work; the user
  asked for more medium-based experiments. **Verification:** `nucleosynthesis.test.ts`,
  `template-languages.test.ts`.
- `[modification]` Traced shots cover distinct outcomes (`run-experiment.ts`). **Why:** the player
  showed six shots in which nothing happened while the statistics reported a 2.8% fusion branch.
  **Verification:** `trace-coverage.test.ts`.
- `[extension]` Stage: compact medium captions with symbols, envelopes at least a region width and
  the shared one the stage width, double height, pinch-only zoom with 1% minimum, a center button;
  plan diagram bands for environment steps; Google Sans for headings. **Why:** user feedback on
  the screenshots. **Verification:** `plan-diagram.test.ts`, browser check.
- `[extension]` This protocol, `docs/DETAILED_ARCHITECTURE.md`, the documentation rules in
  `CLAUDE.md`. **Why:** the user froze the architecture for modification and wants every chat to
  start from the documents and every change to leave a trace. **Verification:** none needed.
- `[extension]` Audit part 1, contracts and constants (`docs/AUDIT.md`). **What:** generated
  artefacts verified against their generators; retyped constants replaced by CODATA imports in a
  template and three tests; `SystemFrame.regions` made optional for stored results; open findings
  recorded. **Why:** the user froze the architecture and asked for a full audit with test coverage
  before further extension. **Verification:** `pnpm check`.
- `[extension]` Pressure and radiation temperature of a medium (`MediumAspect.pressureInPascals`,
  `radiationTemperatureInKelvin`; `setMedium` parameters; the ideal-gas default Σ n k T in
  `environment/aggregate-state.ts`). **Why:** stage 2 of the user's list: a medium is more than a
  density and a temperature, and water is liquid because of pressure. **Verification:**
  `aggregate-state.test.ts` (sea-level air gives 1 atm within 1%), `influences.test.ts`.
- `[extension]` Aggregate-state law (`environment/aggregate-state.ts`): plasma for charged species,
  bare nuclei and atoms with kT ≥ χ/10; otherwise the critical point, the melting point and a
  Clausius–Clapeyron vapour curve through the boiling point from `data/critical-points.json`
  (NIST WebBook, CRC); a substance the table lacks gets Lennard-Jones corresponding states from the
  UFF well of its heaviest atom (T_c = 1.31 ε/k, T_triple = 0.69 ε/k, P_c = 0.13 ε/σ³) and is
  flagged `estimated`. `measureSystem` records `phase` and `<label>.phase`; `SystemReporter` emits
  `phaseChanged` with the conditions and the transition. **Why:** the user asked for aggregate
  states and crystallization in the measurements, by one law and not by a table per substance.
  **Verification:** `aggregate-state.test.ts`: water solid, liquid, gas and supercritical, CO₂
  on Venus and Mars, N₂ at 77 and 80 K, He at 4 K, krypton estimated, the phase events of
  `waterPhases`.
- `[extension]` Thermal photoionization by Planck photons (`thermalPhotoionizationRatePerSecond`
  in `medium-charge-balance.ts`, added to the charge chain when the medium carries a radiation
  temperature; photodisintegration takes the radiation temperature in
  `nuclear-decay-in-medium.ts`). **Why:** the radiation field of a star or of the early Universe
  ionizes atoms without electron impacts. **Verification:** `aggregate-state.test.ts`: at 10⁴ K
  the rate equals α₁ (Osterbrock & Ferland 2006, 1.58·10⁻¹³ cm³ s⁻¹) times the Saha ratio within
  15% by detailed balance; `recombinationEpoch` leaves hydrogen 86% ionized at 4000 K and
  neutral at 3000 K.
- `[extension]` Environment presets and scales (`data/environments.json`: 27 media with their
  sources — US Standard Atmosphere 1976 computed from the seven-layer constants, ocean, NASA
  fact sheets, the Bahcall solar model, Draine 2011, Planck 2018, ITER; `data/critical-points.json`),
  served by `GET /catalog` as `environments` and `environmentScales`. Web: `ScaleSlider` (log
  scale with landmarks) under density, temperature, pressure and radiation fields,
  `EnvironmentPresetPicker` in the setMedium step, pressure and T_γ in the envelope captions,
  `phaseChanged` in the event log. **Why:** stage 3, "sliders with landmarks and presets will be
  the coolest part". **Verification:** `environments.test.ts` (bilingual, known species, Earth
  presets on the ideal gas law within 3%, ascending landmarks), `scale.test.ts`,
  `plan-edits.test.ts`, `influence-visual.test.ts`, browser check.
- `[modification]` `bindingEnergyInEv` falls back to the NIST ionization energy for atoms outside
  the catalog (`atomic-processes.ts`). **Why:** it returned 0 for `atom:36:84:0`, which called
  every such atom plasma and gave it no Saha balance. **Verification:** `aggregate-state.test.ts`
  (krypton), `medium-charge-balance.test.ts` and `nuclei-and-atoms.test.ts` unchanged.
- `[extension]` Templates `waterPhases`, `carbonDioxideOnPlanets`, `recombinationEpoch`.
  **Why:** the laws above at work in preset media. **Verification:** `aggregate-state.test.ts`,
  `template-languages.test.ts`.
- `[modification]` Web redesign after the designer's builder concept, applied through shared
  pieces so every page changes with it. **What:** design tokens in `styles.css` (paper, ink, teal
  #0E7C6B, hairlines, operation colours, radii 24/20/16/14), white top bar with a segmented nav,
  pill draft tabs; one value field with a source chip «число / параметр / пресет» instead of three
  controls (`number-or-parameter-input.tsx`, plan parameter values through
  `PlanParametersContext`); `Subsection` frames; step cards with an operation tile, summary and
  round actions; influence fields grouped into components table, conditions (one per row),
  vector groups and targets (`groupInfluenceParameters`); logarithmic scales drawn as SVG with
  decade ticks, landmark names that never overlap and one handle per value (`scale.ts`,
  `scale-slider.tsx`); experiment card with run settings, parameter table with the steps that use
  each parameter (`parameterUsage`) and units (`unitOfParameter`); species symbols N₂, CO₂, ⁴⁰Ar
  (`species.ts`); the plan schema on a pan-and-zoom canvas (`plan-schema.tsx`) sticky beside the
  builder and reused in template and result summaries; `usePanZoom` and `ZoomToolbar` shared
  with the system stage; on narrow screens the builder switches between Steps and Schema tabs and
  the top bar scrolls. Headings stay in Google Sans. **Why:** the user asked to apply the concept
  everywhere through reused elements, keep Google Sans, make the schema sticky with zoom and
  drag instead of shrinking text, put conditions one per row and give small screens tabs.
  **Verification:** web tests `species`, `scale`, `presets`, `plan-edits`, `influence-visual`;
  headless Chrome screenshots at 1440 and 420 px; `pnpm check`.
- `[modification]` System player details (`system-player.tsx`, `environment-summary.tsx`): the
  environment is shown as cards per aspect (shared or for named particles) with the medium's
  conditions and components as chips instead of raw JSON; events and environment share the width
  in two equal columns, particle cards run below in one grid with labels and values aligned; the
  player uses the shared `species.ts` symbols; the stage is a quarter lower (`STAGE_HEIGHT` 500 →
  375). **Why:** the user found the details cramped with too many line breaks and asked for a
  lower stage. **Verification:** headless Chrome screenshot of `carbonDioxideOnPlanets`,
  `pnpm check`.
- `[modification]` System player layout (`system-player.tsx`): the stage takes two thirds of the
  width and a side panel the last third at the same height with its own scroll: what happened
  (events, conserved totals), the environment cards and the particles as collapsible cards (open
  while there are at most three). `STAGE_HEIGHT` 375 → 650 so the narrower stage is 15% taller
  than before; below 1000 px the panel goes under the stage. **Why:** the user asked for the
  particles, medium and influences described beside the visual, a 2:1 split, a more compact view
  and a scrollable right part. **Verification:** headless Chrome screenshot of
  `waterInHydrogenBubble`, `pnpm check`.
- `[extension]` `ParticleView.phase` and `phaseEstimated` (`experiment-result.ts`,
  `system-reporter.ts`): every live particle in a medium carries its aggregate state in the
  frame. **Why:** the side panel shows each particle's phase with the conditions and the law
  behind it. **Verification:** `aggregate-state.test.ts`, `pnpm check`.
- `[modification]` System player after the designer's mock (`system-player.tsx`,
  `step-card.tsx`, `particle-card.tsx`, `environment-summary.tsx`, `particle-text.ts`): numbered
  shot chips; a step bar with one segment per step (done, current in the operation's colour, to
  come) instead of the range slider and the duplicated step line; in the side panel the step told
  in words under a strip of its operation colour with the collapse odds, the conserved totals as
  four tiles with faded zeros, the environment as cards with conditions as key and value and the
  components as rows with family-coloured avatars, and the particles as cards with an avatar, a
  phase badge and note, composition tiles, energy and structure rows and motion chips; captions
  «атом · в покое · газ» under the nodes on the stage. **Why:** the user asked to build the mock
  made in Claude Design. **Verification:** headless Chrome screenshots, `pnpm check`.
- `[modification]` Icons `evolve` (a plain hourglass) and `propagate` (an hourglass on the front
  face of a cube) in `sml-icons.json`, so every place that uses them changes at once. **Why:** the
  user disliked both. **Verification:** rendered preview.
- `[modification]` Clicks on a scale no longer reach the label around it (`scale-slider.tsx`);
  enabling the radiation temperature copies the medium temperature resolved from its parameter
  (`step-editor.tsx`). **Why:** the browser forwarded a click on the scale to the label's first
  control, the «задано» checkbox, so the pressure and radiation fields switched off and the scale
  vanished. **Verification:** a real mouse click on the pressure scale in headless Chrome keeps
  the field set and moves the value.
- `[modification]` `recombinationEpoch` takes one parameter `temperatureInKelvin` for matter and
  radiation instead of `radiationTemperatureInKelvin`. **Why:** the medium temperature showed up
  bound to a parameter named after the radiation, which read as a wrong value. **Verification:**
  `aggregate-state.test.ts`, `template-languages.test.ts`.
- `[modification]` Step bar segments keep their operation colour when done and when current (the
  current one is thicker with a halo); the result header puts the description, run settings,
  parameters and report on two thirds and the schema on the last third (`plan-summary.tsx`);
  environment cards use a real border so the header strip no longer hides the top edge.
  **Why:** user feedback on the result page. **Verification:** headless Chrome screenshots,
  `pnpm check`.
- `[modification]` Schema bands wrap their nodes with a margin (`plan-diagram.tsx`: the node
  radius plus padding instead of the row height minus an inset), and lifelines end at the band's
  bottom edge (an earlier tail past the last step was removed at the user's request). **Why:** a medium
  set for one molecule at the last step drew a box the node barely fitted in, so the molecule did
  not read as inside the medium. **Verification:** headless Chrome screenshots of a single
  molecule and of the nested bubble, `pnpm check`.
- `[modification]` Influences on the schema (`plan-diagram.tsx`): one source badge on the edge of
  the influence's band with a ray and arrowheads to a hit dot on every lane it acts on, instead
  of an influence icon drawn on each particle's lifeline. **Why:** the icon on the lifeline read
  as a step of the particle itself and the influence looked as if it acted on nothing.
  **Verification:** headless Chrome screenshots of a single molecule and of the nested bubble.
- `[modification]` The influence source badge with arrows is withdrawn: influences are drawn on
  the lanes they act on again, since a node on the same vertical as a particle reads as acting on
  it. Lanes are wider (88) and the title gutter longer (172) so lane captions and long step titles
  no longer collide with each other or with a band. **Why:** user decision after reading the
  schema again. **Verification:** headless Chrome screenshot.
- `[modification]` An environment step placed before any particle exists draws its influence node
  dashed on the lanes created later inside its band (`plan-diagram.tsx`), and the targets of
  environment influences explain that nothing picked means a shared environment that every
  particle created later lands in (`target-picker.tsx`, `isEnvironmentInfluence`). **Why:**
  templates that set the medium first looked broken: the schema had no icon for those steps and
  the targets said «create a particle above». **Verification:** headless Chrome screenshot of
  `waterFromAtoms`-style plans, web tests.
- `[modification]` Every environment aspect gets its own envelope on the stage
  (`environment-envelopes.ts`): envelopes nest by the particles they act on and, for the same
  particles, by the order they were set, the earlier outside; nested shared envelopes widen by
  their depth (`system-stage.ts`). `[extension]` `SystemFrame.environmentOrder` carries that
  order, because Postgres JSONB reorders object keys. **Why:** a temperature set at step 1 and a
  medium at step 2 merged into one envelope with two captions instead of the medium nested in the
  temperature. **Verification:** `environment-envelopes.test.ts`, headless Chrome screenshot of
  `microwaveWaterVapor`.

## 2026-10-18

- `[extension]` Live run progress (`runExperimentAsync`, `ExperimentRunner.runAsync`,
  `RunProgress.phase` `measuringFirstShot | running | tracing`, `meanShotMilliseconds`,
  `remainingMilliseconds` from `updatedRunningMean` in `libs/utils`; `POST /api/runs/stream`
  answering newline-delimited JSON `RunStreamMessage`s; web `startRunWithProgress` and
  `RunStatus`). **Why:** the user wanted to watch a run: «Измерение первой симуляции» during the
  first shot, then the remaining time and «Симуляция n / N». Streaming HTTP replaces a WebSocket
  because it passes the Vite proxy and the desktop app's `app://` protocol without a socket
  server. **Verification:** `run-progress.test.ts` (first shot, then the remaining time from the
  running mean, then tracing), browser run.
- `[extension]` Step timing and forecasts: `ExperimentResult.stepMeanMilliseconds` (persisted in
  `run_results`), `POST /api/runs/estimate` with a pilot run (`estimateRun`), template complexity
  measured by `pnpm measure:templates` into `templates/complexity.generated.json` and served as
  `TemplateSummary.complexity`; web: `RunForecast` and step weight bars in the builder, total
  time and the share of each step in a shot on the result, time per shot in the template list and
  a forecast for the chosen shot count on the template card (`formatMilliseconds`). **Why:** the
  user asked for the weight of every operation, a duration forecast that counts the shots, the
  total time on the result page and the complexity of templates. **Verification:**
  `run-progress.test.ts` (one mean time per step, forecast = mean shot × shots + traces), browser check of `saltInWater`.
- `[modification]` Association forms the bond order that pairs every free valence of both partners
  (`molecular-association.ts`): C + O gives C=O, CO + O gives O=C=O, N + N gives N≡N.
  **Why:** single bonds only left CO₂ and N₂ unreachable. **Verification:** `chemistry.test.ts`;
  `molecular-association.test.ts` unchanged.
- `[extension]` Groups: `create*` steps take `count` up to `MAXIMUM_GROUP_SIZE` (10 000); the
  compiler expands a group into members (`withGroups`, `groupMemberLabels`) that the runtime treats
  as separate particles; the builder has a Count field, group targets show as one pill with the
  first five members and the rest by number (`labelGroups`, `GROUP_MEMBERS_SHOWN`); the plan
  diagram draws a group as three coins and «создано N объектов». Existing plans keep working:
  `count` is optional. **Why:** the user wanted to create a hundred particles in one step without
  breaking anything. **Verification:** `plan-compiler.test.ts` (groups), `plan-edits.test.ts`,
  `plan-diagram.test.ts`.
- `[modification]` Stage layout (`system-stage.ts`): at most six particles per row, particles in
  identical states (family, symbol, readings) fold into one group node that expands on click,
  links between collapsed groups are bundled, links from an expanded group lead into a collapsed
  one, reacting particles move into the heaviest product instead of meeting at a point, repeated
  events fold into one line with a count (`foldedEvents`); the target picker keeps chips at a fixed
  height and lists group members in a panel. **Why:** user screenshots of crowded and crooked
  stages and pickers. **Verification:** `system-stage.test.ts` (rows, groups, bundles, reactions,
  folded events), browser screenshots.
- `[extension]` Atom transfer by the bond-energy–bond-order method and transition-state theory
  (`molecules/atom-transfer.ts`): Johnston–Parr barrier with a half Sato triplet repulsion and
  noble-gas Lennard-Jones wells fitted to viscosity (`data/noble-gas-wells.json`, Hirschfelder,
  Curtiss and Bird 1954), a symmetric activated complex and path degeneracy; the chain of
  `molecular-dynamics.ts` takes these channels beside joins and breaks. Carbon allotropes on their
  phase diagram (`data/allotropes.json`: Kennedy and Kennedy 1976, Ghiringhelli et al. 2008),
  `ParticleView.allotrope` and allotrope phase events. Templates `carbonBurnsInOxygen`,
  `hydrogenOxygenIgnition`, `methaneFarm`, `carbonVaporClusters`, `carbonInAtomicOxygen`,
  `primordialSoup`, `diamondUnderPressure` in the new `chemistry` category. **Why:** the user asked
  for fire, burning carbon, diamond under pressure, carbon clusters and particle soups by general
  laws. **Verification:** `chemistry.test.ts`: transfer rates obey detailed balance to the
  precision of the saddle search, barriers stay at or above the reaction energy, a spark atom
  survives with probability exp(−k n t), carbon in atomic oxygen and the soup end in the shares
  their chains predict at five sigma, graphite and diamond on either side of the Kennedy line.
- `[extension]` Solutions (`molecules/solution-chemistry.ts`, `data/solutions.json`,
  `marcus1991/`, `iapws/`): a Born–Haber cycle in water with Marcus hydration Gibbs energies
  rescaled by the Born factor of the Malmberg–Maryott permittivity, the IAPWS R11-24 ionization
  constant of water, pH from charge balance and the dissociated share of each solute; anions of
  charge −1 for atoms with a CRC electron affinity; phase `solvated`; `measureSystem` records `pH`.
  Influence `electrolyze` (`voltageInVolts`, `currentInAmperes`, `durationInSeconds`): Faraday's
  law, molecules above the decomposition voltage from their bond energies split into their
  elements. Templates `saltInWater`, `acidStrength`, `waterElectrolysis`. **Why:** the user asked
  for dissolving in water, acidity from fundamental laws and electrolysis. **Verification:**
  `solutions.test.ts`: the IAPWS R11-24 test table, neutral water at pKw/2, salt and HCl dissolve
  while HF stays whole, water splits above the electrolysis threshold and not below.
- `[extension]` Finite media (`environment/medium-extent.ts`): `MediumAspect.thicknessInMeters` is
  the diameter of a ball the medium fills and `absorbedEnergyInJoules` what it took in; heat
  capacity by Dulong–Petit for condensed matter and the internal energy of gas molecules; photon
  attenuation from Verner photoionization and Klein–Nishina; Bethe stopping with the Bloch mean
  excitation and the range; absorbed energy heats the medium and moves its ideal-gas pressure;
  `setMedium` gains `thicknessInMeters` and per-component `densityLaw` (`given` or
  `thermalEquilibrium`). Templates `gammaShield`, `alphaInWater`, `xrayHeatsWater`. **Why:** the
  user asked for absorption by the medium and its heating, which needs a thickness.
  **Verification:** `medium-extent.test.ts`: 9k per liquid water molecule and warming by E/C, a
  5 MeV alpha stopped near its ASTAR range, gamma escape from a lead ball as exp(−μr) by Monte
  Carlo, the X-ray energy left in a water ball.
- `[extension]` ENDF/B-VIII.0 neutron data (`pnpm fetch:endf`, `pnpm generate:endf`,
  `libs/constants/src/endf.ts`, `endf.generated.json`; the archives are gitignored), neutron
  transport and fission (`collisions/neutron-transport.ts`): cross sections above the resolved
  resonances with 1/v below, elastic scattering with the ENDF mean cosine, prompt neutrons per
  fission, the prompt fission neutron spectrum as quantiles, independent fission yields and AME
  masses for the energy release, leakage through the ball of the medium. Transport applies only inside a
  medium with a thickness; an infinite medium keeps the thermal REACLIB chain (an earlier draft
  claimed every neutron and stopped `firstNucleiAfterBigBang` at the neutron, caught by
  `nucleosynthesis.test.ts`). Templates
  `uraniumChainReaction`, `naturalUraniumChainDies`. Postgres was considered for the data and
  declined: 6.4 MB sit in memory, a run makes millions of lookups and the engine stays free of a
  database. **Why:** the user asked for an atomic bomb chain reaction and to load all of NNDC.
  **Verification:** `fission.test.ts`: the evaluated ²³⁵U fission cross section, prompt
  neutrons and yields; charge and baryon number conserved; the chain grows in a large ²³⁵U ball and
  dies in a small one and in natural uranium.
- `[extension]` Deconfinement (`particles/deconfinement.ts`, PDG `qcdCrossoverTemperatureInGev`
  from HotQCD 2019): above the crossover hadrons, nuclei and the nuclei of atoms melt into their
  quarks with Maxwell–Jüttner momenta, free quarks and gluons are not hadronized, phase
  `quarkGluonPlasma`, and a component with `densityLaw: thermalEquilibrium` takes the ideal quantum
  gas density with spin, helicity and colour degeneracy. Template `quarkGluonSoup`. **Why:** the
  user asked what forbids deconfinement and to build it. **Verification:** `deconfinement.test.ts`:
  gluons at the density of a massless Bose gas, nucleons melt above the crossover and bind back
  below it.
- `[extension]` Electrolysis in the influence selector: category «Электричество и химия» and a
  fallback category «Другие» for any influence no group lists (`influenceCategories` in
  `glossary.ts`). **Why:** `electrolyze` existed in the engine but was missing from the selector.
  **Verification:** browser check.
- `[extension]` Molecule catalogue (`data/molecules.json`, `src/molecule-catalog.ts`): 238
  molecules in 21 categories and 5 groups with written formulas; the 51 first structures keep their
  atom order because templates and presets use their names, the rest are written as SMILES with
  implicit hydrogens by `molecules2.py` in the session scratchpad. UF₆, CuCl₂, nitric and
  perchloric acid are left out because the valence rules cap U at 4, Cu at 1, N at 4 and Cl at 1.
  Mass and linearity come from the structure law, precomputed by `pnpm generate:molecules` into
  `molecules/molecule-traits.generated.json` because building every structure takes seconds;
  radicals follow from electron parity. Russian element names (`data/element-names.json`,
  `ElementEntry.label`), `GET /api/catalog/nuclides/:protons` with the measured NUBASE2020 nuclides
  of one element. **Why:** the user asked for a molecule catalogue by category and more molecules.
  **Verification:** `molecule-catalog.test.ts` (unique keys and structures, configurator rules,
  formulas count the atoms, generated traits equal the structure law), `api.e2e`.
- `[extension]` Species picker (`components/species-picker.tsx`, `species-tree.ts`) after the
  design the user made in Claude Design: a modal over a blurred backdrop with matter or antimatter
  and eight classes, particles with family chips, atoms (neutral, ions, isotopes) and nuclei by
  element on a periodic table placed by the Madelung filling order, isotopes with half-life, decay
  mode and spin, molecules by group and category with masses, ready mixtures from the preset media,
  search over every species, the viewer's recent picks (localStorage), breadcrumbs and a back
  button. It opens from a medium component, from «Добавить компонент» and in the create-molecule
  step, where a catalogue molecule fills atoms and bonds and each atom row picks its element and
  isotope (`moleculeFromSpecies`, `atomFromSpecies`), and in the create-atom step, which picks a
  neutral atom, any cation from +1 to Z−1 or an isotope (`atomStepFields`), and in the
  create-nucleus step, which picks an element and a nuclide on the nuclei screen (`nucleusStepFields`).
  The server-side species search box of these two steps is removed. The design's «Фермионы: кварки и адроны» card
  became separate quark and hadron cards because mesons are bosons. `[modification]` The species
  symbol resolver prefers the catalogue formula (HCl, NaCl rather than the Hill order ClH, ClNa);
  `formatSymbol` drops the «Meson» suffix (η, ω, φ); `formatMass`. **Why:** the user could not add
  an acid or any species they liked to a medium and asked for this picker, then for the same
  picker in the molecule step. **Verification:** `species-tree.test.ts`, `species.test.ts`,
  `molecule-edits.test.ts`, `format.test.ts`, browser checks at 1440 and 375 px.
- `[modification]` Aggregate state of molecules beyond the critical-point table
  (`data/phase-points.json`, `data/joback1987.json`, `src/phase-data.ts`,
  `environment/aggregate-state.ts`, new `environment/group-contribution.ts`, phase `decomposed`,
  `PhaseVerdict.estimateMethod`, `ParticleView.phaseEstimateMethod`). **What:** 219 catalogue
  molecules get normal melting, boiling (or sublimation) and decomposition points, each entry
  naming its source: the CRC Handbook as quoted by PubChem, NIST WebBook averages, the Merck Index,
  Hawley's and PhysProp, Wikipedia chemboxes for the rest (the scripts sit in the session
  scratchpad); eight catalogue species with no quoted point at 1 atm (borane, KrF₂, HNO₂, H₂SO₃,
  H₂CO₃, HOCl, HSCN, NaOCl) stay untabulated. Such a molecule follows a Clausius–Clapeyron curve
  through its boiling point with Guldberg's T_c = (3/2) T_b and Trouton's 88 J/(mol K), and is
  `decomposed` above its decomposition point. The heaviest-atom Lennard-Jones estimate is replaced
  for untabulated organic molecules by the Joback–Reid group contributions to Tb, Tm, Tc and Pc,
  and kept for atoms and for molecules no group fits. `substanceKey` refines atom labels (element
  and formal charge) over the bond graph, so isomers (ethanol and dimethyl ether, leucine and
  isoleucine) and charge forms get their own keys; isotopes and atom order are still ignored, and
  the acid–base chains that match their forms by this key keep passing `proton-transfer.test.ts`. The phase event and the particle card name the
  estimate method. Bromine and iodine are now a liquid and a solid at room conditions, so
  electrolysis releases them as atoms and the decomposition voltage of bromides and iodides no
  longer counts the Br₂ and I₂ bonds. **Why:** 18 glycine molecules in a 274 K acid medium read as
  gas from the Lennard-Jones well of their oxygen atom; hydrogen-bonded, zwitterionic and ionic
  substances were badly underestimated, and the catalogue had grown to 238 molecules.
  **Verification:** the old verdicts stay guarded by `aggregate-state.test.ts` (water, carbon
  dioxide, nitrogen and helium on NIST data, the plasma rules, the Lennard-Jones krypton atom, now
  with `estimateMethod: 'lennardJones'`, the water and carbon dioxide templates),
  `chemistry.test.ts` (carbon allotropes) and `environments.test.ts` (light and heavy water on one
  key); new checks: every amino acid and sugar solid at 274 K and 300 K, glycine decomposed at
  600 K, salt solid and molten, ethanol liquid and dimethyl ether gas, every catalogue molecule
  tabulated except the eight above, the Joback–Reid acetone example, beta-alanine solid by group
  contributions, every catalogue isomer on its own key.
- `[extension]` Charged molecules and Brønsted proton transfer. **What:** the molecule name takes
  an optional third part of formal charges per atom (`molecule:atoms;bonds;0+1,4-1`,
  `MoleculeStructure.charges`, `formalChargeOf`, `moleculeCharge`, `hasFormalCharges` in
  `particles/matter.ts`); `particleSpec` gives such a molecule its charge, electrons, a mass q
  electron masses lighter, ions as constituents and a symbol with the charge (`H3O+`, `O4P3−`,
  `C2H5NO2±` for a zwitterion); `validateMoleculeStructure` refuses charges no ion can carry; QEq
  charges add up to the charge of the ion, its dipole is taken about the centre of mass, and
  fragments of a broken bond keep their formal charges. New data `data/acid-base.json` (hand-curated
  from OpenStax Chemistry 2e Appendix H and §14.5 for sulfuric, phosphoric, acetic and formic acid,
  King 1951 via the IUPAC Digitized pKa Dataset v2.4 for glycine; the source pages and the glycine
  rows copied in `data/acid-base/`), read by `ACID_BASE_SYSTEMS` in `chemistry-data.ts`. New law
  `molecules/proton-transfer.ts`: each system becomes a chain of forms built as charged molecules,
  recognised by bond graph, the catalogue molecule joining the form with as many protons; shares
  by the law of mass action with complete steps; `HYDRONIUM`, `HYDROXIDE`. `solution-chemistry.ts`:
  `SolutionChemistry.equilibrate` samples the form of a chain molecule at the pH of its medium,
  the proton going to or coming from H₃O⁺ and OH⁻ of the water, which stay in the solvent;
  `mediumAcidity` adds the mean charge of every chain component and the charge of free molecular
  ions to its charge balance and reads an explicit H₃O⁺ or OH⁻ component as the pH. Ions and
  zwitterions in water are `solvated`, a charged molecule outside a solvent is plasma, and
  formal-charged molecules skip gas chemistry. Template `glycineAcrossPh`. Web: species symbols
  show the charge of a molecular ion (`species.ts`). `[modification]` The system note of
  `measureSystem` splits the composition only at a `+` that starts a new species
  (`system-reporter.ts`), so cations such as `23Na+` and `C2H6NO2+` keep their sign in the text.
  **Why:** glycine in sulfuric acid stayed a neutral molecule: the engine had no molecular ions,
  split only diatomic M–X, and H₂SO₄, H₃PO₄ and carboxylic acids never dissociated; the user asked
  whether an amino acid in a hard acid should stay unchanged. **Verification:**
  `proton-transfer.test.ts`: neutral names unchanged and charged names round-trip, ion specs,
  structures and fragments; equal shares at pH = pKa to 1e-12; the pH of 0.1 M H₂SO₄ against the
  closed-form root of its charge balance and of 0.1 M H₃PO₄ against its three-step balance to 1e-9;
  glycine a cation in sulfuric acid, a zwitterion in water and an anion in NaOH; seeded Monte Carlo
  of 10 000 equilibrations of glycine at pH = pKa₁ and of phosphoric acid at pH = pKa₂, and the
  template's three solutions, at five sigma. `acid-base.test.ts` (constants): every Ka and pK equals
  its verbatim source. Old behaviour guarded by `solutions.test.ts` (IAPWS table, neutral water,
  NaCl, HCl and HF, both templates and electrolysis unchanged) and the rest of `pnpm check`.
- `[modification]` Carry-over folds identical survivors into groups (`carry-over.ts`,
  `foldIdenticalSteps`, `groupBaseOf`): create steps that match in everything but the label become
  one step with a count, named the way the engine names the species (`moleculeCH4`, `atomFe56`,
  `ionNa23plus1`) and moved to a free label when that name or a member name is taken; particles
  that entanglement or a probability cloud names stay single. **Why:** the user carried a soup
  over and got 37 steps, one per particle, with an unreadable schema. **Verification:**
  `carry-over.test.ts`; browser: `primordialSoup` carried over as 3 groups of 6 instead of 18
  steps.
- `[extension]` Molecular ions in the builder and on carry-over. **What:** `CreateMoleculeStep`
  takes an optional `charges` list of formal charges (`MoleculeFormalCharge { atom, charge }`,
  ajv: integer charge, atom index ≥ 0) that `moleculeStructureOfStep` passes to the molecule name,
  zero entries dropped; a plan without it creates the same neutral molecule as before. Web:
  `molecule-edits.ts` reads the third part of a molecule name (`moleculeFromSpecies`), sets and
  clears a formal charge per atom (`withFormalCharge`, `withFormalCharges`), shifts charges when
  an atom is removed (`withoutAtom`, moved here from the component) and writes the ion charge
  (`moleculeChargeText`); the configurator has a −1/0/+1 charge select per atom (no +1 on
  hydrogen) and shows the charge after the Hill formula, as does the plan diagram caption.
  `carry-over.ts` reads a molecule through `moleculeFromSpecies`, so a carried-over ion keeps its
  charges. `[modification]` `formatOutcome` splits an outcome only at a `+` that starts a new
  species (`/\+(?!\+|$)/`, as the engine composition note) and only when the outcome is not a
  number, so `C2H6NO2+` stays whole and `23Na++35Cl-` and `4He+4He` are split. **Why:** the engine
  supported charged molecules but a plan could not create H₃O⁺, OH⁻ or a zwitterion directly, a
  carried-over ion became neutral, and cation outcomes were garbled. **Verification:**
  `plan-compiler.test.ts` (OH⁻ and H₃O⁺ by name and charge, no or zero charges stay neutral,
  impossible and fractional charges refused), `molecule-edits.test.ts`, `carry-over.test.ts` (H₃O⁺
  with its charge, water without), `format.test.ts` (cations, ion pairs, particle names, numbers
  `-0.5` and `1e+21` unchanged); old behaviour guarded by the existing configurator, carry-over
  and plan-diagram tests; browser: OH⁻ created in the builder and validated.
- `[extension]` Stopping a run: `RunOptions.shouldStop` is checked before every shot of
  `runAsync`, inside the windows the progress already measures; a stopped run returns the statistics
  of the finished shots with `ExperimentResult.stopped` and `requestedShots` and skips tracing.
  `RUN_STATUSES` gains `stopped` (the startup schema sync adds the enum value); the API keeps a stop
  flag per active run, `POST /api/runs/:id/stop` raises it, the stream opens with a `started`
  message carrying the run id and stops the run when the client disconnects. Web: «Остановить»
  under the live progress, a note on the result with how many shots finished, «остановлен» in
  history. A single shot is not interrupted: the stop lands before the next one. **Why:** the user
  asked for a stop button for runs that take too long. **Verification:** `run-progress.test.ts`
  (stops after the seventh shot with seven counted outcomes and no traces), `api.e2e`
  (a streamed 200 000-shot run stopped through the route ends as `stopped` with fewer shots;
  stopping a missing run answers 409), browser: `primordialSoup` stopped after 1087 of 2000 shots
  and `uraniumChainReaction` after 117 of 200.
- `[extension]` Hints everywhere information is shown (`apps/web/src/hints.ts`, one RU/EN
  dictionary: `HINTS`, `ASPECT_HINTS`, `READING_HINTS`, `CLASS_HINTS`, `KIND_HINTS`, `MODE_HINTS`,
  `decayModeHint`): environment cards (aspect, scope, every condition, component density, reaction
  mode; the medium card now also shows the thickness and absorbed energy of a finite ball),
  conserved quantities, the step eyebrow and collapse odds, particle cards (avatar, label or group,
  phase, composition, every reading, motion chips, quantum state), system player counters, result
  kicker, per-step time, statistic tiles and charts (bars with their range and count, ±σ band,
  mean), plan summary, history rows (with the run time), template list, category chips, parameter
  form, builder fields and schema legend, the duration forecast, and the species picker (card
  metadata, nuclide badges with the decay mode and half-life, class, kind and atom-mode cards,
  chips, quick elements, recent picks, mixture components). The tooltip layer sits above modals
  (z-index 2000) and the periodic table names the hovered element with its weight and
  configuration (`elementSummary`). **Why:** the user found much of the interface unexplained.
  **Verification:** browser check of the side panel, results and picker hints on `saltInWater` and
  the create-nucleus step; web tests.
- `[extension]` Cube experiments with richer pictures (`space-lab.ts`, `quantum-space.ts`,
  `english.ts`, web `space-card.tsx`, `space-view.tsx`, `step-editor.tsx`, `experiment-formula.ts`,
  `glossary.ts`). **What:** potentials `doubleSlit`, `doubleWell` and `box` with the optional
  `SpaceSpec` fields `slitSeparationInMeters`, `slitWidthInMeters`, `wellSeparationInMeters`,
  `boxSizeInMeters` (also on `SpaceSnapshot`); shapes `hydrogen2s`, `hydrogen2p`, `hydrogen3d`,
  `hydrogen1s2p` and `catState`; ten templates in the cube category: `doubleSlitInCube`,
  `electronWaveOnProton`, `tunnelingMovie`, `doubleWellTunneling`, `hydrogenOrbital2s`,
  `hydrogenOrbital2p`, `hydrogenOrbital3d`, `hydrogenDipoleOscillation`, `schrodingerCatInTrap`,
  `quantumCarpetInBox`, most of them several `propagate` frames so the player animates the cloud;
  momenta, trap widths, the Lyman-alpha beat and the box revival time come from CODATA (the box
  revival uses the box plus one cell, where the grid wave vanishes). The builder edits the new
  geometry and shapes, both cube views draw the slit wall, the wells and the box, the formula
  panel writes the new potentials and orbitals. Existing plans are unchanged: the new contract
  values and fields are optional. **Why:** the user asked for more and harder cube experiments with
  interesting visualisations. **Verification:** `space-shapes.test.ts`: grid moments of 2s, 2p and
  3d against ⟨r⟩ = 6a, 5a, 10.5a within 3% and ⟨z²⟩ = 3⟨x²⟩ for 2p, the 1s + 2p dipole 0.745 a₀ and
  its flip after half a period, the double-well transfer and return, the mirror revival in the box,
  cat fringes at a quarter period, a central maximum and side fringes behind the slits, refusal of
  impossible geometries; `space.test.ts` unchanged; browser check of the slit, cat and 3d frames.
- `[modification]` SpaceLab caches are shared by every engine in the process and the potential peak
  is memoised (`space-lab.ts`). **Why:** traced shots build fresh engines, so a template whose
  evolution takes seconds recomputed it for every trace (the double well: 33 s for 200 shots);
  the caches depend only on the physics, never on the random source. **Verification:**
  `space.test.ts` and `space-shapes.test.ts` give the same numbers; the double well now costs one
  evolution, about 5 s, then 0.04 ms per shot.
- `[modification]` The pilot forecast times the first shot apart (`estimateRun`,
  `RunEstimate.firstShotMilliseconds`, optional `TemplateComplexity.firstShotMilliseconds`,
  `measure-templates.ts`, the template card): predicted = first shot + mean of the later shots ×
  (shots − 1) + traces, and the pilot always runs at least one later shot. **Why:** a cube template
  computes its evolution once in the first shot (4.6 s for the double well) and then reuses it, so
  a mean over a one-shot pilot forecast hours for 10 000 shots that take seconds. **Verification:**
  `run-progress.test.ts` (forecast identity), complexity regenerated with `pnpm measure:templates`.
