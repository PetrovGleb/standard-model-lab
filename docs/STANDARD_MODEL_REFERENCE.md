# Standard Model Reference for a Quantum Particle Simulation Library

Purpose: a single, source-backed reference that code (and Claude Code) can rely on when
implementing particles, their properties, unit conversions, and quantum-mechanical
operations. Formatting is secondary; correctness and traceability are primary.

## 0. Provenance and conventions

### 0.1 Sources

| Topic | Source | Edition |
|---|---|---|
| Fundamental constants, lepton/nucleon masses, magnetic moments, g-factors, atomic constants | NIST CODATA 2022 (`physics.nist.gov/cuu/Constants/Table/allascii.txt`) | 2022 adjustment (published 2024) |
| Quark masses, gauge/Higgs boson masses, widths, branching fractions, neutrino oscillation parameters, neutron lifetime | PDG, Review of Particle Physics 2026, Summary Tables (`pdg.lbl.gov/2026/tables/`) | 2026 |
| CKM matrix | PDG 2026 review "CKM Quark-Mixing Matrix" | 2026 |
| Electroweak inputs (G_F, M_W, M_Z used in fits) | PDG 2026 review "Electroweak Model and Constraints on New Physics" | 2026 |
| alpha_s(M_Z) | PDG 2024 world average (the 2026 review section was not retrievable; see 3.6) | 2024 |
| Light, strange, charmed and bottom mesons (3.9) | PDG, Review of Particle Physics 2026, Meson Summary Tables (`pdg.lbl.gov/2026/tables/rpp2026-sum-mesons.pdf`, created 2026-06-01) | 2026 |
| String fragmentation model parameters (3.10) | PYTHIA 8.3 manual defaults, Monash 2013 tune (`pythia.org/latest-manual`: FlavourSelection, ZSelection, PTSelection, StringFragmentation) | 8.3 |
| Light, strange, charmed and bottom baryons (3.11) | PDG, Review of Particle Physics 2026, Baryon Summary Tables (`pdg.lbl.gov/2026/tables/rpp2026-sum-baryons.pdf`, created 2026-06-01) | 2026 |
| Parton distributions of the proton (3.12) | NNPDF2.3 LO QED, α_s(M_Z) = 0.130, member 0, LHAPDF6 grid (`lhapdfsets.web.cern.ch/current/NNPDF23_lo_as_0130_qed.tar.gz`); R. D. Ball et al., Nucl. Phys. B 877 (2013) 290, arXiv:1308.0598 | 2013, LHAPDF6 2014 |
| Diquarks, baryon SU(6) weights, beam remnants (3.13) | PYTHIA 8.312: `src/FragmentationFlavZpT.cc`, `share/Pythia8/xmldoc/ParticleData.xml`, `share/Pythia8/xmldoc/BeamRemnants.xml` | 8.312 |
| Light nuclei (3.14) | CODATA 2022 masses and moments; NUBASE2020 spins and parities (F. G. Kondev et al., Chin. Phys. C 45, 030001); triton half-life from the NIST NCNR neutron table | 2020–2022 |
| Fusion cross sections (3.15) | H.-S. Bosch and G. M. Hale, Nucl. Fusion 32, 611 (1992), Table IV; E. G. Adelberger et al., Solar Fusion II, Rev. Mod. Phys. 83, 195 (2011), arXiv:1004.2318 | 1992, 2011 |
| Thermonuclear reaction rates in a medium | JINA REACLIB, R. H. Cyburt et al., ApJS 189, 240 (2010); snapshot reaclib_default2_20250330 as shipped in pynucastro 3.1.0, 37 454 reactions between NUBASE2020 nuclei in `libs/constants/data/reaclib.generated.json` | 2010, 2025 |
| Preset media (3.17) | US Standard Atmosphere 1976 (NOAA/NASA/USAF) layer constants; NASA planetary fact sheets (Mars, Venus, Jupiter, Titan); UNESCO seawater; Bahcall, Serenelli and Basu 2005 solar model; Draine 2011 Table 1.3; Cen and Ostriker 1999; Planck 2018; ITER baseline | `libs/constants/data/environments.json` |
| Critical, boiling, melting and triple points (3.18) | NIST Chemistry WebBook, Thermophysical Properties of Fluid Systems (`webbook.nist.gov`); CRC Handbook of Chemistry and Physics, 97th ed. | `libs/constants/data/critical-points.json` |
| Melting, boiling and decomposition points of catalogue molecules | CRC Handbook of Chemistry and Physics (60th–99th ed. as quoted by PubChem from HSDB), NIST Chemistry WebBook (SRD 69, averaged phase-change values), Merck Index, Hawley's, PhysProp (via PubChem), English Wikipedia chemboxes where none of these has a value; each entry names its source | `libs/constants/data/phase-points.json` |
| Group contributions for boiling, melting and critical points | K. G. Joback and R. C. Reid, Chem. Eng. Commun. 57, 233 (1987); values from the table of the English Wikipedia article "Joback method" (revision 1309334695) | `libs/constants/data/joback1987.json` |
| Neutron capture and scattering (3.16) | V. F. Sears, Neutron News 3, 26 (1992), via `www.ncnr.nist.gov/resources/n-lengths/list.html` | 1992 |
| Atomic ionization energies (3.17) | NIST Atomic Spectra Database, ionization energies (`physics.nist.gov/cgi-bin/ASD/ie.pl`) | 2026 query |
| All nuclides (3.18) | NUBASE2020 (`www-nds.iaea.org/amdc/ame2020/nubase_4.mas20.txt`; F. G. Kondev et al., Chin. Phys. C 45, 030001) and AME2020 (`mass_1.mas20.txt`; M. Wang et al., Chin. Phys. C 45, 030003), verbatim in `libs/constants/data/` | 2021 |
| All elements, ions and isotopic compositions (3.19) | NIST ASD ionization energies of every stage of Z = 1–110 with ground shells and levels; NIST Atomic Weights and Isotopic Compositions (`physics.nist.gov/cgi-bin/Compositions/stand_alone.pl`) | 2026 query |
| Photoionization (3.20) | D. A. Verner, G. J. Ferland, K. T. Korista, D. G. Yakovlev, ApJ 465, 487 (1996) and D. A. Verner, D. G. Yakovlev, A&AS 109, 125 (1995), fit file `phfit2.f` (`www.pa.uky.edu/~verner/dima/photo/phfit2.f`) | 1996 |
| Molecular force field (3.21) | Universal Force Field: A. K. Rappé et al., J. Am. Chem. Soc. 114, 10024 (1992), parameter table from RDKit `Code/ForceField/UFF/Params.cpp` (BSD); QEq: A. K. Rappé, W. A. Goddard, J. Phys. Chem. 95, 3358 (1991) | 1992 |
| Bond energies (3.21) | OpenStax Chemistry 2e, section 7.5, Tables 7.2 and 7.3 (CC BY 4.0) | 2019 |
| Electron-impact ionization (3.23) | G. S. Voronov, Atomic Data and Nuclear Data Tables 65, 1 (1997), fit file `cfit.f` by D. A. Verner (`www.pa.uky.edu/~verner/dima/col/cfit.f`), verbatim in `libs/constants/data/voronov1997/` | 1997 |
| Laser cooling transitions (3.22) | NIST ASD lines: the strongest E1 line from the ground level for H, Li, Na, K, Rb, Cs, Mg, Ca, Sr, Ag, Yb, Be⁺, Mg⁺, Ca⁺ | 2026 query |
| Carbon allotropes | C. S. Kennedy and G. C. Kennedy, J. Geophys. Res. 81, 2467 (1976) (graphite–diamond line); L. M. Ghiringhelli et al., Mol. Phys. 106, 2011 (2008), arXiv:0804.1671 (melting curves) | `libs/constants/data/allotropes.json` |
| Noble-gas Lennard-Jones wells for BEBO | J. O. Hirschfelder, C. F. Curtiss and R. B. Bird, Molecular Theory of Gases and Liquids (1954), Table I-A; H. S. Johnston and C. Parr, J. Am. Chem. Soc. 85, 2544 (1963) | `libs/constants/data/noble-gas-wells.json` |
| Aqueous solutions | CRC Handbook 97th ed. electron affinities; Y. Marcus, J. Chem. Soc. Faraday Trans. 87, 2995 (1991), Table 1; C. G. Malmberg and A. A. Maryott, J. Res. NBS 56, 1 (1956); IAPWS R11-24 (2024) ionization constant of water | `libs/constants/data/solutions.json`, `marcus1991/`, `iapws/` |
| Neutron cross sections (resolved resonances reconstructed), fission spectra, delayed neutrons and yields | ENDF/B-VIII.0, D. A. Brown et al., Nucl. Data Sheets 148, 1 (2018), NNDC neutron and fission-yield sublibraries | `libs/constants/data/endf/` → `endf.generated.json` |
| Molecule catalogue for the species picker | structures written from standard Lewis formulas (later entries from SMILES with implicit hydrogens), checked by the configurator rules; masses and linearity from the engine's structure law | `libs/constants/data/molecules.json` |
| Russian element names | Russian chemical nomenclature for the IUPAC names | `libs/constants/data/element-names.json` |

Companion files shipped with this document:
- `codata2022_allascii.txt` — the full NIST table, verbatim (355 constants).
- `codata2022.json` — the same table parsed: `{name, value, uncertainty, exact, unit, value_as_printed}`. Use it as the single source of truth for constants in code; do not retype numbers.

### 0.2 Notation
- `1.23456(78)` means value 1.23456 with standard uncertainty 0.00078 in the last digits.
- `(exact)` means defined exactly by the SI (2019 redefinition) — no uncertainty.
- Masses quoted "in MeV" or "in GeV" are mass-energy equivalents, i.e. MeV/c². In natural units (c = 1) they are just masses.
- `S` in PDG entries is a scale factor applied to the uncertainty when measurements disagree; it is already folded into the quoted error.
- `CL` is confidence level for limits.
- Charge is in units of the elementary charge `e` unless stated.
- Spin `J` is in units of ħ.

### 0.3 Unit systems used in this document
1. **SI** — kg, m, s, C, J, T.
2. **"Particle physics" units** — energy in eV (keV, MeV, GeV, TeV); mass in eV/c²; momentum in eV/c; length in fm (1 fm = 1e-15 m); cross sections in barn (1 b = 1e-28 m²); time in s.
3. **Natural units** — ħ = c = 1. Everything is a power of energy: [mass] = [energy], [length] = [time] = [energy]⁻¹, [cross section] = [energy]⁻². Convert back with the factors in §1.3.
4. **Heaviside–Lorentz + natural** for electromagnetism: α = e²/(4π), so e = √(4πα) ≈ 0.302822. (Gaussian convention is α = e²/(ħc), e = √α ≈ 0.085425. Do not mix the two.)

Recommendation for a library: store every quantity internally in ONE system (natural units with energies in GeV, or SI) and convert at the API boundary. Keep the conversion factors as exact-as-possible constants from `codata2022.json`.

---

## 1. Units and conversions

### 1.1 Exactly defined SI constants (2019 SI)
| Constant | Symbol | Value | Unit |
|---|---|---|---|
| speed of light in vacuum | c | 299 792 458 | m s⁻¹ |
| Planck constant | h | 6.626 070 15 e-34 | J Hz⁻¹ (= J s) |
| elementary charge | e | 1.602 176 634 e-19 | C |
| Boltzmann constant | k_B | 1.380 649 e-23 | J K⁻¹ |
| Avogadro constant | N_A | 6.022 140 76 e23 | mol⁻¹ |
| hyperfine transition frequency of Cs-133 | Δν_Cs | 9 192 631 770 | Hz |
| luminous efficacy | K_cd | 683 | lm W⁻¹ |

Consequently exact (non-terminating decimals, truncated as printed by NIST):
| Quantity | Value | Unit |
|---|---|---|
| reduced Planck constant ħ = h/2π | 1.054 571 817... e-34 | J s |
| ħ in eV s | 6.582 119 569... e-16 | eV s |
| h in eV/Hz | 4.135 667 696... e-15 | eV Hz⁻¹ |
| ħc | 197.326 980 4... | MeV fm |
| electron volt | 1.602 176 634 e-19 | J |
| k_B in eV/K | 8.617 333 262... e-5 | eV K⁻¹ |
| molar gas constant R = N_A k_B | 8.314 462 618... | J mol⁻¹ K⁻¹ |
| Faraday constant F = N_A e | 96 485.332 12... | C mol⁻¹ |
| Stefan–Boltzmann σ | 5.670 374 419... e-8 | W m⁻² K⁻⁴ |
| magnetic flux quantum Φ₀ = h/2e | 2.067 833 848... e-15 | Wb |
| conductance quantum G₀ = 2e²/h | 7.748 091 729... e-5 | S |
| von Klitzing constant R_K = h/e² | 25 812.807 45... | Ω |
| Josephson constant K_J = 2e/h | 483 597.848 4... e9 | Hz V⁻¹ |
| Wien wavelength displacement constant b | 2.897 771 955... e-3 | m K |
| Wien frequency displacement constant | 5.878 925 757... e10 | Hz K⁻¹ |
| standard acceleration of gravity g_n | 9.806 65 | m s⁻² |
| standard atmosphere | 101 325 | Pa |

### 1.2 Energy equivalence table (CODATA 2022)
Each row: 1 unit in the left column equals the row entries. Rows marked exact derive from exact SI constants.

