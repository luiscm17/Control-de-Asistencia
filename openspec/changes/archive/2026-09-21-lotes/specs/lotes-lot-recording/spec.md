# lotes-lot-recording Specification

## Purpose

Persist the reusable 30-row daily lot form `lotes-form` (`C2` title, `D4` `DATE dd/MM/yyyy`, `F4` checkbox, `B7:G7` headers, `B8:G37` editable rows) into auditable table `db_lots` (`A:K`, PK `id = yyyy-MM-dd-posicion`) with explicit save (checkbox `F4` `FALSE->TRUE` + menu `Lotes -> Guardar`), date-driven rehydration (`D4` edit or `Lotes -> Resincronizar`), `America/La_Paz` audit, and `LockService` serialization. Source `docs/lotes/PRD.md` v0.1.0 and `openspec/changes/lotes/proposal.md`. Isolated project `apps-script/lotes/` only.

## Requirements

### Requirement: Form Boundary and Config SSOT

The system MUST expose a single `LOTES_CONFIG` object owning all sheet/range/header constants and MUST restrict persistence and rehydration to the frozen boundaries: read `D4` and `F4`, read/write `B8:G37` (with `C8:G37` as the payload and `B8:B37` visual `1..30`), and read/write `db_lots` `A:K` in fixed order `id, fecha, titulo, tipo_material, codigo_lote, color, observacion, creado, actualizado, creado_por, actualizado_por`. `B8:B37` (`No`) MUST never be persisted and MUST never be overwritten by rehydration except to ensure `1..30`. No `getRange` call for these zones SHALL use a literal outside Config.

#### Scenario: Config owns all ranges
- GIVEN `LOTES_CONFIG` defines `SHEET_FORM=lotes-form`, `SHEET_DB=db_lots`, ranges `D4`, `F4`, `B7:G7`, `B8:G37`, and header order `A:K`
- WHEN any save or rehydration executes
- THEN all `getRange`/`getValues`/`setValues` calls derive from Config and no literal `D4`/`F4`/`B8:G37` appears outside Config

#### Scenario: db_lots creation with frozen headers
- GIVEN `db_lots` does not exist when `setupLotes()` runs
- WHEN setup executes
- THEN the system creates `db_lots` with row 1 exactly `id | fecha | titulo | tipo_material | codigo_lote | color | observacion | creado | actualizado | creado_por | actualizado_por` and applies `dd/MM/yyyy` number format to column `B`

### Requirement: Date Passthrough — Native D4 Without Validation

The system MUST read `lotes-form!D4` via `getValue()` direct with no Script-side validation, coercion, or transformation, preserving Sheets native `DATE` `dd/MM/yyyy` semantics. For display and DB column `B` (`fecha`) the system MUST retain `dd/MM/yyyy` formatting; for PK `id` it MUST derive `yyyy-MM-dd` via formatting of the same `Date` value. The system MUST NOT add data validation or format changes to `D4`. If `D4` is empty (blank `getValue()`) at save time, the system MUST NOT write to `db_lots`, MUST show toast `Seleccione una fecha en D4.`, and MUST still reset `F4=FALSE` without re-triggering save.

#### Scenario: Valid date passthrough
- GIVEN `D4` contains a Sheets `DATE` `21/09/2026` displayed as `21/09/2026`
- WHEN `guardarLotes()` executes
- THEN `db_lots!B` for created rows equals `21/09/2026` (`dd/MM/yyyy`) and `id` prefix equals `2026-09-21-`

#### Scenario: Empty D4 guard
- GIVEN `D4` is empty and `C8:C37` contains values
- WHEN the user triggers `F4=TRUE` or `Lotes -> Guardar`
- THEN the system shows toast `Seleccione una fecha en D4.`, performs zero `db_lots` writes/deletes, logs to `Errors` if applicable, and resets `F4=FALSE`

#### Scenario: Non-date or pasted value in D4
- GIVEN `D4` contains a pasted string that Sheets did not coerce to `DATE`
- WHEN `guardarLotes()` reads `D4`
- THEN the system treats it as empty/invalid for the guard above and performs no DB writes per the same empty-D4 path (no Script-side parsing attempted)

### Requirement: Explicit Save — Unified Checkbox and Menu

