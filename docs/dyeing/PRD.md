# Dyeing (Teñido) — Product Requirements Document

| Field | Value |
|-------|-------|
| **Version** | 0.1.0 |
| **Date** | 2026-09-14 |
| **Status** | Draft |
| **Source** | `docs/dyeing/lotes-tenidos.xlsx` — sheets `tenidos`, `db_tenidos`, `items` (2 example rows in DB) |

> §1 + §2 = 2-min version. §4–§9 = implementation detail.

## 1. Quick Path

1. **Problem:** Single reusable dyeing form (`tenidos` `B1:I25`) captures one lot at a time across two independent blocks (Teñido `B6:E15` + Muestra `B18:E25`) — no queryable history, no audit, no per-lot traceability. Data is overwritten when `C3` (ID Lote) changes. The proposed `db_tenidos` (25 physical cols `A:Y`) exists as a header-only draft with 2 example rows, no validations, no formulas, no persistence path.
2. **Solution:** Keep `tenidos` as the single reusable entry form (one lot = one `C3`). Persist it into `db_tenidos` (`A:AD`, 25 physical + 5 audit = 30 cols, PK `ID Lote` → `Nº Lote`) via an **explicit save** — menu `Teñido → Guardar` + mobile checkbox (e.g. `G4`, `FALSE→TRUE`, debounce 3 s). STRING fields captured via `getDisplayValue()` stored as string; **NUMBER fields `E11`/`E21:E24` stored as number** — no validation in Script. Sheets native type is source of truth. A lot can be filled in **two times** (teñido first, muestreo later) — upsert by `ID Lote` merges partial saves.
3. **Verify:** On a **COPY** of the spreadsheet: install trigger + authorize (`dyeingSetup` / `onOpen` reload) → fill `tenidos!C3` + Teñido block → `Teñido → Guardar` (or checkbox `G4 TRUE`) → assert `db_tenidos` has 1 row with `A = C3` verbatim and `H`/`S:V` as numbers, rest as strings → clear `C3`, re-enter same `ID Lote` + fill Muestra block → save again → assert same row updated (no duplicate), `creado` preserved, audit in `America/La_Paz`.

## 2. Executive Summary

Dyeing traceability is captured in a single-lot form that conflates two lifecycle stages (dyeing and lab sampling) into one sheet with no database.

| Form | Range | Purpose | Rows/day |
|------|-------|---------|----------|
| `tenidos` | `B1:I25` | Single-lot file: Teñido block `B6:E15` + Muestra block `B18:E25`, keyed by `C3` ID Lote | ~14 lots/day (estimate) → 1 row per lot in DB |

| Pain | Impact |
|------|--------|
| Reusable form is the only storage | History overwritten on `C3` change; no per-lot lookup |
| Two-stage lot (teñido → muestreo days apart) | Partial state lost if form is reused before lab results |
| No database / no audit | Not queryable, not traceable who saved when |
| `items` catalogs only on paper | Dropdowns maintained manually, no Script coupling |
| No mobile affordance | Checkbox-save pattern missing (unlike `yarn-production` `M4` / `yarn-settings` `I8`) |

**Solution:** One reusable form `tenidos` (`B1:I25`, PK `C3`) drives an explicit save (menu + mobile checkbox with 3 s debounce) → `db_tenidos` (`A:AD`, 30 cols, PK `ID Lote`, upsert). STRING fields stored as string, **NUMBER fields `H`/`S:V` stored as number** — no `DATEVALUE`/`Titulo "@"` coercion. Sheets native type is source of truth. `items` stays as manual catalog source. No formulas — input-only.

## 3. Goals / Non-Goals

**Goals v1:** Single reusable form for all lots; every lot closable with one explicit save (menu or checkbox); idempotent **upsert by `ID Lote`**; **two-times fill** supported; **Sheets native type is source of truth — no validation in Script** (STRING as string, `E11`/`E21:E24` as number, `Titulo m/g` `"@"` verbatim); mobile checkbox with debounce; no auto-clear after save.

**Non-Goals v1:** Replacing lab instruments; payroll/HR integration; automatic per-cell persistence (`onEdit` per `B6:E25`); multi-file import; cross-sheet JOIN or dashboard/aggregation; rewriting `items` catalogs or adding Script-side list validation; `Ver db_…` menu item (explicitly excluded per user request); formula preservation (no formulas exist — input-only).

## 4. Current State Analysis

### 4.1 Sheet Inventory — 4 sheets (1 form + 1 database target + 1 catalog + log)

| Sheet | Purpose | Type | State |
|-------|---------|------|-------|
| `tenidos` | Input form — single-lot file `B1:I25` (Teñido `B6:E15` + Muestra `B18:E25`, PK `C3`) | Form | Single reusable template — title `B1:I25` dyeing file, mobile checkbox at `G4` (to create) |
| `db_tenidos` | Database per lot (one row per `ID Lote`) `A:AD` (25 physical + 5 audit) | Table | Target database — header drafted, 2 example rows, no validations, no live formulas |
| `items` | Catalogs: `Tipo`, `Titulo` (`B2:B24`), `Clientes` (`C2:C40`) | Catalog | Manual source for dropdowns; user configures lists directly; Script never writes here |
| `Errors` | Optional log | Table | Observability — to create |

