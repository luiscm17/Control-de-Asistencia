# Tasks: Yarn Production

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 550–700 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Setup → form/load → persistence/menu/verification |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Isolated configuration and safe sheet setup | PR 1 | Manual helper harness in Apps Script editor | Copy: run setup; inspect `datos_produccion!A:Q` and validations | `Config.gs`, `Setup.gs`, setup-created data tab |
| 2 | Date navigation and protected form boundary | PR 2 | Manual helper harness in Apps Script editor | Copy: edit `produccion!G2`; inspect `D6:L8`, labels, formulas | `Form.gs` load/clear behavior |
| 3 | Locked upsert, menu, and copy verification | PR 3 | Manual helper harness in Apps Script editor | Copy: save DIA/NOCHE, update TARDE, exercise lock failure | `Repository.gs`, `Menu.gs`, menu/button binding |

## Phase 1: Isolated Setup

- [x] 1.1 Create `apps-script/yarn-production/Config.gs` with `produccion`, `datos_produccion`, `G2`, `C6:L8`, A:Q headers, fixed shifts, and `America/La_Paz` constants.
- [x] 1.2 Create `apps-script/yarn-production/Setup.gs` to create/validate `datos_produccion!A:Q`, apply `G2` date and `D6:L8` nonnegative-number validation, and protect fixed labels/totals.
- [x] 1.3 In `apps-script/yarn-production/Setup.gs`, install native `SUM` formulas in `C9:L9`/`C10:L10` only when absent; never alter `C6:C8`.

## Phase 2: Form Navigation

- [x] 2.1 Create `apps-script/yarn-production/Form.gs` pure helpers for La Paz date keys, fixed-shift row eligibility, zero filling, totals, and audit-value merging.
- [x] 2.2 Add `onEdit(e)` in `apps-script/yarn-production/Form.gs` to handle only valid single-cell `produccion!G2` edits and load records into `D6:L8`.
- [x] 2.3 Make the no-record path clear only `D6:L8`; blank/invalid dates do nothing, preserving `C6:C8` and formulas in `C9:L10`.

## Phase 3: Persistence and Menu

- [x] 3.1 Create `apps-script/yarn-production/Repository.gs` batched A:Q lookup/index; reject duplicate `yyyy-MM-dd-TURNO` IDs as an integrity error.
- [x] 3.2 Add locked upsert in `apps-script/yarn-production/Repository.gs`: `tryLock(5000)`, one retry, insert/update audit fields, and compute embolsado+ovillado+madejitas.
- [x] 3.3 Create `apps-script/yarn-production/Menu.gs` with `Produccion` menu, public `guardarProduccion`, setup/view/clear actions, success/error toasts, and `SpreadsheetApp.flush()`.
- [x] 3.4 Wire the sole Guardar drawing and menu action to `guardarProduccion`; save eligible DIA/TARDE/NOCHE rows once per `(G2, turno)` and fail safely on lock timeout.

## Phase 4: Copy Verification

- [x] 4.1 On a spreadsheet copy, run setup and verify `registro-produccion`, `produccion`, `datos_produccion`, validations, protected labels, and untouched total formulas.
- [x] 4.2 On the copy, save DIA/NOCHE then correct TARDE; verify A:Q IDs, zero normalization, totals, native dates, and insert/update audit preservation.
- [x] 4.3 On the copy, edit saved/new/blank/invalid `G2` and simulate concurrent saves; verify only `D6:L8` changes and no duplicate date-shift row is written.
