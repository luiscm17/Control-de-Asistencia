# Yarn Production Control — Product Requirements Document

| Field | Value |
|-------|-------|
| **Version** | 0.1.0 |
| **Author** | [Placeholder — assign owner] |
| **Date** | 2026-09-03 |
| **Status** | Draft |
| **Repo** | `apps-script/yarn-settings/` |

> §2 + §5 = 2-min version. §6–§9 = implementation detail.

## 1. Quick Path

1. **Problem:** Production data for the twisting area lives in a daily template with the same logic replicated per day — no queryable DB, no audit of who saved last, summary by title recalculates live.
2. **Decision:** Keep a single input sheet `Settings` as daily entry. Persist planning and actuals into dedicated DB sheets (`DB_Asignaciones`, `DB_Descargas`) via Apps Script (Sheets API v4) using an explicit save action (button/menu). Each DB row records who made the last change. `Errors` is the optional log.
3. **Verify:** After PRD approval → SDD `propose → spec → design → tasks` (§13).

## 2. Executive Summary

Production for the twisting area is planned per machine (`Retorcedora 1..10`) and logged per weighing (`Lado A/B`, up to 4 per side). Each machine has assigned `Cabos`, `Título` and `Frentes asignados`; each weighing records `Peso Bruto`, `Usos`, `Peso Cono` and `Peso Tacho` with `Peso Neto` derived as `Bruto − (Usos × Peso Cono + Peso Tacho)`.

| Pain | Impact |
|------|--------|
| Daily template duplicated per day | Formula drift, N× maintenance |
| Input sheet is both UX and storage | History overwritten on date change |
| No audit of last change | Not traceable who saved |
| `Peso Neto` only as cell formula | Not queryable centrally |
| Planning (`frentes`) and actuals (weighings) have no DB | No reporting per `fecha` |

**Solution:** One reusable `Settings` sheet drives `fecha` → `día` via formula. `DB_Asignaciones` stores the daily plan per retorcedora (≤10 rows/day). `DB_Descargas` stores each weighing (≤80 rows/day, 10×8). Both DB rows store `actualizado` and `editado_por` (last editor) — same pattern as `Registro` in attendance-control. Save is an explicit `Guardar Turno` action with `LockService`.

## 3. Goals / Non-Goals

**Goals v1:** Single `Settings` for all days; every shift closable with one explicit save; `Peso Neto` stored as value and queryable by `fecha`/`título`/`retorcedora`; idempotent upsert per `(fecha, retorcedora)` and `(fecha, retorcedora, descarga, lado)`; last editor tracked per row.

**Non-Goals v1:** Replacing weighing hardware; payroll/HR integration; automatic per-cell persistence for weighings; multi-file import.

## 4. Current State Analysis

### 4.1 Sheet Inventory — 4 sheets

| Sheet | Purpose | Type | State |
|-------|---------|------|-------|
| `Settings` | Input form — daily entry | Form (not table) | Single reusable template (date-driven) |
| `DB_Asignaciones` | Plan per retorcedora per day | Table | Target DB — empty |
| `DB_Descargas` | Weighings per `descarga/lado` per retorcedora per day | Table | Target DB — empty |
| `Errors` | Optional log | Table | Observability |

> `Settings` contains `F4` (fecha) and derived `J4` (día), protected range `B10:C19` (`Título → Kg por 1 Frente` as reference for `BUSCARV`), input zones `C33:E42` (assignment) and `E50:H157` (10×8 weighings). Helper blocks `E10:H24` (calculator) and `L33:P42` (Resumen) are not part of `Settings` — they are derived views and are excluded from persistence.

### 4.2 Template Mechanics

> `F4` validation is Sheets-side (no Script cost): number format `dd/MM/yyyy` via `Format → Number → Custom date`, `dataValidation` `isValidDate`. Script only checks `F4` is valid `DATE` before save.

| Range | Value / Formula (verbatim, `es-BO`) | Meaning | Kind |
|-------|--------------------------------------|---------|------|
| `F4` | Date `dd/MM/yyyy` (`DATE`) | Fecha del turno | Input (Sheets format+validation) |
| `J4` | `=SI(F4="","", ELEGIR(DIASEM(F4,2), "LUNES",…,"DOMINGO"))` | Día derivado | Formula |
| `B10:C19` | `Título → Kg por 1 Frente` | Standards reference | Reference |
| `F33` | `=SI.ERROR(E33*BUSCARV(D33,$B$10:$C$19,2,FALSO),0)` | Producción día | Formula |
| `G33` | `=SI(ESNUMERO(F33),F33/3,0)` | Producción turno (8h = día/3) | Formula |
| `H33` | `=SI(F33>0,F33/204,0)` | Lotes/día (std 204 kg) | Formula |
| `I50` | `=SI(E50="","",E50-((SI(F50="",0,F50)*SI(G50="",0,G50))+SI(H50="",0,H50)))` | Peso Neto | Formula |