| 1 unit → | J | eV | Hz (E/h) | m⁻¹ (E/hc) | K (E/k_B) | kg (E/c²) | u | E_h |
|---|---|---|---|---|---|---|---|---|
| 1 eV | 1.602 176 634 e-19 (exact) | 1 | 2.417 989 242... e14 (exact) | 8.065 543 937... e5 (exact) | 1.160 451 812... e4 (exact) | 1.782 661 921... e-36 (exact) | 1.073 544 100 83(33) e-9 | 3.674 932 217 5665(40) e-2 |
| 1 J | 1 | 6.241 509 074... e18 (exact) | 1.509 190 179... e33 (exact) | 5.034 116 567... e24 (exact) | 7.242 970 516... e22 (exact) | 1.112 650 056... e-17 (exact) | 6.700 535 2471(21) e9 | 2.293 712 278 3969(25) e17 |
| 1 u | 1.492 418 087 68(46) e-10 | 9.314 941 0372(29) e8 | 2.252 342 721 85(70) e23 | 7.513 006 6209(23) e14 | 1.080 954 020 67(34) e13 | 1.660 539 068 92(52) e-27 | 1 | 3.423 177 6922(11) e7 |
| 1 E_h (hartree) | 4.359 744 722 2060(48) e-18 | 27.211 386 245 981(30) | 6.579 683 920 4999(72) e15 | 2.194 746 313 6314(24) e7 | 3.157 750 248 0398(34) e5 | 4.850 870 209 5419(53) e-35 | 2.921 262 317 97(91) e-8 | 1 |
| 1 kg | 8.987 551 787... e16 (exact) | 5.609 588 603... e35 (exact) | 1.356 392 489... e50 (exact) | 4.524 438 335... e41 (exact) | 6.509 657 260... e39 (exact) | 1 | 6.022 140 7537(19) e26 | 2.061 485 788 7415(22) e34 |
| 1 K | 1.380 649 e-23 (exact) | 8.617 333 262... e-5 (exact) | 2.083 661 912... e10 (exact) | 69.503 480 04... (exact) | 1 | 1.536 179 187... e-40 (exact) | 9.251 087 2884(29) e-14 | 3.166 811 563 4564(35) e-6 |
| 1 Hz | 6.626 070 15 e-34 (exact) | 4.135 667 696... e-15 (exact) | 1 | 3.335 640 951... e-9 (exact) | 4.799 243 073... e-11 (exact) | 7.372 497 323... e-51 (exact) | 4.439 821 6590(14) e-24 | 1.519 829 846 0574(17) e-16 |
| 1 m⁻¹ | 1.986 445 857... e-25 (exact) | 1.239 841 984... e-6 (exact) | 299 792 458 (exact) | 1 | 1.438 776 877... e-2 (exact) | 2.210 219 094... e-42 (exact) | 1.331 025 048 24(41) e-15 | 4.556 335 252 9132(50) e-8 |

Handy derived forms:
- Photon wavelength ↔ energy: `λ[nm] = 1239.841984 / E[eV]` (hc = 1239.841984... eV nm, exact).
- Mass in kg from MeV: `m[kg] = m[MeV] × 1.782 661 921 e-30` (exact factor 1e6 × eV→kg).
- Mass in u from MeV: `m[u] = m[MeV] / 931.494 103 72(29)`.
- 1 u = 931.494 103 72(29) MeV = 1.660 539 068 92(52) e-27 kg.

### 1.3 Natural units (ħ = c = 1) ↔ SI / particle units
| Convert | Factor | Note |
|---|---|---|
| length: 1 GeV⁻¹ | = 0.197 326 980 4 fm = 1.973 269 804 e-16 m | ħc = 197.326 980 4 MeV fm (exact) |
| length: 1 fm | = 5.067 730 717 7 GeV⁻¹ | 1/(ħc) |
| time: 1 GeV⁻¹ | = 6.582 119 569 e-25 s | ħ in eV s, exact |
| time: 1 s | = 1.519 267 447 e24 GeV⁻¹ | (elementary charge over ħ, exact) |
| cross section: 1 GeV⁻² | = 0.038 937 937 19 fm² = 0.389 379 372 mb = 3.893 793 72 e-32 m² | (ħc)² |
| cross section: 1 barn | = 1e-28 m² = 100 fm²; 1 mb = 0.1 fm² | |
| mass: 1 GeV | = 1.782 661 921 e-27 kg | |
| temperature: 1 GeV | = 1.160 451 812 e13 K | |
| width → lifetime | τ = ħ/Γ → τ[s] = 6.582 119 569 e-25 / Γ[GeV] | |
| electric charge (Heaviside–Lorentz) | e = √(4πα) = 0.302 822 121 | α = e²/4π |
| electric charge (Gaussian) | e = √α = 0.085 424 543 | α = e²/(ħc) |

### 1.4 Magnetic moments and g-factors
- Bohr magneton μ_B = eħ/(2m_e) = 9.274 010 0657(29) e-24 J T⁻¹ = 5.788 381 7982(18) e-5 eV T⁻¹ = 1.399 624 491 71(44) e10 Hz T⁻¹ = 0.671 713 814 72(21) K T⁻¹.
- Nuclear magneton μ_N = eħ/(2m_p) = 5.050 783 7393(16) e-27 J T⁻¹ = 3.152 451 254 17(98) e-8 eV T⁻¹ = 7.622 593 2188(24) MHz T⁻¹.
- Relation between magnetic moment, g-factor, spin, charge, mass:
  `μ = g · (q / 2m) · S`  (vector), magnitude for spin-1/2: `μ = (g/2) · (q/|e|) · (eħ/2m)`.
  For the electron: μ_e = (g_e/2) μ_B with g_e = −2.002 319 304 360 92(36), so μ_e = −9.284 764 6917(29) e-24 J T⁻¹ (negative: antiparallel to spin because q < 0).
  For nucleons the natural unit is μ_N (defined with m_p even for the neutron).
- Anomalous magnetic moment: `a = (|g| − 2)/2`. Dirac value g = 2 exactly; QED/EW/hadronic corrections produce a.
- Gyromagnetic ratio: `γ = |g| |q| / (2m)` (rad s⁻¹ T⁻¹). Larmor precession angular frequency ω_L = γ B, frequency f_L = γB/2π.
  Electron: γ_e = 1.760 859 627 84(55) e11 s⁻¹ T⁻¹ → f_L/B = 28 024.951 3861(87) MHz T⁻¹.
  Proton: γ_p = 2.675 221 8708(11) e8 s⁻¹ T⁻¹ → 42.577 478 461(18) MHz T⁻¹.
  Neutron: γ_n = 1.832 471 74(43) e8 s⁻¹ T⁻¹ → 29.164 6935(69) MHz T⁻¹.

### 1.5 Planck units (CODATA 2022)
| Quantity | Value |
|---|---|
| Planck length l_P = √(ħG/c³) | 1.616 255(18) e-35 m |
| Planck mass m_P = √(ħc/G) | 2.176 434(24) e-8 kg = 1.220 890(14) e19 GeV |
| Planck time t_P = √(ħG/c⁵) | 5.391 247(60) e-44 s |
| Planck temperature T_P | 1.416 784(16) e32 K |
| G/(ħc) | 6.708 83(15) e-39 (GeV/c²)⁻² |

### 1.6 Relativistic kinematics formulas (SI shown; drop c for natural units)
- Total energy: `E² = (pc)² + (mc²)²`.
- Lorentz factor: `γ = E/(mc²) = 1/√(1−β²)`, `β = v/c = pc/E`.
- Momentum: `p = γ m v`; kinetic energy `T = (γ−1) mc²`; non-relativistic limit `T ≈ p²/2m`.
- de Broglie wavelength: `λ = h/p`; reduced `ƛ = ħ/p`.
- Compton wavelength: `λ_C = h/(mc)`, reduced `ƛ_C = ħ/(mc)`. Electron: λ_C = 2.426 310 235 38(76) e-12 m, ƛ_C = 3.861 592 6744(12) e-13 m.
- Compton scattering shift: `λ' − λ = λ_C (1 − cos θ)`.
- Rapidity: `y = ½ ln[(E + p_z c)/(E − p_z c)]`; pseudorapidity `η = −ln tan(θ/2)`.
- Four-vector p = (E/c, **p**); invariant mass of a system: `M² c⁴ = (ΣE)² − |Σ**p** c|²`.
- Mandelstam (2→2, a+b→c+d): `s = (p_a+p_b)²`, `t = (p_a−p_c)²`, `u = (p_a−p_d)²`, `s+t+u = Σm²`.
- Fixed-target threshold to produce total final mass M_f from beam a on target b at rest: `E_a,lab = (M_f² − m_a² − m_b²)/(2 m_b)` (c = 1).
- Two-body decay M → 1 + 2 in rest frame of M (c = 1):
  `p* = √([M² − (m₁+m₂)²][M² − (m₁−m₂)²]) / (2M)`,
  `E₁ = (M² + m₁² − m₂²)/(2M)`, `E₂ = (M² + m₂² − m₁²)/(2M)`.
- Lorentz boost along z with velocity β (γ = 1/√(1−β²)): `E' = γ(E − β p_z)`, `p_z' = γ(p_z − βE)`, transverse unchanged.
- Time dilation of lifetime: `τ_lab = γ τ_rest`; mean decay length `L = βγ c τ`.

### 1.7 Decay formulas
- Exponential law: `N(t) = N₀ e^(−t/τ)`; survival probability `e^(−t/τ)`; decay probability in dt: `dt/τ`.
- Half-life: `t½ = τ ln 2`.
- Total width: `Γ = ħ/τ`; partial widths sum: `Γ = Σ Γ_i`; branching fraction `BR_i = Γ_i/Γ`.
- Sampling a decay time: `t = −τ ln(U)`, U uniform in (0,1].
- Sampling a decay channel: cumulative sum of BR_i, draw U, pick the first channel with cumulative ≥ U. (Normalize BRs first; PDG tables may not sum exactly to 1.)

---

## 2. Fundamental constants (curated from CODATA 2022)

Full list: `codata2022.json`. The subset most relevant to a particle/quantum library:

### 2.1 Universal
| Name | Symbol | Value | Unit |
|---|---|---|---|
| speed of light in vacuum | c | 299 792 458 (exact) | m s⁻¹ |
| Newtonian constant of gravitation | G | 6.674 30(15) e-11 | m³ kg⁻¹ s⁻² |
| Planck constant | h | 6.626 070 15 e-34 (exact) | J Hz⁻¹ |
| reduced Planck constant | ħ | 1.054 571 817... e-34 (exact) | J s |
| vacuum electric permittivity | ε₀ | 8.854 187 8188(14) e-12 | F m⁻¹ |
| vacuum magnetic permeability | μ₀ | 1.256 637 061 27(20) e-6 | N A⁻² |
| characteristic impedance of vacuum | Z₀ | 376.730 313 412(59) | Ω |

### 2.2 Electromagnetic / coupling
| Name | Symbol | Value | Unit |
|---|---|---|---|
| elementary charge | e | 1.602 176 634 e-19 (exact) | C |
| fine-structure constant | α | 7.297 352 5643(11) e-3 | — |
| inverse fine-structure constant | 1/α | 137.035 999 177(21) | — |
| Fermi coupling constant | G_F/(ħc)³ | 1.166 3787(6) e-5 | GeV⁻² |
| weak mixing angle (on-shell, sin²θ_W = 1 − (M_W/M_Z)²) | sin²θ_W | 0.223 05(23) | — |
| W to Z mass ratio | M_W/M_Z | 0.881 45(13) | — |
| Thomson cross section | σ_e | 6.652 458 7051(62) e-29 | m² |
| classical electron radius | r_e | 2.817 940 3205(13) e-15 | m |

### 2.3 Atomic
| Name | Symbol | Value | Unit |
|---|---|---|---|
| Bohr radius | a₀ | 5.291 772 105 44(82) e-11 | m |
| Rydberg constant | R∞ | 10 973 731.568 157(12) | m⁻¹ |
| Rydberg constant × hc | R∞hc | 13.605 693 122 990(15) | eV |
| Rydberg constant × c | R∞c | 3.289 841 960 2500(36) e15 | Hz |
| Hartree energy | E_h | 27.211 386 245 981(30) | eV |
| atomic unit of time | ħ/E_h | 2.418 884 326 5864(26) e-17 | s |
| atomic unit of velocity | αc | 2.187 691 262 16(34) e6 | m s⁻¹ |
| atomic unit of electric field | | 5.142 206 751 12(80) e11 | V m⁻¹ |
| atomic unit of magnetic flux density | | 2.350 517 570 77(73) e5 | T |

Hydrogen-like energy levels (infinite nuclear mass, non-relativistic): `E_n = −R∞hc · Z²/n² = −13.605 693 eV · Z²/n²`. With reduced-mass correction multiply by `m_red/m_e = 1/(1 + m_e/M_nucleus)`.

### 2.4 Masses (SI, u, MeV)
| Particle | kg | u | MeV |
|---|---|---|---|
| electron | 9.109 383 7139(28) e-31 | 5.485 799 090 441(97) e-4 | 0.510 998 950 69(16) |
| muon | 1.883 531 627(42) e-28 | 0.113 428 9257(25) | 105.658 3755(23) |
| tau | 3.167 54(21) e-27 | 1.907 54(13) | 1776.86(12) (CODATA; PDG 2026 gives 1776.93(9)) |
| proton | 1.672 621 925 95(52) e-27 | 1.007 276 466 5789(83) | 938.272 089 43(29) |
| neutron | 1.674 927 500 56(85) e-27 | 1.008 664 916 06(40) | 939.565 421 94(48) |
| deuteron | 3.343 583 7768(10) e-27 | 2.013 553 212 544(15) | 1875.612 945 00(58) |
| helion (³He nucleus) | 5.006 412 7862(16) e-27 | 3.014 932 246 932(74) | 2808.391 611 12(88) |
| triton | 5.007 356 7512(16) e-27 | 3.015 500 715 97(10) | 2808.921 136 68(88) |
| alpha particle | 6.644 657 3450(21) e-27 | 4.001 506 179 129(62) | 3727.379 4118(12) |
| atomic mass constant | 1.660 539 068 92(52) e-27 | 1 | 931.494 103 72(29) |

