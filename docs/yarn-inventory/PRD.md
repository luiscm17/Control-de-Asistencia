# Yarn Inventory — Product Requirements Document

| Field | Value |
|-------|-------|
| **Version** | 0.2.0 |
| **Date** | 2026-09-11 |
| **Status** | Draft |
| **Source** | Google Sheet `1RCupngk5x95ev5N4Zv0veMMbOhz6eH_9Vs44a1txE3s` — sheets `madejeras`, `lotes` |

## 1. Quick Path

1. **Problem:** Two inventory forms (`madejeras` dashboard + `lotes` weighing) operate as reusable daily templates with formulas computed in the sheet — no queryable database, no audit, no per-shift history. Data is overwritten when the date changes.
2. **Solution:** Keep both sheets as daily entry forms. Persist each into its own database sheet (`db_madejeras`, `db_lotes`) via an explicit save action. Filter for load/re-fill is combined Fecha+Turno — changing either retrieves that shift's rows or clears inputs when none exist. Each database row records who made the last change. Derived values remain as sheet formulas and are never stored.

## 2. Executive Summary

Inventory for the madejera area is captured in two independent forms that share header controls (date, turno, supervisor, inventario) but have unrelated tables.

| Form | Range | Purpose | Rows/day |
|------|-------|---------|----------|
| `madejeras` | `A1:K21` | Automatic dashboard — parameters per machine/side to compute `FACTOR`, `METRAJE EXACTO`, `VUELTAS DE ASPA`, `TIEMPO PARADA` | ≤10 (5 machines × 2 sides) |
| `lotes` | `A1:R1002` | Lot weighing and assembly — per-lot target + 8 weighings to compute `META`, `TOTAL`, `AJUSTE`, `ESTADO` | ≤47 (validated `B6:B52`, dimensioned to 1002) |

| Pain | Impact |
|------|--------|
| Daily templates duplicated per day | Formula drift, repeated maintenance |
| Input sheets serve as both UX and storage | History overwritten on date change |
| No database, no audit of last change | Not traceable who saved |
| Derived values only as cell formulas | Not queryable centrally |
| Two forms, zero database sheets | No reporting per `fecha`/`turno` |

**Solution:** Two reusable form sheets drive `fecha`/`turno`/`supervisor`/`inventario` → explicit save per form (or combined) → `db_madejeras` (≤10 rows/day, PK `fecha,turno,maquina,lado`) + `db_lotes` (≤47 rows/day, PK `fecha,turno,lote_id` with row-index fallback). Only raw inputs are persisted; formulas recalculate automatically when the form is reloaded. Each row stores `actualizado` and `editado_por` for audit.

## 3. Goals / Non-Goals

**Goals v1:** Both forms reusable for all days; every shift closable with one explicit save per form; derived values stay as sheet formulas — database stores only raw inputs and formulas recalculate on re-fill; idempotent upsert per primary key; last editor tracked per row; validation in sheets (date, turno, supervisor lists) plus guard before write; no auto-clear after save (and when clearing, only input cells).

**Non-Goals v1:** Replacing weighing hardware; payroll or HR integration; automatic per-cell persistence; multi-file import; cross-form JOIN in sheets; rewriting dashboard formulas to Spanish locale (keep English as-is).

## 4. Current State Analysis

### 4.1 Sheet Inventory — 5 sheets (2 forms + 2 database targets + log)

| Sheet | Purpose | Type | State |
|-------|---------|------|-------|
| `madejeras` | Input form — automatic dashboard `A1:K21` | Form | Single reusable template (date-driven) — title `A1:K1` merged `DASHBOARD AUTOMÁTICO - CONTROL DE MADEJERA` |
| `lotes` | Input form — lot weighing `A1:R1002` | Form | Single reusable template (date-driven) — title `A1:R1` merged `CONTROL DE INVENTARIO: PESAJE Y ARMADO DE LOTES` |
| `db_madejeras` | Database per machine/side per day | Table | Target database — to create |
| `db_lotes` | Database per lot per day (8 weighings) | Table | Target database — to create |
| `Errors` | Optional log | Table | Observability |

### 4.2 Template Mechanics

#### 4.2.1 `madejeras` — `A1:K21`

