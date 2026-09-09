# Archive Report: coneras-production

**Change**: coneras-production
**Archived to**: `openspec/changes/archive/2026-09-08-coneras-production/` (filesystem) | openspec mode
**Archive date**: 2026-09-08
**Branch**: coneras-production
**Mode**: openspec (filesystem only) | strict_tdd false | isolated V8 `apps-script/coneras-production/`

## Final State

- **Status**: archived; intentional-with-warnings.
- **Tasks**: 14/14 complete — no unchecked `- [ ]` in archived `tasks.md` (phases 1-4). Task Completion Gate PASSES.
- **Verification**: `pass_with_warnings` per `verify-report.md` — 6/6 requirements, 6/6 scenarios, 0 blockers, 0 critical findings.
- **Warnings at close (non-blocking, intentional)**:
  - W1: Harness `conerasTestSupervisorNormalizationAndHydrateAndDropdown_` supervisor predicate assertion expects legacy `QUERY` ` and M = '"&$B7&"'` but implementation correctly uses `SUMPRODUCT` `((($B$7="Todos")+(db_coneras!M2:M=$B$7))>0)` — functional Todos omission preserved, assertion is stale and isolated to harness. No spec violation.
  - W2: Dashboard spec evolution described as `QUERY` in PRD/spec but shipped as `SUMPRODUCT` — reconciled pre-archive (see Specs Synced). Aggregation remains native formula read-only; coherent with `Setup`/`Config`.
- **Implementation final**: 7 modules under `apps-script/coneras-production/` (`Config.gs`, `Core.gs`, `Persistence.gs`, `Ingest.gs`, `Menu.gs`, `Errors.gs`, `Setup.gs` + `appsscript.json` `America/La_Paz` V8) — verified `node --check` 8 files exit 0.
- **Manual COPY verification**: 2026-09-08 — menu/checkbox save, hydrate by `E5/G4/C5` fecha-first plain `yyyy-MM-dd`, delete-guard Continue/Cancel batch, `F7:F16` SUMPRODUCT totals and `H/I` daily across Fecha/Semana/Mes, 5 charts visibility. Date fix applied: `conerasNormalizeFecha_` timezone-agnostic (`getFullYear`/`getMonth`/`getDate` without `Utilities.formatDate`), `conerasDateFromKey_` → `Date@12:00` display artifact for `SUMPRODUCT` + `dd/MM/yyyy`, audit timestamps alone use `America/La_Paz`. Re-verified.
- **Reconciliation**: specs/design updated pre-sync to reflect shipped behavior — `fecha` plain calendar string (timezone-agnostic, not `America/La_Paz`), dashboard `SUMPRODUCT` with English `IF`/`TODAY`/`DATE`/`EOMONTH` (no `QUERY`).

## Final-State Authority (hierarchy)

Per archive spec, when sources disagree rank most-authoritative first:

1. **Persisted tasks artifact** — completion visibility (Task Completion Gate). Archived `tasks.md` shows 14/14 `[x]` (verified 0 unchecked). Gate PASSES.
2. **Explicit final-state facts in orchestrator launch prompt** — outrank intermediate snapshots. Applied as final state: Tasks 14/14, verifyReport `pass_with_warnings` with 1 stale harness assertion (supervisor SUMPRODUCT vs QUERY, functional correct), manual COPY 2026-09-08 done with date fix (fecha plain `yyyy-MM-dd`), intentional archive with reconciled specs/design.
3. **`verify-report` + `apply-progress` intermediate snapshots** — valid history at time written, never evidence of final state. Their `pending/blocked/open` claims are stale if later facts outrank them. Attributed as "per `verify-report` at verification time".

**Reporting rule applied**: verify-report's `CRITICAL: None` and `pass_with_warnings` remain authoritative; the stale harness `FAIL` is isolated and does not reflect a spec violation — reported as warning with fix guidance, not as current failure. No unrankable contradictions; final numbers carried from highest-ranked sources.

## Task Completion Gate

- [x] 14/14 tasks complete — `grep "- [ ]" tasks.md` 0 matches in archived artifact. `sdd-apply` owned completion; archive validated gate before any sync/move.
- [x] Reconciliation: pre-archive edits to `specs/coneras-dashboard/spec.md` (QUERY → SUMPRODUCT) and `design.md` (QUERY → SUMPRODUCT, fecha plain) were applied before mechanical sync, so delta promoted is the reconciled shipped truth.
- No `reviewGate`/`blocked` in status; verification reports `pass_with_warnings` with 0 critical — archive proceeds as intentional-with-warnings per `openspec/config.yaml` rules.archive.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `coneras-dashboard` | Created | `openspec/specs/coneras-dashboard/spec.md` created from reconciled delta. 3 Requirements (FR-011/013, FR-012/016, FR-014/015/017), 3 Scenarios; native `SUMPRODUCT` read-only, `Todos` predicate omission, `Fecha`/`Semana`/`Mes` period semantics. |
| `coneras-production-recording` | Created | `openspec/specs/coneras-production-recording/spec.md` created from reconciled delta. 3 Requirements (FR-001/002, FR-003-007/009, FR-008/010), 3 Scenarios; form hydration fecha-first plain `yyyy-MM-dd` timezone-agnostic, explicit batch 0–15 upsert, delete-guard, `America/La_Paz` only for audit. |

