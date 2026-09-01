# Control de Asistencia — Product Requirements Document

| Field | Value |
|-------|-------|
| **Version** | 0.3.6 |
| **Author** | [Placeholder — assign owner] |
| **Date** | 2026-08-31 |
| **Status** | Draft - Registro headers ES |
| **Source** | Google Sheet `1GrZ_9w3CPvsJ22nVCndFojkhrhGmFGY8XcLQrtW7jTs` (native, converted 2026-08-31 from `1iw9bduLeGXQMbjmMV1qrMqE2WoPWCBz3` xlsx; gid `740536758` = Preparacion) |
| **Repo** | `/home/luis-cm/Documents/Github/Control-de-Asistencia` |
| **Evidence** | `docs/playwright-evidence/Preparacion-analysis.md` (playwright-cli 0.1.18) |

> §2 + §6 = 2-min version. §7–§10 = implementation detail.

## 1. Quick Path

1. **Problem:** N cloned attendance sheets (initially 6) — no central DB, no audit, no reporting.
2. **Decision:** Keep N attendance sheets as entry. Centralize every mark into `Registro` via Apps Script `onEdit` + Sheets API v4 (not DOM scraping — §5.3/§6).
3. **Verify:** After PRD approval → SDD `propose → spec → design → tasks` (§14).

## 2. Executive Summary

Attendance for ~180 operators (initially 6 × 30, scalable to N sheets) lives in N identical attendance sheets. Querying "all absences for X in March" requires opening all N. `Registro` exists but is empty.

| Pain | Impact |
|------|--------|
| Data across N sheets | No cross-section reporting |
| `Registro` empty | No history |
| Summary `%` via fragile `CONTAR.SI`/`MAX` | Breaks on paste/calendar/moves |
| No audit trail | Corrections invisible |
| `Apoyo` manual | Support hours not in history |
| Calendar depends on `Hoja2` | Deleting `Hoja2` blanks weekdays |

**Solution:** On every valid edit (`A`/`AT`/`BM`/`F`) in `E15:AI44` on any attendance sheet detected via structure (not hardcoded list): resolve operator + date + section (alias or sheet name), upsert one row in `Registro` keyed by `(section, operator_name, date)` with `LockService`, handle clears/bulk/month/`Apoyo`. `Registro` = DB; sheets = UX.

## 3. Goals / Non-Goals

**Goals v1:** Every valid mark in `Registro` within seconds; corrections update in place; clears → `void`; bulk paste + month change handled; `Apoyo` flagged; one-time backfill.

**Non-Goals v1:** Replacing N-sheet attendance UX (initially 6); dashboards; notifications; payroll; rewriting `AJ:AM`; DOM/canvas scraping.

## 4. Stakeholders & Actors

| Actor | Role | Needs |
|-------|------|-------|
| Operario | Factory operator (row) | Correct daily mark |
| Responsable por Sección | Section supervisor | Fast entry, bulk paste, correction, toast |
| RRHH / Admin | HR — consumes `Registro` | Filterable history, audit |
| Owner / Maintainer | Apps Script owner | Simple deploy, no ext deps |

**Per-section responsible:** Each attendance sheet has its own responsible. `Config!A:B` is an **optional alias** (`sheetId` or current sheet name → display name); if present it provides the `section` value stored in `Registro` and the `responsible(section)` email. If absent, `section` = sheet's current name and responsible falls back to the `RESPONSABLE` header cell on that sheet. `responsible = ConfigAlias(section) ?? headerCell`. Window `today / today-1` (`America/La_Paz`, FR-013). Older dates → RRHH via `Asistencia → Solicitar corrección / Registro manual` (`via_manual` audited). Adding a new sheet (clone template) or renaming a sheet requires no code change — detection is structural (see §5.1) and alias is optional.

**Permission:** Responsables edit only own attendance sheet within window; out-of-window/cross-section → toast, no write, log `Errors`. RRHH reads `Registro` + override via menu. Writes as owner via **installable trigger** (anon cannot write — §5.3, NFR-04).

## 5. Current State Analysis

### 5.1 Sheet Inventory (10 sheets initially — N attendance sheets, variable)

| Sheet | Purpose | State |
|-------|---------|-------|
| `- AYUDA -` | Instructions (ignorable) | Static help (gid `1765343219`) |
| `Preparacion` | Attendance — input (initial) | Template A1:AM44, 30 ops (gid `740536758`) |
| `Continua` | Attendance — input (initial) | Same template |
| `Acoplado` | Attendance — input (initial) | Same template |
| `Retorcedoras` | Attendance — input (initial) | Same template |
| `Madejeras` | Attendance — input (initial) | Same template |
| `Producto Terminado` | Attendance — input (initial) | Same template |
| `Registro` | Central DB (target) | **Empty** — schema §9 |
| `Apoyo` | Cross-section support — growing log table (eventual, not daily) — **fixed** | `A2:E2` header Fecha \| Operador \| Sección Destino \| Motivo \| (Horas/empty); `A3:E1000` data, eventual not daily, no window/code, per-row incremental (whole-table scan only on Backfill) |
| `Hoja2` | Hidden lookup | Months A1:B12 + weekday D1:E7 — **critical** |

> **Scalable attendance sheets (v0.3.5):** The workbook starts with 6 attendance sheets but the count and names are variable — sheets can be added (clone template) or renamed without code changes. An **attendance sheet** is any sheet that structurally matches the template: contains the input zone `E15:AI44`, the calendar controls `S7:U7`/`S9:U9` with `V9`/`W7`/`E11:AI13` via `Hoja2`, and header `C13` `Nombres y Apellidos`. Detection is via structure, not a hardcoded name list. Sheets in the ignorable list — `Registro`, `Config`, `Errors`, `Hoja2`, `- AYUDA -`, `Apoyo` — are never treated as attendance sheets. `Apoyo` stays fixed (single sheet, not scalable). `Config!A:B` is an **optional alias** (`sheetId` or current sheet name → display name); if present, its value is used as `section` in `Registro`, otherwise `section` = sheet's current name. Never hardcode the 6 names.