The system MUST save only via explicit invocation of public `guardarLotes()`: either `lotes-form!F4` transitioning `FALSE->TRUE` observed by installable `lotesOnEdit(e)` OR menu `Lotes -> Guardar`. Both entry points MUST invoke the identical `guardarLotes()` function. On every exit path (success, empty-D4 guard, lock failure, exception) the system MUST reset `lotes-form!F4` to `FALSE` via a guard that prevents re-triggering `lotesOnEdit` (check `e.oldValue`/`e.value` `FALSE->TRUE` only and an in-memory or `PropertiesService` flag `isResettingF4_` that causes the programmatic `F4=FALSE` edit to be ignored).

#### Scenario: Checkbox save
- GIVEN `F4=FALSE` and `D4` has a valid date
- WHEN the user checks `F4` to `TRUE` (installable trigger authorized)
- THEN `lotesOnEdit` detects `FALSE->TRUE` on `F4` and invokes `guardarLotes()` exactly once

#### Scenario: Menu save invokes same function
- GIVEN valid `D4` and rows in `B8:G37`
- WHEN the user clicks `Lotes -> Guardar`
- THEN `guardarLotes()` executes the same upsert/delete logic as the checkbox path and produces the same success toast

#### Scenario: F4 reset does not re-trigger save
- GIVEN `guardarLotes()` completes (success or failure)
- WHEN the system sets `F4=FALSE` programmatically
- THEN `lotesOnEdit` observes the guard flag and does not invoke `guardarLotes()` a second time

#### Scenario: Spurious F4 edit ignored
- GIVEN `F4=TRUE` already
- WHEN an edit sets `F4=TRUE` again (no `FALSE->TRUE` transition)
- THEN no save is triggered

### Requirement: PK Upsert/Delete and No Exclusion

The system MUST iterate `B8:G37` as 30 posiciones (row `B8` = posicion 1 through `B37` = posicion 30) and for each posicion derive `id = yyyy-MM-dd-posicion` where `yyyy-MM-dd` is the `D4` date formatted in `America/La_Paz`. If `C` (`Titulo`) trimmed is non-empty, the system MUST upsert `db_lots` by `id`: find existing row with `id` via single batch `getValues()` index then update `B:G` (`fecha` `dd/MM/yyyy`, `titulo` `C`, `tipo_material` `D`, `codigo_lote` `E`, `color` `F`, `observacion` `G`) preserving `creado`/`creado_por` and refreshing `actualizado`/`actualizado_por`; else append a new row with `creado=actualizado=nowLaPaz` and `creado_por=actualizado_por=Session.getActiveUser().getEmail() || unknown`. If `C` trimmed is empty and a row with that `id` exists, the system MUST delete that row (bottom-up iteration to avoid index shift). If `C` empty and no row exists, the system MUST skip (no write). `B` (`No`) `1..30` MUST never be persisted to `db_lots` and `No` MUST never influence `id` beyond positional index.

#### Scenario: Create new rows
- GIVEN `D4=21/09/2026` and `B8:G37` has `Titulo` non-empty only at posiciones 1, 3, 5
- WHEN `guardarLotes()` executes and `db_lots` has no rows for `2026-09-21`
- THEN exactly 3 rows are appended with `id` `2026-09-21-1`, `2026-09-21-3`, `2026-09-21-5` and `B` = `21/09/2026`

#### Scenario: Idempotent re-save preserves creado
- GIVEN `db_lots` already contains `id=2026-09-21-1` with `creado=2026-09-22 08:00:00`
- WHEN the same fecha/posicion is saved again with changed `D`/`E`/`F`
- THEN the existing row is updated in place, `creado` remains `2026-09-22 08:00:00`, `actualizado` is refreshed to current `America/La_Paz` time, and no duplicate `id` is created

#### Scenario: Delete on clear
- GIVEN `db_lots` contains `id=2026-09-21-2` from a prior save
- WHEN the user clears `C9` (posicion 2, `Titulo` empty) leaving other rows intact and saves `D4=21/09/2026`
- THEN `guardarLotes()` deletes only the row with `id=2026-09-21-2`; other `2026-09-21-*` rows are unaffected

#### Scenario: No column persisted
- GIVEN `B8:B37` contains `1..30`
- WHEN any save or rehydration inspects `db_lots`
- THEN no column in `db_lots` contains `No` values and `B8:B37` in the form was never read as a DB field

