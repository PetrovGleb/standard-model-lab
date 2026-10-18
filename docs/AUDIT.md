# Audit

A review of the project, module by module, on two axes: architecture (ready to be extended without
modification, contracts honoured, dependencies pointing down, no duplication or dead paths, errors
and texts bilingual) and physics (every law against its source, units, validity windows,
conservation, detailed balance). Each finding has a severity: **defect** (wrong result or crash),
**inaccuracy** (right law, approximate numbers), **limit** (physics not modelled, stated), **smell**
(code that invites a mistake). Fixed findings name the test that now guards them. The audit runs
in dependency order; parts not yet reviewed are listed at the end.

## 1. Contracts and constants (2026-10-17)

| #    | Severity | Finding                                                                                                                                                                                                                              | Status                                                                               |
| ---- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| 1.1  | ok       | Every generated artefact (`codata.generated.ts`, `matter.generated.json`, `reaclib.generated.json`, `nnpdf23-lo-qed.generated.json`) is byte-identical to a fresh run of its generator.                                              | verified by regeneration and `cmp`                                                   |
| 1.2  | smell    | The Bohr radius was retyped as `5.29e-11` in `templates/quantum-space.ts`.                                                                                                                                                           | fixed: `BOHR_RADIUS.value`                                                           |
| 1.3  | smell    | CODATA values retyped in tests (`star-matter`, `decoherence-monte-carlo`, `environment-dynamics`). `space.test` and `collisions.test` keep independent oracle values on purpose (they check the constants themselves).               | fixed where the test does not check the constant                                     |
| 1.4  | defect   | `SystemFrame.regions` was required, but run results stored before 2026-10-17 have no such field; the web already tolerated its absence.                                                                                              | fixed: optional in the contract                                                      |
| 1.5  | smell    | Six object schemas accept unknown properties (`create`, `createAtom`, `createMolecule`, `entangle`, `diffract` and the step discriminator wrapper); the other 24 are strict. Unknown keys pass validation silently.                  | open: make them strict once the web never sends extra keys (checked in part 10)      |
| 1.6  | limit    | 464 unstable nuclides have decay modes without branching percentages in NUBASE; the engine gives those modes equal weights. 87 unstable nuclides have no half-life (unbound resonances) and decay at once.                           | documented; equal weights are the only choice NUBASE leaves                          |
| 1.7  | verify   | PDG values to confirm against the 2026 edition when it is at hand: m_H = 125.13 GeV (2024 edition: 125.20 ± 0.11), m_W = 80.3625 GeV (2024: 80.3692 ± 0.0133), τ_n = 878.3 s (2024: 878.4 ± 0.5).                                    | open: the reference file names the edition it transcribes                            |
| 1.8  | smell    | 66 exported symbols in the libs are referenced nowhere outside their file (types kept as public API; code such as `hillFormula`, `moleculeBindingInEv`, `tabulatedBond`, `hydrogenicBindingInEv`, `quarkOf`, unused CODATA aliases). | open: remove or use after the engine parts are reviewed                              |
| 1.9  | smell    | `SystemEvent.text` and `MediumOutcome.label` allow `LocalizedText \| string`; a plain string would show in one language only.                                                                                                        | open: narrow to `LocalizedText` once every producer is bilingual (checked in part 8) |
| 1.10 | smell    | The `neighbors` aspect is declared and never set or read.                                                                                                                                                                            | open: remove or give it a contributor                                                |
| 1.11 | limit    | A heat bath (`setTemperature`) alone has no partners: without a medium nothing ionizes atoms or breaks nuclei, and no law exists for deconfinement above T_c ≈ 155 MeV (lattice QCD), so matter stays hadronic at 10¹² K.            | roadmap: radiation field with the medium (step 15), deconfinement as a medium law    |

Every column of the Sequelize models names its `DataType` (23 columns). The plan schema is typed
with `JSONSchemaType` against the TypeScript types and rejects malformed plans with the ajv
message, as `experiment-plan.schema.test.ts` and `plan-compiler.test.ts` check.

## Still to review

Particles and catalog (2), quantum core (3), environment and dynamics (4), decays (5), collisions:
elementary, partons, nuclear, atomic (6), media and chemistry (7), experiment runner and compiler
(8), API and persistence (9), web (10), desktop packaging (11). Coverage measurement needs
`@vitest/coverage-v8`, which is not installed yet.