> `tenidos` is `B1:I25` only. No other geometry is persisted. `db_tenidos` `A:Y` physical cols are header-only; audit `Z:AD` is new.

### 4.2 Template Mechanics

#### 4.2.1 `tenidos` — `B1:I25` (single-lot form, input-only, no live formulas to preserve)

All cells are **Input** — no `Formula` kind. Dropdowns/lists are native Sheets dataValidation; Script does not validate or convert.

| Range | Value / Formula (verbatim) | Meaning | Kind |
|-------|-----------------------------|---------|------|
| `B1:I2` | `FICHA DE TEÑIDO` (merged banner + subtitle) | Title | Label |
| `B3` | `ID Lote` (label) | PK label | Label |
| `C3` | `LT-001` (example, free text) | **ID Lote — PK visible** → `db_tenidos!A` | **Input — PK** (string, no conversion) |
| `G4` | `FALSE` → `TRUE` checkbox (to create, label `H4` e.g. `☑ GUARDAR`) | Mobile save trigger — `FALSE→TRUE` fires installable `dyeingOnEdit` → `guardarLote()` → reset `G4=FALSE` after ~1 s, debounce `MOBILE_SAVE_DEBOUNCE_MS=3000` (pattern `yarn-production` `M4` / `yarn-settings` `I8`) | Input (checkbox) |
| `B6` | `DATOS DE TEÑIDO` (section header) | Teñido block title | Label |
| `B6:E15` | **Bloque Teñido** (10 fields) | Dyeing data | Input zone |
| `C6` | `12/09/2026` (example) — validation `DATEVALUE` native | **Fecha teñido** `dd/mm/yyyy` — native Sheets `DATE` + `DATEVALUE` validation | Input — captured as string via `getDisplayValue()`, stored as string, no timezone conversion |
| `C7` | `Dia` — list `Dia,Tarde,Noche` (dropdown, dataValidation native) | **Turno teñido** | Input (lista nativa) — captured as string, stored as string, no validation in Script |
| `C8` | `Junior` — list `Junior,Rondi,Pablo` (dropdown) | **Supervisor teñido** | Input (lista nativa) — string passthrough |
| `C9` | `Hector` — list `Hector,Tigre,Gonzi` (dropdown) | **Ctrl Calidad teñido** (`C.C.`) | Input (lista nativa) — string passthrough |
| `E6` | `AZUL Marino` (example, free text) | **Color** | Input — string |
| `E7` | `A-203` (example, free text) | **Código** | Input — string |
| `E8` | `Reactivo` (example, free text) | **Tipo colorante** | Input — string |
| `E9` | `HB` — list `HB,N` (dropdown) | **Material** | Input (lista nativa) — string |
| `E10` | `Cono` — list `Cono,Industrial,Ovillo,3B-cono,…` (dropdown) | **Linea** | Input (lista nativa) — string |
| `E11` | `60` (example, `0.00`) | **Tº (ºC)** | Input — **NUMBER** (`0.00` native) |
| `E12` | `@ 24/1` (example) — prefix `@` + list `items!B2:B24` (dropdown) | **Titulo m/g** | Input (lista nativa) — **stored as string `"@ …"` verbatim, no number coercion** |
| `E13` | `1` — list `Ropero,1,2,4` (dropdown) | **Tina** | Input (lista nativa) — string |
| `E14` | `1ro` — list `1ro,2do,3ro,4to,5to,6to` (dropdown) | **Nº Ingreso** | Input (lista nativa) — string |
| `E15` | `Cliente X` — list `items!C2:C40` (dropdown) | **Cliente** | Input (lista nativa) — string |
| `B18` | `DATOS DE MUESTRA` (section header) | Muestra block title | Label |
| `B18:E25` | **Bloque Muestra** (10 fields) | Lab sample data | Input zone |
| `C18` | `14/09/2026` (example) — validation `DATEVALUE` native | **Fecha muestreo** `dd/mm/yyyy` | Input — string passthrough, no timezone conversion |
| `C19` | `Tarde` — list `Dia,Tarde,Noche` (dropdown) | **Turno muestra** | Input (lista nativa) — string |
| `C20` | `Rondi` — list `Junior,Rondi,Pablo` (dropdown) | **Supervisor muestra** | Input (lista nativa) — string |
| `C21` | `Tigre` — list `Hector,Tigre,Gonzi` (dropdown) | **Ctrl Calidad muestra** | Input (lista nativa) — string |
| `E18` | `85` (example, free text) | **Secado 1** | Input — string |
| `E19` | `82` (example, free text) | **Secado 2** | Input — string |
| `E20` | `Bueno` — list `Bueno,Doble Tono,…,S,M` (dropdown) | **Revisión** | Input (lista nativa) — string |
| `E21` | `24.5` (example, `0.00`) | **Titulo 1** (`0.00`) | Input — **NUMBER** |
| `E22` | `24.6` (example, `0.00`) | **Titulo 2** (`0.00`) | Input — **NUMBER** |
| `E23` | `850` (example, `General`) | **Torsión 1** | Input — **NUMBER** |
| `E24` | `860` (example, `General`) | **Torsión 2** | Input — **NUMBER** |
| `E25` | `Sin obs.` (example, free text) | **Observación** | Input — string |

