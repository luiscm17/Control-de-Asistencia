# Archive Report: dyeing

**Change**: dyeing
**Archived to**: `openspec/changes/archive/2026-09-14-dyeing/` (filesystem) | Engram `sdd/dyeing/archive-report` (hybrid)
**Archive date**: 2026-09-14
**Branch**: tenidos
**Mode**: hybrid (filesystem + Engram) | artifact_store both | delivery_strategy auto-chain | chain_strategy stacked-to-main | pace auto
**PRD**: `docs/dyeing/PRD.md` v0.1.0

## Final State

- **Status**: archived; intentional-with-warnings (no CRITICAL, live COPY E2E pending accepted as non-blocking WARNING, PR3 size:exception 676 lines intentional)
- **Tasks**: 13/13 complete — no unchecked `- [ ]` in archived `tasks.md` (Phase1 1.1–1.3 Config ✅, Phase2 2.1–2.2 Ingest/Persistence ✅, Phase3 3.1–3.3 Core guard/lock/hydrate ✅, Phase4 4.1–4.3 Menu/Setup/toasts ✅, Phase5 5.1–5.2 Harness+E2E ✅). Task Completion Gate PASSES.
- **Verification**: `pass_with_warnings` per `verify-report.md` — 7/7 requirements, 12/12 scenarios, 0 blockers, 0 critical findings. Build `node -e new Function syntax check` 8 files exit 0. Tests `node harness VM dyeingRunTests_ 12/12` exit 0.
- **Workload**: 3 PRs stacked-to-main (auto-chain). PR1 6c77e20 Config SSOT + Errors, PR2 a145e5f Typed ingest + Persistence upsert, PR3 e29f1b8 Core/Menu/Setup + harness final 676 lines `size:exception`.
- **Warnings at close (non-blocking, intentional)**:
  - W1 — Live COPY E2E not yet executed — requires sheet COPY (`tenidos`/`db_tenidos`/`items`/`Errors`) + owner trigger auth `dyeingSetup` + reload; mock VM proves typed `H/S:V` NUMBER, `@` verbatim, debounce 3000, lock 5s+retry, upsert same-row, two-times fill, hydrate, but not live `SpreadsheetApp` `setValues`/`Protection`. Marked as WARNING not blocker per `delivery_strategy auto-chain`. Must complete on COPY before merge to main per PRD §10.1: Day1 Teñido save → Re-sincronizar → Day3 Muestra → assert same row `A=C3`, `H/S:V` NUMBER `0.00`, `E12` `@` verbatim, `creado` preserved, `AD=tenidos!C3:I25`, `G4`/`items` untouched.
- **Size exception**: PR3 676 lines (Core 144 + Menu 105 + Setup 55 + tests 372 + tasks delta) exceeds 400-budget by 276 (69%). Cannot shrink — harness 372 lines required for 7 reqs/12 escenarios; Core/Menu/Setup minimal for lock/debounce/hydrate atomicity. Splitting would break atomicity (Core ↔ Menu ↔ harness dependencies). Noted as `size:exception` intentional, already carried in `verify-report` and `apply-progress`.

## Final-State Authority (hierarchy)

Per archive spec, when sources disagree rank most-authoritative first:

1. **Persisted tasks artifact** — completion visibility (Task Completion Gate). Archived `tasks.md` shows 13/13 `[x]` (verified 0 unchecked). Gate PASSES. Outranks snapshots.
2. **Explicit final-state facts in orchestrator launch prompt** — outrank intermediate snapshots. Applied: 13/13 tasks, verify `PASS WITH WARNINGS` (0 blockers, WARNING live COPY pending aceptado como `size:exception`), workload 3 PRs `stacked-to-main` commits `6c77e20`/`a145e5f`/`e29f1b8` (PR3 676 `size:exception`), branch `tenidos`, PRD `docs/dyeing/PRD.md`, artifact_store `both` hybrid, evidence `sha256:5c474...` etc., próxima verificación en COPY antes de merge a main.
3. **`verify-report` + `apply-progress` intermediate snapshots** — valid history at time written, never evidence of final state. Attributed as "per `verify-report` at verification time".

