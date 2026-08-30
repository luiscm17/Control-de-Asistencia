# Control de Asistencia — Product Requirements Document

| Field | Value |
|-------|-------|
| **Version** | 0.2.1 — Draft, updated with controlled window (today+1) |
| **Author** | [Placeholder — assign owner] |
| **Date** | 2026-08-30 |
| **Status** | Draft — updated with controlled window (today+1) |
| **Source** | Google Sheet `1iw9bduLeGXQMbjmMV1qrMqE2WoPWCBz3` (gid `740536758` = Preparacion) |
| **Repo** | `/home/luis-cm/Documents/Github/Control-de-Asistencia` |
| **Evidence** | `docs/playwright-evidence/Preparacion-analysis.md` (playwright-cli 0.1.18) |

> **How to read this doc:** Start with §2 Executive Summary + §6 Solution Overview for the 2-minute version. Dive into §7–§10 only if you need implementation detail. §5.3 and Appendix D contain the Playwright ground truth — read them before touching the calendar logic. §13 lists decisions that block the spec.

---

## 1. Quick Path

1. **Problem:** 6 cloned section sheets capture attendance but data is fragmented — no central DB, no audit trail, no reporting.
2. **Decision:** Keep the 6 sheets as entry points. Centralize every mark into a single normalized sheet `Registro` via Apps Script `onEdit` + Sheets API v4 (not DOM scraping — see §5.3 / §6).
3. **Verify:** After this PRD is approved, proceed to SDD phases: `sdd-propose` → `sdd-spec` → `sdd-design` → `sdd-tasks` (see §14).

---

## 2. Executive Summary

### Problem

Attendance for ~180 operators (6 sections × 30) is recorded manually in Google Sheets. Each factory section has its own sheet with an identical template. There is no single source of truth — querying "all absences for operator X in March" requires opening 6 sheets.

### Current Pain

| Pain | Impact |
|------|--------|
| Data scattered across 6 sheets | No cross-section reporting or filtering |
| `Registro` sheet exists but is empty | Historical data not centralized |
| Summary `%` computed per-sheet with fragile `CONTAR.SI` / `MAX` formulas | Breaks on bulk paste, calendar regeneration, or operator moves |
| No audit trail (who/when edited) | Corrections are invisible |
| `Apoyo` (cross-section support) is a separate manual process | Support hours not reflected in attendance history |
| Calendar/calendar formulas depend on hidden `Hoja2` lookups | `Hoja2` deletion silently blanks weekdays (see §5.2, EC-09) |

### Proposed Solution

Retain the 6 section sheets as the **input UX** (no retraining). Add an Apps Script layer that on every valid edit (`A`/`AT`/`BM`/`F`) in the range `E15:AI44` of any section sheet:

1. Resolves operator identity + date + weekday + section (via verified Spanish formulas — §5.2).
2. Upserts a single row in `Registro` keyed by `(section, operator_doc, date)` — idempotent, guarded by `LockService`.
3. Handles clears, bulk pastes, month changes, and `Apoyo` without duplication.

`Registro` becomes the normalized, queryable DB. Section sheets remain the human-friendly calendar view. Playwright evidence confirms DOM scraping is not viable — the integration must use `onEdit` + Sheets API v4 (§5.3, §6).

---

## 3. Goals / Non-Goals

### Goals (v1)

- [ ] Every valid attendance mark appears in `Registro` within seconds, without manual copy.
- [ ] Corrections update the existing `Registro` row (no duplicates).
- [ ] Clearing a cell removes or voids the corresponding `Registro` row.
- [ ] Bulk pastes and month/year calendar changes do not create phantom records.
- [ ] `Apoyo` assignments are logged to `Registro` with a distinguishable flag.
- [ ] Existing marks are backfilled once on deployment.

### Non-Goals (v1)

- Replacing the 6-sheet UX with a web app or form.
- Real-time dashboards / charts (data foundation only).
- Automated notifications (email/WhatsApp) on absence.
- Payroll integration.
- Rewriting or removing the `AJ:AM` summary formulas (see Open Questions).
- DOM/canvas scraping for data extraction — disproven by Playwright (see §5.3).

---

## 4. Stakeholders & Actors

| Actor | Role | Needs |
|-------|------|-------|
| **Operario** | Factory operator (row in section sheet) | Correct daily mark; not a direct sheet editor in most cases |
| **Responsable por Sección** | Section supervisor — edits their section sheet daily | Fast entry, bulk paste, correction, visible confirmation |
| **RRHH / Admin** | HR / central admin — consumes `Registro` | Filterable history, audit trail, support for reporting |
| **Owner / Maintainer** | Apps Script owner | Simple deployment, no external dependencies, within quotas |

**Per-section responsible mapping (confirmed — replaces §13 Q5):** Each of the 6 sections (`Preparacion`, `Continua`, `Acoplado`, `Retorcedoras`, `Madejeras`, `Producto Terminado`) has a **different responsible**. The canonical mapping lives in `Config!A:B` (`section → responsible email`); fallback source is the `RESPONSABLE` cell in the section header when `Config` is absent. At runtime the script resolves `responsible = Config(section) ?? headerCell`. Each responsible **may register during the whole day, but only for their own section** and only inside the **controlled window** `today` / `today-1` (`America/Lima`, see FR-013). Older dates require RRHH via `Asistencia → Solicitar corrección / Registro manual` (bypasses window, audited).

**Permission model (confirmed):** Responsables edit only their assigned section sheet within the controlled window; out-of-window or cross-section edits are blocked with a toast and produce **no `Registro` write** (optional revert). RRHH has read access to `Registro` plus override via the correction menu. The script writes as owner via **installable trigger** (required — anonymous view-only cannot write; see §5.3, NFR-04, EC-07).

---

## 5. Current State Analysis

### 5.1 Sheet Inventory (10 sheets)

| Sheet | Purpose | State |
|-------|---------|-------|
| `- AYUDA -` | Instructions | Static help — active tab on load (gid `1765343219`) |
| `Preparacion` | Section — input | Template A1:AM44, 30 operators, evidence sheet (gid `740536758`) |
| `Continua` | Section — input | Same template cloned |
| `Acoplado` | Section — input | Same template cloned |
| `Retorcedoras` | Section — input | Same template cloned |
| `Madejeras` | Section — input | Same template cloned |
| `Producto Terminado` | Section — input | Same template cloned |
| `Registro` | Central DB (target) | **Empty** — schema to be defined in §9 |
| `Apoyo` | Cross-section support log | Manual support assignments |
| `Hoja2` | Hidden lookup | Months (A1:B12) + weekday initials (D1:E7) — **critical dependency** |

All 10 tabs verified via Playwright snapshot (`e338`–`e402`, `.docs-sheet-tab-name`); DOM `querySelectorAll('button')` alone undercounts.

### 5.2 Template Mechanics — Verified Formulas (Spanish locale)

> **Source of truth:** Playwright name-box navigation (`input#t-name-box` + `div#t-formula-bar-input`) on `Preparacion` (gid 740536758). Locale is `es-BO`; all functions are Spanish. Merged ranges `S7:U7` and `S9:U9` must be normalized to `A1:B1` notation.