| Range | Value / Formula (verbatim, English) | Meaning | Kind |
|-------|--------------------------------------|---------|------|
| `A1:K1` | `DASHBOARD AUTOMÁTICO - CONTROL DE MADEJERA` (merged) | Title | Label |
| `B3` | Date `2026-09-10` — validation `OR(NOT(ISERROR(DATEVALUE(B3))), AND(ISNUMBER(...)))` | Fecha | Input (DATE already formatted in Sheet, stored as-is without timezone conversion; display `yyyy-MM-dd`) |
| `F3` | `Turno Dia` — list `Turno Dia,Turno Tarde,Turno Noche` | Turno | Input (dropdown — part of Fecha+Turno filter) |
| `B4` | `Junior` — list `Junior,Rondi,Pablo` | Supervisor | Input |
| `F4` | `Ricky` — list `Ricky,Benacio,Cojeno` | Inventario | Input |
| `A7:K7` | `MÁQUINA \| LADO \| TÍTULO BASE \| CABOS \| PESO DESEADO (g) \| TAMAÑO ASPA (m) \| VELOCIDAD (m/min) \| FACTOR (m/g) \| METRAJE EXACTO (m) \| VUELTAS DE ASPA \| TIEMPO PARADA (min)` | Headers | Header |
| `A8:A17` | 10 rows — `Máquina 1..5 × Lado A/B` | Machine/Side | Input zone |
| `C8:G8` | `9, 4, 505, 1.73, 250` (example row) | Raw inputs `C..G` | Input — persisted |
| `H8` | `=IF(D8>0,C8/D8,0)` | `FACTOR = TITULO_BASE / CABOS` | Formula — not persisted, not cleared — `H8:K17` |
| `I8` | `=H8*E8` | `METRAJE EXACTO = FACTOR × PESO_DESEADO` | Formula — not persisted, not cleared |
| `J8` | `=IF(F8>0,I8/F8,0)` | `VUELTAS = METRAJE / TAMANO_ASPA` | Formula — not persisted, not cleared |
| `K8` | `=IF(G8>0,I8/G8,0)` | `TIEMPO = METRAJE / VELOCIDAD` | Formula — not persisted, not cleared |
| `A18:K21` | Reserved / empty | — | — |

Input vs formula boundary — `madejeras`: `C8:G17` are raw inputs and the only persisted and cleared range. `H8:K17` are formulas that remain in the sheet and recalculate automatically. When the date changes or the form is cleared, only `C8:G17` is written or cleared; `H8:K17` is never overwritten. Example row 8: `9/4/505/1.73/250 → H=2.25, I=1136.25, J=656.79, K=4.545` (displayed in sheet, not stored).

Formulas use English `IF`. Date display is a native sheet `DATE` type.

#### 4.2.2 `lotes` — `A1:R1002`

| Range | Value / Formula (verbatim, English) | Meaning | Kind |
|-------|--------------------------------------|---------|------|
| `A1:R1` | `CONTROL DE INVENTARIO: PESAJE Y ARMADO DE LOTES` (merged) | Title | Label |
| `C3` | Date `2026-09-10` — same date validation as `madejeras!B3` | Fecha | Input (DATE already formatted in Sheet, stored as-is without timezone conversion) |
| `E3` | `Dia` — list `Dia,Tarde,Noche` | Turno | Input (part of Fecha+Turno filter) |
| `G3` | `Junior` — list `Junior,Rondi,Pablo` | Supervisor | Input |
| `I3` | `Ricky` — list `Ricky,Benacio,Cojeno` | Inventario | Input |
| `A5:R5` | `LOTE (ID) \| TIPO DE ORDEN \| COLOR \| TÍTULO \| OBJETIVO NETO (kg) \| AUMENTO (kg) \| META EN BÁSCULA (kg) \| PESADA 1 \| … \| PESADA 8 \| TOTAL PESADO \| AJUSTE EXACTO \| ESTADO` | Headers | Header |
| `A6:A52` | `LOTE (ID)` free text (e.g. `VERDE BANDERA`) | Lot ID | Input — persisted |
| `B6:B52` | Usable 47 rows — list `Lote,Stock` | Tipo orden | Input zone (validated to 52, dimensioned to 1002) |
| `E6:E52` | List `204,216` (objetivo presets) | Objetivo neto | Input — persisted |
| `G6` | `=IF(E6="","",E6+F6)` | `META = OBJETIVO + AUMENTO` | Formula — not persisted, not cleared — `G6:G52` |
| `P6` | `=IF(E6="","",SUM(H6:O6))` | `TOTAL = SUM(PESADA 1..8)` (`H:O`) | Formula — not persisted, not cleared — `P6:P52` |
| `Q6` | `=IF(E6="","",G6-P6)` | `AJUSTE = META - TOTAL` | Formula — not persisted, not cleared — `Q6:Q52` |
| `R6` | `=IF(E6="","",IF(P6>G6,"EXCEDIDO",IF(P6=G6,"EXACTO","FALTA")))` | `ESTADO` | Formula — not persisted, not cleared — `R6:R52` |

