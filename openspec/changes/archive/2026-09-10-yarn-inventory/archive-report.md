# Archive Report: yarn-inventory

**Change**: yarn-inventory
**Archived to**: `openspec/changes/archive/2026-09-10-yarn-inventory/` (filesystem) | Engram `sdd/yarn-inventory/archive-report` (hybrid)
**Archive date**: 2026-09-10
**Branch**: yarn-inventory
**Mode**: hybrid (filesystem + Engram) | artifact store both | strict_tdd false | isolated V8 `apps-script/yarn-inventory/`

## Final State

- **Status**: archived; intentional-with-warnings (no CRITICAL, PR2 size:exception already noted, manual COPY/Logger pending is non-blocking warning).
- **Tasks**: 13/13 complete — no unchecked `- [ ]` in archived `tasks.md` (phases 1.1–1.3 Foundation ✅, 2.1–2.4 Core ✅, 3.1–3.3 Integration ✅, 4.1–4.3 Testing/Verification ✅). Task Completion Gate PASSES. Explicit final-state facts confirm 13/13 across 3 PR slices: PR1 304 lines, PR2 693 lines `size:exception`, PR3 348 lines. Commits: `71d1aca` docs PRD v0.2.0, `3967150` scaffold SSOT+Errors, `649ee89` Repository+Ingest+Persistence+lock, `7af793f` Menu+hydration+tests+harness.
- **Verification**: `pass_with_warnings` per `verify-report.md` — 5/5 requirements, 11/11 scenarios, 0 blockers, 0 critical findings. Build `node --check` 7/7 files exit 0. Static guards PASS: 0 literal `getRange("` outside Config.gs (2 doc comments only), `formatDate` only in `Errors.gs:20` via `YARN_INVENTORY_CONFIG.TIMEZONE` audit, `getFullYear/getMonth/getDate` only in `Config.gs` `yarnInventoryDateKey_`, headers MADEJERAS 17 A:Q / LOTES 24 A:X frozen, isolation to `apps-script/yarn-inventory/` verified.
- **Warnings at close (non-blocking, intentional)**:
  - W1 — Runtime Logger + COPY not executed by this executor (no authenticated SpreadsheetApp). Harness `yarn-inventory.test.gs` 14 tests exist and pass code inspection, but require manual run: Apps Script editor select `yarnInventoryRunTests_` → Run → Logger `14/14`; plus COPY `1RCupngk5x95ev5N4Zv0veMMbOhz6eH_9Vs44a1txE3s` manual steps (fill 4+5 rows → Guardar Madejeras/Lotes/Todo → verify A:Q/A:X batch ≤10/≤47 per `fecha+turno`, last-wins, clearing→`void` re-adding→`active`, formulas recalc, invalid → Errors, lock busy→error). Must complete before merge — apply-progress notes this as pending. Static guards + inspection are strong evidence but not GAS runtime. No CRITICAL.
  - W2 — PR2 `size:exception` (693 lines) already recorded in apply-progress — chained PR2 exceeded 400-line budget; PR3 is within budget (348) and cohesive. Not a new issue but carry-forward, noted in verify-report as intentional.
  - W3 — `git status` shows `M` on tasks/apply-progress modified and untracked `docs/inventory/yarn-inventory.xlsx` + `docs/yarn-inventory/PRD.md` + `docs/inventory/tenidos.xlsx` — they are declared scope per PRD §4–§10 and SDD change docs, not isolation violation, but reviewer should confirm `docs/inventory` fixture is intended untracked (per verify-report W3).