**Mechanical Copy Contract — verbatim `diff -r` evidence (MUST be empty)**:

```text
=== Domain coneras-dashboard ===
Source: openspec/changes/coneras-production/specs/coneras-dashboard/spec.md Exists=True
TargetDir: openspec/specs/coneras-dashboard
Temp: openspec/specs/coneras-dashboard/.spec.md.2tWTCV
--- diff source vs temp (must be empty) ---
diff exit: 0
Moved temp to openspec/specs/coneras-dashboard/spec.md
--- diff source vs target (must be empty) ---
diff exit: 0
OK coneras-dashboard synced

=== Domain coneras-production-recording ===
Source: openspec/changes/coneras-production/specs/coneras-production-recording/spec.md Exists=True
TargetDir: openspec/specs/coneras-production-recording
Temp: openspec/specs/coneras-production-recording/.spec.md.RthW3E
--- diff source vs temp (must be empty) ---
diff exit: 0
Moved temp to openspec/specs/coneras-production-recording/spec.md
--- diff source vs target (must be empty) ---
diff exit: 0
OK coneras-production-recording synced

Both specs synced mechanically with empty diff.
```

Merge note: no existing main spec to preserve — delta IS full spec (new domains). Reconciliation applied before copy: dashboard spec `QUERY` → `SUMPRODUCT` (English `IF`/`TODAY`/`DATE`/`EOMONTH`, `L2:L`/`F2:F`/`B2:B` row-2 exclusion) and recording spec `fecha` plain `yyyy-MM-dd` timezone-agnostic (`America/La_Paz` audit-only). No destructive merge warnings required per `openspec/config.yaml` rules.archive. Existing specs (`registro-governance`, `registro-ingest`, `yarn-dashboard`, `yarn-mobile-form`, `yarn-production-recording`, `yarn-shift-persistence`) untouched — coneras isolated under `apps-script/coneras-production/`.

## Archive Contents

Moved via mechanical `git mv`/fallback `mv` (shell only, never Read→Write), verified by structural readback:

| Artifact | Status | Lines/Notes |
|----------|--------|-------------|
| proposal.md | ✅ | Intent: reusable `conera` form 0–15 unloads per `(fecha,turno,maquina,descarga_nro)` → `db_coneras` A:P, dashboard read-only, `Errors` |
| specs/coneras-dashboard/spec.md | ✅ | 3 reqs / 3 scenarios — reconciled to SUMPRODUCT |
| specs/coneras-production-recording/spec.md | ✅ | 3 reqs / 3 scenarios — reconciled fecha plain |
| design.md | ✅ | Reconciled: isolated V8, fecha plain, SUMPRODUCT dashboard (F7:F16/H/I/pivots K/S/V, 5 charts), batch Map<id,row> single lock |
| tasks.md | ✅ | 14/14 [x] — Phases 1-4 foundation/recording/dashboard/docs (with 3.3/4.1 verified 2026-09-08 notes) |
| apply-progress.md | ✅ | PR 3 closure work unit, date fix notes (`conerasNormalizeFecha_` plain, `conerasDateFromKey_@noon`), harness results |
| verify-report.md | ✅ | `pass_with_warnings` 6/6 reqs 6/6 scenarios, build 0, harness 11 pass / 1 stale (supervisor SUMPRODUCT) + COPY 2026-09-08 |
| archive-report.md | ✅ | This file — additive only, excluded from `diff -r` source/destination comparison |

**Mechanical Move Contract — verbatim `diff -r` evidence**:

```text
Source exists: True
Destination exists: False
Snapshot root: C:\Users\lukas\AppData\Local\Temp/sdd-archive.8RUuMz
Snapshot copied
Attempting git mv openspec/changes/coneras-production -> openspec/changes/archive/2026-09-08-coneras-production
git mv exit: 0
git mv succeeded
Source removed confirmed
--- diff snapshot/source vs destination (MUST be empty) ---
diff exit: 0
Archive diff empty - PASS
Snapshot cleanup done
Archive move complete: openspec/changes/coneras-production -> openspec/changes/archive/2026-09-08-coneras-production
```

Active changes directory no longer contains `coneras-production`; `git status` shows `R` renames for all artifacts + new untracked main specs (expected).

## Source of Truth Updated

The following specs now reflect the new behavior:

- `openspec/specs/coneras-dashboard/spec.md` — Periodo controls (`Fecha`/`Semana`/`Mes`), `Todos` omission, `SUMPRODUCT` read-only totals (`F7:F16`, `H/I` daily, pivots `K/S/V`), 5 charts, `E4` meta via `dashboard!B7`.
- `openspec/specs/coneras-production-recording/spec.md` — Form selection/hydration fecha-first plain `yyyy-MM-dd` timezone-agnostic, explicit validated batch 0–15 upsert preserving `creado`/`actualizado`/`editado_por` (`America/La_Paz` audit-only), `I8` → reset, delete-guard batch `Ui.alert`.