Input vs formula boundary — `lotes`: Only `A6:F52` (`LOTE ID`, `TIPO ORDEN`, `COLOR`, `TÍTULO`, `OBJETIVO`, `AUMENTO`) and `H6:O52` (`PESADA 1..8`) are raw inputs and the only persisted and cleared ranges. `G6:G52`, `P6:P52`, `Q6:Q52`, `R6:R52` are formulas that remain in the sheet and recalculate automatically. Example row 6: `VERDE BANDERA | 2/18 | 216 | 1 → META 217 (G), TOTAL 284.05 (P), AJUSTE -67.05 (Q), ESTADO EXCEDIDO (R)`.

Column mapping: `A=lote_id`, `B=tipo_orden`, `C=color`, `D=titulo`, `E=objetivo_neto`, `F=aumento`, `G=meta` (formula), `H:O=pesada 1..8`, `P=total` (formula), `Q=ajuste` (formula), `R=estado` (formula).

## 5. Proposed Solution Overview

```
madejeras (A1:K21, B3 fecha, F3 turno) ── explicit Save ──▶ db_madejeras (≤10 rows/day, inputs only)
lotes     (A1:R1002, C3 fecha, E3 turno) ── explicit Save ──▶ db_lotes     (≤47 rows/day, inputs only)
                                                            ──▶ Errors (optional log)
```

| Principle | Rationale |
|-----------|-----------|
| 2 forms, 2 database tables | Each form has its own lifecycle; `madejeras` and `lotes` are independent |
| View ≠ storage | Forms are never queried as database; database sheets are the source of truth |
| Denormalize `fecha/turno/supervisor/inventario` per row | No native JOIN; each table is filterable standalone |
| Explicit save (filter by fecha+turno) | User controls when a shift is closed; filter for load is Fecha+Turno — changing either re-fills or clears; avoids saving partial rows |
| Derived values stay in sheet formulas, database stores only inputs | Formulas recalculate on re-fill; database never stores snapshots |
| Track last change per row | Each row stores `actualizado` and `editado_por` |
| Timezone `America/La_Paz` only for audit fields creado/actualizado | `creado`/`actualizado` in `America/La_Paz`; `fecha` stored as sheet DATE value without timezone conversion |

## 6. Functional Requirements

### 6.1 Forms & Save

