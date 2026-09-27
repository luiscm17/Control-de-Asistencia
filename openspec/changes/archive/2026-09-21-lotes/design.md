# Design: Lotes — Daily Lot Tracking (lotes-form → db_lots)

## Technical Approach

Isolated Apps Script V8 project `apps-script/lotes/` bound to spreadsheet `19lBJHHKsusI6Eqkni-zh8us6ePoEHscEgrIPrFK-zhE` sheet `lotes-form` (gid `1098679039`). The form is a reusable 30-row view controlled by `D4` (`DATE dd/MM/yyyy` native Sheets passthrough); persistence targets `db_lots` (`A:K`, PK `id = yyyy-MM-dd-posicion`). Two explicit save entry points (`F4 FALSE→TRUE` checkbox via installable `lotesOnEdit` and menu `Lotes → Guardar`) converge on a single public `guardarLotes()` that performs idempotent upsert/delete by PK under `LockService.getDocumentLock()` (5 s + one retry). Date navigation (`D4` edit or menu `Lotes → Resincronizar`) calls `rehidratarPorFecha_()` which rehydrates `C8:G37` by posicion via single-scan batch read. Audit timestamps (`creado`/`actualizado` `yyyy-MM-dd HH:mm:ss`) use `Utilities.formatDate(..., "America/La_Paz")` and identity via `Session.getActiveUser().getEmail() || "unknown"`; no browser/UTC timezone is used. Follows established patterns from `apps-script/dyeing` (`G4` checkbox guard + `dyeingOnEdit` dispatch), `yarn-settings` (`I8` checkbox + `PropertiesService`/`in-memory` reset guard), and `yarn-production` (`M4` `MOBILE_SAVE_DEBOUNCE_MS=3000`, batch `getValues()/setValues()`). `Config.gs` is the SSOT; no literal `getRange("D4")` outside Config. No files outside `apps-script/lotes/` are modified; verification on COPY only.

Source mapping: `docs/lotes/PRD.md` v0.1.0 FR-001…FR-009 + EC-01…EC-08, `openspec/changes/lotes/proposal.md` Approach/Risks, and `openspec/changes/lotes/specs/lotes-lot-recording/spec.md` (8 requirements, Given/When/Then). Spec → Design trace: every requirement maps to a File Change row and an Interface below.

## Architecture Decisions

### Decision: Isolated GAS Project with Config SSOT

**Choice**: New project `apps-script/lotes/` with its own `appsscript.json` (`timeZone: America/La_Paz`, scopes `spreadsheets`, `script.scriptapp`, `script.container.ui`, `userinfo.email`), `LOTES_CONFIG = Object.freeze({...})` owning `SHEET_FORM=lotes-form`, `SHEET_DB=db_lots`, `SHEET_ERRORS=Errors`, ranges `D4`, `F4`, `B7:G7`, `B8:G37`, `A:K` header order, `IDX` map, `TIMEZONE`, `LOCK_MS=5000`, `RETRY_SLEEP_MS=1000`, `DEBOUNCE_MS=3000`, `ROWS=30`.

**Alternatives considered**: Extending `apps-script/dyeing` or `yarn-settings` with a lotes branch; sharing a root `Config.gs` across `apps-script/*`.

**Rationale**: Repo contract (AGENTS.md Snapshot) isolates each Apps Script project — no shared globals, each bound deployment. Reuse would couple PK styles (`dyeing` single-row `C3` PK vs lotes 30-row `fecha-posicion` PK) and risk header drift. Frozen `Object.freeze` + helper `lotesGetRange_(sheet, a1Range)` (via `lotesParseA1_`/`lotesParseRange_`) enforces the spec invariant "no literal outside Config" and mirrors `DYEING_CONFIG`/`YARN_SETTINGS_CONFIG` exactly.

### Decision: Explicit Save Only (F4 Checkbox + Menu) → Single `guardarLotes()`

**Choice**: Both triggers invoke the same public `guardarLotes()`; no per-cell `onEdit` auto-save. Checkbox path is gated by `FALSE→TRUE` transition check (`e.oldValue`/`e.value` normalized via `lotesNormalizeCheckboxValue_` handling `TRUE/FALSE` and `VERDADERO/FALSO` / empty oldValue) plus `PropertiesService.getDocumentProperties()` `lotes-is-resetting-f4` or in-memory flag so the programmatic `F4=FALSE` reset does not re-enter. Simple `onEdit(e)` delegates to `lotesOnEdit(e)` so the menu path works even without installable trigger authorization; `setupLotes()` creates the installable trigger `ScriptApp.newTrigger("lotesOnEdit").forSpreadsheet(...).onEdit().create()`.