> **Input-only invariant:** `tenidos` has **no live formulas** to exclude. The entire `B6:E15` + `B18:E25` + `C3` is persisted. `G4` checkbox is excluded from persistence (control only). `Titulo m/g` (`E12`) includes the `@` prefix — captured and stored verbatim as **STRING**. Dates (`C6`, `C18`) are native Sheets `DATE` (`dd/mm/yyyy`) — stored as native display string passthrough. **Numbers `E11`, `E21`, `E22`, `E23`, `E24` are native Sheets `NUMBER` (`0.00`/`General`) — captured as number and stored as number** — no string coercion. All other dropdowns are STRING passthrough. Timezone `America/La_Paz` applies **only** to audit fields `creado`/`actualizado`.

#### 4.2.2 `items` — catalogs (manual, Script never writes)

| Range | Value (verbatim) | Meaning | Kind |
|-------|------------------|---------|------|
| `A2:A…` | `Tipo` values | Tipo catalog | Catalog — user-maintained |
| `B2:B24` | Titulo list (e.g. `12/1, 16/1, 20/1, 24/1 …`) | Titulo m/g options for `tenidos!E12` (`@` prefixed in form) | Catalog — user-maintained, dropdown source |
| `C2:C40` | Cliente list (e.g. `Cliente A, Cliente B …`) | Cliente options for `tenidos!E15` | Catalog — user-maintained, dropdown source |

> User configures dropdowns manually in `items` and via Sheets dataValidation on `tenidos`. Script does not read `items` for validation — Sheets native dropdown is source of truth.

#### 4.2.3 `db_tenidos` — `A:AD` (30 cols: 25 physical `A:Y` + 5 audit `Z:AD`)

No validations, no live formulas. `A:G`, `I:Q`, `R`, `W:Y` stored as **STRING**; `H`, `S:V` stored as **NUMBER**; `L`/`R` dates stored as display string passthrough. See §8.1 for full column spec.

## 5. Proposed Solution Overview

```
tenidos (B1:I25, C3 PK, G4 checkbox) ── explicit Save ──▶ db_tenidos (A:AD, 1 row per ID Lote, upsert) ──▶ Errors (optional log)
   B6:E15 Teñido (C6 fecha, C7 turno, C8 sup, C9 C.C., E6:E15)    menu Teñido → Guardar + G4 FALSE→TRUE (debounce 3s)
   B18:E25 Muestra (C18 fecha, C19 turno, C20 sup, C21 C.C., E18:E25)   installable dyeingOnEdit → guardarLote() → reset G4=FALSE
   items (B2:B24 titulos, C2:C40 clientes) ── manual dropdown source (no Script coupling)
```

| Principle | Rationale |
|-----------|-----------|
| 1 form, 1 DB table | One lot = one `C3` = one row in `db_tenidos`; no per-machine/per-turno split |
| View ≠ storage | `tenidos` is never queried as DB; `db_tenidos` is the source of truth |
| Denormalize all fields per row | No JOIN; each row is standalone filterable by `Nº Lote`/`Color`/`Cliente`/`fecha` |
| Typed capture (no conversion) | STRING fields via `getDisplayValue()` stored as string; **NUMBER fields `T(ºC)` `E11`, `Titulo 1/2` `E21/E22`, `Torsión 1/2` `E23/E24` stored as number**; `Titulo "@"` stays string with prefix; no validation/coercion in Script; Sheets native type is source of truth |
| Explicit save (menu + checkbox, debounce 3 s) | User controls when a lot is closed; avoids partial/cell-level persistence; mobile-friendly (pattern `yarn-production` `M4` / `yarn-settings` `I8`) |
| Upsert by `ID Lote` (PK `C3 → A`) | Re-saving same lot updates in place; supports **two-times fill** (teñido first, muestreo later — each save merges) |
| Track last change per row | Each row stores `creado`/`actualizado`/`editado_por` in `America/La_Paz`; `rango_origen` + `estado` for traceability/soft-delete |
| Timezone `America/La_Paz` only for audit | `creado`/`actualizado` in `America/La_Paz`; `Fecha teñido`/`Fecha muestreo` stored as string passthrough without timezone conversion |
| Catalog isolation | `items` is user-maintained; Script never validates against it |

## 6. Functional Requirements

### 6.1 Form & Save