| Range | Formula / Value (verbatim) | Meaning | Dependency |
|-------|----------------------------|---------|------------|
| `S7:U7` | `2026` (merged, value holder `S7:U7`) | Academic year | Input; referenced as `$S$7` |
| `S9:U9` | `Septiembre` (merged) | Month name | Validated against `Hoja2!A1:B12` |
| `V9` | `=+BUSCARV(S9,Hoja2!$A$1:$B$12,2,FALSO)` | Month number (1–12) | `Hoja2!A1:B12` month map |
| `E13:AI13` | `1 … 30` (e.g. `E13=1`, `I13=…`) | Day numbers 1..31, dynamic | Regenerated when `S7`/`S9` changes |
| `E11:AI11` | `=+E13&"/"&$V$9&"/"&$S$7` | Full date string `D/M/YYYY` | `$V$9` + `$S$7` + row 13 |
| `E12:AI12` | `=+SI.ERROR(BUSCARV(DIASEM(E11,2),Hoja2!$D$1:$E$7,2,FALSO),"")` | Weekday initial `L/M/X/J/V/S/D` | `Hoja2!D1:E7` weekday initials; `DIASEM(date,2)` = `WEEKDAY` Mon=1 |
| `W7` | `=+CONTAR.SI($E$12:$AI$12,"S")+CONTAR.SI($E$12:$AI$12,"D")` | Weekend count (Sábado + Domingo) | Used as divisor offset |
| `AJ15:AM15` | `=+CONTAR.SI($E15:$AI15,AJ$10)/(MAX($E13:$AI13)-$W$7)` | % per code: `count(code in row) / (MAX(dayRow) - weekends)` | `AJ$10:AM$10` headers hold `A,AT,BM,F`; repeats for `AK15`, `AM15` etc. |

**Locale note:** `SI.ERROR` = `IFERROR`, `BUSCARV` = `VLOOKUP`, `DIASEM` = `WEEKDAY`, `CONTAR.SI` = `COUNTIF`, `MAX` = `MAX`. Leading `=+` is tolerated by Sheets. When writing via API, use `userEnteredValue.formulaValue` with Spanish names or convert to English — test with `setFormula`.

| Code | Meaning (to confirm) | Handling | Evidence |
|------|----------------------|----------|----------|
| `A` | Asistencia (Present) | Counted in `AJ` | `E15=A` live value; validation block in `streamrows` |
| `F` | Falta (Absent) | Counted in `AK` | `streamrows` validation block entry |
| `AT` | Atraso / Tardanza (Late) | Separate column | `F15=AT`, `G15=AT` live values |
| `BM` | Baja Médica / Permiso Médico | Separate column | `streamrows` entry + color mapping `12575222` |
| *(empty)* | No mark | Ignored (blank allowed) | `H15=""` — permissive blank |

Validation: `streamrows` payload contains 4 entries (`A, AT, BM, F`) + color mappings + `ARRAYFORMULA(OR(TRIM(EXACT(...))))` validator attached to `E15:AI44`. Conditional formatting palette `t-text-color-cond-fmt` exists in DOM (hidden `goog-menu`). **Blank is allowed.** Playwright could not trigger the dropdown/toast as anonymous view-only (see §5.3).

**Sample data walk (arrow-key, name-box confirmed):**

```
E15 = A  →  F15 = AT  →  G15 = AT  →  H15 = ""  →  I15 = ""
```

**Key observations (updated with evidence):**

- Calendar is **dynamic** — changing `S7:U7` (year) or `S9:U9` (month) regenerates `E11:AI13`. Days beyond month length have blank `E11` (via `SI.ERROR` → `""`) but range stays `E:AI`. Script must check `E11` has valid date before processing.
- Formulas in `AJ:AM` reference `MAX($E$13:$AI$13)` and `$W$7` — fragile if script writes outside `E15:AI44`. Keep writes strictly inside `E15:AI44`.
- `Hoja2` is **critical path**: `A1:B12` (Enero→1 … Diciembre→12) and `D1:E7` (`L,M,X,J,V,S,D` initials). Deleting or reordering `Hoja2` blanks `E12:AI12` and breaks `W7` / `%` denominators. Do not modify `Hoja2`.
- Merged ranges: always read `S7:U7` / `S9:U9` as a single value holder; normalize with `trim` and accept `S7:U7` notation when comparing `name-box` values.
- Only a few live marks exist today — ideal moment to define `Registro` before volume grows.

### 5.3 Playwright Deep Dive (Preparacion, gid 740536758)

> Full analysis: `docs/playwright-evidence/Preparacion-analysis.md`. Tool: `playwright-cli 0.1.18` on `https://docs.google.com/spreadsheets/d/1iw9bduLeGXQMbjmMV1qrMqE2WoPWCBz3/edit?gid=740536758`. Anonymous session (`ANONYMOUS_00801369372001435688`, Share disabled).

**Rendering model:**

- Google Sheets paints on a single `<canvas dir="ltr" width="1264" height="524">` inside `#waffle-grid-container` (rect `0,142,1264,524`). Snapshot shows no cell text — only toolbars, tab bar, and formula bar.
- Frozen panes: vertical handle at `left:412px` (col D/E) and horizontal at `top:24px` sit in `.overlay-container-ltr` (`#740536758-static-overlay-container`) and intercept pointer events.
- True model lives in: `input#t-name-box` (selected A1) + `div#t-formula-bar-input > div.cell-input[contenteditable]` (rich HTML, syntax-highlighted tokens) + XHR `streamrows` / `selection`. `renderdata` returns only an image layer; `waffle_api` is obfuscated; `ritz_api` is empty.

**Navigation method (reliable):**

| Method | Result |
|--------|--------|
| **Name-box navigation** — `fill e252 "E15" --submit` (Enter) → `eval #t-name-box.value` + `#t-formula-bar-input.textContent` | ✅ 100% reliable, including merged `S7:U7`/`S9:U9`; JS `dispatchEvent('keydown')` alone fails (Sheets requires trusted keyboard events) |
| **Arrow-key walk** — `press ArrowRight` from `E15` → `F15` → `G15` → `H15` | ✅ Confirmed by name-box increment; used for sampling |
| **Direct canvas click** — `click "canvas"` / `(632,404)` | ❌ Times out — `freezebar-handle` intercepts; workaround `mousemove+mousedown+mouseup` at centre selects unpredictable cell (`I12`) |
| **Edit / validation trigger** | ❌ Blocked — view-only anon, no `[role=listbox]` dropdown, no toast observable; validation must be verified via `streamrows` / Sheets API |

**Tab navigation:** Snapshot + `.docs-sheet-tab-name` is truth (10 tabs). `click e346` (Preparacion, `id :1d`) navigates to `?gid=740536758` in ~0.8s, verified via `location.href` and `.docs-sheet-active-tab`. No scrolling needed at 1280px.

**Permissions:** Anonymous view-only — `Iniciar sesión` visible, Share disabled, `401` on `peoplestackwebexperiments` / `accounts.google.com/ServiceLogin`. Edits, validation toasts, and `waffle-rich-text-editor` writes are unreachable, but `streamrows` (200) still leaks the full model (values, styles `67094526`, validation blocks, decomposed `gridRange` `950512471` / `1679302751`).

**Evidence files:**