**Alternatives considered**: Per-row `onEdit` auto-save; drawing button assigned to script.

**Rationale**: Per-cell save captures partial rows, amplifies trigger quota (90 min/day free), and makes intentional delete (`C` cleared → delete row) ambiguous — rejected in proposal Alternatives. Drawing button is not mobile-compatible; checkbox+menu hybrid is proven in `yarn-settings` `I8` and `dyeing` `G4`. Single function eliminates divergent paths and satisfies spec scenario "Menu save invokes same function".

### Decision: Native `D4` Passthrough — No Script Validation

**Choice**: Read `D4` only via `getValue()` (no `getDisplayValue()` coercion, no regex parsing). For `fecha` column `B` store `dd/MM/yyyy` display string derived from the same `Date` (Sheets `DATE` format `dd/MM/yyyy` on column `B`); for `id` prefix derive `yyyy-MM-dd` via `Utilities.formatDate(d4Date, "America/La_Paz", "yyyy-MM-dd")` or normalized `Date.getFullYear/Month/Date` helper `lotesDateKey_`. If `D4` is blank, non-Date, or Sheets did not coerce to `Date`, treat as empty → toast `Seleccione una fecha en D4.`, zero writes, log `Errors`, reset `F4=FALSE`.

**Alternatives considered**: Parsing pasted strings (`dd/MM/yyyy` → `Date`) in Script; adding Sheets data validation on `D4`.

**Rationale**: PRD FR-004 explicitly forbids Script transformation of `D4`; Sheets native `DATE` semantics are truth. Consistent with `yarn-production` `G2` `d/M/yyyy` and `dyeing` `C6`/`C18` passthrough. Avoiding validation removes locale edge cases (es-BO `Si.ERROR` not involved here) and keeps the guard minimal and testable.

### Decision: Batch Index by `id` + Bottom-Up Delete, No Soft-Delete Column

**Choice**: Inside the lock, one `getValues()` reads `db_lots` `A:K` (up to 30*365 rows/year) into `byId: { [id]: { rowNum, data } }` and `byRow` list (`lotesBuildDbState_`). For each posicion 1..30: `id = yyyy-MM-dd-posicion`, `titulo = String(row[2]).trim()` (C); if non-empty → `findRow(id)` → update `B:G` preserving `creado`/`creado_por` else `appendRow` with `creado=actualizado=nowLaPaz`; if empty and exists → queue for `deleteRow` bottom-up (descending `rowNum`) to avoid index shift. Batch `setValues()` for updates/appends; `deleteRow()` calls after batch writes. `B` (`No` `1..30`) is never read as a DB field and never written.

**Alternatives considered**: Soft-delete with `estado=void` column (as in `dyeing` `AE`); per-row `getRange().getValue()/setValue()` loop.

**Rationale**: PRD §6 orders `A:K` with `id`/`fecha` only — no `estado` column; empty `C` means row disappearance is intentional (EC-02) and physical delete keeps `fecha` queries clean. Bottom-up delete is the proven `auto-archive` recipe from `google-apps-script` skill (performance 70x) and matches attendance `E15:AI44` bottom-up void pattern. Batch index keeps the operation within 6-min execution and single trigger quota unit.

### Decision: Single-Scan Rehydration Writing Only `C8:G37`

**Choice**: `rehidratarPorFecha_()` reads `D4` via `getValue()` passthrough; if empty → `clearContent` on `C8:G37` and re-assert `B8:B37=1..30`, no DB scan error, toast guidance. Otherwise one `getValues()` scans `db_lots`, filters `fecha == display dd/MM/yyyy` (or `yyyy-MM-dd` key via same `D4` normalization), builds `posicion → {titulo, tipo_material, codigo_lote, color, observacion}` map, clears `C8:G37`, then one `setValues()` writes `C:G` by posicion (empty strings for misses), re-asserts `B8:B37=1..30` via `setValues([[1],[2],…,[30]])`.

