# Roadmap

Each step is planned, approved, built, and closed with `pnpm check`.

1. **Foundation** (done): monorepo, tooling, lint rules, CLAUDE.md, contracts, constants with
   generator and particle catalog, utils with the first oracle tests, engine composition root,
   Postgres via compose.
2. **Particles** (done): class hierarchy from `AbstractParticle` to quarks, leptons, bosons,
   proton and neutron; capabilities with type guards; factory with registry and deterministic
   ids; `CompositeParticle`. Deterministic tests on creation, interactions, observables,
   magnetic dipoles against CODATA, kinematics, confinement and decays.
3. **Quantum core** (done): own complex linear algebra with a Jacobi spectral decomposition,
   `StateVector`, `DensityMatrix`, spin operators for any spin, `QuantumRegister` and manager,
   `Measurement` with injectable `CollapseStrategy`, `QuantumCore` facade. Exact and Monte Carlo
   tests from the oracle: Stern–Gerlach, singlet correlations, CHSH, Bell states, reduced states.
4. **Environment and influences** (done): immutable environment with aspects, Zeeman,
   phenomenological and collisional contributors, quantum-jump decoherence on pure states,
   `Dynamics` with Boltzmann populations and electric kicks, twelve influences with a registry.
   Tests: Zeeman and Larmor against CODATA, Kraus references, thermal polarization, dephasing and
   relaxation Monte Carlo, aspect extension by augmentation.
5. **Decays and kinematics** (done): `Decays` with time and channel sampling, two- and
   three-body flat phase space with a matrix-element hook (Michel weight), lab-frame products,
   parent retirement, conservation checks, motion during evolution. Tests: W, Z, top, muon,
   neutron, mean life, branching frequencies, Michel mean, isotropy.
6. **Experiment runner** (done): plan compilation with placeholders and static checks,
   shot-by-shot execution with a fresh context, record aggregation into report values and
   outcome counts, progress callback, `ExperimentBuilder`, `runExperiment`. Templates:
   Stern–Gerlach, singlet, CHSH, Larmor, muon decay, neutrino oscillation with a PMNS
   Hamiltonian.
7. **API** (done): NestJS over the engine with explicit injection tokens, templates list, get,
   save, delete and validate, runs start, list and get, catalog and health; runs and results
   persisted; end-to-end test against Postgres; compose service.
8. **Frontend** (done): React and Vite, template picker with parameter form and run, result
   table with outcome bars, run history, pipeline builder with per-operation step forms, JSON
   mode, validation, run and save as template; compose service with API proxy.
9. **Collisions and space** (done): tree-level e⁺e⁻, γγ and Compton collisions with channel
   selection; an N³ spatial cube with split-operator evolution, potentials, Born position
   measurement and probability clouds in the system report. Templates: Z resonance,
   forward-backward asymmetry, annihilation at rest, Compton, photon collider, hydrogen atom,
   spreading, tunnelling, harmonic oscillator.
10. **Lagrangian** (done): the Standard Model Lagrangian as data, Feynman rules derived from it,
    tree amplitudes by off-shell recursion, cross sections and widths validated against textbook
    formulas and PDG, collisions and decay kinematics from amplitudes, confinement into baryons
    and jets, the Lagrangian page with a process calculator.
11. **Mesons and strings** (done): PDG 2026 meson data, Lund string fragmentation of every
    colour-singlet pair into mesons, spectator weak decays of D and B mesons, the decay cascade
    inside each time window, system counts. Templates: Lund string, B⁺ decays.
12. **Proton structure, fusion and atoms** (done): PDG 2026 baryons and baryons from strings,
    NNPDF2.3 parton distributions, hadron collisions with beam remnants, light nuclei, fusion from
    measured S-factors in collisions and hot plasma, radiative recombination, photoionization and
    antihydrogen. Templates: LHC jets, Drell–Yan, top pairs at LHC and Tevatron, HERA, D–T beam and
    plasma, solar pp chain, neutron capture, recombination, photoionization, antihydrogen.
13. **Matter** (done): all 3558 NUBASE2020/AME2020 nuclei and the atoms and ions of Z = 1–110
    from NIST, searchable in under 10 ms; molecules from a configurator of atoms and bonds with
    UFF geometry, normal modes, QEq dipole and bond energies; the class chain molecule ⊃ atom ⊃
    nucleus ⊃ nucleon ⊃ quark; radiation as an influence (photoionization, Compton, photonuclear
    knockout, photodissociation, microwave and infrared heating) and Doppler laser cooling;
    measureSystem readings per object type; template categories with icons, filter and tags.
    Templates: silver Stern–Gerlach, sodium laser cooling, UV ionization of hydrogen, deuteron
    photodisintegration, microwave heating of water vapour, thermal dissociation of H₂, ²³⁸U
    alpha decay.
14. **Media and chemistry** (done 2026-10-16/17): multi-component media with collisional
    ionization and Saha balance, environment regions for part of the system, bond formation by
    detailed balance, continuum electron capture, JINA REACLIB for every nucleus with
    photodisintegration and three-body channels, continuum lowering, traced shots that cover the
    outcomes, nested envelopes on the stage, full RU/EN, desktop packaging.
15. **Pressure, phases and radiation** (done 2026-10-17): pressure as a medium input with the
    ideal-gas default, aggregate state by critical data with a corresponding-states estimate from
    UFF Lennard-Jones parameters, `phase` in `measureSystem`, phase transitions as events, a
    radiation temperature for photoionization and photodisintegration by thermal photons
    (photoexcitation waits for step 19).
16. **Medium presets and sliders** (done 2026-10-17): logarithmic scales with landmarks for
    density, temperature and pressure; 27 presets with sources (standard atmosphere 1976 at seven
    altitudes, ocean, planets, the Sun, interstellar phases, laboratory vacuum, tokamak, the early
    Universe).
17. **Molecule reactions** (partly done 2026-10-18): atom transfer between a molecule and the
    medium with BEBO barriers and transition-state rates, so H₂ + O₂ ignites by chain branching;
    bond orders on association; carbon allotropes; solutions with pH and electrolysis; finite media
    that absorb and heat; ENDF neutron transport and fission; deconfinement above the QCD
    crossover. Still open: reactions between two particles of the plan, termination reactions,
    π-bond relaxation for hydrocarbon flames, Brønsted acid–base chemistry of polyatomic molecules
    (molecular ions, protonated amino acids, stepwise H₂SO₄).
18. **General ionization**: binary-encounter Bethe cross sections from ionization energies for
    all elements; Voronov kept as the test oracle.
19. **Atomic levels**: NIST ASD levels and lines for neutral atoms and first ions, Boltzmann
    populations, electron-impact excitation, spontaneous emission, resonant photoexcitation.
20. **Audit**: full review of architecture and physics with test coverage; the architecture is
    then extended only.
21. **Next physics**: parton shower, multiple parton interactions, one-loop corrections, soft
    hadron–hadron scattering by quark exchange and strings.
22. **Scale when needed**: queue and worker for long runs, fast qubit backend.