Mass ratios (dimensionless): m_p/m_e = 1836.152 673 426(32); m_n/m_e = 1838.683 662 00(74); m_μ/m_e = 206.768 2827(46); m_τ/m_e = 3477.23(23); m_n/m_p = 1.001 378 419 46(40); m_n − m_p = 1.293 332 51(38) MeV.

### 2.5 Magnetic moments and g-factors
| Particle | g-factor | μ (J T⁻¹) | μ/μ_B | μ/μ_N | anomaly a = (|g|−2)/2 |
|---|---|---|---|---|---|
| electron | −2.002 319 304 360 92(36) | −9.284 764 6917(29) e-24 | −1.001 159 652 180 46(18) | −1838.281 971 877(32) | 1.159 652 180 46(18) e-3 |
| muon | −2.002 331 841 23(82) | −4.490 448 30(10) e-26 | −4.841 970 48(11) e-3 | −8.890 597 04(20) | 1.165 920 62(41) e-3 |
| proton | 5.585 694 6893(16) | 1.410 606 795 45(60) e-26 | 1.521 032 202 30(45) e-3 | 2.792 847 344 63(82) | — |
| neutron | −3.826 085 52(90) | −9.662 3653(23) e-27 | −1.041 875 65(25) e-3 | −1.913 042 76(45) | — |
| deuteron | 0.857 438 2335(22) | 4.330 735 087(11) e-27 | 4.669 754 568(12) e-4 | 0.857 438 2335(22) | — |

(For composite nucleons "g" is defined via μ = g μ_N S/ħ; the anomaly concept applies to point-like Dirac fermions.)

### 2.6 Compton wavelengths
| Particle | λ_C (m) | reduced ƛ_C (m) |
|---|---|---|
| electron | 2.426 310 235 38(76) e-12 | 3.861 592 6744(12) e-13 |
| muon | 1.173 444 110(26) e-14 | 1.867 594 306(42) e-15 |
| tau | 6.977 71(47) e-16 | 1.110 538(75) e-16 |
| proton | 1.321 409 853 60(41) e-15 | 2.103 089 100 51(66) e-16 |
| neutron | 1.319 590 903 82(67) e-15 | 2.100 194 1520(11) e-16 |

### 2.7 Physicochemical
| Name | Value | Unit |
|---|---|---|
| Boltzmann constant k_B | 1.380 649 e-23 (exact) | J K⁻¹ |
| Avogadro constant N_A | 6.022 140 76 e23 (exact) | mol⁻¹ |
| molar gas constant R | 8.314 462 618... (exact) | J mol⁻¹ K⁻¹ |
| Stefan–Boltzmann σ | 5.670 374 419... e-8 (exact) | W m⁻² K⁻⁴ |
| first radiation constant c₁ = 2πhc² | 3.741 771 852... e-16 (exact) | W m² |
| second radiation constant c₂ = hc/k_B | 1.438 776 877... e-2 (exact) | m K |
| molar volume of ideal gas (273.15 K, 101.325 kPa) | 22.413 969 54... e-3 (exact) | m³ mol⁻¹ |
| molar mass of carbon-12 | 12.000 000 0126(37) e-3 | kg mol⁻¹ |

---

## 3. Particle catalog (Standard Model)