### 5.2 Template Mechanics — Verified Formulas (Spanish locale `es-BO`)

> Source: Playwright name-box (`input#t-name-box` + `div#t-formula-bar-input`) on `Preparacion`. Merged `S7:U7`/`S9:U9` → `A1:B1`.

| Range | Formula / Value (verbatim) | Meaning | Dependency |
|-------|----------------------------|---------|------------|
| `S7:U7` | `2026` (merged, holder `S7:U7`) | Year | `$S$7` |
| `S9:U9` | `Septiembre` (merged) | Month name | `Hoja2!A1:B12` |
| `V9` | `=+BUSCARV(S9,Hoja2!$A$1:$B$12,2,FALSO)` | Month 1–12 | `Hoja2!A1:B12` |
| `E13:AI13` | `1 … 30` | Day 1..31 | Regen on `S7`/`S9` |
| `E11:AI11` | `=+E13&"/"&$V$9&"/"&$S$7` | Date `D/M/YYYY` | `$V$9`+`$S$7` |
| `E12:AI12` | `=+SI.ERROR(BUSCARV(DIASEM(E11,2),Hoja2!$D$1:$E$7,2,FALSO),"")` | Weekday `L/M/X/J/V/S/D` | `Hoja2!D1:E7`; `DIASEM(d,2)`=Mon1 |
| `W7` | `=+CONTAR.SI($E$12:$AI$12,"S")+CONTAR.SI($E$12:$AI$12,"D")` | Weekend count | Divisor offset |
| `AJ15:AM15` | `=+CONTAR.SI($E15:$AI15,AJ$10)/(MAX($E13:$AI13)-$W$7)` | % per code | `AJ$10:AM$10`=A,AT,BM,F |

Locale: `SI.ERROR`=`IFERROR`, `BUSCARV`=`VLOOKUP`, `DIASEM`=`WEEKDAY`, `CONTAR.SI`=`COUNTIF`. Leading `=+` tolerated. Use `valueRenderOption=FORMULA`.

| Code | Meaning | Handling | Evidence |
|------|---------|----------|----------|
| `A` | Asistencia | Counted `AJ` | `E15=A` |
| `F` | Falta | Counted `AK` | `streamrows` |
| `AT` | Atraso / Tardanza | Separate | `F15=AT` |
| `BM` | Baja Médica | Separate | `streamrows` + `12575222` |
| *(empty)* | No mark | Ignored | `H15=""` blank allowed |

Validation: `streamrows` 4 entries (`A,AT,BM,F`) + `ARRAYFORMULA(OR(TRIM(EXACT(...))))` on `E15:AI44`; `t-text-color-cond-fmt` exists. Blank allowed. Calendar dynamic — `S7:U7`/`S9:U9` regen `E11:AI13`; blank `E11` (`SI.ERROR→""`) → ignore column. `Hoja2` critical — deletion blanks `E12`/`W7`. Merged ranges → `trim` + accept `S7:U7`. Writes strictly `E15:AI44`.

