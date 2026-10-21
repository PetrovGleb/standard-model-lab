/* Second language of the built-in templates: English descriptions and report labels for the templates written in Russian, Russian descriptions for the few written in English; localizeTemplate returns a plan in the requested language. */
import type { ExperimentPlan, Language } from '@standard-model/contracts';

const ENGLISH_DESCRIPTIONS: Readonly<Record<string, string>> = {
  muonDecay:
    'A muon at rest decays through a virtual W after a sampled time; the electron energy follows from the diagram amplitude, on average 0.7 of the spectrum endpoint',
  doubleSlit:
    '50 keV electrons pass two 0.2 µm slits 1 µm apart and hit a screen 1 m away; fringes are spaced by λL/d',
  doubleSlitWhichPath:
    'The same experiment with a which-path detector at the slits: path information destroys the interference, only the single-slit envelope remains',
  delayedChoiceEraser:
    'Delayed-choice quantum eraser (Kim, Scully, 1999): the path of the signal photon is written into the polarization of an entangled idler photon measured later. The screen shows no fringes; among the coincidences with the eraser (axis 90°) there are fringes and antifringes; with the axis at 0° the idler reveals the path and no group shows fringes',
  doubleSlitInGas:
    'Double slit in dilute hydrogen: collisions with the gas decohere the electron, and the fringe visibility drops as exp(−n σ v t)',
  neutronDoubleSlit:
    'Zeilinger 1988: cold neutrons with a 1.85 nm wavelength, 22 µm slits 126 µm apart, screen 5 m away',
  malusLaw:
    'A horizontally polarized photon passes a polarizer; its azimuth on the Poincaré sphere is twice the polarizer angle, the transmission is cos² of the angle',
  michelSpectrum:
    'A muon at rest decays through a virtual W. The electron energy is sampled from |M|² of this diagram, (p_μ·p_ν̄)(p_e·p_ν), which gives the Michel spectrum x²(3 − 2x) up to the 52.8 MeV endpoint',
  muonTimeDilation:
    'A cosmic muon with 4 GeV momentum: its proper lifetime is 2.2 µs, in the lab γ times longer, with a range of tens of kilometers',
  neutronBetaSpectrum:
    'A free neutron decays into a proton, an electron and an antineutrino; the electron spectrum reaches 0.78 MeV of kinetic energy',
  wBosonDecays:
    'W⁺ decays into a lepton and a neutrino or into a quark pair; channel fractions from PDG 2026 with QCD corrections, tree-level widths are in the calculator on the “Lagrangian” page. The quark pair breaks a string into mesons, and the short-lived ones decay within a nanosecond',
  zBosonDecays:
    'Z decays into charged leptons, neutrinos (invisible) and hadrons; channel fractions from PDG 2026. The widths of the same channels from the Z f̄ f vertices agree with PDG to a fraction of a percent. The quarks fragment into mesons',
  higgsDecays:
    'The Higgs boson decays mostly into heavy particles, since the Yukawa coupling grows with mass: b b̄, W W*, τ τ, Z Z*, γ γ; fractions from PDG 2026. The b quarks become B mesons, which decay through W* within picoseconds',
  neutronFromQuarks:
    'The u, d, d quarks are free until the time ħ/Λ_QCD ≈ 3·10⁻²⁴ s has passed; then confinement binds them into a colorless neutron by itself, whose mass comes almost entirely from the gluon field energy. The neutron spin is measured, then it decays',
  protonFromQuarks:
    'Five quarks u, u, d and u, ū: after ħ/Λ_QCD the uud triplet binds into a proton by itself, while the extra u ū pair with momenta ±1 GeV stretches a string that breaks into a pair of mesons; ρ and ω decay into pions at once. The system snapshot shows the proton and the pions',
  stringFragmentation:
    'A u quark and a ū antiquark of 10 GeV each fly apart: a color string stretches between them and breaks by producing u ū, d d̄, s s̄ pairs with s/u = 0.217 and transverse kicks σ = 0.335 GeV, momentum fractions from the Lund function f(z) = (1/z)(1 − z)^a exp(−b m_T²/z). Vector mesons, η and K_S decay within a nanosecond. Change the energy and watch the multiplicity grow',
  bMesonDecays:
    'B⁺ = u b̄ at rest: the b̄ decays through a virtual W⁺ while the u looks on (spectator model). The b̄ → c̄ ℓ⁺ ν, c̄ u d̄, c̄ c s̄ and CKM-suppressed channels follow the tree-level widths of the Lagrangian, the quarks break strings into mesons, and the D mesons decay further. At tree level the b̄ → c̄ e⁺ ν fraction is about 16% against 11% from PDG: the QCD corrections to the hadronic width are missing',
  reactorAntineutrino:
    'Reactor electron antineutrinos of 3 MeV fly 180 km, as at KamLAND, and partly change flavor',
  thermalPolarization:
    'An electron in a field B at temperature T: the share of spins pointing down along the field grows on cooling as Boltzmann predicts, ⟨2Sz⟩ = −tanh(μB/kT)',
  spinDephasing:
    'A spin in a superposition along x loses coherence over the time T2: ⟨Sx⟩ = ½·exp(−t/T2)',
  zResonance:
    'e⁻e⁺ at 45.6 GeV each, as at LEP. Channels and cross sections come from the tree diagrams of the Lagrangian: γ, Z and h exchange in the s channel, plus the t channel for e⁺e⁻ within the acceptance |cos θ| < 0.95. A quark pair stretches a Lund string that breaks into mesons, the short-lived ones decay within a nanosecond; the detector sees π±, K±, K_L, γ. Without a parton shower there are about 13 charged particles against 20.8 at LEP',
  forwardBackwardAsymmetry:
    'e⁺e⁻ → μ⁺μ⁻ at √s = 29 GeV, as at PEP and PETRA: the γ and Z diagrams add up in the amplitude, and their interference gives a forward-backward asymmetry of about −6%',
  annihilationAtRest:
    'An electron and a positron at rest annihilate into two 511 keV photons through the t and u diagrams with electron exchange; the photons fly back to back with entangled polarizations',
  comptonScattering:
    'A 1.17 MeV Co-60 gamma ray scatters on an electron at rest: the sum of the s and u diagrams reproduces the Klein–Nishina formula, cross section 0.195 b',
  photonCollider:
    'Two head-on photons of 1 MeV each create an e⁺e⁻ pair by Breit–Wheeler through the t and u diagrams; below 511 keV per photon the process is closed',
  bhabhaScattering:
    'Bhabha scattering e⁺e⁻ → e⁺e⁻ at √s = 10.58 GeV: t-channel photon exchange gives a sharp forward peak, the s channel and the sign of the interference show up in the angular distribution; acceptance |cos θ| < 0.95',
  wPairProduction:
    'LEP2: e⁺e⁻ → W⁺W⁻ at √s = 200 GeV, about 21 pb at tree level. The γ, Z and neutrino-exchange diagrams each grow with energy but cancel in the sum: a test of the gauge structure. The W bosons decay, and the quarks break strings into mesons',
  higgsStrahlung:
    'Higgs factory: e⁺e⁻ → Zh at √s = 250 GeV through an s-channel Z and the ZZh vertex from |DΦ|², about 0.26 pb. The Z and the Higgs decay, the Higgs most often into b b̄; the b quarks become B mesons, which decay through W*',
  lhcJets:
    'LHC protons of 6.8 TeV. A proton is not a point: the “Collide” step takes its NNPDF2.3 parton structure and samples hard parton scattering from the tree diagrams of the Lagrangian above p_T = 50 GeV. Gluons scatter most often; the proton remnants (diquarks, quarks) stretch strings to the jets, and a nanosecond later the detector sees dozens of hadrons',
  drellYan:
    'The Drell–Yan process at the LHC: a quark of one proton and an antiquark of the other annihilate through γ* and Z into a μ⁺μ⁻ pair (channel trigger, muon p_T > 10 GeV). The pair mass equals the parton √ŝ, so the √ŝ histogram shows the Z peak at 91 GeV on top of the photon continuum. Occasionally the muons come from two photons of the photon PDFs of the protons',
  lhcTopPairs:
    'Top-quark pairs at the LHC: at 13.6 TeV they are produced mainly by gluon fusion gg → t t̄. Each t decays into W and b before hadronizing; the b quarks become B mesons. The tree-level cross section is about 0.5 nb against the measured 0.85 nb: loop corrections are missing',
  tevatronTopPairs:
    'Tevatron, protons on antiprotons at 0.98 TeV each: the top quark was discovered here in 1995. At this energy the parton momentum fractions are large, and t t̄ pairs come mainly from the annihilation of valence q q̄ from the proton and the antiproton, not from gluon fusion as at the LHC',
  heraDeepInelastic:
    'HERA: a 27.5 GeV electron against a 920 GeV proton. The electron is pointlike, the proton gives up a quark with momentum fraction x; γ and Z exchange gives the neutral current e q → e q, W exchange the charged current e q → ν q′. The x histogram shows the parton distributions that HERA measured',
  deuteriumTritiumBeam:
    'A 100 keV deuteron beam on a tritium target. The channel is picked by cross section: fusion d + t → α + n proceeds through the Bosch–Hale S-factor under the Coulomb barrier, but more often the nuclei just scatter in the Coulomb field. The neutron carries 14.1 MeV of the 17.6 MeV reaction energy, the helium nucleus 3.5 MeV',
  deuteriumTritiumPlasma:
    'A deuteron in a tritium plasma at 15 keV (1.74·10⁸ K) and density 10²⁰ m⁻³, as in a tokamak. The fusion rate is n⟨σv⟩: the cross section is averaged over a Maxwellian, the Gamow peak around 40 keV dominates. A few percent of the nuclei fuse per second; the Lawson criterion asks for longer confinement',
  solarProtonChain:
    'A proton in the solar core: 15.7 million K, 3·10³¹ protons and as many electrons per m³. The fusion p + p → d e⁺ ν needs a weak decay inside the collision, so its S-factor is 10²⁵ times smaller than for d + t: in a billion years about an eighth of the protons fuse. The electrons of the same medium give the proton no atom: at this density the neighbouring ions sit closer than the Bohr radius, continuum lowering removes the bound levels, and the proton stays bare all the time. The Saha formula without plasma pressure would keep it in an atom 17% of the time. In the “one reaction per step” mode the new deuteron waits for the next step: within the next second about 40% of the deuterons capture a proton and become helium-3',
  solarHeliumChain:
    'A proton in a three-component solar-core gas: protons at 3·10³¹ m⁻³, helium-3 at a fraction of 10⁻⁵ and electrons for neutrality, 15.7 million K. In the “all reactions in the step” mode a new nucleus reacts in the rest of the same step: over 10 billion years p + p → d e⁺ ν, within seconds d + p → ³He γ. About 70% of the protons reach ³He: that many get through the first, slowest reaction. From there the ³He is indistinguishable from the helium-3 of the gas and dissolves into it; its own burning is the starMatterEvolution template. At the density of the solar core there are no hydrogen atoms: continuum lowering removes the bound levels and the gas is fully ionized',
  cnoCycle:
    'A carbon-12 nucleus in the core of a massive star: hydrogen, helium and electrons at 20 million K. No reaction is written by hand: the rates of all proton captures come from the JINA REACLIB library, the decays from NUBASE, and the CNO cycle assembles itself from them: ¹²C(p,γ)¹³N, β⁺ decay within 10 minutes into ¹³C, ¹³C(p,γ)¹⁴N, the slow ¹⁴N(p,γ)¹⁵O — the bottleneck of the cycle with a time of about 4 million years, decay into ¹⁵N and ¹⁵N(p,α)¹²C, which gives the carbon back. After a hundred thousand years the first capture shows, after a million years most nuclei wait as ¹⁴N, after 10 million years the cycle has made a lap: four protons became ⁴He, two positrons and two neutrinos, and the returned carbon leaves again for ¹⁴N within thousands of years — so in the equilibrium of the cycle almost all of the catalyst sits as nitrogen, and CNO turns the carbon of a star into nitrogen. The number of ⁴He counts the laps. Raise the temperature to 30 million K and the cycle runs a thousand times faster',
  tripleAlpha:
    'A helium-4 nucleus in the helium core of a red giant: 150 million K, density around 30 t/m³. Two nuclei do not hold together — ⁸Be falls apart in 10⁻¹⁶ s — so carbon is born only in a triple collision ⁴He + ⁴He + ⁴He → ¹²C + γ; its REACLIB rate grows as the square of the helium density and very steeply with temperature: under these conditions a nucleus waits about 600 years. The newborn carbon captures one more nucleus in the same helium within a hundred thousand years: ¹²C(α,γ)¹⁶O — this is how stars split their fate between carbon and oxygen. After ten thousand years almost every nucleus has become carbon and one in ten went on to oxygen; lengthen the time or raise the temperature and the balance tips to oxygen',
  sProcessIron:
    'An iron-56 nucleus in the helium shell of a giant star: neutrons at 10¹⁴ m⁻³, helium, electrons, 300 million K. The slow s-process: the nucleus captures a neutron once in a decade or so (rates from REACLIB), and when the isotope turns unstable a β⁻ decay from NUBASE raises the charge by one. So iron climbs the ladder of isotopes into cobalt, nickel, copper, zinc and onward to barium and lead. The measurement shows the heaviest nucleus after 50, 500 and 2000 years; the electrons in the system count the β⁻ decays. 500 shots: each one runs hundreds of reactions',
  carbonBurning:
    'A carbon-12 nucleus in the carbon core of a massive star after helium is spent: 800 million K, density around 200 t/m³, the medium is the same ¹²C nuclei and electrons. Two carbon nuclei fuse into an excited ²⁴Mg that sheds a particle at once: ¹²C + ¹²C → ²⁰Ne + α or ²³Na + p, rarely ²³Mg + n. The channel shares come from REACLIB; under these conditions a nucleus lives about half a century. After a hundred years almost every nucleus has burnt, and the split between neon and sodium shows — the ash that neon and oxygen burning feed on later',
  firstNucleiAfterBigBang:
    'A neutron in the primordial plasma minutes after the Big Bang: protons, neutrons and electrons, baryon density 10²⁵ m⁻³. While the gas is hot, 1.2 billion K, a proton captures the neutron into a deuteron, but thermal photons break it apart at once: the deuterium bottleneck, with the photodisintegration rate from REACLIB. Once the gas has cooled to 700 million K the deuteron survives, and within minutes the chain d + p → ³He, d + d, ³He + n → t and t + d carries the neutron to ⁴He. The temperature of each stage is a parameter: raise the cool one to a billion and no helium forms',
  starMatterEvolution:
    'The story of one proton in the hot dense gas of a star: hydrogen, helium-4, the equilibrium trace of helium-3 and electrons. Every number is a parameter; the laws are the same as for any medium. One reaction per step, to see each stage: within a nanosecond it shows that there is no hydrogen atom: continuum lowering in the dense plasma removed its levels, though Saha would have promised an atom 27% of the time; in a billion years p + p → d e⁺ ν; in a second d + p → ³He γ. From there the ³He is indistinguishable from the helium-3 of the gas and dissolves into it; its burning through the pp-I, pp-II and pp-III branches is the heliumThreeBranches template',
  heliumThreeBranches:
    'A helium-3 nucleus in the hot dense gas of a star: hydrogen, helium-4, a trace of helium-3 and electrons, every number a parameter. All reactions at once over a hundred thousand years: the pp-I branch, ³He + ³He → ⁴He + 2p, gives one ⁴He; the pp-II branch, ³He + ⁴He → ⁷Be γ, leads to ⁷Be, which captures a gas electron into ⁷Li and burns with a proton into two ⁴He; the rare pp-III is ⁷Be + p → ⁸B γ and the β⁺ decay of ⁸B into two ⁴He. The branch shares follow the rate ratio n(⁴He)⟨σv⟩₃₄ against n(³He)⟨σv⟩₃₃, and the fate of ⁷Be electron capture against proton capture. Change the temperature, the density and the helium shares: the ⁷Be and ⁸B neutrinos follow the branches',
  neutronCaptureInHydrogen:
    'A thermal neutron in hydrogen at the atom density of water at room temperature. The capture n + p → d + γ follows the 1/v law with a cross section of 0.3326 b at 2200 m/s (NIST): about two thirds of the neutrons are captured in 0.2 ms, producing a deuteron and a 2.2 MeV gamma ray. This is the first step of nucleosynthesis',
  hydrogenRecombination:
    'A proton in an electron gas at 10⁴ K and 10²⁰ m⁻³: an electron is captured with the emission of a photon, at the rate of the Kramers cross section summed over shells. This is how hydrogen atoms are born from a plasma; about half of the protons recombine in 20 ms',
  hydrogenPlasmaBalance:
    'A hydrogen atom in an electron gas at the Loschmidt density (2.69·10²⁵ m⁻³). Electron impact knocks the electron off (Voronov 1997 fit), radiative and three-body recombination bring it back; three-body recombination follows from detailed balance with ionization, so at this density the proton share follows Saha: at 10⁴ K hydrogen stays whole (protons 10⁻⁵), at 2.6·10⁴ K protons and atoms are almost equal, at 5·10⁴ K 98% are broken up. The balance settles within nanoseconds. Change the temperature',
  photoionization:
    'A 20 eV photon on a hydrogen atom: enough energy to tear off the electron (13.6 eV). The Kramers photoionization cross section is about 2.5·10⁻¹⁸ cm², Thomson scattering on the electron is 10¹⁰ times smaller. The photoelectron carries away 20 − 13.6 = 6.4 eV',
  antihydrogen:
    'An antiproton and a slow 1 eV positron: as in the ALPHA experiments at CERN, the positron is captured with the emission of a photon and an antihydrogen atom is born. The channel trigger keeps only recombination: without it almost every encounter ends in Coulomb scattering',
  hydrogenAtom:
    'An electron in the ground state of the hydrogen atom: a 1s cloud, the most likely radius is near the Bohr radius of 0.053 nm, the mean is 1.5 radii',
  wavepacketSpreading:
    'A free electron localized within 0.1 nm spreads out: after 0.3 fs its width roughly doubles, σ(t) = σ₀·√(1 + (ħt/2mσ₀²)²)',
  quantumTunneling:
    'A 5 eV electron hits a 10 eV barrier 0.1 nm thick: classically it bounces back, quantum mechanically about a third of the packet passes through',
  harmonicOscillator:
    'A packet displaced by 0.2 nm in a trap with ħω = 1 eV crosses to the other side in half a period, 2.07 fs, without spreading',
  doubleSlitInCube:
    'An electron with a 0.22 nm de Broglie wavelength, about 31 eV, hits a 150 eV wall with two slits 0.1 nm wide and 0.3 nm apart. The wave passes both slits at once and interferes with itself: the xy projection shows rays behind the wall, and the y distribution shows a central maximum and side fringes at sin θ = λ/d. The reflected part of the packet stays on the left',
  electronWaveOnProton:
    'A free 20 eV electron passes a proton with an impact parameter of 0.1 nm, about two Bohr radii. The Coulomb attraction bends the wave around the nucleus: part of the packet wraps around the proton, part scatters as a fan, and a ripple of the incoming and scattered waves stays behind it',
  tunnelingMovie:
    'Tunnelling frame by frame: a 5 eV electron hits a 10 eV barrier 0.1 nm thick. The packet runs into the wall, a standing ripple of the incoming and reflected waves forms on it, then the packet splits in two: about a third passes through and leaves to the right, the rest bounces back to the left',
  doubleWellTunneling:
    'An electron in the left of two wells separated by a 6 eV barrier, the minima 0.5 nm apart. The zero-point energy of a well, ħω/2 ≈ 3.8 eV, lies below the barrier, so classically the electron is locked on the left. Quantum mechanically it tunnels: in about 4 fs the cloud flows into the right well and in 8 fs it comes back, a pendulum of two coupled states with split levels',
  hydrogenOrbital2s:
    'The 2s orbital of hydrogen: a spherical cloud with a nodal sphere two Bohr radii from the nucleus where the electron is never found; a small ball inside, a thick shell outside. The mean radius is 6 Bohr radii, 0.32 nm',
  hydrogenOrbital2p:
    'The 2p_z orbital of hydrogen: a dumbbell of two lobes above and below the nucleus with a nodal plane z = 0 where the density vanishes. The mean radius is 5 Bohr radii, 0.26 nm; the z distribution has two humps',
  hydrogenOrbital3d:
    'The 3d_z² orbital of hydrogen: two lobes along the z axis and a doughnut around the equator, separated by two nodal cones at 54.7° to the axis. The mean radius is 10.5 Bohr radii, 0.56 nm',
  hydrogenDipoleOscillation:
    'A hydrogen atom in an equal superposition of 1s and 2p_z. The two levels 10.2 eV apart beat with the period h/ΔE = 0.41 fs: the cloud flows up and down along z like an oscillating dipole, the one that radiates the Lyman-alpha line at 121.6 nm. Six frames cover half a period, and the cloud ends at the bottom',
  schrodingerCatInTrap:
    'Schrödinger’s cat: one electron in a superposition of two packets at ±0.3 nm in a trap with ħω = 3 eV. Each packet rolls to the centre; after a quarter period, 0.34 fs, they overlap and interference fringes about 0.27 nm apart flash in the centre: one particle interfering with itself. After half a period the packets have swapped places',
  quantumCarpetInBox:
    'A quantum carpet: a narrow packet in a 0.64 nm box with 240 eV walls. It spreads and bounces off the walls, the waves weave a pattern, and then the packet gathers again: at an eighth of the revival time T = 4mL²/πħ ≈ 5.1 fs there are copies, at a quarter two copies, at a half a mirror image of the original packet. On the grid the wave vanishes at the first wall cell, so L is the box plus one cell',
  pairAnnihilationInTrap:
    'An electron and a positron in the ground state of a shared trap with ħω = 10 eV: the clouds overlap, and in 1 ns about half of the pairs annihilate into two 511 keV photons; the system snapshot shows what is left',
  silverSternGerlach:
    'The Stern–Gerlach experiment of 1922 with silver atoms. The NIST ground level of Ag is 5s ²S₁/₂: J = ½ and Landé factor g ≈ 2, so the beam splits into two components. The atom is prepared spin up and measured along an axis tilted by polarAngleDegrees',
  sodiumLaserCooling:
    'Doppler cooling of a sodium atom on the D2 line (589 nm, A from NIST). Six red-detuned counter-propagating beams slow the atom: first by a constant scattering force, then by viscous friction down to the Doppler limit ħΓ(1 + s + 4δ²/Γ²)/(8k|δ|/Γ), about 240 µK at low power',
  hydrogenUltravioletIonization:
    'A hydrogen atom in the hard ultraviolet of a helium lamp (21.2 eV) at the focus. The 13.6 eV ionization threshold is from NIST; the photoionization cross section is the Verner 1996 fit. Below the threshold, for example at 254 nm, the atom does not absorb the light',
  deuteronPhotodisintegration:
    'A 4 MeV gamma ray splits a deuteron into a proton and a neutron: γ + d → p + n. The 2.22 MeV threshold is the deuteron binding energy from the AME2020 masses, the cross section is the zero-range Bethe–Peierls formula. The beam is focused and the power is set high so that there are many events',
  microwaveWaterVapor:
    'A water molecule from the configurator: O with two single bonds to H. Geometry, vibrations and dipole come from the UFF force field and QEq charges. In a 2.45 GHz microwave field the polar molecule turns after the field, collisions with helium hold the rotation back (Debye relaxation), and the energy goes into heat',
  waterFromAtoms:
    'An oxygen atom in a gas of atomic hydrogen. A bond forms when both atoms have a free valence: O + H → OH, then OH + H → H₂O, while H₂O + H gives nothing — oxygen has two valences. The rate of joining follows from detailed balance with the breaking of the bond: the equilibrium constant comes from partition functions (mass, moments of inertia, vibrations, the ground level of the atom) and the O–H bond energy of 464 kJ/mol. OH appears within a few nanoseconds, water within a microsecond. Raise the temperature: at 4000 K water, OH and oxygen atoms live together, at 5000 K the molecule falls back apart into atoms',
  waterInHydrogenBubble:
    'Two oxygen atoms in hot helium. Helium is the shared medium of the whole system: it is inert, with no free valence. Around the first atom sits its own bubble of atomic hydrogen: a medium set for that atom only, which replaces helium inside. Within 30 ns the first atom takes hydrogen from the bubble, by a microsecond it is water, while the second atom in helium stays oxygen. On the stage the bubble envelope sits inside the shared helium envelope',
  ammoniaFromAtoms:
    'A nitrogen atom in a gas of atomic hydrogen at 1000 K. The same law that assembled water: a bond forms while the atom has a free valence, and the rate follows from detailed balance with the breaking of the bond. Nitrogen has three valences, so NH and NH₂ appear within nanoseconds and ammonia NH₃ by a microsecond, and a fourth hydrogen no longer sticks. This is the path by which atoms assemble into molecules in interstellar clouds and on a catalyst surface; change the temperature and the hydrogen density',
  hydrogenThermalDissociation:
    'An H₂ molecule in a heat bath. Each bond breaks at its vibration frequency times exp(−D/kT); the H–H bond energy is 436 kJ/mol (OpenStax). At 3500 K a noticeable share of molecules falls apart within a nanosecond, at 1000 K almost none',
  uraniumAlphaDecay:
    'A uranium-238 nucleus from the NUBASE2020 table: half-life 4.46 billion years, alpha decay into thorium-234. The decay energy comes from the AME2020 masses and is shared between the α particle and the recoiling nucleus',
  waterPhases:
    'A water molecule in sea-level air at three temperatures. The aggregate state is a law here, not a table per substance: the vapour-pressure curve runs through the critical point and the boiling point by Clausius–Clapeyron, below the melting point the substance is solid, above the critical temperature at a pressure above the critical one it is a supercritical fluid; critical points from the NIST WebBook. At 250 K ice, at 300 K liquid, at 400 K steam. Set the pressure to 100 Pa and water at 300 K turns to vapour; 30 MPa and 700 K give a supercritical fluid. The system measurements carry a phase field and the log shows phase-change events',
  carbonDioxideOnPlanets:
    'A CO₂ molecule in turn on the surface of Venus (737 K, 9.2 MPa), Mars (210 K, 610 Pa) and Earth at sea level. The same phase law with the CO₂ critical point (304 K, 7.38 MPa) gives a supercritical fluid on Venus, where carbon dioxide is as dense as a liquid and flows like a gas, and a gas on Mars and Earth. The media come from the preset list built on NASA fact sheets and the 1976 Standard Atmosphere; pick another preset in the medium step and see where CO₂ freezes',
  recombinationEpoch:
    'A hydrogen atom in the plasma of the recombination epoch: protons, electrons and helium nuclei at the Planck 2018 densities for z ≈ 1090, and the relic radiation; matter and radiation are in equilibrium at one temperature temperatureInKelvin. Planck-spectrum photons ionize the atom from the ground state by the Verner cross sections, free electrons recombine by Kramers. At 4000 K the radiation keeps hydrogen mostly ionized, at 3000 K it stays neutral: the Universe turns transparent. The rates are tied by detailed balance and settle on the Saha equilibrium; Lyman-alpha trapping after Peebles is not included',
  methaneFarm:
    'Twenty carbon atoms in a gas of atomic hydrogen at 1000 K. Carbon has four valences, hydrogen one, and the bonding law assembles every atom step by step: CH, CH₂, CH₃ and methane CH₄, after which a fifth hydrogen no longer sticks. The joining rate follows from detailed balance with the breaking of the C–H bond of 411 kJ/mol. After 5 ns the system is a mixed bag of radicals, by a microsecond it holds twenty methane molecules. On the stage identical molecules gather under one “×20 CH₄” label',
  carbonVaporClusters:
    'Twenty carbon atoms in carbon vapour at 3000 K. A vapour atom also has four valences, and a bond between two carbon atoms takes every free valence it can at once: C + C gives C≡C, then new atoms stick to the ends of the chain. A cluster takes atoms from the vapour and gives fragments back when it breaks, so there end up more particles than there were atoms. This is how clusters C₂–C₅ are born in cooling vapour, the first stage of soot, carbon nanotubes and fullerenes. The law is the one that assembled methane; change the temperature: hot vapour keeps the atoms apart, cold vapour sticks them into long chains',
  carbonInAtomicOxygen:
    'Twelve carbon atoms in a gas of atomic oxygen at 1500 K. Oxygen has two valences, so the very first bond is double: C + O → C=O, carbon keeps two free valences, and a second oxygen gives O=C=O. Here carbon is saturated and no CO₃ appears. The first bond forms within nanoseconds, the second a thousand times slower: the partition function of CO₂ is small next to those of CO and O, as in a real flame, where CO burns out last. After 5 ns the system holds carbon monoxide CO, by 30 µs carbon dioxide CO₂',
  primordialSoup:
    'A primordial soup: six carbon, six nitrogen and six oxygen atoms in hot atomic hydrogen at 1000 K. One bonding law by free valences turns carbon into methane CH₄, nitrogen into ammonia NH₃ and oxygen into water H₂O, the three molecules the Miller–Urey experiment and the chemistry of dust clouds start from. The counters show how many of each molecule gathered within a microsecond',
  diamondUnderPressure:
    'The same carbon under three conditions. The aggregate state of an element with several solid forms follows its phase diagram: the vapour curve from the triple point, the graphite–diamond equilibrium line measured by Kennedy and Kennedy (P = 1.94 GPa + 2.5 MPa/K·(T − 273 K)) and a melting curve for each form. At 1 atm and room temperature carbon is graphite (the diamond in a ring is metastable and survives only because rebuilding the lattice is hindered). In a press at 6 GPa and 1700 K, as in HPHT synthesis, diamond is stable. At 5000 K carbon melts. Move the pressure and temperature: the graphite–diamond boundary shifts by 2.5 MPa per kelvin',
  hydrogenOxygenIgnition:
    'Oxyhydrogen H₂ + O₂ (two to one) and a spark of three hydrogen atoms. An atom with a free valence pulls an atom off a molecule of the medium: H + O₂ → OH + O, O + H₂ → OH + H, OH + H₂ → H₂O + H. The barrier of each reaction comes from the bond-energy–bond-order method (BEBO, Johnston and Parr, 1963) and the bond energies, the rate from transition-state theory. The first two steps make two radicals out of one: the chain branches, the number of particles grows like an avalanche, and water grows with it. The H + O₂ barrier is about 0.35 eV, so at 600 K hardly anything happens within a microsecond while at 1200 K the mixture flares up. There is no chain termination on walls and no three-body H + O₂ + M, so a cold mixture does not explode only because it is slow',
  carbonBurnsInOxygen:
    'Six carbon atoms in molecular oxygen at 1000 K. The free valence of carbon pulls an oxygen atom off an O₂ molecule: C + O₂ → CO + O, which is fast. Carbon monoxide pulls a second atom: CO + O₂ → CO₂ + O, orders of magnitude slower, and in a real flame CO also burns out last. Each reaction leaves a free oxygen atom. Barriers by the bond-energy–bond-order method, rates by transition-state theory; after a microsecond the system holds CO, after 100 µs CO₂ appears',
  saltInWater:
    'Two molecules of table salt NaCl: one in water, the other in dry air. In a gas the ionic bond keeps the molecule whole: taking an electron from sodium and giving it to chlorine costs more than the bond energy. In water the ions are wrapped in the dipoles of the solvent: the hydration energy of Na⁺ and Cl⁻ (Marcus, 1991), rescaled by Born to the permittivity of water ε = 78, outweighs the Born–Haber cycle — the free energy of breaking into ions from partition functions, plus the ionization of sodium, minus the electron affinity of chlorine, plus hydration. The salt in water falls apart into Na⁺ and Cl⁻, in air it stays a molecule',
  acidStrength:
    'Hydrogen fluoride HF and hydrogen chloride HCl in pure water and in an acid (0.1 mol/L of H⁺ and Cl⁻). The dissociated share follows the law of mass action: [X⁻]/[HX] = K/[H⁺], and K = exp(−ΔG/kT) comes from the same Born–Haber cycle that dissolves salt. For HCl ΔG < 0, a strong acid that dissociates even in acid. For HF ΔG > 0 and pKa comes out near 3.6 (measured 3.17): in pure water, where [H⁺] = 10⁻⁷, HF dissociates almost completely, while in acid it stays a molecule. This is how the pH of a medium decides the fate of a dissolved substance. The after.pH record shows the acidity of pure water, computed from the IAPWS ionization constant of water',
  glycineAcrossPh:
    'The amino acid glycine H₂N–CH₂–COOH in three solutions. It has two groups that trade protons with water: the carboxyl –COOH (pKa 2.35) and the amino group –NH₂, which takes a proton (pKa of the –NH₃⁺ ion 9.78; King, 1951). The share of each form at the pH of the solution follows the law of mass action. Sulfuric acid at 0.1 mol/L gives up its first proton completely and the second with Ka = 1.2·10⁻², and charge balance gives a pH near 0.96: glycine takes a proton and becomes the cation ⁺H₃N–CH₂–COOH. In pure water at pH 7 the proton moves from the carboxyl to the nitrogen, giving the zwitterion ⁺H₃N–CH₂–COO⁻, neutral as a whole. In 0.1 mol/L NaOH at pH near 13 the amino group gives its proton away and the anion H₂N–CH₂–COO⁻ is left. The protons go to and come from the H₃O⁺ and OH⁻ ions of the water, which stay part of the solvent. Change the acid concentration: at pH 2.35 cations and zwitterions are equal in number',
  waterElectrolysis:
    "Electrolysis of water: six H₂O molecules in liquid water, electrodes at a voltage, a current of 1 A for a millisecond. A molecule splits into its elements when the voltage exceeds its decomposition energy per transferred electron: the O–H bond energies minus those of H–H and half of O=O, over two electrons, about 1.26 V (measured threshold 1.23 V). Faraday's law gives the number of electrons I·t/e, enough for all the molecules. At the cathode hydrogen atoms pair into H₂, at the anode oxygen into O₂, because these diatomic molecules are gases at room conditions by the aggregate-state law. Set 1 V and nothing happens",
  gammaShield:
    'A hundred 1 MeV gamma photons fly out of the centre of a lead ball 2 cm across. The medium now has a size: a photon crosses the radius of the ball to the edge and is absorbed with probability 1 − exp(−μ·r), where μ = n·σ adds the photoelectric effect (Verner, hydrogen-like Kramers for lead) and Compton scattering on the 82 electrons of the atom (Klein–Nishina). An absorbed photon vanishes, its energy goes into the lead and warms it by the Dulong–Petit heat capacity. Change the ball size: every 1.2 cm of lead halves the flux. A scattered photon counts as absorbed here and the photoelectric effect on the inner shells of lead is left out, so the attenuation is a little weaker than measured',
  alphaInWater:
    'A 5 MeV alpha particle, as from a radon decay, in a water drop 1 mm across. A charged particle loses energy ionizing the electrons of the medium by the Bethe formula with the Bloch excitation energy (10 eV per proton), and its range, the integral of dE/(dE/dx), is about 40 µm: the alpha stops inside the drop without reaching the edge. All of its kinetic energy, 8·10⁻¹³ J, goes into the water. Raise the energy to 50 MeV and the range grows tens of times',
  xrayHeatsWater:
    'A 10 keV X-ray beam of 100 W shines for a second into a water ball 1 cm across. The share of the beam the medium absorbs is 1 − exp(−μ·d): at this energy water is almost opaque because of the photoelectric effect on oxygen, and nearly all the energy stays in the ball. The heat capacity of a liquid by Dulong–Petit is 3k per atom, 9k per water molecule, that is 75 J/(mol·K), as for real water. The half-gram ball warms by almost 50 K. The snapshots before and after show the medium temperature and the absorbed energy',
  uraniumChainReaction:
    'A fission chain reaction in a ball of uranium-235 metal 30 cm across. Four 2 MeV neutrons enter the centre. Each neutron flies a free path 1/Σ with Σ = n·σ(E) from the ENDF/B-VIII.0 library, scatters elastically and inelastically, is captured or splits a nucleus. Fragments are drawn from the ENDF independent yields, prompt neutrons from the fission spectrum, and the fission energy, about 200 MeV, comes from the AME masses of that very fragment pair. A neutron that reaches the edge of the ball flies away. While the ball is larger than its critical size (about 17 cm across) the neutrons grow one and a half times per generation: within 80 ns four become hundreds. The fragments stop in the metal and heat it. Make the diameter 6 cm and the chain dies out. A real bomb runs about 80 generations within a microsecond until it blows apart; that many neutrons cannot be counted one by one, but the growth of the first generations is the same',
  naturalUraniumChainDies:
    'The same four neutrons in a ball of natural uranium of the same size: it holds 0.72% of uranium-235 and the rest is uranium-238 (shares from the NIST isotopic composition). Uranium-238 splits only under neutrons faster than 1 MeV, and inelastic collisions quickly bring them below the threshold; at slow energies uranium-238 captures neutrons. So the chain dies within a couple of generations: this is why natural uranium does not explode and a reactor needs a moderator or enrichment',
  chainReactionInCube:
    'A chain reaction in a cube 32 cm across whose walls are a mirror of a super-material: every particle bounces off them without loss. The cube holds two bodies of different media: a box of uranium-238 20 cm across and, at its centre, a ball of uranium-235 13 cm across. A point sees the medium of the smallest body that holds it, so the ball is uranium-235 and around it lies a uranium-238 shell. The ball alone is below its critical size (about 17 cm): without the shell and with open walls a chain from four 2 MeV neutrons nearly dies. The tamper shell sends neutrons back by scattering on heavy nuclei and splits under fast neutrons itself, and a neutron that flies through everything bounces off a wall and enters the uranium again. In the player the neutrons (blue) fly out, bounce off the walls and split nuclei, and fragments (orange) flash where a nucleus split. Every collision, fission and crossing of a body boundary comes from the ENDF/B-VIII.0 data and the geometry. Make the walls open in the cube card, set the shell density to zero or grow the ball to 17 cm and compare the neutrons after 160 ns',
  quarkGluonSoup:
    'A proton and a neutron in a quark–gluon plasma at 300 MeV (3.5·10¹² K), as in the first microseconds of the Universe or in a heavy-ion collision at the LHC. The densities of the quarks and gluons of the medium are not set by hand: it is an ideal quantum gas at the medium temperature, n = g/(2π²)(kT/ħc)³∫x²dx/(e^√(x²+(m/kT)²) ± 1), with g counted from spin and colour. Above the crossover temperature of lattice QCD, 156.5 MeV (PDG), colour is not confined: the nucleons melt into their quarks u, u, d and u, d, d with the thermal momenta of the medium. Then the plasma cools to 100 MeV and confinement binds the quarks into hadrons again, by the same law that works after collisions. The snapshots show the quark–gluon plasma phase',
};

