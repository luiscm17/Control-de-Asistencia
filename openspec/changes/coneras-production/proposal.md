# Proposal: Coneras Production

## Intent

Deliver one reusable `conera` form for up to 15 unloads per date, shift, and machine. Explicit saves persist auditable records in `db_coneras`; `dashboard` reads them through native `QUERY` formulas, with failures recorded in `Errors`.

## Scope

### In Scope
- Create the isolated `apps-script/coneras-production/` Apps Script modules: `Config.gs`, `Core.gs`, `Persistence.gs`, `Ingest.gs`, `Menu.gs`, and `Errors.gs`.
- Batch upsert/delete-guard `db_coneras` records by `(fecha, turno, maquina, descarga_nro)`, capturing formula-produced `peso_neto` from `H`.
- Auto-hydrate `B8:G22` and supervisor when `E5`, `G4`, or `C5` changes; provide menu and `I8` checkbox save paths.
- Configure the read-only `dashboard` with direct `QUERY` aggregation and `Fecha`/`Semana`/`Mes` period behavior.

### Out of Scope
- Manual Sheet configuration, production-sheet edits, external dashboards, imports, or per-cell auto-save.
- Any change outside `apps-script/coneras-production/*.gs`; verification runs on a spreadsheet COPY only.

## Capabilities

### New Capabilities
- `coneras-production-recording`: Reusable form hydration and explicit, auditable unload persistence.
- `coneras-dashboard`: Native-`QUERY` read-only production aggregation and period-aware charts.

### Modified Capabilities
None.

## Approach

Use configuration-bound ranges and an installable edit handler. Validate metadata, filter hydration by `fecha` before `turno` and `maquina`, then read/write batches under one document lock (5 seconds plus one retry). Never write formula cells: `E4`, `H8:H22`, or `H23`; only capture the computed `H` value for DB column `L`. Set formulas verbatim in `es-BO`; dashboard remains formula-driven with no runtime write path.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `apps-script/coneras-production/Config.gs` | New | Frozen ranges, schema, locale, timezone, validations |
| `apps-script/coneras-production/Core.gs` | New | Setup, triggers, hydration, shared helpers |
| `apps-script/coneras-production/Persistence.gs` | New | Locked batch upsert, deletion guard, audit fields |
| `apps-script/coneras-production/Ingest.gs` | New | Checkbox and selector edit routing |
| `apps-script/coneras-production/Menu.gs` | New | `Coneras` save, DB view, re-sync actions |
| `apps-script/coneras-production/Errors.gs` | New | Failure logging and user feedback |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Formula cells overwritten | Med | Restrict writes to configured inputs; regression checks |
| Incorrect hydration match | Med | Filter date first, then shift and machine |
| Lock contention | Low | One batch lock, retry once, log and re-sync guidance |
| Incorrect period semantics | Med | Test `Fecha`, rolling `Semana`, and current `Mes` independently |

## Rollback Plan

Remove the deployed `coneras-production` script/trigger from the COPY, restore the prior workbook version, and retain `db_coneras` untouched for recovery. Do not deploy to production until COPY verification passes.

## Dependencies

- PRD v0.1.0 and a user-provided spreadsheet COPY with `conera`, `db_coneras`, `dashboard`, and `Errors`.

## Success Criteria

- [ ] A valid checkbox/menu save batch upserts 0–15 records without duplicate PKs and resets `I8` for mobile reuse.
- [ ] Hydration restores the selected date/shift/machine without modifying native formula cells.
- [ ] Dashboard `QUERY` correctly applies `Fecha`, `Semana`, and `Mes` while remaining read-only.
