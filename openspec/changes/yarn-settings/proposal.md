# Proposal: Yarn Settings

## Intent

Replace daily twisting templates with one date-driven `Settings` form and queryable, auditable planning and weighing records. Source: `docs/yarn-settings/PRD-yarn-settings.md` v0.1.0 (§§4–10).

## Scope

### In Scope
- Create an isolated Apps Script module for explicit shift saving from `Settings` to two DB sheets.
- Upsert assignments (maximum 10/day) and variable weighings (0–80/day), including deletion when a previously saved weighing's gross weight is cleared.
- Validate business data, compute and persist net weight, audit the last editor, serialize saves, and expose the `Yarn` menu.

### Out of Scope
- Changes to `apps-script/attendance-control/`, attendance sheets, or `Registro`.
- Persistence for calculator `E10:H24`, summary `L33:P42`, multi-shift UX, hardware, alerts, imports, or an undo UI.

## Capabilities

### New Capabilities
- `yarn-shift-persistence`: Explicit, auditable persistence of `Settings` assignments and weighings into the Yarn DB sheets.

### Modified Capabilities
None.

## Approach

Implement only under `apps-script/yarn-settings/`, using modular V8 `.gs` files, built-in Apps Script services, batch reads/writes, and `America/La_Paz`. `guardarTurno()` validates `F4`, standards/titles, and numeric input; acquires `LockService.getDocumentLock()` for 5 seconds with one retry; then upserts the frozen DB schemas while preserving `creado` and refreshing `actualizado`, `editado_por`, and `rango_origen`. It computes `peso_neto = bruto - (usos * cono + tacho)` rounded to two decimals. Log failures to `Errors`; show count/kg toasts and optional post-save clearing.

**Alternative rejected:** per-cell `onEdit` auto-save would capture partial weighings, increase execution/quota pressure, and make controlled deletion harder. The button/menu save is the explicit shift-close boundary.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `apps-script/yarn-settings/` | New | Isolated Yarn configuration, validation, persistence, menu, and error logging modules. |
| `docs/yarn-settings/PRD-yarn-settings.md` | Reference | v0.1.0 field/range and frozen DB-schema source. |
| `apps-script/attendance-control/` | None | Pattern reference only; no shared code or edits. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Duplicate or lost concurrent saves | Med | Document lock, retry once, idempotent PK upserts. |
| Partial/invalid form data | Med | Validate before writes; skip/delete weighings only per explicit gross-weight rule; log errors. |
| Module cross-contamination | Low | Restrict all new code to `apps-script/yarn-settings/`; do not share globals with attendance. |
| Incorrect dates/audit timestamps | Low | Require Sheets `DATE` at `F4`; format timestamps in `America/La_Paz`. |

## Rollback Plan

Remove the `Yarn` menu/module deployment and retain DB sheets unchanged for audit. Because writes are idempotent and source ranges are stored, restore a sheet-copy/version-history snapshot or delete only rows created by the affected deployment after review.

## Dependencies

- A copy of the four-sheet Yarn workbook for authorization and verification.
- `Settings`, `DB_Asignaciones`, `DB_Descargas`, and `Errors` names and frozen header order from the PRD.

## Success Criteria

- [ ] A valid explicit save creates or updates at most 10 assignment and 80 weighing rows for one date, without duplicate PKs.
- [ ] Clearing a saved weighing's `peso_bruto` and saving removes only that weighing row.
- [ ] Each persisted row has correct net weight, source range, timestamps, and last-editor audit.
- [ ] Invalid input, lock exhaustion, and save failures produce a toast plus `Errors` evidence; no partial writes occur.
- [ ] No file outside `apps-script/yarn-settings/` is changed by implementation.
