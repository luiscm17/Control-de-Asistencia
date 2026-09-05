# PRD — Yarn Dashboard

| Field | Value |
|-------|-------|
| **Version** | 0.1.0 |
| **Date** | 2026-09-05 |
| **Status** | Draft |
| **Related** | `docs/yarn-production/PRD.md` |

## 1. Purpose

Provide a read-only production dashboard that surfaces cumulative totals and trends from `datos_produccion`, available on desktop and Android without daily Apps Script quota consumption.

## 2. Scope

- New worksheet `dashboard` in the same spreadsheet as `produccion` and `datos_produccion`.
- Ten summary cards (nine process sections + grand total) and three native charts.
- Three interactive filters. No data editing from the dashboard.

## 3. Definitions

- **Data source:** `datos_produccion!A:Q` — `id, fecha, turno, finisor, retorcido, madejeras, tintoreria, secado, devanado, embolsado, ovillado, madejitas, total_producto_terminado, registrado_por, editado_por, creado, actualizado`. `total_producto_terminado = embolsado + ovillado + madejitas`. Primary key `(fecha, turno)` as `yyyy-MM-dd-TURNO`.
- **Form:** `produccion!G2` (`d/M/yyyy`) + `C6:L8` (rows `DIA/TARDE/NOCHE` × nine process columns) + `D9:L9/J10` native totals.

## 4. Users

Operators and supervisors who register production per shift and review cumulative output on desktop or Android.

## 5. Functional Requirements

### 5.1 Worksheet

- The system SHALL provide a worksheet named `dashboard`.
- The worksheet SHALL be read-only; no write path from the dashboard to `datos_produccion`.

### 5.2 Summary Cards

- The dashboard SHALL display ten cards: one per process section (nine) and one grand total.
- Each process card SHALL show the filtered sum of its column in `datos_produccion!D:L`.
- The grand total card SHALL show the filtered sum of `total_producto_terminado` (`M`).
- Each card SHALL display its value with number format `#,##0.00`.

### 5.3 Filters

The dashboard SHALL provide three filters in `dashboard!B1:F1`:

| Filter | Location | Type | Behavior |
|--------|----------|------|----------|
| Date range | `B1:C1` | `d/M/yyyy` inputs | Filters `fecha` (`B`) where `B1 ≤ fecha ≤ C1`. Empty means unbounded. |
| Shift | `E1` | Dropdown `Todos, DIA, TARDE, NOCHE` | When not `Todos`, filters `turno` (`C`). |
| Section focus | `F1` | Dropdown `Todas, finisor, ..., madejitas` | Highlights the corresponding section bar/card; does not filter rows. |

Without filters the dashboard SHALL show the full history up to the latest `fecha`.

### 5.4 Auxiliary Data

- The dashboard SHALL maintain an auxiliary range `dashboard!A10:C200` derived from `datos_produccion` via `QUERY` grouped by `fecha`, with daily `total` and running cumulative total. The range SHALL respect the date and shift filters.

### 5.5 Charts

All charts SHALL be native Sheets charts anchored to `dashboard` and bound to the auxiliary range or filtered sums; they SHALL update automatically when `datos_produccion` changes.

- **G1 — Total by Section (Bar):** X = nine sections, Y = filtered total per section.
- **G2 — Cumulative Over Time (Line):** X = `fecha`, Y1 = daily total, Y2 = cumulative total.
- **G3 — Total by Shift Over Time (Stacked Bar):** X = `fecha`, series = `DIA/TARDE/NOCHE` daily totals.

## 6. Data and Formulas

- Aggregations SHALL use native Sheets functions (`SUM`, `FILTER`, `QUERY`) only.
- The dashboard SHALL NOT invoke Apps Script on view or filter change.

## 7. User Interaction

- Viewing the dashboard SHALL require only switching to the `dashboard` worksheet.
- Filtering SHALL be performed by editing `B1, C1, E1, F1` directly; no custom menu or dialog is required to view or filter.

## 8. Non-Functional Requirements

- **Compatibility:** The dashboard SHALL be fully legible and filterable on Android Sheets app and desktop Chrome without custom menus or HTML dialogs. Filter controls SHALL be touch-target ≥ 24 px.
- **Performance:** Reading or filtering the dashboard SHALL consume zero Apps Script trigger runtime. Setup of the worksheet is one-time.
- **Locale and Timezone:** Dates SHALL be displayed as `d/M/yyyy` and interpreted in `America/La_Paz`.

## 9. Out of Scope (v1)

- Filter by `registrado_por`, PDF export, web-app or `HtmlService` UI, mass clear, or editing from the dashboard.

## 10. Acceptance Criteria

- [ ] `dashboard` worksheet exists with ten cards reflecting `datos_produccion` sums.
- [ ] `B1:C1, E1, F1` filter the cards and all three charts as specified; empty filters show full history.
- [ ] Charts G1, G2, G3 render correctly and update when a new row is added to `datos_produccion`.
- [ ] Dashboard is usable on Android without a custom menu.
