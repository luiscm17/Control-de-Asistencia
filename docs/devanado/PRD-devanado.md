# Devanado / Embolsado Production Control — Product Requirements Document

| Field | Value |
|-------|-------|
| **Version** | 0.1.0 |
| **Author** | [Placeholder — assign owner] |
| **Date** | 2026-09-17 |
| **Status** | Draft |
| **Repo** | `apps-script/devanado/` (proposed, does not exist yet) |

> §1 + §2 = 2-min version. §3–§9 = implementation detail. §10 = open questions.

## 1. Quick Path

1. **Problem:** Daily devanado/embolsado output lives in a single reusable template (`ctrl_embolsado`): 12 item rows × 15 operators, with totals, averages, and compliance states as live formulas — no queryable history, no audit of who saved, history lost on date change.
2. **Decision:** Keep `ctrl_embolsado` as the single date-driven entry form. Persist item rows into a new DB sheet `db_embolsado` via Apps Script using an explicit checkbox save (`M4`, label `Guardar turno` in `N4`), installable `onEdit` (`FALSE→TRUE`, `guardarTurno` pattern from yarn-settings), `LockService`, upsert on `id` (PK `fecha|turno|lote`). Rehydrate via menu-first recover keyed on `fecha + turno`. `Errors` is the log sheet.
3. **Verify:** After PRD approval → SDD `propose → spec → design → tasks`; design-time verification of title→meta mapping and turno values against the live sheet (§10).

## 2. Executive Summary

Each shift logs bagged/wound output per item (`Color`, `N° Lote`, `Título (m/g)`) with kg per operator (`Op. 1..Op. 15`). `Meta Título (Kg en 8h)` is formula-derived from the title (fine titles → 110, coarse titles → 150, observed). Footer rows compute per-operator totals, required average meta, compliance states (`CUMPLE OBJETIVO` / `NO LLEGA AL OBJETIVO` / `NO TRABAJÓ`), worked-hour equivalents, and deficit hours.

| Pain | Impact |
|------|--------|
| Single template reused per day | History overwritten on `Fecha`/`Turno` change |
| Totals/compliance only as live formulas | Not queryable per `fecha`/`turno`/`lote` |
| No audit of last change | Not traceable who saved |
| 15 operator columns × 12 rows, manual copy | Transcription drift, no idempotency |

**Solution:** One reusable `ctrl_embolsado` form drives `fecha + turno → DB rows`. `db_embolsado` stores one row per item (≤12 rows/shift) with `meta_kg` frozen as a value snapshot plus `actualizado` / `editado_por` audit — same pattern as yarn-settings DB sheets. Save is explicit; rehydrate refills the form from the DB.

## 3. Goals / Non-Goals

**Goals v1:** Single `ctrl_embolsado` for all shifts; every shift closable with one explicit save; per-item kg queryable by `fecha`/`turno`/`lote`; idempotent upsert per `(fecha, turno, lote)` via the `id` column; last editor tracked per row; form recoverable from DB by `fecha + turno`.

**Non-Goals v1:** Payroll/HR integration; per-cell auto-persistence; multi-file import; changing the template layout or the `Instrucciones_y_Reglas` guide; weighing hardware.

## 4. Current State Analysis

### 4.1 Sheet Inventory — 4 sheets

| Sheet | Purpose | Type | State |
|-------|---------|------|-------|
| `ctrl_embolsado` | Input form — per-shift entry (28 rows × 22 cols `A:V`) | Form (not table) | Single reusable template, date-driven |
| `Hoja 1` | Empty | — | Excluded, never persisted |
| `Instrucciones_y_Reglas` | Usage guide (meta rule 110/150 kg per 8h; green/red/yellow states) | Guide | Excluded, never persisted |
| `db_embolsado` | Item rows per shift | Table | Target DB — to be created |
| `Errors` | Log sheet | Table | Observability — to be created |

### 4.2 Template Mechanics

All cell labels, names, and formulas below are verbatim Spanish (`es-BO`).

