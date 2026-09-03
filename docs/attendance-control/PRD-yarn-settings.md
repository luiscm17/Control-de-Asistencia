# Yarn Production Control — Product Requirements Document

| Field | Value |
| ------- | ------- |
| **Version** | 0.1.0 |
| **Author** | [Placeholder — assign owner] |
| **Date** | 2026-09-03 |
| **Status** | Draft |
| **Repo** | `apps-script/yarn-settings/` |

> §2 + §6 = 2-min version. §7–§10 = implementation detail.

## 1. Quick Path

1. **Problem:** Production data for the twisting area lives in duplicated daily sheets with the same template — same logic replicated across days, no queryable DB, summary by title recalculates live from the operative range.
2. **Decision:** Keep a single operative sheet as daily entry. Persist planning and actuals into dedicated DB sheets (`Standards`, `DB_Asignaciones`, `DB_Descargas`) via Apps Script (`onEdit` + Sheets API v4) using an explicit save action (button/menu). Dashboard is a `QUERY` view over the DBs.
3. **Verify:** After PRD approval → SDD `propose → spec → design → tasks` (§14).

## 2. Executive Summary

Production for the twisting area is planned per machine (`Retorcedora 1..10`) and logged per weighing (`Lado A/B`, up to 4 per side). Each machine has assigned `Cabos`, `Título` and `Frentes asignados`; each weighing records `Peso Bruto`, `Usos`, `Peso Cono` and `Peso Tacho` with `Peso Neto` derived as `Bruto − (Usos × Peso Cono + Peso Tacho)`.

| Pain | Impact |
| ------ | -------- |
| Daily sheets duplicate template | Formula drift, N× maintenance |
| Operative is both UX and storage | History overwritten on date change |
| Summary by title is live (`FILTER`/`SUMIF`) on the operative | No stable history per `fecha` |
| `Peso Neto` only as cell formula | Not queryable centrally |
| Planning (`frentes`) and actuals (weighings) mixed with helper calculator | Unclear what to persist |

**Solution:** One reusable operative sheet drives `fecha` → `día` via formula. `Standards` holds `Título → Kg por 1 Frente`. `DB_Asignaciones` stores the daily plan per retorcedora (≤10 rows/day). `DB_Descargas` stores each weighing (≤80 rows/day, 10×8). `Resumen por Título` and chart `Objetivo vs Producción` are `QUERY` views over the DBs. Save is an explicit `Guardar Turno` action with `LockService`; helper calculator block remains UX-only and is not persisted.

## 3. Goals / Non-Goals

**Goals v1:** Single operative for all days; every shift closable with one explicit save; `Peso Neto` stored as value and queryable by `fecha`/`título`/`retorcedora`; summary by title available without opening operative; idempotent upsert per `(fecha, retorcedora)` and `(fecha, retorcedora, descarga, lado)`.

**Non-Goals v1:** Replacing weighing hardware; payroll/HR integration; automatic per-cell persistence for weighings; multi-file import; rewriting charts beyond `QUERY`.

## 4. Current State Analysis

### 4.1 Sheet Inventory

| Sheet | Purpose | State |
| ------- | --------- | ------- |
| `Operativa` | Daily entry — input | Single reusable template (date-driven) |
| `Standards` | Master `Título → Kg por 1 Frente` | Reference table, protected |
| `DB_Asignaciones` | Plan per retorcedora per day | Target DB — empty |
| `DB_Descargas` | Weighings per `descarga/lado` per retorcedora per day | Target DB — empty |
| `Dashboard` | `QUERY` views + chart `Objetivo vs Producción` | Derived, not stored |
| `Errors` | Optional log | Observability |

> Operative template contains the input zones `E15:AI44`-equivalent for assignment and `B46:I158`-equivalent for weighings, plus header `F4` (fecha) and derived `J4` (día), and a helper calculator block `E10:H24` for ad-hoc simulation.

### 4.2 Template Mechanics