| ID | Requirement | Priority |
|----|-------------|----------|
| **FR-001** | Single input sheet `tenidos` is the only entry point: `C3` ID Lote (PK, free text), Teñido block `B6:E15` (`C6` Fecha teñido `dd/mm/yyyy`, `C7` Turno, `C8` Supervisor, `C9` Ctrl Calidad, `E6` Color, `E7` Código, `E8` tipo colorante, `E9` Material, `E10` Linea, `E11` Tº, `E12` Titulo m/g `@`, `E13` Tina, `E14` Nº Ingreso, `E15` Cliente), Muestra block `B18:E25` (`C18` Fecha muestreo, `C19` Turno, `C20` Supervisor, `C21` Ctrl Calidad, `E18` Secado1, `E19` Secado2, `E20` Revisión, `E21` Titulo1, `E22` Titulo2, `E23` Torsión1, `E24` Torsión2, `E25` Observación), plus checkbox `G4` (mobile trigger). All ranges are **Input** — no formula ranges to preserve. | Must |
| **FR-002** | Dropdowns and date validations are **Sheets native** (dataValidation + `DATEVALUE` on `C6`/`C18`, lists for `C7`/`C8`/`C9`/`E9`/`E10`/`E12`/`E13`/`E14`/`E15`/`C19`/`C20`/`C21`/`E20`). **Sheets native type is source of truth — no conversion/validation in Script.** STRING fields captured via `getDisplayValue()` stored as string; **NUMBER fields `E11`, `E21`, `E22`, `E23`, `E24` captured as number and stored as number**; `Titulo "@"` kept with prefix verbatim. Script does not read `items` for validation. User configures dropdowns manually. | Must |
| **FR-003** | Explicit save via **`Teñido → Guardar`** menu **and** mobile checkbox (`tenidos!G4`, `FALSE→TRUE` triggers installable `dyeingOnEdit` → `guardarLote()` → reset `G4=FALSE` after ~1 s). Debounce `MOBILE_SAVE_DEBOUNCE_MS=3000` — ignore `TRUE` if previous save was <3 s ago (pattern `yarn-production` `M4` / `yarn-settings` `I8`). Menu has **no `Ver db_…` item** per user request. Menu items: `Teñido → Guardar \| Re-sincronizar` (plus `onOpen` creates menu and ensures `G4` dataValidation `FALSE/TRUE`). | Must |
| **FR-004** | Save is **upsert by PK `ID Lote`** (`tenidos!C3` → `db_tenidos!A`), not append. If `A = C3` exists → update that row in place (merge: overwrite all `B:Y` with current form values, even if some are now empty — supports two-times fill). If not found → append one row. `creado` preserved on update; `actualizado` + `editado_por` refreshed. `rango_origen` set to `tenidos!C3:I25` (or `B6:E25` trace). Last write wins on duplicate `ID Lote`. | Must |
| **FR-005** | **Typed capture invariant:** STRING fields via `getDisplayValue()` stored as string; **NUMBER fields `T(ºC)` `E11`, `Titulo 1/2` `E21/E22`, `Torsión 1/2` `E23/E24` captured as number and stored as number** (native `0.00`/`General`). Dates (`C6`, `C18`) stored as `dd/mm/yyyy` display string passthrough; `Titulo m/g` (`E12`) stored with `@` prefix verbatim (`"@ 24/1"`); `Secado 1/2` (`E18/E19`) stored as string. No `Number()`/`DATEVALUE`/`@`-stripping/`parseFloat` in Script. Timezone `America/La_Paz` **only** for audit `creado`/`actualizado`. | Must |
| **FR-006** | No formulas to preserve or exclude — `tenidos` is **input-only**. Script never writes formulas, never reads `items` for computation, never recalculates. Database stores the form verbatim (25 physical cols). The only non-persisted control is `G4` checkbox (reset to `FALSE`, never stored). | Must |
| **FR-007** | After save, toast `✅ Guardado: {ID Lote} — {Color} {Código} por {user}` (or `ID Lote` + `Cliente` if Color/Código empty). On failure, log to `Errors` and toast `❌ Error — usá Re-sincronizar`. On `C3` empty, toast `⚠️ Ingresá ID Lote en C3` and skip (EC-01). | Must |
| **FR-008** | `Re-sincronizar` (`Teñido → Re-sincronizar`) re-hydrates `tenidos` from `db_tenidos` for the current `C3`: if `A = C3` found → populate `B6:E15` + `B18:E25` verbatim (strings); if not found → toast `— sin registros para {ID Lote}, listo para cargar` and leave form as-is (no clear). Hydration is explicit only — no auto `onEdit` hydration on `C3` change (unlike `coneras-production` auto-hydrate). | Should |
| **FR-009** | Post-save never auto-clears. User clears `C3` manually for next lot. `Re-sincronizar` does not clear either. | Should |

### 6.2 Validation & Guards

| ID | Requirement | Priority |
|----|-------------|----------|
| **FR-010** | Before any write: `C3` (ID Lote) must be non-empty (trimmed). Empty `C3` blocks save entirely — no row created, toast `⚠️ Ingresá ID Lote en C3`, log to `Errors` (EC-01). No other field is required — Teñido-only or Muestra-only partial saves are valid (EC-02, two-times fill). | Must |
| **FR-011** | No Script-side list validation. Unknown `Turno`/`Supervisor`/`C.C.`/`Material`/`Linea`/`Tina`/`Nº Ingreso`/`Cliente`/`Revisión` values are **stored as-is** — Sheets native dropdown already constrains input; Script is passthrough. If Sheets validation is bypassed (paste), the raw string is still stored. | Must |
| **FR-012** | Saves are concurrency-safe via `LockService.getDocumentLock()` (timeout 5 s, one retry). On lock failure, log to `Errors` and toast `❌ Error — usá Re-sincronizar`; failed save can be retried idempotently (upsert). | Must |
| **FR-013** | `post-save` checkbox reset: `G4` is set back to `FALSE` after save completes (whether success or validation-blocked), so the next `FALSE→TRUE` transition is detectable. Debounce ensures rapid double-taps do not double-save. | Must |