> **v0.3.4 — Month/year change carryover (stakeholder confirmed, Option 1):** Changing `S7:U7` (year) or `S9:U9` (month) currently only recalculates `E11:AI11`/`E12:AI12` via Sheet formulas (`V9`/`W7` etc.) and does **not** clear `E15:AI44`, causing visual carryover (previous month's codes remain visible under new dates). Desired behavior is **confirm + reload from `Registro`** — see FR-006 and §11.8. `isCalendarRange` no longer returns early with zero writes; it triggers the confirmation dialog and, on Yes, clears + repopulates `E15:AI44` from `Registro` for the selected section/month/year (read-only; never creates `Registro` rows directly).

### 5.3 Playwright Deep Dive (Preparacion, gid 740536758)

Verified live via `playwright-cli 0.1.18` anonymous view-only: grid is single `<canvas>` 1264×524 (`freezebar-handle` intercepts clicks, snapshot has no cell text); name-box navigation (`input#t-name-box` + `div#t-formula-bar-input` + `streamrows`/`selection`) is only reliable method; Spanish formulas confirmed; anon cannot write (Share disabled, `401`).

Full dump in `docs/playwright-evidence/Preparacion-analysis.md`.

## 6. Proposed Solution Overview

```
N Attendance Sheets (E15:AI44 + S7:U7/S9:U9/V9, detected via structure) ──onEdit──▶ Apps Script (validate A/AT/BM/F, resolve op+date, section=alias??sheetName, upsert/delete, bulk, es-BO) ──API v4──▶ Registro (PK section,operator,date)
                                                                   ▲
                         Apoyo (fixed, A2:E2 header, A3:E1000 growing table, per-row) ───────┘  is_apoyo=TRUE, code=""
```

| Principle | Rationale |
|-----------|-----------|
| Keep sheets as entry | Zero retraining |
| `Registro` = source of truth | One queryable sheet |
| Idempotent upsert | No duplicates |
| Silent + recoverable (toast) | Never blocks edit |
| No external deps | Built-ins only |
| Sheets API v4 + `onEdit`, never DOM scraping | Canvas has no DOM cells (§5.3) |

## 7. Functional Requirements

### 7.1 Automatic Capture

| ID | Requirement | Priority |
|----|-------------|----------|
| **FR-001** | On edit in `E15:AI44` on **any attendance sheet detected via structure** (not hardcoded 6; ignorable list `Registro/Config/Errors/Hoja2/- AYUDA -/Apoyo` excluded; template check `E15:AI44 + S7:U7/S9:U9 + Hoja2` / `C13` header), capture `(section, operator_name, date, code, edited_by, timestamp, source_range, is_apoyo, nota, status)` and upsert into `Registro` after FR-013 gate. `section` = `Config!A:B` alias (`sheetId` or current sheet name → display name) if present, else sheet's current name. Date via `E11:AI11` (`=+E13&"/"&$V$9&"/"&$S$7`); gate: `activeUser==responsible(section)` (`Config!A:B` alias or header) AND `fecha_col∈{today,today-1}` Lima. Fail → toast + optional revert, no write. | Must |
| **FR-002** | `Registro` schema fixed (§9); header frozen, never reordered. Col `L` (`nota`) is optional per-cell nota for any code (FR-014) — empty default, overwrite, no history; set via menu + optional `setNote()`. | Must |
| **FR-003** | Clearing a cell sets `status=void` (soft-delete). | Must |
| **FR-004** | Correction (`F→A`) updates row in place, `updated_at` refreshed. | Must |
| **FR-005** | Bulk paste: each cell in `paste∩E15:AI44` with valid `E11` processed individually; toast `N ins / M upd / K void`. | Must |
| **FR-006** | Calendar change with confirm and reload — On edit of `S7:U7` (year) or `S9:U9` (month) (`isCalendarRange`) on **any attendance sheet (scalable detection, §5.1)**, show confirmation dialog `¿Cambiaste a [Month Year], recargar desde Registro? Esto limpiará E15:AI44 y cargará los registros de ese mes desde Registro.` — `E11:AI11`/`E12:AI12` still recalc via Sheet formulas (`V9`/`W7`). If user confirms **Yes**: clear `E15:AI44` content and notes (`clearContent` + `clearNote`), then read `Registro` filtered by `section = alias ?? sheetName` (current sheet's resolved section) and `date` between first and last day of selected month/year, and repopulate `E15:AI44` with `code` and `setNote` with `nota` where exists. If user cancels **No**: do nothing (leave grid as is, no `Registro` writes, no clear). Changing month/year **never** creates `Registro` rows directly; only repopulation reads. Revert (e.g. Sept → Aug) follows same flow and reloads the target month's view from `Registro`. | Must |
| **FR-007** | `Apoyo` is growing log table `A2:E2` header Fecha \| Operador \| Sección Destino \| Motivo \| (Horas/empty), data `A3:E1000` — eventual, not daily mandatory, distinct from attendance sheets (no window, no code validation, no Agregar nota flow). No `today/today-1` window (`America/La_Paz`) and no `A/AT/BM/F` validation; Motivo optional; Horas col unused; any Fecha valid as stored. Automatic registration is **per-row incremental**: only the edited row(s) `A3:E1000` that become **complete** (`Fecha` valid ISO + `Operador` non-empty + `Sección Destino` non-empty) are upserted to `Registro` with `is_apoyo=TRUE`, `code=""`, `code_label=""`, `nota=Motivo` (trimmed, may be empty), `date=Fecha` as stored; intermediate/partial edits are silent (no error toast, no write). `D=Sección Destino`, `L=Motivo`. No whole-table scan on normal `onEdit`; whole-table scan only for Backfill (idempotent). | Must |
| **FR-008** | Only `A,AT,BM,F` (and empty) accepted; other → toast, no write. | Must |
| **FR-009** | One-time backfill: scan **all attendance sheets detected via structure** (§5.1, not hardcoded 6) `E15:AI44` where `E11` valid + non-empty → upsert (`section` = alias ?? sheetName). Idempotent. Handle merged `S7:U7`. `Apoyo` excluded from this scan (handled separately in FR-007). | Must |
| **FR-010** | Every row stores `edited_by` (email or `unknown`) and `edited_at` in `America/La_Paz`. | Should |
| **FR-011** | Menu `Asistencia → Ver Registro / Re-sincronizar / Agregar/editar nota a celda activa / Solicitar corrección / Registro manual / Backfill` (correction/bypass via menu audited; nota via modal §11.6, window-gated). | Should |
| **FR-012** | Mapping `A→Asistencia, F→Falta, AT→Tardanza, BM→Baja Médica` in config, not hardcoded. | Should |
| **FR-013** | Window + permission: `fecha_col==today OR today-1` Lima (`Utilities.formatDate(new Date(),"America/La_Paz","yyyy-MM-dd")` from `E11` ISO). Gate: `activeUser==responsible(section)` (`Config!A:B` alias ?? header) AND `fecha_col∈{today,today-1}`. `section` = alias if `Config!A:B` maps this sheet, else sheet name. Applies to code writes **and** `nota` updates (FR-014) on any attendance sheet (scalable detection). Blocked → toast `⛔ Solo podés registrar hoy y ayer…`, optional revert, no write, log `Errors`. RRHH override via menu (`via_manual`). Per-cell for bulk. | Must |
| **FR-014** | Optional per-cell `nota` for **any** code (`A/AT/BM/F`) stored per `record_id` in `Registro!L`; empty (`""`) if omitted. No history/bitácora — `nota` overwrites current value (no version table). Entry via `Asistencia → Agregar/editar nota a celda activa` HtmlService modal (pre-filled with current `Registro!L` if exists) that updates same `record_id`'s `L` and cell `Note` via `setNote()` / `clearNote()`. Rapid/dropdown entry in `E15:AI44` (incl. data validation, bulk paste) saves code immediately with `nota=""` and no per-cell modal — menu is persistent post-bulk. Every atomic action has its own toast: code `✅ Registrado`, nota save `✅ Nota guardada`, nota update `✅ Nota actualizada`, nota delete `🗑️ Nota borrada`. Visualize without opening: hover shows cell `Note` (`"F — motivo"`) and `Registro!L` is filterable list. Menu gated by FR-013 window + permission; out-of-window/blocked → toast, no write, log `Errors`, audited via `edited_by`. If active cell has no existing `Registro` row (code not yet registered) → toast `⚠️ No hay registro para esta fecha — primero marcá el código.` — nota alone creates no row. | Must |

### 7.2 User Stories

| Story | As a… | I want… | So that… | FR |
|-------|-------|---------|----------|----|
| US-01 | Responsable | type `F` and save centrally | no dupe work | FR-001 |
| US-02 | Responsable | correct `F→A` | correction, not duplicate | FR-004 |
| US-03 | Responsable | clear a mark | voided | FR-003 |
| US-04 | Responsable | paste row of marks | 31 days w/o per-cell | FR-005 |
| US-05 | Responsable | change `S9:U9` month | calendar w/o pollution | FR-006 |
| US-06 | RRHH | filter `Registro` by op/section/month/code | reports w/o opening N sheets | FR-001 |
| US-07 | RRHH | see who/when | audit | FR-010 |
| US-08 | Responsable | log `Apoyo` | traceable | FR-007 |
| US-09 | Responsable | correct yesterday (`today-1` Lima) | fix w/o RRHH | FR-013 |
| US-10 | Responsable | add/edit optional per-cell nota via menu to any code (`A/AT/BM/F`) after rapid entry, with distinct toast per action | add context per day without slowing dropdown/bulk flow and get confirmation per atomic action | FR-014 |

## 8. Non-Functional Requirements

| ID | Category | Requirement | Notes |
|----|----------|-------------|-------|
| NFR-01 | Performance | Single <2s; 30-cell paste <10s | Batch `getValues`/`setValues` |
| NFR-02 | Quotas | 90 min/day, 20k fetches, 50 MB — no ext calls | Backfill heaviest |
| NFR-03 | Reliability | `LockService.getDocumentLock()` per write (5s, retry 1). Window before lock | Queue failed via menu |
| NFR-04 | Permissions | Installable trigger as owner; simple `onEdit` for toast; attendance sheets detected via structure; `Config!A:B` optional alias (sheetId/name → display) | Anon `401` cannot write |
| NFR-05 | Timezone | `America/La_Paz` (UTC-4) everywhere — window via `Utilities.formatDate(...,"America/La_Paz","yyyy-MM-dd")` | Never UTC/browser |
| NFR-06 | Maintainability | No npm/pip. `apps-script/` via `clasp`; Spanish formulas verbatim | `tools/` only |
| NFR-07 | Observability | `Logger` + toast; optional `Errors` sheet | Log `Hoja2`/merged failures |
| NFR-08 | Data integrity | `Registro` header protected/frozen; `Hoja2` protected | Never reorder cols |

## 9. Data Model — `Registro`

### 9.1 Columns (13 cols A:M, fixed order)

| # | Col | Type | Example | Description |
|---|-----|------|---------|-------------|
| A | `id` | STRING | `PREP-001-2026-03-15` | PK `seccion-operador-fecha` |
| B | `creado` | DATETIME | `2026-08-30 14:22:05` | First insert (Lima) |
| C | `actualizado` | DATETIME | `2026-08-30 15:00:12` | Last update |
| D | `seccion` | STRING | `Preparacion` | Attendance sheet resolved as `Config!A:B` alias (`sheetId`/name → display name) if present, else sheet's current name (scalable, not hardcoded enum); `Apoyo`→`D=Apoyo!C3:C1000` (Sección Destino) |
| E | `operador` | STRING | `Juan Pérez` | Col B or `Apoyo!B3:B1000` (Operador) |
| F | `fecha` | DATE | `2026-03-15` | ISO from `E11:AI11` (attendance, window-gated) or `Apoyo!A3:A1000` Fecha as stored (any date, no window) |
| G | `codigo` | ENUM | `F` | `A/AT/BM/F`; for `es_apoyo=TRUE` → `""` (no code) |
| H | `descripcion` | STRING | `Falta` | Via mapping; for `es_apoyo=TRUE` → `""` |
| I | `es_apoyo` | BOOLEAN | `FALSE` | `TRUE` if from `Apoyo` growing table `A3:E1000` (no window/code, `codigo=""`) |
| J | `editado_por` | STRING | `resp.prep@factory.pe` | Email or `unknown` |
| K | `rango_origen` | STRING | `Preparacion!G22` | A1 traceability |
| L | `nota` | STRING | `apoyo en conera 4` / `""` | Optional per-cell nota for **any** attendance code (`A/AT/BM/F`), empty (`""`) default; no history — overwrites. Set via menu `Agregar/editar nota a celda activa` → `Registro!L` + `setNote()`. For `es_apoyo=TRUE` rows `L=Motivo` (`Apoyo!D3:D1000`, trimmed, may be empty); Horas col unused; nota flow does not apply to Apoyo (no code/nota modal). |
| M | `estado` | ENUM | `active` | `active`/`void` |

> `weekday`/`month`/`year` not stored — derive from `F`.

> Storage model: attendance sheets are whole-month views, Apps Script saves only changed marks via incremental upsert per cell. `F` is temporal key; month view via `FILTER`/`QUERY` by `F`. `Apoyo` (fixed) is growing table `A2:E2` header Fecha \| Operador \| Sección Destino \| Motivo \| (Horas/empty), `A3:E1000` eventual — per-row incremental upsert (any date, no window/code, `code=""`, `L=Motivo`); whole-table scan only for Backfill (idempotent). `section` is alias or sheet name, not a hardcoded enum — adding/renaming sheets needs no code change.

> `L` (`nota`): for attendance rows, optional per-cell nota for any code, `""` default, no history — overwrites. Code edits via `onEdit` leave `L` untouched unless set via menu modal; `nota` edits update `L` + `setNote()` on same `record_id` (FR-014). For `is_apoyo=TRUE` rows, `L=Motivo` (`Apoyo!D`) at insert; Horas col unused; `nota` modal/window rules do not apply to Apoyo.

### 9.2 PK & Indexes

| Constraint | Definition |
|------------|------------|
| PK | `(section, operator_name, date)` ≡ `record_id`; `findRow(PK)→update else append` |
| Secondary | Filter views: `by operator_name`, `by section+date(F)`, `by code`, `by is_apoyo` |
| Dedup | Lookup `record_id`; if found update `code/label/updated_at/edited_by/source_range/nota`, reactivate if `void` |

### 9.3 Storage Estimate

N×30×31×12 ≈ **66,960 rows/year** for N=6 worst (scales linearly with N); ~30k realistic for N=6 — within 10M cells.

## 10. Edge Cases & Business Rules

| # | Edge Case | Rule |
|---|-----------|------|
| EC-01 | Weekends S/D (`E12`=S/D) | Recordable; `W7` display-only. Validate `Hoja2!D1:E7`; no `is_weekend` col |
| EC-02 | Month boundaries (blank `E11` `SI.ERROR→""`) | Check `E11` valid; blank→ignore. Normalize `S7:U7`/`S9:U9`; `MAX(E13:AI13)` for length |
| EC-03 | Operator moves sections | PK includes `section` → two rows (intentional) |
| EC-04 | Duplicate `operator_name` | Warning + row tiebreaker; don't block others |
| EC-05 | Timezone & locale | `America/La_Paz`; Spanish `SI.ERROR`/`BUSCARV`/`DIASEM`/`CONTAR.SI` verbatim |
| EC-06 | Concurrent edits | `LockService` (5s, retry 1s → toast + queue) |
| EC-07 | Per-section permission (scalable) | `activeUser==responsible(section)` + window; installable as owner; attendance sheets detected via structure; `section` = `Config!A:B` alias (`sheetId`/name → display) ?? sheet name; `Apoyo` fixed, not scalable |
| EC-08 | Row insert/delete | Resolve operator via col A/B of edited row dynamically |
| EC-09 | Sheet rename / placeholder / `Hoja2` (scalable) | Attendance sheets detected via structure, not name; `Config!A:B` is optional alias (`sheetId` or current name → display), not required — unmapped sheet uses its current name as `section`. Validate `Hoja2!A1:B12`/`D1:E7` on install+`onEdit`. `Hoja2` never treated as attendance sheet |
| EC-10 | Manual `Registro` edits | Discouraged; next upsert overwrites `code`/`updated_at`, preserves `created_at` |
| EC-11 | Grace window `today/today-1` | ISO `fecha_col` vs Lima `today/today-1` (`Utilities.formatDate`); per-cell; RRHH bypass audited |
| EC-12 | Nota optional per-cell (any code) — toast per action + view/edit | `Registro!L` (`nota`) optional for any code (`A/AT/BM/F`), `""` default, no history — overwrites current value. Rapid dropdown/bulk (`E15:AI44` with data validation) saves code with `nota=""` and no per-cell modal; menu is persistent post-bulk. Toast per atomic action: code `✅ Registrado`, nota save `✅ Nota guardada`, nota update `✅ Nota actualizada`, nota delete `🗑️ Nota borrada`. **Visualize:** hover shows cell `Note` via `setNote()` (`"F — motivo"`); `Registro!L` is filterable list. **Edit:** `Asistencia → Agregar/editar nota a celda activa` opens modal pre-filled with current `Registro!L` if exists; user can edit, clear (empty → `clearNote()` + `L=""`), or cancel. If no `record_id` yet → `⚠️ No hay registro para esta fecha — primero marcá el código.` (nota alone creates no row). Window-gated (FR-013) + permission; out-of-window/blocked → toast `⛔ Solo podés registrar hoy y ayer…`, no write, log `Errors`. Subsequent code correction preserves `nota` unless overwritten via menu. `setNote()` mirror is view aid, never source of truth. |
| EC-13 | Apoyo — partial row silent, table growth, no window/code, per-row only | Growing table `A2:E2` header Fecha \| Operador \| Sección Destino \| Motivo \| (Horas/empty), data `A3:E1000` eventual (not daily). Per-row incremental: only edited row(s) `A3:E1000` are evaluated. Intermediate/partial edits (missing `Fecha`/`Operador`/`Sección Destino` or invalid `Fecha`) are **silent** — no error toast, no `Registro` write — to allow user to fill row over time. Row becomes **complete** when `Fecha` is valid ISO + `Operador` non-empty (trimmed) + `Sección Destino` non-empty → upsert `is_apoyo=TRUE`, `code=""`, `code_label=""`, `nota=Motivo` (trimmed, may be empty), `date=Fecha` as stored; Horas col unused. Any date valid (no `today/today-1` window), no `A/AT/BM/F` validation, no `Agregar nota` modal. Subsequent edit to same row that keeps it complete → update in place (`updated_at`/`nota`/`section` if changed); clearing required field or invalidating Fecha → no new write (existing row unchanged; explicit clear via menu/backfill only). Bulk paste on `Apoyo` → per-row same completeness check. Whole-table scan **only** on Backfill (idempotent, `LockService`); never on normal `onEdit`. Table may grow beyond 1000 — extend range as needed; never `clear` whole table. |
| EC-14 | Month/year change revert and reload (FR-006) | `S7:U7`/`S9:U9` edit triggers `isCalendarRange` confirm dialog on any attendance sheet (scalable), not a silent no-op. **Yes** → `clearContent` + `clearNote` on `E15:AI44`, then query `Registro` where `section = alias ?? sheetName` (resolved for that sheet) and `date ∈ [firstDay, lastDay]` of selected month/year → write `code` to matching `(operator, date)` cell and `setNote("CODE — nota")` where `nota` non-empty; blank `E11` columns skipped. **No** → leave grid as is, no clear, no `Registro` reads/writes. Navigation is reversible: Sept → Aug reloads Aug view; Aug → Sept reloads Sept view. Never creates `Registro` rows on calendar change alone; `E11`/`E12`/`W7` still recalc via formulas regardless of dialog choice. |
| EC-15 | Adding new attendance sheet / renaming (scalable) | **Add:** clone any attendance sheet (template with `E15:AI44`, `S7:U7`/`S9:U9`, `Hoja2` / `C13`); on first edit the sheet is detected via structure (ignorable list `Registro/Config/Errors/Hoja2/- AYUDA -/Apoyo` excluded) — no code change required. Optional: add row to `Config!A:B` (`sheetId` or current name → display name) to set friendly `section` value and responsible mapping; if not added, `section` = current sheet name and responsible = `RESPONSABLE` header. Backfill includes the new sheet on next `Backfill histórico`. **Rename:** renaming a tab updates `section` for future writes to the new name (or alias if `Config` maps `sheetId`). Existing `Registro` rows keep old `section` value (PK includes `section`); history is not migrated — filter by old and new values. Prefer `sheetId` in `Config!A:B` to keep alias stable across renames. `Apoyo` is excluded — stays fixed, single sheet. |

## 11. UX / Flow

### 11.1 Happy Path — Single Cell

```
Responsable types "F" in Preparacion!G22 (any attendance sheet, scalable detection)
 → onEdit: sheet is attendance (structure match, not in ignorable list), range∩E15:AI44, E11(=+G13&"/"&$V$9&"/"&$S$7) valid, code∈{A,AT,BM,F}
 → invalid → toast "⚠️ Código no válido. Use A, AT, BM o F."
  → valid → check owner+window (Config alias ?? header, fecha_col vs today/today-1 Lima)
   → blocked → toast ⛔ + revert, no write
   → allowed → Lock → findRow→insert/update → toast "✅ Registrado: Juan Pérez — 2026-03-15 = F"
```
Reads via `SpreadsheetApp`/API v4 `valueRenderOption=FORMULA`, never canvas. Window via `Utilities.formatDate(new Date(),"America/La_Paz","yyyy-MM-dd")`.

### 11.2 Bulk Paste

`numRows>1||numCols>1` → iterate `range∩E15:AI44` with valid `E11` → per-cell window+owner → batch `Registro` map `record_id→row` → upserts/voids (batch `setValues` or row-by-row under lock, normalize `S7:U7`/`S9:U9` once) → toast `"✅ Sincronizados: 12 ins, 3 upd, 1 void, 2 fuera de ventana."`

### 11.3 Clear / Delete

Empty cell → lookup `record_id` → if found `status=void` → toast `"🗑️ void: …"`; no-op if no row.

### 11.4 Error Handling

| Scenario | UX |
|----------|----|
| Invalid code | Toast `⚠️ Código no válido. Use A, AT, BM o F.`, no write |
| Out-of-window (code or nota) | Toast `⛔ Solo podés registrar hoy y ayer…`, no write, log `Errors` |
| Wrong section (code or nota) | Toast `⛔ No tenés permiso para esta sección.`, no write, log `Errors` |
| Nota — no record yet | Toast `⚠️ No hay registro para esta fecha — primero marcá el código.` — nota alone creates no row |
| Nota — invalid cell / blank date | Toast `⚠️ Seleccioná una celda con fecha válida en E15:AI44.` — no write |
| Lock timeout | `⏳ ocupado, reintentando…` → retry → `❌ Use Re-sincronizar.` |
| `Registro` missing | Create header then proceed |
| `Hoja2` failure | Toast `⚠️ Hoja2 no accesible` + log |
| Not authorized | Toast `🔒 Autorización requerida → Asistencia → Autorizar` |

### 11.5 Menu

```
Asistencia → Ver Registro | Re-sincronizar fila | Agregar/editar nota a celda activa
           → Solicitar corrección (RRHH bypass, audited) | Registro manual (alias)
           → Backfill histórico (confirm) | Autorizar
```
Toasts only on normal `onEdit`; HtmlService modal only via `Agregar/editar nota a celda activa` (FR-014).

### 11.6 Notas (optional per-cell) — FR-014

**Principle:** Nota is optional, per `record_id`, for **any** code (`A/AT/BM/F`). Never blocks rapid entry. Stored in `Registro!L` (`""` default, overwrites — no history/bitácora); cell mirror via `setNote()` is view aid only. **Toast per atomic action** — not just code: each action has its own confirmation toast (code vs nota save/update/delete).

**Rapid / bulk entry (no modal):**
```
Responsable selects dropdown A/AT/BM/F in E15:AI44 (or pastes 30 cells)
 → onEdit saves code immediately with nota="" (bulk: per-cell window+permission)
 → toast single "✅ Registrado: Juan Pérez — 2026-03-15 = F" or bulk "✅ Sincronizados: 12 ins, 3 upd, 1 void, 2 fuera de ventana."
 → no per-cell modal shown; menu remains persistent post-bulk
```

**Visualize (without opening modal):**
- Hover any cell in `E15:AI44` that has a nota → native cell `Note` via `setNote()` shows `"F — motivo"` (or code + nota). No click needed.
- `Registro!L` column is the filterable list of all notas (filter by operator, section, date, code).

**Edit via menu (modal, window-gated):**
```
Responsable selects cell with code (e.g., Preparacion!G22) → Asistencia → Agregar/editar nota a celda activa
 → HtmlService modal opens: operator (col B), date (E11 → ISO), code (cell value), textarea pre-filled with current Registro!L nota if exists
 → actions: Guardar / Cancelar / Borrar nota (or clearing textarea + Guardar)
 → on Save: validate active cell ∈ E15:AI44, E11 valid, record_id exists, window+permission (FR-013) via America/La_Paz
   → allowed + non-empty nota (new)      → Lock → Registro!L = trimmed nota, setNote(cell, "CODE — nota"), updated_at/edited_by → toast "✅ Nota guardada: Juan Pérez — 2026-03-15"
   → allowed + non-empty nota (overwrite) → Lock → Registro!L = trimmed nota, setNote(cell, "CODE — nota"), updated_at/edited_by → toast "✅ Nota actualizada: Juan Pérez — 2026-03-15"
   → allowed + empty textarea            → Lock → Registro!L = "", clearNote(cell), updated_at/edited_by → toast "🗑️ Nota borrada: Juan Pérez — 2026-03-15"
   → cancel → no write, no toast
```

| Scenario | UX |
|----------|----|
| Visualize — hover cell with nota | Cell `Note` tooltip `"F — motivo"` via `setNote()`; no modal |
| Visualize — list view | Filter `Registro!L` by operator/section/date/code |
| No active cell / active cell ∉ `E15:AI44` or `E11` blank | Toast `⚠️ Seleccioná una celda con fecha válida en E15:AI44.` — no write |
| No existing `Registro` row (code not yet registered) | Toast `⚠️ No hay registro para esta fecha — primero marcá el código.` — nota alone creates no row |
| Out-of-window / wrong section (FR-013) | Toast `⛔ Solo podés registrar hoy y ayer…` or `⛔ No tenés permiso para esta sección.` — no write, log `Errors` |
| Code registered (rapid/bulk) | Toast `✅ Registrado: {operator} — {date} = {code}` |
| Nota save (first time) | Toast `✅ Nota guardada: {operator} — {date}` (`nota` written to `L` + `setNote()`) |
| Nota update (overwrite) | Toast `✅ Nota actualizada: {operator} — {date}` (`nota` overwrites previous, audited via `edited_by`, no history) |
| Nota delete (clear textarea / Borrar) | Toast `🗑️ Nota borrada: {operator} — {date}` (`L=""` + `clearNote()`) |
| Bulk — notas unaffected | Code bulk toast only; existing `L` preserved unless edited via menu |

### 11.7 Apoyo — Growing Table (Per-Row, Eventual)

**Distinct from attendance:** Apoyo has no `today/today-1` window, no `A/AT/BM/F` code validation, and no `Agregar nota` flow. It is a form-like growing log `A2:E2` header Fecha \| Operador \| Sección Destino \| Motivo \| (Horas/empty), `A3:E1000` eventual (not daily mandatory). Any date valid as stored; Motivo optional; Horas col unused/empty.

**Per-row incremental (silent until complete):**
```
User edits Apoyo!A3:E1000 (one row or bulk paste)
 → onEdit: range ∩ Apoyo!A3:E1000 ? if not → ignore
 → for each edited row: completeness = Fecha valid ISO (parseable date) AND Operador trimmed non-empty AND Sección Destino trimmed non-empty
   → incomplete → silent (no toast, no Registro write) — user may still be filling
   → complete   → Lock → upsert Registro with is_apoyo=TRUE, code="", code_label="", D=Sección Destino, E=Operador, F=Fecha as stored (no window), L=Motivo (trimmed, may be ""), status=active
               → toast "✅ Apoyo registrado: {operator} — {date} → {section}" (single) or bulk "✅ Apoyo: N registrados, M pendientes (incompletos)"
```

**Partial-row example:** User types `Operador=Juan` in `B5` but leaves `Fecha` empty → no toast, no write. Later fills `A5=2026-03-15` and `C5=Preparacion` → row now complete → upsert triggered.

**Whole-table not scanned:** Normal `onEdit` processes **only edited row(s)**. Whole-table `A3:E1000` scan occurs only via `Asistencia → Backfill histórico` (idempotent, skips incomplete rows).

| Scenario | UX |
|----------|----|
| Apoyo row incomplete (missing Fecha/Operador/Sección Destino or invalid Fecha) | Silent — no error toast, no write |
| Apoyo row becomes complete | Toast `✅ Apoyo registrado: {operator} — {date} → {section}`; write with `is_apoyo=TRUE`, `code=""`, `L=Motivo` |
| Apoyo bulk paste (multiple rows) | Per-row completeness; toast `✅ Apoyo: N registrados, M pendientes (incompletos)` |
| Apoyo Fecha any date (past/future) | Allowed — no window filter |
| Edit complete Apoyo row (e.g., change Motivo) | Update in place (`L`, `updated_at`); toast `✅ Apoyo actualizado: {operator} — {date}` |

### 11.8 Month/Year Change — Confirm and Reload (FR-006, EC-14)

**Problem:** Changing `S7:U7` (year) or `S9:U9` (month) recalculates `E11:AI11`/`E12:AI12` via Sheet formulas but previously left `E15:AI44` untouched, so previous month's codes remain visible under new dates (visual carryover).

**Flow — `isCalendarRange` edit:**
```
User edits S7:U7 (year) or S9:U9 (month) on a section sheet
 → onEdit detects isCalendarRange (merged S7:U7 / S9:U9)
 → Sheet formulas recalc E11:AI11 (=+E13&"/"&$V$9&"/"&$S$7), E12:AI12, V9, W7 automatically
 → show confirmation dialog:
   "¿Cambiaste a [Month Year], recargar desde Registro? Esto limpiará E15:AI44 y cargará los registros de ese mes desde Registro."
   [Sí] [No]
 → No  → do nothing (leave E15:AI44 as is, no Registro reads/writes)
 → Sí  → clearContent + clearNote on E15:AI44
         → read Registro filtered by section = alias ?? sheetName (resolved for current sheet)
          and date ∈ [firstDayOfMonth, lastDayOfMonth] for selected month/year
        → for each matching row: write code to cell at (operator row, date column) and setNote("CODE — nota") where nota non-empty
        → toast "✅ Recargado: {month year} — N registros" (or "— sin registros" if none)
```

**Rules:**
- Changing month/year **never** creates `Registro` rows directly; only repopulation reads.
- Revert is same flow: Sept → Aug reloads Aug view; Aug → Sept reloads Sept view. Grid is always a view of `Registro` for the selected month after confirmation.
- `E11` blank columns (`SI.ERROR→""`, e.g. 31/09) are skipped during repopulation.
- `W7`/`AJ:AM` continue to derive from recalculated `E12`/`E13` — no script recompute.
- Window/permission (FR-013) does **not** gate the reload read; it gates subsequent edits to `E15:AI44`.

| Scenario | UX |
|----------|----|
| Edit `S7:U7` or `S9:U9` | Confirmation dialog as above; no immediate `Registro` write |
| Confirm Yes | Clear `E15:AI44` + reload from `Registro` for that section/month/year; toast with count |
| Confirm No / dismiss | No clear, no read, grid left as is |
| Revert Sept → Aug → Yes | Clears Sept carryover, loads Aug records |
| No records for month | Grid cleared, toast `✅ Recargado: {month year} — sin registros` |

## 12. Out of Scope for v1

| Item | Why deferred |
|------|--------------|
| Dashboard / charts | Needs `Registro` first; v2 |
| Recompute `AJ:AM` via script | Keep formulas v1 |
| Email/WhatsApp on `F` | Needs infra |
| Web form / mobile | N-sheet attendance UX stays |
| Payroll / HR integration | External dep |
| `Registro` partitioning | 30k/year fine |
| Undo UI | Version history suffices |
| Multi-year nav | `BUSCARV`/`DIASEM` sufficient |
| Canvas/DOM scraping | Disproven — use API v4 |
| History / bitácora for `nota` | Out of scope — `nota` overwrites current `Registro!L`; no version table. Audit via `edited_by/updated_at` only |

## 13. Open Questions — Before Spec

> Open Questions — decisions required before spec. Final decisions are captured below.

| # | Question | Recommendation |
|---|----------|----------------|
| Q1 | Clear → delete or `void`? | `void` — clearing a cell sets `status=void` (soft-delete); re-insert restores `active`. |
| Q2 | Mutable vs append-only? | Mutable — 1 row per PK (`section, operator_name, date`); append-only deferred to v2. |
| Q3 | Canonical identity — DNI vs name? | Canonical identity is `operator_name`; PK is `(section, operator_name, date)`. |
| Q4 | Keep `AJ:AM` formulas? | Keep formulas v1; `Registro`-backed summary in v2. |
| Q5 | Per-section permission? | Per-section — `Config!A:B` optional alias (`sheetId`/name → display) + header fallback; if no alias, section = sheet name. |
| Q6 | Weekends S/D? | Recordable — weekends are recordable, `W7` is display-only. |
| Q7 | Retention? | Infinite — single `Registro` in v1; partitioning only if scale requires. |
| Q8 | `Apoyo` one vs two rows? | One row with `is_apoyo=TRUE` — avoid duplication. |
| Q9 | Cutoff time? | `today` and `today-1` (`America/La_Paz`) — older dates via RRHH menu (`via_manual`). |
| Q10 | Operator master? | Sheets as master v1; central directory deferred. |
| Q11 | Per-cell `nota` scope & history? | **Resolved (v0.3.1–v0.3.2, stakeholder confirmed):** Optional per-cell `nota` for **any** code (`A/AT/BM/F`), not only `F/BM`. Stored per `record_id` in `Registro!L`, `""` default, no history/bitácora — overwrites current value. Rapid/dropdown + bulk saves code with `nota=""` (no per-cell modal; menu persistent post-bulk); add/edit via `Asistencia → Agregar/editar nota a celda activa` HtmlService modal pre-filled with current `Registro!L`, window-gated (FR-013 `today/today-1` `America/La_Paz`) + permission, audited via `edited_by`; requires existing code row. Visualize via hover `setNote("F — motivo")` + filterable `Registro!L`; toast per atomic action (`✅ Registrado` / `✅ Nota guardada` / `✅ Nota actualizada` / `🗑️ Nota borrada`). No bitácora table (out of scope §12). |

## 14. Next Steps

| Step | Owner | Artifact / Command | Exit |
|------|-------|--------------------|------|
| 1. Validate PRD | Stakeholder+Tech | Review §13 + App. D | Approved |
| 2. SDD Propose | Tech | `sdd-propose` | Accepted |
| 3. SDD Spec | Tech+Stakeholder | `sdd-spec` Given/When/Then | Reviewed |
| 4. SDD Design | Tech | `sdd-design` | Approved |
| 5. SDD Tasks | Tech | `sdd-tasks` | Ready |
| 6. Implement | Tech | `sdd-apply` on **copy** (never prod) | FRs verified |
| 7. Verify & Rollout | Tech+RRHH | `sdd-verify` → prod | Live |

**Immediate:** 30-min review §13; share anonymized operator row; create prod copy for dev (auth beyond anon).

## Appendix A — Code Mapping

| Code | Label | Category | Counts toward | Evidence |
|------|-------|----------|---------------|----------|
| `A` | Asistencia | Present | `AJ` | `E15=A` |
| `AT` | Tardanza | Late | `AK`/`AL` | `F15=AT` |
| `BM` | Baja Médica | Medical | Separate | `streamrows` |
| `F` | Falta | Absent | `AK` | `streamrows` |
| *(empty)* | — | No mark | `MAX(E13:AI13)-W7` | `H15=""` |

> `AJ$10:AM$10`=codes; `W7`=weekends. Verified `AJ15:AM15`.

## Appendix B — Constraints Compliance

| Constraint | Compliance |
|------------|------------|
| No npm/pip | Built-ins only (`SpreadsheetApp`, `LockService`, `Session`) |
| Project-dir tooling | `clasp` under `tools/`, never `/tmp` |
| Spanish locale | `SI.ERROR`/`BUSCARV`/`DIASEM`/`CONTAR.SI` verbatim; `S7:U7`/`S9:U9` normalized |

## Appendix C — Glossary

| Term | Meaning |
|------|---------|
| Section | Attendance sheet resolved as `Config!A:B` alias (`sheetId`/current name → display) if present, else sheet's current name (initially: Preparacion, Continua, Acoplado, Retorcedoras, Madejeras, Producto Terminado; scalable to N) |
| Attendance sheet | Any non-ignorable sheet matching template structure (`E15:AI44`, `S7:U7`/`S9:U9`, `Hoja2`, `C13`); detected via structure, not hardcoded name |
| Registro | Central sheet — source of truth |
| Apoyo | Temp support (`is_apoyo=TRUE`) — fixed single sheet, not scalable |
| Hoja2 | `A1:B12` months, `D1:E7` weekdays `L/M/X/J/V/S/D` |
| Idempotent upsert | Insert if absent, update if present |

## Appendix D — Playwright Evidence

Playwright evidence: see `docs/playwright-evidence/Preparacion-analysis.md` and live captures `live-*.png`. No repro tutorial in PRD.

*End of PRD v0.3.6 — Registro headers ES: A:M `id|creado|actualizado|seccion|operador|fecha|codigo|descripcion|es_apoyo|editado_por|rango_origen|nota|estado` (Spanish, snake, no accents) for pivot tables; order frozen, code indexes unchanged. Previous v0.3.5 scalable sheets preserved.*