| File / Ref | Purpose |
|------------|---------|
| `Preparacion-01-overview.png` | Viewport after `click e346` → Preparacion active, canvas visible |
| `Preparacion-02-I12-formula.png` | Centre click selects `I12`; formula bar `=+SI.ERROR(BUSCARV(DIASEM(I11,2),Hoja2!$D$1:$E$7,2,FALSO),"")` |
| `Preparacion-03-E15.png` | Name-box `E15` → value `A` |
| `Preparacion-04-AJ15.png` | `AJ15` summary `=+CONTAR.SI($E15:$AI15,AJ$10)/(MAX($E13:$AI13)-$W$7)` |
| `Preparacion-05-grid.png` | Final idle grid after arrow-key walk; freeze panes intact |
| Snapshots | `page-2026-08-30T18-36-56-342Z.yml` (post-click), `page-2026-08-30T18-38-37-202Z.yml` (I12), `page-2026-08-30T18-47-00-818Z.yml` (AJ15) |
| Network / eval | `streamrows 200` (decomposed ranges), `selection 200×30`, `renderdata 200` (image only), `wasm calcworker_wasm_cd.wasm`, `console 401/405` set, `performance.getEntriesByType('resource')` |

All evidence under `docs/playwright-evidence/`. See Appendix D for repro steps.

---

## 6. Proposed Solution Overview

```
                    ┌─────────────────────────────────┐
                    │  6 Section Sheets (input UX)     │
                    │  Preparacion, Continua, Acoplado │
                    │  Retorcedoras, Madejeras,        │
                    │  Producto Terminado              │
                    │  Range E15:AI44 + S7:U7/S9:U9/V9│
                    └──────────────┬──────────────────┘
                                   │ onEdit (simple + installable)
                                   ▼
                    ┌─────────────────────────────────┐
                    │  Apps Script (no dependencies)   │
                    │  • Validate code ∈ {A,AT,BM,F}  │
                    │  • Resolve operator + date       │
                    │    via E11/E12/W7 + Hoja2        │
                    │  • Idempotent upsert / delete    │
                    │  • Bulk-range handling           │
                    │  • Apoyo flag                    │
                    │  • Spanish locale aware          │
                    └──────────────┬──────────────────┘
                                   │ upsert / delete (Sheets API v4)
                                   ▼
                    ┌─────────────────────────────────┐
                    │  Registro (normalized DB)        │
                    │  One row per (section, operator, │
                    │  date) — append + update         │
                    └─────────────────────────────────┘
                                   ▲
                    ┌──────────────┴──────────────────┐
                    │  Apoyo sheet                     │
                    │  Cross-section support → Registro│
                    │  with is_apoyo = TRUE             │
                    └─────────────────────────────────┘
```

### Principles

| Principle | Rationale |
|-----------|-----------|
| **Keep sheets as source of entry** | Zero retraining; supervisors keep their familiar calendar |
| **Registro is the source of truth** | All reporting queries hit one sheet |
| **Idempotent upsert** | Edit/correction never duplicates; key = `section + operator_doc + date` |
| **Silent + recoverable** | `onEdit` shows toast on success/error; never blocks the edit |
| **No external packages** | Apps Script built-ins only; any future downloads go under project dir |
| **Sheets API v4 + onEdit, never DOM/canvas scraping** | Playwright proves grid is `<canvas>` with no DOM cells, `freezebar-handle` intercepts clicks, and snapshot has no cell text — scraping is impossible. Truth is `input#t-name-box` + `div#t-formula-bar-input` + XHR `streamrows`/`selection`; automation must use `onEdit` / `onSelectionChange` triggers and `SpreadsheetApp` / `sheets.googleapis.com/v4` with `valueRenderOption=FORMULA`. Do not rely on obfuscated `waffle_api`. |

---

## 7. Functional Requirements

### 7.1 Automatic Capture

| ID | Requirement | Priority |
|----|-------------|----------|
| **FR-001** | On any edit in `E15:AI44` of any of the 6 section sheets, the script captures `(section, operator_doc, operator_name, date, weekday, code, month, year, edited_by, timestamp, source_range)` and upserts into `Registro` **only after passing the controlled-window + ownership gate (FR-013)**. Date/weekday resolved via `E11:AI11` (`=+E13&"/"&$V$9&"/"&$S$7`) and `E12:AI12` (`=+SI.ERROR(BUSCARV(DIASEM(...),Hoja2!D1:E7,2,FALSO),"")`). Validation gate: `activeUser == responsible(section)` (from `Config!A:B` or `RESPONSABLE` header) **AND** `fecha_col == today OR today-1` in `America/Lima`. If gate fails → toast + optional revert, **no `Registro` write** (see FR-013, EC-11). | Must |
| **FR-002** | `Registro` schema is fixed (see §9). Columns are never reordered by the script; header row is created once and frozen. | Must |
| **FR-003** | If the edited cell is cleared (empty), the corresponding `Registro` row is **deleted** (or marked `void` — decision in §13 Q1). No orphan rows remain. Blank is explicitly allowed (validation permits empty). | Must |
| **FR-004** | If the user corrects a cell (e.g., `F` → `A`), the existing `Registro` row is **updated** in place (same primary key), `updated_at` refreshed, not duplicated. | Must |
| **FR-005** | Bulk paste (multi-cell range) is handled atomically: each cell in the intersection of the pasted range with `E15:AI44` and with a valid date column (`E11` has date, `SI.ERROR` not blank) is processed individually. One toast summarizes `N inserted / M updated / K deleted`. | Must |
| **FR-006** | Changing `S7:U7` (year) or `S9:U9` (month) — which regenerates `E11:AI13` and recomputes `V9`/`W7` — does **not** create or delete `Registro` rows. Only edits inside `E15:AI44` trigger writes. Calendar regen is ignored. | Must |
| **FR-007** | `Apoyo` sheet edits are also captured into `Registro` with `is_apoyo = TRUE` and `section_apoyo` (destination section) populated. Original section assignment is preserved. | Must |
| **FR-008** | Only codes `A`, `AT`, `BM`, `F` (and empty for delete) are accepted. Any other value is rejected with an error toast and no `Registro` write. Validation mirrors the data-validation rule in `E15:AI44` (verified via `streamrows`: 4 entries + `ARRAYFORMULA` validator). | Must |
| **FR-009** | One-time **historical backfill**: on deployment, scan all existing marks in the 6 sheets (`E15:AI44` where `E11` has a valid date and cell is non-empty) and upsert into `Registro`. Idempotent — re-running produces no duplicates. Must handle `S7:U7` merged ranges when reading year. | Must |
| **FR-010** | Every `Registro` row stores `edited_by` (Session.getActiveUser email) and `edited_at` timestamp in `America/Lima` timezone. If email is unavailable (permission), store `unknown` and log warning. | Should |
| **FR-011** | A custom menu `Asistencia → Ver Registro / Re-sincronizar / Solicitar corrección / Registro manual / Backfill` is available for manual trigger and verification (correction menu bypasses FR-013 gate with audit). `onEdit` remains the primary path. | Should |
| **FR-012** | The mapping `A→Asistencia, F→Falta, AT→Tardanza, BM→Baja Médica` is stored in a config object (or `Hoja2` extension) and used for display/reporting, not hardcoded in multiple places. | Should |
| **FR-013** | **Controlled window & per-section permission enforcement (RESOLVED — stakeholder 2026-08-30).** Allowed edit window is **TODAY + ONE DAY GRACE** — `fecha_col == today OR today-1` in `America/Lima` (`today = Utilities.formatDate(new Date(), "America/Lima", "yyyy-MM-dd")` derived from `E11` ISO date). **Gate:** (a) `Session.getActiveUser().getEmail() == responsible(section)` where `responsible = Config!A:B[section] ?? RESPONSABLE header cell`; (b) `fecha_col ∈ {today, today-1}`. **If blocked:** toast `⛔ Solo podés registrar hoy y ayer. Para fechas anteriores usá Asistencia → Solicitar corrección / Registro manual.`, optionally revert cell, **no `Registro` write**. **RRHH override:** menu `Asistencia → Solicitar corrección / Registro manual` bypasses the gate, writes with `edited_by` + `via_manual=TRUE` / `status=manual_correction` for audit. Grace window applies per-cell (bulk paste: each cell checked individually). Older dates (`< today-1`) are never auto-written. | Must |

