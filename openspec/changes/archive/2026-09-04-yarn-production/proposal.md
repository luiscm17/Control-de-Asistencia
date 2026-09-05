# Proposal: Yarn Production

## Intent

Turn the live `produccion` sheet into a reusable, date-driven production form with queryable and auditable shift records. Source: `docs/yarn-production/PRD.md` v0.1.0 (§§2–8).

## Scope

### In Scope
- Create the `produccion` database sheet with the fixed A:Q schema and `(fecha, turno)` identity.
- Add an isolated V8 Apps Script module that saves populated `DIA`, `TARDE`, and `NOCHE` rows through one idempotent `Guardar` action.
- Load existing rows or clear process inputs when `G2` changes; add the requested `Produccion` menu and audit fields.

### Out of Scope
- Dashboards, charts, reports, and external integrations.
- Advanced business validation beyond native Sheets date/numeric validation.
- Changes to the attendance-control Apps Script modules or their `Registro` specs.

## Capabilities

### New Capabilities
- `yarn-production-recording`: Date-driven shift production persistence, loading, audit, and concurrency control.

### Modified Capabilities
None. Existing `registro-ingest` and `registro-governance` capabilities remain isolated.

## Approach

Implement `apps-script/yarn-production/` as an independent Apps Script project. Batch-read `G2` and `C6:L8`; under a document lock, normalize empty process values to zero and upsert each populated fixed shift by `fecha-turno`. An edit handler for `G2` batch-loads that date's records or clears `D6:L8`; totals remain sheet formulas and are not stored as rows.

## Alternatives Considered

- **Separate save buttons per shift:** rejected; duplicates UI and violates the single-save workflow.
- **Append-only records:** rejected; corrections would create ambiguous duplicate shifts.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps-script/yarn-production/` | New | Isolated V8 module, menu, save, date-load, locking. |
| Google Sheet `produccion` | Modified | Configure database sheet, validations, and `Guardar` binding. |
| `docs/yarn-production/PRD.md` | Reference | v0.1.0 defines layout and database contract. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Date serialization shifts the key | Med | Normalize all keys/timestamps in `America/La_Paz`; test on a copy. |
| Concurrent saves overwrite a shift | Low | Document lock, 5-second timeout, one retry. |
| Layout drift targets totals | Med | Guard exact `G2` and `C6:L8`; never persist total rows. |

## Rollback Plan

Remove the `Produccion` menu/button binding and disable its trigger. Preserve the `produccion` table unchanged for recovery; restore the sheet copy before deployment if form writes are incorrect.

## Dependencies

- Owner authorization to install and bind the Apps Script project on a copy of the live spreadsheet.

## Success Criteria

- [ ] One save upserts each populated fixed shift without duplicating `(fecha, turno)`.
- [ ] Changing valid `G2` loads saved values or clears only `D6:L8`.
- [ ] Audit fields and `total_producto_terminado` are correct in `America/La_Paz`.
- [ ] Concurrency and invalid/blank-date behavior are verified on a sheet copy.