Locale: `SI.ERROR`/`BUSCARV`/`DIASEM`/`ELEGIR`/`ESNUMERO` with `FALSO`. Use `valueRenderOption=FORMULA` when writing formulas.

> Only `C33:E42` and `E50:H157` are persisted. Calculator and Resumen are excluded.

## 5. Proposed Solution Overview

```
Settings (1 sheet, date-driven) ──explicit Save──▶ Apps Script (validate, compute peso neto, LockService) ──▶ DB_Asignaciones (≤10 rows/day)
   F4 fecha ─┬─▶ J4 día auto                       C33:E42 (plan)                                     ──▶ DB_Descargas (≤80 rows/day)
   B10:C19 ──┘  Standards reference                  E50:H157 (real)                                    ──▶ Errors (optional log)
```

| Principle | Rationale |
|-----------|-----------|
| 1 `Settings`, N days via `fecha` | Eliminates template drift; `dia` derived |
| 2 DB tables, `Settings` is form | View != storage; `Settings` never queried as DB |
| Denormalize `fecha/titulo` per DB row | No native JOIN in Sheets; each table filterable standalone |
| Explicit save (button + menu) | Avoids saving partial weighings; user controls close of shift |
| Compute `peso_neto` in Script | DB stores value, cell formula remains UX aid |
| Track last change per row | Each DB row stores `actualizado` + `editado_por` |

## 6. Functional Requirements

### 6.1 Settings & Save

| ID | Requirement | Priority |
|----|-------------|----------|
| **FR-001** | Single input sheet `Settings` is the only entry point. `F4` is a datepicker (`DATE`); `J4` is read-only formula `ELEGIR(DIASEM(F4,2),…)`. Changing `F4` does not auto-clear the grid. | Must |
| **FR-002** | Protected range `B10:C19` is the reference `Título → Kg por 1 Frente`. `D33:D42` (Título Asignado) validates against this range via `dataValidation`. Unknown title blocks save for that row. | Must |
| **FR-003** | On `Yarn → Guardar Turno` (or drawing button bound to `guardarTurno()`), validate: `F4` is a valid date; at least one assignment row complete (`retorcedora + titulo + frentes`) or one weighing complete (`peso_bruto` numeric) is required. `F4` empty → toast, no write. | Must |
| **FR-004** | Save is **upsert** per PK, not append: `DB_Asignaciones` PK `(fecha, retorcedora)`; `DB_Descargas` PK `(fecha, retorcedora, descarga_nro, lado)`. Re-saving the same `fecha` updates in place, does not duplicate. `creado` preserved on update, `actualizado` + `editado_por` refreshed. | Must |
| **FR-005** | `peso_neto` is computed in Apps Script as `bruto − (usos × peso_cono + peso_tacho)` with null→0, rounded to 2 decimals, stored as value. Cell `I50` remains for UX but DB is source of truth. | Must |
| **FR-006** | After save, toast `✅ Guardado: {fecha} — {N} asignaciones, {M} descargas ({kg} kg)`. On lock/execution failure, log to `Errors` and toast `❌ Error — use Re-sincronizar`. | Must |
| **FR-007** | Optional post-save prompt `¿Limpiar Settings para próximo turno?` — `Yes` clears `C33:E42` + `E50:H157` (leaves `B10:C19`, `F4`); `No` keeps values. Never auto-clears. | Should |
| **FR-008** | Menu `Yarn → Guardar Turno | Ver DB_Descargas | Ver DB_Asignaciones | Re-sincronizar Settings` | Should |

## 7. Non-Functional Requirements

| ID | Category | Requirement | Notes |
|----|----------|-------------|-------|
| NFR-01 | Performance | Single save <2s; full day (80 weighings) <5s | Batch `getValues`/`setValues` |
| NFR-02 | Quotas | No external calls | `90 min/day`, `20k` fetches |
| NFR-03 | Reliability | `LockService.getDocumentLock()` per save (5s, retry 1) | Queue failed via menu |
| NFR-04 | Locale | Spanish formulas verbatim; `valueRenderOption=FORMULA` | `SI.ERROR`/`BUSCARV`/`DIASEM` |
| NFR-05 | Timezone | `America/La_Paz` (UTC-4) for timestamps | `Utilities.formatDate(...,"America/La_Paz","yyyy-MM-dd HH:mm:ss")` |
| NFR-06 | Maintainability | No npm/pip; `apps-script/yarn-settings/` via `clasp`; helper tooling under `tools/` | Built-ins only |
| NFR-07 | Observability | `Logger` + toast; `Errors` sheet | Log validation failures |
| NFR-08 | Data integrity | DB headers protected/frozen; order frozen | Never reorder cols |