PRD v0.1.0 remains reference; no spec drift beyond intentional SUMPRODUCT migration (commit `refactor: simplify native dashboard filters`, `fix dashboard formulas locale`).

## Implementation Final State (per explicit facts, outrank snapshots)

- **Files**: `apps-script/coneras-production/` 7 modules (`Config.gs` 10402, `Core.gs` 8079, `Persistence.gs` 2660, `Ingest.gs` 1762, `Menu.gs` 586, `Errors.gs` 1477, `Setup.gs` 16827) + `tests/coneras-production.test.gs` — build `node --check` 8/8 exit 0, `git diff --check` 0 (LF/CRLF only).
- **Fecha isolation**: `Config.conerasNormalizeFecha_` returns plain `yyyy-MM-dd` via `getFullYear`/`getMonth`/`getDate` (no `Utilities.formatDate` in Date branch); `conerasDateFromKey_` returns `Date@12:00` for `SUMPRODUCT` display + `dd/MM/yyyy` `B2:B` migration. `Core.conerasHydrate_` filters `conerasNormalizeFecha_(row[1]) === fecha` fecha-first.
- **Dashboard**: `Config` builds `SUMPRODUCT((L2:L)*(F2:F=E7)*(B>=IF(...))*(B<IF(...))*((($B$7="Todos")+(M2:M=$B$7))>0)...)` English, no `QUERY`/`upper`/`SUBSTITUTE`, locale separator aware. `Setup` configures `F7:F16`, `H6:H36`/`I6:I36`, pivots `K/S/V`, 5 charts (`BAR`/`LINE`/`AREA` stacked/`LINE`/`COLUMN`), titles via `conerasDashboardChartTitle_` omitting `Todos`.
- **Before-archive fixes (2026-09-08) — committed as explicit final-state fact, are final state**: date timezone fix (plain `yyyy-MM-dd`) + dashboard locale/SUMPRODUCT fixes already in history (`37999ca`, `d9135b4`, `741b087`).
- **Warnings intentional-with-warnings**: W1 stale harness supervisor predicate (SUMPRODUCT vs legacy QUERY SI) — functional correct, `Todos` omission preserved, `conerasTestHelpers_` fails only on that one assertion if run unfiltered; fix is updating assertion to `((($B$7="Todos")` or `M2:M=$B$7`. W2 spec wording lag — fixed pre-archive via reconciliation. No CRITICAL issues — archive proceeds per strict-vs-OpenSpec policy (CRITICAL always blocks; non-critical warnings allow intentional archive).

## Verification Traceability

- `verify-report` evidence_revision `sha256:99a9c6f7f69bb044526013f615fd3ee946f0cd2f2bc9cb27063355332cd2e703`
- `test_command`: `node harness-simulation-coneras` + `node --check` 8 files exit 0, `git diff --check` 0.
- **Attribution**: per `verify-report` at verification time, harness 11 passed / 1 stale assertion / 1 guard (load-order); manual COPY 2026-09-08 covers save/hydrate/delete/dashboard periods/charts, date fix applied and re-verified. `playwright-cli` (`input#t-name-box` + `div#t-formula-bar-input`) available as alternative proof per AGENTS.md without canvas scrape.
- **Isolation verified**: `apps-script/coneras-production/` own `appsscript.json` `America/La_Paz` V8, no shared globals with attendance/yarn; `grep` productive writes 0 outside coneras.

## Risks / Next Steps

- **Harness follow-up**: Patch `conerasTestSupervisorNormalizationAndHydrateAndDropdown_` supervisor predicate assertion to SUMPRODUCT form and re-run `conerasTestHelpers_` 13/13 in authenticated editor on COPY. No blocking — functional path correct.
- **No COPY rerun required before next change**: manual 2026-09-08 already covered `E7` spill → `F7:F16`/`H/I`/charts after date fix; playwright-cli can automate future regressions.
- **No archiving debt**: 0 unchecked tasks, 0 critical findings, no reviewGate blockers. `registro`/`yarn` specs untouched.

## Archive Validation Checklist

- [x] Main specs created correctly (`diff -r` empty, mechanical copy verified)
- [x] Change folder moved to archive (`diff -r` empty, `git mv` exit 0, source absent)
- [x] Archive contains all artifacts (proposal, specs, design, tasks, apply-progress, verify-report, archive-report)
- [x] Archived `tasks.md` has no unchecked implementation tasks (14/14 [x])
- [x] Active changes directory no longer has this change
- [x] Verbatim `diff -r` readback output included above and is empty (no differences)
- [x] `apps-script/coneras-production` untouched after move; `node --check` still exit 0
- [x] No CRITICAL verification issues; warnings documented as intentional-with-warnings with reconciliation

## SDD Cycle Complete

The change has been fully planned, implemented, verified (`pass_with_warnings`, 0 critical), reconciled (fecha plain + SUMPRODUCT), spec-synced, and archived. Ready for the next change.

---
*Teams: sdd-archive | 2026-09-08 | openspec filesystem | reconciled intentional-with-warnings*