- **Implementation final**: 7 modules under `apps-script/yarn-inventory/` (`appsscript.json` America/La_Paz V8, `Config.gs` 10153, `Errors.gs` 1902, `Repository.gs` 2891, `Ingest.gs` 10920, `Persistence.gs` 22438, `Menu.gs` 14700, `tests/yarn-inventory.test.gs` 25836) — verified `node --check` 7 files exit 0, `Copy .gs → .js` build hash `sha256:fc1aa0894fa1e28029630ba8d26aa2f61bb03502d8b1ba098c4f7c5bcf498e52`, test hash `sha256:473c84e6d1ef467750177ebca3369c522f66c82c439880ca7f9b49b4bf960301`.
- **Modularization primordial satisfied**: `YARN_INVENTORY_CONFIG` SSOT in `Config.gs` owns all sheets/ranges/headers/IDX/TURNO/SUP/INV lists/LIMITS/formula guards; 0 literal `getRange("` outside Config; input-only `C8:G17` / `A6:F52+H6:O52` vs `H8:K17` / `G/P/Q/R` never touched (`valueRenderOption=FORMULA` verbatim); `fecha` native `DATE` via `getFullYear/getMonth/getDate` without timezone, audit `America/La_Paz` only via `Errors.gs`; PKs `fecha+turno+maquina+lado` and `fecha+turno+lote_id→rowIndex` with last-wins `⚠️` and `void`/`active` idempotent; single `LockService.getDocumentLock()` 5s+1 retry sequential `Guardar Todo` partial not rolled back.

## Final-State Authority (hierarchy)

Per archive spec, when sources disagree rank most-authoritative first:

1. **Persisted tasks artifact** — completion visibility (Task Completion Gate). Archived `tasks.md` shows 13/13 `[x]` (verified 0 unchecked via `Select-String` count 0). Gate PASSES. This outranks all snapshots.
2. **Explicit final-state facts in orchestrator launch prompt** — outrank intermediate snapshots. Applied as final state: 13/13 tasks complete across 3 PR slices (PR1 304, PR2 693 `size:exception`, PR3 348) commits 71d1aca/3967150/649ee89/7af793f; verify `PASS WITH WARNINGS` 5/5 req 11/11 scenarios 14-test harness Logger 14/14 pending manual COPY `1RCupngk5x95ev5N4Zv0veMMbOhz6eH_9Vs44a1txE3s`, no CRITICAL, PR2 size:exception already noted; modularization primordial SSOT/0 literal/boundary/fecha native/audit La_Paz only/PKs satisfied; artifact store `both`; branch `yarn-inventory`; archive should sync delta specs to `openspec/specs/` and produce `archive-report`.
3. **`verify-report` + `apply-progress` intermediate snapshots** — valid history at time written, never evidence of final state. Their `pending/blocked/open` claims are stale if later facts outrank them. Attributed as "per `verify-report` at verification time" or "per `apply-progress` at apply time".

**Reporting rule applied**: When higher-ranked source says done/fixed/resolved and lower-ranked snapshot says pending/blocked/open, report final state and cite where fix landed (commit, later evidence). Do NOT echo stale claim. When contradiction cannot be ranked, record both statements with sources. Carry final numbers from highest-ranked source; never copy stale numbers from snapshots when later work changed them. No unrankable contradictions found — explicit facts align with persisted tasks (13/13) and verify-report `pass_with_warnings` (0 CRITICAL). W1 manual COPY pending is carried as warning per both verify-report and explicit facts (pending manual COPY before merge), not resolved silently.

## Task Completion Gate

- [x] 13/13 tasks complete — `Select-String "^\- \[ \]"` 0 matches in archived `tasks.md`. `sdd-apply` owned completion; archive validated gate before any sync/move. Exceptional reconciliation not needed — no stale checkboxes; `apply-progress` and `verify-report` both prove 13/13 complete.
- [x] No `dependencies.archive: blocked` — verified via tasks/verify explicit facts; CRITICAL 0 so archive proceeds. `reviewOffer` from verify is invitation only, not archive state.
- No incomplete implementation tasks block archive; all checkboxes `[x]` and `apply-progress` 13/13 confirmed. No orchestrator override required for stale-checkbox reconciliation.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `yarn-inventory-recording` | Created | `openspec/specs/yarn-inventory-recording/spec.md` created from delta. 5 Requirements (Single Config SSOT+Boundary, Fecha+Turno Hydration, Explicit Validated Batch Upsert+Audit, Void Soft-Delete, Concurrency-Safe Save) + 11 Scenarios; input-only C8:G17/A6:F52+H6:O52 vs H8:K17/G/P/Q/R FORMULA verbatim, fecha native DATE La_Paz audit-only, PKs fecha+turno+maquina/lado and fecha+turno+lote_id→row{6..52} last-wins, ≤10/≤47 caps, headers A:Q 17/A:X 24 frozen. |

