# Architecture

## Scope

The engine simulates finite-dimensional quantum degrees of freedom of Standard Model particles
(spin, polarization, flavor), their classical kinematics, statistical decays, and the effect of
an environment. It is not a quantum field theory or an event generator. The acceptance suite is
the test oracle in `docs/STANDARD_MODEL_REFERENCE.md` §4.15.

## Layers

```
libs/contracts   types, interfaces, plan schema (ajv), Sequelize models      depends on: nothing internal
libs/constants   CODATA + PDG data, generated constants, particle catalog   depends on: contracts
libs/utils       units, random, sampling, kinematics, statistics            depends on: constants, contracts
packages/engine  particles, quantum, environment, influence, experiment     depends on: all libs
apps/api         NestJS transport and persistence                           depends on: engine, libs
apps/web         React + Vite pipeline configurator                         depends on: contracts, engine
apps/desktop     Electron shell: embedded Postgres, API in a child process   depends on: api, web
```

Dependencies only point downward. The engine has no framework dependency and runs in Node and in
the browser; NestJS is only the DI container and transport of `apps/api`.

## Unit system

Internally energies and masses are in GeV (natural units, reduced Planck constant and speed of
light equal to one). Lifetimes are in seconds, lengths in femtometers, environment parameters in
SI. Every conversion goes through `@standard-model/utils` and is built from exact CODATA factors.

## Constants

`libs/constants/data/codata2022.json` is copied verbatim from NIST. `pnpm generate:codata` turns it
into `codata.generated.ts`, one named `Quantity` per entry, with names produced by
`toConstantName` (see `docs/NAMING.md`). `codata-aliases.ts` adds short names for frequent
constants. PDG values live in `data/pdg2026.json`, transcribed once from the reference: masses, widths,
lifetimes and decays of quarks, leptons, bosons, 25 mesons and 42 baryons, plus the isospin
multiplets that split modes such as Δ → Nπ by Clebsch–Gordan coefficients computed in code.
`data/reaclib.generated.json` holds the JINA REACLIB rate fits for every reaction between NUBASE nuclei (`pnpm generate:reaclib`); the medium takes its thermonuclear rates from it and falls back to the S-factor tables where the library is silent. `data/nuclear.json` holds the light nuclei, the fusion S-factors (Bosch–Hale, Solar Fusion II),
NIST neutron cross sections and atomic ionization energies; `data/string-fragmentation.json` the
PYTHIA model parameters. The NNPDF2.3 LO QED proton grid sits verbatim in `data/pdf/`, and
`pnpm generate:pdf` turns it into a compact JSON that the engine loads into typed arrays; a
database would only add a round trip to every one of the millions of lookups a run makes. The
particle catalog (`particles/*.ts`) assembles `ParticleSpec` objects from all of them: hadron
charge, flavour and statistics follow from the quark content, nuclei from CODATA masses, atoms
from a nucleus and electrons with the binding energy subtracted; antiparticles, down to
antihydrogen, are derived by `conjugateParticleSpec`, never typed by hand. The aggregate state
reads `data/critical-points.json` and `data/phase-points.json` (transition points of a substance,
keyed by its bond graph so isomers stay apart), then the Joback–Reid group contributions of
`data/joback1987.json` for an untabulated organic molecule, then a Lennard-Jones estimate; a new
substance is a data row, a new estimate a function in `environment/`.

## Engine design

### Particles

Inheritance expresses taxonomy; behaviour is composed.

```
AbstractParticle                    id, spec, kinematics, register slot, derived interactions
├── Fermion                         half-integer spin invariant
│   ├── Quark                       color charge, confinement test, top decay
│   ├── ChargedLepton               charge, magnetic dipole, muon and tau decays
│   └── Neutrino                    spin plus three-dimensional flavor observable
├── Boson                           integer spin invariant
│   ├── GaugeBoson                  polarization: 2 helicities massless, 2j+1 massive
│   │   ├── Photon                  electromagnetic carrier
│   │   ├── Gluon                   color octet
│   │   ├── WBoson                  charged, decays
│   │   └── ZBoson                  weak carrier, decays
│   └── HiggsBoson                  no internal observable, Yukawa decays
└── CompositeParticle               live constituents, charge check, union of interactions
    ├── Meson                       π, K, η, ρ, ω, φ, D, D_s, B, B_s and their V states; PDG decays,
    │                               weak heavy-flavour decays from the spectator model
    ├── Baryon                      p, n, Λ, Σ, Ξ, Δ, Ω, Λc, Σc, Ξc, Ωc, Λb, Σb, Ξb, Ωb; magnetic
    │                               dipole, PDG decays, weak decays with a diquark spectator
    ├── Diquark                     colour antitriplet ending a string or left by a struck proton
    ├── Nucleus                     any NUBASE2020 nuclide from Z protons and N neutrons; AME2020
    │                               mass, Jπ, half-life and decay modes; CODATA moments for d, t, h, α
    ├── Atom                        any element and ion from a nucleus and electrons; NIST
    │                               ionization energies in the mass, J and Landé moment of the
    │                               ground level, decays of the nucleus with electrons kept
    └── Molecule                    atoms joined by bonds; UFF structure (geometry, normal modes,
                                    moments of inertia, QEq dipole), bond energies, internal
                                    temperature
```

