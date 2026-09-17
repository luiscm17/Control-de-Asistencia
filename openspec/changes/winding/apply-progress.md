# Apply Progress: Winding Shift Persistence

## Slice

- Delivery strategy: auto-chain
- Chain strategy: feature-branch-chain
- Current slice: PR 3 of 3 — Workflow and Safe Recovery
- Branch: `sdd/winding`
- Mode: Standard (strict TDD inactive; no repository test runner)

## Completed Tasks

- [x] 1.1 Create the V8 `America/La_Paz` Apps Script manifest.
- [x] 1.2 Create frozen configuration for the 26-column DB, Errors table, form geometry, and setup constants.
- [x] 1.3 Create the manual RED helper-seam harness.
- [x] 1.4 Create idempotent setup for schema validation, protection, validations, and one installable edit trigger.
- [x] 2.1 Create batch snapshot capture for trusted native dates, normalized identity, displayed E snapshots, row eligibility, zero-filled operators, and error evidence.
- [x] 2.2 Extend the manual helper harness with invalid-key, duplicate-ID, lock-timeout, idempotent-upsert, and no-implicit-delete seams.
- [x] 2.3 Create locked, read-once indexed repository upsert with La Paz audit, editor fallback, and frozen Errors appends.
- [x] 3.1 Extend the manual helper harness with FALSE→TRUE-only routing, guarded recovery, E-exclusion, supervisor restore, and corrective-delete confirmation seams.
- [x] 3.2 Create the Winding menu, installable checkbox routing with finally-reset, and confirmed corrective delete with audit evidence.
- [x] 3.3 Create menu-first and guarded recovery with read-once lookup, B:D/F:T-only writes, L4 restore, and populated-zone toast.

## Work Unit Evidence

| Evidence | Exact result |
|---|---|
| Focused static command | `python3 -m json.tool apps-script/winding/appsscript.json`; `git show HEAD:apps-script/winding/{Config,Setup,tests/Winding.test}.gs \| node --check --input-type=commonjs`; `git diff --check main...HEAD` — exit 0. |
| Static header/shape check | `git diff --stat main...HEAD` — 4 files changed, 284 insertions; `Config.gs` declares 26 DB headers with indexes `0..25`, and recovery contracts remain unimplemented RED seams. |
| Runtime harness | COPY-only `windingTestHelpers_` in the Apps Script editor — not executed locally because Apps Script cannot run in this workspace. Phase-3-only residual runtime verification remains; human must run it on a COPY. |
| Rollback boundary | Revert commits `3c68590`, `ecb356b`, `da58e0e`, and `9d3f430` to remove only `apps-script/winding/`; no sibling Apps Script project was changed. |

### PR 2 — Snapshot and Persistence

| Evidence | Exact result |
|---|---|
| Focused static command | `git show :apps-script/winding/Config.gs :apps-script/winding/Snapshot.gs :apps-script/winding/Repository.gs :apps-script/winding/tests/Winding.test.gs \| node --check --input-type=commonjs` — exit 0. |
| Focused helper-seam command | Node VM loading the staged four GAS files and running `windingTestHelpers_` with a La Paz `Utilities.formatDate` stub — `manual-harness-pure-seams passed=12 failed=0`, exit 0. This is a local pure-helper surrogate, not an Apps Script execution. |
| Runtime harness | COPY-only `windingTestHelpers_`, save/re-save, and Errors inspection in the Apps Script editor — not executed in this workspace. Apps Script runtime access is unavailable locally; no runtime result is claimed. |
| Rollback boundary | Revert `32f9cd8` to remove only `Snapshot.gs`, `Repository.gs`, and the Phase 2 helper seams; it retains prior schema/setup and any DB rows already created on a COPY. |

### PR 3 — Workflow and Safe Recovery

| Evidence | Exact result |
|---|---|
| Focused test command | Node VM loading `Config.gs`, `Snapshot.gs`, `Repository.gs`, `Menu.gs`, and `tests/Winding.test.gs`, then running `windingTestHelpers_` with a La Paz `Utilities.formatDate` stub — `manual-harness-pure-seams passed=20 failed=0`, exit 0. |
| Runtime harness | COPY-only `windingTestHelpers_`, setup, save/re-save, recovery, guarded automatic recovery, and corrective delete — **not executed** in this workspace because Apps Script runtime access is unavailable locally. Task 3.4 remains the human COPY runbook. |
| Rollback boundary | Revert the Slice 3 code commit only to remove `Menu.gs`, recovery/delete repository helpers, and Phase 3 helper seams; it does not alter sibling Apps Script projects or clear DB/audit rows. |

## Commits

- `3c68590` — `chore(winding): add Apps Script manifest`
- `ecb356b` — `feat(winding): add frozen persistence configuration`
- `da58e0e` — `test(winding): add red helper seam harness`
- `9d3f430` — `feat(winding): add idempotent setup and trigger reconciliation`
- `32f9cd8` — `feat(winding): persist validated shift snapshots`
- `17b8d53` — `docs(winding): record snapshot persistence progress`
- `37c6637` — `feat(winding): add safe recovery workflow`

## Remaining Tasks

- [ ] 3.4 Run the COPY-only Apps Script verification workflow.
- [ ] Phase 4 — Copy-only Rollout Verification

## Human COPY Verification Pending

1. Open a COPY of `ctrl_embolsado` in Apps Script and add this isolated project.
2. Run `windingSetup`, authorize it, and inspect the manifest timezone, frozen/protected headers, form formulas, rows 10–11/29, validations, and exactly one `windingOnEdit` trigger.
3. Run `windingTestHelpers_`; inspect all `✅/❌` Logger lines after deploying this slice.
4. Verify exactly one `windingOnEdit` trigger; change `M4` from `FALSE` to `TRUE` for a valid and invalid save and confirm it always resets to `FALSE`.
5. Use `Winding > Recuperar turno` and confirm recovery writes only `B:D` and `F:T`, preserves `E12:E23` formulas/display values, restores `L4`, and emits the menu-recovery toast when a key edit finds populated `B12:T23`.
6. Use `Winding > Correcciones > Eliminar registro…`; confirm the exact ID prompt, deletion audit in `Errors`, and retained unrelated rows.
