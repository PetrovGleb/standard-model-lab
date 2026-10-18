# Naming

## Identifiers

- Plain English words. No Greek letters, no single-letter math symbols. `lorentzFactor`,
  `fineStructureConstant`, `polarAngleDegrees`, `reducedPlanckConstant`.
- Physical quantities end with their unit: `massInGev`, `widthInGev`, `meanLifeInSeconds`,
  `temperatureInKelvin`, `fieldInTesla`, `numberDensityPerCubicMeter`, `positionInFemtometers`.
  Dimensionless ratios say what they are: `electricChargeInElementaryUnits`,
  `spinInReducedPlanckUnits`, `branchingFraction`.
- Constants are `UPPER_SNAKE_CASE`, classes and types `PascalCase`, interfaces without an `I`
  prefix, everything else `camelCase`.
- Unit abbreviations that are universal are allowed inside names: `GEV`, `MEV`, `EV`, `HZ`,
  `KG`. Symbols are not: `u` becomes `ATOMIC_MASS_UNITS`, `c` becomes `SPEED_OF_LIGHT`,
  `h-bar` becomes `REDUCED_PLANCK_CONSTANT`.

## CODATA constant names

`toConstantName` in `libs/constants/src/constant-name.ts` maps each NIST quantity name:

1. Abbreviations are spelled out: `mag. mom.` → magnetic moment, `gyromag.` → gyromagnetic,
   `h-bar` → reduced planck constant, `times c` → times speed of light, `in u` → in atomic mass
   units, `Cs-133` → cesium 133, `/T` → per tesla, `K/T` → kelvin per tesla.
2. Parenthesised conditions become `AT ...`: `(273.15 K, 100 kPa)` → `AT_273_15_K_100_KPA`.
3. A hyphen between two particles or units in a ratio or relationship becomes `TO`:
   `proton-electron mass ratio` → `PROTON_TO_ELECTRON_MASS_RATIO`. Elsewhere it is a space:
   `fine-structure constant` → `FINE_STRUCTURE_CONSTANT`.
4. Remaining tokens are upper-cased and joined with `_`.

The generator fails if two names collide. Aliases for frequent constants:

| Alias                           | Generated name                                                      |
| ------------------------------- | ------------------------------------------------------------------- |
| `SPEED_OF_LIGHT`                | `SPEED_OF_LIGHT_IN_VACUUM`                                          |
| `GRAVITATIONAL_CONSTANT`        | `NEWTONIAN_CONSTANT_OF_GRAVITATION`                                 |
| `WEAK_MIXING_ANGLE_SIN_SQUARED` | `WEAK_MIXING_ANGLE`                                                 |
| `ELECTRON_VOLT_IN_JOULES`       | `ELECTRON_VOLT`                                                     |
| `ATOMIC_MASS_UNIT_IN_KILOGRAMS` | `UNIFIED_ATOMIC_MASS_UNIT`                                          |
| `ATOMIC_MASS_UNIT_IN_MEV`       | `ATOMIC_MASS_CONSTANT_ENERGY_EQUIVALENT_IN_MEV`                     |
| `ELECTRON_MASS_IN_KILOGRAMS`    | `ELECTRON_MASS`                                                     |
| `ELECTRON_MASS_IN_MEV`          | `ELECTRON_MASS_ENERGY_EQUIVALENT_IN_MEV`                            |
| `MUON_MASS_IN_MEV`              | `MUON_MASS_ENERGY_EQUIVALENT_IN_MEV`                                |
| `TAU_MASS_IN_MEV`               | `TAU_ENERGY_EQUIVALENT`                                             |
| `PROTON_MASS_IN_MEV`            | `PROTON_MASS_ENERGY_EQUIVALENT_IN_MEV`                              |
| `NEUTRON_MASS_IN_MEV`           | `NEUTRON_MASS_ENERGY_EQUIVALENT_IN_MEV`                             |
| `ELECTRON_COMPTON_WAVELENGTH`   | `COMPTON_WAVELENGTH`                                                |
| `RYDBERG_ENERGY_IN_EV`          | `RYDBERG_CONSTANT_TIMES_PLANCK_CONSTANT_TIMES_SPEED_OF_LIGHT_IN_EV` |

Names already fine as generated: `PLANCK_CONSTANT`, `REDUCED_PLANCK_CONSTANT`,
`ELEMENTARY_CHARGE`, `BOLTZMANN_CONSTANT`, `AVOGADRO_CONSTANT`, `FINE_STRUCTURE_CONSTANT`,
`FERMI_COUPLING_CONSTANT`, `VACUUM_ELECTRIC_PERMITTIVITY`, `VACUUM_MAGNETIC_PERMEABILITY`,
`BOHR_MAGNETON`, `NUCLEAR_MAGNETON`, `BOHR_RADIUS`, `RYDBERG_CONSTANT`, `ELECTRON_G_FACTOR`,
`ELECTRON_MAGNETIC_MOMENT`, `ELECTRON_GYROMAGNETIC_RATIO`, `THOMSON_CROSS_SECTION`.

## PDG names

Keys in `pdg2026.json` are camelCase phrases: `massesInGev.wBoson`, `widthsInGev.top`,
`meanLivesInSeconds.muon`, `ckmMagnitudes.upStrange`, `wolfenstein.expansionParameter`,
`neutrinoOscillation.mixingAngle13SinSquared`.

## Particle names

`ParticleName` is the closed union in `libs/contracts/src/particle-spec.ts`: `electron`,
`positron`, `muon`, `antiMuon`, `electronNeutrino`, `electronAntineutrino`, `up`, `antiUp`,
`photon`, `gluon`, `wPlus`, `wMinus`, `zBoson`, `higgsBoson`, `proton`, `antiProton`, and so on.
Inclusive decay products are `hadrons` and `invisible`.