#### Scenario: All-empty save
- GIVEN `D4` valid but every `C8:C37` is empty/whitespace
- WHEN `guardarLotes()` executes
- THEN no rows are created; any pre-existing rows for that `fecha` are deleted per the delete-on-clear rule, `C8:G37` already empty, and toast reports `0 lotes`

### Requirement: Rehydration by Date — D4 onEdit and Resincronizar

The system MUST provide `rehidratarPorFecha_()` that reads `D4` (`dd/MM/yyyy` passthrough via `getValue()`), scans `db_lots` in a single `getValues()` batch, and populates `lotes-form!C8:G37` by posicion: for each posicion 1..30 where `id = yyyy-MM-dd-posicion` exists, set `C:G` from that row; posiciones without a matching row MUST be cleared (empty strings). `B8:B37` MUST remain `1..30` (re-assert after clear). The rehydration MUST be triggered by two paths only: (a) installable `lotesOnEdit(e)` detecting an edit to `D4` range, and (b) menu `Lotes -> Resincronizar`. If `D4` is empty at rehydration time, the system MUST clear `C8:G37` and leave `B8:B37=1..30` with no `db_lots` read error. If no records exist for the requested `fecha`, the system MUST clear `C8:G37` and leave `B8:B37=1..30` (clean form for a new date).

#### Scenario: Rehydrate existing date
- GIVEN `db_lots` contains `2026-09-20-1` (`Titulo=HB Lote A`) and `2026-09-20-5` (`Titulo=HB Lote E`)
- WHEN the user changes `D4` from `21/09/2026` to `20/09/2026` or clicks `Lotes -> Resincronizar` with `D4=20/09/2026`
- THEN `C8` receives `HB Lote A`, `C12` receives `HB Lote E`, all other `C8:G37` cells are empty, and `B8:B37` is `1..30`

#### Scenario: Rehydrate date with no records
- GIVEN `db_lots` has no rows with `fecha=22/09/2026`
- WHEN rehydration runs for `D4=22/09/2026`
- THEN `C8:G37` is cleared entirely and `B8:B37` remains `1..30`

#### Scenario: Rehydrate after in-place D4 edit
- GIVEN the user edits `D4` directly
- WHEN `lotesOnEdit` observes the `D4` range edit
- THEN `rehidratarPorFecha_()` executes the same scan-and-populate logic as the menu path

### Requirement: Audit — America/La_Paz and Identity

Every `db_lots` insert MUST set `creado` (H) and `actualizado` (I) to `Utilities.formatDate(new Date(), "America/La_Paz", "yyyy-MM-dd HH:mm:ss")` and `creado_por` (J) and `actualizado_por` (K) to `Session.getActiveUser().getEmail()` or `unknown` if empty. Every upsert update MUST preserve `creado`/`creado_por` and refresh `actualizado`/`actualizado_por` with the same `America/La_Paz` formatting. The system MUST NOT use browser timezone, `Session.getScriptTimeZone()` fallback beyond `America/La_Paz`, or UTC for audit timestamps.

#### Scenario: Audit on create
- GIVEN `D4=21/09/2026` posicion 1 create
- WHEN `guardarLotes()` inserts the row
- THEN `H` and `I` equal the same `America/La_Paz` `yyyy-MM-dd HH:mm:ss` instant and `J`/`K` equal the active user email or `unknown`

#### Scenario: Audit on update preserves creado
- GIVEN row `2026-09-21-1` exists with `creado=2026-09-21 09:00:00` and `creado_por=a@factory.bo`
- WHEN the same `id` is updated at `2026-09-22 10:15:00 America/La_Paz` by `b@factory.bo`
- THEN `H` remains `2026-09-21 09:00:00`, `J` remains `a@factory.bo`, `I` becomes `2026-09-22 10:15:00`, `K` becomes `b@factory.bo`

### Requirement: Concurrency — LockService

Every `guardarLotes()` DB write path MUST acquire `LockService.getDocumentLock()` with a 5-second `tryLock(5000)` and one retry (second `tryLock(5000)` after `Utilities.sleep` if needed) before any `db_lots` read/write. If the lock is obtained, the system MUST perform a single batch `getValues()` index build, then batch `setValues()`/`appendRow()`/`deleteRow()` within the lock, call `SpreadsheetApp.flush()`, and release the lock. If both attempts fail, the system MUST perform no `db_lots` writes, MUST show toast `Ocupado, reintente con Resincronizar`, MUST log to `Errors`, and MUST still reset `F4=FALSE`.