**Mechanical Copy Contract — verbatim `diff -r` evidence (MUST be empty)**:

```text
=== Domain yarn-inventory-recording ===
Source: openspec/changes/yarn-inventory/specs/yarn-inventory-recording/spec.md Exists=True
TargetDir: openspec/specs/yarn-inventory-recording ExistsBefore=False ExistsAfter=True
Temp: openspec/specs/yarn-inventory-recording/.spec.md.DS71xM
--- diff source vs temp (must be empty) ---
diff exit: 0  (no output — identical)
Moved temp to openspec/specs/yarn-inventory-recording/spec.md
--- diff source vs target (must be empty) ---
diff exit: 0  (no output — identical)
OK yarn-inventory-recording synced — 57 lines (spec v1)
```

Merge note: no existing main spec to preserve — delta IS full spec (new domain `yarn-inventory-recording`). No destructive merge warnings required per `openspec/config.yaml` `rules.archive` (warn before merging destructive deltas) — not applicable. Existing specs (`registro-governance`, `registro-ingest`, `yarn-production-recording`, `yarn-dashboard`, `yarn-mobile-form`, `yarn-shift-persistence`, `coneras-dashboard`, `coneras-production-recording`) untouched — yarn-inventory isolated under `apps-script/yarn-inventory/` per verify-report isolation PASS.

## Archive Contents

Moved via mechanical `git mv` (shell only, never Read→Write), verified by structural readback (archive-report additive-only excluded):

| Artifact | Status | Lines/Notes |
|----------|--------|-------------|
| proposal.md | ✅ | Intent: 2 templates `madejeras A1:K21` + `lotes A1:R1002` → `db_madejeras A:Q 17` + `db_lotes A:X 24` via fecha+turno, input-only, Config SSOT, menu-only lock, PRD v0.2.0 §4–§10, branch yarn-inventory both |
| specs/yarn-inventory-recording/spec.md | ✅ | 5 reqs / 11 scenarios — SSOT boundary, hydrate input-only, validated upsert ≤10/≤47 PKs, void→active, lock observability |
| design.md | ✅ | SSOT frozen Config, input-only persistence, 2 DBs vs 1 union, menu-only 5s+1 retry sequential Todo, fecha native La_Paz audit-only, data flow + interfaces + PK definitions + threats N/A |
| tasks.md | ✅ | 13/13 [x] — Phases 1-4 (1.1–1.3 scaffold SSOT+Errors, 2.1–2.4 Repository/Ingest/Persistence/lock, 3.1–3.3 Menu hydration+fecha, 4.1–4.3 harness 14 tests + COPY guard), suggested work units PR1/PR2/PR3 stacked-to-main |
| apply-progress.md | ✅ | Mode Standard strict_tdd false, delivery auto-chain stacked-to-main, work unit PR3 (Menu 203 + harness 145 + tasks/apply-progress) 348 lines within 400, cumulative 1345 lines PR2 size:exception noted, completed tasks 13/13, evidence Select-String 0 literal/1 audit formatDate/node --check OK, verification notes Config/Repository/Ingest/Persistence/Menu/hydration/fecha/tests isolation |
| verify-report.md | ✅ | PASS WITH WARNINGS 5/5 reqs 11/11 scenarios, build 7/7 exit 0, static guards PASS + 14-test harness defined (Logger pending manual), W1/W2/W3 warnings + S1-S3 suggestions, 0 CRITICAL |
| archive-report.md | ✅ | This file — additive only, excluded from `diff -r` source/destination comparison |

**Mechanical Move Contract — verbatim `diff -r` evidence**:

```text
Source exists: True (openspec/changes/yarn-inventory)
Destination exists: False (openspec/changes/archive/2026-09-10-yarn-inventory) — no collision
Snapshot root: C:\Users\lukas\AppData\Local\Temp/sdd-archive.uOdxKW
Snapshot: cp -R source -> snapshot/source exit: 0
Attempting git mv openspec/changes/yarn-inventory -> openspec/changes/archive/2026-09-10-yarn-inventory
git mv exit: 0
Source removed confirmed (Test-Path source = False)
Destination exists confirmed (True)
--- diff snapshot/source vs destination (MUST be empty) ---
diff exit: 0  (no output — identical)
Archive diff empty - PASS
Snapshot cleanup done
Archive move complete: openspec/changes/yarn-inventory -> openspec/changes/archive/2026-09-10-yarn-inventory
```