**Reporting rule applied**: Higher-ranked source says done (13/13, 0 blockers, PRs committed); lower snapshots also say done — aligned, no contradiction. Final numbers carried from highest-ranked source (tasks artifact + orchestrator facts + verify-report envelope). No stale pending claims echoed. W1 live COPY pending carried as warning per both verify-report and explicit facts, not resolved silently. No unrankable contradictions.

## Task Completion Gate

- [x] 13/13 tasks complete — `Select-String "^\- \[ \]"` 0 matches in archived `tasks.md`. `sdd-apply` owned completion; archive validated gate before any sync/move. No stale checkboxes.
- [x] No `dependencies.archive: blocked` — verified via tasks/verify explicit facts; CRITICAL 0 so archive proceeds. `reviewOffer` is invitation only.
- Exceptional reconciliation not needed — no unchecked tasks; `apply-progress` and `verify-report` both prove 13/13.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `dyeing-lot-recording` | Created | `openspec/specs/dyeing-lot-recording/spec.md` created from delta. 7 Requirements (Form Boundary+Config SSOT, Typed Capture Native Type is Truth ×2 scenarios, Explicit Save Menu+G4 ×2, PK Upsert/Audit/Soft-Delete ×2, Re-sincronizar Explicit Only ×2, Guards/Concurrency/Observability ×2, Data Model A:AD+Isolation) + 12 Scenarios; `C3` PK, `B6:E15` Teñido + `B18:E25` Muestra, `G4` debounce 3000 `PropertiesService`, `A:AD` 30 cols frozen, `H/S:V` NUMBER `0.00` rest STRING `@` verbatim, `void`/`active`, `LockService` 5s+retry, `America/La_Paz` audit only. |

**Mechanical Copy Contract — verbatim `diff -r` evidence (MUST be empty)**:

```text
=== Domain dyeing-lot-recording ===
Source: openspec/changes/dyeing/specs/dyeing-lot-recording/spec.md Exists=True Length=4704
TargetDir: openspec/specs/dyeing-lot-recording ExistsBefore=False ExistsAfter=True
Temp: openspec/specs/dyeing-lot-recording/.spec.md.Q4C7Hp
--- diff source vs temp (must be empty) ---
DIFF_SOURCE_TEMP_EMPTY_PASS (diff -r exit 0 — no output, identical)
Moved temp to openspec/specs/dyeing-lot-recording/spec.md via mv
--- diff source vs target (must be empty) ---
DIFF_STEP2_FINAL_EMPTY_PASS (diff -r exit 0 — no output, identical)
OK dyeing-lot-recording synced — 7 reqs, 12 scenarios, spec v1
```

Merge note: no existing main spec to preserve — delta IS full spec (new domain `dyeing-lot-recording`). No destructive merge warnings per `openspec/config.yaml` `rules.archive` — not applicable. Existing specs (`registro-*`, `yarn-*`, `coneras-*`, `yarn-inventory-recording`) untouched — dyeing isolated under `apps-script/dyeing/` per verify isolation PASS.

## Archive Contents

Moved via mechanical `git mv` (shell only, never Read→Write), verified by structural readback (archive-report additive-only excluded):

| Artifact | Status | Notes |
|----------|--------|-------|
| proposal.md | ✅ | Intent: `tenidos B1:I25` PK `C3` overwrites → explicit save `G4 FALSE→TRUE` + `Teñido → Guardar` → `db_tenidos A:AD` 30 cols typed `H/S:V` NUMBER `@` verbatim upsert `A=C3` two-times fill, `LockService` 5s+retry, `DYEING_CONFIG` SSOT, source PRD v0.1.0 `lotes-tenidos.xlsx` |
| specs/dyeing-lot-recording/spec.md | ✅ | 7 reqs / 12 scenarios — SSOT boundary, typed truth, explicit save debounce, upsert void/active, Re-sincronizar explicit, guards/lock, A:AD+isolation |
| design.md | ✅ | SSOT `DYEING_CONFIG` frozen, 7 modules Config/Ingest/Persistence/Core/Menu/Errors/Setup, explicit save `G4` reset ~1s, typed `getValue H/S:V` rest `getDisplayValue`, Map upsert full `B:Y` overwrite `void`, `America/La_Paz` audit, sequence diagrams guardar + Re-sincronizar |
| tasks.md | ✅ | 13/13 [x] — Forecast 750–900 lines high-risk chained PRs stacked-to-main: PR1 Config (1.1–1.3), PR2 Ingest/Persist (2.1–2.2), PR3 Core/Menu/Harness (3.1–5.2) |
| verify-report.md | ✅ | PASS WITH WARNINGS 7/7 reqs 12/12 scenarios, build 8/8 exit 0, tests 12/12 harness VM exit 0, W1 live COPY pending, 0 CRITICAL |
| archive-report.md | ✅ | This file — additive only, excluded from `diff -r` source/destination comparison |

