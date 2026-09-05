# Tasks: Yarn Settings

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 540–700 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Form/schema snapshot | PR 1 | `node --check apps-script/yarn-settings/{Config,Ingest}.gs` | COPY: validate F4/dropdown and create DB headers | Config/Ingest/tests/manifest |
| 2 | Atomic DB mutations | PR 2 | `node --check apps-script/yarn-settings/{Persistence,Errors}.gs` | COPY: seed, update, and EC-03 delete | Persistence/Errors/tests |
| 3 | Save UX and proof | PR 3 | `node --check apps-script/yarn-settings/{Core,Menu}.gs` | COPY: menu/checkbox, lock retry, toast, rollback | Core/Menu/tests/README |

## Phase 1: Foundation and Snapshot (PR 1)

- [x] 1.1 Create `apps-script/yarn-settings/appsscript.json` and `Config.gs` with V8, `America/La_Paz`, frozen A:M/A:O headers, ranges, limits, and error codes.
- [x] 1.2 In `apps-script/yarn-settings/Config.gs`, add idempotent DB/`Errors` creation, frozen/protected headers, F4 DATE validation, and Standards dropdown.
- [x] 1.3 RED: create `apps-script/yarn-settings/tests/Ingest.test.gs` for invalid F4/title, empty form, excluded helpers, and invalid numeric gross/tare.
- [x] 1.4 GREEN: batch-read `F4`, `B10:C19`, `B33:H42`, and `B50:H157`; build immutable assignments/weighings with valid visible PK metadata only.

## Phase 2: Atomic Persistence (PR 2)

- [ ] 2.1 RED: create `apps-script/yarn-settings/tests/Persistence.test.gs` for re-save, null-tare rounding, 0 rows, and EC-03 single-PK deletion.
- [ ] 2.2 GREEN: in `apps-script/yarn-settings/Persistence.gs`, index both DBs and batch upsert/delete by frozen PKs, preserving `creado` and refreshing audit/source fields.
- [ ] 2.3 Add compensating rollback for affected rows/append boundary and best-effort failure evidence plus `unknown` editor fallback in `apps-script/yarn-settings/Errors.gs`.

## Phase 3: Save Flow and UX (PR 3)

- [ ] 3.1 RED: create `apps-script/yarn-settings/tests/Core.test.gs` for lock retry, pre-validation zero writes, and injected-write rollback.
- [ ] 3.2 GREEN: in `apps-script/yarn-settings/Core.gs`, implement public `guardarTurno()` to validate, lock, apply one plan, flush, toast, and optionally clear input grids.
- [ ] 3.3 Create `apps-script/yarn-settings/Menu.gs` with `Yarn → Guardar Turno` menu and DB navigation/re-sync handlers; create checkbox `Settings!K2` (or `K2:L2` merged) `☑ GUARDAR TURNO` via `dataValidation` checkbox with `onEdit` handler that triggers `guardarTurno()` and auto-unchecks `K2=FALSE` after ~1s on success/failure. No drawing button.

## Phase 4: Verification and Documentation (PR 3)

- [ ] 4.1 Verify deployed `apps-script/yarn-settings/` (read-only) on an authenticated COPY: save/re-save, 0–80 rows, EC-03, lock/failure `Errors`, formulas, and isolation.
- [ ] 4.2 Create `apps-script/yarn-settings/README.md` with COPY-only deployment, OAuth/menu/checkbox binding, DB schema, re-sync, and rollback instructions.
