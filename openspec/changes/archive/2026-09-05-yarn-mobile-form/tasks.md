# Tasks: Yarn Mobile Form

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 180–260 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Native mobile save control | Single PR | Run `yarnTestMobileForm_` | Authorized COPY: M4 Android and desktop scenarios | Revert Config/Form/Menu/Setup changes; remove trigger and M4:N4 |

## Phase 1: Config & Setup (Config, Setup)

- [x] 1.1 Add M4/N4, 24 px row height, handler-name, and debounce constants to `apps-script/yarn-production/Config.gs`.
- [x] 1.2 Extend `setupYarnProduction()` in `apps-script/yarn-production/Setup.gs` to idempotently configure/stylize M4:N4 without altering drawings, A:Q, or formulas.
- [x] 1.3 Reconcile exactly one `yarnMobileOnEdit` spreadsheet edit trigger in `apps-script/yarn-production/Setup.gs`; preserve the simple G2 `onEdit`.

## Phase 2: Checkbox UI & Trigger wiring (Form, Menu)

- [x] 2.1 RED: Add synthetic-event assertions in `apps-script/yarn-production/Form.gs` proving non-M4 edits, multi-cell edits, missing metadata, FALSE/reset edits, and concurrent re-entry do not save or reset M4.
- [x] 2.2 Add `yarnMobileOnEdit(e)` in `apps-script/yarn-production/Form.gs` for only `produccion!M4` FALSE→TRUE, with duplicate-execution guard and success-only reset.
- [x] 2.3 RED: Extend `apps-script/yarn-production/Form.gs` harness to expect structured success/failure mapping from `guardarProduccion()`.
- [x] 2.4 Make `guardarProduccion()` in `apps-script/yarn-production/Menu.gs` return `{ok, reason, inserted, updated}` while retaining menu and drawing behavior/toasts.

## Phase 3: Validations & per-shift logic

- [x] 3.1 RED: Add harness cases in `apps-script/yarn-production/Form.gs` for invalid G2, no eligible row, lock failure, DIA/NOCHE with empty TARDE, and existing TARDE update; assert failed checkbox saves retain TRUE and write nothing.
- [x] 3.2 Preserve shared validation, five-second lock retry, America/La_Paz IDs/audit, and independent `(fecha, turno)` upserts in `apps-script/yarn-production/Menu.gs` and `apps-script/yarn-production/Form.gs`.
- [x] 3.3 Confirm `apps-script/yarn-production/Setup.gs` keeps native D6:L8 numeric ≥0 validation and G2-only load/clear boundaries; do not persist labels or totals.

## Phase 4: Verification on COPY (Android + desktop)

- [x] 4.1 Prepare authorized spreadsheet COPY steps for setup, one trigger, M4 checkbox, N4 label, ≥24 px row, and unchanged drawing assignment.
- [x] 4.2 Prepare Android COPY steps for DIA/NOCHE saves with TARDE empty, audit/total checks, success reset, and forced failure retention.
- [x] 4.3 Prepare desktop COPY steps for G2 load/clear and menu/drawing upsert regression checks.