| Range | Value / Formula (verbatim, `es-BO`) | Meaning | Kind |
| ------- | -------------------------------------- | --------- | ------ |
| `F4` | Date (`DATE`) | Fecha del turno | Input |
| `J4` | `=SI(F4="","", ELEGIR(DIASEM(F4,2), "LUNES",…,"DOMINGO"))` | Día derivado | Formula |
| `B10:C19` | `Título → Kg por 1 Frente` | Standards | Reference |
| `G10` | `=SI.ERROR(SI(E10="","",BUSCARV(E10,$B$10:$C$19,2,FALSO)),0)` | Kg/Frente auto | Formula |
| `H10` | `=SI(ESNUMERO(F10*G10),F10*G10,0)` | Producción total calc | Formula |
| `F33` | `=SI.ERROR(E33*BUSCARV(D33,$B$10:$C$19,2,FALSO),0)` | Producción día | Formula |
| `G33` | `=SI(ESNUMERO(F33),F33/3,0)` | Producción turno (8h = día/3) | Formula |
| `H33` | `=SI(F33>0,F33/204,0)` | Lotes/día (std 204 kg) | Formula |
| `I50` | `=SI(E50="","",E50-((SI(F50="",0,F50)*SI(G50="",0,G50))+SI(H50="",0,H50)))` | Peso Neto | Formula |

Locale: `SI.ERROR`/`BUSCARV`/`DIASEM`/`ELEGIR`/`ESNUMERO` with `FALSO`. Use `valueRenderOption=FORMULA` when writing formulas.

> **Helper vs DB:** Calculator `E10:H24` and `Resumen L33:P42` (`UNIQUE(FILTER)`/`SUMIF`) are derived views. Only `C33:E42` (assignment) and `E50:H157` (weighings) are persisted.

## 5. Proposed Solution Overview

```
Operativa (1 sheet, date-driven) ──explicit Save──▶ Apps Script (validate, compute peso neto, LockService) ──▶ DB_Asignaciones (≤10 rows/day)
   F4 fecha ─┬─▶ J4 día auto                        C33:E42 (plan)                                      ──▶ DB_Descargas (≤80 rows/day)
   B10:C19 ──┘  Standards master                      E50:H157 (real)                                     ──▶ Dashboard QUERY (Resumen + chart)
               Calculator E10:H24 stays helper only, not persisted
```

| Principle | Rationale |
| ----------- | ----------- |
| 1 operative, N days via `fecha` | Eliminates template drift; `dia` derived |
| 3 DB sheets, view != storage | `Resumen` is `QUERY`, not stored rows |
| Denormalize `fecha/titulo` per DB row | No native JOIN in Sheets; each table filterable standalone |
| Explicit save (button + menu) | Avoids saving partial weighings; user controls close of shift |
| Compute `peso_neto` in Script | DB stores value, cell formula remains UX aid |

## 6. Functional Requirements

### 6.1 Operative & Save