## 7. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-01 | Performance | Single lot save <2 s (1 row, 30 cols). Batch `getValues`/`setValues` on `B6:E15` + `B18:E25` + `C3` + `G4` only. |
| NFR-02 | Reliability | `LockService.getDocumentLock()` per save (5 s, retry once); idempotent upsert — retry never duplicates. Save runs with owner permissions (installable trigger). |
| NFR-03 | Locale | Keep Spanish field names verbatim in headers and form labels (`Teñido`, `Tº`, `Tina`, `Nº Ingreso`, `Torsión`, `Ctrl Calidad`). No English translation of domain terms. Formulas: none — nothing to keep verbatim; if added later, use `es-BO` `SI`/`BUSCARV` via `valueRenderOption=FORMULA`. |
| NFR-04 | Timezone | `America/La_Paz` (UTC-4, no DST) **only** for audit fields `creado`/`actualizado` (`Utilities.formatDate(…, "America/La_Paz", "yyyy-MM-dd HH:mm:ss")`). `Fecha teñido` (`C6`) and `Fecha muestreo` (`C18`) are stored as native display string (`dd/mm/yyyy`) without timezone conversion — passthrough. |
| NFR-05 | Data integrity | `db_tenidos` headers `A:AD` are protected and frozen; column order frozen (§8.1). `tenidos` has no formula columns to protect. `items` is never written by Script. |
| NFR-06 | Observability | User feedback via toast; validation and save failures logged to `Errors` (`timestamp`, `ID Lote`, `action`, `error`, `user`). `Logger` for debugging. |
| NFR-07 | Isolation | `apps-script/dyeing/` is an independent Apps Script V8 project (own `appsscript.json` with `timeZone: "America/La_Paz"`) — no shared globals with `attendance-control`/`yarn-production`/`yarn-settings`/`yarn-inventory`/`coneras-production`. Tooling under `apps-script/dyeing/tools/` if needed, never `/tmp`. |
| NFR-08 | No external deps | Only `SpreadsheetApp`/`LockService`/`Session`/`Utilities` — no npm/pip, no external fetches. |

## 8. Data Model

Order is frozen. `tenidos` is UX only (input-only, typed). `db_tenidos` is the upsert target. `A:G`, `I:Q`, `R`, `W:Y` are **STRING**; `H`, `S:V` are **NUMBER**; `L`/`R` dates are display string passthrough. Audit `Z:AD` in `America/La_Paz`.

### 8.1 `db_tenidos` — One row per lot (PK `ID Lote`) — 30 columns (A:AD) — 25 physical + 5 audit

Physical cols `A:G`, `I:Q`, `R`, `W:Y` are **STRING** (via `getDisplayValue()`); `H` (`Tº`), `S`/`T` (`Titulo 1/2`), `U`/`V` (`Torsión 1/2`) are **NUMBER**; `L`/`R` dates are `dd/mm/yyyy` string passthrough; `Titulo m/g` `E` keeps `@` prefix.

| # | Col | Header | Type | Example | Description | Source |
|---|-----|--------|------|---------|-------------|--------|
| 1 | A | `Nº Lote` | STRING | `LT-042` | **PK** — `ID Lote` from `tenidos!C3` (trimmed) | `C3` |
| 2 | B | `Color` | STRING | `AZUL Marino` | Color | `E6` |
| 3 | C | `Código` | STRING | `A-203` | Código | `E7` |
| 4 | D | `tipo colorante` | STRING | `Reactivo` | Tipo colorante | `E8` |
| 5 | E | `Titulo m/g` | STRING | `@ 24/1` | Titulo m/g — **string with `@` prefix verbatim** | `E12` |
| 6 | F | `Material` | STRING | `HB` | Material `HB,N` | `E9` |
| 7 | G | `Linea` | STRING | `Cono` | Linea `Cono/Industrial/Ovillo/3B-cono…` | `E10` |
| 8 | H | `T(ºC)` | NUMBER | `60` | Temperatura | `E11` |
| 9 | I | `Tina` | STRING | `1` | Tina `Ropero/1/2/4` | `E13` |
| 10 | J | `Nº Ingreso` | STRING | `1ro` | Nº Ingreso `1ro…6to` | `E14` |
| 11 | K | `Cliente` | STRING | `Cliente X` | Cliente `items!C2:C40` | `E15` |
| 12 | L | `Fecha Teñido` | STRING | `12/09/2026` | Fecha teñido `dd/mm/yyyy` — string passthrough | `C6` |
| 13 | M | `Sup.` | STRING | `Junior` | Supervisor teñido | `C8` |
| 14 | N | `Turno` | STRING | `Dia` | Turno teñido `Dia/Tarde/Noche` | `C7` |
| 15 | O | `Secado 1` | STRING | `85` | Secado 1 (muestra) | `E18` |
| 16 | P | `Secado 2` | STRING | `82` | Secado 2 (muestra) | `E19` |
| 17 | Q | `Revisión` | STRING | `Bueno` | Revisión `Bueno/Doble Tono…/S/M` | `E20` |
| 18 | R | `Fecha Muestreo` | STRING | `14/09/2026` | Fecha muestreo `dd/mm/yyyy` — string passthrough | `C18` |
| 19 | S | `Titulo 1` | NUMBER | `24.5` | Titulo 1 (muestra) | `E21` |
| 20 | T | `Titulo 2` | NUMBER | `24.6` | Titulo 2 (muestra) | `E22` |
| 21 | U | `Torsión 1` | NUMBER | `850` | Torsión 1 | `E23` |
| 22 | V | `Torsión 2` | NUMBER | `860` | Torsión 2 | `E24` |
| 23 | W | `C.C.` | STRING | `Tigre` | Ctrl Calidad muestra | `C21` |
| 24 | X | `Turno` | STRING | `Tarde` | Turno muestra `Dia/Tarde/Noche` | `C19` |
| 25 | Y | `Observación` | STRING | `Sin obs.` | Observación | `E25` |
| 26 | Z | `creado` | DATETIME | `2026-09-14 10:30:00` | First insert, `America/La_Paz` — never overwritten | audit |
| 27 | AA | `actualizado` | DATETIME | `2026-09-14 15:22:10` | Last upsert, `America/La_Paz` | audit |
| 28 | AB | `editado_por` | STRING | `user@factory.bo` | `Session.getActiveUser().getEmail()` or `unknown` | audit |
| 29 | AC | `estado` | ENUM | `active` | `active`/`void` — soft-delete | audit |
| 30 | AD | `rango_origen` | STRING | `tenidos!C3:I25` | Traceability | audit |