| ID | Requirement | Priority |
|----|-------------|----------|
| **FR-001** | Two input sheets are the only entry points: `madejeras` (`B3` date, `F3` turno, `B4` supervisor, `F4` inventario, `A7:K17` table) and `lotes` (`C3` date, `E3` turno, `G3` supervisor, `I3` inventario, `A5:R52` usable). Filter for load/re-fill is combined fecha+turno — changing fecha OR turno triggers re-fill (retrieves that shift or clears inputs when none exist); re-fill writes only to input ranges. | Must |
| **FR-002** | `madejeras!B3` and `lotes!C3` are `DATE` with sheet data validation; dropdowns `F3/B4/F4` and `E3/G3/I3` validate against fixed lists. Unknown values block save for that form. | Must |
| **FR-003** | Explicit save per form (or combined): `Inventario → Guardar Madejeras \| Guardar Lotes \| Guardar Todo`. After save the user is offered to clear the form — clearing affects only input ranges (`madejeras C8:G17`; `lotes A6:F52` and `H6:O52`) and never formula columns. On filter change (fecha OR turno), re-fill writes only to those input ranges for the selected fecha+turno; formula cells are never cleared nor written and recalculate automatically. | Must |
| **FR-004** | Save is upsert per primary key, not append. `db_madejeras` PK `(fecha, turno, maquina, lado)` — fecha stored as sheet DATE value as-is without timezone conversion; `db_lotes` PK `(fecha, turno, lote_id)` with fallback `fecha-turno-rowIndex` when `lote_id` is empty. Re-saving the same `fecha+turno` updates in place. `creado` is preserved on update; `actualizado` and `editado_por` are refreshed. | Must |
| **FR-005** | `madejeras` derived values are sheet formulas (English `IF`), never persisted; database stores only raw inputs (`maquina`, `lado`, `titulo_base`, `cabos`, `peso_deseado`, `tamano_aspa`, `velocidad`). Formulas `H8=IF(D8>0,C8/D8,0)`, `I8=H8*E8`, `J8=IF(F8>0,I8/F8,0)`, `K8=IF(G8>0,I8/G8,0)` live in `madejeras!H8:K17` and recalculate automatically. `db_madejeras` has no `factor/metraje/vueltas/tiempo_parada` columns. | Must |
| **FR-006** | `lotes` derived values are sheet formulas (English `IF`/`SUM`), never persisted; database stores only raw inputs (`lote_id`, `tipo_orden`, `color`, `titulo`, `objetivo_neto`, `aumento`, `pesada_1..8`). Formulas `G6=IF(E6="","",E6+F6)`, `P6=IF(E6="","",SUM(H6:O6))`, `Q6=IF(E6="","",G6-P6)`, `R6=IF(E6="","",IF(P6>G6,"EXCEDIDO",IF(P6=G6,"EXACTO","FALTA")))` live in `lotes!G6:G52`/`P6:Q6`/`R6:R52` and recalculate automatically. `db_lotes` has no `meta/total/ajuste/estado` columns. | Must |
| **FR-007** | After save, toast `✅ Guardado: {fecha} {turno} — {N} madejeras, {M} lotes por {user}`. On failure, log to `Errors` and toast `❌ Error — use Re-sincronizar`. | Must |
| **FR-008** | Menu `Inventario → Guardar Madejeras \| Guardar Lotes \| Guardar Todo \| Ver db_madejeras \| Ver db_lotes \| Re-sincronizar` is available on open. | Should |
| **FR-009** | Post-save never auto-clears. Optional prompt `¿Limpiar formulario para próximo turno?` — `Yes` clears only inputs as defined in FR-003, leaving headers, controls, and formulas intact. | Should |

### 6.2 Validation & Guards

| ID | Requirement | Priority |
|----|-------------|----------|
| **FR-010** | Before any write: validate `fecha` is a valid date; at least one data row must be complete (madejeras: `titulo_base+cabos+peso_deseado` numeric; lotes: `objetivo_neto` numeric). Empty `fecha` blocks the save. | Must |
| **FR-011** | `turno`/`supervisor`/`inventario` must be in the allowed lists (case-insensitive, trimmed). Invalid values block that form's save and produce a warning and log entry. | Must |
| **FR-012** | Saves are concurrency-safe; concurrent saves do not corrupt data. A retry mechanism is available if a save fails due to contention; failed saves can be retried via `Re-sincronizar`. | Must |

## 7. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-01 | Performance | Single form save <2s; full day (10+47 rows) <5s. Batch reads and writes on input ranges only. |
| NFR-02 | Reliability | Concurrency-safe saves; no data loss or duplication under concurrent access. Save runs with owner permissions. |
| NFR-03 | Locale | Formulas remain verbatim English (`IF`, `SUM`). |
| NFR-04 | Timezone | `America/La_Paz` (UTC-4, no DST) only for audit fields `creado`/`actualizado`; `fecha` is stored as native sheet DATE without timezone conversion. |
| NFR-05 | Data integrity | Database headers are protected and frozen; column order is frozen. Formula columns are never modified by the save operation. |
| NFR-06 | Observability | User feedback via toast messages; validation and save failures are logged to `Errors`. |

## 8. Data Model

Order is frozen. Forms are UX only. Database sheets are upsert targets with audit of last change. Types are sheet types. Timezone `America/La_Paz` only for audit timestamps `creado`/`actualizado`. `fecha` is stored as the sheet DATE cell value without timezone conversion. Headers use Spanish snake_case without accents. Database stores only raw inputs plus audit — no formula columns.

### 8.1 `db_madejeras` — Inputs per machine/side per day (≤10 rows/day) — 17 columns (A:Q)

Only `C..G` of the form (`titulo_base`, `cabos`, `peso_deseado`, `tamano_aspa`, `velocidad`) are inputs. `H8:K17` (`factor`, `metraje`, `vueltas`, `tiempo_parada`) are sheet formulas that are never stored, never cleared, and never written.

