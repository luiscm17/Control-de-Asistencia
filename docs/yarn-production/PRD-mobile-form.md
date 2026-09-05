# PRD — Yarn Mobile Form

| Field | Value |
|-------|-------|
| **Version** | 0.1.0 |
| **Date** | 2026-09-05 |
| **Status** | Draft |
| **Related** | `docs/yarn-production/PRD.md`, `docs/yarn-production/PRD-dashboard.md` |

## 1. Purpose

Make the `produccion` form usable on the Android Sheets app. The current save path — a drawing assigned to `guardarProduccion` and a custom menu via `onOpen` — does not fire on Android (drawings are not tappable, custom menus are not rendered). This PRD adds a native, touch-friendly save path that reuses the existing batch upsert logic without changing form geometry, DB schema, or desktop behavior.

## 2. Scope

- Same spreadsheet, same form, same DB as `PRD.md`: `produccion!G2` (`d/M/yyyy`) + `C6:L8` (`DIA/TARDE/NOCHE` × nine processes) → `datos_produccion!A:Q` (PK `(fecha, turno)`, §6 of `PRD.md`).
- Adds one native checkbox as the mobile save control and an installable `onEdit` trigger that delegates to the existing `guardarProduccion` logic.
- Keeps the drawing in `M4` and the `Produccion` menu as desktop fallbacks. No new sheet, no new DB column, no schema migration.

## 3. Definitions

- **Form:** `produccion` — `G2` (date), `C5:L5` (header), `C6:L8` (three shift rows), `C9:L9` + `J10` (native totals, not persisted).
- **DB table:** `datos_produccion!A:Q` — `id, fecha, turno, finisor, retorcido, madejeras, tintoreria, secado, devanado, embolsado, ovillado, madejitas, total_producto_terminado, registrado_por, editado_por, creado, actualizado`. PK `fecha + turno` (`yyyy-MM-dd-TURNO`).
- **Drawing save:** Existing `M4` drawing assigned to `guardarProduccion` (desktop only).
- **Menu save:** Existing `onOpen` custom menu `Produccion > Guardar` (desktop only).
- **Checkbox save:** New native Sheets checkbox in `M4` (or `M4:N4` if `M4` merge requires it) that triggers save via installable `onEdit` — the only path that works on Android.

## 4. Users

- **Operators on Android** — register or correct shift output from the factory floor on the Sheets app.
- **Supervisors on desktop** — continue using drawing or menu; checkbox is an additional option.

## 5. Functional Requirements

### 5.1 Form (unchanged)

- The system SHALL keep the geometry and behavior defined in `PRD.md` FR-001–FR-010: `G2` controls the view, `onEdit` on `G2` loads or clears `D6:L8`, `C6:L8` holds the three shifts, `C9:L9`/`J10` remain calculated and are never persisted.
- The system SHALL NOT change `datos_produccion!A:Q` column order, headers, or types.

### 5.2 Mobile Save via Checkbox

- The system SHALL provide a native Sheets checkbox (Insert > Checkbox) in `produccion!M4` with label `Guardar` in the adjacent cell (`N4` or `L4` if `M4` is merged — label cell to be fixed at setup, never overlapping `C6:L8` or `G2`). The checkbox cell SHALL have row height ≥ 24 px for touch target compliance.
- The checkbox SHALL be `FALSE` (unchecked) in steady state. Checking it (`FALSE → TRUE`) SHALL trigger the save.
- The save SHALL be handled by an **installable** `onEdit(e)` trigger (runs as owner, not a simple trigger) that:
  1. Detects `e.range` is the checkbox cell on sheet `produccion` and `e.value === "TRUE"`.
  2. Delegates to the existing `guardarProduccion` logic — batch upsert over `C6:L8` by `(fecha G2, turno C)`, skipping empty rows and the `TOTAL` row, computing `total_producto_terminado = embolsado + ovillado + madejitas`, applying `LockService.getDocumentLock()` (5 s timeout, one retry), and writing audit fields in `America/La_Paz`.
  3. On success: shows a toast confirmation and resets the checkbox to `FALSE` programmatically.
  4. On validation or lock failure: leaves the checkbox at `TRUE` and shows an error toast so the user can correct data and tap again (retry is unchecking then rechecking, or a second check after fix). The trigger SHALL NOT auto-reset to `FALSE` on failure.
  5. Ignores `TRUE → FALSE` transitions (user unchecking without saving) and debounces rapid double-taps.