> PK `Nº Lote` (`A`) → `id = C3` trimmed. `findRow(A = C3) → update else append`. All `B:Y` overwritten on update (supports two-times fill: first save may have only teñido cols, second save fills muestra cols without losing teñido). `creado` never overwritten; `actualizado`/`editado_por` refreshed on every upsert. `estado` defaults to `active`. `items` is never persisted. Today `db_tenidos` has 2 example rows — they remain valid under this schema.

Column ranges: `db_tenidos` `A:AD` (30). Form read ranges: `tenidos!C3`, `tenidos!B6:E15`, `tenidos!B18:E25`, `tenidos!G4`.

### 8.2 Primary Keys & Indexes

| Constraint | Definition |
|------------|------------|
| `db_tenidos` PK | `(Nº Lote)` → `A` = `tenidos!C3` trimmed; `id = C3` string |
| Dedup | Lookup by `A`; if found → update `B:Y` + `AA`/`AB`/`AC`/`AD`; if not → append |
| Secondary views | Filter by `Nº Lote`, `Color`, `Código`, `Cliente`, `Fecha Teñido`, `Turno`, `Tina`, `estado` via `QUERY`/`FILTER` (future dashboard, out of scope v1) |
| Catalog | `items!B2:B24` (titulo), `items!C2:C40` (clientes) — manual, no PK |

### 8.3 Storage Estimate

~14 lots/day × 365 = **~5,110 rows/yr** in `db_tenidos` (30 cols → ~153k cells/yr). At 10 years ≈51k rows, ~1.5M cells — well within the 10M cell limit. No partitioning needed for v1.

## 9. Edge Cases & Business Rules

| # | Edge Case | Rule |
|---|-----------|------|
| EC-01 | `C3` (ID Lote) empty or whitespace-only | **Block save entirely** — no row created, no audit written. Toast `⚠️ Ingresá ID Lote en C3`, log to `Errors` with `rango_origen=tenidos!C3`. Applies to both menu and checkbox path. |
| EC-02 | Two-times fill — first save has only Teñido, second save adds Muestra (or vice versa) | **Partial save is valid.** Each save is an upsert that overwrites all `B:Y` with current form values. If Muestra block is empty on first save, `O:Y` stored as `""`; second save with Muestra filled overwrites `O:Y` while preserving Teñido cols (since form still holds them). If user cleared `C3` between saves, they must re-enter same `C3` and Teñido values are re-entered or re-hydrated via `Re-sincronizar` before second save — otherwise second save would overwrite Teñido cols with `""`. Recommended flow: `Re-sincronizar` before second-stage edit. |
| EC-03 | Clearing fields then saving (soft-delete) | If an existing `ID Lote` is saved with **all** `B:Y` empty (only `C3` has value) → row is **soft-deleted** (`estado=void`, `actualizado`/`editado_por` refreshed), not hard-deleted. If only some fields cleared → those cols stored as `""` (partial clear). Re-saving with values re-activates (`estado=active`). Hard delete is never performed. |
| EC-04 | Duplicate `ID Lote` — saving same `C3` twice | **Upsert — last write wins**, no duplication. `creado` preserved from first insert; `actualizado`/`editado_por` refreshed. No warning needed (expected for two-times fill). If intentional new lot needs same ID, user must change `C3` first. |
| EC-05 | Dates (`C6`, `C18`) — string passthrough | Stored as **display string** (`dd/mm/yyyy` as shown in sheet, via `getDisplayValue()`). No `DATEVALUE` parsing, no `Utilities.formatDate` on the date value, no timezone conversion. Invalid/empty dates stored as `""`/verbatim (Sheets native validation already constrains; Script is passthrough). Audit `creado`/`actualizado` still use `America/La_Paz`. |
| EC-06 | `Titulo m/g` (`E12`) with `@` prefix | Stored as **string verbatim** including `@` and space (e.g. `"@ 24/1"`). No stripping, no numeric coercion. Empty stored as `""`. |
| EC-07 | `Tº`/`Titulo 1/2`/`Torsión 1/2` (NUMBER) | Stored as **number** — native `0.00`/`General` from sheet; no string coercion. `Secado 1/2` remains string. |
| EC-08 | Paste bypassing dropdown validation | Stored as-is (string passthrough). Sheets native validation may show a warning in the UI, but Script does not block or coerce. This is intentional — **Sheets native dropdown is source of truth**, Script never second-guesses. |
| EC-09 | `G4` checkbox rapid double-tap | Debounce `MOBILE_SAVE_DEBOUNCE_MS=3000` — second `TRUE` within 3 s is ignored (toast `⏳ Guardado reciente, esperá 3s`). `G4` reset to `FALSE` after each handled save. |
| EC-10 | `db_tenidos` sheet missing or header mismatch | On first save, create `db_tenidos` with frozen header `A:AD` (§8.1) if missing. If header exists but column count <30, extend/align (never reorder existing cols). |
| EC-11 | Concurrency — two users saving same `ID Lote` | `LockService.getDocumentLock()` (5 s, retry once) serializes. Last writer wins (upsert). No merge — full row overwrite. Log contention to `Errors`. |
| EC-12 | `Re-sincronizar` with `C3` empty | Toast `⚠️ Ingresá ID Lote en C3` and no-op (same as EC-01). |
| EC-13 | `items` catalog changed (new cliente/titulo) | No impact on stored rows — existing `db_tenidos` rows keep old string values. New saves use new dropdown values. No backfill. |