**Alternatives considered**: Per-posicion `VLOOKUP` formulas in `lotes-form`; reading `db_lots` with `TextFinder`/query API.

**Rationale**: Single scan mirrors `yarn-settings` `yarnHydrateSettingsForm_` and `dyeing` `dyeingWriteForm_`; keeps trigger time <1 s for 30 rows. Writing only `C:G` preserves the visual `No` invariant and satisfies spec scenario "No column persisted". Re-asserting `B8:B37` defends against manual corruption while never persisting `No`.

### Decision: LockService 5 s + One Retry with Flush and Error Evidence

**Choice**: `LockService.getDocumentLock().tryLock(5000)` → if false `Utilities.sleep(1000)` → `tryLock(5000)` again. On success, do all reads/writes then `SpreadsheetApp.flush()` before toast `✅ Guardado: dd/MM/yyyy — N lotes` (N = count of `C` non-empty posiciones). On exhaustion → zero writes, toast `Ocupado, reintente con Resincronizar`, append row to `Errors` `A:F` (`yyyy-MM-dd HH:mm:ss America/La_Paz`, `lotes`, `guardarLotes lock`, detail, user), reset `F4=FALSE` (guarded). `finally { lock.releaseLock() }`. Audit helpers `lotesAuditTimestamp_()` and `lotesEditorEmail_()` isolate `Utilities.formatDate`/`Session` for reuse by `Core` and `Persistence`.

**Alternatives considered**: `tryLock(10000)` single attempt; `LockService.getScriptLock()`; optimistic write with conflict detection via `id` duplicate scan.

**Rationale**: Document lock is correct scope (sheet-bound, not script-bound) per `dyeing/Core.gs` `dyeingAcquireLock_` and `attendance` `LockService.getDocumentLock()` 5 s pattern. Two-phase retry balances concurrency (two users saving same `fecha`) against trigger budget; flush before toast is required by `google-apps-script` skill ("Flush Before Returning") for dialog/menu visibility.

## Data Flow

### Save Path (F4 or Menu → db_lots)

```
lotes-form!F4 FALSE→TRUE  ─┐
                           ├─→ lotesOnEdit(e) ── lotesIsSaveCheckboxEvent_(e) ? ── lotesMarkSaved_/guard? ── guardarLotes()
lotes-form!D4 edit ────────┘     │                     │
Menu Lotes→Guardar ──────────────┘                     └─→ rehidratarPorFecha_() [no lock, read-only]
Menu Lotes→Resincronizar ─────────────────────────────────→ rehidratarPorFecha_()

guardarLotes() internal:
  lotes-form!D4.getValue() passthrough ── empty? ─→ toast "Seleccione una fecha en D4." + log Errors + reset F4=FALSE (guarded) → return
                                   │
                                   └─→ fechaDisplay dd/MM/yyyy + fechaKey yyyy-MM-dd (Utilities.formatDate America/La_Paz)
                                          │
                                          ├─→ LockService.getDocumentLock() tryLock(5000) → sleep 1000 → tryLock(5000)
                                          │        └─ fail twice → toast "Ocupado..." + log Errors + reset F4=FALSE → return
                                          │
                                          └─→ success: Ingest read B8:G37 single getValues() (C:G payload, B ignored)
                                                       │
                                                       ├─→ Persistence lotesBuildDbState_(db_lots) — single getValues() A:K → byId map
                                                       │
                                                       ├─→ for posicion 1..30 (id = fechaKey-posicion)
                                                       │      titulo=C.trim() non-empty? → byId[id]? update B:G preserving creado → setValues()
                                                       │                                 : append [id, fechaDisplay, C,D,E,F,G, creado=now, actualizado=now, creado_por, actualizado_por]
                                                       │      titulo empty && byId[id]? → queue rowNum for bottom-up deleteRow()
                                                       │      titulo empty && !byId[id] → skip
                                                       │
                                                       ├─→ deletes bottom-up (descending rowNum), batch setValues/appends committed
                                                       ├─→ SpreadsheetApp.flush()
                                                       ├─→ toast "✅ Guardado: dd/MM/yyyy — N lotes" + dyeing-style detail if desired
                                                       └─→ finally: lock.releaseLock(); reset F4=FALSE (guard flag) + flush

Audit: creado preserved on update, actualizado/actualizado_por refreshed via Utilities.formatDate(new Date(),"America/La_Paz","yyyy-MM-dd HH:mm:ss") + Session.getActiveUser().getEmail()||unknown
Errors: every early-return and catch appends Errors A:F via lotesLogError_ (timestamp La_Paz, scope lotes, range, code, reason, user)
```