| ID | Requirement | Priority |
| ---- | ------------- | ---------- |
| **FR-001** | Single operative sheet `Operativa` is the only entry point. `F4` is a datepicker (`DATE`); `J4` is read-only formula `ELEGIR(DIASEM(F4,2),…)`. Changing `F4` does not auto-clear the grid. | Must |
| **FR-002** | `Standards B10:C19` is the reference `Título → Kg por 1 Frente`. `D33:D42` (Título Asignado) validates against `Standards` via `dataValidation`. Unknown title blocks save for that row. | Must |
| **FR-003** | Calculator block `E10:H24` remains helper (`G10=SI.ERROR(BUSCARV…)`, `H10=F10*G10`). Its values are never written to DB. | Must |
| **FR-004** | On `Yarn → Guardar Turno` (or drawing button bound to `guardarTurno()`), validate: `F4` is a valid date; at least one assignment row complete (`retorcedora + titulo + frentes`) or one weighing complete (`peso_bruto` numeric) is required. `F4` empty → toast, no write. | Must |
| **FR-005** | Save is **upsert** per PK, not append: `DB_Asignaciones` PK `(fecha, retorcedora)`; `DB_Descargas` PK `(fecha, retorcedora, descarga_nro, lado)`. Re-saving the same `fecha` updates in place, does not duplicate. | Must |
| **FR-006** | `peso_neto` is computed in Apps Script as `bruto − (usos × peso_cono + peso_tacho)` with null→0, rounded to 2 decimals, stored as value. Cell `I50` remains for UX but DB is source of truth. | Must |
| **FR-007** | After save, toast `✅ Guardado: {fecha} — {N} asignaciones, {M} descargas ({kg} kg)`. On lock/execution failure, log to `Errors` and toast `❌ Error — use Re-sincronizar`. | Must |
| **FR-008** | Optional post-save prompt `¿Limpiar operativa para próximo turno?` — `Yes` clears `C33:E42` + `E50:H157` (leaves `B10:C19`, `F4`); `No` keeps values. Never auto-clears. | Should |
| **FR-009** | Menu `Yarn → Guardar Turno | Ver DB_Descargas | Ver DB_Asignaciones | Re-sincronizar operativa | Ver Dashboard` | Should |

### 6.2 DB Reads & Dashboard

| ID | Requirement | Priority |
| ---- | ------------- | ---------- |
| **FR-010** | `Resumen por Título (8h)` is a `QUERY` over DBs: `Objetivo = SUM(DB_Asignaciones.prod_turno WHERE fecha=F4 GROUP BY titulo)`; `Real = SUM(DB_Descargas.peso_neto WHERE fecha=F4 GROUP BY titulo)`; `Cumplido/Falta` via `IF(Real>=Objetivo)`. No `UNIQUE(FILTER)` on operative. | Must |
| **FR-011** | Chart `Objetivo vs Producción` sources `Dashboard` queries, not operative `L33:P`. | Must |
| **FR-012** | Re-saving a past `fecha` overwrites that date's rows in both DBs. No delete — correct by overwriting; to logically remove a row, clear its operative cells and save (row removed or `peso_neto` recalculated). | Must |

## 7. Non-Functional Requirements

| ID | Category | Requirement | Notes |
| ---- | ---------- | ------------- | ------- |
| NFR-01 | Performance | Single save <2s; full day (80 weighings) <5s | Batch `getValues`/`setValues` |
| NFR-02 | Quotas | No external calls | `90 min/day`, `20k` fetches |
| NFR-03 | Reliability | `LockService.getDocumentLock()` per save (5s, retry 1) | Queue failed via menu |
| NFR-04 | Locale | Spanish formulas verbatim; `valueRenderOption=FORMULA` | `SI.ERROR`/`BUSCARV`/`DIASEM` |
| NFR-05 | Timezone | `America/La_Paz` (UTC-4) for timestamps | `Utilities.formatDate(...,"America/La_Paz","yyyy-MM-dd")` |
| NFR-06 | Maintainability | No npm/pip; `apps-script/yarn-settings/` via `clasp`; helper tooling under `tools/` | Built-ins only |
| NFR-07 | Observability | `Logger` + toast; optional `Errors` sheet | Log validation failures |
| NFR-08 | Data integrity | DB headers protected/frozen; order frozen | Never reorder cols |

## 8. Data Model

> Order frozen. `Operativa` is UX only. DB sheets are upsert targets. Fields below are the minimal set — correct directly in this section before SDD. Types are Sheets types.

### 8.1 `Standards` — Master

| # | Col | Type | Example | Description |
|---|-----|------|---------|-------------|
| A | `titulo` | STRING | `24` | PK — hilo title |
| B | `kg_por_frente` | NUMBER | `120` | Kg per 1 front |

> Row order is not significant; `titulo` is unique. `lote_std_kg` (204) is a constant in formulas unless moved to this table — reviewer to confirm.