- The existing drawing assigned to `guardarProduccion` and the `Produccion` menu SHALL remain and continue to call the same `guardarProduccion` function on desktop. All three entry points SHALL share one code path.

### 5.3 Validations

- The system SHALL reuse all validations from `PRD.md` §7: `G2` empty/invalid → no write (`Seleccione una fecha valida en G2.`); empty process cells → `0`; numeric ranges `>= 0`; `TOTAL` row never persisted.
- The checkbox trigger SHALL NOT bypass any validation that the drawing/menu path enforces.

### 5.4 Compatibility

- The system SHALL keep desktop save working identically after this change (drawing, menu, and checkbox all functional on desktop Chrome).
- The system SHALL NOT require `HtmlService`, sidebars, dialogs, or web-app deployment. The checkbox + installable `onEdit` SHALL be the only new mechanism.

## 6. Data and Formulas

- No new DB columns, no new sheets, no new named ranges. `datos_produccion!A:Q` and `produccion!C6:L8`/`G2` remain the sole data contract.
- No new formulas. The checkbox cell holds a boolean (`TRUE`/`FALSE`) only; its adjacent label is plain text.
- The installable trigger SHALL be created at setup (and re-verified on `onOpen` if missing) — no formula-driven trigger.

## 7. User Interaction

- **Android:** User completes `G2` and one or more rows in `C6:L8`, then taps the `M4` checkbox to save. Toast confirms success and the checkbox clears. On error, toast explains the issue and the checkbox stays checked for retry.
- **Desktop:** User may click the drawing, use `Produccion > Guardar`, or check `M4` — all three produce the same result and confirmation.
- No additional taps, menus, or dialogs are required to save.

## 8. Non-Functional Requirements

- **Compatibility:** Save via checkbox SHALL work on Android Sheets app and desktop Chrome. Viewing or editing the form SHALL not require a custom menu or drawing click on Android. Filter/view of `dashboard` remains zero-script as per `PRD-dashboard.md`.
- **Performance:** Viewing the form or changing `G2` SHALL consume zero Apps Script quota beyond the existing `onEdit` for `G2`. The checkbox trigger SHALL run only when `M4` transitions `FALSE → TRUE`.
- **Locale and Timezone:** Dates SHALL remain `d/M/yyyy` (`es-BO` locale) and all timestamps/window checks SHALL use `America/La_Paz` (`Utilities.formatDate(..., "America/La_Paz", ...)`). No `HtmlService` usage.
- **Accessibility:** Checkbox row height ≥ 24 px, label text ≥ 10 pt, high-contrast border.

## 9. Out of Scope (v1)

- Changes to `datos_produccion` schema, new DB columns, or new sheets.
- Dashboard edits, PDF export, mass clear, or bulk import.
- `HtmlService` UI, web-app, or external integrations.
- Business-rule validation beyond `PRD.md` §7.
- Moving or resizing `C6:L8`, `G2`, or `M4` drawing geometry beyond adding the checkbox/label.

## 10. Acceptance Criteria

- [ ] `produccion!M4` contains a native Sheets checkbox (with label in adjacent cell) sized ≥ 24 px that is tappable on Android Sheets app; row height and label are set up on first install.
- [ ] Checking `M4` (`FALSE → TRUE`) on Android triggers the installable `onEdit` and persists `C6:L8` via the same batch upsert, `LockService`, idempotence by `(fecha, turno)`, and validations as the desktop drawing.
- [ ] On success the checkbox resets to `FALSE` and a toast confirms (e.g., `3 turnos guardados`); on failure it stays `TRUE` with an error toast and no partial reset, allowing retry.
- [ ] Desktop drawing (`M4` assigned to `guardarProduccion`) and `Produccion` menu still save identically; all three entry points share one code path with no regression in `G2` load/clear, numeric validations, audit fields, or concurrency handling.
- [ ] No new `datos_produccion` columns, no `HtmlService` usage, no change to form geometry or `dashboard` behavior.

*End PRD v0.1.0 — yarn-mobile-form. Complement to PRD.md + PRD-dashboard.md.*