### Rehydration Path (D4 navigation → lotes-form)

```
Trigger: lotesOnEdit detects D4 edit (lotesIsDateEdit_) OR menu Lotes→Resincronizar → rehidratarPorFecha_()
  │
  ├─ D4.getValue() passthrough ── empty/invalid Date? ─→ lotes-form!C8:G37.clearContent(); B8:B37 = 1..30 (re-assert); flush; return 0; toast guidance
  │
  └─ valid Date → derive fechaDisplay dd/MM/yyyy + fechaKey yyyy-MM-dd
         │
         ├─ db_lots.getValues() single scan A:K (no lock)
         │     └─ build posicion→row map where row[0]==id==fechaKey-posicion OR row[1]==fecha display match
         │        (canonical PK match; fecha column fallback for legacy display comparison)
         │
         ├─ clear C8:G37 (batch)
         ├─ build matrix 30×5 (C:G) ordered by posicion 1..30 (empty strings for missing)
         ├─ setValues(C8:G37, matrix); re-assert B8:B37 = 1..30; SpreadsheetApp.flush()
         └─ toast "↻ Sincronizado: dd/MM/yyyy — M lotes" or "— sin registros para dd/MM/yyyy, listo para cargar"
```

### Component Boundaries

```
lotes-form (Sheets UI)  ── onOpen() ──→ Menu Lotes (Guardar → guardarLotes, Resincronizar → rehidratarPorFecha_)
        │                     │
        │ lotesOnEdit(e)      └─ setupLotes() [one-time, owner auth]
        │  ├─ F4 path ─→ guardarLotes() ─┐
        │  └─ D4 path ─→ rehidratarPorFecha_()
        │
   ┌────┴─────────────────────────────┐
   │           Ingest.gs              │  B8:G37 snapshot (getDisplayValues), D4 passthrough, F4 guard helpers
   └──────────────┬───────────────────┘
                  │
   ┌──────────────┴───────────────────┐
   │          Persistence.gs          │  lotesBuildDbState_, lotesFindRow_, lotesBuildRowValues_, lotesUpsertDeleteBatch_
   └──────────────┬───────────────────┘
                  │
   ┌──────────────┴───────────────────┐
   │            Core.gs               │  guardarLotes(), rehidratarPorFecha_(), lotesAcquireLock_, lotesResetCheckbox_, audit helpers
   └──────────────┬───────────────────┘
                  │
   ┌──────────────┴───────────────────┐
   │           Config.gs              │  LOTES_CONFIG SSOT + helpers lotesGetSheet_, lotesGetRange_, lotesParseA1/Range, date/headers
   └──────────────┬───────────────────┘
                  │
   ┌──────────────┴───────────────────┐
   │           Errors.gs              │  lotesLogError_, lotesEditorEmail_, lotesAuditTimestamp_  →  Errors A:F
   └────────────────────────────────┘

Store: SpreadsheetApp (lotes-form, db_lots, Errors) + PropertiesService (F4 guard) + LockService (document lock)
Isolation: no import from apps-script/attendance-control|yarn-*|dyeing|coneras|material-raw|winding|yarn-inventory; built-ins only: SpreadsheetApp/LockService/Session/Utilities/PropertiesService/ScriptApp
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps-script/lotes/Config.gs` | Create | SSOT `LOTES_CONFIG = Object.freeze({ TIMEZONE:"America/La_Paz", SHEETS:{FORM:"lotes-form", DB:"db_lots", ERRORS:"Errors"}, RANGES:{D4:"D4", F4:"F4", HEADERS:"B7:G7", FORM:"B8:G37", PAYLOAD:"C8:G37", DB_HEADERS:"A1:K1", ERRORS_HEADERS:"A1:F1"}, DB_HEADERS:["id","fecha","titulo","tipo_material","codigo_lote","color","observacion","creado","actualizado","creado_por","actualizado_por"], IDX:{ID:0, FECHA:1, TITULO:2, TIPO_MATERIAL:3, CODIGO_LOTE:4, COLOR:5, OBSERVACION:6, CREADO:7, ACTUALIZADO:8, CREADO_POR:9, ACTUALIZADO_POR:10}, LIMITS:{ROWS:30, COLS:11, ERROR_COLUMNS:6}, UI:{DEBOUNCE_MS:3000, SAVE_LABEL:"☑ GUARDAR", DB_HEADER_COLOR:"#e8f0fe", ERRORS_HEADER_COLOR:"#fce8e6", HEADER_PROTECTION:"Lotes frozen header — do not reorder"}, ERRORS:{EMPTY_DATE:"empty_date", LOCK_TIMEOUT:"lock_timeout", MISSING_SHEET:"missing_sheet", HEADER_MISMATCH:"header_mismatch"}})` + helpers `lotesGetSheet_`, `lotesGetFormSheet_`, `lotesGetDbSheet_`, `lotesParseA1_`, `lotesParseRange_`, `lotesGetRange_`, `lotesDateKey_`, `lotesFechaDisplay_`, `lotesHeadersMatch_`, `lotesEnsureSchema`, `lotesEnsureTableSheet_`, `lotesConfigureForm_` |
| `apps-script/lotes/Core.gs` | Create | Public `guardarLotes()` (empty-D4 guard, lock acquire, Ingest snapshot, Persistence upsert/delete batch, flush, toast, reset F4) and `rehidratarPorFecha_()` (D4 passthrough, single-scan map, clear+set C8:G37, re-assert B8:B37), plus `lotesAcquireLock_(lock)`, `lotesResetCheckbox_(ss)` (guarded), audit `lotesAuditTimestamp_`, `lotesEditorEmail_` wrappers; `dyeing/Category` parity |
| `apps-script/lotes/Persistence.gs` | Create | `lotesBuildDbState_(dbSheet)` (single `getValues` → `byId`/`byRow`), `lotesFindRow_(state, id)`, `lotesBuildRowValues_(snapshotRow, state, posicion, fechaDisplay, fechaKey, now, editor)`, `lotesUpsertDeleteBatch_(ss, snapshot, state)` handling update-in-place preserving `creado`/`creado_por`, append, and bottom-up `deleteRow` queue; number formats `B: dd/MM/yyyy`, `H:I: yyyy-MM-dd HH:mm:ss` on write |
| `apps-script/lotes/Ingest.gs` | Create | `lotesReadForm_(ss)` (single `getValues` on `B8:G37` via `getDisplayValues` passthrough; `B` ignored; returns `{ok, fechaRaw, fechaKey, fechaDisplay, rows:[{posicion, titulo, tipo_material, codigo_lote, color, observacion, rawRow}]}`), `lotesIsEmptyRow_(r)`, `lotesDispatch_(e)` routing, `lotesIsSaveCheckboxEvent_(e)` (`FALSE→TRUE` normalized), `lotesIsDateEdit_(e)` (D4 range), F4 debounce `lotesIsDebounced_`/`lotesMarkSaved_` via `PropertiesService` `lotes-last-save-ms` |
| `apps-script/lotes/Menu.gs` | Create | `onOpen()` → `SpreadsheetApp.getUi().createMenu("Lotes").addItem("Guardar","guardarLotes").addItem("Resincronizar","rehidratarPorFecha_").addToUi()` (two entries only, public names no trailing `_`), `onEdit(e)` delegating to `lotesOnEdit(e)`, `lotesOnEdit(e)` dispatch (F4 vs D4), `setupLotes()` (ensure schema + `ScriptApp.newTrigger("lotesOnEdit").forSpreadsheet(...).onEdit().create()` idempotent), `lotesResincronizar` public alias, `lotesNormalizeCheckboxValue_` |
| `apps-script/lotes/Errors.gs` | Create | `lotesEditorEmail_()` (`Session.getActiveUser()||getEffectiveUser()||unknown`), `lotesAuditTimestamp_(date)` (`Utilities.formatDate` La_Paz), `lotesLogError_(code, reason, range, optSpreadsheet)` → `Errors A:F` `timestamp, scope, range, code, reason, user` best-effort never throws; mirrors `dyeing/Errors.gs` |
| `apps-script/lotes/appsscript.json` | Create | `{"timeZone":"America/La_Paz","dependencies":{},"exceptionLogging":"STACKDRIVER","runtimeVersion":"V8","oauthScopes":["https://www.googleapis.com/auth/spreadsheets","https://www.googleapis.com/auth/script.scriptapp","https://www.googleapis.com/auth/script.container.ui","https://www.googleapis.com/auth/userinfo.email"]}` — identical to `dyeing`/`yarn-settings` |
| `apps-script/lotes/tests/lotes.test.gs` | Create | Manual GAS Logger harness (no runner) — `lotesTestHelpers_` fixture: `D4=21/09/2026` with 3/5 posiciones, idempotent re-save preserving `creado`, delete-on-clear, rehydrate existing vs missing date, empty-D4 guard (zero writes), lock exhaustion, B-column never persisted, F4 reset guard; run via editor dropdown → Logger `✅/❌` |