### 8.2 `DB_Asignaciones` — Plan per machine per day (≤10 rows/day)

| # | Col | Type | Example | Description |
| --- | ----- | ------ | --------- | ------------- |
| A | `id` | STRING | `2026-09-03-R01` | `fecha-retorcedora` |
| B | `fecha` | DATE | `2026-09-03` | From `F4` |
| C | `retorcedora` | STRING | `Retorcedora 1` | `B33` label |
| D | `cabos` | NUMBER | `4` | `C33` |
| E | `titulo_asignado` | STRING | `9` | `D33` |
| F | `frentes_asignados` | NUMBER | `4` | `E33` |
| G | `prod_dia` | NUMBER | `1000` | `F33` snapshot (`frentes × kg`) |
| H | `prod_turno` | NUMBER | `333.33` | `G33` snapshot (`prod_dia/3`) |
| I | `lotes_dia` | NUMBER | `4.90` | `H33` snapshot (`prod_dia/204`) |

> PK `(fecha, retorcedora)` → `findRow→update else append`. `prod_*` stored as value at save time.

### 8.3 `DB_Descargas` — Weighings (≤80 rows/day)

| # | Col | Type | Example | Description |
| --- | ----- | ------ | --------- | ------------- |
| A | `id` | STRING | `2026-09-03-RET-1A-01` | `fecha-ret-lado-desc` |
| B | `fecha` | DATE | `2026-09-03` | Denormalized copy |
| C | `retorcedora` | STRING | `Retorcedora 1` | `B48` |
| D | `descarga_nro` | NUMBER | `1` | `B50` 1..4 |
| E | `lado` | ENUM | `A` | `C50` A/B |
| F | `titulo` | STRING | `9` | Copied from `D33` at save |
| G | `peso_bruto` | NUMBER | `60.0` | `E50` |
| H | `usos` | NUMBER | `40` | `F50` |
| I | `peso_cono` | NUMBER | `0.037` | `G50` |
| J | `peso_tacho` | NUMBER | `15.2` | `H50` |
| K | `peso_neto` | NUMBER | `43.32` | `G − (H×I + J)` computed in Script |

> PK `(fecha, retorcedora, descarga_nro, lado)`. Denormalizing `fecha/titulo` avoids `JOIN`.

### 8.4 PK & Indexes

| Constraint | Definition |
| ------------ | ------------ |
| `Standards` PK | `titulo` |
| `DB_Asignaciones` PK | `(fecha, retorcedora)` |
| `DB_Descargas` PK | `(fecha, retorcedora, descarga_nro, lado)` |
| Secondary views | Filter by `fecha`, `titulo`, `retorcedora` via `QUERY` |

### 8.5 Storage Estimate

`DB_Asignaciones` 10×365=3.6k/yr, `DB_Descargas` 80×365=29k/yr → ~33k rows/yr — within 10M cells.

## 9. Edge Cases & Business Rules

| # | Edge Case | Rule |
| --- | ----------- | ------ |
| EC-01 | `F4` empty / invalid | Block save, toast `⚠️ Seleccioná fecha válida`, no write |
| EC-02 | Unknown `titulo` not in `Standards` | Block row, toast `⚠️ Título no existe en Standards`, log `Errors`, skip row |
| EC-03 | Empty weighings (no `peso_bruto`) | Skip row — no DB row created |
| EC-04 | Re-save same `fecha` | Upsert — existing rows updated, not duplicated |
| EC-05 | Timezone | `America/La_Paz` for timestamps |
| EC-06 | Concurrency | `LockService.getDocumentLock()` per save (5s, retry 1) |
| EC-07 | Calculator block `E10:H24` | Never persisted; helper only |

## 10. UX / Flow

### 10.1 Happy Path — One Shift

