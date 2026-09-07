# Tasks: Coneras Production

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 700–900 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 foundation → PR 2 recording → PR 3 dashboard/verification |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Schema/config foundation | PR 1 base = feature branch | Apps Script `conerasTestHelpers_` | COPY: run `conerasSetup()` | Remove Config/Errors/Setup |
| 2 | Recording and guarded persistence | PR 2 base = PR 1 branch | Apps Script `conerasTestHelpers_` | COPY: save/hydrate/delete flow | Revert Core/Persistence/Ingest/Menu |
| 3 | Native dashboard and evidence | PR 3 base = PR 2 branch | Apps Script `conerasTestHelpers_` | COPY: QUERY and chart-period walkthrough | Remove dashboard setup/docs |

## Phase 1: Foundation

- [ ] 1.1 Create `apps-script/coneras-production/Config.gs` with frozen centralized sheets, ranges, headers, formulas, timezone, validation values, IDs, and schema helpers.
- [ ] 1.2 Create `apps-script/coneras-production/Errors.gs` for La Paz timestamped `Errors` rows and validation/lock toast mapping.
- [ ] 1.3 Create `apps-script/coneras-production/Setup.gs` to create/protect `db_coneras!A:P`, configure form validations/formulas without writing `E4`, `H8:H22`, or `H23` after setup.
- [ ] 1.4 Add `apps-script/coneras-production/tests/coneras-production.test.gs` harness checks for IDs, date normalization, frozen headers, formulas, and protected write boundaries.

## Phase 2: Recording and Persistence

- [ ] 2.1 Implement `apps-script/coneras-production/Persistence.gs` Map-based 0–15 upsert plan preserving `creado`, refreshing audit fields, and capturing numeric two-decimal net weight.
- [ ] 2.2 Implement `apps-script/coneras-production/Core.gs` snapshot validation, date-first hydration, formula-safe `B8:G22` writes, and single 5s-plus-retry document lock save flow.
- [ ] 2.3 Implement `apps-script/coneras-production/Ingest.gs` installable selector hydration and `I8` FALSE→TRUE save/reset routing; ignore form-cell edits.
- [ ] 2.4 Implement `apps-script/coneras-production/Menu.gs` for save, database view, and re-sync actions.
- [ ] 2.5 Extend `apps-script/coneras-production/tests/coneras-production.test.gs` for invalid selectors/no write, 0/1/15 upsert, resave audit, datetime PK, blank bruto skip, and lock timeout logging.
- [ ] 2.6 Extend `apps-script/coneras-production/tests/coneras-production.test.gs` for delete-guard Continue deletes only listed PKs and Cancel preserves all rows.

## Phase 3: Dashboard and Integration

- [ ] 3.1 Extend `apps-script/coneras-production/Setup.gs` with centralized native `dashboard!E7` QUERY setup, controls, and charts; no dashboard database write path.
- [ ] 3.2 Add dashboard harness cases in `apps-script/coneras-production/tests/coneras-production.test.gs` for Fecha-empty spill, Semana/Mes date ranges, Todos predicate omission, blank title grouping, and formula-safe Meta Real.
- [ ] 3.3 On a workbook COPY, run setup and verify menu/checkbox save, hydrate, delete alert, `E7` spill, and chart visibility across Fecha/Semana/Mes.

## Phase 4: Documentation

- [ ] 4.1 Add COPY-only deployment and manual harness instructions to `apps-script/coneras-production/README.md`, including trigger authorization and rollback.