## Interfaces / Contracts

```javascript
// Config.gs — frozen SSOT (no literals outside)
var LOTES_CONFIG = Object.freeze({
  TIMEZONE: 'America/La_Paz',
  SHEETS: Object.freeze({ FORM: 'lotes-form', DB: 'db_lots', ERRORS: 'Errors' }),
  RANGES: Object.freeze({
    D4: 'D4', F4: 'F4', HEADERS: 'B7:G7', FORM: 'B8:G37', PAYLOAD: 'C8:G37',
    DB_HEADERS: 'A1:K1', ERRORS_HEADERS: 'A1:F1'
  }),
  DB_HEADERS: Object.freeze([
    'id','fecha','titulo','tipo_material','codigo_lote','color','observacion',
    'creado','actualizado','creado_por','actualizado_por'
  ]),
  IDX: Object.freeze({
    ID:0, FECHA:1, TITULO:2, TIPO_MATERIAL:3, CODIGO_LOTE:4, COLOR:5, OBSERVACION:6,
    CREADO:7, ACTUALIZADO:8, CREADO_POR:9, ACTUALIZADO_POR:10
  }),
  LIMITS: Object.freeze({ ROWS:30, COLS:11, ERROR_COLUMNS:6 }),
  UI: Object.freeze({
    DEBOUNCE_MS:3000, SAVE_LABEL:'\u2611 GUARDAR',
    DB_HEADER_COLOR:'#e8f0fe', ERRORS_HEADER_COLOR:'#fce8e6',
    HEADER_PROTECTION:'Lotes frozen header — do not reorder'
  }),
  ERRORS: Object.freeze({
    EMPTY_DATE:'empty_date', LOCK_TIMEOUT:'lock_timeout',
    MISSING_SHEET:'missing_sheet', HEADER_MISMATCH:'header_mismatch'
  })
});
// Helpers (private by convention trailing _, except setup entry points)
function lotesGetSheet_(ss, key) {}          // key: 'FORM'|'DB'|'ERRORS' → Sheet|null
function lotesParseA1_(a1) {}                // "D4" → {row,col}
function lotesParseRange_(a1Range) {}        // "B8:G37" → {r1,c1,r2,c2}
function lotesGetRange_(sheet, a1Range) {}   // Config-parsed getRange
function lotesDateKey_(value) {}             // Date|string → "yyyy-MM-dd" | "" (PK prefix)
function lotesFechaDisplay_(value) {}        // Date|string → "dd/MM/yyyy" | "" (B col)
function lotesHeadersMatch_(actual, expected) {}
function lotesEnsureSchema(optSpreadsheet) {}// idempotent: create db_lots+Errors + formats + protections + F4 checkbox

// Ingest.gs — form snapshot (typed passthrough, B ignored)
function lotesReadForm_(optSpreadsheet) {}
// → { ok:boolean, fechaRaw:*, fechaKey:"yyyy-MM-dd"|"", fechaDisplay:"dd/MM/yyyy"|"",
//     fechaDate:Date|null, rows:[{ posicion:1..30, titulo:string, tipo_material:string,
//     codigo_lote:string, color:string, observacion:string, rawRow:string[6] }] }
function lotesIsSaveCheckboxEvent_(e) {}     // e.range on F4 && oldValue FALSE→TRUE normalized
function lotesIsDateEdit_(e) {}              // e.range on D4 (lotes-form only)
function lotesIsDebounced_() {}              // PropertiesService elapsed < DEBOUNCE_MS
function lotesMarkSaved_() {}                // set lotes-last-save-ms

// Persistence.gs — db_lots state
function lotesBuildDbState_(dbSheet) {}
// → { byId:{[id]:{rowNum:number, data:any[]}}, byRow:{rowNum,data,id}[], sheet:Sheet, lastRow:number }
function lotesFindRow_(state, id) {}         // → entry|null
function lotesBuildRowValues_(snapshotRow, state, posicion, fechaDisplay, fechaKey, now, editor) {}
// → { values:any[11], isNew:boolean, rowNum:number, creadoPreserved:boolean }
function lotesUpsertDeleteBatch_(ss, snapshot, state) {}
// → { created:number, updated:number, deleted:number, totalN:number }

// Core.gs — public entry points (must be public: no trailing _)
function guardarLotes() {}
// → { ok:boolean, reason?:string, fechaDisplay?:string, created?:number, updated?:number, deleted?:number, n?:number }
// Side-effects: db_lots writes/deletes under lock, Errors on failure, F4 reset, toasts, flush
function rehidratarPorFecha_() {}            // → 0|M (M = matched posiciones written); clears C8:G37 + re-asserts B8:B37
function lotesAcquireLock_(lock) {}          // tryLock(5000)→sleep 1000→tryLock(5000) → boolean
function lotesResetCheckbox_(ss) {}          // set F4=FALSE guarded + flush
function lotesAuditTimestamp_(date) {}       // Utilities.formatDate La Paz "yyyy-MM-dd HH:mm:ss"
function lotesEditorEmail_() {}              // Session email || unknown

// Menu.gs — triggers & menu (public names)
function onOpen() {}                         // creates Lotes → Guardar|Resincronizar (2 items)
function onEdit(e) {}                        // delegates to lotesOnEdit
function lotesOnEdit(e) {}                   // dispatch: F4→guardarLotes (debounced+mark) | D4→rehidratarPorFecha_
function setupLotes() {}                     // one-time: ensure schema + installable trigger + toast
function rehidratarPorFecha() {}             // public alias for menu (no underscore) → rehidratarPorFecha_()
function lotesNormalizeCheckboxValue_(v) {}   // TRUE/FALSE/VERDADERO/FALSO normalization

// Errors.gs
function lotesLogError_(code, reason, range, optSpreadsheet) {} // → boolean (never throws)

// db_lots row A:K contract (physical 11 cols, all STRING except audit DATETIME strings)
// [0 id "2026-09-21-1", 1 fecha "21/09/2026", 2 titulo "2/24", 3 tipo_material "HB",
//  4 codigo_lote "L-001", 5 color "MOSTASA", 6 observacion "",
//  7 creado "2026-09-22 08:00:00", 8 actualizado "2026-09-22 10:15:00",
//  9 creado_por "a@factory.bo", 10 actualizado_por "b@factory.bo"]
// PK uniqueness: id = fechaKey-posicion ; posicion 1 maps B8, 30 maps B37
// lotes-form payload write contract: only C8:G37 (posicion-ordered matrix 30×5) + B8:B37 re-assert 1..30
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (GAS Logger harness) | PK derivation `lotesDateKey_`/`lotesFechaDisplay_` for `Date` vs blank vs pasted string; Config helpers `lotesParseA1_/Range_`, `lotesHeadersMatch_`; `lotesReadForm_` truncation of `titulo` empty/whitespace; `lotesNormalizeCheckboxValue_` TRUE/FALSE/VERDADERO/FALSO/empty-oldValue; `lotesIsSaveCheckboxEvent_` FALSE→TRUE only | `apps-script/lotes/tests/lotes.test.gs` manual VM — construct fake `getValues`/`getDisplayValues` arrays, assert helpers return expected keys/displays; run via Apps Script editor dropdown → Logger `✅/❌`. No npm runner (per `openspec/config.yaml` testing.runner=none). |
| Integration (on COPY of `19lBJHHKsusI6Eqkni-zh8us6ePoEHscEgrIPrFK-zhE`, gid `1098679039`) | Empty `D4` guard at `guardarLotes` (zero writes, toast, `F4=FALSE`, Errors row); valid `D4=21/09/2026` save creates 3 rows `2026-09-21-1/3/5` with `fecha=21/09/2026` and `B` `dd/MM/yyyy` format; re-save same `fecha` updates `tipo_material`/`codigo_lote` preserving `creado`/refreshing `actualizado`; clearing `C9` (posicion 2) deletes only `id=2026-09-21-2`; all-empty `C8:C37` deletes all `fecha` rows and toast `0 lotes`; rehydration `D4=20/09/2026` populates `C8/C12` by posicion and leaves others empty with `B=1..30`; missing `fecha` clears `C8:G37`; `F4` reset does not re-trigger; lock exhaustion shows `Ocupado...` | Manual on COPY: run `setupLotes()` once (owner auth), reload sheet, exercise checkbox, menu `Guardar`, `D4` edit, and `Resincronizar`; inspect `db_lots` rows and `Errors` sheet; verify `Apps Script Executions` tab has no `Exceeded maximum execution time`; confirm `B8:B37` never changes on rehydrate except re-assert |
| E2E (Sheet COPY, never prod) | End-to-end flow: fill `D4=21/09/2026`, 5 rows `B8:G37`, `F4=TRUE` → `✅ Guardado: 21/09/2026 — 5 lotes` → change `D4` to `20/09/2026` with prior data → form shows `20/09` rows → change back → original 5 rows restored exactly (posicion fidelity); concurrent second user save while first holds lock → second gets `Ocupado, reintente con Resincronizar` and zero partial writes | Playwright-cli evidence on COPY (like `docs/lotes/PRD.md` §2): verify `C8:G37` cell values after each navigation via `input#t-name-box`+`div#t-formula-bar-input` (canvas not scraped), and `db_lots` row counts via Sheets API `spreadsheets.values.get`; no `items` catalog mutation |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