| Range | Value / Formula (verbatim, `es-BO`) | Meaning | Kind |
|-------|--------------------------------------|---------|------|
| `G4` / `H4` | `Fecha` / date value with NATIVE Sheets date format `dd/MM/yyyy` (e.g. `17/09/2026`) — trusted as-is, no script-side parsing or validation | Shift date | Input |
| `I4` / `J4` | `Turno` / e.g. `Noche` | Shift name | Input (open list, §10) |
| `K4` / `L4` | `Supervisor` / e.g. `Junior` | Shift supervisor | Input (free text, §10) |
| `A7` | `=U24` (e.g. `873`) | Global production total | Derived, excluded |
| `G7` | `=COUNTIF(F24:T24,">0")` (e.g. `8`) | Active operators | Derived, excluded |
| `M7` | `8` | Standard shift (hours) | Derived, excluded |
| `B10:E10` | `Item`(A) `Color` `N° Lote` `Título (m/g)` `Meta Título (Kg en 8h)` | Item headers (row 10) | Label |
| `F10` | `OPERADORES EN EMBOLSADO / DEVANADO (PRODUCCIÓN EN KG)` | Operator group header (row 10) | Label |
| `F11:T11` | `Op. 1 (Raúl)` … `Op. 8 (miguel)`, `Op. 9..Op. 15` unnamed | Operator names (row 11, labels only) | Label |
| `B12:T23` | 12 item rows (e.g. `MORADO`, `41-26-30`, `2/32`, `110`, kg per operator) | Persisted zone | Input |
| `E12:E23` | `Meta Título` FORMULA auto by title, shape `IF(OR(D12="2/32",…),…)` (observed: fine → `110`, coarse → `150`) | Meta per title | Formula → stored as VALUE snapshot |
| `U12:U23` | `Total por Color (Kg)`, `=SUM(F12:T12)` per row | Row total | Derived, excluded |
| `V12:V23` | `REMATE` flag | Flag | Excluded |
| `A12:A23` | `Item` positional number (1–12) | Reference datum persisted as `item`; script never writes column `A` | Input (read-only) |
| Rows 24–28 | Per-operator `SUM` totals, average required meta, `CUMPLE OBJETIVO` / `NO LLEGA AL OBJETIVO` / `NO TRABAJÓ`, equivalent-worked-hours, deficit-hours | Footers | Derived, excluded |
| Row 29 | `SE MANDO OVILLADO` notes | Notes | Excluded (confirm, §10) |

> Operator names in row 11 are labels only. DB mapping is strictly positional: `F→op_01 … T→op_15`, even if names change or columns 9–15 stay unnamed.
> Trailing item rows with empty `B/C/D` still show `E = 150` (formula residue) — the row rule (§6, FR-004) omits them.

## 5. Proposed Solution Overview

```
ctrl_embolsado (1 sheet, fecha+turno driven) ──explicit Save (M4 checkbox)──▶ Apps Script (check keys, snapshot meta, LockService) ──▶ db_embolsado (≤12 rows/shift)
   G4/H4 fecha (native dd/MM/yyyy), I4/J4 turno, K4/L4 supervisor ─┬─▶ B12:D23 items + E meta snapshot + F12:T23 kg ──▶ Errors (log)
   Menu: Guardar turno / Recuperar turno / Re-sincronizar ─┘
```

| Principle | Rationale |
|-----------|-----------|
| 1 form, N shifts via `fecha + turno` | Eliminates template drift; history preserved in DB |
| Explicit checkbox save outside data zones | No accidental writes; mirrors yarn-settings `guardarTurno` |
| `meta_kg` stored as value snapshot, never rewritten on rehydrate | Queryable even if the title→meta rule changes later; column E stays formula-owned |
| Menu-first rehydrate, auto as fallback | Explicit recover is safe; auto only when the form zone is empty |
| No auto-delete of vanished rows | Clearing a form row must never silently erase DB history |

## 6. Functional Requirements

- **FR-001 — Save trigger (checkbox):** Checkbox in `M4`, label `Guardar turno` in `N4` — both verified empty (values and formula views identical; `M4:V4` free, rows 8–9 fully free as alternative). Checkbox + label live outside all data zones (`B12:T23`, footers, summaries).
- **FR-002 — Installable onEdit:** Installable trigger (runs as owner) fires `guardarTurno()` on `M4` `FALSE→TRUE`; accept `TRUE`/`VERDADERO`. Reset `M4 = FALSE` in a `finally` block. Simple `onEdit` only for toast/routing, never for writes.
- **FR-003 — Key check, no date validation (explicit decision):** Save requires non-empty `H4` (fecha) + non-empty `J4` (turno). `H4` already carries the NATIVE Sheets date format `dd/MM/yyyy` — the script performs NO format parsing or validation on it (lesson from previous projects: never re-validate what Sheets already formats). **No today/today-1 window gate** — backfilling a missed shift is a legitimate supervisor flow. Audit relies on `actualizado`/`editado_por` instead. Missing key → toast `⛔ Completá Fecha y Turno antes de guardar`, no write, log to `Errors`.
- **FR-004 — Row rule:** Omit the entire item row when `B` (Color), `C` (Lote), or `D` (Título) is empty/blank. Otherwise persist the row; any empty cell in `F:T` persists as `0` (never blank).
- **FR-005 — Meta snapshot:** Persist `meta_kg` as the displayed value (number), never the formula. Rehydrate NEVER writes to or clears column `E` — it is formula-owned in the form; the DB snapshot is write-on-save only. Observed rule (fine titles → `110`, coarse → `150`) is a voorbeeld only; full title→meta mapping is design-time verification (§10).
- **FR-006 — Upsert + no auto-delete:** Each DB row carries an explicit `id` column (first column) holding the joined key `fecha|turno|lote` (e.g. `2026-09-17|Noche|41-26-18`). `lote` (`C`) is the row identity in the key; `item` (`A`) is a plain reference datum, NOT part of the PK. Re-save overwrites the same `id` (idempotent). Rows that disappear from the form are **NOT auto-deleted**; deletion only via an explicit corrective path (menu item or manual DB edit, defined at design time).
- **FR-007 — Rehydrate:** Lookup key is `fecha + turno`. **Primary:** menu item `Recuperar turno` (explicit — never wipes unsaved edits silently). **Fallback:** automatic refill on `Fecha`/`Turno` change only when `B12:T23` is fully empty; otherwise toast `ℹ️ El formulario tiene datos: usá Recuperar turno del menú`. Recover refills `B12:D23` + `F12:T23`, clears non-matching form rows in `B:D` and `F:T` only, restores `Supervisor` (`L4`) from DB. Column `E` (`meta_kg`) is NEVER written or cleared by rehydrate — it is formula-owned (see FR-005).
- **FR-008 — Concurrency:** Every DB write wrapped in `LockService.getDocumentLock()`, `tryLock` 5s + one retry. On lock failure: no write + toast `⛔ No se pudo guardar: reintentá desde el menú` + `Errors` log + menu re-sync path.
- **FR-009 — Timezone:** `America/La_Paz` everywhere (script `timeZone`, `actualizado` timestamps). Never browser/UTC. No date parsing of `H4` (native `dd/MM/yyyy`, see FR-003).
- **FR-010 — Audit columns:** Every DB row stores `actualizado` (timestamp) and `editado_por` (last editor, `Session.getActiveUser().getEmail()`), same pattern as yarn-settings.
- **FR-011 — No invented vocabularies:** Do NOT hardcode a turno list, a supervisor list, or a title→meta table in v1. Observed values (`Noche`, `Junior`, `2/32 → 110`) are examples, not enums.

