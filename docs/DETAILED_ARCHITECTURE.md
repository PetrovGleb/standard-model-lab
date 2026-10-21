# Detailed architecture

This is the feature-by-feature breakdown of the engine: every data source and the file it feeds,
every law with its inputs, every kind of interaction, the API, the database and the web views.
`docs/ARCHITECTURE.md` is the map; this document is the territory. `docs/EVOLUTION.md` records why
each piece exists. Since 2026-10-17 the architecture is closed for modification and open for
extension: a new law, influence, aspect, mechanism, template or data file is added through the
registries and contracts named here, and an existing contract or law changes only with an entry in
`docs/EVOLUTION.md` and tests that guard what must stay.

## 1. Data sources

Numbers are never retyped. Each source is copied verbatim into `libs/constants/data`, a generator
turns it into a typed artefact, and the engine reads only the artefact.

| Source                                                                                      | Verbatim file                                                                                   | Generator (`pnpm …`)                      | Artefact                                                                                  | Consumers                                                                                                                 |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| NIST CODATA 2022                                                                            | `codata2022.json`, `codata2022_allascii.txt`                                                    | `generate:codata`                         | `src/codata.generated.ts`                                                                 | every formula; `codata-aliases.ts` adds short names                                                                       |
| PDG 2026 (transcribed in `STANDARD_MODEL_REFERENCE.md`)                                     | `pdg2026.json`                                                                                  | none                                      | `src/pdg.ts`                                                                              | quarks, leptons, bosons, 25 mesons, 42 baryons, CKM, PMNS, branching fractions, isospin                                   |
| NUBASE2020, AME2020                                                                         | `nubase2020/nubase_4.mas20.txt`, `ame2020/mass_1.mas20.txt`                                     | `generate:matter`                         | `matter.generated.json` → `particles/matter.ts`                                           | 3558 nuclides: mass excess, half-life, spin-parity, decay modes, abundance                                                |
| NIST ASD ionization energies, isotopic compositions                                         | `nist-asd/ionization-energies.csv`, `isotopic-compositions.txt`                                 | `generate:matter`                         | `matter.generated.json`                                                                   | 110 elements: ionization stages, ground levels and shells, default isotopes                                               |
| NIST ASD lines                                                                              | `nist-asd/lines/*.csv` (14 species)                                                             | `generate:matter`                         | `matter.generated.json`                                                                   | laser-cooling transitions (`LaserCool`)                                                                                   |
| Verner et al. 1996 (`phfit2.f`)                                                             | `verner1996/phfit2.f`                                                                           | `generate:matter`                         | `matter.generated.json`                                                                   | photoionization shell fits up to zinc (`radiation/photon-absorption.ts`)                                                  |
| Voronov 1997 (`cfit.f`)                                                                     | `voronov1997/cfit.f`                                                                            | `generate:matter`                         | `matter.generated.json`                                                                   | electron-impact ionization, Z = 1–28 (`medium-charge-balance.ts`)                                                         |
| UFF, Rappé 1992 (RDKit table)                                                               | `uff/Params.cpp`                                                                                | `generate:matter`                         | `matter.generated.json`                                                                   | 127 atom types: radii, angles, force constants, Lennard-Jones, electronegativity (`molecular-structure.ts`)               |
| OpenStax Chemistry 2e §7.5                                                                  | `bond-energies/openstax-chemistry-2e-7-5.html`                                                  | `generate:matter`                         | `matter.generated.json`                                                                   | 68 bond energies (dissociation, association)                                                                              |
| Bosch–Hale 1992, Solar Fusion II 2011                                                       | `nuclear.json` (hand-curated), `solar-fusion-ii/1004.2318.pdf`                                  | none                                      | `src/nuclear.ts`                                                                          | 10 fusion S-factors for beams and as medium fallback, 3 NIST 1/v neutron captures, bound scattering                       |
| JINA REACLIB (Cyburt et al. 2010), snapshot 2025-03-30 via pynucastro 3.1.0                 | `reaclib/reaclib_default2_20250330`                                                             | `generate:reaclib`                        | `reaclib.generated.json` → `src/reaclib.ts`                                               | 37 454 reactions between NUBASE nuclei, two- and three-body rates and photodisintegration (`collisions/reaclib-rates.ts`) |
| US Standard Atmosphere 1976, NASA fact sheets, Bahcall 2005, Draine 2011, Planck 2018, ITER | `environments.json` (hand-curated, USSA computed from the layer constants)                      | none                                      | `src/environments.ts`                                                                     | 27 preset media with sources and the landmarks of the density, temperature and pressure scales (`GET /catalog`)           |
| NIST Chemistry WebBook, CRC Handbook 97th ed.                                               | `critical-points.json` (hand-curated)                                                           | none                                      | `src/phase-data.ts`                                                                       | critical, boiling, melting and triple points of 11 substances (`environment/aggregate-state.ts`)                          |
| CRC Handbook, NIST WebBook, Merck, Hawley's, PhysProp, Wikipedia                            | `phase-points.json` (curated from PubChem and NIST)                                             | none                                      | `src/phase-data.ts`                                                                       | melting, boiling and decomposition points of 219 catalogue molecules (`environment/aggregate-state.ts`)                   |
| Joback and Reid 1987                                                                        | `joback1987.json` (hand-curated)                                                                | none                                      | `src/phase-data.ts`                                                                       | 41 group contributions to Tb, Tm, Tc, Pc (`environment/group-contribution.ts`)                                            |
| NNPDF2.3 LO QED (LHAPDF)                                                                    | `pdf/NNPDF23_lo_as_0130_qed/*`                                                                  | `generate:pdf`                            | `pdf/nnpdf23-lo-qed.generated.json`                                                       | parton distributions and α_s (`collisions/parton-distributions.ts`)                                                       |
| PYTHIA 8.3 Monash tune                                                                      | `string-fragmentation.json`                                                                     | none                                      | `src/string-fragmentation.ts`                                                             | Lund string parameters, diquark masses, remnant shapes                                                                    |
| ENDF/B-VIII.0 (Brown et al. 2018), NNDC neutron and fission-yield sublibraries              | `endf/ENDF-B-VIII.0_neutrons.zip`, `endf/ENDF-B-VIII.0_nfy.zip` (gitignored, `pnpm fetch:endf`) | `generate:endf`                           | `endf.generated.json` (`src/endf.ts`)                                                     |
| Kennedy and Kennedy 1976, Ghiringhelli et al. 2008 (carbon allotropes)                      | `allotropes.json` (hand-curated)                                                                | none                                      | `src/phase-data.ts`                                                                       |
| Hirschfelder, Curtiss and Bird 1954, Table I-A (noble-gas Lennard-Jones wells)              | `noble-gas-wells.json` (hand-curated)                                                           | none                                      | `src/chemistry-data.ts`                                                                   |
| CRC electron affinities, Marcus 1991, Malmberg and Maryott 1956, IAPWS R11-24               | `solutions.json`, `marcus1991/jcs-faraday-87-2995.pdf`, `iapws/R11-24-ionization-constant.pdf`  | none                                      | `src/chemistry-data.ts`                                                                   |
| OpenStax Chemistry 2e App. H and §14.5, King 1951 via the IUPAC digitized pKa dataset v2.4  | `acid-base.json` (hand-curated), `acid-base/*.html`, `acid-base/iupac-pka-v2-4-glycine.csv`     | none                                      | `src/chemistry-data.ts`                                                                   | Brønsted systems: Ka or pKa per step and the sites (`molecules/proton-transfer.ts`)                                       |
| HotQCD 2019 crossover temperature (PDG review Quark-gluon plasma)                           | `pdg2026.json` → `couplings.qcdCrossoverTemperatureInGev`                                       | none                                      | `src/pdg.ts`                                                                              |
| Molecule catalogue: Lewis structures, later entries from SMILES                             | `molecules.json`                                                                                | `generate:molecules` (mass and linearity) | `src/molecule-catalog.ts`, `packages/engine/src/molecules/molecule-traits.generated.json` |
| Russian names of the elements                                                               | `element-names.json`                                                                            | none                                      | `src/element-names.ts`                                                                    |