### 7.2 User Stories

| Story | As a… | I want… | So that… | FR |
|-------|-------|---------|----------|----|
| US-01 | Responsable | to type `F` in a day cell and have it saved centrally | I don't need to duplicate work | FR-001 |
| US-02 | Responsable | to correct `F` to `A` | the history reflects the correction, not a duplicate | FR-004 |
| US-03 | Responsable | to clear a mistaken mark | the central record is removed/voided | FR-003 |
| US-04 | Responsable | to paste a row of marks from another file | all 31 days are processed without opening each cell | FR-005 |
| US-05 | Responsable | to change the month selector (`S9:U9`) | the calendar updates without polluting history | FR-006 |
| US-06 | RRHH | to filter `Registro` by operator, section, month, code | I can generate reports without opening 6 sheets | FR-001, §9 |
| US-07 | RRHH | to see who edited what and when | I can audit corrections | FR-010 |
| US-08 | Responsable | to log an operator supporting another section via `Apoyo` | support hours are traceable | FR-007 |
| US-09 | Responsable por Sección | to correct **yesterday's** mark within the grace window (`today-1`, `America/Lima`) | I can fix a missed or wrong entry from yesterday without involving RRHH, while older dates stay protected | FR-013 |

---

## 8. Non-Functional Requirements

| ID | Category | Requirement | Notes |
|----|----------|-------------|-------|
| **NFR-01** | Performance | `onEdit` for a single cell completes in < 2s; bulk paste of 30 cells in < 10s. | Apps Script cold start ~1s; use batch `getValues`/`setValues` where possible. Merge-aware reads for `S7:U7`/`S9:U9`. |
| **NFR-02** | Quotas | Stay within Apps Script quotas: 90 min/day execution, 20k URL fetches, 50 MB properties. No external API calls. | Single-sheet writes are well within limits; backfill is the heaviest op. |
| **NFR-03** | Reliability | No data loss on concurrent edits from two responsables. Use `LockService.getDocumentLock()` for every `Registro` write (5s timeout, retry once). Controlled-window check (FR-013) runs **before** acquiring the lock; lock still applies to all allowed writes. | Playwright confirms view-only anon cannot observe lock contention — test contention with two authenticated editors in staging copy. Queue failed writes for manual retry via menu. Grace-window rejections never acquire the lock. |
| **NFR-04** | Permissions | Script runs as sheet owner via **installable trigger**. Simple `onEdit` handles immediate toast; **installable trigger is required for the `Registro` write** because anonymous/view-only (`ANONYMOUS_…`, Share disabled, `401` on auth endpoints) cannot write and `Session.getActiveUser()` may return empty. Installable trigger executes as owner regardless of editor. Per-section enforcement uses `Config!A:B` (see FR-013, §13 Q5 RESOLVED). | Playwright evidence: anon session receives `streamrows` but cannot commit edits or trigger validation toasts — installable trigger is non-optional. |
| **NFR-05** | Timezone | All dates/timestamps in `America/Lima` (UTC-5, no DST). **Controlled-window calculation (`today` / `today-1`) is strictly in `America/Lima`** — derive `today` via `Utilities.formatDate(new Date(), "America/Lima", "yyyy-MM-dd")` and compare to ISO `E11` date; never use browser or UTC date. Matches `Hoja2` and factory location. Bogotá is same offset — canonical zone remains Lima. Formula locale `es-BO` confirms Spanish functions. | Use `Session.getScriptTimeZone()` set to `America/Lima`. Window logic must normalize both sides to `yyyy-MM-dd` in Lima before comparison (see FR-013, EC-11). |
| **NFR-06** | Maintainability | No npm/pip dependencies. Code lives in `apps-script/` inside the repo, pushed via `clasp` or manual copy. Any downloaded tooling goes under project dir, never `/tmp`. Spanish formulas (`SI.ERROR`/`BUSCARV`/`DIASEM`/`CONTAR.SI`) kept verbatim or converted via `valueRenderOption=FORMULA`. | Constraint from project context + locale finding. |
| **NFR-07** | Observability | Every error writes to `Logger` + toast. Optional `Errors` sheet for persistent error log (append-only). Log merged-range normalization and `Hoja2` lookup failures explicitly. | Helps debugging without Stackdriver. |
| **NFR-08** | Data integrity | `Registro` header row is protected (frozen + protected range). Script never deletes columns or reorders header. `Hoja2` is protected (no edits) — weekday/month lookups break silently if modified. | Prevents accidental schema break. |

---

## 9. Data Model — `Registro` Sheet

### 9.1 Column Specification

| # | Column | Type | Example | Description |
|---|--------|------|---------|-------------|
| A | `record_id` | `STRING` | `PREP-001-2026-03-15` | Derived PK: `section-operator-date`. Stable, human-readable. |
| B | `created_at` | `DATETIME` | `2026-08-30 14:22:05` | First insert timestamp (America/Lima) |
| C | `updated_at` | `DATETIME` | `2026-08-30 15:00:12` | Last update timestamp |
| D | `section` | `ENUM` | `Preparacion` | One of the 6 section names (exact sheet name) |
| E | `operator_doc` | `STRING` | `12345678` | DNI / doc number from column A or B of section sheet (to confirm) |
| F | `operator_name` | `STRING` | `Juan Pérez` | Full name from section sheet |
| G | `date` | `DATE` | `2026-03-15` | ISO date from `E11:AI11` for that column (`=+E13&"/"&$V$9&"/"&$S$7`) |
| H | `weekday` | `STRING` | `S` | Weekday letter from `E12:AI12` (`SI.ERROR(BUSCARV(DIASEM(...),Hoja2!D1:E7,2,FALSO),"")`) — `L/M/X/J/V/S/D` |
| I | `code` | `ENUM` | `F` | `A` / `AT` / `BM` / `F` |
| J | `code_label` | `STRING` | `Falta` | Human label via mapping (for filtering without lookup) |
| K | `month` | `NUMBER` | `3` | Month number (1–12) derived from `V9` (`BUSCARV` on `S9:U9`) |
| L | `year` | `NUMBER` | `2026` | Year derived from `S7:U7` (merged) |
| M | `is_apoyo` | `BOOLEAN` | `FALSE` | `TRUE` if row originated from `Apoyo` sheet |
| N | `section_apoyo` | `STRING` | `` | Destination section when `is_apoyo=TRUE`; empty otherwise |
| O | `edited_by` | `STRING` | `resp.prep@factory.pe` | Active user email or `unknown` (anon case) |
| P | `source_range` | `STRING` | `Preparacion!G22` | A1 notation of source cell for traceability |
| Q | `status` | `ENUM` | `active` | `active` / `void` — only if soft-delete chosen (see §13 Q1) |