## 7. DB Schema — `db_embolsado` (frozen header order)

| # | Column | Source | Type | Notes |
|---|--------|--------|------|-------|
| 1 | `id` | Script | String | Joined PK `fecha|turno|lote`; first column |
| 2 | `fecha` | `H4` | DATE | Part of PK |
| 3 | `turno` | `J4` | String | Part of PK (open vocabulary) |
| 4 | `item` | `A` | Integer | Positional Item number (1–12); reference datum, never written by script |
| 5 | `supervisor` | `L4` | String | Restored on rehydrate |
| 6 | `color` | `B` | String | e.g. `MORADO` |
| 7 | `lote` | `C` | String | e.g. `41-26-30`; part of PK |
| 8 | `titulo` | `D` | String | e.g. `2/32`, verbatim |
| 9 | `meta_kg` | `E` | Number | VALUE snapshot on save; never rewritten on rehydrate |
| 10–24 | `op_01` … `op_15` | `F:T` | Number | Positional; empty → `0` |
| 25 | `actualizado` | Script | Timestamp | `America/La_Paz` |
| 26 | `editado_por` | Script | String | Last editor email |

PK `fecha|turno|lote`, materialized in `id`. Header order frozen — never reorder.

## 8. Validation & Errors

| Case | Behavior |
|------|----------|
| `H4` empty or `J4` empty | Toast `⛔ Completá Fecha y Turno antes de guardar`; no write; log `Errors` |
| All 12 item rows omitted by row rule | Toast `ℹ️ No hay filas con Color, Lote y Título: nada para guardar`; no write |
| Lock failure (5s + 1 retry) | No write; toast `⛔ No se pudo guardar: reintentá desde el menú`; log `Errors`; menu `Re-sincronizar` retries |
| Rehydrate with no DB rows for `fecha + turno` | Toast `ℹ️ No hay datos guardados para esa Fecha y Turno`; form untouched |
| Non-numeric kg in `F:T` | Coerced to `0`; logged to `Errors` with cell address |
| `Errors` sheet | Columns `timestamp, contexto, detalle, editado_por`; `America/La_Paz` timestamps |

## 9. Out of Scope

Per-cell auto-persistence; turno/supervisor/title closed vocabularies in v1; modifying `Hoja 1` or `Instrucciones_y_Reglas`; changing template layout, conditional formatting, or footer formulas; payroll/HR use of operator kg; multi-file or historical import (define as separate change if needed).

## 10. Open Questions

1. **Two header rows:** the sheet uses row 10 (group labels) + row 11 (`Op. 1..Op. 15` names), not a single header row. Confirm the script reads operator identity positionally from row 11 and never writes to rows 10–11.
2. **Row 29 notes** (`SE MANDO OVILLADO`): confirm excluded from persistence with the stakeholder.
3. **Turno vocabulary:** only `Noche` observed. Confirm whether `Mañana`/`Tarde` (or others) exist — open text until confirmed, no enum invented.
4. **Title→meta mapping:** only the 110/150 split observed. Verify the full `IF(OR(…))` title list against the live sheet formula at design time before freezing any reference table.
5. **Checkbox placement:** `M4` + `N4` proposed (verified free; mirrors yarn-production). Confirm with the supervisor; fallback is the fully free rows 8–9 block.
6. **Deletion rule:** no auto-delete chosen (§6 FR-006). Confirm an explicit corrective path (menu delete vs. manual DB edit) at design time.