Generated artefacts carry a `source` string with the citation. `docs/STANDARD_MODEL_REFERENCE.md`
holds the full table of references with equation numbers.

## 2. Constants, units and randomness

- Natural units with energy in GeV inside the engine; environment parameters stay in SI
  (kelvin, tesla, volts per metre, m⁻³). Conversions live in `libs/utils/src/units.ts` and are
  built only from exact CODATA factors.
- Every constant is a `Quantity` (`libs/contracts/src/quantity.ts`): value, uncertainty, unit,
  source. Derived values are computed in code and marked `source: 'derived'`.
- Randomness only through `RandomSource` (`libs/utils/src/random.ts`, xoroshiro128+ with a seed);
  `sampling.ts` adds weighted choice, exponential times, isotropic directions and Gaussians.
- `libs/utils/src/markov.ts`: continuous-time chains by scaling and squaring; the absorbing
  variant keeps the leak to absorbing states apart from the conserved part, so rates that differ by
  thirty orders of magnitude stay exact. `statistics.ts` gives the five-sigma Monte Carlo window.

## 3. Particles

### Catalog and generated matter

`libs/constants/src/particles/catalog.ts` assembles `ParticleSpec` objects: quarks, leptons,
gauge and Higgs bosons, nucleons, light nuclei (d, t, ³He, ⁴He), hydrogen-like atoms and neutral
helium, diquarks, PDG mesons and baryons. Antiparticles come from `conjugateParticleSpec`, never
by hand. Beyond the catalog, `particles/matter.ts` builds specs on demand:

- `nucleus:Z:A` from NUBASE/AME: mass from the mass excess minus electrons and their NIST binding,
  spin and parity, decay channels from the decay modes (β⁻, β⁺/EC, α, p, n, 2n, 3n, delayed
  emissions) renormalised over the modelled channels, half-life → mean life;
- `atom:Z:A:charge` from NIST: ionization stages, ground level term (J, Landé g), electron count;
  `maximumValence` from the outer shell and the UFF oxidation states, `ordinaryValence` by the
  octet or duet rule;
- `molecule:…` from a structure of atoms and bonds (`moleculeName`), validated by
  `validateMoleculeStructure` (known nuclides, UFF types, valence, connectivity, formal charges a
  real ion can carry: a cation keeps an electron, a −1 anion needs a CRC electron affinity).
  A charged molecule adds a third part of formal charges per atom, `molecule:atoms;bonds;0+1,4-1`
  (`MoleculeStructure.charges`); neutral names have no third part and are unchanged. Its spec
  carries the summed charge, the electrons and the mass (q electron masses less), the constituent
  atoms as ions, and the symbol of the Hill formula with the charge (`H3O+`, `O4P3−`) or `±` for a
  zwitterion; QEq charges add up to the charge and the dipole of an ion is taken about the centre
  of mass; fragments of a broken bond keep their formal charges.

### Classes and capabilities

`AbstractParticle` holds identity, spec, classical kinematics, register slots and the interaction
set derived from quantum numbers. Taxonomy by inheritance (`Fermion` → `Quark`, `ChargedLepton`,
`Neutrino`; `Boson` → gauge bosons, `HiggsBoson`; `CompositeParticle` → `Baryon`, `Meson`,
`Diquark`, `Nucleus`, `Atom`, `Molecule`); behaviour by capability interfaces (`Decayable`,
`MagneticDipole`, electrically charged, confined, …) with type guards in `capabilities.ts`.
`ParticleFactory` resolves the class by name first and family second through
`ParticleClassRegistry`; ids are sequential per prefix for reproducibility. `Combinations`
assembles a catalog composite from live constituents; `Hadronization` and `StringFragmentation`
turn colour into hadrons after ħ/Λ_QCD.

## 4. Quantum state

- `QuantumRegister`: a joint Hilbert space over ordered slots; a particle holds slots, never a
  state. `QuantumRegisterManager` allocates, merges by tensor product and keeps slots in sync.
- `StateVector` (pure, immutable), `DensityMatrix` (partial trace, purity, entropy, exact Kraus
  reference), spin operators for any spin, `observable-operators.ts` for spin, polarization and
  flavor, `entangled-states.ts` for Bell states, singlet and triplet.
- `Measurement`: projective by the Born rule with an injected `CollapseStrategy`
  (`ProjectiveCollapse` by default); projectors are tensored with identity to the whole register.
- `QuantumCore` is the facade the runner uses to prepare, entangle, measure and inspect.
- Decoherence: `QuantumJumpDecoherence` applies per-shot Kraus trajectories (dephasing as an
  unrecorded basis measurement, relaxation as a jump to the slot ground state); averages reproduce
  the Lindblad equation.

## 5. Environment

### Aspects and contributors

`EnvironmentAspects` is an open interface (`libs/contracts/src/environment.ts`):

| Aspect           | Fields                                                                                                                                                  | Set by                                                                | Read by                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `temperature`    | `temperatureInKelvin`                                                                                                                                   | `setTemperature`, `cool`, `heat`                                      | Boltzmann populations, molecule heat bath, chemistry                                               |
| `magneticField`  | `fieldInTesla`                                                                                                                                          | `applyMagneticField`, `removeMagneticField`                           | `ZeemanContributor`                                                                                |
| `electricField`  | `fieldInVoltsPerMeter`                                                                                                                                  | `applyElectricField`                                                  | electric kick in `Dynamics`                                                                        |
| `medium`         | `components[{species, numberDensityPerCubicMeter, crossSectionInSquareMeters}]`, `temperatureInKelvin`, `bulkVelocityInMetersPerSecond`, `reactionMode` | `setMedium`; its temperature also by `setTemperature`, `cool`, `heat` | `CollisionalDecoherenceContributor`, `MediumReactions`, `MolecularDynamics`, `MediumChargeBalance` |
| `coherenceTimes` | `dephasingTimeInSeconds`, `relaxationTimeInSeconds`                                                                                                     | `setCoherenceTimes`                                                   | `PhenomenologicalDecoherenceContributor`                                                           |
| `neutrinoMixing` | PMNS angles and mass splittings                                                                                                                         | plan JSON only                                                        | `NeutrinoFlavorContributor` (PDG default otherwise)                                                |
| `neighbors`      | `particleIds`                                                                                                                                           | reserved                                                              | hidden on the stage                                                                                |

Hamiltonian contributors (`ZeemanContributor`, `NeutrinoFlavorContributor`, plus
`extraHamiltonianContributors` of `createEngine`) return terms in radians per second per
observable; decoherence contributors (`Phenomenological…`, `Collisional…`, plus
`extraDecoherenceContributors`) return dephasing and relaxation rates. `Dynamics.evolve` applies,
in order, the unitary evolution of every bound slot, the decoherence channel, the electric kick
and proper time.

### Regions