## 10. UX / Flow

### 10.1 Happy Path — Two-times fill (teñido → muestreo)

```
Day 1 — Teñido:
  Open tenidos, C3=LT-042, fill B6:E15 (C6=12/09/2026, C7=Dia, C8=Junior, C9=Hector,
    E6=AZUL Marino, E7=A-203, E8=Reactivo, E9=HB, E10=Cono, E11=60, E12=@ 24/1,
    E13=1, E14=1ro, E15=Cliente X) — leave B18:E25 empty
  → Teñido → Guardar (or G4 ☑ TRUE, debounce 3s)
   → validate C3 non-empty (all-string capture, no conversion)
   → Lock (5s, retry 1) → upsert db_tenidos A=LT-042 (B:Y as strings, O:Y = "")
   → audit Z=creado/AA=actualizado (America/La_Paz), AB=editado_por, AC=active, AD=tenidos!C3:I25
   → toast "✅ Guardado: LT-042 — AZUL Marino A-203 por user@factory.bo"
   → G4 reset to FALSE
   → no auto-clear; C3 stays LT-042

Day 3 — Muestra (same lot):
  Open tenidos, C3=LT-042
  → Teñido → Re-sincronizar (or just keep form if still LT-042)
   → lookup db_tenidos A=LT-042 → populate B6:E15 + B18:E25 verbatim (strings)
   → fill B18:E25 (C18=14/09/2026, C19=Tarde, C20=Rondi, C21=Tigre,
        E18=85, E19=82, E20=Bueno, E21=24.5, E22=24.6, E23=850, E24=860, E25=Sin obs.)
  → Teñido → Guardar (or G4 TRUE)
   → upsert db_tenidos A=LT-042 — overwrite O:Y with muestra strings, B:N preserved (form still held them)
   → toast "✅ Guardado: LT-042 — AZUL Marino A-203 por user@factory.bo"
   → creado preserved, actualizado/editado_por refreshed

Next lot:
  Clear C3, enter LT-043, fill again → new row appended.
```

### 10.2 Error Handling

| Scenario | UX |
|----------|----|
| `C3` empty / whitespace | Toast `⚠️ Ingresá ID Lote en C3`, no write, log to `Errors`, `G4` reset to `FALSE` |
| `C6`/`C18` invalid date (pastable bypass) | Stored as entered string (passthrough); no block — Sheets native `DATEVALUE` already warns in UI |
| Dropdown value not in list (paste bypass) | Stored as-is (passthrough); no block |
| No `db_tenidos` sheet | Create header `A:AD` frozen/protected, then proceed |
| Save contention (lock timeout) | Toast `⏳ ocupado, reintentando…` → retry once → `❌ Error — usá Re-sincronizar` + log `Errors` |
| `Re-sincronizar` with unknown `C3` | Toast `— sin registros para {ID Lote}, listo para cargar`, form unchanged |
| `Re-sincronizar` with `C3` empty | Toast `⚠️ Ingresá ID Lote en C3`, no-op |
| Double-tap `G4` within 3 s | Ignored, toast `⏳ Guardado reciente, esperá 3s` |

### 10.3 Menu

```
Teñido → Guardar | Re-sincronizar
```

> **No `Ver db_tenidos` item** per user request. `Guardar` is the explicit save (menu path). `G4` checkbox is the mobile path (same `guardarLote()`). `Re-sincronizar` is explicit re-hydration for `C3` (no auto-hydrate on `C3` change). `onOpen` creates menu and ensures `G4` checkbox dataValidation.

## 11. Out of Scope for v1