| # | Col | Header | Type | Example | Description |
|---|-----|--------|------|---------|-------------|
| 1 | A | `id` | STRING | `2026-09-10-Turno Dia-Maquina 1-A` | PK `fecha-turno-maquina-lado` normalized (`yyyy-MM-dd` + turno + máquina + lado) |
| 2 | B | `fecha` | DATE | `2026-09-10` | From `madejeras!B3` — stored as sheet DATE value as-is, no timezone conversion |
| 3 | C | `turno` | ENUM | `Turno Dia` | `madejeras!F3` — `Turno Dia,Tarde,Noche` |
| 4 | D | `supervisor` | STRING | `Junior` | `madejeras!B4` |
| 5 | E | `inventario` | STRING | `Ricky` | `madejeras!F4` |
| 6 | F | `maquina` | STRING | `Máquina 1` | `madejeras!A8:A17` |
| 7 | G | `lado` | ENUM | `A` | `madejeras!B8:B17` — `A`/`B` (stored without `Lado` prefix) |
| 8 | H | `titulo_base` | NUMBER | `9` | `madejeras!C8` — raw input |
| 9 | I | `cabos` | NUMBER | `4` | `madejeras!D8` |
| 10 | J | `peso_deseado` | NUMBER | `505` | `madejeras!E8` (g) |
| 11 | K | `tamano_aspa` | NUMBER | `1.73` | `madejeras!F8` (m) |
| 12 | L | `velocidad` | NUMBER | `250` | `madejeras!G8` (m/min) |
| 13 | M | `creado` | DATETIME | `2026-09-10 08:10:00` | First insert, `America/La_Paz` |
| 14 | N | `actualizado` | DATETIME | `2026-09-10 08:15:22` | Last change |
| 15 | O | `editado_por` | STRING | `user@factory.bo` | Last editor |
| 16 | P | `rango_origen` | STRING | `madejeras!A8:G8` | Traceability (input range only) |
| 17 | Q | `estado` | ENUM | `active` | `active`/`void` — soft-delete |

PK `(fecha, turno, maquina, lado)` → update if found, append if not. `creado` is never overwritten; `actualizado`/`editado_por` are refreshed on every upsert. `fecha` is PK component stored as native DATE; no `Utilities.formatDate` applied; filter for load is fecha+turno. Merged title `A1:K1` is not persisted. Usable rows are `A8:A17` (10 rows); an empty input row produces no database row. Clear and re-fill apply only to `C8:G17`; `H8:K17` is untouched.

### 8.2 `db_lotes` — Inputs per lot per day (≤47 rows/day, filtered by `objetivo_neto` non-empty) — 24 columns (A:X)

Form column mapping: `A=lote_id`, `B=tipo_orden`, `C=color`, `D=titulo`, `E=objetivo_neto`, `F=aumento`, `G=meta` (formula — not in database), `H:O=pesada 1..8`, `P=total` (formula), `Q=ajuste` (formula), `R=estado` (formula). Only `A6:F52` and `H6:O52` are inputs. `G6:G52`, `P6:P52`, `Q6:Q52`, `R6:R52` are sheet formulas that are never stored, never cleared, and never written.

| # | Col | Header | Type | Example | Description |
|---|-----|--------|------|---------|-------------|
| 1 | A | `id` | STRING | `2026-09-10-Dia-VERDE BANDERA` or `2026-09-10-Dia-row6` | PK `fecha-turno-lote_id`; fallback `fecha-turno-row{6..52}` when `lote_id` empty |
| 2 | B | `fecha` | DATE | `2026-09-10` | From `lotes!C3` — stored as sheet DATE value as-is, no timezone conversion |
| 3 | C | `turno` | ENUM | `Dia` | `lotes!E3` — `Dia,Tarde,Noche` |
| 4 | D | `supervisor` | STRING | `Junior` | `lotes!G3` |
| 5 | E | `inventario` | STRING | `Ricky` | `lotes!I3` |
| 6 | F | `lote_id` | STRING | `VERDE BANDERA` | `lotes!A6:A52` — free text; may be empty (fallback PK uses row index) |
| 7 | G | `tipo_orden` | ENUM | `Lote` | `lotes!B6:B52` — `Lote,Stock` |
| 8 | H | `color` | STRING | `—` | `lotes!C6:C52` |
| 9 | I | `titulo` | STRING | `2/18` | `lotes!D6:D52` |
| 10 | J | `objetivo_neto` | NUMBER | `216` | `lotes!E6:E52` — presets `204,216`; empty → skip row |
| 11 | K | `aumento` | NUMBER | `1` | `lotes!F6:F52` — empty treated as 0 |
| 12 | L | `pesada_1` | NUMBER | `40.2` | `lotes!H6` |
| 13 | M | `pesada_2` | NUMBER | `50.6` | `lotes!I6` |
| 14 | N | `pesada_3` | NUMBER | `50.35` | `lotes!J6` |
| 15 | O | `pesada_4` | NUMBER | `50.2` | `lotes!K6` |
| 16 | P | `pesada_5` | NUMBER | `20.5` | `lotes!L6` |
| 17 | Q | `pesada_6` | NUMBER | `52` | `lotes!M6` |
| 18 | R | `pesada_7` | NUMBER | `20.2` | `lotes!N6` |
| 19 | S | `pesada_8` | NUMBER | `` | `lotes!O6` — empty allowed |
| 20 | T | `creado` | DATETIME | `2026-09-10 08:10:00` | First insert |
| 21 | U | `actualizado` | DATETIME | `2026-09-10 08:15:22` | Last change |
| 22 | V | `editado_por` | STRING | `user@factory.bo` | Last editor |
| 23 | W | `rango_origen` | STRING | `lotes!A6:O6` | Traceability (input columns only) |
| 24 | X | `estado` | ENUM | `active` | `active`/`void` — soft-delete |