`ShotContext` holds one shared `Environment` and a list of `EnvironmentRegion { aspect, value,
members }`. An environment influence with targets calls `scope(targets, before, after)` and opens
a region per changed aspect; one without targets replaces the shared environment and, when it only
reshapes the environment (`Influence.environmentOnly`), is applied again inside every region to the
environment its members see (`reshapeRegions`), so a later step overrides an earlier one where they
differ.
`environmentFor(particle)` overlays, in order, the regions the particle belongs to, so an inner
aspect of the same kind replaces the shared one and aspects of different kinds add up.
`add(label, particle, parents)` registers a product and copies its parents' regions. Every
consumer during a step (dynamics, decays, double slit, medium reactions, chemistry, radiation)
calls `environmentFor`. `SystemReporter` lists regions with the labels of living members in every
frame; the web groups them into envelopes (`apps/web/src/environment-envelopes.ts`).

### Medium: collisions, charge balance and continuum lowering

- Collision rate of a particle with a component: `n σ v_rel` with the thermal speed
  `sqrt(8kT/πm)` of each species plus the bulk velocity; it gives decoherence, mean free path and
  the heat exchange of molecules.
- `MediumChargeBalance` with the electron (or positron) component: the chain of charge states of
  an atom or ion (`chargeChain`), electron-impact ionization by the Voronov fit, radiative
  recombination at the Kramers rate (Milne relation over 30 shells), three-body recombination from
  detailed balance with ionization (so the equilibrium is Saha in a dense gas and coronal in a
  dilute one), all at an effective temperature that adds the drift through the medium.
- `continuumLoweringInEv(ionCharge, components, temperature)`: the smaller of the Debye–Hückel
  lowering `z e²/(4πε₀ λ_D)` and the ion-sphere lowering `(3/2) z e²/(4πε₀ R)` with
  `R = (3z/4πn_e)^(1/3)`; a bound level with ionization energy below the lowering does not exist,
  and recombination into it is zero. Inputs: densities and charges of the components, the
  temperature, CODATA only.

### Pressure, aggregate state and radiation

- `MediumAspect.pressureInPascals` is an input of `setMedium`; absent, it is the ideal-gas
  Σ n k T of the components (`idealGasPressureInPascals`). Densities drive the rates, the pressure
  drives the phase; a condensed preset (ocean floor) carries both as measured.