| Item | Why deferred |
|------|--------------|
| Dashboard / charts for `db_tenidos` | Requires database first; v2 (native `QUERY`/`FILTER` on `A:AD`; `H`/`S:V` already numeric) |
| Calculator / helper blocks | None in this workbook; if added, excluded from persistence |
| `Ver db_tenidos` menu item | Explicitly excluded per user request |
| Auto-hydrate on `C3` change | Explicit `Re-sincronizar` only; auto-hydrate deferred (unlike `coneras-production`) |
| Email or messaging alerts | Infra |
| Web form / mobile web app | Sheet UX remains; menu + checkbox covers desktop and mobile |
| Undo UI | Sheet version history plus `editado_por`/`actualizado` audit suffices |
| Row-level history / version table | Out of scope — upsert overwrites `actualizado`/`editado_por`; no version table; `estado=void` preserves last row |
| Script-side validation against `items` | Sheets native dropdown is source of truth; Script is passthrough |
| Numeric coercion or date parsing | Typed invariant — `H`/`S:V` native number, no extra conversion; all else passthrough |

## 12. Open Questions — Correct Before Spec

| # | Question | Recommendation | Decision |
|---|----------|----------------|----------|
| Q1 | `C3` ID Lote format — free text vs prefixed pattern (`LT-###`)? | Free text (trimmed), no pattern enforcement — simplest, matches current sheet | [ ] |
| Q2 | `G4` checkbox position — confirm `G4` (vs `I8`/`M4` precedent)? | `G4` with label `H4` `☑ GUARDAR` (near `C3`), dataValidation `FALSE/TRUE`, debounce 3 s | [ ] |
| Q3 | `Re-sincronizar` — explicit only vs auto on `C3` change? | Explicit only for v1 (simpler, no `onEdit` on `C3`); auto-hydrate can be added in v2 if requested | [ ] |
| Q4 | Soft-delete vs hard-delete when `B:Y` all cleared then saved? | Soft-delete `estado=void` (preserve row, audit) — consistent with `yarn-inventory` EC-04 | [ ] |

## Appendix A — Constraints Compliance

| Constraint | Compliance |
|------------|------------|
| Formulas | None in `tenidos` — input-only. If added later, keep `es-BO` verbatim via `valueRenderOption=FORMULA`. |
| Timezone | `America/La_Paz` only for audit `creado`/`actualizado`; `Fecha teñido`/`Fecha muestreo` stored as string passthrough without conversion. |
| Isolation | `apps-script/dyeing/` is an independent project (own `appsscript.json` `America/La_Paz`) — no shared globals with other projects. |
| Input-only | Entire `tenidos!B6:E15` + `B18:E25` + `C3` persisted as strings; `G4` checkbox is control only; `items` never written. |
| Typed invariant | STRING fields captured as string, **NUMBER fields `H`/`S:V` as number**, no conversion/validation in Script — Sheets native type is source of truth. `Titulo "@"` kept verbatim. |
| No external deps | Only `SpreadsheetApp`/`LockService`/`Session`/`Utilities` — no npm/pip. Tooling under `apps-script/dyeing/tools/`, never `/tmp`. |
| Menu | `Teñido → Guardar \| Re-sincronizar` — no `Ver db_…` item per user request. Checkbox `G4` with debounce 3 s. |
| Permissions | Saves run with owner permissions (installable trigger); anon cannot write. |

## Appendix B — Glossary

| Term | Meaning |
|------|---------|
| `tenidos` | Form sheet `B1:I25` — single-lot file; Teñido block `B6:E15` + Muestra block `B18:E25`, PK `C3` ID Lote |
| `db_tenidos` | Database per `ID Lote` — 1 row per lot, PK `Nº Lote` (`A` = `C3`), 30 cols `A:AD` (25 physical + 5 audit), all physical as STRING |
| `items` | Catalog sheet — `B2:B24` titulos, `C2:C40` clientes; manual dropdown source, never written by Script |
| `Errors` | Log sheet (optional) — `timestamp`, `ID Lote`, `action`, `error`, `user` |
| `ID Lote` / `Nº Lote` | PK — `tenidos!C3` → `db_tenidos!A`; trimmed string, free text |
| `Titulo m/g` | `tenidos!E12` — string with `@` prefix (e.g. `"@ 24/1"`), stored verbatim |
| `Tº` / `T(ºC)` | `tenidos!E11` → `db_tenidos!H` — temperature, stored as **number** (`0.00`) |
| `Torsión` | `tenidos!E23`/`E24` → `db_tenidos!U`/`V` — stored as **number** |
| `G4` checkbox | Mobile save trigger — `FALSE→TRUE` → `dyeingOnEdit` → `guardarLote()` → reset `FALSE`, debounce 3000 ms |
| Idempotent upsert | Insert if `A = C3` absent, update if present — `creado` preserved, `actualizado`/`editado_por` refreshed |
| Typed capture | STRING fields via `getDisplayValue()` as string; **NUMBER fields `H`/`S:V` as number** — no extra coercion |
| Two-times fill | Lot filled in two stages (teñido then muestreo) — each `Guardar` upserts same `ID Lote`, merging partial state |

*End of PRD v0.1.0 — dyeing (teñido).*