PK `(fecha, turno, lote_id)` with fallback to row index when `lote_id` is empty. `fecha` is PK component stored as native DATE; no timezone conversion; filter for load is fecha+turno. Empty `objetivo_neto` produces no row. `creado` is preserved; `actualizado`/`editado_por` are refreshed on upsert. Clear and re-fill apply only to `A6:F52` and `H6:O52`; `G/P/Q/R` are untouched and recalculate automatically.

### 8.3 Primary Keys & Indexes

| Constraint | Definition |
|------------|------------|
| `db_madejeras` PK | `(fecha, turno, maquina, lado)` → `id = yyyy-MM-dd-Turno-Maqui-Lado` |
| `db_lotes` PK | `(fecha, turno, lote_id)` with fallback `(fecha, turno, rowIndex)` when `lote_id` empty |
| Secondary views | Filter by `fecha`, `turno`, `maquina`, `lote_id`, `titulo`, `estado` via `QUERY`/`FILTER`; history sorted by `fecha`; `estado` for lotes is derived in the sheet, not stored |

### 8.4 Storage Estimate

`db_madejeras` 10×365=3,650/yr (17 cols), `db_lotes` 47×365=17,155/yr (24 cols) → ~20,805 rows/yr, ~474k cells/yr. At 10 years ≈4.7M cells, within the 10M cell limit. No partitioning needed for v1. Column ranges: `db_madejeras` `A:Q` (17), `db_lotes` `A:X` (24).

## 9. Edge Cases & Business Rules

| # | Edge Case | Rule |
|---|-----------|------|
| EC-01 | `B3`/`C3` empty or invalid | Block save for that form, toast `⚠️ Seleccioná fecha válida`, no write, log to `Errors` |
| EC-02 | Unknown `turno`/`supervisor`/`inventario` not in list | Block that form, toast `⚠️ Valor no válido en {campo}`, log, skip |
| EC-03 | Empty data rows | Skip row — no database row created. `madejeras`: row with empty `titulo_base` or `cabos` → skip. `lotes`: row with empty `objetivo_neto` → skip. 0..N rows per day is valid. |
| EC-04 | Clearing inputs then saving | If a primary key existed but its input row is now empty or incomplete → soft-delete that row (`estado=void`, `actualizado`/`editado_por` refreshed). Adding inputs later and saving re-activates it (`active`). Filter is fecha+turno — clearing applies per shift. Clearing affects only input ranges; formula columns are never cleared. |
| EC-05 | Re-save same `fecha+turno` | Upsert — `creado` preserved, `actualizado`/`editado_por` refreshed, no duplication; derived values recalculate in the sheet automatically |
| EC-06 | `cabos=0`, `tamano_aspa=0`, or `velocidad=0` | Division-by-zero is handled by sheet formulas: `H=IF(D>0,C/D,0)` → `factor=0`, `J=IF(F>0,I/F,0)` → `vueltas=0`, `K=IF(G>0,I/G,0)` → `tiempo=0`. No additional handling needed; formulas display `0`. |
| EC-07 | `lotes` — all weighings empty but `objetivo` set | Row is created with empty `pesada_1..8`; sheet shows `P=0`, `Q=meta`, `R=FALTA` via formulas — valid (lot started but not yet weighed) |
| EC-08 | `lote_id` empty or duplicate | Empty → PK uses row index so two empty-id rows do not collide. Duplicate `lote_id` on the same `fecha+turno` → last row wins (upsert same PK) — warn via toast `⚠️ Lote duplicado: {id}` |
| EC-09 | Usable vs dimensioned rows | `lotes` sheet is dimensioned to 1002 but only `A6:F52` and `H6:O52` are read (capped at row 52). Rows beyond 52 are ignored unless validation is extended. |
| EC-10 | Concurrency | Saves are concurrency-safe; `Guardar Todo` saves both tables sequentially under a single save operation |
| EC-11 | Timezone | `America/La_Paz` only for audit fields `creado`/`actualizado`. `fecha` DATE is stored and compared as the native sheet DATE value without any timezone conversion; load filter matches fecha+turno exactly as stored. |
| EC-12 | Partial save failure | If `db_madejeras` succeeds but `db_lotes` fails (or vice versa) in `Guardar Todo`, show a partial warning and log to `Errors`; no rollback of the succeeded table — retry is idempotent |