**Mechanical Move Contract — verbatim `diff -r` evidence**:

```text
Source: openspec/changes/dyeing (exists True, 5 artifacts: proposal, design, tasks, verify-report, specs/dyeing-lot-recording/spec.md)
Destination: openspec/changes/archive/2026-09-14-dyeing (exists Before=False, After=True) — no collision
Snapshot root: /tmp/sdd-archive.e2113m
Snapshot: cp -R source -> /tmp/sdd-archive.e2113m/source exit: 0
Snapshot contents: design.md, proposal.md, specs/dyeing-lot-recording/spec.md, tasks.md, verify-report.md
Attempting git mv openspec/changes/dyeing -> openspec/changes/archive/2026-09-14-dyeing
git mv exit: 0
Source removed confirmed (Test-Path source = False)
Destination exists confirmed (True)
--- diff snapshot/source vs destination (MUST be empty) ---
DIFF_SNAPSHOT_DEST_EMPTY_PASS (diff -r exit 0 — no output, identical)
Archive move complete: openspec/changes/dyeing -> openspec/changes/archive/2026-09-14-dyeing
```

Active changes directory no longer contains `dyeing`; `openspec/changes/` now only `archive/`. `git status` shows `R` renames for tracked artifacts + new untracked main spec `openspec/specs/dyeing-lot-recording/spec.md` + `verify-report.md` carried as untracked (was untracked pre-archive) — expected. Change dir cleaned (no stale `openspec/changes/dyeing/`).

## Source of Truth Updated

The following specs now reflect the new behavior:

- `openspec/specs/dyeing-lot-recording/spec.md` — Single-lot `tenidos B1:I25` (PK `C3`, `B6:E15`+`B18:E25`, `G4` `MOBILE_SAVE_DEBOUNCE_MS=3000`) → `db_tenidos A:AD` 30 cols (25+5 audit) PK `Nº Lote` STRING `A=C3` trimmed, typed `H= T(°C)` NUMBER, `S/T= Titulo1/2` NUMBER, `U/V= Torsión1/2` NUMBER `0.00`, rest STRING, `E` `"@ …"` verbatim, `C6/C18→L/R` `dd/mm/yyyy` passthrough, full `B:Y` overwrite two-times fill, `creado Z` preserved `actualizado AA`/`editado_por AB` `La_Paz`, `AC void/active` `AD=tenidos!C3:I25`, explicit `Guardar`+`G4→FALSE`, `Re-sincronizar` explicit only, `LockService` 5s+retry `❌/⚠️` toasts, isolated `apps-script/dyeing/` `SpreadsheetApp/LockService/Session/Utilities` only.

PRD `docs/dyeing/PRD.md` v0.1.0 remains reference; delta spec promoted verbatim.

## Implementation Final State (per explicit facts, outrank snapshots)