Every composite holds live constituents, so a molecule contains its atoms, an atom its nucleus and
electrons, the nucleus its nucleons and a nucleon its quarks; charge and interactions are checked
against them. Measurements read each level: `measureSystem` records for every labeled object its
mass, charge, spin and motion; nuclei add nucleon numbers, binding per nucleon, separation
energies and half-life; atoms add electrons, the next ionization energy, the Landé factor and the
kinetic temperature; molecules add bonds, dipole, rotational constants, vibrational modes and the
internal temperature.

Names: catalog particles keep their names (`proton`, `deuteron`, `hydrogenAtom`); generated
objects are `nucleus:Z:A`, `atom:Z:A:charge` and `molecule:Z-A,...;i-j-order,...` (an ion adds
the formal charges of its atoms as a third part, `;0+1,4-1`), and
`particleSpec(name)` in `@standard-model/constants` resolves any of them, building and caching
generated specs from `data/matter.generated.json` (`pnpm generate:matter` regenerates it from the
verbatim NUBASE2020, AME2020, NIST, Verner, RDKit UFF and OpenStax files). Light nuclei and atoms
map to their catalog aliases, so fusion and recombination keep working.

Electron, muon and tau share `ChargedLepton`, the six quarks share `Quark`: inside a family they
differ only by catalog data, and an empty subclass would be noise. A subclass appears when a
particle gets behaviour of its own. Antiparticles use the same class with the conjugated spec.

Interactions are derived from the spec by rules, not listed per class: nonzero charge gives
electromagnetic, non-singlet color gives strong, nonzero weak isospin or hypercharge gives weak,
nonzero mass gives Yukawa, everything is gravitational; carriers add their own field through a
hook. Composites take the union of their constituents.

Capabilities are small interfaces (`Decayable`, `ElectricallyCharged`, `ColorCharged`,
`MagneticDipole`, `Composite`) with type guards in `capabilities.ts`, so later layers work on the
`Particle` contract without `instanceof`. The gyromagnetic ratio is `|μ| / (j ħ)`, which
reproduces CODATA for electron, proton and neutron; the tau uses the Dirac value.

`ParticleFactory` creates instances from the catalog through `ParticleClassRegistry`, which
resolves a class by particle name first and by family second, so a new class is one
`registerName` call. Ids come from an injected `IdGenerator` (sequential by default) to keep runs
reproducible. Composites are built recursively with live constituent particles.

### Quantum core

Quantum state never lives inside a particle. A `QuantumRegister` owns a joint Hilbert space;
each particle holds a `QuantumSlot`. Entangling two particles merges their registers and applies
a unitary. Measuring one particle applies `projector ⊗ identity` to the whole register, so
correlations of entangled states follow from the mathematics (reference §4.4, §4.8). Tensor
products use the big-endian index convention.

`Measurement` is one shared service: it computes Born probabilities and post-measurement
states, then delegates the choice to an injected `CollapseStrategy` (projective by default; POVM
or weak measurement are new strategies) using an injected seeded `RandomSource`. Expanded
projectors are cached by operator fingerprint so Monte Carlo loops do not rebuild them.

Linear algebra is the project's own `linear-algebra.ts` on typed arrays: complex matrices,
Kronecker products, adjoints and a Hermitian spectral decomposition. The decomposition embeds a
Hermitian `n×n` matrix as the real symmetric `2n×2n` matrix `[[A, −B], [B, A]]`, runs a cyclic
Jacobi solver (orthonormal eigenvectors even for degenerate spectra) and rebuilds complex
projectors as half the sum of the paired real eigenvectors. Everything else (`exp(−iHt)`,
rotations, measurement projectors) is a function of that decomposition. mathjs was not needed:
its general complex eigensolver does not guarantee orthogonal eigenvectors in degenerate
subspaces, which projectors require.

Layer contents: `StateVector` (immutable, normalized), `DensityMatrix` (from pure states, partial
trace, purity, entropy), `spin-operators.ts` (any spin through ladder operators, Pauli matrices,
directions from polar and azimuth angles, rotations), `observable-operators.ts` (spin and
polarization along a direction, flavor in its basis, preparation states), `entangled-states.ts`
(Bell states, singlet, triplet zero), `QuantumRegister`, `QuantumRegisterManager` (allocate,
merge by tensor product, dispose, keeps particle slots in sync), `Measurement`,
`ProjectiveCollapse` and the `QuantumCore` facade (`prepare`, `entangle`, `measure`,
`probabilities`, `expectation`, `correlation`, `stateOf`, `reducedStateOf`, `release`).

Known ceilings: `entangle` takes two particles that are not entangled with anything yet;
measurement acts on pure states, mixed-state measurement arrives with decoherence; concurrence
is implemented for pure two-qubit states; registers beyond about ten qubits get slow.

### Environment