## 8. Data Model

> Order frozen. `Settings` is UX only. DB sheets are upsert targets with audit of last change. Types are Sheets types. Timezone `America/La_Paz` for all timestamps.

### 8.1 `DB_Asignaciones` — Plan per machine per day (≤10 rows/day)

| # | Col | Type | Example | Description |
|---|-----|------|---------|-------------|
| A | `id` | STRING | `2026-09-03-R01` | `fecha-retorcedora` |
| B | `fecha` | DATE | `2026-09-03` | From `Settings!F4` |
| C | `retorcedora` | STRING | `Retorcedora 1` | `Settings!B33` label |
| D | `cabos` | NUMBER | `4` | `Settings!C33` |
| E | `titulo_asignado` | STRING | `9` | `Settings!D33` |
| F | `frentes_asignados` | NUMBER | `4` | `Settings!E33` |
| G | `prod_dia` | NUMBER | `1000` | Snapshot `frentes × kg` (`Settings!F33`) |
| H | `prod_turno` | NUMBER | `333.33` | Snapshot `prod_dia/3` (`Settings!G33`) |
| I | `lotes_dia` | NUMBER | `4.90` | Snapshot `prod_dia/204` (`Settings!H33`) |
| J | `creado` | DATETIME | `2026-09-03 08:10:00` | First insert |
| K | `actualizado` | DATETIME | `2026-09-03 08:15:22` | Last change |
| L | `editado_por` | STRING | `user@factory.bo` | `Session.getActiveUser().getEmail()` or `unknown` — last editor |
| M | `rango_origen` | STRING | `Settings!C33:E33` | Traceability |

> PK `(fecha, retorcedora)` → `findRow→update else append`. `prod_*` stored as value at save time. `creado` never overwritten; `actualizado`/`editado_por` refreshed on every upsert — same pattern as attendance `Registro` (`actualizado`+`editado_por`).

### 8.2 `DB_Descargas` — Weighings (≤80 rows/day)

| # | Col | Type | Example | Description |
|---|-----|------|---------|-------------|
| A | `id` | STRING | `2026-09-03-R01-1-A` | `fecha-retorcedora-descarga-lado` |
| B | `fecha` | DATE | `2026-09-03` | Denormalized copy |
| C | `retorcedora` | STRING | `Retorcedora 1` | `Settings!B48` |
| D | `descarga_nro` | NUMBER | `1` | `Settings!B50` 1..4 |
| E | `lado` | ENUM | `A` | `Settings!C50` A/B |
| F | `titulo` | STRING | `9` | Copied from `D33` at save |
| G | `peso_bruto` | NUMBER | `60.0` | `Settings!E50` |
| H | `usos` | NUMBER | `40` | `Settings!F50` |
| I | `peso_cono` | NUMBER | `0.037` | `Settings!G50` |
| J | `peso_tacho` | NUMBER | `15.2` | `Settings!H50` |
| K | `peso_neto` | NUMBER | `43.32` | `G − (H×I + J)` computed in Script |
| L | `creado` | DATETIME | `2026-09-03 08:10:00` | First insert |
| M | `actualizado` | DATETIME | `2026-09-03 08:15:22` | Last change |
| N | `editado_por` | STRING | `user@factory.bo` | Last editor |
| O | `rango_origen` | STRING | `Settings!E50:H50` | Traceability |

> PK `(fecha, retorcedora, descarga_nro, lado)`. Empty `peso_bruto` → no row created. Same audit pattern: `creado` preserved, `actualizado`/`editado_por` overwritten on upsert.

### 8.3 PK & Indexes

| Constraint | Definition |
|------------|------------|
| `DB_Asignaciones` PK | `(fecha, retorcedora)` |
| `DB_Descargas` PK | `(fecha, retorcedora, descarga_nro, lado)` |
| Secondary views | Filter by `fecha`, `titulo`, `retorcedora` via `QUERY` |

### 8.4 Storage Estimate

`DB_Asignaciones` 10×365=3.6k/yr, `DB_Descargas` 80×365=29k/yr → ~33k rows/yr — within 10M cells.

## 9. Edge Cases & Business Rules