const RUSSIAN_DESCRIPTIONS: Readonly<Record<string, string>> = {
  sternGerlach:
    'Электрон приготовлен со спином вверх и измеряется по оси, наклоненной от z на polarAngleDegrees',
  singletCorrelation:
    'Два электрона в спиновом синглете измеряются по осям, разведенным на angleBetweenAxesDegrees',
  chsh: 'Четыре спиновых синглета за выстрел измеряются в парах установок CHSH (a,b), (a,b′), (a′,b), (a′,b′)',
  larmorPrecession:
    'Спин электрона вдоль +x прецессирует в поле вдоль z; через durationInSeconds измеряется спин вдоль y',
  neutrinoOscillation:
    'Мюонное нейтрино с энергией energyInGev пролетает baselineInKilometers в вакууме, затем измеряется его аромат',
};

const ENGLISH_REPORT_LABELS: Readonly<Record<string, string>> = {
  'Фаза воды в холоде': 'Water phase when cold',
  'Фаза воды в тепле': 'Water phase when warm',
  'Фаза воды в жаре': 'Water phase when hot',
  'Фаза CO₂ на Венере': 'CO₂ phase on Venus',
  'Фаза CO₂ на Марсе': 'CO₂ phase on Mars',
  'Фаза CO₂ на Земле': 'CO₂ phase on Earth',
  'Водород через тысячи лет': 'Hydrogen after thousands of years',
  'Положение на экране, мкм': 'Position on the screen, µm',
  'Ширина картины, мкм': 'Pattern width, µm',
  'Все попадания на экран, мкм: полос нет': 'All hits on the screen, µm: no fringes',
  'Совпадения с холостым +½, мкм': 'Coincidences with the idler +½, µm',
  'Совпадения с холостым −½, мкм': 'Coincidences with the idler −½, µm',
  'Прошел поляризатор': 'Passed the polarizer',
  'Энергия электрона, ГэВ': 'Electron energy, GeV',
  'Средняя энергия электрона, ГэВ': 'Mean electron energy, GeV',
  'Время жизни, с': 'Lifetime, s',
  'Собственное время, с': 'Proper time, s',
  'Лабораторное время, с': 'Lab time, s',
  'Средний пробег, м': 'Mean range, m',
  'Пробег до распада, м': 'Range before decay, m',
  'Время жизни нейтрона, с': 'Neutron lifetime, s',
  'Среднее время жизни, с': 'Mean lifetime, s',
  'Каналы распада W⁺': 'W⁺ decay channels',
  'Что видит детектор': 'What the detector sees',
  'Каналы распада Z': 'Z decay channels',
  'Каналы распада Хиггса': 'Higgs decay channels',
  'Спин нейтрона': 'Neutron spin',
  'Канал распада': 'Decay channel',
  'Состав системы': 'System composition',
  'Спин протона': 'Proton spin',
  'Частиц в конечном состоянии': 'Particles in the final state',
  'Заряженных частиц': 'Charged particles',
  'Заряженная множественность': 'Charged multiplicity',
  'Фотонов, в основном от π⁰ → γγ': 'Photons, mostly from π⁰ → γγ',
  'Распад на уровне кварков': 'Decay at quark level',
  'Время жизни B⁺, с': 'B⁺ lifetime, s',
  'Заряженных частиц после каскада': 'Charged particles after the cascade',
  'K⁻ на распад: след c̄ → s̄': 'K⁻ per decay: the c̄ → s̄ trace',
  'K⁺ на распад': 'K⁺ per decay',
  'Аромат на детекторе': 'Flavor at the detector',
  'Проекция спина': 'Spin projection',
  'Средняя проекция, ħ': 'Mean projection, ħ',
  'Средняя проекция на x, ħ': 'Mean projection on x, ħ',
  'Проекция спина на x': 'Spin projection on x',
  'Что родилось': 'What was produced',
  'Полное сечение, нб': 'Total cross section, nb',
  'cos θ* первого продукта': 'cos θ* of the first product',
  'Заряженных частиц в адронном событии': 'Charged particles in a hadronic event',
  'Заряженная множественность адронных событий': 'Charged multiplicity of hadronic events',
  'π⁺ на событие': 'π⁺ per event',
  'K⁺ на событие': 'K⁺ per event',
  'K_L на событие': 'K_L per event',
  'Сечение μ⁺μ⁻, нб': 'μ⁺μ⁻ cross section, nb',
  'Средний cos θ*; асимметрия вперед-назад A_FB = 3/2 · ⟨cos θ⟩':
    'Mean cos θ*; forward-backward asymmetry A_FB = 3/2 · ⟨cos θ⟩',
  Продукты: 'Products',
  'Энергия фотона, ГэВ': 'Photon energy, GeV',
  'Одинаковые поляризации': 'Equal polarizations',
  'Энергия рассеянного фотона, ГэВ': 'Scattered photon energy, GeV',
  'cos θ* электрона отдачи в системе центра масс':
    'cos θ* of the recoil electron in the center-of-mass frame',
  'Сечение, нб': 'Cross section, nb',
  'cos θ* электрона': 'cos θ* of the electron',
  'Сечение в акцептансе, нб': 'Cross section in the acceptance, nb',
  'Сечение W⁺W⁻, нб': 'W⁺W⁻ cross section, nb',
  'cos θ* W⁺: пик вперед от обмена нейтрино': 'cos θ* of W⁺: forward peak from neutrino exchange',
  'Распад W⁺': 'W⁺ decay',
  'Сечение Zh, нб': 'Zh cross section, nb',
  'cos θ* Z': 'cos θ* of Z',
  'Распад Хиггса': 'Higgs decay',
  'Какие партоны столкнулись': 'Which partons collided',
  'Что вылетело из жесткого процесса': 'What came out of the hard process',
  'Сечение выше порога p_T, нб': 'Cross section above the p_T threshold, nb',
  'Доля импульса x первого партона': 'Momentum fraction x of the first parton',
  'p_T струи, ГэВ': 'Jet p_T, GeV',
  'Заряженных частиц в событии': 'Charged particles per event',
  'Масса пары μ⁺μ⁻, ГэВ': 'μ⁺μ⁻ pair mass, GeV',
  'Сечение pp → μ⁺μ⁻ X, нб': 'pp → μ⁺μ⁻ X cross section, nb',
  'Аннигилировавшие партоны': 'Annihilated partons',
  'Сечение pp → t t̄, нб': 'pp → t t̄ cross section, nb',
  'Начальные партоны': 'Initial partons',
  'Масса пары t t̄, ГэВ': 't t̄ pair mass, GeV',
  'Распад t': 't decay',
  'Сечение p p̄ → t t̄, нб': 'p p̄ → t t̄ cross section, nb',
  'Конечное состояние жесткого процесса': 'Final state of the hard process',
  'По какому партону ударил электрон': 'Which parton the electron hit',
  'Доля импульса x кварка': 'Momentum fraction x of the quark',
  'Сечение выше p_T = 5 ГэВ, нб': 'Cross section above p_T = 5 GeV, nb',
  'Что произошло': 'What happened',
  'Энергия в системе центра масс, кэВ': 'Center-of-mass energy, keV',
  'Кинетическая энергия второго продукта, кэВ': 'Kinetic energy of the second product, keV',
  'Через миллиард лет': 'After a billion years',
  'Самое тяжелое ядро через 50 лет': 'Heaviest nucleus after 50 years',
  'Самое тяжелое ядро через 500 лет': 'Heaviest nucleus after 500 years',
  'Самое тяжелое ядро через 2000 лет': 'Heaviest nucleus after 2000 years',
  'Бета-распадов на пути': 'Beta decays along the way',
  'Массовое число через 2000 лет': 'Mass number after 2000 years',
  'Что стало с углеродом': 'What became of the carbon',
  'Пока горячо: самое тяжелое ядро': 'While hot: the heaviest nucleus',
  'После остывания: самое тяжелое ядро': 'After cooling: the heaviest nucleus',
  'Состав после остывания': 'Composition after cooling',
  'Через сто тысяч лет': 'After a hundred thousand years',
  'Через миллион лет': 'After a million years',
  'Через десять миллионов лет': 'After ten million years',
  'Оборотов цикла по числу ⁴He': 'Laps of the cycle by the number of ⁴He',
  'Позитронов на одно ядро': 'Positrons per nucleus',
  'Чем стало ядро гелия': 'What the helium nucleus became',
  'Через 5 нс': 'After 5 ns',
  'Через 30 нс': 'After 30 ns',
  'Через микросекунду': 'After a microsecond',
  'Через наносекунду: атом или ион': 'After a nanosecond: atom or ion',
  'Ядер гелия-4 на один ³He': 'Helium-4 nuclei per ³He',
  'Нейтрино на один ³He: ветки pp-II и pp-III': 'Neutrinos per ³He: the pp-II and pp-III branches',
  'Судьба гелия-3': 'Fate of helium-3',
  'Позитронов на один ³He: ветка pp-III': 'Positrons per ³He: the pp-III branch',
  'Несгоревших ³He': 'Unburnt ³He',
  'Дейтронов на один протон': 'Deuterons per proton',
  'Голых ядер гелия-4 на один протон': 'Bare helium-4 nuclei per proton',
  'Ионов He⁺ на один протон': 'He⁺ ions per proton',
  'Ядер гелия-3 на один протон': 'Helium-3 nuclei per proton',
  'Еще через секунду': 'One second later',
  'Энергия фотоэлектрона, кэВ': 'Photoelectron energy, keV',
  'Сечение рекомбинации, нб': 'Recombination cross section, nb',
  'Расстояние от ядра, м': 'Distance from the nucleus, m',
  'Средний радиус, м': 'Mean radius, m',
  'Координата x, м': 'Coordinate x, m',
  'Координата y, м': 'Coordinate y, m',
  'Координата z, м': 'Coordinate z, m',
  'Среднее расстояние от протона, м': 'Mean distance from the proton, m',
  'Координата z через полпериода, м': 'Coordinate z after half a period, m',
  'Средняя координата z, м': 'Mean coordinate z, m',
  'Координата x через полпериода, м': 'Coordinate x after half a period, m',
  'Разброс x, м': 'Spread of x, m',
  'Координата x через полвремени возрождения, м': 'Coordinate x after half the revival time, m',
  'Ширина σx, м': 'Width σx, m',
  'Координата x после встречи с барьером, м': 'Coordinate x after meeting the barrier, m',
  'Средняя координата x, м': 'Mean coordinate x, m',
  'Что осталось в системе': 'What is left in the system',
  'Проекция J на ось магнита': 'Projection of J on the magnet axis',
  'Фактор Ланде g_J': 'Landé factor g_J',
  'Магнитный момент, μ_B': 'Magnetic moment, μ_B',
  'Температура до охлаждения, К': 'Temperature before cooling, K',
  'Температура после охлаждения, К': 'Temperature after cooling, K',
  'Разброс температур после, К': 'Temperature spread after, K',
  'Что осталось после облучения': 'What is left after irradiation',
  'Внутренняя температура до, К': 'Internal temperature before, K',
  'Внутренняя температура после, К': 'Internal temperature after, K',
  'Дипольный момент, Д': 'Dipole moment, D',
  'Старшая колебательная мода, см⁻¹': 'Highest vibrational mode, cm⁻¹',
  'Молекула или атомы': 'Molecule or atoms',
  'Продукты распада': 'Decay products',
  'Энергия связи на нуклон, МэВ': 'Binding energy per nucleon, MeV',
  'Полная энергия α-частицы, ГэВ': 'Total energy of the α particle, GeV',
  'Молекул CH₄ через 5 нс': 'CH₄ molecules after 5 ns',
  'Молекул CH₄ через микросекунду': 'CH₄ molecules after a microsecond',
  'Частиц через микросекунду': 'Particles after a microsecond',
  'Самый тяжелый кластер через микросекунду': 'Heaviest cluster after a microsecond',
  'Молекул C₂': 'C₂ molecules',
  'Кластеров C₃': 'C₃ clusters',
  'Молекул CO через 5 нс': 'CO molecules after 5 ns',
  'Молекул CO через 30 мкс': 'CO molecules after 30 µs',
  'Молекул CO₂ через 30 мкс': 'CO₂ molecules after 30 µs',
  'Метан CH₄': 'Methane CH₄',
  'Аммиак NH₃': 'Ammonia NH₃',
  'Вода H₂O': 'Water H₂O',
  'Форма углерода при 1 атм': 'Form of carbon at 1 atm',
  'Форма углерода в прессе': 'Form of carbon in the press',
  'Углерод при 5000 К': 'Carbon at 5000 K',
  'Частиц через 200 нс': 'Particles after 200 ns',
  'Частиц через 400 нс': 'Particles after 400 ns',
  'Частиц через 600 нс': 'Particles after 600 ns',
  'Частиц через 800 нс': 'Particles after 800 ns',
  'Частиц через 1000 нс': 'Particles after 1000 ns',
  'Частиц через 1200 нс': 'Particles after 1200 ns',
  'Молекул воды в конце': 'Water molecules at the end',
  'Молекул CO через микросекунду': 'CO molecules after a microsecond',
  'Молекул CO через 100 мкс': 'CO molecules after 100 µs',
  'Молекул CO₂ через 100 мкс': 'CO₂ molecules after 100 µs',
  'Что стало с солью': 'What became of the salt',
  'Самая тяжелая частица': 'The heaviest particle',
  'Молекул HF осталось': 'HF molecules left',
  'Молекул HCl осталось': 'HCl molecules left',
  'pH чистой воды': 'pH of pure water',
  'Катионов ⁺H₃N–CH₂–COOH': 'Cations ⁺H₃N–CH₂–COOH',
  'Цвиттер-ионов ⁺H₃N–CH₂–COO⁻': 'Zwitterions ⁺H₃N–CH₂–COO⁻',
  'Анионов H₂N–CH₂–COO⁻': 'Anions H₂N–CH₂–COO⁻',
  'Нейтральных молекул H₂N–CH₂–COOH': 'Neutral molecules H₂N–CH₂–COOH',
  'pH серной кислоты': 'pH of the sulfuric acid',
  'Молекул H₂': 'H₂ molecules',
  'Молекул O₂': 'O₂ molecules',
  'Молекул H₂O осталось': 'H₂O molecules left',
  'Квантов вылетело из шара': 'Photons that left the ball',
  'Энергия, оставленная в свинце, Дж': 'Energy left in the lead, J',
  'Импульс альфа-частицы после, ГэВ': 'Alpha momentum after, GeV',
  'Энергия, оставленная в воде, Дж': 'Energy left in the water, J',
  'Температура воды до, К': 'Water temperature before, K',
  'Температура воды после, К': 'Water temperature after, K',
  'Поглощенная энергия, Дж': 'Absorbed energy, J',
  'Нейтронов через 10 нс': 'Neutrons after 10 ns',
  'Нейтронов через 20 нс': 'Neutrons after 20 ns',
  'Нейтронов через 30 нс': 'Neutrons after 30 ns',
  'Нейтронов через 40 нс': 'Neutrons after 40 ns',
  'Нейтронов через 50 нс': 'Neutrons after 50 ns',
  'Нейтронов через 60 нс': 'Neutrons after 60 ns',
  'Нейтронов через 70 нс': 'Neutrons after 70 ns',
  'Нейтронов через 80 нс': 'Neutrons after 80 ns',
  'Выделилось в металле, Дж': 'Released in the metal, J',
  'Нейтронов через 120 нс': 'Neutrons after 120 ns',
  'Нейтронов через 160 нс': 'Neutrons after 160 ns',
  'Выделилось в уране-235, Дж': 'Released in the uranium-235, J',
  'Выделилось в оболочке, Дж': 'Released in the shell, J',
  'Частиц в конце': 'Particles at the end',
  'Состав в горячей плазме': 'Contents in the hot plasma',
  'Фаза в горячей плазме': 'Phase in the hot plasma',
  'Адронов после остывания': 'Hadrons after cooling',
  'Самая тяжелая частица после остывания': 'Heaviest particle after cooling',
};

export function hasTemplateTranslation(name: string): boolean {
  return ENGLISH_DESCRIPTIONS[name] !== undefined || RUSSIAN_DESCRIPTIONS[name] !== undefined;
}

export function localizeTemplate(plan: ExperimentPlan, language: Language): ExperimentPlan {
  const description = (language === 'en' ? ENGLISH_DESCRIPTIONS : RUSSIAN_DESCRIPTIONS)[plan.name];
  return {
    ...plan,
    ...(description === undefined ? {} : { description }),
    report:
      language === 'en'
        ? plan.report.map((spec) =>
            spec.label === undefined
              ? spec
              : { ...spec, label: ENGLISH_REPORT_LABELS[spec.label] ?? spec.label },
          )
        : plan.report,
  };
}