## 10. UX / Flow

### 10.1 Happy Path — One Shift (per form)

```
Pick madejeras!B3=2026-09-10 + F3=Turno Dia (filter fecha+turno), B4=Junior, F4=Ricky
 → fill C8:G12 (e.g. 4 of 10 machine/side rows) — H8:K12 recalculate automatically
 → Inventario → Guardar Madejeras
  → validate B3 is a valid date (stored as-is), turno/supervisor/inventario in lists, ≥1 complete row
  → upsert db_madejeras (4 rows) with raw inputs only + audit fields (fecha as native DATE, creado/actualizado in America/La_Paz)
  → toast "✅ Guardado: 2026-09-10 Turno Dia — 4 madejeras por user@factory.bo"
  → optional prompt ¿Limpiar? Yes → clear C8:G17 only (H8:K17 untouched)

Pick lotes!C3=2026-09-10 + E3=Dia (filter fecha+turno), G3=Junior, I3=Ricky
 → fill A6:F10 (lote_id, tipo, color, titulo, objetivo, aumento) + H6:O6 weighings — G6/P6/Q6/R6 recalculate automatically
 → Inventario → Guardar Lotes (or Guardar Todo)
  → validate C3 and required fields; no recomputation of derived values (handled by sheet formulas)
  → upsert db_lotes (e.g. 5 rows) with raw inputs only + audit fields
  → toast "✅ Guardado: 2026-09-10 Dia — 5 lotes por user@factory.bo"
  → on filter change (fecha OR turno): clear input ranges (madejeras C8:G17; lotes A6:F52+H6:O52), re-fill inputs from database for that fecha+turno; formula columns recalculate automatically

Switch fecha+turno to 2026-09-11 + Turno Tarde → form clears input ranges only, then re-fills inputs for that fecha+turno; formula columns remain untouched. Re-fill is triggered by either fecha or turno change.
```

### 10.2 Error Handling

| Scenario | UX |
|----------|----|
| `B3`/`C3` invalid or empty | Toast `⚠️ Seleccioná fecha válida en B3/C3`, no write, log to `Errors` |
| `turno`/`supervisor`/`inventario` invalid | Toast `⚠️ Valor no válido en {campo}: {value}`, row or form skipped, log |
| No complete data rows | Toast `⚠️ Completá al menos una fila con datos`, no write |
| Duplicate `lote_id` same `fecha+turno` | Toast `⚠️ Lote duplicado: {lote_id} — último valor guardado`, still upserts |
| Save contention | Toast `⏳ ocupado, reintentando…` → retry → `❌ Error — use Re-sincronizar` + log |
| `db_*` sheet missing | Create header row (§8) then proceed |

### 10.3 Menu

```
Inventario → Guardar Madejeras | Guardar Lotes | Guardar Todo
           → Ver db_madejeras | Ver db_lotes
           → Re-sincronizar
```

`Guardar Todo` runs the madejeras and lotes saves sequentially. Individual items remain for per-form control.

## 11. Out of Scope for v1