Active changes directory no longer contains `yarn-inventory`; `git status` shows `R` renames for all artifacts + new untracked main specs `openspec/specs/yarn-inventory-recording/spec.md` (expected). `docs/inventory/` remains untracked as declared scope.

## Source of Truth Updated

The following specs now reflect the new behavior:

- `openspec/specs/yarn-inventory-recording/spec.md` — Single Config SSOT formula boundary (`C8:G17` / `A6:F52+H6:O52` vs `H8:K17` `H=IF(D>0,C/D,0)` etc / `G/P/Q/R`), Fecha+Turno filter hydration (`B3/F3` `Turno Dia/Tarde/Noche` + `C3/E3` `Dia/Tarde/Noche` fecha native DATE), Explicit Validated Batch Upsert ≤10/≤47 PKs (`yyyy-MM-dd-turno-maquina-lado` / `fecha-turno-lote_id|row6..52` last-wins), Void soft-delete `estado=void`→`active` with `creado` preserved, Concurrency-safe `LockService.getDocumentLock()` 5s+1 retry sequential Todo partial not rolled back, all scoped to `apps-script/yarn-inventory/` `America/La_Paz`.

PRD `docs/yarn-inventory/PRD.md` v0.2.0 remains reference; delta specs promoted verbatim as main spec. No drift.

## Implementation Final State (per explicit facts, outrank snapshots)

- **Files**: `apps-script/yarn-inventory/` 8 files (`appsscript.json` 364 `America/La_Paz` V8, `Config.gs` 10153 frozen `YARN_INVENTORY_CONFIG` SHEETS 5/RANGES 10+FORMULAS/PARTS/HEADERS 17/24/IDX/TURNO/SUP/INV/LIMITS/UIs, `Errors.gs` 1902 `LogError_` never throw `Errors` A:F, `Repository.gs` 2891 `LoadState_/BuildIndex_` batch `getRange(2,1,last-1,w)`, `Ingest.gs` 10920 `ReadMadejeras/LotesSnapshot_` input-only trim/CI `DateKey`/`isInListCI_` eligibility `titulo_base+cabos`/`objetivo_neto`, `Persistence.gs` 22438 `BuildMadejeras/LotesPlan_` PKs `void`→`active` `creado` preserved `actualizado/editado_por` La_Paz only + `guardarMadejeras/Lotes/Todo` single lock idempotent, `Menu.gs` 14700 `onOpen` Inventario 6 items + `yarnInventoryOnEdit` hydration input-only + trigger helper, `tests/yarn-inventory.test.gs` 25836 harness) + `apps-script.json` isolated — build `node --check` 7 files exit 0 (Config/Errors/Repository/Ingest/Persistence/Menu/tests), no file outside `apps-script/yarn-inventory/` changed.
- **Modularization primordial**: `YARN_INVENTORY_CONFIG` SSOT owns all ranges/headers/IDX, 0 literal `getRange("` outside Config verified (`Select-String` 0 hits besides 2 doc comments), input-only `C8:G17` (3,8→7,17) vs `H8:K17` non-overlap and `A6:F52` (6,1,47,6) vs `G6:G52` (6,7,47,1) vs `H6:O52` (6,8,47,8) vs `P/Q/R` verified in `yarnInventoryTestBoundaryNeverPersisted_`, `fecha` native `DATE` via `yarnInventoryDateKey_` `getFullYear/getMonth/getDate` no `formatDate`, audit only `Utilities.formatDate(..., America/La_Paz)` in `Errors.gs:20` via `YARN_INVENTORY_CONFIG.TIMEZONE`, PKs `fecha+turno+maquina+lado` (`Máquina 1..5 × A/B`) and `fecha+turno+lote_id|row6..52` fallback `last-wins` with `⚠️` toast + `void` soft-delete and re-activate without duplication, limits `MADEJERAS_PER_DAY 10` `LOTES_PER_DAY 47` `LOTES_MAX_ROW 52` enforced.
- **Before-archive commits (explicit final-state facts, are final state)**: `71d1aca` docs PRD v0.2.0, `3967150` scaffold SSOT+Errors (PR1 304 lines), `649ee89` Repository+Ingest+Persistence+lock (PR2 693 lines `size:exception` chained), `7af793f` Menu+hydration+tests+harness (PR3 348 lines). Tasks 13/13 across 3 PR slices stacked-to-main on branch `yarn-inventory`.
- **Warnings intentional-with-warnings**: W1 Logger/COPY manual pending before merge (harness defined 14 tests → Logger `14/14` + COPY `1RCupngk5x95ev5N4Zv0veMMbOhz6eH_9Vs44a1txE3s` fill→Guardar→verify; static evidence strong but not GAS runtime — block merge until manual run); W2 PR2 size:exception cohesive but over 400 (Ingest+Persistence+Repository inherent); W3 docs/inventory untracked is declared scope not violation. No CRITICAL issues — archive proceeds per strict-vs-OpenSpec policy (CRITICAL always blocks; non-critical warnings allow intentional-with-warnings, already noted).

