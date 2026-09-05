# Apply Progress: Yarn Settings

## Mode

Standard. Strict TDD is disabled because the project has no Apps Script test runner; task 1.3 still followed an explicit RED → GREEN cycle.

## Completed Tasks

- [x] 1.1 Create the Yarn Settings manifest and frozen configuration.
- [x] 1.2 Configure idempotent DB/Errors schemas, headers, `F4`, Standards dropdown, and native `K2` checkbox.
- [x] 1.3 RED: add invalid metadata, empty-form, helper exclusion, and numeric validation tests.
- [x] 1.4 GREEN: batch-read and build immutable Settings assignment/weighing snapshots.

## RED → GREEN Evidence

| Task | RED | GREEN | Result |
|---|---|---|---|
| 1.3–1.4 | `node -e "... yarnRunIngestTests_()"` before `Ingest.gs` exited 1 with `ReferenceError: yarnBuildShiftSnapshot_ is not defined`. | The same VM harness after `Config.gs` and `Ingest.gs` exited 0: `6 Ingest tests passed.` | Passed |

## Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node -e "const fs=require('fs'),vm=require('vm'); const ctx={}; vm.createContext(ctx); ['apps-script/yarn-settings/Config.gs','apps-script/yarn-settings/Ingest.gs','apps-script/yarn-settings/tests/Ingest.test.gs'].forEach(path=>vm.runInContext(fs.readFileSync(path,'utf8'),ctx,{filename:path})); console.log(ctx.yarnRunIngestTests_());"` → exit 0, `6 Ingest tests passed.` |
| Syntax command and exact result | `node --check < apps-script/yarn-settings/Config.gs && node --check < apps-script/yarn-settings/Ingest.gs && node --check < apps-script/yarn-settings/tests/Ingest.test.gs` → exit 0, no output. Node v24 does not accept `.gs` path arguments, so stdin is required. |
| Runtime harness command/scenario and exact result | N/A for this source-only work unit: no authorized workbook COPY deployment/binding was provided, and COPY execution is assigned to task 4.1. No live or production sheet was changed. |
| Rollback boundary | Revert `apps-script/yarn-settings/{appsscript.json,Config.gs,Ingest.gs,tests/Ingest.test.gs}` and the four Phase 1 checkboxes; no attendance-control file or spreadsheet was modified. |

## Delivery Boundary

- Strategy: `auto-chain`, `stacked-to-main`.
- Work unit: PR 1 — Foundation and Snapshot (tasks 1.1–1.4 only).
- Authored source/test/manifest footprint: 425 added lines. The cohesive PR 1 unit exceeds the 400-line budget by 25 lines; preserve its tests and configuration together and label the PR `size:exception` rather than compressing code.

## Remaining Tasks

- [ ] 2.1–2.3 Atomic persistence, rollback, and error evidence (PR 2).
- [ ] 3.1–3.3 Save flow, menu, K2 `onEdit`, auto-uncheck, and lock retry (PR 3).
- [ ] 4.1–4.2 COPY verification and deployment documentation (PR 3).