#### Scenario: Serialized concurrent saves
- GIVEN two users trigger `guardarLotes()` for the same `fecha` concurrently
- WHEN both request the document lock
- THEN one acquires `tryLock(5000)` and completes; the other retries once and either acquires on retry or shows `Ocupado, reintente con Resincronizar` with no partial writes

#### Scenario: Lock exhaustion observability
- GIVEN `tryLock(5000)` fails twice
- WHEN the save aborts
- THEN `db_lots` is unchanged, `Errors` receives a row with timestamp, context `guardarLotes lock`, and detail, and `F4=FALSE`

### Requirement: Menu, Trigger Setup, and Isolation

The system MUST provide `onOpen()` that creates menu `Lotes` with exactly two entries `Guardar` -> `guardarLotes` and `Resincronizar` -> `rehidratarPorFecha_` (public function names, no trailing underscore), and MUST provide one-time `setupLotes()` that creates `db_lots` if missing, ensures its frozen `A:K` headers, sets `B` number format `dd/MM/yyyy`, and creates an installable `lotesOnEdit` trigger via `ScriptApp.newTrigger("lotesOnEdit").forSpreadsheet(...).onEdit().create()` (re-authorization required). All runtime code MUST reside under `apps-script/lotes/` with `appsscript.json` `timeZone: America/La_Paz`, V8, and `oauthScopes` `spreadsheets, script.scriptapp, script.container.ui, userinfo.email`; it MUST NOT import or share globals with `apps-script/attendance-control`, `yarn-production`, `yarn-settings`, `dyeing`, or other modules and MUST use only built-ins `SpreadsheetApp`/`LockService`/`Session`/`Utilities` (plus `PropertiesService` for the `F4` guard and `ScriptApp` for setup).

#### Scenario: Menu entries
- GIVEN the spreadsheet is opened with `apps-script/lotes` bound
- WHEN `onOpen()` runs
- THEN the `Lotes` menu shows exactly `Guardar` and `Resincronizar` and no `Ver db_lots` or other entries

#### Scenario: Isolation
- GIVEN any file under `apps-script/lotes/`
- WHEN inspected
- THEN it contains no `import`/`require` from sibling `apps-script/*` projects and references only `SpreadsheetApp`, `LockService`, `Session`, `Utilities`, `PropertiesService`, `ScriptApp`

### Requirement: Observability — Toasts, Batch Operations, and Errors

Every successful `guardarLotes()` MUST call `SpreadsheetApp.flush()` before toast, show success toast `✅ Guardado: dd/MM/yyyy — N lotes` where `N` is the count of posiciones with `C` non-empty that were upserted (deletes not counted), and log no error. Validation (`D4` empty), lock exhaustion, and caught exceptions MUST show a failure toast, append a row to sheet `Errors` with `yyyy-MM-dd HH:mm:ss America/La_Paz`, context, detail, and editor email, and perform no partial `db_lots` writes. The system MUST use batch `getValues()`/`setValues()` for `B8:G37` and `db_lots` (no per-cell reads/writes in loops except `deleteRow` bottom-up and `appendRow` for new ids) to respect trigger quota.

#### Scenario: Success toast
- GIVEN `D4=21/09/2026` and 5 posiciones have `Titulo` non-empty
- WHEN `guardarLotes()` succeeds
- THEN the user sees `✅ Guardado: 21/09/2026 — 5 lotes`

#### Scenario: Failure logged to Errors
- GIVEN `guardarLotes()` throws during batch write
- WHEN the catch block executes
- THEN the user sees a failure toast, `Errors` receives a row with `America/La_Paz` timestamp, context `guardarLotes`, detail `exception message`, and `F4=FALSE`

#### Scenario: Batch operation
- GIVEN `B8:G37` and `db_lots` each contain up to 30 rows for the fecha
- WHEN `guardarLotes()` or `rehidratarPorFecha_()` runs
- THEN at most one `getValues()` reads `B8:G37`, one `getValues()` reads `db_lots`, and one `setValues()` writes `C8:G37` (or per-posicion updates within the lock) with no per-cell `getValue()` loop
