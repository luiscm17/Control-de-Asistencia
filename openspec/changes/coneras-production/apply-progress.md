# Apply Progress: Coneras Production

## Mode

Standard. `strict_tdd` is disabled and this repository has no local Apps Script runner.

## Delivery

- Strategy: `auto-chain`, `feature-branch-chain`.
- Work unit: PR 1 foundation, targeting the `coneras-production` tracker branch.
- Boundary: Adds schema/configuration, error evidence, COPY-only setup, and the foundation harness. It does not implement persistence, hydration, edit routing, menus, dashboard, or deployment documentation.
- Rollback: Revert only `apps-script/coneras-production/Config.gs`, `Errors.gs`, `Setup.gs`, and `tests/coneras-production.test.gs`.

## Completed Tasks

- [x] 1.1 Create centralized frozen configuration and schema helpers.
- [x] 1.2 Add La Paz timestamped Errors logging and toast mapping.
- [x] 1.3 Add COPY-only DB/Errors schema setup and form validations without writing native formula cells.
- [x] 1.4 Add the foundation Apps Script harness.

## Work Unit Evidence

| Work unit | Focused test command and exact result | Runtime harness command/scenario and exact result | Rollback boundary |
|---|---|---|---|
| PR 1 foundation | Apps Script editor: run `conerasTestHelpers_` — **not run**: no authenticated Apps Script editor/COPY is available to this executor. The harness contains 4 assertions for frozen headers, timezone, date/ID helpers, and formula boundaries. | Workbook COPY: run `conerasSetup()` — **not run**: no authorized workbook COPY is available. Required before deployment: confirm `db_coneras!A:P` and `Errors!A:F` headers, `E5/G4/C5/I8` validations, and unchanged `E4/H8:H22/H23` formulas. | `apps-script/coneras-production/Config.gs`, `Errors.gs`, `Setup.gs`, and `tests/coneras-production.test.gs` only. |

## Verification Notes

- No npm, npx, pnpm, or local runner was used or required.
- `git diff --check` must be rerun after staging because the new files were initially untracked.
- Setup validates native formulas rather than writing them. This intentionally gives precedence to the explicit never-touch boundary for `E4`, `H8:H22`, and `H23`.

## Remaining Tasks

- [ ] 2.1–2.6 Recording, persistence, edit routing, menu, and related harness cases.
- [ ] 3.1–3.3 Dashboard setup, dashboard harness cases, and authenticated COPY walkthrough.
- [ ] 4.1 COPY-only deployment and manual harness instructions.