```
Pick F4=2026-09-03 → J4=JUEVES auto
 → fill C33:E42 (e.g. 6 of 10 machines), fill E50:H53 for R1 (2 weighings)
 → Yarn → Guardar Turno (or button)
  → validate F4, VLOOKUP, numeric bruto
  → Lock → upsert DB_Asignaciones (6 rows) + DB_Descargas (2 rows)
  → toast "✅ Guardado: 2026-09-03 — 6 asign, 2 desc (86.64 kg)"
```

### 10.2 Dashboard After Save

`Dashboard!A1 =QUERY(DB_Asignaciones,"select E,sum(H) where B=date '2026-09-03' group by E label E 'Título', sum(H) 'Objetivo'")`
`Dashboard!D1 =QUERY(DB_Descargas,"select F,sum(K) where B=date '2026-09-03' group by F label F 'Título', sum(K) 'Real'")`
Chart `Objetivo vs Producción` sources `Dashboard`.

### 10.3 Error Handling

| Scenario | UX |
| ---------- | ---- |
| `Standards` missing | Toast `⚠️ Standards no accesible` + log |
| Lock timeout | `⏳ ocupado, reintentando…` → retry → `❌ Use Re-sincronizar` |
| Invalid `titulo` | Toast `⚠️ Título no existe en Standards`, row skipped |

### 10.4 Menu

```
Yarn → Guardar Turno | Ver DB_Descargas | Ver DB_Asignaciones | Re-sincronizar operativa | Ver Dashboard
```

## 11. Out of Scope for v1

| Item | Why deferred |
| ------ | -------------- |
| Multi-turno UI (3×/day) | Single save per `fecha` suffices; `turno` not modeled |
| Email/WhatsApp alerts | Infra |
| Web form | Sheets UX stays |
| Automatic per-cell save | Intentionally manual — explicit close |
| Undo UI | Sheets version history suffices |

## 12. Open Questions — Correct Before Spec

| # | Question | Recommendation | Decision |
| --- | ---------- | ---------------- | ---------- |
| Q1 | `titulo` type string vs number? | String | [ ] |
| Q2 | `prod_dia/lotes` snapshot vs derive? | Snapshot at save | [ ] |
| Q3 | Keep `Calculator` block? | Helper only, not persisted | [ ] |
| Q4 | Retention? | Infinite, 33k/yr fine | [ ] |

## 13. Next Steps

| Step | Owner | Artifact / Command | Exit |
| ------ | ------- | -------------------- | ------ |
| 1. Correct §8 fields | Stakeholder | Edit this file | Approved |
| 2. SDD Propose | Tech | `sdd-propose` on `yarn-settings` | Accepted |
| 3. SDD Spec | Tech | `sdd-spec` Given/When/Then | Reviewed |
| 4. SDD Design | Tech | `sdd-design` | Approved |
| 5. SDD Tasks | Tech | `sdd-tasks` | Ready |
| 6. Implement | Tech | `sdd-apply` in `apps-script/yarn-settings/` on copy | Verified |
| 7. Verify & Rollout | Tech | `sdd-verify` → prod | Live |

## Appendix A — Constraints Compliance

| Constraint | Compliance |
| ------------ | ------------ |
| No npm/pip | Built-ins only (`SpreadsheetApp`, `LockService`, `Session`, `Utilities`) |
| Project-dir tooling | `clasp` under `tools/` if used, never `/tmp` |
| Spanish formulas | Keep `SI.ERROR`/`BUSCARV`/`DIASEM`/`ELEGIR` verbatim via `valueRenderOption=FORMULA` |
| Timezone | `America/La_Paz` everywhere |

## Appendix B — Glossary

| Term | Meaning |
| ------ | --------- |
| Operativa | Single reusable sheet — UX, not DB |
| Standards | Master `titulo→kg` |
| DB_Asignaciones | Plan per `retorcedora` per `fecha` |
| DB_Descargas | Weighing per `descarga/lado` per `retorcedora` per `fecha` |
| Dashboard | `QUERY` view of the two DBs — never stored |

*End of PRD v0.1.0 — awaiting field corrections in §8.*