> **Column order is fixed.** Adding future columns appends to the right (R, S, …).

> **Storage model (confirmed — incremental upsert, stakeholder 2026-08-30):** The section sheet is a **whole-month view** (regenerated when `S9:U9`/`S7:U7` changes), but Apps Script **saves only the mark(s) that actually changed** — one incremental `upsert` per edited cell in `E15:AI44` that passes the window/permission gate. No whole-table snapshot is ever written. `Registro` is the long-term DB with `month` (K) and `year` (L) per row for filtering; any month view is **reconstructed via `FILTER` / `QUERY` by `month`+`year`** (e.g. `=FILTER(Registro!A:Q, Registro!K:K=V9, Registro!L:L=S7, Registro!D:D="Preparacion")`), not by copying the sheet. Month change (FR-006 / S9) regenerates the grid but triggers **no writes**.

### 9.2 Primary Key & Indexes

| Constraint | Definition |
|------------|------------|
| **Primary Key** | `(section, operator_doc, date)` — or equivalently `record_id`. Uniqueness enforced by script (lookup before insert). No native sheet PK; script does `findRow(PK) → update else append`. |
| **Secondary indexes (logical)** | Filter views / query patterns expected: `by operator_doc`, `by section + month`, `by code`, `by date range`. Implemented as Google Sheets filter views, not physical indexes. |
| **Deduplication** | Before insert, scan `Registro` for existing `record_id`. If found → update `code`, `updated_at`, `edited_by`, `source_range`. If not found → append. |

### 9.3 Storage Estimate

- 6 sections × 30 operators × 31 days × 12 months ≈ **66,960 rows/year** worst case (every cell filled).
- Realistic: ~40–60% fill rate → **~30k rows/year** — well within Sheets limits (10M cells).

---

## 10. Edge Cases & Business Rules

| # | Edge Case | Rule |
|---|-----------|------|
| **EC-01** | **Weekends S/D** — columns where `E12`= `S` or `D` (`SI.ERROR`/`BUSCARV`/`DIASEM` lookup) | Still recordable if a code is entered (factory may work Saturdays). Do not auto-exclude. `W7 = CONTAR.SI($E$12:$AI$12,"S")+CONTAR.SI($E$12:$AI$12,"D")` exclusion in `AJ15:AM15` is display-only. If `Hoja2!D1:E7` is missing, `E12:AI12` blanks via `SI.ERROR` → `W7` undercounts → `%` denominator `MAX($E$13:$AI$13)-$W$7` inflates. Guard: validate `Hoja2!D1:E7` exists on open; log error if weekday lookup returns `""` for a valid `E11` date. Confirm if S/D should be flagged with `is_weekend`. |
| **EC-02** | **Month boundaries** — Feb has 28/29 days; columns beyond month length have blank `E11` (`E11:AI11 = +E13&"/"&$V$9&"/"&$S$7` + `SI.ERROR` blank) | Script checks `E11` for a valid date before processing that column. Blank `E11` (e.g. `31/09` → `SI.ERROR` → `""`) → ignore cell entirely. `V9` (`BUSCARV(S9:U9,Hoja2!A1:B12,2,FALSO)`) and `S7:U7` merged year must be read with merged-range normalization (`trim`, accept `S7:U7` notation). `MAX($E$13:$AI$13)` supplies month length — do not hard-code 30/31. |
| **EC-03** | **Operator moves between sections** | PK includes `section`, so same `operator_doc` on different section + same date creates **two rows** (one per section). This is intentional — reflects physical assignment. If operator permanently moves, old rows stay under old section for history. |
| **EC-04** | **Duplicate operator_doc within same section** | Treat as data error — log warning, use row number as tiebreaker, surface in `Errors` log. Do not block other rows. |
| **EC-05** | **Timezone & locale** | All timestamps use `America/Lima`. Script timezone must be set to `America/Lima` in Project Settings. Formulas use Spanish locale (`es-BO`): `SI.ERROR`/`BUSCARV`/`DIASEM`/`CONTAR.SI` — script must not push English equivalents without conversion. Bogotá is same UTC-5 — no conversion needed, but canonical zone is Lima. |
| **EC-06** | **Concurrent edits** | `LockService.getDocumentLock()` wraps every `Registro` write. If lock acquisition fails, retry once after 1s, then show error toast and queue for manual retry via menu. Playwright cannot observe contention as anon — test with two authenticated editors on a staging copy. |
| **EC-07** | **Permissions — per-section responsible (RESOLVED)** | Each section has **one responsible** (`Config!A:B` `section→email`, fallback `RESPONSABLE` header cell). Editor must satisfy `activeUser == responsible(section)` **and** the grace window (FR-013/EC-11). **Installable trigger (owner)** is still required for the `Registro` write; simple `onEdit` provides the toast. If `Session.getActiveUser()` returns empty (anonymous/view-only — Playwright confirms `ANONYMOUS_…` + `401`), store `unknown`, block the write, and toast to request authenticated edit. Cross-section edit (wrong section) → toast `⛔ No tenés permiso para esta sección.` + no write (RRHH override via `Solicitar corrección` menu only). Server-side enforcement of `A/AT/BM/F` remains even when client validation toasts are invisible. |
| **EC-08** | **Row insertion/deletion in section sheets** | Operator list is expected to stay at rows 15–44. If rows are inserted/deleted, script resolves operator by reading column A/B of the edited row dynamically — no hardcoded row→operator map. |
| **EC-09** | **Sheet rename / merged ranges / Hoja2 integrity** | Section detection uses sheet name allowlist (`Preparacion`, `Continua`, …). If a sheet is renamed, edits are ignored and a warning is logged. Rename requires code update. Additionally: `S7:U7` and `S9:U9` are merged — script must normalize merged A1 notation before comparing year/month. If `Hoja2!A1:B12` (month map) or `Hoja2!D1:E7` (weekday initials) is deleted/renamed, `V9` and `E12:AI12` fail silently (`SI.ERROR` → `""`) — script must validate `Hoja2` presence on install and on each `onEdit` that touches calendar header. Playwright could not inspect `Hoja2` behind tab overflow without scrolling — verify via Sheets API `spreadsheets.get`. |
| **EC-10** | **Registro manual edits** | `Registro` is append/update by script only. Manual edits to `Registro` are discouraged; if they happen, next script upsert for that PK will overwrite `code`/`updated_at` but preserve `created_at`. Document this. |
| **EC-11** | **Grace window — today / today-1 (RESOLVED)** | Strict check: `fecha_col` (ISO from `E11:AI11 = +E13&"/"&$V$9&"/"&$S$7`) must equal `today` **or** `today-1` in **`America/Lima`** (`yyyy-MM-dd`). Timezone handling: normalize both sides via `Utilities.formatDate(..., "America/Lima", "yyyy-MM-dd")`; daylight edge (00:00 Lima) must not use UTC or browser date. Bulk paste: evaluate per-cell — cells outside window are individually skipped with a summary toast (e.g. `3 omitidas fuera de ventana`). Fallback for older dates (`< today-1`): **no `Registro` write**; toast `⛔ Solo podés registrar hoy y ayer. Para fechas anteriores usá Asistencia → Solicitar corrección / Registro manual.` and optional revert; RRHH then edits via `Solicitar corrección` / `Registro manual` menu which bypasses the gate with audit (`edited_by` + `via_manual`). Log every blocked attempt to `Errors` with `section, cell, fecha_col, activeUser`. |