`ImmutableEnvironment` implements the `Environment` contract over a map of aspects; `with` and
`without` return new instances. Aspects: `temperature`, `magneticField`, `electricField`,
`medium` (components, each a species with its own density and cross section, one temperature,
a pressure that defaults to the ideal gas, an optional radiation temperature, one bulk velocity,
a reaction mode), `neighbors`,
`coherenceTimes` (T1, T2). A new aspect is a module augmentation of `EnvironmentAspects` plus a
contributor registered through `createEngine` options; nothing else changes.

A shot has one shared environment and any number of regions. An environment influence that names
targets does not touch the shared environment: `ShotContext.scope` records a region (aspect,
value, member ids) and `environmentFor(particle)` overlays the regions a particle belongs to on
the shared environment, so an inner medium replaces the shared one for its members while aspects
of other kinds add up. Products inherit the regions of their parents (`ShotContext.add`), and
every frame of the system report lists the regions with their living members, which the stage
draws as nested envelopes. Everything that reads the environment during a step (dynamics, decays,
medium reactions, chemistry, radiation) asks for the particle's own environment.

Contributors turn aspects into physics. `ZeemanContributor` gives `H = −(μ / jħ)(B·S)` in
radians per second on the spin slot of magnetic dipoles, with the sign of the moment, so the
electron's `m = +1/2` level lies above `m = −1/2`. `PhenomenologicalDecoherenceContributor` turns
T1 and T2 into rates. `CollisionalDecoherenceContributor` turns a statistical medium into a
dephasing rate `Σ n σ v_rel` over its components with the thermal speed `sqrt(8kT/πm)` of each; the same
module gives the collision rate and mean free path used to decide whether a particle interacts
with the background. Background particles never occupy register slots.

Hamiltonians are kept in angular-frequency units, so evolution is `exp(−iHt)` with time in
seconds and no Planck-constant bookkeeping.

### Decoherence as quantum trajectories

Registers stay pure. `QuantumJumpDecoherence` applies a Kraus channel per shot and samples one
branch with probability `‖K ψ‖²`; averaging over shots reproduces the Lindblad master equation.
Dephasing is an unrecorded measurement in the computational basis with probability
`1 − exp(−t/T2)`; relaxation is a jump to the ground state of the slot Hamiltonian with
probability `1 − exp(−t/T1)`, built from its eigenvectors (non-degenerate levels required). The
same Kraus sets feed `applyKrausMap` on `DensityMatrix`, which is the exact reference in tests.

### Dynamics and influences

`Dynamics` sums Hamiltonian terms per observable, sums decoherence rates, computes Boltzmann
populations of the slot levels, and `evolve` applies in order: unitary evolution of every bound
slot, the decoherence channel, the classical electric kick `Δp = qEt` (exact for a constant
field), and proper time `t / γ` (photons do not age). For non-commuting unitary and dissipative
parts an experiment splits the duration into steps.

Influences are commands with a context carrying the environment, random source, particles,
quantum core and dynamics: `SetTemperature`, `ChangeTemperature` (`cool`, `heat`, never below
absolute zero), `ApplyMagneticField`, `RemoveMagneticField`, `ApplyElectricField`,
`SetCoherenceTimes`, `SetMedium`, `Boost`, `RotateSpin`, `Thermalize` (Boltzmann sampling of an
energy eigenstate, unentangled particles only), `Randomize` (Haar state) and `Evolve`.
`InfluenceRegistry` builds them by name from plain parameters for plan steps.

Radiation: `Irradiate` takes a frequency (photon energy hν), a power and a beam area (photon flux)
and a duration. For each target it collects absorption channels with cross sections from
`radiation/photon-absorption.ts` (Verner photoionization, Klein–Nishina Compton ionization,
Bethe–Peierls and giant-dipole photonuclear knockout, molecular photodissociation and dissociative
photoionization), samples one with probability 1 − exp(−σΦt) and returns it as a reaction: the
parent leaves, the products appear with momenta from sequential two-body kinematics that conserve
the four-momentum of parent plus photon. Molecules are also heated (Debye orientational and
resonant infrared absorption) and may break thermally during the exposure. `LaserCool` slows an
atom or ion with a NIST cooling transition: the saturated scattering force above the capture
velocity, then an Ornstein–Uhlenbeck relaxation toward the Doppler temperature. Influence outcomes
may carry such reactions; the runner turns them into new labeled objects. During `evolve`
`MolecularDynamics` relaxes each molecule's internal temperature toward the environment and
samples thermal dissociation of its bonds.

Compile-time guards keep runs from failing late: `cool`, `heat` and `thermalize` need an earlier
`setTemperature`; spin influences need a particle with spin or polarization; `travel` needs a
moving particle; `laserCool` needs an atom or ion with a cooling transition; molecules do not
collide; unknown nuclides, impossible ions, valence overflow and disconnected molecules are
reported with the nearest valid choices.

### Decays

`Decays` samples a proper decay time from the exponential law with the particle's mean life
(from the catalog or from the width), dilates it by `γ` in the lab, lets `Dynamics` carry the
parent to the vertex, picks a channel by normalised branching fractions and builds the products
as live particles with lab-frame four-momenta. The parent is retired (`status: decayed`), its
registers released; decaying an entangled parent is refused.