### 3.1 Quantum numbers — definitions and conventions
- **Q** electric charge (units of e).
- **J** spin; **P** parity; **C** charge conjugation (only for self-conjugate neutral states).
- **I, I₃** strong isospin and its third component (u, d only; `Q = I₃ + (B + S + C + B' + T)/2` for quarks/hadrons — Gell-Mann–Nishijima).
- **B** baryon number (quarks +1/3, antiquarks −1/3, leptons 0).
- **L_e, L_μ, L_τ** lepton family numbers (+1 for ℓ⁻ and ν_ℓ, −1 for ℓ⁺ and ν̄_ℓ). Total L = L_e + L_μ + L_τ. Family numbers are violated by neutrino oscillations; total L is conserved in the SM (perturbatively).
- **S, C, B', T** flavor numbers: strangeness S = −1 for s quark; charm C = +1 for c; bottomness B' = −1 for b; topness T = +1 for t. (Sign rule: flavor number has the sign of the quark's electric charge.)
- **Color**: quarks are SU(3) triplets (r, g, b), antiquarks antitriplets, gluons octets (8 states), everything else is a color singlet.
- **Weak isospin T₃ and hypercharge Y** (convention `Q = T₃ + Y/2`), chirality-dependent:

| Field | T₃ | Y | Q |
|---|---|---|---|
| u_L, c_L, t_L | +1/2 | +1/3 | +2/3 |
| d_L, s_L, b_L | −1/2 | +1/3 | −1/3 |
| u_R, c_R, t_R | 0 | +4/3 | +2/3 |
| d_R, s_R, b_R | 0 | −2/3 | −1/3 |
| ν_eL, ν_μL, ν_τL | +1/2 | −1 | 0 |
| e_L, μ_L, τ_L | −1/2 | −1 | −1 |
| e_R, μ_R, τ_R | 0 | −2 | −1 |
| ν_R (not in minimal SM) | 0 | 0 | 0 |
| Higgs doublet (φ⁺, φ⁰) | (+1/2, −1/2) | +1 | (+1, 0) |
| W⁺, W⁻, W³ | (+1, −1, 0) | 0 | (+1, −1, 0) |
| B (hypercharge boson) | 0 | 0 | 0 |
| gluons | 0 | 0 | 0 |

- **Antiparticles**: identical mass, spin, lifetime, |magnetic moment|; all additive quantum numbers (Q, B, L_ℓ, S, C, B', T, I₃, T₃, Y) flip sign; color → anticolor; intrinsic parity flips for fermions (P_antifermion = −P_fermion). γ, Z, H, g (as an octet), and the neutral pseudoscalar/vector mesons made of q q̄ of the same flavor are their own antiparticles. W⁺ ↔ W⁻.

### 3.2 Quarks (PDG 2026)
Masses: u, d, s are MS-bar masses at μ = 2 GeV; c and b are MS-bar at μ = m (i.e. m̄(m̄)); t "direct" is the Monte-Carlo/kinematic mass from direct reconstruction. Quark masses are scheme- and scale-dependent; a library must store the scheme with the number.

| Quark | Q | J | I | I₃ | S | C | B' | T | B | Mass (PDG 2026) | Mass in kg (derived) | Mass in u (derived) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| u | +2/3 | 1/2 | 1/2 | +1/2 | 0 | 0 | 0 | 0 | 1/3 | 2.16 ± 0.07 MeV (MS-bar, 2 GeV) | 3.8505 e-30 | 2.3189 e-3 |
| d | −1/3 | 1/2 | 1/2 | −1/2 | 0 | 0 | 0 | 0 | 1/3 | 4.70 ± 0.07 MeV (MS-bar, 2 GeV) | 8.3785 e-30 | 5.0457 e-3 |
| s | −1/3 | 1/2 | 0 | 0 | −1 | 0 | 0 | 0 | 1/3 | 92.9 ± 0.7 MeV (MS-bar, 2 GeV) | 1.6561 e-28 | 0.099 732 |
| c | +2/3 | 1/2 | 0 | 0 | 0 | +1 | 0 | 0 | 1/3 | 1.2729 ± 0.0045 GeV (MS-bar, m̄_c) | 2.2692 e-27 | 1.366 51 |
| b | −1/3 | 1/2 | 0 | 0 | 0 | 0 | −1 | 0 | 1/3 | 4.186 ± 0.006 GeV (MS-bar, m̄_b) | 7.4622 e-27 | 4.493 86 |
| t | +2/3 | 1/2 | 0 | 0 | 0 | 0 | 0 | +1 | 1/3 | 172.60 ± 0.27 GeV (direct); pole from σ: 172.1 ± 0.6 GeV; from σ (MS-bar-type): 162.5 +2.1/−1.5 GeV | 3.0769 e-25 | 185.294 |

All quarks: parity P = +, color triplet, fermions (Fermi–Dirac statistics).

Light-quark ratios (PDG 2026): m_u/m_d = 0.462 ± 0.020; (m_u + m_d)/2 = 3.49 ± 0.07 MeV; m_s/((m_u+m_d)/2) = 27.33 +0.18/−0.14; m_s/m_d ≈ 17–22; m_b − m_c = 3.45 ± 0.05 GeV.

Top quark (the only quark that decays before hadronizing):
- Width Γ_t = 1.42 +0.19/−0.15 GeV → τ_t = ħ/Γ ≈ 4.6 e-25 s (derived).
- Decays: t → W b dominant; Γ(Wb)/Γ(Wq, q = b,s,d) = 0.957 ± 0.034.
  Final states via W: e⁺ν_e b (11.10 ± 0.30)%, μ⁺ν_μ b (11.40 ± 0.20)%, τ⁺ν_τ b (10.7 ± 0.5)%, q q̄' b (66.5 ± 1.4)%.
- FCNC limits (95% CL): t → γq < 9.5e-6, t → Zq < 1.2e-4, t → Hu < 1.9e-4, t → Hc < 3.4e-4.

Quarks u, d, s, c, b are confined; "lifetime" of a free quark is undefined. Flavor-changing decays happen inside hadrons via W exchange (rates set by CKM elements, §3.7).

### 3.3 Charged leptons (CODATA 2022 masses; PDG 2026 lifetimes and decays)
| | e⁻ | μ⁻ | τ⁻ |
|---|---|---|---|
| Q | −1 | −1 | −1 |
| J^P | 1/2⁺ | 1/2⁺ | 1/2⁺ |
| L_e, L_μ, L_τ | 1, 0, 0 | 0, 1, 0 | 0, 0, 1 |
| B | 0 | 0 | 0 |
| mass (MeV) | 0.510 998 950 69(16) | 105.658 3755(23) | 1776.93 ± 0.09 (PDG 2026); CODATA 1776.86(12) |
| mass (u) | 5.485 799 090 441(97) e-4 | 0.113 428 9257(25) | 1.907 54(13) |
| mass (kg) | 9.109 383 7139(28) e-31 | 1.883 531 627(42) e-28 | 3.167 54(21) e-27 |
| mean life | > 6.6 e28 yr (90% CL); stable in SM | 2.196 9811(22) e-6 s | 290.3 ± 0.5 e-15 s |
| cτ | — | 658.64 m (derived) | 87.03 μm (derived) |
| g-factor | −2.002 319 304 360 92(36) | −2.002 331 841 23(82) | not measured precisely |
| anomaly a | 1.159 652 180 46(18) e-3 | 1.165 920 62(41) e-3 (CODATA); PDG 2026: 11 659 207.2(15) e-10 | — |
| μ (J T⁻¹) | −9.284 764 6917(29) e-24 | −4.490 448 30(10) e-26 | — |
| main decays | — | e⁻ ν̄_e ν_μ ≈ 100%; e⁻ ν̄_e ν_μ γ (6.0 ± 0.5) e-8; e⁻ ν̄_e ν_μ e⁺e⁻ (3.4 ± 0.4) e-5 | μ⁻ ν̄_μ ν_τ (17.37 ± 0.04)%; e⁻ ν̄_e ν_τ (17.85 ± 0.04)%; π⁻ ν_τ (10.82 ± 0.05)%; π⁻π⁰ ν_τ (25.49 ± 0.09)%; π⁻π⁺π⁻ ν_τ (9.31 ± 0.05)%; h⁻ ν_τ (11.51 ± 0.05)%; h⁻π⁰ ν_τ (25.93 ± 0.09)%; h⁻h⁻h⁺ ν_τ (9.80 ± 0.05)% |

Charge conservation test: |q(e⁺) + q(e⁻)|/e < 4e-8 (90% CL).
Muon decay: three-body, electron energy spectrum (Michel) with endpoint E_max = (m_μ² + m_e²)/(2m_μ) ≈ 52.83 MeV.

### 3.4 Neutrinos (PDG 2026)
Flavor states ν_e, ν_μ, ν_τ: Q = 0, J = 1/2, left-handed (helicity −1 for ν, +1 for ν̄ in the massless limit), L_ℓ = +1 for the matching flavor, B = 0, color singlet, no electric or strong interaction; weak interaction only.
Mass eigenstates ν₁, ν₂, ν₃ related by the PMNS matrix: `|ν_α⟩ = Σ_i U*_αi |ν_i⟩`.

| Parameter | Value |
|---|---|
| m(ν_e) effective, tritium β-decay | < 0.45 eV (90% CL) |
| Σ m_ν (cosmology, Planck 2018 + BAO, approximate) | < 0.12 eV (95% CL) — stable literature value, not re-verified in PDG 2026 table |
| number of light neutrino species (Z-width, SM fit) | 2.996 ± 0.007 |
| number of light neutrino species (direct invisible width) | 2.92 ± 0.05 |
| Δm²₂₁ | (7.60 ± 0.17) e-5 eV² |
| Δm²₃₂ (normal ordering) | (2.445 ± 0.023) e-3 eV² |
| Δm²₃₂ (inverted ordering) | (−2.52 ± 0.04) e-3 eV² |
| sin²θ₁₂ | 0.307 ± 0.012 |
| sin²θ₂₃ (normal) | 0.533 ± 0.018 |
| sin²θ₂₃ (inverted) | 0.523 +0.031/−0.027 |
| sin²θ₁₃ | (2.17 ± 0.07) e-2 |
| δ_CP | not yet determined; large uncertainty |

Two-flavor oscillation probability in vacuum (useful for experiments):
`P(ν_α → ν_β) = sin²(2θ) · sin²(1.267 · Δm²[eV²] · L[km] / E[GeV])`.
(The factor 1.267 GeV km⁻¹ eV⁻² is 1/(4ħc) expressed in these units, with ħc = 1.973 269 804 e-16 GeV m: eV²·km/GeV = 1e-15 GeV·m; divided by 4ħc gives 1.267.)

### 3.5 Gauge bosons (PDG 2026)
| | γ | g | W± | Z | H |
|---|---|---|---|---|---|
| J^PC / J^P | 1⁻⁻ | 1⁻ | J = 1 | J = 1 | J = 0 (CP-even, consistent with 0⁺⁺) |
| Q | 0 | 0 | ±1 | 0 | 0 |
| mass | < 1e-18 eV (0 in SM) | 0 (theoretical) | 80.3625 ± 0.0077 GeV | 91.1879 ± 0.0020 GeV | 125.13 ± 0.11 GeV |
| mass (kg, derived) | 0 | 0 | 1.4326 e-25 | 1.6256 e-25 | 2.2306 e-25 |
| mass (u, derived) | 0 | 0 | 86.273 | 97.894 | 134.33 |
| full width Γ | 0 | 0 | 2.14 ± 0.05 GeV | 2.4955 ± 0.0023 GeV | 3.0 +1.5/−0.7 MeV |
| lifetime τ = ħ/Γ (derived) | stable | — | 3.08 e-25 s | 2.64 e-25 s | 2.19 e-22 s |
| charge limit | < 1e-46 e (mixed), < 1e-35 e (single) | — | — | — | — |
| self-conjugate | yes | octet is | W⁺ ↔ W⁻ | yes | yes |
| color | singlet | octet (8 states) | singlet | singlet | singlet |
| couples to | electric charge | color charge (incl. itself) | weak isospin (left-handed fermions), γ, Z, H | weak NC, H | mass (Yukawa ∝ m_f), W, Z, itself |

W/Z mass ratio (PDG): 0.88136 ± 0.00015 (CODATA 2022 lists 0.881 45(13)).
Effective leptonic weak mixing angle (Z-pole): sin²θ_eff = 0.23148 ± 0.00012 (PDG 2026). On-shell: sin²θ_W = 1 − M_W²/M_Z² = 0.223 05(23) (CODATA 2022).

**W decays** (fractions Γ_i/Γ): ℓ⁺ν (per lepton flavor, average) (10.86 ± 0.09)%; e⁺ν (10.71 ± 0.16)%; μ⁺ν (10.63 ± 0.15)%; τ⁺ν (11.38 ± 0.21)%; hadrons (67.41 ± 0.27)%.

**Z decays**: e⁺e⁻ (3.3632 ± 0.0042)%; μ⁺μ⁻ (3.3662 ± 0.0066)%; τ⁺τ⁻ (3.3696 ± 0.0083)%; invisible (ν ν̄, all flavors) (20.000 ± 0.055)%; hadrons (69.911 ± 0.056)%; c c̄ (12.03 ± 0.21)%; b b̄ (15.12 ± 0.05)%.

**Higgs decays**: b b̄ (53 ± 8)%; W W* (25.7 ± 2.5)%; τ⁺τ⁻ (6.0 +0.8/−0.7)%; Z Z* (2.80 ± 0.30)%; γγ (2.50 ± 0.20) e-3; Zγ (3.4 ± 1.1) e-3; μ⁺μ⁻ (3.0 ± 0.9) e-4; e⁺e⁻ < 3.0 e-4 (95% CL); invisible < 10.7% (95% CL). These measured values do not add up to one (gg and c c̄ are not measured), so the engine samples the Higgs from the Standard Model prediction quoted in the PDG review "Status of Higgs Boson Physics" (LHC Higgs Cross Section WG, Yellow Report 4, m_H = 125.09 GeV), which is what `pdg2026.json` holds: b b̄ (58.09 ± 0.76)%; W W* (21.52 ± 0.33)%; gg (8.18 ± 0.42)%; τ⁺τ⁻ (6.256 ± 0.10)%; c c̄ (2.884 ± 0.16)%; Z Z* (2.641 ± 0.04)%; γγ (2.270 ± 0.048) e-3; Zγ (1.541 ± 0.09) e-3; μ⁺μ⁻ (2.171 ± 0.037) e-4.

**Graviton** (not part of the SM; listed by PDG for completeness): J = 2, mass < 1.76 e-23 eV.

### 3.6 Couplings, scales and derived electroweak quantities
| Quantity | Value | Source / note |
|---|---|---|
| α (Q² = 0) | 1/137.035 999 177(21) | CODATA 2022 |
| α̂(M_Z) (MS-bar, running) | ≈ 1/127.9 | commonly quoted; computed from Δα⁽⁵⁾_had(M_Z²) = 0.02760 ± 0.00010 (PDG 2026) plus leptonic/top terms; treat as ≈ |
| α_s(M_Z²) | 0.1180 ± 0.0009 | PDG 2024 world average; verify against PDG 2026 §9.4.8 before relying on last digit |
| G_F | 1.166 3787(6) e-5 GeV⁻² | CODATA 2022 / PDG 2026 (1.1663785(6)) |
| Higgs vev v = (√2 G_F)^(−1/2) | 246.2197 GeV (derived) | ≈ 246 GeV |
| Higgs quartic λ = m_H²/(2v²) | 0.1291 (derived, tree level) | |
| Higgs mass parameter |μ| = m_H/√2 | 88.48 GeV (derived, tree level) | V(φ) = −μ²|φ|² + λ|φ|⁴ |
| e (Heaviside–Lorentz, natural) = √(4πα) | 0.302 822 | |
| SU(2) coupling g = e/sin θ_W | 0.6412 (on-shell sin²θ_W, derived) | tree level |
| U(1)_Y coupling g' = e/cos θ_W | 0.3436 (derived) | tree level |
| tree-level M_W = g v/2 | 78.9 GeV (derived) | differs from measured 80.36 GeV by radiative corrections — use measured masses, not tree formulas, for simulation |
| tree-level M_Z = v √(g²+g'²)/2 | 89.6 GeV (derived) | same caveat |
| Yukawa coupling y_f = √2 m_f / v (tree level, derived) | y_t = 0.9914; y_b = 0.02404; y_c = 0.00731; y_τ = 0.01021; y_μ = 6.069 e-4; y_s = 5.336 e-4; y_d = 2.700 e-5; y_u = 1.241 e-5; y_e = 2.935 e-6 | from PDG 2026 masses; for quarks the scheme/scale of the mass carries over |
| Λ_QCD (MS-bar, n_f = 5) | ≈ 210 MeV | order of magnitude; scheme-dependent, quote α_s(M_Z) instead |
| QCD crossover temperature T_pc (μ_B = 0) | 156.5 ± 1.5 MeV | lattice QCD, HotQCD 2019 (Phys. Lett. B 795, 15), quoted by the PDG review on the quark–gluon plasma; above it hadrons dissolve into quarks and gluons |

Running coupling, one-loop (for intuition and sanity checks; not precision):
- QED: `α(Q²) = α(0) / [1 − (α(0)/3π) Σ_f Q_f² N_c ln(Q²/m_f²)]`.
- QCD: `α_s(Q²) = α_s(μ²) / [1 + (α_s(μ²)/4π) β₀ ln(Q²/μ²)]`, `β₀ = 11 − (2/3) n_f`.

### 3.7 CKM quark-mixing matrix (PDG 2026 global fit)
```
       d          s           b
u  0.97431(16)  0.22517(68)  0.003763 (+88/−83)
c  0.22503(68)  0.97345(16)  0.04189 (+81/−69)
t  0.00863 (+19/−17)  0.04117 (+79/−68)  0.999115 (+29/−34)
```
(entries are |V_ij|; uncertainties in last digits.)
Wolfenstein parameters: λ = 0.22517 ± 0.00068; A = 0.826 +0.017/−0.015; ρ̄ = 0.1576 +0.0092/−0.0091; η̄ = 0.3556 +0.0071/−0.0069.
Jarlskog invariant J = 3.16 +0.13/−0.11 e-5 (measure of CP violation).
Unitarity-triangle angles: α = 84.1° +3.7/−3.0; sin 2β = 0.710 ± 0.011; γ = 66.4° +2.7/−2.8; α+β+γ = 173° +5/−4.
Wolfenstein parametrization to O(λ³):
```
V ≈ [ 1−λ²/2        λ           Aλ³(ρ−iη) ]
    [ −λ            1−λ²/2      Aλ²       ]
    [ Aλ³(1−ρ−iη)   −Aλ²        1         ]
```
The W couples u-type quark i to d-type quark j with amplitude ∝ (g/√2) V_ij. Charged-current rates scale as |V_ij|².

### 3.8 Common composite particles for experiments (PDG 2026 / CODATA 2022)
| | proton p (uud) | neutron n (udd) |
|---|---|---|
| I(J^P) | 1/2(1/2⁺) | 1/2(1/2⁺) |
| Q | +1 | 0 |
| B | 1 | 1 |
| mass (MeV) | 938.272 089 43(29) | 939.565 421 94(48) |
| mass (u) | 1.007 276 466 5789(83) | 1.008 664 916 06(40) |
| mass (kg) | 1.672 621 925 95(52) e-27 | 1.674 927 500 56(85) e-27 |
| mean life | > 9 e29 yr (90% CL, p → invisible) | 878.3 ± 0.4 s (t½ = 608.8 s, derived) |
| decay | — | p e⁻ ν̄_e 100% |
| magnetic moment | 2.792 847 344 63(82) μ_N | −1.913 042 76(45) μ_N |
| g-factor | 5.585 694 6893(16) | −3.826 085 52(90) |
| rms charge radius | 0.840 75(64) fm (CODATA) / 0.8407 ± 0.0006 fm (PDG) | ⟨r²⟩ = −0.1155 ± 0.0017 fm² (PDG) |
| EDM limit | < 0.021 e-23 e cm | < 0.18 e-25 e cm (90% CL) |
| |m_p − m_p̄|/m_p | < 7 e-10 (90% CL) | — |

### 3.9 Mesons (PDG 2026 Meson Summary Tables)

Quark content convention: π⁰ = (uū − dd̄)/√2; η, η′, ω, φ are mixtures of (uū + dd̄)/√2 and ss̄ (see 3.10 for the mixing angles used in fragmentation); K⁰ and K̄⁰ are produced as flavour states and observed as K⁰_S or K⁰_L, 50% each. Charge-conjugate states have identical masses and lifetimes; their decay modes are the charge conjugates of those listed.

#### 3.9.1 Masses, widths and lifetimes

| meson | quark content | I(J^P) | mass (MeV) | width Γ | mean life τ (s) |
|---|---|---|---|---|---|
| π± | ud̄, dū | 1(0⁻) | 139.57039 ± 0.00018 | — | (2.6033 ± 0.0005) × 10⁻⁸ |
| π⁰ | (uū − dd̄)/√2 | 1(0⁻) | 134.9768 ± 0.0005 | — | (8.43 ± 0.13) × 10⁻¹⁷ |
| η | uū, dd̄, ss̄ | 0(0⁻) | 547.862 ± 0.017 | 1.31 ± 0.05 keV | — |
| ρ(770)⁰ | (uū − dd̄)/√2 | 1(1⁻) | 775.26 ± 0.23 (Breit–Wigner) | 147.4 ± 0.8 MeV | — |
| ρ(770)± | ud̄, dū | 1(1⁻) | 775.11 ± 0.34 (Breit–Wigner) | 149.1 ± 0.8 MeV | — |
| ω(782) | uū, dd̄ | 0(1⁻) | 782.66 ± 0.13 | 8.68 ± 0.13 MeV | — |
| η′(958) | uū, dd̄, ss̄ | 0(0⁻) | 957.78 ± 0.06 | 0.188 ± 0.006 MeV | — |
| φ(1020) | ss̄ | 0(1⁻) | 1019.460 ± 0.016 | 4.249 ± 0.013 MeV | — |
| K± | us̄, sū | ½(0⁻) | 493.677 ± 0.015 | — | (1.2380 ± 0.0020) × 10⁻⁸ |
| K⁰, K̄⁰ | ds̄, sd̄ | ½(0⁻) | 497.611 ± 0.013 | — | 50% K⁰_S, 50% K⁰_L |
| K⁰_S | — | ½(0⁻) | 497.611 ± 0.013 | — | (0.8954 ± 0.0004) × 10⁻¹⁰ |
| K⁰_L | — | ½(0⁻) | 497.611 ± 0.013 | — | (5.116 ± 0.021) × 10⁻⁸ |
| K*(892)± | us̄, sū | ½(1⁻) | 891.88 ± 0.23 (hadroproduced) | 48.5 ± 1.2 MeV | — |
| K*(892)⁰ | ds̄, sd̄ | ½(1⁻) | 895.56 ± 0.20 | 47.1 ± 0.5 MeV | — |
| D± | cd̄, dc̄ | ½(0⁻) | 1869.66 ± 0.05 | — | (1033 ± 5) × 10⁻¹⁵ |
| D⁰ | cū | ½(0⁻) | 1864.84 ± 0.04 | — | (410.3 ± 1.0) × 10⁻¹⁵ |
| D*(2007)⁰ | cū | ½(1⁻) | 2006.86 ± 0.05 | < 2.1 MeV (90% CL) | — |
| D*(2010)± | cd̄, dc̄ | ½(1⁻) | 2010.27 ± 0.04 | 83.4 ± 1.8 keV | — |
| D±_s | cs̄, sc̄ | 0(0⁻) | 1968.35 ± 0.07 | — | (501.2 ± 2.2) × 10⁻¹⁵ |
| D*±_s | cs̄, sc̄ | 0(1⁻) | 2112.2 ± 0.4 | < 1.9 MeV (90% CL) | — |
| B± | ub̄, bū | ½(0⁻) | 5279.41 ± 0.07 | — | (1.637 ± 0.004) × 10⁻¹² |
| B⁰ | db̄ | ½(0⁻) | 5279.72 ± 0.08 | — | (1.5113 ± 0.0027) × 10⁻¹² |
| B* | ub̄, db̄ | ½(1⁻) | 5324.75 ± 0.20 | not measured | — |
| B⁰_s | sb̄ | 0(0⁻) | 5366.93 ± 0.10 | — | (1.515 ± 0.006) × 10⁻¹² |
| B*_s | sb̄ | 0(1⁻) | 5415.4 ± 1.4 | not measured | — |

#### 3.9.2 Decay modes (main exclusive modes; fractions Γ_i/Γ)

| parent | modes |
|---|---|
| π⁺ | μ⁺ν_μ (99.98770 ± 0.00004)%; e⁺ν_e (1.230 ± 0.004) × 10⁻⁴ |
| π⁰ | 2γ (98.823 ± 0.034)%; e⁺e⁻γ (1.174 ± 0.035)% |
| η | 2γ (39.36 ± 0.18)%; 3π⁰ (32.56 ± 0.21)%; π⁺π⁻π⁰ (23.02 ± 0.25)%; π⁺π⁻γ (4.28 ± 0.07)%; e⁺e⁻γ (6.96 ± 0.18) × 10⁻³ |
| ρ(770) | ππ ~100% |
| ω(782) | π⁺π⁻π⁰ (89.2 ± 0.7)%; π⁰γ (8.33 ± 0.25)%; π⁺π⁻ (1.53 ± 0.12)% |
| η′(958) | π⁺π⁻η (42.5 ± 0.5)%; ρ⁰γ including non-resonant π⁺π⁻γ (29.48 ± 0.35)%; π⁰π⁰η (22.4 ± 0.5)%; ωγ (2.52 ± 0.07)%; γγ (2.307 ± 0.033)% |
| φ(1020) | K⁺K⁻ (50.1 ± 0.6)%; K⁰_L K⁰_S (33.6 ± 0.4)%; ρπ + π⁺π⁻π⁰ (14.7 ± 0.4)%; ηγ (1.306 ± 0.024)% |
| K⁺ | μ⁺ν_μ (63.56 ± 0.11)%; π⁺π⁰ (20.67 ± 0.08)%; π⁺π⁺π⁻ (5.583 ± 0.024)%; π⁰e⁺ν_e (5.07 ± 0.04)%; π⁰μ⁺ν_μ (3.352 ± 0.034)%; π⁺π⁰π⁰ (1.760 ± 0.023)% |
| K⁰_S | π⁺π⁻ (69.20 ± 0.05)%; π⁰π⁰ (30.69 ± 0.05)% |
| K⁰_L | π±e∓ν_e (40.55 ± 0.11)%; π±μ∓ν_μ (27.04 ± 0.07)%; 3π⁰ (19.52 ± 0.12)%; π⁺π⁻π⁰ (12.54 ± 0.05)% |
| K*(892) | Kπ ~100% |
| D*(2007)⁰ | D⁰π⁰ (64.7 ± 0.9)%; D⁰γ (35.3 ± 0.9)% |
| D*(2010)⁺ | D⁰π⁺ (67.7 ± 0.5)%; D⁺π⁰ (30.7 ± 0.5)%; D⁺γ (1.6 ± 0.4)% |
| D*⁺_s | D⁺_s γ (93.6 ± 0.4)%; D⁺_s π⁰ (5.77 ± 0.35)% |
| B* | Bγ seen (the only mode listed) |
| B*_s | B_s γ seen (the only mode listed) |

D, D_s, B and B_s decay into hundreds of exclusive modes, none above a few percent for B. Their inclusive semileptonic fractions:

| parent | mode | fraction |
|---|---|---|
| D⁺ | e⁺ semileptonic | (16.07 ± 0.30)% |
| D⁰ | e⁺ anything | (6.49 ± 0.11)% |
| D⁺_s | e⁺ semileptonic | (6.33 ± 0.15)% |
| B⁺ | ℓ⁺ν_ℓ X | (10.99 ± 0.28)% |
| B⁰ | ℓ⁺ν_ℓ X | (10.33 ± 0.28)% |

### 3.10 String fragmentation parameters (PYTHIA 8.3 defaults, Monash 2013 tune)

Not physical constants: tuned parameters of the Lund string model, quoted from the PYTHIA 8.3 manual. The engine reads them from `libs/constants/data/string-fragmentation.json`; quark masses in W_min are the PDG masses of section 2, not PYTHIA's constituent masses.

| parameter | PYTHIA name | value | meaning |
|---|---|---|---|
| a | StringZ:aLund | 0.68 | Lund symmetric fragmentation function f(z) = (1/z)(1 − z)^a exp(−b m_T²/z) |
| b | StringZ:bLund | 0.98 GeV⁻² | same |
| r_c | StringZ:rFactC | 1.32 | Bowler factor 1/z^{r_Q b m_Q²} for c quarks |
| r_b | StringZ:rFactB | 0.855 | same for b quarks |
| σ | StringPT:sigma | 0.335 GeV | hadron ⟨p_x²⟩ = ⟨p_y²⟩ = σ², from two string breaks |
| s/u | StringFlav:probStoUD | 0.217 | strange quark suppression in string breaks |
| V/P (u, d) | StringFlav:mesonUDvector | 0.50 | vector to pseudoscalar ratio, light mesons |
| V/P (s) | StringFlav:mesonSvector | 0.55 | same, strange mesons |
| V/P (c) | StringFlav:mesonCvector | 0.88 | same, charm mesons |
| V/P (b) | StringFlav:mesonBvector | 2.20 | same, bottom mesons |
| η suppression | StringFlav:etaSup | 0.60 | extra suppression of η |
| η′ suppression | StringFlav:etaPrimeSup | 0.12 | extra suppression of η′ |
| θ_PS | StringFlav:thetaPS | −15° | pseudoscalar octet–singlet mixing angle |
| θ_V | StringFlav:thetaV | 36° | vector octet–singlet mixing angle |
| stop mass | StringFragmentation:stopMass | 0.8 GeV | W_min = m_q1 + m_q2 + stopMass + stopNewFlav · m_q,last |
| stopNewFlav | StringFragmentation:stopNewFlav | 2.0 | same |
| stopSmear | StringFragmentation:stopSmear | 0.2 | W_min smeared uniformly by ±20% |


### 3.11 Baryons (PDG 2026 Baryon Summary Tables)

Masses in MeV with PDG uncertainty; Δ(1232) has only the mixed-charge Breit–Wigner range 1230–1234 MeV and width 114–120 MeV, used as 1232 ± 2 and 117 ± 3. Asymmetric uncertainties are symmetrised to their mean. All have J^P = 1/2⁺ or 3/2⁺ as listed (quark-model assignment where PDG says so).

| baryon | quarks | I(J^P) | mass (MeV) | width Γ or mean life τ |
|---|---|---|---|---|
| Λ | uds | 0(1/2⁺) | 1115.683 ± 0.006 | τ = (2.617 ± 0.010) × 10⁻¹⁰ s |
| Σ⁺ | uus | 1(1/2⁺) | 1189.37 ± 0.07 | τ = (0.8018 ± 0.0026) × 10⁻¹⁰ s |
| Σ⁰ | uds | 1(1/2⁺) | 1192.642 ± 0.024 | τ = (7.4 ± 0.7) × 10⁻²⁰ s |
| Σ⁻ | dds | 1(1/2⁺) | 1197.449 ± 0.029 | τ = (1.479 ± 0.011) × 10⁻¹⁰ s |
| Ξ⁰ | uss | 1/2(1/2⁺) | 1314.86 ± 0.20 | τ = (2.90 ± 0.09) × 10⁻¹⁰ s |
| Ξ⁻ | dss | 1/2(1/2⁺) | 1321.71 ± 0.07 | τ = (1.639 ± 0.015) × 10⁻¹⁰ s |
| Δ⁺⁺, Δ⁺, Δ⁰, Δ⁻ | uuu, uud, udd, ddd | 3/2(3/2⁺) | 1232 ± 2 | Γ = 117 ± 3 |
| Σ(1385)⁺, ⁰, ⁻ | uus, uds, dds | 1(3/2⁺) | 1382.83 ± 0.34, 1383.8 ± 0.9, 1387.2 ± 0.5 | Γ = 36.2 ± 0.7, 44 ± 8, 39.4 ± 2.1 |
| Ξ(1530)⁰, ⁻ | uss, dss | 1/2(3/2⁺) | 1531.80 ± 0.32, 1535.0 ± 0.6 | Γ = 9.1 ± 0.5, 9.9 (+1.7 −1.9) |
| Ω⁻ | sss | 0(3/2⁺) | 1672.45 ± 0.29 | τ = (0.821 ± 0.011) × 10⁻¹⁰ s |
| Λc⁺ | udc | 0(1/2⁺) | 2286.46 ± 0.14 | τ = (202.6 ± 1.0) × 10⁻¹⁵ s |
| Σc(2455)⁺⁺, ⁺, ⁰ | uuc, udc, ddc | 1(1/2⁺) | 2453.97 ± 0.14, 2452.65 (+0.22 −0.16), 2453.75 ± 0.14 | Γ = 1.89 (+0.09 −0.18), 2.3 ± 0.4, 1.83 (+0.11 −0.19) |
| Σc(2520)⁺⁺, ⁺, ⁰ | uuc, udc, ddc | 1(3/2⁺) | 2518.41 ± 0.22, 2517.4 (+0.7 −0.5), 2518.48 ± 0.21 | Γ = 14.78 (+0.30 −0.40), 17.2 (+4.0 −2.2), 15.3 (+0.4 −0.5) |
| Ξc⁺, Ξc⁰ | usc, dsc | 1/2(1/2⁺) | 2467.79 ± 0.15, 2470.50 ± 0.25 | τ = (453 ± 5), (150.0 ± 1.7) × 10⁻¹⁵ s |
| Ξ′c⁺, Ξ′c⁰ | usc, dsc | 1/2(1/2⁺) | 2578.3 ± 0.4, 2578.8 ± 0.5 | width not given |
| Ξc(2645)⁺, ⁰ | usc, dsc | 1/2(3/2⁺) | 2645.17 ± 0.27, 2646.24 ± 0.18 | Γ = 2.14 ± 0.19, 2.35 ± 0.22 |
| Ωc⁰ | ssc | 0(1/2⁺) | 2695.3 ± 0.4 | τ = (274 ± 10) × 10⁻¹⁵ s |
| Ωc(2770)⁰ | ssc | 0(3/2⁺) | 2766.0 (+0.9 −1.0) | width not given |
| Λb⁰ | udb | 0(1/2⁺) | 5619.57 ± 0.16 | τ = (1.465 ± 0.009) × 10⁻¹² s |
| Σb⁺, Σb⁻ | uub, ddb | 1(1/2⁺) | 5810.56 ± 0.25, 5815.64 ± 0.27 | Γ = 5.0 ± 0.5, 5.3 ± 0.5 |
| Σb*⁺, Σb*⁻ | uub, ddb | 1(3/2⁺) | 5830.32 ± 0.27, 5834.74 ± 0.30 | Γ = 9.4 ± 0.5, 10.4 ± 0.8 |
| Ξb⁰, Ξb⁻ | usb, dsb | 1/2(1/2⁺) | 5791.7 ± 0.4, 5797.0 ± 0.4 | τ = (1.472 ± 0.016), (1.575 ± 0.021) × 10⁻¹² s |
| Ξ′b(5935)⁻ | dsb | 1/2(1/2⁺) | 5934.9 ± 0.4 | Γ = 0.03 ± 0.032 |
| Ξb(5945)⁰, Ξb(5955)⁻ | usb, dsb | 1/2(3/2⁺) | 5952.3 ± 0.6, 5955.5 ± 0.4 | Γ = 0.87 ± 0.07, 1.43 ± 0.11 |
| Ωb⁻ | ssb | 0(1/2⁺) | 6045.8 ± 0.8 | τ = (1.64 ± 0.16) × 10⁻¹² s |

Not listed by PDG and therefore absent: Σb⁰, Σb*⁰, Ξ′b⁰, Ωb*. A string that would form one of them picks another flavour or spin.

Decay modes used:
- Λ → pπ⁻ (64.1 ± 0.5)%, nπ⁰ (35.9 ± 0.5)%.
- Σ⁺ → pπ⁰ (51.47 ± 0.30)%, nπ⁺ (48.43 ± 0.30)%. Σ⁰ → Λγ 100%. Σ⁻ → nπ⁻ (99.848 ± 0.005)%.
- Ξ⁰ → Λπ⁰ (99.517 ± 0.012)%. Ξ⁻ → Λπ⁻ (99.887 ± 0.035)%.
- Ω⁻ → ΛK⁻ (67.7 ± 0.7)%, Ξ⁰π⁻ (24.3 ± 0.7)%, Ξ⁻π⁰ (8.55 ± 0.33)%.
- Δ → Nπ 99.4%. Σ(1385) → Λπ (87.0 ± 1.5)%, Σπ (11.7 ± 1.5)%. Ξ(1530) → Ξπ 100%.
- Σc, Σc(2520) → Λc⁺π ≈ 100%. Ξ′c → Ξc γ (only mode listed). Ξc(2645) → Ξc π. Ωc(2770) → Ωc γ (presumably 100%).
- Σb, Σb* → Λb π (dominant). Ξ′b(5935), Ξb(5945), Ξb(5955) → Ξb π (seen).
- Λc, Ξc, Ωc, Λb, Ξb, Ωb decay weakly; the engine uses the spectator model (heavy quark through a virtual W, the two light quarks as a diquark spectator), not the hundreds of exclusive modes.

Isospin multiplets used for the charge split of two-body modes with a pion or kaon (I₃ in parentheses): N = p (+½), n (−½); π = π⁺, π⁰, π⁻; K = K⁺ (+½), K⁰ (−½, shown as K_S or K_L); Σ = Σ⁺, Σ⁰, Σ⁻; Ξ = Ξ⁰ (+½), Ξ⁻ (−½); Ξc = Ξc⁺ (+½), Ξc⁰ (−½); Ξb = Ξb⁰ (+½), Ξb⁻ (−½); Λ, Λc, Λb are singlets. The split uses squared Clebsch–Gordan coefficients computed in code.

### 3.12 Parton distributions of the proton

NNPDF2.3 LO QCD+QED, α_s(M_Z) = 0.130 (the PDF set of the PYTHIA Monash 2013 tune). Member 0 (average of 100 replicas) of the LHAPDF6 `lhagrid1` file is shipped verbatim in `libs/constants/data/pdf/NNPDF23_lo_as_0130_qed/`; `pnpm generate:pdf` turns it into `nnpdf23-lo-qed.generated.json`.

| property | value |
|---|---|
| grid | one subgrid, 100 x-points from 10⁻⁹ to 1, 50 Q-points from 1 to 10⁴ GeV |
| flavours | t̄, b̄, c̄, s̄, ū, d̄, d, u, s, c, b, t, gluon, photon (PDG codes −6…6, 21, 22) |
| stored quantity | x·f(x, Q) |
| α_s | interpolated table, α_s(M_Z = 91.1876 GeV) = 0.130003, one-loop running |
| heavy-quark masses | m_c = 1.41421, m_b = 4.75, m_t = 175 GeV (variable flavour scheme) |

The neutron and the antinucleons use the same set through isospin (u ↔ d) and charge conjugation (q ↔ q̄). Outside the grid the engine freezes x·f at the edge.

### 3.13 Diquarks, baryons in strings and beam remnants (PYTHIA 8.312)

Not physical constants: model parameters of the Lund string and of the PYTHIA beam remnants.

| parameter | PYTHIA name | value | meaning |
|---|---|---|---|
| qq/q | StringFlav:probQQtoQ | 0.081 | diquark relative to quark production in a string break |
| s in qq | StringFlav:probSQtoQQ | 0.915 | extra suppression of strange diquarks |
| qq₁/qq₀ | StringFlav:probQQ1toQQ0 | 0.0275 | spin-1 relative to spin-0 diquarks, on top of the factor 3 of spin counting |
| decuplet | StringFlav:decupletSup | 1.0 | decuplet suppression relative to SU(6) |
| primordial k_T | BeamRemnants:primordialKThard | 1.8 GeV | Gaussian width of the transverse momentum of the struck parton |
| valence u | BeamRemnants:valencePowerUinP | 3.5 | x of a valence u quark ~ (1 − x)^3.5 / √x |
| valence d | BeamRemnants:valencePowerDinP | 2.0 | same for d |
| valence diquark | BeamRemnants:valenceDiqEnhance | 2.0 | x of a valence diquark relative to the sum of its quarks |
| companion | BeamRemnants:companionPower | 4 | shape of the companion antiquark of a sea quark |
| gluon | BeamRemnants:gluonPower | 4.0 | g(x) ~ (1 − x)^4 / x |

SU(6) weights of a baryon made of a diquark and a quark (`StringFlav::baryonCGOct`, `baryonCGDec`), in the order spin-0 diquark with a quark of a shared flavour, spin-0 with another flavour, spin-1 same-flavour diquark with a shared flavour, with another, spin-1 mixed diquark with a shared flavour, with another: octet 0.75, 0.5, 0, 0.1667, 0.0833, 0.1667; decuplet 0, 0, 1, 0.3333, 0.6667, 0.3333. A uds octet baryon is Λ-like when the free quark is the heaviest and the diquark has spin 0; when the free quark is lighter, Λ is chosen with probability 0.25 for a spin-0 diquark and 0.75 for spin 1.

Diquark masses (`ParticleData.xml`, GeV): ud₀ 0.57933; ud₁, uu₁, dd₁ 0.77133; su₀, sd₀ 0.80473; su₁, sd₁ 0.92953; ss₁ 1.09361. The popcorn mechanism (B M B̄) is not modelled.

### 3.14 Light nuclei

| nucleus | Z, N | J^P (NUBASE2020) | mass | magnetic moment, g factor | lifetime |
|---|---|---|---|---|---|
| d (²H) | 1, 1 | 1⁺ | CODATA deuteron mass energy equivalent | CODATA deuteron mag. mom., g factor | stable |
| t (³H) | 1, 2 | 1/2⁺ | CODATA triton mass energy equivalent | CODATA triton mag. mom., g factor | T½ = 12.32 y (NIST NCNR), β⁻ → ³He e⁻ ν̄ |
| h (³He) | 2, 1 | 1/2⁺ | CODATA helion mass energy equivalent | CODATA helion mag. mom., g factor | stable |
| α (⁴He) | 2, 2 | 0⁺ | CODATA alpha particle mass energy equivalent | none | stable |

PDG Monte Carlo codes 100ZZZAAA0: 1000010020, 1000010030, 1000020030, 1000020040.

### 3.15 Fusion cross sections

Bosch–Hale parametrization (E is the centre-of-mass energy in keV, σ in mb): σ(E) = S(E) / (E · exp(B_G/√E)), S(E) = (A₁ + E(A₂ + E(A₃ + E(A₄ + E A₅)))) / (1 + E(B₁ + E(B₂ + E(B₃ + E B₄)))). The engine computes the Gamow constant B_G = π α Z₁Z₂ √(2 m_r c²) from CODATA instead of using the table's rounded value.

| reaction | A₁ | A₂ | A₃ | A₄ | A₅ | B₁ | B₂ | B₃ | B₄ | range (keV) |
|---|---|---|---|---|---|---|---|---|---|---|
| T(d,n)⁴He | 6.927e4 | 7.454e8 | 2.050e6 | 5.2002e4 | 0 | 6.38e1 | −9.95e−1 | 6.981e−5 | 1.728e−4 | 0.5–550 |
| ³He(d,p)⁴He | 5.7501e6 | 2.5226e3 | 4.5566e1 | 0 | 0 | −3.1995e−3 | −8.5530e−6 | 5.9014e−8 | 0 | 0.3–900 |
| D(d,p)T | 5.5576e4 | 2.1054e2 | −3.2638e−2 | 1.4987e−6 | 1.8181e−10 | 0 | 0 | 0 | 0 | 0.5–5000 |
| D(d,n)³He | 5.3701e4 | 3.3027e2 | −1.2706e−1 | 2.9327e−5 | −2.5151e−9 | 0 | 0 | 0 | 0 | 0.5–4900 |

Check of the transcription: the D–T peak is 5.07 b at E = 65 keV and the D–³He peak 0.82 b at 260 keV, as in the paper's figures.

Solar Fusion II (Adelberger et al. 2011), σ(E) = S(E) / E · exp(−2πη), with the Sommerfeld parameter η computed from CODATA:

| reaction | S-factor | equation |
|---|---|---|
| p(p, e⁺ν)d | S₁₁(0) = 4.01 (1 ± 0.009) × 10⁻²⁵ MeV b, S′₁₁(0) = S₁₁(0) × (11.2 ± 0.1) MeV⁻¹ | (25), (26) |
| d(p, γ)³He | S₁₂(E) = 0.2145 + 5.5612 (E/MeV) + 4.6581 (E/MeV)² eV b, valid E ≲ 1 MeV; S₁₂(0) = 0.214 (+0.017 −0.016) eV b | (28), (29) |
| ³He(³He, 2p)⁴He | S₃₃(0) = 5.21 ± 0.27 MeV b, S′₃₃(0) = −4.90 ± 3.18 b, S″₃₃(0) = 22.4 ± 17.1 MeV⁻¹ b, S(E) = S(0) + S′E + S″E²/2, valid E < 350 keV | (32), (33) |

### 3.16 Neutron capture and scattering (NIST NCNR, Sears 1992)

Absorption cross sections for 2200 m/s neutrons, followed by the 1/v law at low energy: ¹H(n,γ)²H 0.3326 b; ²H(n,γ)³H 0.000519 b; ³He(n,p)³H 5333 ± 7 b; ⁴He 0. Total bound scattering cross sections: ¹H 82.03 b, ²H 7.64 b, ³H 3.03 b, ³He 6 b, ⁴He 1.34 b; the free-nucleus value is σ_bound · (A/(A + 1))².

### 3.17 Atomic ionization energies (NIST ASD)

| spectrum | ionization energy (eV) |
|---|---|
| H I | 13.598434599702 ± 0.000000000012 |
| He I | 24.587389011 ± 0.000000025 |
| He II | 54.4177655282 ± 0.0000000010 |

Hydrogen-like atoms and ions of other isotopes (D, T, ³He⁺) take the Bohr energy with the reduced mass, Z² R∞hc · μ/m_e, from CODATA.

### 3.18 All nuclides (NUBASE2020, AME2020)

Every ground state of NUBASE2020 (3558 nuclides) is available as `nucleus:Z:A`. The nuclear mass is the AME2020 atomic mass, A·u + Δ, minus Z electron masses plus the total electron binding: the sum of all NIST ionization energies of the element, or, where NIST has gaps, the fit B_e(Z) = 14.4381 Z^2.39 + 1.55468·10⁻⁶ Z^5.35 eV (D. Lunney, J. M. Pearson, C. Thibault, Rev. Mod. Phys. 75, 1021 (2003), eq. A4). Spin and parity are the first Jπ of NUBASE, half-lives become mean lives τ = T½/ln 2. Decay modes map to products: B⁻ → (Z+1) e⁻ ν̄, B⁺/e⁺ → (Z−1) e⁺ ν, EC → (Z−1) ν (atoms only; a bare nucleus cannot capture), A → (Z−2, A−4) α, p, 2p, n, 2n, β-delayed n, 2n, 3n, p, d, t, α; spontaneous fission and cluster decays are not modeled. β-delayed branches are subtracted from their β branch, then the kinematically open channels are renormalized. With these masses ⁵⁶Fe has a nuclear binding of 8.7897 MeV per nucleon (AME quotes 8.7904 MeV with atomic masses, the difference is the 34 keV electron binding), ²³⁸U decays to ²³⁴Th + α with 4.20 MeV of α kinetic energy.

### 3.19 Atoms and ions of every element

`atom:Z:A:q` is element Z, isotope A (default: the most abundant NIST isotope, else the longest-lived NUBASE nuclide) with q electrons removed. Mass = nucleus + (Z − q) m_e − Σ IE of the remaining electrons. Spin is J of the NIST ground level of that stage; in LS coupling the Landé factor is g_J = [J(J+1) − S(S+1) + L(L+1)]/(2J(J+1)) + |g_e| [J(J+1) + S(S+1) − L(L+1)]/(2J(J+1)) and μ = −g_J J μ_B. Silver (5s ²S₁/₂) gets g_J = 2.00232 and μ = −1.0012 μ_B. Valence for the molecule configurator is min(v, 8 − v) for v outer s + p electrons, plus one dative bond for 5 and 6 valence electrons, or the largest oxidation state of the element's UFF types.

### 3.20 Photon absorption

| process | model |
|---|---|
| photoionization, Z ≤ 30 | Verner 1996 fit per shell: σ(E) = σ₀[(y − 1)² + y_w²] y^(−Q) (1 + √(y/y_a))^(−P), y = E/E₀, Q = 5.5 + l − P/2; outer shells of the Opacity Project elements with the y = E/E₀ − y₀, √(y² + y₁²) form |
| photoionization, Z > 30 | Kramers: σ = (64π/3√3) α a₀² (I/E)³ (Ry/I) |
| Compton ionization | Klein–Nishina total cross section per electron, times the number of bound electrons, for E above the ionization energy |
| deuteron photodisintegration | zero-range Bethe–Peierls: σ = (8π/3) α (ħc)²/(m_N c²) · √B (E − B)^(3/2)/E³ with B from AME2020; no effective-range correction, so the peak is about 1.4 mb instead of the measured 2.4 mb |
| giant dipole resonance, A ≥ 3 | Lorentzian σ(E) = σ₀/[1 + (E² − E_R²)²/(E² Γ²)], E_R = 31.2 A^(−1/3) + 20.6 A^(−1/6) MeV and Γ = 5 MeV (B. L. Berman, S. C. Fultz, Rev. Mod. Phys. 47, 713 (1975)), σ₀ from the TRK sum rule ∫σ dE = 2π² α (ħc)²/(m_N c²) · NZ/A ≈ 60 NZ/A mb MeV; the open channel with the lowest separation energy S_n or S_p (from AME2020) emits its nucleon |
| molecular photodissociation | between the weakest bond energy D and the lowest atomic ionization energy, the TRK sum rule of the two bonding electrons, πeħ/(2ε₀m_e c) per electron, spread evenly over that window |
| dissociative photoionization | above an atom's ionization energy the molecule breaks into its atoms with that atom ionized |

### 3.21 Molecules: UFF, QEq and bond energies

Bond rest length r_ij = r_i + r_j − λ(r_i + r_j) ln n − r_i r_j (√χ_i − √χ_j)²/(χ_i r_i + χ_j r_j), λ = 0.1332; stretch constant k = 664.12 Z*_i Z*_j / r³ kcal mol⁻¹ Å⁻²; bend constant K = 664.12 Z*_i Z*_k / r_ik⁵ [3 r_ij r_jk (1 − cos²θ₀) − r_ik² cos θ₀] with the UFF Fourier form (linear centers: K(1 + cos θ)); Lennard-Jones nonbonded terms beyond 1–3 pairs (Rappé 1992, eqs. 2–20). Atom types follow the hybridization of the bond orders (sp for a triple or two doubles, sp² for one double, sp³ otherwise). The geometry is relaxed by gradient descent; normal modes come from the mass-weighted finite-difference Hessian; moments of inertia from the principal axes; rotational constants B = h/(8π² I). Partial charges solve QEq with χ = UFF Xi and J = 2 × UFF Hard and Ohno–Klopman screening J_ij = k_e/√(r² + (k_e/J̄)²); the dipole is Σ q_i r_i. Infrared strength of a mode ∫σ dω = π (∂μ/∂Q)²/(6ε₀c). Bond dissociation energies are the OpenStax table values (436 kJ/mol for H–H, 464 for O–H); bonds not in the table take the UFF Morse value D = n × 70 kcal/mol. Water relaxes to 0.99 Å and 104.5° with modes 3760, 3706 and 1758 cm⁻¹ (measured 3756, 3657, 1595) and a QEq dipole of 2.9 D (measured 1.85 D).

Thermal behaviour: internal energy = rotational (k_BT, or 3/2 k_BT for nonlinear molecules) plus Einstein vibrational modes; thermal dissociation rate per bond ν_bond exp(−D/k_BT) with ν_bond = √(k/μ)/2π; in a gas the internal temperature relaxes toward the bath at n σ v̄_rel, without a gas the bath sets it directly. Microwave heating uses Debye orientational absorption P = μ² E²_rms ω²τ / (3k_BT (1 + ω²τ²)) with τ the collision time; infrared absorption uses Lorentzian lines with the larger of the radiative, Doppler and collisional half widths.

### 3.22 Doppler cooling

Damping coefficient of a molasses pair β = −8ħk² δ s / (Γ (1 + s + (2δ/Γ)²)²) and Doppler temperature k_BT = (ħΓ/4) (1 + s + (2δ/Γ)²)/(2|δ|/Γ) (minimum ħΓ/2k_B at δ = −Γ/2, s → 0); above the capture velocity Γ/k the atom decelerates at the saturated scattering force ħkΓ/(2m) · s/(1 + s). Γ is the NIST A coefficient of the cooling line: Na D2 588.995 nm, A = 6.16·10⁷ s⁻¹, Doppler limit 235 µK.

### 3.23 Charge balance in an electron medium

An atom or ion in an electron (or positron) medium of density n and temperature T moves along its chain of charge states (H ⇄ p; He ⇄ He⁺ ⇄ α) with three processes, all at the effective temperature T_eff = T + m_e v²/(3k_B) that adds the drift v of the particle through the medium flow:

| process | rate per particle |
|---|---|
| electron-impact ionization | n·k_ion, Voronov 1997: k_ion = A (1 + P√U) U^K e^(−U) / (X + U), U = ΔE/k_BT, per ion stage of Z = 1–28 |
| radiative recombination | n·α_rr, the Maxwell average of the Kramers cross section summed over 30 shells |
| three-body recombination | n²·k₃, from detailed balance with ionization: k₃ = k_ion · g_atom/(2 g_ion) · λ³ e^(I/k_BT), λ = h/√(2π m_e k_BT), g = 2J + 1 of the NIST ground levels |

Over an evolution of length t the occupation of the chain is exp(Q t) of the birth–death generator Q, computed by scaling and squaring, and the end state is sampled: a long evolution lands on the stationary balance instead of stepping through every capture and release. In a dense gas three-body recombination dominates and the balance is Saha, n₊n_e/n₀ = (2g₊/g₀) λ⁻³ e^(−I/k_BT); in a dilute gas it is coronal, n₊/n₀ = k_ion/α_rr. Hydrogen at the Loschmidt density 2.69·10²⁵ m⁻³ is 10⁻⁵ ionized at 10⁴ K, half ionized near 2.6·10⁴ K and 98% ionized at 5·10⁴ K; at 10²⁰ m⁻³ and 10⁴ K the coronal balance leaves 0.16% ionized. A net ionization releases the electrons with a Maxwell momentum of the medium; a net radiative recombination emits a photon of I + k_BT_eff, a three-body one hands the energy to a medium electron.

---

## 4. Quantum mechanics toolkit (formulas and procedures for implementation)

### 4.1 Complex numbers
`z = a + ib`; `|z|² = a² + b²`; conjugate `z* = a − ib`; `e^(iθ) = cos θ + i sin θ`; products/quotients are standard. Store amplitudes as pairs of 64-bit floats. Never compare complex numbers for exact equality; use tolerance (§4.12).

### 4.2 State vectors and Dirac notation
- A pure state of an N-level system is a column vector `|ψ⟩ ∈ ℂ^N` with `⟨ψ|ψ⟩ = Σ |ψ_k|² = 1`.
- `⟨φ|` is the conjugate transpose (row vector of conjugates). Inner product `⟨φ|ψ⟩ = Σ φ_k* ψ_k`.
- Global phase is unphysical: `|ψ⟩` and `e^(iθ)|ψ⟩` are the same state. Relative phases between components are physical.
- Normalize after any non-unitary operation: `|ψ⟩ ← |ψ⟩ / √⟨ψ|ψ⟩`.

### 4.3 Operators
- Observables are Hermitian matrices `A = A†` (real eigenvalues, orthogonal eigenvectors).
- Time evolution and basis changes are unitary `U†U = I`.
- Projector onto `|k⟩`: `P_k = |k⟩⟨k|`, with `P_k² = P_k`, `Σ P_k = I`.
- Expectation value: `⟨A⟩ = ⟨ψ|A|ψ⟩`; variance `(ΔA)² = ⟨A²⟩ − ⟨A⟩²`.
- Commutator `[A,B] = AB − BA`. Observables with `[A,B] ≠ 0` cannot be simultaneously sharp.
- Uncertainty relation: `ΔA ΔB ≥ ½ |⟨[A,B]⟩|`. For position/momentum `[x, p] = iħ` → `Δx Δp ≥ ħ/2`. For spin: `[S_x, S_y] = iħ S_z` (cyclic).
- Spectral decomposition: `A = Σ a_k P_k`. Function of an operator: `f(A) = Σ f(a_k) P_k` (this is how to compute `exp(−iHt/ħ)` for Hermitian H: diagonalize, exponentiate eigenvalues, transform back).

### 4.4 Measurement (projective / von Neumann)
Given observable A with eigenvalues a_k and projectors P_k:
1. Probability of outcome a_k: `p_k = ⟨ψ|P_k|ψ⟩ = ‖P_k|ψ⟩‖²` (Born rule).
2. Sample k from {p_k}.
3. Post-measurement state: `|ψ'⟩ = P_k|ψ⟩ / √p_k` (collapse).
4. Immediate re-measurement of A returns a_k with probability 1.
For a non-degenerate eigenbasis `{|k⟩}` this reduces to `p_k = |⟨k|ψ⟩|²` and `|ψ'⟩ = |k⟩`.
Measuring a subsystem of a composite state: build `P_k ⊗ I` (§4.8) and apply the same rule to the full vector. Entanglement, correlations and "collapse at a distance" come out automatically — do not hard-code them.

Generalized measurements (POVM): a set `{E_k}` of positive operators with `Σ E_k = I`; `p_k = ⟨ψ|E_k|ψ⟩`. Needed only for noisy/weak measurements.

### 4.5 Spin-1/2 (qubit)
Basis `|↑⟩ = |0⟩ = (1, 0)ᵀ`, `|↓⟩ = |1⟩ = (0, 1)ᵀ` (eigenstates of S_z).
Pauli matrices:
```
σ_x = [[0, 1], [1, 0]]     σ_y = [[0, −i], [i, 0]]     σ_z = [[1, 0], [0, −1]]     I = [[1,0],[0,1]]
```
Identities: `σ_i² = I`; `σ_x σ_y = i σ_z` (cyclic); `[σ_i, σ_j] = 2i ε_ijk σ_k`; `{σ_i, σ_j} = 2δ_ij I`; `(n·σ)² = I` for unit n; `Tr σ_i = 0`; `det σ_i = −1`; eigenvalues ±1.
Spin operators: `S_i = (ħ/2) σ_i`; eigenvalues ±ħ/2; `S² = (3/4)ħ² I` (s(s+1)ħ² with s = 1/2).
Spin along unit vector n = (sin θ cos φ, sin θ sin φ, cos θ):
```
n·σ = [[cos θ,            e^(−iφ) sin θ],
       [e^(iφ) sin θ,     −cos θ      ]]
|+n⟩ = ( cos(θ/2),           e^(iφ) sin(θ/2) )ᵀ      eigenvalue +1
|−n⟩ = ( −e^(−iφ) sin(θ/2),  cos(θ/2)       )ᵀ      eigenvalue −1
```
(Alternative phase convention for |−n⟩: `(sin(θ/2), −e^(iφ) cos(θ/2))ᵀ`; same state up to global phase.)
Standard states: `|+x⟩ = (1,1)/√2`, `|−x⟩ = (1,−1)/√2`, `|+y⟩ = (1,i)/√2`, `|−y⟩ = (1,−i)/√2`.
Transition probability between spin states along directions m and n with angle Θ between them: `P(+n | +m) = cos²(Θ/2)`, `P(−n | +m) = sin²(Θ/2)`. Orthogonal axes → 50/50.
Bloch sphere: any pure qubit state is `cos(θ/2)|0⟩ + e^(iφ) sin(θ/2)|1⟩`, i.e. a point (θ, φ) on the unit sphere; ⟨σ⟩ = n. Mixed states are inside the sphere (`|⟨σ⟩| < 1`).
Rotation by angle β about axis n: `R_n(β) = exp(−i β n·σ/2) = cos(β/2) I − i sin(β/2) (n·σ)`. A 2π rotation gives −I (spinor sign flip; physical after 4π).

### 4.6 Spin-j (general)
Dimension 2j+1, basis `|j, m⟩`, m = j, j−1, …, −j.
```
S_z |j,m⟩ = ħ m |j,m⟩
S_± |j,m⟩ = ħ √(j(j+1) − m(m±1)) |j, m±1⟩        S_± = S_x ± i S_y
S_x = (S_+ + S_−)/2        S_y = (S_+ − S_−)/(2i)
S² = ħ² j(j+1) I
```
Spin-1 in the basis (|1,1⟩, |1,0⟩, |1,−1⟩), units of ħ:
```
S_x = (1/√2)[[0,1,0],[1,0,1],[0,1,0]]
S_y = (1/√2)[[0,−i,0],[i,0,−i],[0,i,0]]
S_z = [[1,0,0],[0,0,0],[0,0,−1]]
```
Photon helicity (massless spin-1) has only m = ±1 along the momentum (no m = 0). Massive W/Z have all three.
Composition of angular momenta j₁ ⊗ j₂ = |j₁−j₂| ⊕ … ⊕ (j₁+j₂) with Clebsch–Gordan coefficients. For two spin-1/2:
```
singlet  j=0: |0,0⟩  = (|↑↓⟩ − |↓↑⟩)/√2
triplet  j=1: |1,1⟩  = |↑↑⟩ ;  |1,0⟩ = (|↑↓⟩ + |↓↑⟩)/√2 ;  |1,−1⟩ = |↓↓⟩
```

### 4.7 Spin dynamics in a magnetic field
Hamiltonian of a magnetic moment: `H = −μ·B = −γ B·S` (γ = gyromagnetic ratio, sign included via g and q).
For B = B ẑ on spin-1/2: `H = −γ B (ħ/2) σ_z`; energy splitting `ΔE = |γ| ħ B = |g| μ_X B` (μ_X = μ_B for electron, μ_N for nucleons).
Larmor precession: the Bloch vector rotates about B with angular frequency `ω_L = |γ| B`; state at time t: `U(t) = exp(−iHt/ħ) = R_z(−γ B t)`.
Zeeman energy for a level with magnetic quantum number m: `E_m = −g μ_X m B` (sign conventions: for the electron g < 0 and μ_e antiparallel to S, so the m = +1/2 level is higher).
Rabi oscillation (resonant transverse field B₁ rotating at ω₀ = ω_L): transition probability `P(t) = sin²(Ω t/2)`, Rabi frequency `Ω = |γ| B₁`.

### 4.8 Composite systems and the tensor product
- Two systems with dimensions N₁, N₂ live in dimension N₁N₂. `|a⟩ ⊗ |b⟩` is the Kronecker product: component `(i,j) → index i·N₂ + j` (row-major / "big-endian": the first factor is the most significant index). Pick one convention and keep it everywhere.
- Operator on subsystem 1 only: `A ⊗ I₂`; on subsystem 2 only: `I₁ ⊗ B`. `(A ⊗ B)(|a⟩ ⊗ |b⟩) = A|a⟩ ⊗ B|b⟩`.
- n qubits: dimension 2ⁿ; Pauli on qubit k: `I ⊗ … ⊗ σ ⊗ … ⊗ I` (σ in slot k).
- A state is **entangled** if it cannot be written as a single product `|a⟩ ⊗ |b⟩`. Test: Schmidt rank > 1 (§4.10), or reduced density matrix is mixed.
- Bell states (maximally entangled two-qubit states):
```
|Φ⁺⟩ = (|00⟩ + |11⟩)/√2      |Φ⁻⟩ = (|00⟩ − |11⟩)/√2
|Ψ⁺⟩ = (|01⟩ + |10⟩)/√2      |Ψ⁻⟩ = (|01⟩ − |10⟩)/√2   (= spin singlet)
```
- Identical fermions must be antisymmetric under exchange (Pauli exclusion), identical bosons symmetric. The singlet is the antisymmetric spin state (so the spatial part must be symmetric for two electrons in the same orbital).

### 4.9 Correlations and Bell tests
For the singlet |Ψ⁻⟩, measuring spin along unit vectors a (particle 1) and b (particle 2), with outcomes ±1:
- Correlation `E(a,b) = ⟨(a·σ) ⊗ (b·σ)⟩ = −a·b = −cos Θ_ab`.
- `P(same sign) = (1 + E)/2 = (1 − cos Θ)/2 = sin²(Θ/2)`; `P(opposite) = cos²(Θ/2)`.
- Same axis (Θ = 0): always opposite. Orthogonal (90°): uncorrelated 50/50. Θ = 120°: P(same) = 3/4.
- For a triplet |Φ⁺⟩ with both measured in the x–z plane: `E(a,b) = +cos Θ` (same-sign correlated along z and x).
Three-setting test (settings 120° apart in a plane, each side chooses uniformly at random): any local-hidden-variable model gives `P(same | different settings) ≤ 2/3`; quantum mechanics gives 3/4.
CHSH: `S = E(a,b) − E(a,b') + E(a',b) + E(a',b')`; local realism `|S| ≤ 2`; quantum maximum `2√2 = 2.828 427` (Tsirelson bound), reached for the singlet with a = 0°, a' = 90°, b = 45°, b' = 135° (E = −cos of each angle difference; |S| = 4·cos 45° = 2√2).
No-signalling: the marginal distribution of either side is 50/50 regardless of the other side's setting; entanglement cannot transmit information.
No-cloning: no unitary maps `|ψ⟩|0⟩ → |ψ⟩|ψ⟩` for all |ψ⟩.
Quantum teleportation protocol (state |χ⟩ on qubit 0, Bell pair on qubits 1,2): Bell-basis measurement on qubits 0,1 yields 2 classical bits (k₁,k₂); apply `σ_x^(k₂) σ_z^(k₁)` (ordering convention-dependent) to qubit 2 to recover |χ⟩. Requires the classical channel; original is destroyed.

### 4.10 Density matrices (mixed states, subsystems)
- `ρ = Σ_i p_i |ψ_i⟩⟨ψ_i|`, Hermitian, positive, `Tr ρ = 1`. Pure iff `ρ² = ρ` iff `Tr ρ² = 1`. Purity `Tr ρ² ∈ [1/N, 1]`.
- Expectation `⟨A⟩ = Tr(ρA)`; measurement probability `p_k = Tr(P_k ρ)`; post-measurement `ρ' = P_k ρ P_k / p_k`; unitary evolution `ρ' = U ρ U†`.
- Qubit: `ρ = (I + r·σ)/2` with Bloch vector |r| ≤ 1.
- Partial trace over subsystem 2: `(ρ₁)_{ij} = Σ_k ρ_{(i,k),(j,k)}`. The reduced state of one half of a Bell pair is `I/2` (maximally mixed): a single entangled qubit looks completely random on its own.
- Schmidt decomposition: any bipartite pure state `|ψ⟩ = Σ_k √λ_k |u_k⟩|v_k⟩` (via SVD of the coefficient matrix reshaped to N₁×N₂). Schmidt rank 1 ⇔ product state.
- Entanglement entropy `S = −Σ λ_k ln λ_k` (= −Tr ρ₁ ln ρ₁); for a Bell state S = ln 2 (1 bit).
- Two-qubit concurrence (Wootters): `C = max(0, √μ₁ − √μ₂ − √μ₃ − √μ₄)` with μ_i the decreasing eigenvalues of `ρ (σ_y⊗σ_y) ρ* (σ_y⊗σ_y)`. C = 1 for Bell states, 0 for separable.
- Fidelity between pure states `F = |⟨φ|ψ⟩|²`.

### 4.11 Time evolution
- Schrödinger: `iħ ∂_t|ψ⟩ = H|ψ⟩`; for time-independent H: `|ψ(t)⟩ = U(t)|ψ(0)⟩`, `U(t) = exp(−iHt/ħ)`.
- Compute `exp(−iHt/ħ)` by eigendecomposition (`H = V D V†` → `U = V exp(−iDt/ħ) V†`) or, for 2×2 traceless H = (ħω/2) n·σ, by `U = cos(ωt/2) I − i sin(ωt/2) n·σ`. Avoid Taylor series for large t.
- Heisenberg picture: `A(t) = U† A U`.
- Energy eigenstates only acquire phases: `|E_k⟩ → e^(−iE_k t/ħ)|E_k⟩`; superpositions of different energies oscillate at `ω = (E_a − E_b)/ħ` (this is the origin of neutrino oscillation, Rabi flopping, Larmor precession).
- Free particle: `E = p²/2m` (NR) or `E = √(p²c² + m²c⁴)`; plane wave `e^(i(kx − ωt))`, `p = ħk`, `E = ħω`.
- Discretized position space (for 1D simulations): grid x_j = x₀ + jΔx; kinetic operator via finite differences `(T ψ)_j = −(ħ²/2mΔx²)(ψ_{j+1} − 2ψ_j + ψ_{j−1})`; or split-operator FFT: `ψ(t+Δt) = e^(−iVΔt/2ħ) F⁻¹[e^(−iħk²Δt/2m) F[e^(−iVΔt/2ħ) ψ]]`.

### 4.12 Interference
- Amplitudes add, probabilities don't: `P = |A₁ + A₂|² = |A₁|² + |A₂|² + 2 Re(A₁* A₂)`.
- Double slit (slit separation d, screen distance L ≫ d, wavelength λ): path difference `d sin θ ≈ d y/L`, maxima at `d sin θ = nλ`, fringe spacing `Δy = λL/d`. With which-path information (any record that distinguishes the slits), the cross term vanishes and fringes disappear.
- Mach–Zehnder with phase φ in one arm: `P(detector 1) = cos²(φ/2)`, `P(detector 2) = sin²(φ/2)`.

### 4.13 Scattering and cross sections
- Rutherford (Coulomb, non-relativistic): `dσ/dΩ = (Z₁Z₂α ħc / 4E)² / sin⁴(θ/2)`.
- Thomson (low-energy photon on free electron): `σ_T = (8π/3) r_e² = 6.652 458 7051(62) e-29 m²`.
- Rate from cross section: `R = σ · L` (L = luminosity), or for a beam on a target `R = σ · Φ · N_target`; mean free path `λ = 1/(nσ)`.
- Breit–Wigner resonance of mass M, width Γ: `σ(E) ∝ Γ²/4 / [(E − M)² + Γ²/4]`.

### 4.14 Numerical implementation notes
- Use `number` pairs (TypeScript) or a small Complex class; no exact equality.
- Tolerances: normalization |⟨ψ|ψ⟩ − 1| < 1e-12; Hermiticity ‖A − A†‖ < 1e-12; unitarity ‖U†U − I‖ < 1e-10; probabilities clipped to [0, 1] and renormalized before sampling.
- Sampling an outcome: build cumulative probabilities; draw U ∈ [0,1); binary or linear search. Use a seedable PRNG (e.g. xoshiro128**, PCG) so experiments are reproducible; never `Math.random()` in library code.
- Uniform random direction on the sphere: `cos θ = 2U₁ − 1`, `φ = 2π U₂` (do NOT draw θ uniformly).
- Random pure state (Haar): draw N complex Gaussians and normalize.
- Matrix exponential: eigendecomposition for Hermitian H (stable); Padé/scaling-and-squaring for general matrices.
- Big-endian index convention for tensor products (§4.8); document it in code and test it.
- Store masses in GeV internally; convert to kg/u/MeV at the API boundary with factors from `codata2022.json`.
- Keep uncertainties alongside values (value, sigma) so experiments can propagate errors or at least display them.

### 4.15 Test oracle (known results for unit tests)
| Test | Expected |
|---|---|
| ⟨+z| measured along x | P(+) = P(−) = 0.5 |
| ⟨+z| measured along n at angle Θ | P(+n) = cos²(Θ/2) |
| Re-measure same axis immediately | same result, probability 1 |
| Singlet, same axis | P(opposite) = 1 |
| Singlet, axes at Θ | P(same) = sin²(Θ/2); E = −cos Θ |
| Singlet, Θ = 120° | P(same) = 0.75 |
| Three-setting LHV bound | P(same | different) ≤ 2/3 (= 0.6667) |
| CHSH, singlet, optimal angles | |S| = 2√2 = 2.828 427 125 |
| CHSH, any product state | |S| ≤ 2 |
| Reduced state of Bell pair | ρ₁ = I/2, purity 0.5, entropy ln 2 = 0.693 147 |
| Concurrence of |Ψ⁻⟩ | 1.0; of |00⟩: 0.0 |
| R_z(2π) on any spinor | −1 × state (sign flip); R_z(4π) = identity |
| Larmor: electron in 1 T | f_L = 28.024 951 3861 GHz; proton 42.577 478 461 MHz |
| Electron Zeeman splitting at 1 T | ΔE = |g_e| μ_B B = 2.002 319 304 × 5.788 381 7982e-5 eV = 1.159 018 86 e-4 eV |
| Hydrogen n = 1 → 2 | ΔE = 13.605 693 × (1 − 1/4) = 10.204 270 eV; λ = 121.502 nm (infinite-mass approx) |
| Photon 1 eV | λ = 1239.841 984 nm |
| Muon τ → cτ | 2.196 9811 e-6 s × c = 658.638 m |
| Neutron half-life | 878.3 × ln 2 = 608.8 s |
| Top width → lifetime | 1.42 GeV → 4.64 e-25 s |
| Z → e⁺e⁻ BR | 0.033632 |
| W → eν two-body p* (m_e, m_ν → 0) | M_W/2 = 40.181 GeV |
| Muon decay electron endpoint | (m_μ² + m_e²)/(2m_μ) = 52.830 MeV |
| 1 u in MeV | 931.494 103 72 |
| 1 GeV⁻² in mb | 0.389 379 372 |
| Unitarity of CKM first row | |V_ud|² + |V_us|² + |V_ub|² = 0.99998 (within errors ≈ 1) |
| Two-flavor oscillation, sin²2θ = 1, Δm²L/4E phase π/2 | P = 1 |

---

## 5. Suggested data model (for the library)

```ts
type UnitSystem = "SI" | "natural_GeV";

interface Quantity { value: number; uncertainty?: number; unit: string; source: string; }

interface ParticleSpec {
  name: string;               // "electron"
  symbol: string;             // "e-"
  pdgId: number;              // Monte Carlo numbering: e- = 11, nu_e = 12, mu- = 13, u = 2, d = 1, s = 3, c = 4, b = 5, t = 6, g = 21, gamma = 22, Z = 23, W+ = 24, H = 25; antiparticles negative
  family: "quark" | "lepton" | "gauge_boson" | "scalar_boson" | "composite";
  generation?: 1 | 2 | 3;
  mass: Quantity;             // GeV, with scheme note for quarks
  massScheme?: "pole" | "MSbar@2GeV" | "MSbar@m" | "direct";
  width?: Quantity;           // GeV; lifetime = hbar / width
  meanLife?: Quantity;        // s
  charge: number;             // units of e
  spin: number;               // units of hbar (0, 0.5, 1, 2)
  parity?: 1 | -1;
  colorRep: "singlet" | "triplet" | "antitriplet" | "octet";
  baryonNumber: number;       // 0, ±1/3, ±1
  leptonNumbers: { e: number; mu: number; tau: number };
  isospin?: { I: number; I3: number };
  flavor?: { S: number; C: number; B: number; T: number };
  weakIsospinT3: { L: number; R: number | null };
  hypercharge: { L: number; R: number | null };
  gFactor?: Quantity;
  magneticMoment?: Quantity;  // J/T
  decays?: { products: string[]; branchingFraction: Quantity }[];
  antiparticle: string;       // "positron" or self
}
```

PDG Monte Carlo numbering (for interoperability): d 1, u 2, s 3, c 4, b 5, t 6; e⁻ 11, ν_e 12, μ⁻ 13, ν_μ 14, τ⁻ 15, ν_τ 16; g 21, γ 22, Z 23, W⁺ 24, H 25; p 2212, n 2112. Antiparticles use the negative ID.

---

## 6. Quick sanity checks on this document's numbers
- m_p − m_n sign: neutron is heavier by 1.293 MeV (so free neutrons β-decay, free protons don't).
- μ_e negative, μ_p positive, μ_n negative (neutral but has a moment → composite).
- Widths: Z (2.4955 GeV) > W (2.14 GeV) > t (1.42 GeV) ≫ H (3 MeV); H is narrow because its couplings scale with light fermion masses.
- Σ Z branching fractions: 3×3.36 + 20.0 + 69.9 ≈ 100 ✔.
- Σ W branching fractions: 10.71 + 10.63 + 11.38 + 67.41 ≈ 100 ✔.
- Σ top branching: 11.10 + 11.40 + 10.7 + 66.5 ≈ 99.7 ✔ (rounding).
- Quark charges: 2 × (2/3) − 1/3 = +1 (proton), 2/3 − 2 × 1/3 = 0 (neutron) ✔.
- Hypercharge check: u_L: 1/2 + (1/3)/2 = 2/3 ✔; e_R: 0 + (−2)/2 = −1 ✔.
- v from G_F: 246.22 GeV; y_t ≈ 0.99 (top Yukawa ≈ 1 — this is why the top is special).

End of reference.