---

## 11. UX / Flow

### 11.1 Happy Path — Single Cell Edit

```
Responsable types "F" in Preparacion!G22
        │
        ▼
onEdit fires → validates: sheet ∈ allowlist, range ∩ E15:AI44,
                E11 (=+G13&"/"&$V$9&"/"&$S$7 with S7:U7 merged) has date,
                code ∈ {A,AT,BM,F} (streamrows-validated), SI.ERROR not blank
        │
        ├── Invalid → toast "⚠️ Código no válido. Use A, AT, BM o F." + optional revert (no auto-revert v1)
        │
        └── Valid → check **ownership + grace window** (FR-013):
                responsible = Config!A:B[section] ?? RESPONSABLE header
                fecha_col = E11 ISO date (G11 in this example)
                today/today-1 in America/Lima
                │
                ├── Blocked (fecha_col < today-1) → toast "⛔ Solo podés registrar hoy y ayer. Para fechas anteriores usá Asistencia → Solicitar corrección / Registro manual." + optional revert, **no Registro write** (EC-11)
                ├── Blocked (activeUser != responsible) → toast "⛔ No tenés permiso para esta sección." + optional revert, **no write** (EC-07)
                │
                └── Allowed → Lock → findRow(record_id) → insert or update (incremental upsert, one cell) → toast "✅ Registrado: Juan Pérez — 2026-03-15 = F (Preparacion)"
```

> Calendar reads must go through `SpreadsheetApp` / Sheets API v4 (`valueRenderOption=FORMULA` for formulas), never canvas scraping. Window check uses `Utilities.formatDate(new Date(), "America/Lima", "yyyy-MM-dd")` vs ISO `fecha_col` — never browser/UTC (NFR-05).

### 11.2 Bulk Paste

- Detect `e.range` with `numRows > 1 || numCols > 1`.
- Iterate each cell in range ∩ `E15:AI44` with valid date column (`E11` via `=+E13&"/"&$V$9&"/"&$S$7` not blank).
- **Per-cell grace-window + ownership check** (FR-013/EC-11): skip cells where `fecha_col < today-1` or `activeUser != responsible(section)`; count as `omitidas fuera de ventana` / `sin permiso`.
- Batch all `Registro` lookups for allowed cells only (read `Registro` once into memory map `record_id → rowIndex`).
- Apply all upserts/deletes, then single `setValues` batch if possible, or row-by-row with lock held (incremental, not snapshot).
- Normalize `S7:U7`/`S9:U9` once per operation (merged ranges).
- Toast: `"✅ Sincronizados: 12 insertados, 3 actualizados, 1 eliminado, 2 omitidas fuera de ventana."`

### 11.3 Clear / Delete

- Empty cell (blank allowed by validation) → lookup `record_id` → if found, delete row (or set `status=void` per §13 Q1) → toast `"🗑️ Registro eliminado: …"`.
- No-op if no existing row.

### 11.4 Error Handling

| Scenario | UX |
|----------|----|
| Invalid code | Toast error, no write, cell left as-is (user corrects) — enforce server-side; anon view-only cannot show client dropdown |
| Out-of-window (`fecha_col < today-1`) | Toast `"⛔ Solo podés registrar hoy y ayer. Para fechas anteriores usá Asistencia → Solicitar corrección / Registro manual."` + optional revert, **no write**; logged to `Errors`. RRHH corrects via menu override. |
| Wrong section / owner mismatch | Toast `"⛔ No tenés permiso para esta sección."` + no write. `Config!A:B` mapping is source of truth. |
| Lock timeout | Toast `"⏳ Registro ocupado, reintentando…"` → retry → if still fails `"❌ No se pudo guardar. Use Asistencia → Re-sincronizar."` |
| `Registro` sheet missing | Create it with header row, then proceed |
| `Hoja2` lookup failure | Toast `"⚠️ Hoja2 no accesible — calendario no calculado."` + log to `Errors` |
| Script not authorized | Toast `"🔒 Autorización requerida. Abra Asistencia → Autorizar."` + menu item triggers installable trigger auth flow (required for anon/view-only) |

### 11.5 Menu

```
Asistencia
├── Ver Registro          → activate Registro sheet
├── Re-sincronizar fila   → re-sync active row (E15:AI of current row, respects window unless override)
├── Solicitar corrección  → RRHH override: edit any date/section with audit (bypasses window/owner gate, logs via_manual)
├── Registro manual       → alias for Solicitar corrección — direct Registro row edit with month/year + audit
├── Backfill histórico    → full scan of 6 sheets → upsert (with confirmation dialog, respects window unless RRHH confirms full)
└── Autorizar             → request auth for installable trigger (if needed)
```

Silent by default — toasts are the only interruption. No modal dialogs on normal edits.

---

## 12. Out of Scope for v1

| Item | Why deferred |
|------|--------------|
| Dashboard / charts in Sheets | Requires `Registro` to exist first; v2 |
| Automatic `AJ:AM` (`CONTAR.SI`/`MAX`-`W7`) % recomputation via script | Keep Spanish formulas v1; revisit if they prove fragile (see §13 Q4) |
| Email/WhatsApp alerts on `F` | Needs notification infra |
| Web form or mobile app for entry | 6-sheet UX is intentional and stays |
| Payroll / HR system integration | External dependency |
| Historical `Registro` partitioning by year | Single sheet handles ~30k rows/year; partition when hitting limits |
| Undo / version history UI | Sheets native version history suffices v1 |
| Multi-year calendar navigation beyond `S7:U7`/`S9:U9` | Current `BUSCARV`/`DIASEM` calendar is sufficient |
| Canvas/DOM scraping for attendance | Disproven — `canvas` + `freezebar-handle` + anon view-only make it impossible; use Sheets API v4 |

---

## 13. Open Questions — Require Stakeholder Decision Before Spec

> **Blocking:** Q1–Q5 must be resolved before `sdd-spec` (Q5 now **RESOLVED** 2026-08-30 — per-section; Q9 also RESOLVED — today+1). Q6–Q10 can be decided during design (Q6 remains OPEN — weekends stay recordable).