Kinematics come from phase space in `phase-space.ts`: two bodies back to back with the textbook
`p*` and an isotropic direction; three bodies by a sequential two-body split. Three-body decays of
elementary particles are weighted by |M|² of their tree diagrams, normalised to the maximum over a
24 × 24 Dalitz grid with a safety factor, so the Michel spectrum and the neutron and tau spectra
come from the Lagrangian; meson decays use flat phase space. Inclusive `hadrons` and `invisible`
channels of W and Z resolve into quark or neutrino pairs by their tree widths. A channel below a
two-boson threshold, such as H → W W and H → Z Z, keeps one boson real and turns the other into
the fermion pair of a virtual boson, chosen by the 1→3 tree widths; the sums are 0.790 MeV for
W W* and 0.084 MeV for Z Z*, inside the PDG 0.771 ± 0.075 and 0.084 ± 0.009 MeV.
`conservation.ts` checks charge, baryon and lepton family numbers for every exclusive channel,
both as a data-integrity test of `pdg2026.json` and at runtime. `evolve` also moves particles by
`v t`, so decay vertices and decay lengths (`βγcτ`) are meaningful.

### Lagrangian and Feynman rules

`packages/engine/src/lagrangian` holds the Standard Model Lagrangian as data: the gauge group
SU(3)×SU(2)×U(1), the fermion multiplets with T₃ and Y read from the particle catalog, the Higgs
doublet and the parameters. Two coupling schemes exist: G_F, M_W, M_Z for decays, and the
running α(√s) with on-shell sin²θ_W for collisions. The CKM matrix comes from the Wolfenstein
parameters. `deriveLagrangian` expands the Lagrangian into Feynman-rule vertices: fermion
currents from the covariant derivative, triple and quartic gauge couplings from the structure
constants rotated to W±, Z, γ, hVV and hhVV from |DΦ|², hhh and hhhh from V(Φ), and Yukawa
vertices from the masses. The W and Z masses come out of the same expansion and are checked
against the inputs.

`packages/engine/src/feynman` turns vertices into numbers. Tree amplitudes come from an
off-shell recursion over subsets of external legs. Each process is compiled once into a list of
vertex operations per species, and helicities and colours are summed numerically. Fermion signs
follow the leg ordering, with an extra sign when a column current closes a line with a row
current. Propagators use an s-dependent width for W and Z, as in the PDG mass definition.
`ProcessKinematics` integrates 2→2 cross sections in rapidity, with a detector acceptance when a
massless exchange makes the forward peak diverge, and 1→2 and 1→3 widths by Dalitz quadrature.
`ProcessCalculator` serves `/api/lagrangian` and `/api/processes`. The tests compare Bhabha,
Møller, Klein–Nishina, Breit–Wheeler, qq̄ → gg and gg → gg with textbook formulas, and the W,
Z, top, Higgs and muon widths with analytic results and PDG.

### Collisions

`Collisions.collide(first, second, channel?, options?)` dispatches on the pair. Composite
particles go to the first `CollisionMechanism` that applies: `AtomicProcesses` for an electron or
positron with a bare nucleus or ion and for a photon on an atom below 10 keV, `NuclearReactions`
for nucleons and light nuclei below 10 MeV in the centre of mass, and `PartonCollisions` for
nucleons and antinucleons with each other or with elementary particles at higher energy. Two
elementary particles use the tree-level tables below.

`PartonCollisions` reads the parton structure of a nucleon from its constituents (proton grid,
isospin for the neutron, charge conjugation for antinucleons). QCD 2→2 processes reduce to nine
flavour-blind classes (gg → gg, gg → qq̄, qg → qg, qq̄ → gg, qq̄ → q′q̄′, qq̄ → qq̄, qq → qq,
qq′ → qq′, qq̄′ → qq̄′) whose angular tables are computed once from the tree amplitudes at 500 GeV
and scaled by ŝ and α_s(√ŝ/2)² from the PDF set; a triggered channel, or a lepton beam, uses
tables on an ŝ grid with the running couplings. Luminosities come from Gauss–Legendre rapidity
integrals of the PDFs on a ln τ grid, above a transverse-momentum threshold (20 GeV by default),
since the soft part of σ_pp is non-perturbative. The struck nucleon leaves a remnant: a diquark
for a valence quark, the hadron with a companion antiquark for a sea quark, a quark and a diquark
for a gluon, the intact hadron for a photon. Remnant pieces share the rest of the momentum by the
PYTHIA x shapes, get the opposite primordial k_T, and all momenta are rescaled in the centre of
mass so energy is exact. Hadronization then forbids strings between pieces of one remnant, which
by colour belong to the hard partons, and repairs a greedy pairing that would leave them alone.

`NuclearReactions` uses σ(E) = S(E)/E · exp(−B_G/√E) with the Gamow constant from CODATA, the 1/v
law for neutron capture, Rutherford scattering in the |cos θ| < 0.95 acceptance and NIST neutron
elastic cross sections; every nuclear component of a hot medium fuses through
`ThermalNuclearReactions` at its own n⟨σv⟩ with the Maxwell average computed numerically.
`AtomicProcesses` uses the Kramers recombination cross section summed over 30 shells with the
Milne relation, the Kramers photoionization cross section, and Thomson scattering. With the
electron or positron component `MediumChargeBalance` gives an atom its chain of charge states:
Voronov electron-impact ionization, Kramers radiative and detailed-balance three-body
recombination at an effective temperature that includes the drift.

