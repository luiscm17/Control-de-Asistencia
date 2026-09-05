# Apply Progress: Yarn Settings

## Mode

Standard. Strict TDD is disabled because the project has no Apps Script test runner.

## Completed Tasks

- [x] 1.1 Create the Yarn Settings manifest and frozen configuration.
- [x] 1.2 Configure idempotent DB/Errors schemas, headers, `F4`, Standards dropdown, and native `K2` checkbox.
- [x] 1.3 RED: add invalid metadata, empty-form, helper exclusion, and numeric validation tests.
- [x] 1.4 GREEN: batch-read and build immutable Settings assignment/weighing snapshots.
- [x] 2.1 RED: add persistence tests for re-save, null-tare rounding, zero weighings, EC-03 deletion, rollback, and unknown editor fallback.
- [x] 2.2 GREEN: add indexed assignment/weighing mutation plans with frozen-PK upserts/deletes, preserved `creado`, refreshed audit/source fields, and Script-computed rounded net weights.
- [x] 2.3 Add compensating rollback, best-effort `Errors` evidence, and `unknown` editor fallback.
- [x] 3.1 RED: add lock retry, pre-validation zero-write, and injected-write rollback tests.
- [x] 3.2 GREEN: add public `guardarTurno()` validation, serialized persistence, flush, and feedback orchestration.
- [x] 3.3 Add Yarn menu, K2 setup/installed edit handler, and automatic checkbox reset.
- [x] 4.2 Document COPY-only deployment, binding, schema, re-sync, and rollback.

## RED → GREEN Evidence

| Task | RED | GREEN | Result |
|---|---|---|---|
| 1.3–1.4 | `node -e "... yarnRunIngestTests_()"` before `Ingest.gs` exited 1 with `ReferenceError: yarnBuildShiftSnapshot_ is not defined`. | The same VM harness after `Config.gs` and `Ingest.gs` exited 0: `6 Ingest tests passed.` | Passed |
| 2.1–2.3 | VM persistence harness before `Persistence.gs` exited 1 with `ReferenceError: yarnBuildPersistencePlan_ is not defined`. | Full VM harness after `Errors.gs` and `Persistence.gs` exited 0: `6 Ingest tests passed.` and `6 Persistence tests passed.` | Passed |
| 3.1–3.3 | VM Core harness before `Core.gs` existed exited 1 with `ReferenceError: guardarTurno is not defined`. | Full VM harness after `Core.gs`, `Menu.gs`, and their tests exited 0: `6 Ingest tests passed.`, `6 Persistence tests passed.`, `3 Core tests passed.`, and `4 Menu tests passed.` | Passed |

## Work Unit Evidence

| Work unit | Focused test command and exact result | Runtime harness command/scenario and exact result | Rollback boundary |
|---|---|---|---|
| PR 1 — Foundation and Snapshot | VM harness for `Config.gs`, `Ingest.gs`, and `Ingest.test.gs` → exit 0, `6 Ingest tests passed.` | N/A: no authorized workbook COPY deployment/binding was provided; no live or production sheet was changed. | Revert `apps-script/yarn-settings/{appsscript.json,Config.gs,Ingest.gs,tests/Ingest.test.gs}` and Phase 1 checkboxes. |
| PR 2 — Atomic Persistence | VM harness for Config/Ingest/Errors/Persistence tests → exit 0, `6 Ingest tests passed.` and `6 Persistence tests passed.` | N/A: COPY seed/update/EC-03 integration is assigned to task 4.1; no live or production sheet was changed. | Revert `apps-script/yarn-settings/{Persistence.gs,Errors.gs,tests/Persistence.test.gs}` and Phase 2 checkboxes. |
| PR 3 — Save UX and documentation | `node -e "const fs=require('fs'),vm=require('vm'); const ctx={}; vm.createContext(ctx); ['apps-script/yarn-settings/Config.gs','apps-script/yarn-settings/Ingest.gs','apps-script/yarn-settings/Persistence.gs','apps-script/yarn-settings/Errors.gs','apps-script/yarn-settings/Core.gs','apps-script/yarn-settings/Menu.gs','apps-script/yarn-settings/tests/Ingest.test.gs','apps-script/yarn-settings/tests/Persistence.test.gs','apps-script/yarn-settings/tests/Core.test.gs','apps-script/yarn-settings/tests/Menu.test.gs'].forEach(path=>vm.runInContext(fs.readFileSync(path,'utf8'),ctx,{filename:path})); console.log(ctx.yarnRunIngestTests_()); console.log(ctx.yarnRunPersistenceTests_()); console.log(ctx.yarnRunCoreTests_()); console.log(ctx.yarnRunMenuTests_());"` → exit 0, `6 Ingest tests passed.`, `6 Persistence tests passed.`, `3 Core tests passed.`, `4 Menu tests passed.`; syntax check of Core/Menu/tests → exit 0, no output. | N/A: authenticated COPY deployment is intentionally deferred to task 4.1 / `sdd-verify`; no live or production sheet was changed. | Revert `apps-script/yarn-settings/{Core.gs,Menu.gs,README.md,tests/Core.test.gs,tests/Menu.test.gs}` and the four PR 3 checkboxes; this removes only save UX, K2 behavior, and its documentation. |

## Delivery Boundary

- Strategy: `auto-chain`, `stacked-to-main`.
- Work unit: PR 3 — Save Flow and UX plus deployment documentation (tasks 3.1–3.3 and 4.2), stacked on PR 2 commit `778e1fe`.
- Authored footprint: 359 changed lines (343 additions + 16 deletions), within the 400-line review budget.

## Remaining Tasks

- [ ] 4.1 Verify deployed `apps-script/yarn-settings/` (read-only) on an authenticated COPY: save/re-save, 0–80 rows, EC-03, lock/failure `Errors`, formulas, and isolation.