| # | Question | Context | Options | Recommendation |
|---|----------|---------|---------|----------------|
| **Q1** | Should clearing a cell **delete** the `Registro` row or mark it `void`? | Determines audit completeness. | A) Hard delete (simpler, fewer rows). B) Soft delete `status=void` (audit trail, never lose history). | **B — soft delete** if audit matters; A if sheet size is concern. |
| **Q2** | Is `Registro` **append-only audit** (every change = new row) or **mutable latest-state** (one row per PK, updated)? | Affects PK design and history queries. | A) Mutable (one row/PK, `updated_at`). B) Append-only (every edit = new row with version). | **A — mutable** for v1 (simpler reporting). Append-only is v2 if full history needed. |
| **Q3** | What is the **canonical operator identity** — DNI in column A, name in column B, or both? | PK uses `operator_doc`. Verified grid is `E15:AI44`; identity columns are A/B to left of frozen pane `left:412px`. | Need to inspect actual column layout (A/B/C) via Sheets API `spreadsheets.get` (not canvas). | Confirm which column holds DNI/doc. |
| **Q4** | Should `AJ:AM` summary `%` formulas (`CONTAR.SI`/`MAX`-`W7`) be **kept, replaced, or dual-maintained**? | Formulas verified as `=+CONTAR.SI($E15:$AI15,AJ$10)/(MAX($E13:$AI13)-$W$7)` with `W7=CONTAR.SI(S)+CONTAR.SI(D)` — fragile but familiar. | A) Keep as-is. B) Compute in script and write values. C) Keep formulas + add `Registro`-based summary sheet. | **A for v1, C for v2** — don't touch formulas until `Registro` is stable. |
| **Q5 — RESOLVED (2026-08-30)** | Who can edit which section? Is there a **per-section permission** requirement? | ✅ Stakeholder confirmed: **yes, per-section** — each of the 6 sections has a different responsible (`Config!A:B` `section→email`, fallback `RESPONSABLE` header). `Config` is source of truth; cross-section edits blocked (FR-013/EC-07). | A) Anyone with sheet access can edit any section. **B) Per-section editors enforced — SELECTED.** | **RESOLVED → B.** Enforce via `Config!A:B` + header; protected ranges optional hardening. See FR-013, EC-07, §4. |
| **Q6 — OPEN (weekends remain open)** | How should **weekends (S/D)** be treated — excludable, flaggable, or normal? | `W7` (`CONTAR.SI` S/D) suggests Sundays/Saturdays excluded from denominator; `SI.ERROR` blank on invalid dates complicates. Stakeholder 2026-08-30: **no decision needed — weekends remain recordable** (factory may work Saturdays). | A) Normal (record if entered). B) Flag `is_weekend` column. C) Block entry on S/D. | **Remains OPEN → A + optional flag** — don't block entry; keep EC-01 behavior; add `is_weekend` only if reporting needs it. |
| **Q7** | **Retention period** for `Registro` — infinite, yearly archive, or rolling window? | Affects sheet size and archiving strategy. | A) Infinite in one sheet. B) Yearly sheets `Registro_2026`. C) Archive after N years. | **A for v1** (30k rows/year is fine); B when approaching limits. |
| **Q8** | Should `Apoyo` create **one row** (with flag) or **two rows** (original section + apoyo section)? | Determines how support is counted. | A) One row with `is_apoyo` + `section_apoyo`. B) Two rows (one per section). | **A** — single row with flag; avoids double-counting. Confirm with RRHH. |
| **Q9 — RESOLVED (2026-08-30)** | Is there a **cutoff time** for daily marks (e.g., marks after 18:00 belong to next day)? | ✅ Stakeholder confirmed: **no time-of-day cutoff. Controlled window is `today + 1 day grace`** — `fecha_col == today OR today-1` in `America/Lima`. Date is strictly the column header (`E11:AI11 = +E13&"/"&$V$9&"/"&$S$7`), not entry timestamp. Corrections for older dates require RRHH via `Solicitar corrección / Registro manual`. | A) No cutoff, column date only. **B) Today + 1 grace (SELECTED).** C) Hard cutoff at 18:00. | **RESOLVED → B (today+1 grace).** See FR-013, EC-11, §11. Entry time logged as `edited_at` only for audit. |
| **Q10** | Where should **operator master data** live — section sheets only, or a central `Operarios` sheet? | Impacts deduplication and moves. | A) Keep in section sheets. B) Central `Operarios` sheet with doc→name→section mapping. | **A for v1**, B as future improvement. |

---

## 14. Next Steps

| Step | Owner | Artifact / Command | Exit Criteria |
|------|-------|--------------------|---------------|
| **1. Validate this PRD** | Stakeholder + Tech | Review §13, answer Q1–Q5; review Appendix D evidence | PRD marked `Approved` |
| **2. SDD Propose** | Tech | `sdd-propose` — change proposal with scope & approach | Proposal accepted |
| **3. SDD Spec** | Tech + Stakeholder | `sdd-spec` — delta specs with Given/When/Then scenarios per FR | Spec reviewed |
| **4. SDD Design** | Tech | `sdd-design` — Apps Script architecture, trigger strategy (installable required), `Registro` schema final | Design approved |
| **5. SDD Tasks** | Tech | `sdd-tasks` — implementation task breakdown | Tasks ready for `sdd-apply` |
| **6. Implement** | Tech | `sdd-apply` — build `apps-script/` + backfill + manual QA on a copy of the sheet (never prod) | All FRs verified via Sheets API v4 |
| **7. Verify & Rollout** | Tech + RRHH | `sdd-verify` — test on sheet copy, then deploy to production sheet | `Registro` live |

### Immediate Actions

- [ ] Schedule 30-min review to resolve §13 Q1–Q5.
- [ ] Confirm `operator_doc` column and share a sample operator row (anonymized) for schema validation — resolve via Sheets API `spreadsheets.get` with `valueRenderOption=FORMULA` (not canvas).
- [ ] Create a **copy** of the production sheet for development/testing (never test triggers on prod) — authenticate to move beyond anonymous view-only.

---

## Appendix A — Code Mapping Reference

| Code | Full Label | Category | Counts toward | Evidence |
|------|------------|----------|---------------|----------|
| `A` | Asistencia | Present | `AJ` — % Asistencia (`CONTAR.SI` / `MAX`-`W7`) | `E15=A` live |
| `AT` | Tardanza / Atraso | Late | Separate column `AK`/`AL` (`CONTAR.SI` with `AJ$10` header) | `F15=AT`, `G15=AT` live |
| `BM` | Baja Médica | Medical leave | Separate column | `streamrows` + color `12575222` |
| `F` | Falta | Absent | `AK` — % Faltas | `streamrows` validation block |
| *(empty)* | — | No mark | Denominator = `MAX($E$13:$AI$13) - $W$7` (working days) | `H15=""` blank allowed |

> `AJ:AM` headers (`AJ$10:AM$10`) hold the code strings; `W7` = `CONTAR.SI(S)+CONTAR.SI(D)`. Final column mapping verified against live formulas in `AJ15:AM15`.

## Appendix B — Constraints Compliance

| Constraint | How this PRD complies |
|------------|-----------------------|
| No npm/pip installs | Apps Script uses only built-in services (`SpreadsheetApp`, `LockService`, `Session`, `Utilities`); Playwright evidence used `playwright-cli 0.1.18` without installs |
| Downloads under project dir | Any tooling (e.g., `clasp`) installed under `tools/` in the repo, not `/tmp` |
| Built-in tools only | PRD evidence collected via `input#t-name-box` + `streamrows` + Sheets API v4, not DOM scraping |
| Spanish locale | Formulas kept as `SI.ERROR`/`BUSCARV`/`DIASEM`/`CONTAR.SI` with `FALSO`; merged ranges `S7:U7`/`S9:U9` normalized |

## Appendix C — Glossary