Thermonuclear rates in a medium come from JINA REACLIB (`collisions/reaclib-rates.ts`): for a
nucleus and the nuclear components around it, every library reaction whose other reactants are
species of the medium becomes a channel, two- or three-body (triple alpha), with the factorial of
identical partners, leptons restored to weak reactions by the charge they move and a photon added
to radiative captures; the S-factor tables remain for beams and for pairs the library does not
hold. Nuclear decays join the same chain: spontaneous NUBASE channels, capture of a continuum
electron of the medium (laboratory rate scaled by the Coulomb-enhanced electron density at the
nucleus over the K-shell density), and photodisintegration by the thermal photons at the REACLIB
reverse rate. Endothermic channels and photodisintegration take their threshold energy plus a
thermal excess from the bath. Continuum lowering (the smaller of the Debye–Hückel and ion-sphere
potentials) removes the bound levels a dense plasma cannot hold, so hydrogen in the solar core
and helium in a giant's core stay bare where the Saha formula alone would bind them.

`MediumReactions` joins all of this for one particle and one window: the charge states are the
transient states of an absorbing Markov chain, every fusion and decay channel of a nuclear state
is an absorbing state, and the end of the window is sampled from `absorbingMarkovTransition`. Channels therefore compete by rate (total rate, then channel by
weight), and a nucleus fuses only while the electrons leave it bare. The leak to fusion is kept
apart from the conserved charge exchange during scaling and squaring, so rates 10³⁵ apart (pp
fusion against ionization in the solar core) stay exact. The medium's `reactionMode` decides
what happens after a fusion: `oneReactionPerStep` lets the products wait for the next step;
`allReactionsInStep` samples the reaction time on a dyadic ladder (`absorptionTimeInSeconds`) and
lets the heaviest product that still has a channel carry the line in the rest of the window, each
nuclear species at most once per line and never a product the medium already holds (it has
dissolved into the gas, and its further fate is the medium's statistics), so one step of ten
billion years takes a proton to ³He and one step of a hundred thousand years takes ³He through the
pp-I, pp-II or pp-III branch, and the CNO cycle makes one lap per step. Other products wait, which
keeps the chain from branching; a limit of 1000 reactions per step guards against data that would
loop. Every evolution step lets alive particles react with their own `medium` before confinement
runs.

Chemistry follows the same shape (`molecules/molecular-association.ts`, `molecular-dynamics.ts`):
a neutral atom or molecule in a gas joins an atom of the gas by a single bond while both keep a
free ordinary valence (octet or duet rule, so noble gases stay inert); the joining rate is the
breaking rate of that bond times the equilibrium constant from translational, rotational,
vibrational and electronic partition functions, so a cold gas assembles molecules and a hot one
takes them apart, and the species a line passes through form one absorbing chain whose end obeys
the chemical equilibrium of the gas. There is no bond rearrangement between two molecules yet.
In liquid water `SolutionChemistry` adds solution laws: Born–Haber dissociation of a diatomic
M–X and Brønsted proton transfer of the acid–base systems in `data/acid-base.json`, whose forms
are charged molecules sampled at the pH of the medium by the law of mass action
(`molecules/proton-transfer.ts`); the pH comes from charge balance over every ion and chain.

Elementary pairs: `Collisions` takes any two elementary particles. Open final
states are the pairs that conserve charge, baryon and lepton numbers, pass the mass and hadronic
thresholds, and have at least one tree diagram. Each channel gets its cross section and a
dσ/dcosθ table from the amplitudes, cached per energy. The channel is drawn by cross section and
the angle from the table, then products are boosted to the lab. The two photons from e⁺e⁻
annihilation share a register in the Bell state ψ⁻. Three-body decays of elementary particles
draw their kinematics from |M|², and inclusive hadronic and invisible W and Z decays resolve into
quark or neutrino pairs by their tree widths.

### Force carriers, collision energy and the Lagrangian under the hood

The Lagrangian page is a window onto the same model the runner uses; there is no second
physics path. A `collide` step draws its channel, cross section and angle from the tree diagrams
of the Lagrangian at the √s of the pair, and a `decay` step takes its sub-channels, three-body
spectra, virtual-boson decays and heavy-meson weak decays from the same vertices. The process
calculator on that page only exposes these numbers.

Force carriers enter where perturbation theory puts them. Virtual γ, Z, W, gluon and Higgs are
the internal lines of the diagrams: their propagators shape cross sections, angular
distributions, widths and interference, such as the γ–Z forward-backward asymmetry. They are not
slots in the system state, because a virtual particle has no definite mass or lifetime to track.
A carrier that comes out real, a photon from annihilation, a gluon from q q̄ → g g, a W or Z, is
an ordinary particle of the system with its own register and decays. Classical fields, a
magnetic or electric field and a gas, are environment aspects acting through Hamiltonian and
decoherence contributors; the cube's Coulomb centre is the static limit of photon exchange. The
long-distance strong field is not evolved in time, it is replaced by confinement and strings.

A collision has no energy parameter of its own: √s comes from the four-momenta of the two
particles at the moment of the step, set by the momenta of their `create` steps or inherited from
the kinematics of the decay or collision that produced them. The builder shows the resulting √s
under every `collide` step. There is no beam object: a proton becomes a beam by having a
momentum, and its parton structure is a property derived from its quark content.

### Confinement and hadronization

After an evolution longer than ħ/Λ_QCD, with Λ_QCD from PDG, free quark triplets that match a
catalog baryon bind into it, the closest in momentum first. The baryon mass comes from the gluon
field, which the event reports. The compiler knows this too, so a plan can measure the `neutron`
that confinement forms.

Triplets of quarks bind into baryons only from the net baryon number, the excess of colour
triplets over antitriplets, so that quark lines from different vertices form strings instead.
The remaining colour triplets (quarks, antidiquarks) and antitriplets (antiquarks, diquarks) join
into colour-singlet strings, lightest pair first. A gluon
splits into a light quark–antiquark pair that is inserted into the string it adds least mass to;
gluons without quarks close into a loop. `StringFragmentation` breaks each string by the Lund
model with the PYTHIA 8.3 Monash parameters from `data/string-fragmentation.json`: u, d, s pair
creation with s/u = 0.217, Gaussian transverse kicks, the Lund symmetric z distribution with the
Bowler factor at c and b ends, vector to pseudoscalar ratios per flavour, η and η′ by octet–singlet
mixing with their extra suppression, K⁰ and K̄⁰ as K_S or K_L with equal odds, and a final
two-hadron step that closes the string exactly. A string too light for two hadrons collapses into
one meson; inside a decay the momenta are then rescaled in the parent frame so energy stays exact,
in free confinement the field supplies the difference, as for baryons. Colour without a partner
leaves as a jet. A break makes a diquark pair with probability 0.081/1.081; a diquark and a quark
form a baryon by the PYTHIA SU(6) weights and the Λ/Σ⁰ rule, the popcorn mechanism is left out.
There is no parton shower, so the multiplicity at the Z is about 13 charged particles against
20.8 measured.

Weak decays of D, D_s, B and B_s mesons use the spectator model: the heavy quark decays through a
virtual W with the 1→3 tree widths of the Lagrangian, its daughter forms a string with the
spectator, a hadronic W* forms a second string. Tree level without QCD corrections gives B → e ν X
at 16% against 11% measured and D⁰ → e X at 19% against 6.5%. Every evolution window lets mesons
decay in a cascade: each draws its lab-frame decay time, decays when it falls inside the window,
and its products continue from that time. `measureSystem` lists particles that are not from
strings by name and adds `hadrons` for everything that is, and records `particleCount`,
`chargedCount`, `hadronCount`, `photonCount`, `hadronic` and `count.<particle>`.

### Space cube

`SpaceLab` in `packages/engine/src/space` puts massive particles on an N³ grid (32 or 64) as
wave functions. Evolution is split-operator with a radix-2 FFT and an absorbing edge mask.
Potentials are free, a barrier slab across x, a harmonic trap and a softened Coulomb centre;
`groundState` placement uses the analytic 1s or Gaussian ground state. Position measurement
samples a cell by Born's rule and collapses the wave function there. `validateSpace` and
`validateParticleInSpace` refuse scales where the non-relativistic grid is wrong: a cell
smaller than ten reduced Compton wavelengths, speeds above 0.1 c, packets narrower than
1.5 cells and step counts beyond the grid's limit. The system report carries a `SpaceSnapshot`
per frame with a 16³ density, three projections and ⟨r⟩, σ and energy for each cloud.

The cube is also the world of the experiment, centred on the origin, and nothing in it is
hard-coded (`space/geometry.ts`, `space/potentials.ts`):

- Potentials are entries of `POTENTIAL_LAWS`, one function of the point, the settings and the
  particle; a new potential is one entry.
- Walls are entries of `WALL_LAWS`: `open` (particles fly out, a wave fades in the absorbing
  mask) and `reflecting` (a super-material mirror: a point particle folds back exactly by the
  unfolding of a straight flight, a transported neutron bounces at the wall, a wave meets a layer
  as high as the largest kinetic energy one cell holds, so the time step does not shrink).
- Shapes are entries of `BODY_SHAPE_LAWS` (`ball`, `box`): whether they hold a point, the
  distance along a ray to their surface, their volume. A medium may carry a geometry; the
  `placeBody` influence puts several such media in space at once (the `bodies` aspect), and a
  particle sees the medium of the smallest body that holds its position (`withBodyMedium` in
  `ShotContext.environmentFor`). A legacy medium with only a thickness is a ball at the centre.
- `World` is what one particle sees: the ambient medium, the bodies and the walls. Neutron
  transport walks it segment by segment (free path in the current medium, the nearest body
  surface, the nearest wall), so a neutron leaves the core, crosses a tamper, bounces off a
  mirror wall and comes back within one window; volume, heat capacity, stopping and
  absorption take the body's shape, and the energy a body absorbs heats that body.

An electron and a positron that are both in the cube can annihilate. `PairAnnihilation` uses
the contact rate Γ = 4·P_singlet·(π r_e² c)·∫ρ₋ρ₊ d³r, which is spin-averaged π r_e² c ∫ρ₋ρ₊
when the spins are not prepared. The probability 1 − exp(−∫Γ dt) is integrated over cube
evolution in eight chunks, and over plain evolution only in a harmonic trap, where the
clouds are stationary. A pair that annihilates becomes two entangled 511 keV photons. The
three-photon decay of the triplet state, about 1115 times slower, is not modelled. Positrons
are repelled by the Coulomb centre: the cube potential takes the particle's charge.

### Experiments

An `ExperimentPlan` (see `libs/contracts/src/experiment-plan.ts`) is declarative JSON:
parameters with defaults, shots, seed, an optional `space`, ordered steps (`create`, `entangle`,
`influence`, `evolve`, `measure`, `combine`, `diffract`, `collide`, `place`, `propagate`,
`measurePosition`, `decay`) and a report. Templates are plans with `{{parameter}}`
placeholders; `ExperimentBuilder` produces the same JSON from a fluent TypeScript API.

```
plan JSON → ajv validation → parameter merge and {{placeholder}} substitution
          → static checks (labels, records, report references) → CompiledPlan
          → ExperimentRunner: one seeded engine, a fresh ShotContext per shot
          → ShotRecords (numeric + categorical) → ResultAggregator → ExperimentResult
```

`compilePlan` throws `PlanCompilationError` naming the step. `ExperimentRunner.runShot` executes
the steps on a context holding particles by label, the immutable environment and the records;
registers are released after every shot. `create` prepares the spin when asked and always
prepares a neutrino's flavor in its own flavor. `decay` uses `Decays.decayAfterSampledTime`,
records the product set as a category plus numeric sub-records (`record.labTimeInSeconds`,
`record.product[i].energyInGev`, ...) and registers products under `label.0`, `label.1`, ... so
later steps can act on them. `measure` records the eigenvalue (and the flavor name for flavor).

`ResultAggregator` computes `frequency` per outcome (`label[outcome]`), `mean`,
`probabilitySameSign`, `correlation` (both on signs of two records) and `chsh` on eight records
of four pairs. `ExperimentResult` carries `reportValues` and `outcomeCounts` in exactly the shape
the `RunResult` model stores. `runExperiment(plan, options)` is the single entry point.

Built-in templates (`packages/engine/src/templates`, 69 across twelve categories, every text in
Russian and English through `templates/english.ts`) range from `sternGerlach`, `singletCorrelation`
and `chsh` (four singlet pairs per shot) to the star templates `cnoCycle`, `tripleAlpha`,
`sProcessIron`, `carbonBurning` and `firstNucleiAfterBigBang`, which are nothing but a nucleus in a
parametrised medium. `measureSystem` records the composition, counts per species, the heaviest
object and its mass number, and the readings of every object. After a run, `runExperiment` traces
extra shots with consecutive seeds until every distinct final outcome found within a budget has a
traced shot, so a rare branch of the statistics can be watched in the player.
`neutrinoOscillation` uses `NeutrinoFlavorContributor`, an always-on Hamiltonian contributor
(`aspectKey: null`) that builds the vacuum oscillation Hamiltonian
`U diag(0, Δm²₂₁, Δm²₃₁) U† / 2E` on the flavor slot from the PMNS angles (PDG defaults, CP
phase zero, overridable through the `neutrinoMixing` aspect) and the `travel` influence, which
evolves a particle for the time its speed needs to cover a distance.

## Patterns in use

| Pattern             | Where                                                  |
| ------------------- | ------------------------------------------------------ |
| Factory + Registry  | particle creation, step compilation, influence lookup  |
| Strategy            | `CollapseStrategy`, `DecoherenceModel`, `RandomSource` |
| Command             | influences and plan steps                              |
| Composite           | `CompositeParticle`                                    |
| Builder             | `ExperimentBuilder`                                    |
| Template Method     | `ExperimentRunner.run` with per-shot hooks             |
| Observer            | progress and per-shot events                           |
| Module augmentation | open `EnvironmentAspects`                              |

## API and web

`apps/api` is a NestJS 12 application run with tsx (no build step). Because esbuild emits no
decorator metadata, every constructor dependency is declared with `@Inject(token)`. The
`DatabaseModule` opens one Sequelize connection from the environment, runs `sync({ alter: true })`
on start and closes it on shutdown; models come from `@standard-model/contracts/db`, a separate
export so the browser bundle never touches Sequelize. Endpoints, all under `/api`:

| Method and path                              | Purpose                                                                                                                                |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /health`                                | API up, database answering                                                                                                             |
| `GET /catalog`                               | particles, elements, influences, observables, entangled states, spin preparations, statistics, operations, template categories         |
| `GET /templates`, `GET /templates/:name`     | built-in templates from the engine plus saved ones                                                                                     |
| `POST /templates`, `DELETE /templates/:name` | save a validated plan as a template, remove a saved one                                                                                |
| `POST /templates/validate`                   | compile a plan and return its errors without running it                                                                                |
| `POST /runs`                                 | run a template or an inline plan with parameters, shots and seed; persists run and result                                              |
| `POST /runs/stream`                          | the same run answered as newline-delimited JSON: the run id, progress (first shot, remaining time, shot n of N, tracing), then the run |
| `POST /runs/estimate`                        | pilot run: mean shot time, mean time per step and the forecast for the requested shots                                                 |
| `POST /runs/:id/stop`                        | stop an active run before its next shot; the stream ends with the finished shots as a stopped run                                      |
| `GET /catalog/nuclides/:protons`             | measured NUBASE2020 nuclides of one element for the species picker                                                                     |
| `GET /runs`, `GET /runs/:id`                 | history and a stored result                                                                                                            |
| `GET /species?query=&kind=&limit=`           | search nuclei, atoms and ions by symbol, mass number, element name or charge (in-memory, < 10 ms)                                      |

Runs execute in process, capped at 200 000 shots per request; the async runner yields between
shots so a streamed run reports progress, and a queue and a worker are the upgrade path when runs
outgrow a request. Progress uses streaming HTTP rather than a WebSocket because it passes the Vite
proxy and the desktop app's `app://` protocol without a socket server. Request and response types live in
`libs/contracts/src/api.ts` and are shared with the web client.

Every text that reaches a person exists in Russian and English. The engine and the API produce
`LocalizedText { ru, en }` (`libs/contracts/src/localized-text.ts`) and throw `LocalizedError`;
`GET /templates?lang=` and the `language` of a run resolve texts on the server, and error bodies
carry `{ statusCode, message, text }`. Built-in templates keep their English in
`packages/engine/src/templates/english.ts`, and `template-languages.test.ts` fails on Cyrillic
left in English output.

`apps/web` is React 19 on Vite, no router and no UI library. The interface is bilingual: strings
go through `say(ru, en)` and `bilingual()` from `language.ts`, a RU/EN switch sits in the header,
and the glossary exists in both languages. Three views: templates (pick,
set parameters, run, see the result), the pipeline builder (steps as forms specialised per
operation, parameters, reports, a raw JSON mode, validate, run, save as template) and run
history. The client imports contracts as types only and gets every vocabulary from
`GET /catalog`. Results render as a report table and proportional outcome bars.
The builder has a space card with the grid, cell size, potential, a logarithmic ruler of
reference lengths and an isometric preview. The ruler offers only scales the engine simulates.
The system player shows collisions as links from both beams to the products, and the cube as
a draggable 3D point cloud with three projections and the cloud statistics.
Templates carry categories (spin, interference, decays, neutrinos, colliders, confinement,
protons, space, nuclear, atoms, molecules, radiation); the templates view filters by any selected
category chip and by text, and the builder tags a plan with several categories, saved inside the
plan JSON. The builder creates nuclei and atoms through a species search and element, isotope and
charge pickers, and molecules through a configurator of atoms (element, isotope, formal charge
−1, 0 or +1) and bonds (order 1–3) that checks valence and connectivity and shows the Hill
formula with the ion charge (OH⁻, H₃O⁺, a ± zwitterion); a create-molecule step carries the
formal charges as an optional `charges` list. Icons are the
standard model lab set (`apps/web/src/sml-icons.json`, 216 icons on a 24 px grid, accent through
`--icon-accent`); steps can be reordered by drag and drop with a zoomed-out chain.
Every result has a formula panel: one LaTeX line per executed step with the resolved values,
then the statistics with their errors, rendered with KaTeX and exported as a standalone .tex.
A result can also be carried into a new draft. The last frame of the trace shot becomes the
new plan: survivors (molecular ions with their formal charges) with momenta and positions, spin
as an exact direction, entangled pairs with their exact amplitudes, and clouds as gaussian
packets with the same centre and width.
The environment and the neutrino flavour phase are not carried.

## Persistence and infrastructure

Postgres stores `experiment_templates`, `experiment_runs` and `run_results` through
sequelize-typescript models in `libs/contracts/src/db`, synchronised with `sync()`.
`compose.yaml` runs Postgres, the API (`pnpm start:api`) and the web preview server, which
proxies `/api` to the API container. `pnpm dev:api` and `pnpm dev:web` run both locally
against the composed Postgres.

`apps/desktop` hands the same three parts over as one application: `pnpm package` builds the web
bundle, bundles the API with the engine, and ships an embedded Postgres (`@embedded-postgres` for
macOS arm64, macOS x64 and Windows x64) that the Electron main process starts in a utility
process together with the API; the window opens on `app://` at once and holds `/api` requests
until the API answers. Outputs land in `release/mac-arm64`, `release/mac-x64` and
`release/win-x64`.

## Testing

Two tiers. Exact: deterministic properties and Born probabilities compared to 1e-12, which is the
infinite-shot limit. Monte Carlo: seeded runs of 10 000 shots compared within
`statisticalTolerance` (five binomial sigmas, absolute floor 1e-3). Seeds make the second tier
deterministic too.