| # | Edge Case | Rule |
|---|-----------|------|
| EC-01 | `F4` empty / invalid | Block save, toast `⚠️ Seleccioná fecha válida`, no write |
| EC-02 | Unknown `titulo` not in `B10:C19` | Block row, toast `⚠️ Título no existe`, log `Errors`, skip row |
| EC-03 | Empty weighings / variable 80 (no `peso_bruto`) | **Skip row — no DB row created**; 0..80 rows/day is normal (e.g. R3=0, R1=1, R5=8). If `Settings!E50` empty and a row exists in `DB_Descargas` for that PK `(fecha, retorcedora, descarga_nro, lado)` → **delete that DB row** on next save (clearing `peso_bruto` and saving removes the weighing). Machine with 0 weighings → 0 rows for that machine; adding a new `peso_bruto` later and saving inserts only that PK. |
| EC-04 | Re-save same `fecha` | Upsert — `creado` preserved, `actualizado`/`editado_por` refreshed, not duplicated; variable rows handled per EC-03 |
| EC-05 | Timezone | `America/La_Paz` for all timestamps |
| EC-06 | Concurrency | `LockService.getDocumentLock()` per save (5s, retry 1) |

## 10. UX / Flow

### 10.1 Happy Path — One Shift

```
Pick Settings!F4=2026-09-03 → J4=JUEVES auto
 → fill C33:E42 (e.g. 6 of 10 machines), fill E50:H53 for R1 (2 weighings)
 → Yarn → Guardar Turno (or button)
  → validate F4, VLOOKUP, numeric bruto
  → Lock → upsert DB_Asignaciones (6 rows) + DB_Descargas (2 rows) with editado_por
  → toast "✅ Guardado: 2026-09-03 — 6 asign, 2 desc (86.64 kg) por user@factory.bo"
```

### 10.2 Error Handling

| Scenario | UX |
|----------|----|
| `B10:C19` missing | Toast `⚠️ Standards no accesible` + log |
| Lock timeout | `⏳ ocupado, reintentando…` → retry → `❌ Use Re-sincronizar` |
| Invalid `titulo` | Toast `⚠️ Título no existe`, row skipped |

### 10.3 Menu

```
Yarn → Guardar Turno | Ver DB_Descargas | Ver DB_Asignaciones | Re-sincronizar Settings
```

## 11. Out of Scope for v1

| Item | Why deferred |
|------|--------------|
| Calculator `E10:H24` and Resumen `L33:P42` | Excluded from Settings — derived/helper only, not persisted |
| Multi-turno UI (3×/day) | Single save per `fecha` suffices |
| Email/WhatsApp alerts | Infra |
| Web form | Sheets UX stays |
| Undo UI | Sheets version history + last-editor audit suffices |

## 12. Open Questions — Correct Before Spec

| # | Question | Recommendation | Decision |
|---|----------|----------------|----------|
| Q1 | `titulo` type string vs number? | String | [ ] |
| Q2 | `prod_dia/lotes` snapshot vs derive? | Snapshot at save | [ ] |
| Q3 | Retention? | Infinite, 33k/yr fine | [ ] |

## 13. Next Steps

| Step | Owner | Artifact / Command | Exit |
|------|-------|--------------------|------|
| 1. Correct §8 fields | Stakeholder | Edit this file | Approved |
| 2. SDD Propose | Tech | `sdd-propose` on `yarn-settings` | Accepted |
| 3. SDD Spec | Tech | `sdd-spec` Given/When/Then | Reviewed |
| 4. SDD Design | Tech | `sdd-design` | Approved |
| 5. SDD Tasks | Tech | `sdd-tasks` | Ready |
| 6. Implement | Tech | `sdd-apply` in `apps-script/yarn-settings/` on copy | Verified |
| 7. Verify & Rollout | Tech | `sdd-verify` → prod | Live |

## Appendix A — Constraints Compliance

| Constraint | Compliance |
|------------|------------|
| No npm/pip | Built-ins only (`SpreadsheetApp`, `LockService`, `Session`, `Utilities`) |
| Project-dir tooling | `clasp` under `tools/` if used, never `/tmp` |
| Spanish formulas | Keep `SI.ERROR`/`BUSCARV`/`DIASEM`/`ELEGIR` verbatim via `valueRenderOption=FORMULA` |
| Timezone | `America/La_Paz` everywhere |

## Appendix B — Glossary

| Term | Meaning |
|------|---------|
| Settings | Single input sheet — form, not DB (replaces 7 daily sheets) |
| DB_Asignaciones | Plan per `retorcedora` per `fecha` — table with last-editor audit |
| DB_Descargas | Weighing per `descarga/lado` per `retorcedora` per `fecha` — table with last-editor audit |
| Errors | Log sheet |

*End of PRD v0.1.0 — awaiting field corrections in §8.*