| Term | Meaning |
|------|---------|
| **Section** | One of 6 factory areas: Preparacion, Continua, Acoplado, Retorcedoras, Madejeras, Producto Terminado |
| **Registro** | Central normalized sheet — single source of truth for attendance |
| **Apoyo** | Operator temporarily supporting a different section |
| **onEdit / onSelectionChange** | Google Apps Script triggers — `onEdit` fires on cell edit; `onSelectionChange` on selection change (both require installable trigger for `Registro` writes under anon view-only) |
| **Idempotent upsert** | Insert if PK absent, update if PK present — re-running produces same result |
| **Hoja2** | Hidden lookup sheet: `A1:B12` month names→numbers, `D1:E7` weekday number→initial (`L/M/X/J/V/S/D`) |
| **W7** | Weekend count `CONTAR.SI(S)+CONTAR.SI(D)` — subtracted from `MAX(E13:AI13)` in summary `%` denominator |
| **freezebar-handle** | Overlay at `left:412px` / `top:24px` that freezes panes and intercepts canvas clicks |
| **streamrows / selection** | XHR endpoints carrying compressed sheet model (values, styles, validation) — truth source when canvas is opaque |

---

## Appendix D — Playwright Evidence (Preparacion, gid 740536758)

> Source: `docs/playwright-evidence/Preparacion-analysis.md` — `playwright-cli 0.1.18`, 2026-08-30, anonymous view-only. See that file for verbatim `eval` outputs and decomposed `streamrows` JSON.

### D.1 Screenshots & Snapshots

| File | Purpose | Key observation |
|------|---------|-----------------|
| `Preparacion-01-overview.png` | First viewport after `click e346` → Preparacion active | Canvas `1264×524` visible, tab `Preparacion` (`:1d`) active |
| `Preparacion-02-I12-formula.png` | Canvas-centre `mousemove+mousedown+mouseup` selects `I12` | Formula bar `=+SI.ERROR(BUSCARV(DIASEM(I11,2),Hoja2!$D$1:$E$7,2,FALSO),"")` |
| `Preparacion-03-E15.png` | Name-box `E15` → value `A` | Sample attendance mark `A` (live value, not formula) |
| `Preparacion-04-AJ15.png` | `AJ15` summary formula | `=+CONTAR.SI($E15:$AI15,AJ$10)/(MAX($E13:$AI13)-$W$7)` |
| `Preparacion-05-grid.png` | Final idle grid after arrow-key walk `E15→F15→G15→H15` | Freeze panes intact, blank permissive (`H15=""`) |
| `page-2026-08-30T18-36-56-342Z.yml` | Snapshot post-click Preparacion | 10 tabs `e338`–`e402`, `canvas`, `#t-name-box=A1`, `#waffle-grid-container` |
| `page-2026-08-30T18-38-37-202Z.yml` | Snapshot after I12 select | Validates `freezebar-handle` overlay, `cell-input` editor |
| `page-2026-08-30T18-47-00-818Z.yml` | Snapshot at AJ15 | Summary zone, `font Arial 11`, `zoom 100%` |

### D.2 Eval & Network Outputs

| Ref | Output | Interpretation |
|-----|--------|----------------|
| `document.title` | `Control-de-Asistencia.xlsx - Hojas de cálculo de Google` | Imported `.xlsx` — explains Spanish formulas |
| `location.href` | `…/edit?gid=740536758#gid=740536758` | Confirms Preparacion gid after `click e346` |
| `.docs-sheet-active-tab .docs-sheet-tab-name` | `Preparacion` | Tab navigation truth (DOM button query undercounts) |
| `#t-name-box` / `#t-formula-bar-input` per-cell table (§5.2) | `S7:U7=2026`, `S9:U9=Septiembre`, `V9=BUSCARV`, `E11/E12/W7/AJ15` Spanish | Authoritative model — snapshot has no cell text |
| `canvas rect` | `0,142,1264,524` (`1264px×524px`) | Single canvas rendering — no `<td>` grid |
| `performance.getEntriesByType('resource')` | `wasm calcworker_wasm_cd.wasm`, `waffle_k_ltr.css`, `sheets-images-rt`, `play.google.com/log` | Sheet data not in static resources |
| `waffle_api.getInstanceOfApp()` | Keys `W_`, `Gb`, `qc`… obfuscated | Do not rely on internal JS |
| `streamrows 200` (`response-body 126/148`) | Decomposed `gridRange 950512471` + styles `67094526` + validation `A/AT/BM/F` + `ARRAYFORMULA` | Truth for validation/colors even when anon |
| `selection 200×30` | `selection=[[[gid,row,col],[gid,row,col,w,h]]]` per navigation | Fires on every name-box move |
| `renderdata 200` | `sheets-images-rt/...` only | Image layer, not cell values |
| `console` | `401` anon set (`peoplestack`, `ServiceLogin`), `405` renderdata GET, `13 errors 15-22 warnings` | Anonymous view-only confirmed; does not block load |

### D.3 Repro Steps

```bash
# No package installs, no /tmp — uses existing playwright-cli 0.1.18
/home/luis-cm/.local/share/pnpm/bin/playwright-cli open \
  "https://docs.google.com/spreadsheets/d/1iw9bduLeGXQMbjmMV1qrMqE2WoPWCBz3/edit?usp=sharing&ouid=117451366137059836661&rtpof=true&sd=true"
# wait for snapshot → confirm "- AYUDA -" active (gid 1765343219)

playwright-cli click e346  # Preparacion (id :1d) — snapshot ref; verify via location.href
playwright-cli eval "document.getElementById('t-name-box').value"
playwright-cli eval "document.getElementById('t-formula-bar-input').textContent"

# Verified formula loop — fill --submit is the only reliable navigation
playwright-cli fill e252 "S7:U7" --submit && playwright-cli eval "document.getElementById('t-formula-bar-input').textContent"  # 2026
playwright-cli fill e252 "S9:U9" --submit && playwright-cli eval "document.getElementById('t-formula-bar-input').textContent"  # Septiembre
playwright-cli fill e252 "V9" --submit    && playwright-cli eval "document.getElementById('t-formula-bar-input').textContent"  # =+BUSCARV(...)
playwright-cli fill e252 "E15" --submit   && playwright-cli eval "document.getElementById('t-formula-bar-input').textContent"  # A
playwright-cli press ArrowRight && playwright-cli eval "document.getElementById('t-name-box').value"  # F15 → AT (walk)
playwright-cli fill e252 "AJ15" --submit  && playwright-cli eval "document.getElementById('t-formula-bar-input').textContent"  # =+CONTAR.SI(...)

# Evidence capture
playwright-cli screenshot --filename=docs/playwright-evidence/Preparacion-01-overview.png
playwright-cli snapshot --boxes  # for canvas rect / freezebar coordinates
playwright-cli requests && playwright-cli response-body 126  # streamrows truth

# Toggle --static for wasm/css resources; use selection/streamrows for model truth
```

> **Limitations to carry forward:** Canvas scraping impossible; `freezebar-handle` intercepts `click "canvas"`; anonymous view-only blocks edits/validation toasts; `waffle_api` obfuscated; merged ranges `S7:U7`/`S9:U9` alias; Spanish locale `SI.ERROR`/`BUSCARV`/`DIASEM`/`CONTAR.SI`. Apps Script must use **Sheets API v4** or `onEdit` with `SpreadsheetApp`, not DOM.**

---

*End of PRD v0.2.1 — updated with controlled window (today+1) + per-section responsible (stakeholder 2026-08-30). Awaiting stakeholder validation before SDD phases.*