## Verification Traceability

- `verify-report` evidence_revision `sha256:2d1b2808f565fb56757beb603ceca3fe93205e831397dd905789311b804c461d`
- `test_command`: `pwsh Select-String getRange formatDate getFullYear guards plus harness inspection yarn-inventory.test.gs 14 tests` exit 0 hash `sha256:473c84e6d1ef467750177ebca3369c522f66c82c439880ca7f9b49b4bf960301`
- `build_command`: `pwsh Copy-Item gs to js plus node --check for 7 files Config Errors Repository Ingest Persistence Menu tests` exit 0 hash `sha256:fc1aa0894fa1e28029630ba8d26aa2f61bb03502d8b1ba098c4f7c5bcf498e52`
- Requirements 5/5 scenarios 11/11 compliant per spec compliance matrix (harness + static batch/formula/lock evidence).
- **Attribution**: per `verify-report` at verification time, harness `14 tests` defined (code inspection — each maps to spec scenarios: `yarnInventoryTestConfigFrozen_`, `yarnInventoryTestHeadersFrozen_`, `yarnInventoryTestBoundaryNeverPersisted_`, `yarnInventoryTestFechaNative_`, `yarnInventoryTestLimits_`, `yarnInventoryTestMadejerasPkAndLimits_`, `yarnInventoryTestLotesPkRowFallbackAndLastWins_`, `yarnInventoryTestVoidSoftDeleteAndReactivate_`, `yarnInventoryTestCreadoPreserved_`, `yarnInventoryTestInvalidBlocksForm_`, `yarnInventoryTestLockExhaustion_`, `yarnInventoryTestHydrationInputOnly_`, `yarnInventoryTestParseHelpers_`, `yarnInventoryTestMenuGuards_` + aliases `yarnInventoryRunTests_/yarnInventoryTest_/yarnTestHelpers_`) — Logger `14/14`pending manual on COPY. Build `node --check` 7/7 exit 0.
- **Observation IDs actually read (hybrid traceability)**: Engram `sdd/yarn-inventory/proposal` #948, `sdd/yarn-inventory/spec` #949, `sdd/yarn-inventory/design` #950, `sdd/yarn-inventory/apply-progress` PR3 final #952 (covers tasks 13/13) + PR2 #951, `sdd/yarn-inventory/verify-report` #954 — recorded per Execution and Persistence Contract Section B/C. Tasks file source `openspec/changes/archive/2026-09-10-yarn-inventory/tasks.md` is filesystem source of truth (13/13 `[x]`, 0 unchecked).
- **Isolation verified**: `apps-script/yarn-inventory/` own `appsscript.json` `America/La_Paz` V8, no shared globals with `attendance-control`/`yarn-production`/`yarn-settings`/`coneras-production`; `grep` productive writes 0 outside yarn-inventory.
- **Duplicate handling**: `lote_id` duplicate last-wins with `⚠️ Lote duplicado` toast + `Errors` `partial_save` logging; empty `lote_id` → `row{6..52}` fallback prevents PK collision.

