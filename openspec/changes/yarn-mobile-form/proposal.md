# Proposal: Yarn Mobile Form

## Intent

Enable Android Sheets saving without changing the form, database, or desktop workflow.

## Scope

### In Scope
- Add native `M4` checkbox and `N4` `Guardar` label with a touch-friendly row.
- Dispatch `FALSE → TRUE` through an installable trigger to the shared batch upsert.
- Reset only after success; retain checked state after validation or lock failure.
- Preserve per-shift upserts: DIA, TARDE, and NOCHE save independently; only `G2` loads or clears.
- Retain drawing and `Produccion > Guardar` desktop entry points.

### Out of Scope
- New sheets, DB columns, formulas, `HtmlService`, dashboard changes, or schema migration.
- Business validation beyond the existing production-recording contract.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `yarn-production-recording`: add a native mobile save entry point while preserving its date/shift batch-upsert, validation, audit, and concurrency requirements.

## Approach

Configure M4/N4 during setup. A narrow installable dispatcher ignores resets and rapid re-entry, then calls `guardarProduccion` as the common save path. `G2` remains the only load/clear trigger. Verify drawing assignment and placement on a copy.

## Alternatives

- Two checkboxes: rejected; adds state ambiguity.
- Auto-save: rejected; writes partial shifts without explicit intent.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `apps-script/yarn-production/Form.gs` | Modified | Dispatcher and guards. |
| `apps-script/yarn-production/Menu.gs` | Modified | Shared save path. |
| `apps-script/yarn-production/Setup.gs` | Modified | Checkbox, label, trigger setup. |
| `apps-script/yarn-production/Config.gs` | Modified | M4/N4 constants. |
| `produccion` sheet | Modified | Native checkbox and label only. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Checkbox reset re-enters handler | Medium | Process only `FALSE → TRUE`; ignore resets; debounce. |
| Drawing conflicts with M4 | Medium | Verify anchor and assignment on copy. |
| Trigger authorization | Medium | Reconcile one installable trigger; test as owner. |
| Mobile viewport | Low | Size, contrast, and verify on Android copy. |

## Rollback Plan

Remove the trigger and checkbox configuration; retain drawing and menu. No data rollback: A:Q and upsert behavior are unchanged.

## Dependencies

- Existing `guardarProduccion`, lock/upsert flow, and `America/La_Paz` configuration.
- Authorized installable Apps Script trigger; verification on a spreadsheet copy only.

## Success Criteria

- [ ] Android checkbox upserts populated shifts independently by `(fecha, turno)` with validation, lock, and audit fields.
- [ ] Success clears M4; failure leaves it checked with no unintended write.
- [ ] G2 alone loads/clears; later shifts retain earlier saved shifts.
- [ ] Menu and drawing retain identical desktop save behavior; no schema, geometry, dashboard, or `HtmlService` regression.
