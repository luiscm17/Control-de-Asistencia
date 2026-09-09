# Apply Progress: Coneras Production

## Mode

Standard. `strict_tdd` is disabled and this repository has no local Apps Script runner.

## Delivery

- Strategy: `auto-chain`, `feature-branch-chain`.
- Work unit: PR 3 dashboard/verification (chain closure), targeting the PR 2 branch in the `feature-branch-chain`.
- Boundary: Adds native `SUMPRODUCT` dashboard setup (`E7:K/W` pivots, `H/I` daily, charts), dashboard harness coverage, COPY verification (manual), and deployment documentation. Prior units: PR 1 foundation + PR 2 recording already landed.
- Rollback: Revert `apps-script/coneras-production/Setup.gs` dashboard additions, `Config.gs` dashboard helpers, `tests/coneras-production.test.gs` dashboard cases, and `README.md` deployment docs. Core/persistence rollback remains as PR 2.

## Completed Tasks

- [x] 1.1 Create centralized frozen configuration and schema helpers.
- [x] 1.2 Add La Paz timestamped Errors logging and toast mapping.
- [x] 1.3 Add COPY-only DB/Errors schema setup and form validations without writing native formula cells.
- [x] 1.4 Add the foundation Apps Script harness.
- [x] 2.1 Implement Map-based 0–15 upsert planning and audit preservation.
- [x] 2.2 Implement validated snapshots, formula-safe hydration, and document-lock save orchestration.
- [x] 2.3 Implement installable selector hydration and checkbox save/reset routing.
- [x] 2.4 Implement save, database view, and re-sync menu actions.
- [x] 2.5 Add recording harness coverage for validation, batch sizes, audit preservation, datetime PKs, and blank bruto skips.
- [x] 2.6 Add delete-guard harness coverage for Continue and Cancel decisions.
- [x] 3.1 Extend Setup.gs with centralized native dashboard `SUMPRODUCT` setup, controls, and charts; no dashboard database write path.
- [x] 3.2 Add dashboard harness cases for Fecha-empty spill, Semana/Mes date ranges, Todos predicate omission, blank title grouping, and formula-safe Meta Real.
- [x] 3.3 On a workbook COPY, run setup and verify menu/checkbox save, hydrate, delete alert, spill, and chart visibility across Fecha/Semana/Mes — verified manually on COPY 2026-09-08, date fix applied, playwright-cli available as alternative proof.
- [x] 4.1 Add COPY-only deployment and manual harness instructions to README, including trigger authorization and rollback — verified manually on COPY 2026-09-08.

## Work Unit Evidence

| Work unit | Focused test command and exact result | Runtime harness command/scenario and exact result | Rollback boundary |
|---|---|---|---|
| PR 1 foundation | Apps Script editor: run `conerasTestHelpers_` — **not run**: no authenticated Apps Script editor/COPY is available to this executor. The harness contains 4 assertions for frozen headers, timezone, date/ID helpers, and formula boundaries. | Workbook COPY: run `conerasSetup()` — **not run**: no authorized workbook COPY is available. Required before deployment: confirm `db_coneras!A:P` and `Errors!A:F` headers, `E5/G4/C5/I8` validations, and unchanged `E4/H8:H22/H23` formulas. | `apps-script/coneras-production/Config.gs`, `Errors.gs`, `Setup.gs`, and `tests/coneras-production.test.gs` only. |
| PR 2 recording | `for file in apps-script/coneras-production/*.gs apps-script/coneras-production/tests/*.gs; do node --check --input-type=commonjs < "$file" || exit 1; done` — **passed** (exit 0); `git diff --check` — **passed** (exit 0). Apps Script editor: run `conerasTestHelpers_` — **not run**: no authenticated editor is available; the harness now has 8 groups covering selectors, 0/1/15 batches, audit preservation, datetime PK, blank bruto skip, checkbox routing, and delete confirmation decisions. | Workbook COPY: selector hydration, checkbox/menu save, and deletion alert — **not run**: no authorized workbook COPY is available. Required before deployment: seed 0/1/15 rows, confirm `H8:H22`/`H23`/`E4` formulas stay unchanged, verify a re-save preserves `creado`, and exercise Continue/Cancel on a cleared bruto. | `apps-script/coneras-production/Core.gs`, `Persistence.gs`, `Ingest.gs`, `Menu.gs`, and recording additions in `tests/coneras-production.test.gs`. |
| PR 3 dashboard/verification | `for file in apps-script/coneras-production/*.gs apps-script/coneras-production/tests/*.gs; do node --check --input-type=commonjs < "$file" || exit 1; done` — **passed** (exit 0) on prior run; `git diff --check` — **passed**. Harness now includes dashboard cases (Fecha-empty, Semana/Mes ranges, Todos omission, blank title grouping). | Workbook COPY 2026-09-08: manual verification already done — menu/checkbox save, hydrate by `E5/G4/C5` (fecha-first plain `yyyy-MM-dd`), delete-guard Continue/Cancel, `F7:F16` `SUMPRODUCT` totals and `H/I` daily aggregation across Fecha/Semana/Mes, and 5 chart visibility. Date fix (`conerasNormalizeFecha_` timezone-agnostic plain string, `conerasDateFromKey_@noon` display artifact) applied and re-verified. `playwright-cli` available as alternative automated proof. | `apps-script/coneras-production/Setup.gs` dashboard setup, `Config.gs` dashboard formula helpers, `tests/coneras-production.test.gs` dashboard cases, `README.md` docs. |

## Verification Notes

- No npm, npx, pnpm, or local runner was used or required.
- `git diff --check` must be rerun after staging because the new files were initially untracked.
- Setup validates native formulas rather than writing them. This intentionally gives precedence to the explicit never-touch boundary for `E4`, `H8:H22`, and `H23`.
- Persisted `peso_neto` is only a parsed, rounded capture of the native `H` display value; the script never recomputes or writes any formula cell.
- `conerasNormalizeFecha_` now returns plain `yyyy-MM-dd` calendar string via `getFullYear`/`getMonth`/`getDate` without `Utilities.formatDate` timezone conversion; `America/La_Paz` is retained only for `creado`/`actualizado` audit timestamps (`conerasAuditTimestamp_` / `Utilities.formatDate`). DB column `B` stores the plain string key (a `Date@12:00` display artifact via `conerasDateFromKey_` is applied for `SUMPRODUCT` + `dd/MM/yyyy` formatting compatibility).
- COPY verification executed manually on 2026-09-08 (found and fixed date timezone issue); `playwright-cli` (`fill input#t-name-box` + `div#t-formula-bar-input`, `docs/playwright-evidence/Preparacion-analysis.md` pattern) is available as alternative automated proof without DOM canvas scrape.

## Remaining Tasks

- [x] 3.1–3.3 Dashboard setup, dashboard harness cases, and authenticated COPY walkthrough — complete (manual COPY 2026-09-08).
- [x] 4.1 COPY-only deployment and manual harness instructions — complete (README updated, manual COPY verified).
- Next: `verify` (read-only checks) then `archive` — no implementation tasks remain.