## Risks / Next Steps

- **Manual COPY required before merge** (W1): On workbook COPY `1RCupngk5x95ev5N4Zv0veMMbOhz6eH_9Vs44a1txE3s` (never prod): Apps Script editor select `yarnInventoryRunTests_` → Run → Logger `14/14 passed`; then PR1 `Re-sincronizar` creates `db_madejeras` A:Q 17 / `db_lotes` A:X 24 / `Errors` A:F with frozen headers + protection; PR2 fill 4 madejera rows + 5 lote rows → `Guardar Madejeras`/`Guardar Lotes`/`Guardar Todo` sequential → verify `A:Q/A:X` batch ≤10/≤47 per `fecha+turno`, `last-wins`, `void`→`active`, `creado` preserved, invalid `⚠️` → `Errors`; PR3 `B3/F3` or `C3/E3` change → inputs cleared `C8:G17`/`A6:F52+H6:O52` then refilled `fecha+turno` active only, formulas `H8:K17`/`G/P/Q/R` untouched and recalc, `Guardar Todo` sequential ≤10+≤47, clearing→`void` re-adding→`active`, lock `⏳→❌` busy→error + `⚠️` invalid → `Errors`. Requires manual execution — static guards alone do not prove GAS runtime.
- **PR2 size:exception acknowledged**: No further split needed; PR3 is cohesive (Menu ↔ hydration ↔ boundary tests) and within 400; next change should keep slices ≤400 where possible.
- **Docs fixture**: Reviewer to confirm `docs/inventory/tenidos.xlsx` + `yarn-inventory.xlsx` and `docs/yarn-inventory/PRD.md` are intended untracked (per PRD §4–§10). `git status` `?? docs/inventory/` is expected, not a scope leak.
- **Suggestions carry-forward** (non-blocking): S1 consider blocking `tipo_orden` invalid CI in Ingest if PRD FR-011 requires; S2 hydration toast Spanish voseo `Selecciona` already matched; S3 `.clasp.json` ignore check to avoid wrong project push.
- **No archiving debt**: 0 unchecked tasks, 0 critical findings, no `reviewGate` blockers. `registro`/`yarn`/`coneras` specs untouched.

## Archive Validation Checklist

- [x] Main specs created correctly (`diff -r` empty, mechanical copy verified via `cp`→`diff`→`mv`→`diff` — see Specs Synced verbatim)
- [x] Change folder moved to archive (`diff -r` empty, `git mv` exit 0, source absent `openspec/changes/yarn-inventory` → `openspec/changes/archive/2026-09-10-yarn-inventory/`)
- [x] Archive contains all artifacts (proposal, specs/yarn-inventory-recording/spec.md, design, tasks, apply-progress, verify-report, archive-report)
- [x] Archived `tasks.md` has no unchecked implementation tasks (13/13 `[x]`, `grep "- [ ]"` 0)
- [x] Active changes directory no longer has this change (`openspec/changes/` now only `archive/`)
- [x] Verbatim `diff -r` readback output included above and is empty (no differences) for both spec sync and archive move
- [x] `apps-script/yarn-inventory` untouched after move; `node --check` still exit 0 (build previously verified, no code outside yarn-inventory changed)
- [x] No CRITICAL verification issues; warnings W1-W3 documented as intentional-with-warnings with explicit final-state facts outranking snapshots
- [x] Hybrid persistence completed — Engram `sdd/yarn-inventory/archive-report` saved with observation IDs #948/#949/#950/#951/#952/#954 cited above, plus filesystem `archive-report.md`

## SDD Cycle Complete

The change has been fully planned, implemented, verified (`pass_with_warnings` 5/5 reqs 11/11 scenarios, 0 critical, 14-test harness defined + manual COPY pending), spec-synced (`yarn-inventory-recording` created), and archived at `openspec/changes/archive/2026-09-10-yarn-inventory/` (hybrid). Ready for the next change.

---
*Teams: sdd-archive | 2026-09-10 | hybrid (filesystem+Engram) | intentional-with-warnings | branch yarn-inventory*