- **Files**: `apps-script/dyeing/` 8 files (`appsscript.json` 364 `America/La_Paz` V8, `Config.gs` 9119 `DYEING_CONFIG` frozen SHEETS/RANGES/DB_HEADERS/LIMITS/UI/ERRORS + helpers `dyeingGetSheet_/dyeingParseA1_/dyeingEnsureSchema_`, `Errors.gs` 1715 `dyeingLogError_` `La_Paz`, `Ingest.gs` 6732 `dyeingReadForm_/WriteForm_` typed `H/S:V getValue` rest `getDisplayValue` `@` verbatim, `Persistence.gs` 5175 Map `A→row` `dyeingUpsertLote_` `void/active` `creado` preserved `H/S:V 0.00 E @` `AD`, `Core.gs` 6165 `guardarLote()` guard `trim(C3)`+`LockService 5s+retry`+audit `La_Paz`+`dyeingHydrate_()` explicit, `Menu.gs` 4186 `onOpen` `Teñido Guardar|Re-sincronizar` + `dyeingOnEdit` `G4 FALSE→TRUE` debounce 3000 `PropertiesService`→`G4=FALSE`, `Setup.gs` 1836 `dyeingSetup()` trigger+`A:AD` fix, `tests/dyeing.test.gs` 20508 harness `dyeingTestHelpers_` 12 tests) — build `node -e new Function` 8 files OK, harness `12/12` OK with shared `PropertiesService`.
- **Modularization**: `DYEING_CONFIG` SSOT owns `C3/G4/B6:E15/B18:E25/A1:AD1` 30 cols; no `getRange("` outside Config verified; only `C3/B6:E15/B18:E25` touched, `G4`/`items` never written; typed `NUMBER_COLS [7,18,19,20,21]` → `H/S:V` NUMBER rest STRING; dates passthrough; audit `Utilities.formatDate(...America/La_Paz...)` only; isolated `apps-script/dyeing/` V8 per verify isolation PASS.
- **Before-archive commits (explicit final-state facts)**: `a2dc480` PRD v0.1.0, `566ddfa` SDD docs proposal/spec/design/tasks hybrid, `6c77e20` PR1 Config SSOT+Errors (stacked-to-main), `a145e5f` PR2 typed ingest+persistence (stacked-to-main), `e29f1b8` PR3 Core/Menu/Setup+harness final 676 lines `size:exception` (stacked-to-main). Workload 3 PRs stacked-to-main on branch `tenidos`.
- **Stacked chain**: `main` ← `tenidos` (PR1 `6c77e20` + PR2 `a145e5f` + PR3 `e29f1b8` as stacked commits). Next is PR creation from `tenidos` to `main` (not yet opened).

## Verification Traceability