- `aggregateState(species, T, P)` in `environment/aggregate-state.ts`: a charged species or a bare
  nucleus is plasma, an atom with kT ≥ χ/10 is plasma; otherwise the phase follows the critical
  point, the melting point and a Clausius–Clapeyron vapour curve `P_vap = P_c exp(h (1 − T_c/T))`
  with `h` fixed by the normal boiling point, from `critical-points.json`. A molecule with only
  normal melting, boiling (or sublimation) and decomposition points (`phase-points.json`, 219 of
  the catalogue) takes `T_c = (3/2) T_b` (Guldberg's rule) and `h = (ΔS_vap/R)/(3/2)` with
  Trouton's `ΔS_vap = 88 J/(mol K)`; above its decomposition point the phase is `decomposed`, and
  without a boiling point it stays condensed at any pressure. Both tables are looked up by
  `substanceKey`, a bond-graph key (element and formal-charge labels refined over the bonds until
  the partition is stable) that ignores isotopes and atom order and tells isomers and charge forms
  apart. An untabulated molecule
  with carbon whose heavy atoms all fall into the 41 Joback–Reid groups
  (`environment/group-contribution.ts`: ring groups for atoms on a cycle; acid, ester, aldehyde,
  ketone, nitrile and nitro groups take their oxygens and nitrogen) gets `T_b`, `T_m`, `T_c`, `P_c`
  from the group sums, flagged `estimated` with `estimateMethod: 'groupContribution'`; anything
  else gets corresponding states from the UFF Lennard-Jones well of its heaviest atom
  (`T_c = 1.31 ε/k`, `T_triple = 0.69 ε/k`, `P_c = 0.13 ε/σ³`, `h = 7/1.31`) with
  `estimateMethod: 'lennardJones'`; `ParticleView.phaseEstimateMethod` carries the method to the
  web. `measureSystem` records `phase` (of the heaviest particle in its own
  environment, `vacuum` without a medium) and `<label>.phase`; `SystemReporter` emits
  `phaseChanged` with the conditions and the transition. The law is single-component: no
  mixtures, solutions or surface effects.
- `MediumAspect.radiationTemperatureInKelvin` is the photon-gas temperature.
  `thermalPhotoionizationRatePerSecond(atom, T_γ)` integrates the Verner cross section over the
  Planck photon density `8π E² / ((hc)³ (e^{E/kT} − 1))` from the threshold over 40 kT and adds to
  the collisional ionization of the charge chain; photodisintegration rates take `T_γ`. In a
  Planck field at the matter temperature the rate equals the ground-state recombination
  coefficient times the Saha ratio (detailed balance), which the test checks against Osterbrock.
- `bindingEnergyInEv` of an atom outside the catalog falls back to its NIST ionization energy.
- Carbon has solid allotropes (`allotropes.json`): graphite below and diamond above the
  Kennedy–Kennedy equilibrium line, melting curves from Ghiringhelli et al.; `ParticleView.allotrope`
  and an allotrope phase event follow from the same verdict.

### Finite media, solutions and quark matter

- `MediumAspect.thicknessInMeters` makes the medium a ball of that diameter around the origin
  (`environment/medium-extent.ts`): volume, heat capacity (Dulong–Petit 3k per atom when condensed,
  translations, rotations and Einstein modes of gas molecules), photon attenuation from Verner
  photoionization and Klein–Nishina Compton per component, Bethe stopping with the Bloch mean
  excitation 10 eV·Z and the range, the distance to the edge along a direction. Energy absorbed in
  the ball (`absorbedEnergyInJoules`) raises the temperature by ∫dE/C and moves an ideal-gas
  pressure with it (a given pressure scales by T′/T). Without a thickness the medium is infinite: nothing leaves and nothing heats.
- Solutions (`molecules/solution-chemistry.ts`): in liquid water a salt or acid dissociates when
  the Born–Haber cycle (bond energy, ionization, minus electron affinity, plus the Marcus hydration
  Gibbs energies rescaled by the Born factor of the Malmberg–Maryott permittivity at the medium
  temperature) is negative; the dissociated share and pH follow from charge balance with the IAPWS
  R11-24 ionization constant. Dissolved ions carry the phase `solvated`; `measureSystem` records
  `pH`.
- Proton transfer (`molecules/proton-transfer.ts`, `data/acid-base.json`): each Brønsted system
  names a catalogue molecule, the sites that carry an extra proton in the most protonated form and
  the steps with their Ka or pKa (OpenStax Chemistry 2e Appendix H and §14.5 for sulfuric,
  phosphoric, acetic and formic acid, King 1951 via the IUPAC digitized pKa dataset for glycine); a
  complete step (H₂SO₄ → HSO₄⁻) leaves no form above it. The forms are built as charged molecules
  and recognised by bond graph (`substanceKey`), and the catalogue molecule joins the form with as
  many protons (H₂N–CH₂–COOH joins the zwitterion). Shares follow share(k) ∝ Π_{j<k} Ka_j / [H⁺]^k
  (`protonationShares`). The charge balance of `mediumAcidity` adds Σ c·⟨z⟩(pH) of every chain
  component and the charge of free molecular ions to the strong ions and diatomic acids; an
  explicit `proton` or H₃O⁺ component sets the pH, an explicit OH⁻ component sets pH = pKw +
  log m(OH⁻). `SolutionChemistry.equilibrate` samples the form of a chain molecule at the pH of its
  own medium every evolve step; the proton goes to or comes from the H₃O⁺ and OH⁻ of the water,
  which stay part of the solvent (named in the reaction label). Formal-charged molecules skip gas
  chemistry in `MolecularDynamics`.
- A component may take `densityLaw: thermalEquilibrium`: its density is the ideal quantum gas
  n = g/(2π²)(kT/ħc)³ ∫x² dx/(e^√(x²+(m/kT)²) ∓ 1) with spin, helicity and colour degeneracy
  (`particles/deconfinement.ts`). Above the HotQCD crossover temperature the phase is
  `quarkGluonPlasma`.

## 6. Influences

`InfluenceRegistry` builds commands by name from plain parameters and publishes their parameter
definitions to the compiler and the UI (`GET /catalog`). A new influence is one class plus one
`register` call.

| Name                  | Parameters (unit in the name)                                                                                                                                                                        | Effect                                                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `setTemperature`      | `temperatureInKelvin`                                                                                                                                                                                | sets the `temperature` aspect and the temperature of a medium in the same scope (an ideal-gas pressure follows)                          |
| `cool`, `heat`        | `byKelvin`                                                                                                                                                                                           | changes both, from the medium temperature when none was set, never below absolute zero                                                   |
| `applyMagneticField`  | `xInTesla`, `yInTesla`, `zInTesla`                                                                                                                                                                   | sets `magneticField`                                                                                                                     |
| `removeMagneticField` | —                                                                                                                                                                                                    | removes it                                                                                                                               |
| `applyElectricField`  | `xInVoltsPerMeter`, …                                                                                                                                                                                | sets `electricField`                                                                                                                     |
| `setCoherenceTimes`   | `dephasingTimeInSeconds`, `relaxationTimeInSeconds`                                                                                                                                                  | sets `coherenceTimes`                                                                                                                    |
| `setMedium`           | `components` (list of species, density, cross section, `densityLaw`), `temperatureInKelvin`, `pressureInPascals`, `radiationTemperatureInKelvin`, `thicknessInMeters`, `reactionMode`, bulk velocity | sets `medium`; species may be any catalog particle, nucleus, atom or molecule; a thickness makes it a finite ball that absorbs and heats |
| `placeBody`           | `shape` (ball or box), `sizeInMeters`, `xCenterInMeters`…, then the medium parameters                                                                                                                | adds a body of that medium to the `bodies` aspect; a point sees the smallest body that holds it                                          |
| `boost`               | `xFraction`, `yFraction`, `zFraction` of c                                                                                                                                                           | Lorentz boost of the kinematics                                                                                                          |
| `rotateSpin`          | `polarAngleDegrees`, `azimuthDegrees`, `angleRadians`                                                                                                                                                | rotation on the spin slot                                                                                                                |
| `thermalize`          | —                                                                                                                                                                                                    | Boltzmann sampling of a slot energy eigenstate (unentangled particles)                                                                   |
| `randomize`           | —                                                                                                                                                                                                    | Haar-random pure state                                                                                                                   |
| `evolve`              | `durationInSeconds`                                                                                                                                                                                  | `Dynamics.evolve` only (the `evolve` step does more, see §8)                                                                             |
| `travel`              | `distanceInKilometers`                                                                                                                                                                               | evolution for the time the particle needs to cover the distance                                                                          |
| `irradiate`           | `frequencyInHertz`, `powerInWatts`, `beamAreaInSquareMeters`, `durationInSeconds`                                                                                                                    | photon beam, see §7.6                                                                                                                    |
| `laserCool`           | `detuningInLinewidths`, `saturationParameter`, `durationInSeconds`                                                                                                                                   | Doppler cooling on a NIST transition                                                                                                     |
| `electrolyze`         | `voltageInVolts`, `currentInAmperes`, `durationInSeconds`                                                                                                                                            | Faraday's law: molecules above their decomposition voltage (bond energies per transferred electron) split into their elements            |

Targets: an influence with named targets acts on them and, for environment influences, opens a
region (§5); without targets it acts on every live particle or the shared environment. The order of
creation and environment steps is free: a plan may create particles, place them in a medium and
then heat all of them or only some, and a heated part reacts in its own hot copy of the gas.

## 7. Interactions

### 7.1 Elementary collisions and the Lagrangian

`lagrangian/standard-model.ts` writes the Standard Model as data (gauge group, multiplets with
quantum numbers from the catalog, Higgs doublet, terms, parameters in the G_F or running-α scheme);
`vertices.ts` derives the Feynman-rule vertices from it; `feynman/amplitude.ts` builds tree
amplitudes by off-shell recursion with the Dirac algebra of `dirac.ts` and the external states of
`external-states.ts`; `observables.ts` turns them into 2→2 cross sections with dσ/dcosθ and 1→2,
1→3 widths. `ProcessCalculator` caches one model per coupling scheme and scale and serves the
Lagrangian page and `POST /api/processes`. `Collisions` takes any two elementary particles: open
channels are the final states that conserve charge, baryon and lepton numbers, pass thresholds and
have a tree diagram; the channel is drawn by cross section, the angle from the table.

### 7.2 Parton collisions and hadronization

`PartonCollisions` (nucleons and antinucleons with each other or with elementary particles above
the nuclear range): NNPDF2.3 LO QED distributions with log-cubic Hermite interpolation like
LHAPDF, luminosities by Gauss–Legendre rapidity integrals above a transverse-momentum threshold
(20 GeV by default), nine flavour-blind QCD 2→2 classes from the tree amplitudes, beam remnants
(diquark, companion antiquark, quark plus diquark) sharing the rest of the momentum by the PYTHIA
shapes with opposite primordial k_T. `Hadronization` binds colour after ħ/Λ_QCD: quark triplets
into the matching baryon, singlet pairs into Lund strings (`StringFragmentation`) that break by u,
d, s and diquark pairs into mesons and baryons on their mass shell; D and B hadrons decay through
the spectator model.

### 7.3 Nuclear reactions

Beams (`NuclearReactions`, nucleons and light nuclei below 10 MeV in the centre of mass):
σ(E) = S(E)/E · exp(−B_G/√E) with the Gamow constant from CODATA and the S-factors of
`nuclear.json` (Bosch–Hale D–T, D–D, D–³He; Solar Fusion II pp, pd, ³He³He, ³He⁴He, ⁷Be p,
⁷Li p), the 1/v law for the NIST neutron captures, Rutherford scattering inside the acceptance and
NIST bound elastic cross sections; products by two- or three-body phase space.

Media (`mediumFusionChannels`, `collisions/reaclib-rates.ts`): for a nucleus and the nuclear
components around it, every REACLIB reaction whose other reactants are species of the medium is a
channel. Rate per particle = λ(T) · Π(n_partner/N_A) / Π(multiplicity!) in cm³ mol⁻¹ s⁻¹ and
cm⁶ mol⁻² s⁻¹ units converted to SI, the factorial for identical partners (½ n² for triple alpha);
electron capture rates (`ec` sets) multiply by n_e/N_A and need an electron component. Products
are completed by the charge they move: β⁺-type reactions add a positron and a neutrino, electron
captures a neutrino, β⁻-type an electron and an antineutrino; radiative captures (chapters 4 and 8) add a photon. The fit is evaluated inside 0.01 ≤ T₉ ≤ 10, held at the top above and silent
below, where the S-factor tables take over for the pairs they hold. Reactant pairs the library
covers are not duplicated from the tables. The relative energy of a reacting pair is sampled from
the Gamow-peak shape (neutrons: 1/v); endothermic channels take their threshold plus a thermal
excess. Kinematics: `restFrameMomenta` for two, three or more bodies, boosted to the lab.

Decays inside a medium (`nuclear-decay-in-medium.ts`): spontaneous NUBASE channels at
ln 2 / T½ (the EC share removed), capture of a continuum electron at the laboratory EC rate scaled
by `n_e ⟨2πη/(1−e^{−2πη})⟩_Maxwell / ρ_K` with the Slater K-shell density and the L/K share, and
photodisintegration by the thermal photons at the REACLIB reverse rate. All three are absorbing
channels of the same chain as fusion.

The chain (`MediumReactions`): transient states are the charge states of the particle, absorbing
states are its fusion and decay channels; `absorbingMarkovTransition` gives the end of the window
and `absorptionTimeInSeconds` the moment of the reaction. In `oneReactionPerStep` the products wait
for the next step; in `allReactionsInStep` the heaviest product that still has a channel carries
the line in the rest of the window, each nuclear species at most once per line and never a product
the medium already holds (it dissolved into the gas). A limit of 1000 reactions per step guards
against looping data.

Neutrons in a finite medium (`collisions/neutron-transport.ts`, ENDF/B-VIII.0 through
`src/endf.ts`): free paths from the summed macroscopic cross section, elastic scattering with the
evaluated mean cosine in the centre of mass, capture, (n,2n), (n,p), (n,α) and fission. Below
the resolved-resonance boundary the generator (`scripts/resonances.ts`) reconstructs the MF2
resonances at 0 K and adds them to the MF3 background: Reich–Moore (LRF=3) through the matrix K of
the neutron and two fission channels per spin group, single- and multi-level Breit–Wigner
(LRF=1, 2) through level sums with shift and penetrability; it does so for every actinide (Z ≥ 90)
and for every other nuclide whose reconstructed thermal capture exceeds 1000 b (xenon-135,
samarium-149, gadolinium, cadmium-113, europium and others); the rest keep the MF3 values (1/v
below the boundary). Below 400 kT an elastic collision takes a target from the free gas at the
medium temperature (target speed sampled with the relative-speed weight, scattering in the centre
of mass), so slow neutrons thermalize and gain energy from hot media. Fission emits ν̄ prompt
neutrons from the evaluated multiplicity with energies from the prompt fission spectrum quantiles
and two fragments from the independent yields, the energy release from AME masses; with the
probability ν_d(E) it also leaves delayed neutron precursors (MF1/MF5 MT455: group by abundance,
delay from the group decay constant, energy from the group spectrum). The runner keeps them per
shot with the fission point, records their number as `<record>.pendingNeutrons` and releases each
as an isotropic neutron at the start of the `evolve` step in which its delay runs out. A neutron
that reaches the edge of the medium leaves. The chain of generations gives the multiplication.

### 7.4 Atomic processes

`AtomicProcesses` (collisions below 10 keV): radiative recombination of an electron or positron
with a bare nucleus or ion by the Kramers cross section summed over shells, photoionization by the
Kramers law, Thomson scattering; antihydrogen follows from charge conjugation. In a medium the
charge chain of §5 applies: Voronov ionization (Z ≤ 28; other elements keep their atoms until a
general ionization law lands, see `docs/ROADMAP.md`), Kramers and three-body recombination,
continuum lowering, electrons freed on the way to fusion returned to the medium
(`MediumChargeBalance.freeLeptons`).

### 7.5 Molecules

- Structure (`molecular-structure.ts`): UFF atom typing by bond orders, rest lengths with the
  bond-order and electronegativity corrections, stretch and bend constants, energy minimisation,
  harmonic normal modes with infrared strengths from the QEq charges, moments of inertia,
  rotational constants, dipole moment, total binding from the bond energies.
- Behaviour (`molecular-behaviour.ts`): internal energy and heat capacity from rotations and
  Einstein modes, collisional relaxation toward the gas temperature (a component without a cross
  section collides as hard spheres of the UFF Lennard-Jones diameters of the heaviest atoms;
  absorption line widths keep the given cross sections), Debye orientational and
  resonant infrared absorption, unimolecular dissociation of each bond at its vibrational attempt
  frequency times exp(−D/kT), fragments by connected components.
- Association (`molecular-association.ts`): a neutral atom or molecule joins an atom of the medium
  with the bond order that pairs every free ordinary valence of both (C + O gives C=O, CO + O gives
  O=C=O, N + N gives N≡N); the joining rate equals the breaking
  rate of that bond times `K(T) = Z_AB/(Z_A Z_B)` from translational, rotational, vibrational and
  electronic (unpaired valences, ground-level weight) partition functions, Boltzmann factors
  cancelling. High-pressure limit, no barriers, no symmetry numbers.
- Atom transfer (`atom-transfer.ts`): A + BC → AB + C over a barrier from the Johnston–Parr
  bond-energy–bond-order method (Pauling bond-order lengths, a half Sato triplet repulsion between
  the ends, noble-gas Lennard-Jones wells fitted to viscosity for the end atoms), the saddle found
  along the bond-order path, the rate by transition-state theory with a symmetric linear complex,
  partition functions of reactants and complex and the path degeneracy (four hydrogens of
  methane). Forward over reverse equals K(T) times the path ratio by construction.
- Chain (`molecular-dynamics.ts`): the species a line passes through form an absorbing chain of
  joins, breaks and atom transfers with the medium; a fragment that is a species of the gas
  dissolves. Without a medium a molecule only breaks in the heat bath.
- Solutions and electrolysis: see §5 and `electrolyze` in §6.
- Catalogue (`libs/constants/data/molecules.json`, `MOLECULE_CATALOG`): 238 molecules in 21
  categories and 5 groups for the species picker, each checked by `validateMoleculeStructure`;
  `catalogMoleculeTraits` gives mass and linearity precomputed by `pnpm generate:molecules`,
  `isRadical` the parity of the electrons. `catalogMoleculeOf` recognises any built molecule by its
  bond-graph substance key (the isotopologue with the same isotopes first); the system report puts
  the name in `ParticleView.catalogName` and in its events, and the web says "unknown molecule"
  without it.

### 7.6 Radiation and laser cooling

`Irradiate` collects absorption channels per target with cross sections from
`radiation/photon-absorption.ts`: Verner photoionization (hydrogenic Kramers beyond zinc),
Klein–Nishina Compton ionization, Bethe–Peierls deuteron and giant-dipole photonuclear knockout,
molecular photodissociation and dissociative photoionization; one is sampled with probability
1 − exp(−σΦt) and returned as a reaction with four-momentum conserved. Molecules are heated by the
Debye and resonant infrared channels and may break thermally during the exposure; the bond energy
of such a break comes from the internal heat. `LaserCool` applies the saturated scattering force
above the capture velocity and an Ornstein–Uhlenbeck relaxation toward the Doppler temperature on a
NIST transition of 14 species.

### 7.7 Decays

`Decays` samples times and channels: PDG widths and branching fractions for elementary particles
and hadrons, NUBASE modes for nuclei, three-body kinematics weighted by |M|² of the tree diagrams
(`MatrixElementRegistry`, lazy amplitudes), inclusive W and Z channels resolved by tree widths,
H → VV* with one virtual boson (`virtual-boson.ts`), spectator decays of heavy hadrons
(`spectator.ts`), conservation checks (`conservation.ts`), the cascade of mesons inside each
window. Products are boosted to the lab and the parent retires; `decayAfterSampledTime` uses the
particle's own environment.

### 7.9 Deconfinement

`Deconfinement.melt` (`particles/deconfinement.ts`): when the medium or temperature aspect is at or
above the HotQCD crossover temperature (156.5 ± 1.5 MeV, PDG), a meson, baryon, nucleus or the
nucleus of an atom splits into its valence quarks, each with a Maxwell–Jüttner momentum of the
bath; electrons stay; free quarks and gluons are not hadronized while the medium is above the
crossover.

### 7.8 Space cube, double slit, annihilation

`SpaceLab`: one-particle wavefunctions on a 32³ or 64³ grid, split-operator FFT evolution in free
space, a barrier, a wall with two slits along z (`doubleSlit`: height, thickness, slit width and
separation), a harmonic trap, a quartic double well (`doubleWell`: V₀[((x/a)² − 1)² + 4(y² + z²)/a²],
isotropic curvature 8V₀/a² at the minima, clipped at 8V₀ so the time step stays at the kinetic
limit), a box (`box`: walls of height V₀ outside |x|, |y|, |z| ≤ L/2) or a Coulomb centre; Born
sampling of position, snapshots with projections. Shapes: a Gaussian packet, the ground state, the
hydrogenic 2s, 2p_z and 3d_z² orbitals with a = a₀/Z scaled by the mass, the 1s + 2p_z
superposition (a dipole beating at h/ΔE) and a cat state (two Gaussians at ±r₀, the left one with
the particle momentum and the right one with the opposite). Placements, evolutions, distributions,
clouds and potential peaks are cached by the physics alone and shared by every engine in the
process, so traced shots and repeated runs reuse an evolution; a chain of `propagate` steps plays
as an animation in the system player, one cloud per frame. `DoubleSlit`: Fraunhofer pattern for the de Broglie wavelength, visibility reduced by
which-path detection or by decoherence over the flight. `PairAnnihilation`: electron and positron
clouds overlapping in the trap annihilate at `(π r_e² c)·∫ρ₋ρ₊ d³r` weighted by the singlet share,
into two photons sharing the ψ⁻ state.

The cube as a world (`space/geometry.ts`): `SpaceSpec.walls` is `open` (default) or `reflecting`;
`BODY_SHAPE_LAWS` hold `ball`, `box` and `cylinder` (along z, `sizeInMeters` the diameter and an optional
`heightInMeters`); `placeBody` (shape, `sizeInMeters`, height, centre, then every
medium parameter of `setMedium` except the thickness) adds a body to the `bodies` aspect, a body
with the same shape, centre and size replacing the old one (and keeping its temperature and absorbed
energy when it also has the same name: the same body with a new makeup, such as water boiling into
steam); `environmentFor` gives a particle the
medium of the smallest body that holds it; temperature influences take every body to the new
temperature; a medium may carry a one-word `name`; `measureSystem` records `<name>.temperatureInKelvin` and
`<name>.absorbedEnergyInJoules` for a named shared medium and every body (`body<N>` without a
name); the energy a neutron loses in a collision heats the body where it collides, and a charged
particle or photon is stopped or absorbed by the medium at the point where its step began. After every `evolve` the point particles not held as waves fold
back into a mirror cube (position and momentum). `SpaceSnapshot.walls` and a snapshot for every
frame of a plan with a cube (also without clouds) feed the web view. Potentials are
`POTENTIAL_LAWS` (`space/potentials.ts`) with the mirror layer of `mirrorWallEnergyInJoules`.

## 8. Experiments

### Plan and compiler

`ExperimentPlan` (`libs/contracts/src/experiment-plan.ts`): name, description, categories,
parameters, shots, seed, optional `space`, optional `particleWeight`, steps and report. Operations:
`create`, `createNucleus`, `createAtom`, `createMolecule`, `entangle`, `influence`, `evolve`,
`measure`, `combine`, `diffract`, `collide`, `place`, `propagate`, `measurePosition`,
`measureSystem`, `keyframe`, `decay`. A `keyframe` has a name and a `watch` list of
`{ target, quantity }`: the system (`particleCount`, `pendingNeutrons`, `count.<species>`), a medium by
its record name (`temperatureInKelvin`, `absorbedEnergyInJoules`, `pressureInPascals`) or a particle
by label (`energyInGev`, `kineticEnergyInGev`); the compiler checks that the target exists before
the step and has that quantity, and the values are records `<name>.<target>.<quantity>`.
`particleWeight` (default 1) is how many real particles each simulated one stands for: every
energy a particle hands to a medium (`ShotContext.heatAt`) is multiplied by it. `createMolecule` takes atoms, bonds and an optional `charges` list of formal charges
(`{ atom, charge }`, zero entries ignored) that makes the molecule an ion (`moleculeStructureOfStep`);
without it a plan creates the neutral molecule as before. Creation steps take an optional `count` up to `MAXIMUM_GROUP_SIZE` (10 000): the compiler
expands the group into members `label#1…` (`withGroups`, `groupMemberLabels`) that are separate
particles at run time, and a target naming the group means all members. The ajv schema is typed against the TypeScript types. `compilePlan` merges parameters,
substitutes `{{placeholders}}`, checks labels, records and report fields statically and throws a
bilingual `PlanCompilationError` with the step index.

### Runner

`ExperimentRunner.runShot` executes the steps on a fresh `ShotContext` (particles by label, shared
environment and regions, records, space). The `evolve` step runs, in order: `Dynamics.evolve` per
target with its own environment, annihilation pairs in a harmonic trap, chemistry
(`MolecularDynamics` for molecules and neutral atoms in a gas), medium reactions
(`reactWithMedium`, each particle with its own medium, continuations in `allReactionsInStep`),
hadronization after ħ/Λ_QCD, the meson cascade. `measureSystem` records the composition string,
`particleCount`, `chargedCount`, `hadronCount`, `photonCount`, `hadronic`, `heaviest` and
`heaviestMassNumber`, `count.<species>` for catalog names, and the readings of every object
(`object-measurements.ts`: mass, charge, spin, motion; nuclei add nucleon numbers, binding per
nucleon, separation energies, half-life; atoms their electrons, ionization energy, g, μ,
temperature; molecules bonds, dipole, rotational constant, modes, internal temperature).
`ResultAggregator` computes `frequency`, `mean`, `standardDeviation`, `histogram`,
`probabilitySameSign`, `correlation` and `chsh`. `KeyframeAggregator` (`experiment/keyframes.ts`)
builds `ExperimentResult.keyframes`: the names, step indices and simulated times of the keyframes
(the sum of the `evolve` and `propagate` durations before each), and per watched quantity its mean
and standard error at every keyframe and the paired change between consecutive keyframes that
watch it (Welford moments); the API stores it in `RunResult.keyframes`. The runner keeps the mean time of every step in a
shot (`stepMeanMilliseconds`); `runExperimentAsync` yields between shots and reports
`RunProgress` (`firstShot`, then `shots` with the running mean shot time and the remaining time,
then `tracing`) and checks `shouldStop` before every shot, returning the finished shots as a
`stopped` result without traces; `estimateRun` times a pilot of up to a few dozen shots and forecasts the mean shot
times the shots plus the traces.

### Traces and reports

`runExperiment` runs all shots, then traces shots with consecutive seeds into `SystemReport`s
through `SystemReporter` (one frame per step: particles, reduced quantum states, entanglement,
environment, regions, events, conserved totals, space snapshot). It keeps tracing past the first
six until every distinct final outcome found within 240 shots or 1.5 s has a traced shot, so a
rare branch is visible in the player.

### Templates

99 built-in templates in `packages/engine/src/templates`, registered with their categories in
`index.ts`; descriptions and report labels are Russian in the template and English in
`english.ts`. Categories: spin, interference, decays, neutrinos, colliders, confinement, protons,
space, nuclear, atoms, molecules, radiation, chemistry. Chemistry (`chemistry.ts`): fire, burning
carbon, methane, carbon vapour, the primordial soup, diamond under pressure, salt and acids in
water, glycine across pH (`glycineAcrossPh`), electrolysis; matter and radiation (`radiation-in-matter.ts`): gamma shield, alpha in water,
X-rays heating water; fission (`fission.ts`): an enriched uranium ball and natural uranium; quark
matter (`quark-matter.ts`): a quark–gluon soup. `complexity.generated.json` (`pnpm
measure:templates`) holds the measured mean shot time and step shares of each template. Star and nucleosynthesis templates (`cnoCycle`,
`tripleAlpha`, `sProcessIron`, `carbonBurning`, `firstNucleiAfterBigBang`, `heliumThreeBranches`,
`starMatterEvolution`) are one nucleus in a parametrised medium; no reaction is written in them.

## 9. API and persistence

NestJS 12 run with tsx; constructor dependencies use `@Inject(token)`. Routes under `/api`:
`GET /health`, `GET /catalog`, `GET /species`, `GET /templates`, `GET /templates/:name`,
`POST /templates`, `DELETE /templates/:name`, `POST /templates/validate`, `GET /lagrangian`,
`GET /processes/channels`, `POST /processes`, `POST /runs`, `POST /runs/stream` (newline-delimited JSON: progress messages,
then the run with its result), `POST /runs/estimate` (pilot forecast), `POST /runs/:id/stop` (stop an active run before its next shot), `GET /runs`, `GET /runs/:id`,
`GET /catalog/nuclides/:protons` (measured NUBASE2020 nuclides of one element). The catalog also
carries the molecule catalogue with groups, categories, masses and flags, the Russian names of the
elements and their electron affinities.
`?lang=` on template routes and `language` in a run request pick the text language; error bodies
are `{ statusCode, message, text }` with `LocalizedText`. Runs execute in process, capped at
200 000 shots.

Postgres through sequelize-typescript with `sync()`, no migrations; models in
`libs/contracts/src/db`: `experiment_templates` (name, description, plan), `experiment_runs`
(template, plan, parameters, shots, seed, status, timings, error), `run_results` (report values,
outcome counts, distributions, system reports, step times, keyframe summary), all JSONB where structured. The desktop app
(`apps/desktop`) runs the same API on 127.0.0.1 against an embedded Postgres started by the
Electron main process; `pnpm package` builds `.app` and `.exe` into `release/`.

## 10. Web

React 19 on Vite; contracts as types only; vocabularies from `GET /catalog`. Views: templates
(pick, parameters, run), builder (step forms per operation, parameters, reports, JSON mode,
validate, run, save, the particle weight beside shots and seed), results (diagram beside a loader
while running, then the experiment, the result with the keyframe table, the system player and the
formula panel), history, Lagrangian (terms, multiplets, vertices,
process calculator). The keyframe step (`keyframe-editor.tsx`) offers the targets known before it
(`keyframeTargets`: the system, media by name or `body<N>`, particle labels) and their quantities
(`keyframeQuantities`); a new keyframe watches what the previous one did, so two of them give a
change at once. `keyframe-table.tsx` shows each watched quantity per keyframe with its time, the
change from the keyframe before and its rate per second (power for absorbed energy, heating rate
for temperature); the player names keyframes on its step bar. Pure modules with tests: `plan-edits.ts`, `plan-diagram.ts` (lanes, links,
environment bands that wrap the particles created just above them and nest by inset inside the
earlier bands that hold them), `cube-scene.ts` (bodies, points with trails and births, the body a particle lies in,
orientation by rotation matrices), `system-stage.ts` (layout, envelopes, camera), `environment-envelopes.ts`,
`influence-visual.ts`, `experiment-formula.ts`, `carry-over.ts`, `molecule-edits.ts`,
`space-scale.ts`, `format.ts`, `language.ts`. The cube view (`space-view.tsx`) draws the walls, the bodies, the clouds and every point particle with
a trail; a drag moves the scene (with ⌘ or Ctrl it turns it), the wheel and buttons zoom, buttons rotate it by 10° about x, y and z
with an eased animation, and it centres, shows a chip on hover and opens an inspector on a click (the
cube with the particle highlighted, its card, the other particles); the player puts it above or below
the stage in the left column, and the side panel runs the full height of both. The stage draws every environment as an envelope
around the particles it acts on, nested by inclusion, with gas dots that drift faster when hot and
gas atoms flying into a particle that reacted; beside it, a scrollable panel tells the step in words, shows the conserved totals as tiles, the environment cards and the particles with their phase (`ParticleView.phase`) and grouped readings; a step bar above replaces the slider; the camera fits envelopes and particles, zooms by
pinch only (1 %–300 %) and has a center button. Every visible string goes through `say(ru, en)`.

Species picker (`components/species-picker.tsx` over the pure `species-tree.ts`): a modal over a
blurred backdrop with breadcrumbs, a back button, search over every species (formula, symbol or
name, sub- and superscripts normalised) and the viewer's recent picks in localStorage. Screens:
matter or antimatter and eight classes (bosons, quarks, leptons, hadrons, nuclei, atoms, molecules,
ready mixtures); particles with family chips; atoms as neutral, ions or isotopes and nuclei, chosen
on a quick element box or a periodic table placed by the Madelung filling order, with nuclides from
`GET /catalog/nuclides/:protons` (stable by abundance, then radioactive by half-life, decay mode
and spin); molecules by group and category with masses; preset mixtures that add every component
with its density. Scopes: `medium` (component rows and «add component»), `molecule` (fills a
create-molecule step from a catalogue structure, `moleculeFromSpecies`) and `atom` (one atom row:
neutral atoms and isotopes, `atomFromSpecies`) and `atom` (the create-atom step: neutral atoms,
cations +1 to Z−1 and isotopes, `atomStepFields`) and `nucleus` (the create-nucleus step: element
and nuclide on the nuclei screen, search over nuclei only, `nucleusStepFields`). `species.ts` prefers the catalogue formula of a
molecule (HCl) over the Hill order.

Groups and timing: the stage puts at most six particles in a row, folds particles in identical
states into a group node with bundled links, moves reacting particles into their heaviest product
and folds repeated events; the plan diagram draws a group as three coins. Carry-over folds identical
survivors into one counted step named after the species and keeps the formal charges of a molecular
ion (it reads the name with `moleculeFromSpecies`).

Molecule configurator (`components/matter-step-fields.tsx` over the pure `molecule-edits.ts`): atoms
with element, isotope and a formal charge each (−1, 0, +1; no +1 on hydrogen), bonds of order 1–3,
the Hill formula with the ion charge (`moleculeChargeText`: OH−, H3O+, ± for a zwitterion) also on
the plan diagram, and catalogue molecules or molecular ion names read back with their charges.
`formatOutcome` splits an outcome into species only at a `+` that starts a new one (`23Na+ + 35Cl-`,
`C2H6NO2+` whole), like the composition note of the engine. The builder shows step
weights and a pilot forecast (`RunForecast`), the results page a live status from the stream, the
total time and the share of each step, the template list the time per shot.

Hints: every data-showing element carries a `data-tooltip` from `hints.ts` (or the glossary for
parameters, statistics and operations); `TooltipLayer` shows it above modals.

Medium fields: `scale.ts` maps positions to values on a logarithmic scale that spans the landmarks
of the quantity (`catalog.environmentScales`), thins decade ticks and puts landmark names in rows
that never overlap (a name that fits no row stays in its tooltip); `ScaleSlider` draws it as SVG
with one handle per value (a field, or every component of a medium). `EnvironmentPresetPicker`
fills a setMedium step from `catalog.environments` (`applyEnvironmentPreset`,
`environmentPresetOf` in `plan-edits.ts`); envelope captions show pressure and radiation
temperature; the log shows `phaseChanged`.

Design system (the designer's builder concept, applied through shared pieces): tokens at the top
of `styles.css` (paper, ink, teal, hairlines, operation and category colours, radii, control height
44 px; headings in Google Sans, body in Manrope); primitives `.card`, `.card-head`, `.eyebrow`,
`.field-label`, `.value-field`, `.source-chip`, `.tag`, `.mini-chip`, `.chip-check`, `.segmented`,
`Subsection`, buttons `primary` (ink), `secondary`, `cta` (teal), `danger text`,
`icon-button round|plain`. `NumberOrParameterInput` is the one value field: a number, a plan
parameter shown with its value (`PlanParametersContext`) or a preset named under it, switched by a
chip. `species.ts` writes any species name as a symbol (N₂, CO₂, ⁴⁰Ar). `usePanZoom` (drag past a
threshold, pinch or ctrl-wheel zoom, wheel pans while the canvas can move) and `ZoomToolbar` are
shared by the system stage and `PlanSchema`, the plan diagram on a canvas that opens fitted to the
width and follows the active step; it is also shown in template and result summaries. The builder
is two columns: the experiment card, parameters (with the steps that use them), space, steps
(operation tile, summary, influence fields grouped by `groupInfluenceParameters` into components,
conditions one per row, vectors and targets) and report on the left, the sticky schema with the
run button on the right; below 1180 px a Steps / Schema switch shows one at a time, and tapping a
schema row opens the step.

## 11. Which test guards what

| Law or feature                                                       | Test                                                               |
| -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Born rule, entanglement, CHSH                                        | `measurement-exact`, `entanglement`, `measurement-monte-carlo`     |
| Zeeman, Larmor, Kraus, Boltzmann, kicks                              | `environment-dynamics`, `decoherence-monte-carlo`                  |
| Decays, Michel, widths, cascades                                     | `decay-exact`, `decay-monte-carlo`, `feynman`                      |
| Tree cross sections, Z peak, A_FB                                    | `collisions`, `feynman`                                            |
| Partons, remnants, sum rules                                         | `parton-collisions`                                                |
| Confinement, strings, mesons                                         | `hadronization`, `meson-hadronization`                             |
| Light nuclei, S-factors, Bosch–Hale, Kramers                         | `nuclei-and-atoms`                                                 |
| REACLIB fit, agreement with S-factors, triple α, photodisintegration | `reaclib`                                                          |
| Solar Fusion II branches, electron capture                           | `star-matter`                                                      |
| Charge chain, Saha, coronal, continuum lowering                      | `medium-charge-balance`, `medium-components`                       |
| Medium chains, dissolution, pressure ionization                      | `medium-components`                                                |
| Regions                                                              | `environment-regions` (engine), `environment-envelopes` (web)      |
| Molecules: UFF, modes, dissociation, radiation                       | `matter`                                                           |
| Association and chemical equilibrium                                 | `molecular-association`                                            |
| Nucleosynthesis templates                                            | `nucleosynthesis`, `templates-and-system-report`                   |
| Trace coverage                                                       | `trace-coverage`                                                   |
| Phases, pressure, Planck photoionization, preset templates           | `aggregate-state`                                                  |
| Preset media, scales, critical points                                | `environments` (constants), `scale`, `plan-edits`                  |
| Species symbols, value field, influence grouping                     | `species`, `presets`, `plan-edits`, `influence-visual` (web)       |
| Space cube, double slit, annihilation                                | `space`, `double-slit`, `pair-annihilation`                        |
| Cube potentials and shapes: orbitals, dipole, wells, box, cat, slits | `space-shapes`                                                     |
| Bond orders, atom transfer, allotropes, chemistry templates          | `chemistry`                                                        |
| Solutions, pH, electrolysis                                          | `solutions`                                                        |
| Charged molecules, proton transfer, acid–base data                   | `proton-transfer`, `acid-base` (constants)                         |
| Finite media: heat capacity, stopping, attenuation, heating          | `medium-extent`                                                    |
| ENDF data, neutron transport, fission chains                         | `fission`                                                          |
| Resonances, poisons, cylinder, free gas, delayed neutrons, Chernobyl | `reactor-physics`, `cube-scene` (web)                              |
| Deconfinement, quantum gas densities                                 | `deconfinement`                                                    |
| Run progress, step times, pilot forecast                             | `run-progress`                                                     |
| Molecule catalogue and its generated traits                          | `molecule-catalog`                                                 |
| Species picker model, molecule from species, symbols                 | `species-tree`, `molecule-edits`, `species`, `format` (web)        |
| Molecular ions in plans, the configurator and carry-over             | `plan-compiler`, `molecule-edits`, `carry-over`, `format` (web)    |
| Stage rows, groups, bundles, folded events                           | `system-stage` (web)                                               |
| Plan compiler, runner, builder edits                                 | `plan-compiler`, `experiment-runner`, `plan-edits`, `plan-diagram` |
| Both languages everywhere                                            | `template-languages`, `language`, `presets` (api)                  |
| API end to end                                                       | `api.e2e` (needs Postgres)                                         |

## 12. Known limits

- Collisions exist only where a law exists: elementary pairs, nucleons with partons, light nuclei,
  atoms. Hadron–hadron scattering of arbitrary hadrons (Ξb with B*s) has no library and no law.
- Electron-impact ionization covers Z ≤ 28 (Voronov); photoionization fits cover Z ≤ 30.
- Atoms and nuclei sit in their ground states; no excited levels, no isomers in the chains.
- Chemistry: association, dissociation and atom transfer with the medium, high-pressure limit, no
  symmetry numbers, no termination reactions on walls or third bodies; transition-state theory
  with a linear complex underestimates polyatomic rates; a methane flame stalls because π bonds do
  not relax; two particles of the plan do not react with each other, only with the medium.
- Solutions: pKa from the thermodynamic cycle is good to a few units; only water is a solvent.
  Proton transfer covers the systems of `acid-base.json` only, at their 25 °C constants (no van 't
  Hoff shift with temperature), as an instant equilibrium at the pH of the medium without
  activity coefficients; the neutral tautomer of an amino acid is folded into its zwitterion;
  a solute particle does not move the pH of its medium. The configurator offers formal charges of
  −1, 0 and +1 only; larger ones go through the JSON mode.
- Aggregate state is a single-component verdict at the medium's T and P: no mixtures, surface
  tension or nucleation; tabulated molecules without a critical point use the Guldberg and Trouton
  rules, which overestimate the vapour pressure of hydrogen-bonded liquids; a substance with only a
  melting point stays liquid above it at any temperature and pressure; untabulated organic
  molecules are Joback–Reid estimates (no aromatic groups, no ring tertiary amine), others
  Lennard-Jones estimates; pressure does not change the reaction rates, the densities do.
- Finite media: the geometry is honoured by neutron transport and photon absorption only; Compton
  scattering counts as absorption; the inner-shell photoeffect of heavy elements is missing beyond
  the Verner fits; electrons are slowed by the heavy-particle Bethe formula.
- Neutron data: resonances are reconstructed at 0 K (no Doppler broadening), only for actinides
  and strong thermal absorbers; R-matrix-limited (LRF=7) and unresolved ranges keep the MF3
  values; thermal scattering is the free gas (no S(α,β) of graphite or bound hydrogen); delayed
  neutrons are released isotropically at the fission point; densities do not follow heating.
- Molecule dipoles come from charge equilibration and run high (water 2.9 D against 1.85 D); the
  picker does not show them.
- Thermal radiation ionizes from the ground state only and does not excite; photodissociation of
  molecules by thermal photons is not included.
- Medium reaction rates below T₉ = 0.01 come only from the S-factor and 1/v tables.
- The REACLIB snapshot drops isomers and nuclides absent from NUBASE2020 (4611 of 8089 names).
- Saha and the Voronov fits are used outside their published ranges at very high temperature; the
  equilibrium stays consistent by detailed balance, the time scales there are approximate.
- Continuum lowering truncates levels but does not shift the remaining thresholds.
- Runs execute in the API process (streamed progress, no worker pool); the trace search is bounded
  by 240 shots or 1.5 s.