| Item | Why deferred |
|------|--------------|
| Dashboard / charts for `db_madejeras`/`db_lotes` | Requires database first; v2 (native `QUERY`/`FILTER`; derived values read live from sheet or computed in `QUERY`) |
| Calculator / helper blocks | None in this workbook; if added, excluded from persistence |
| Email or messaging alerts on `EXCEDIDO` | `EXCEDIDO` is a live sheet value (`R`), not stored; alerts would read `lotes!R6:R52` at display time |
| Web form / mobile web app | Sheet UX remains; menu covers desktop and mobile |
| Undo UI | Sheet version history plus `editado_por`/`actualizado` audit suffices |
| Cross-form JOIN (madejeras ↔ lotes) | No shared key; tables remain independent |
| Row-level history / version table | Out of scope — upsert overwrites `actualizado`/`editado_por`; no version table |

## 12. Open Questions — Correct Before Spec

| # | Question | Recommendation | Decision |
|---|----------|----------------|----------|
| Q1 | `maquina` values — canonical list? | `Máquina 1..5` fixed | [ ] |
| Q2 | `lado` stored as `A`/`B` vs `Lado A`? | `A`/`B` (trim prefix) | [ ] |
| Q3 | `turno` — unify `Turno Dia` vs `Dia`? | Keep per-form verbatim (`madejeras=Turno Dia`, `lotes=Dia`) — normalize only for display | [ ] |
| Q4 | `lote_id` empty fallback — `void` vs row-index PK? | Row-index fallback PK (`row{idx}`) — avoids collision, allows later fill | [ ] |
| Q5 | Clearing a row → `void` vs `delete`? | `void` (soft-delete, `estado=void`) — preserves history | [ ] |
| Q6 | Retention? | Unlimited — ~20k rows/yr is well within limits (~4.7M cells at 10 years) | [ ] |

## Appendix A — Constraints Compliance

| Constraint | Compliance |
|------------|------------|
| Formulas | Keep English `IF`/`SUM` verbatim in the sheet; formulas live in the sheet only, never in the database |
| Timezone | `America/La_Paz` only for audit fields `creado`/`actualizado`; `fecha` DATE stored as native sheet DATE without timezone conversion |
| Isolation | `apps-script/yarn-inventory/` is an independent project (own `appsscript.json` `America/La_Paz`) — no shared globals with other projects |
| Input vs formula | Only `madejeras!C8:G17` and `lotes!A6:F52`+`H6:O52` are persisted, cleared, and re-filled; formula ranges are never touched |
| Permissions | Saves run with owner permissions; unauthenticated users cannot write |

## Appendix B — Glossary

| Term | Meaning |
|------|---------|
| `madejeras` | Form sheet `A1:K21` — automatic dashboard per machine/side; inputs `C8:G17`, formulas `H8:K17` (`factor/metraje/vueltas/tiempo`) recalculate in sheet |
| `lotes` | Form sheet `A1:R1002` — lot weighing and assembly (47 usable rows `B6:B52`); inputs `A6:F52`+`H6:O52`, formulas `G6:G52`/`P6:Q6`/`R6:R52` (`meta/total/ajuste/estado`) recalculate in sheet |
| `db_madejeras` | Database per `fecha,turno,maquina,lado` — ≤10 rows/day, PK `fecha-turno-maquina-lado`, 17 columns `A:Q` — inputs plus audit, no formula columns |
| `db_lotes` | Database per `fecha,turno,lote_id` — ≤47 rows/day, PK `fecha-turno-lote_id` (fallback row index), 24 columns `A:X` — inputs plus audit, no formula columns |
| `Errors` | Log sheet (optional) |
| `FACTOR`/`METRAJE`/`VUELTAS`/`TIEMPO` | `madejeras` derived values `H:K` — sheet formulas `IF(D>0,C/D,0)`/`H*E`/`IF(F>0,I/F,0)`/`IF(G>0,I/G,0)` — display only, never in `db_madejeras` |
| `META`/`TOTAL`/`AJUSTE`/`ESTADO` | `lotes` derived values `G/P/Q/R` — sheet formulas `IF(E="","",E+F)`/`SUM(H:O)`/`G-P`/`IF(P>G,…)` — display only, never in `db_lotes` |
| Idempotent upsert | Insert if primary key is absent, update if present — `creado` preserved, `actualizado`/`editado_por` refreshed |
| Input range | Only cells that are cleared, persisted, and re-filled: `madejeras!C8:G17`, `lotes!A6:F52`+`H6:O52` — formula ranges are never touched |
| Formula range | `madejeras!H8:K17`, `lotes!G6:G52`/`P6:P52`/`Q6:Q52`/`R6:R52` — English `IF`/`SUM`, not persisted, not cleared |

*End of PRD v0.2.0 — yarn-inventory.*