- `verify-report` envelope:
```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:5c4742e10b61755b3305ee2d658d256f72a40bac9ea8f12ef9e0575bf11189ce
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 7/7
scenarios: 12/12
test_command: node harness VM dyeingRunTests_ 12/12 (Config+Errors+Ingest+Persistence+Core+Menu+Setup+tests with shared PropertiesService)
test_exit_code: 0
test_output_hash: sha256:afcb47b978f8226ba649fd8521b433a3ea4469436375add851e52960ccde6c9b
build_command: node -e new Function syntax check 8 files (Config,Core,Errors,Ingest,Menu,Persistence,Setup,tests)
build_exit_code: 0
build_output_hash: sha256:17630775ce4209dab4644b0c0e518837f478e717ef4f4a5566fcd2a032cbee50
```
- Requirements 7/7 scenarios 12/12 compliant per spec compliance matrix (harness + static `H/S:V`/`@`/`G4`/lock evidence).
- **Attribution**: per `verify-report` at verification time `2026-09-14T23:56:48Z` (#961), build 8 files OK, 12 tests passed covering ConfigFrozen, HeadersFrozen, BoundaryNeverPersisted, TypedInvariant, TrimGuard, Debounce (`VERDADERO/FALSO` + `PropertiesService` 3000), CreadoPreserved, VoidAndReactivate, UpsertSameRow, MenuGuards, LockExhaustion, E2ETwoTimesFill — mock VM strong evidence; live COPY pending as warning.
- **Observation IDs actually read (hybrid traceability)**: Engram `sdd/dyeing/proposal` #956, `sdd/dyeing/spec` #957, `sdd/dyeing/design` #958, `sdd/dyeing/tasks` #959, `sdd/dyeing/apply-progress` #960 (PR3 final 13/13), `sdd/dyeing/verify-report` #961 — all `capture_prompt false` + filesystem `openspec/changes/archive/2026-09-14-dyeing/*`. Tasks file source archived `tasks.md` is filesystem truth (13/13 `[x]`, 0 unchecked via `Select-String "^- \[ \]"`).
- **Isolation verified**: `apps-script/dyeing/` own `appsscript.json` `America/La_Paz` V8, no shared globals with `attendance-control`/`yarn-production`/`yarn-settings`/`coneras-production`/`yarn-inventory`; only `SpreadsheetApp/LockService/Session/Utilities/PropertiesService/ScriptApp`.
- **Hashes**: test `sha256:afcb47b978f8226ba649fd8521b433a3ea4469436375add851e52960ccde6c9b`, build `sha256:17630775ce4209dab4644b0c0e518837f478e717ef4f4a5566fcd2a032cbee50`, evidence `sha256:5c4742e10b61755b3305ee2d658d256f72a40bac9ea8f12ef9e0575bf11189ce`.

## Risks / Next Steps

- **Manual COPY required before merge to main** (W1 — carry-forward, do NOT re-verify via mock): On workbook COPY (`tenidos`/`db_tenidos`/`items`/`Errors`, never prod `1iw9bduLeGXQMbjmMV1qrMqE2WoPWCBz3`): run `dyeingSetup()` once (installs `dyeingOnEdit` installable, validates `A:AD` 30 cols + `G4 FALSE` validation + `Errors`), reload menu, verify `G4` checkbox `H4 ☑ GUARDAR`. Then PRD §10.1 Day1 Teñido save → `Teñido → Guardar` or `G4 TRUE` → assert `db_tenidos` 1 row `A=C3` verbatim `H/S:V` NUMBER `E @` verbatim `creado` audit `La_Paz` `AD` correct, then `Re-sincronizar` → assert `B6:E15+B18:E25` hydrate verbatim, then fill Muestra block save again → assert same row updated (no duplicate) `H/S:V` NUMBER preserved, `E12 @` verbatim, `creado` preserved `actualizado` refreshed, `items`/`G4` untouched, `void↔active` correct. Requires owner auth — static guards alone do not prove `SpreadsheetApp.getActiveSpreadsheet()` runtime.
- **PR creation (next_recommended)**: Create stacked PRs from `tenidos` → `main` per `delivery_strategy auto-chain` `chain_strategy stacked-to-main`. PR1 `6c77e20` + PR2 `a145e5f` + PR3 `e29f1b8` already committed on `tenidos`; open PR (or 3 stacked PRs) targeting `main`. PR3 carries `size:exception 676 lines` label — reviewer to accept intentional (harness 372 + atomic Core/Menu/Setup). Merge only after COPY E2E passes; until then `tenidos` stays stacked.
- **No archiving debt**: 0 unchecked tasks, 0 critical findings, no review gate blockers. `registro`/`yarn`/`coneras`/`yarn-inventory` specs untouched.

## Archive Validation Checklist

- [x] Main specs created correctly (`diff -r` empty, mechanical copy verified via `cp`→`diff`→`mv`→`diff` — see Specs Synced verbatim)
- [x] Change folder moved to archive (`diff -r` empty, `git mv` exit 0, source absent `openspec/changes/dyeing` → `openspec/changes/archive/2026-09-14-dyeing/`)
- [x] Archive contains all artifacts (proposal, specs/dyeing-lot-recording/spec.md, design, tasks, verify-report, archive-report)
- [x] Archived `tasks.md` has no unchecked implementation tasks (13/13 `[x]`, `grep "- [ ]"` 0)
- [x] Active changes directory no longer has this change (`openspec/changes/` now only `archive/`)
- [x] Verbatim `diff -r` readback output included above and is empty (no differences) for both spec sync and archive move
- [x] `apps-script/dyeing` untouched after move; build still `node -e new Function` 8 files OK (previously verified, no code outside dyeing changed)
- [x] No CRITICAL verification issues; W1 live COPY documented as intentional-with-warnings with explicit final-state facts outranking snapshots
- [x] Hybrid persistence completed — Engram `sdd/dyeing/archive-report` saved with observation IDs #956/#957/#958/#959/#960/#961 cited above, plus filesystem `archive-report.md`

## SDD Cycle Complete

The change has been fully planned, implemented, verified (`pass_with_warnings` 7/7 reqs 12/12 scenarios, 0 critical, 12-test harness VM 12/12 + live COPY pending), spec-synced (`dyeing-lot-recording` created), and archived at `openspec/changes/archive/2026-09-14-dyeing/` (hybrid) on branch `tenidos`. Ready for PR creation `tenidos` → `main` (stacked-to-main, `size:exception` PR3), pending COPY E2E before merge.

---
*Teams: sdd-archive | 2026-09-14 | hybrid (filesystem+Engram) both stores `capture_prompt false` | intentional-with-warnings | branch tenidos | PRD docs/dyeing/PRD.md v0.1.0 | workload 3 PRs stacked-to-main (6c77e20, a145e5f, e29f1b8 size:exception 676)*
