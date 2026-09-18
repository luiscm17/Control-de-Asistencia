# Tasks: Winding Shift Persistence

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 700–900 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain | (user-selected; supersedes the stacked-to-main suggestion) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain (user-selected)
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Schema, config, setup, harness | PR 1 | Run `windingTestHelpers_` | COPY: run setup; inspect headers, freezes, validations, one trigger | Revert config/setup/manifest only |
| 2 | Snapshot and locked repository | PR 2 | Run `windingTestHelpers_` | COPY: save/re-save; inspect DB, audit and `Errors` | Revert capture/repository only; retain rows |
| 3 | Menu, recovery, correction wiring | PR 3 | Run `windingTestHelpers_` | COPY: recover/delete and inspect E formulas/toasts | Disable trigger/menu and revert Menu |

## Phase 1: Foundation and Harness

- [x] 1.1 Create `apps-script/winding/appsscript.json` with V8 and `America/La_Paz`; verify project settings on a COPY.
- [x] 1.2 Create `apps-script/winding/Config.gs` with frozen DB/Errors headers, 26-column indexes, form geometry, and validation constants.
- [x] 1.3 Create `apps-script/winding/tests/Winding.test.gs` with failing helper seams for native-date keys, trim/case/`|`, eligibility, zero-fill, and E-excluded ranges.
- [x] 1.4 Create `apps-script/winding/Setup.gs` to validate header drift, freeze/protect row 1, preserve formulas/rows 10–11/29, and reconcile exactly one installable `windingOnEdit`; verify with `windingTestHelpers_` Logger `✅/❌` on a COPY.

## Phase 2: Snapshot and Persistence

- [x] 2.1 Create `apps-script/winding/Snapshot.gs` to batch-capture H4/J4/L4 and A12:T23, trust native H4, omit incomplete rows, snapshot displayed E, and convert F:T blanks/non-numerics to 0 with error evidence.
- [x] 2.2 Extend `apps-script/winding/tests/Winding.test.gs` with RED seams for invalid keys, delimiter rejection, duplicate DB IDs, lock timeout/no write, idempotent upsert, and no implicit deletion.
- [x] 2.3 Create `apps-script/winding/Repository.gs` with read-once indexing, 5s-plus-retry document lock, batched upsert, America/La_Paz audit, editor fallback, and frozen `Errors` append; verify save/re-save, header freeze, and error evidence on a COPY.

## Phase 3: Workflow and Safe Recovery

- [x] 3.1 Extend `apps-script/winding/tests/Winding.test.gs` with RED seams for FALSE→TRUE-only routing/reset-on-failure, guarded auto-recovery, E exclusion, supervisor restore, and confirmed corrective delete.
- [x] 3.2 Create `apps-script/winding/Menu.gs` with `Winding` save/recover actions, `windingOnEdit` finally-reset of M4, and Correcciones deletion prompt/ID confirmation/audit.
- [x] 3.3 Add menu-first and guarded recovery orchestration in `apps-script/winding/Menu.gs`: read once, write only B:D/F:T, restore L4, and toast when populated B12:T23 blocks auto-recovery.
- [ ] 3.4 Run `windingTestHelpers_` in the Apps Script editor on a COPY; verify Logger `✅/❌`, one trigger, M4 reset, recovery E-exclusion/formula preservation, guarded-auto-recovery toast, and delete audit.

## Phase 4: Copy-only Rollout Verification

- [ ] 4.1 Inspect E12:E23 formulas/displayed values and log title coverage/formula consistency via `apps-script/winding/tests/Winding.test.gs`; block setup/deployment on mismatch.
- [ ] 4.2 On a COPY, run `windingSetup`, authorize it, then save, re-save, recover, and delete; inspect `db_embolsado`, `Errors`, formulas, toasts, and rollback by disabling the trigger/menu.