This design executes entirely within the Google Apps Script sandbox (`SpreadsheetApp`/`LockService`/`Session`/`Utilities`/`PropertiesService`/`ScriptApp`). It does not introduce HTTP routes, shell commands (`setTimeout`/`fetch`/`UrlFetchApp` not used), subprocess spawning, VCS or PR automation, executable file type handling, or cross-process integration. The only "routing" is in-sheet `lotesOnEdit` dispatch by A1 range (`D4` vs `F4`) and menu dispatch by function name — both are synchronous GAS trigger dispatch, not network/OS routing, and are guarded by `FALSE→TRUE` normalization and `PropertiesService` debounce without external input. Accordingly no threat-matrix rows apply; applicability-driven matrix from `references/threat-matrix.md` would mark all rows N/A (file not present in repo — verified via `Test-Path`).

## Migration / Rollout

No data migration required. `setupLotes()` is idempotent: if `db_lots` is missing it creates the sheet, writes frozen `A:K` header row, sets `B` number format `dd/MM/yyyy` and `H:I` `yyyy-MM-dd HH:mm:ss`, freezes row 1, auto-resizes, and applies header protection warning-only (`Lotes frozen header — do not reorder`). If `db_lots` exists with correct headers the call is a no-op (headers compared via `lotesHeadersMatch_`). Existing `lotes-form` layout (`B8:G37`) is untouched; `F4` is ensured as checkbox `requireCheckbox()` defaulting to `FALSE` with label `J4`/`H4` equivalent preserved. Rollout steps per proposal Rollback Plan: (1) verify only on COPY of `19lBJHHKsusI6Eqkni-zh8us6ePoEHscEgrIPrFK-zhE` (never prod `1iw9bduLeGXQMbjmMV1qrMqE2WoPWCBz3` nor `1GrZ...`), (2) paste `apps-script/lotes/` files + `appsscript.json` into the bound project, (3) run `setupLotes()` once and authorize (`Advanced → Go to … → Allow`), (4) reload sheet to render `Lotes` menu, (5) exercise `guardarLotes`/`rehidratarPorFecha_` and confirm `Executions` logs. Rollback: delete installable trigger `lotesOnEdit`, revert/delete `apps-script/lotes/` deployment, reload sheet (menu disappears, `F4` remains plain `FALSE` checkbox), keep `db_lots` for audit or restore version-history snapshot — `creado`/`actualizado` writes are idempotent and isolated, no cross-module data to migrate.

## Open Questions

- [ ] None blocking — PRD v0.1.0 and spec freeze all ranges/headers; any future `items` catalog (`A=color, B=titulo, C=tipo-material`) validation would be a separate change with its own spec, not part of lotes v1.
