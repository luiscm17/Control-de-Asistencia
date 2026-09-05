# Delta for Yarn Production Recording

## ADDED Requirements

### Requirement: Native Mobile Save Control

The system MUST provide a native Sheets checkbox at `produccion!M4`, a `Guardar` label at `N4`, and a row touch target of at least 24 px. An installable `onEdit` trigger SHALL process only a `FALSE → TRUE` checkbox transition, debounce re-entry, and invoke `guardarProduccion`. It MUST reset `M4` to `FALSE` only after success; validation or lock failure MUST retain `TRUE` and show an error. This control MUST NOT add sheets, DB columns, formulas, `HtmlService`, or a schema migration.

#### Scenario: Save from Android

- GIVEN valid `G2` and populated shift rows on Android
- WHEN the user checks `M4`
- THEN the installable trigger invokes `guardarProduccion`
- AND success confirms the save and resets `M4` to `FALSE`

#### Scenario: Retain failed save state

- GIVEN `G2` is invalid or the document lock cannot be acquired
- WHEN the user checks `M4`
- THEN no unintended write occurs and an error is shown
- AND `M4` remains `TRUE` for an explicit retry

## MODIFIED Requirements

### Requirement: Date-Controlled Form Loading

`G2` MUST use native Sheets date validation and the `d/M/yyyy` display format. Only an edit to `G2` MUST load matching process values into `D6:L8` or clear those values for a valid date without records. `C6:C8` MUST remain, and `C9:L9` and `C10` total rows with native Sheets `SUM` formulas MUST never be cleared nor persisted. A blank or invalid `G2` MUST NOT load or save records.

(Previously: G2 navigation defined the load/clear behavior without explicitly excluding other edits.)

#### Scenario: Load a previously saved date

- GIVEN records exist for the date selected in `G2`
- WHEN `G2` changes to that valid date
- THEN corresponding values populate `D6:L8` only
- AND fixed labels and total formulas remain unchanged

#### Scenario: Navigate to a new or invalid date

- GIVEN `G2` changes to a valid date without records
- WHEN its edit handler runs
- THEN only `D6:L8` is cleared
- AND `C6:C8` and the native total formulas in `C9:L9` and `C10` remain unchanged and excluded from records
- AND a blank or invalid date performs no load

### Requirement: Single Save Upsert and Audit

One `Guardar` action, whether invoked by the native checkbox, desktop drawing, or `Produccion > Guardar` menu, MUST use the same `guardarProduccion` path. It MUST inspect all fixed shift rows and independently upsert every row containing at least one process value by `(fecha, turno)`; empty rows MUST be skipped and empty process cells stored as zero. An inserted record MUST set `registrado_por` and `creado`; every upsert MUST set `editado_por` and `actualizado`. `total_producto_terminado` MUST equal `embolsado + ovillado + madejitas`.

(Previously: a single Guardar action did not define mobile and desktop entry-point equivalence.)

#### Scenario: Save multiple shifts

- GIVEN valid `G2` and populated DIA and NOCHE rows
- WHEN the user saves through any entry point
- THEN both rows are inserted or updated independently
- AND their totals and audit fields are recorded

#### Scenario: Skip an empty shift

- GIVEN valid `G2` and an empty TARDE process row
- WHEN the user saves through any entry point
- THEN TARDE creates no record

#### Scenario: Correct an existing shift

- GIVEN a record already exists for `(fecha, TARDE)`
- WHEN the TARDE row is changed and saved
- THEN the existing record is updated without a duplicate
- AND its audit fields and total are updated

### Requirement: Validation, Timezone, and Concurrent Saves

Process input ranges MUST use native Sheets numeric validation permitting values greater than or equal to zero. Every save entry point MUST apply the same validation and use `LockService.getDocumentLock()` with a five-second timeout and one retry. Dates, identifiers, and audit timestamps MUST be normalized in `America/La_Paz`. The implementation MUST reside only in `apps-script/yarn-production/` as `*.gs` files.

(Previously: validation and locking were specified for saves without requiring all entry points to share them.)

#### Scenario: Reject invalid process data

- GIVEN a process cell contains a negative or nonnumeric value
- WHEN the user attempts to enter it in the Sheet
- THEN native Sheets validation rejects the value

#### Scenario: Preserve checkbox validation failure

- GIVEN the checkbox save cannot satisfy a reused validation
- WHEN the user checks `M4`
- THEN validation prevents the write
- AND a checkbox-initiated failure remains checked

#### Scenario: Serialize concurrent saves

- GIVEN two users save records concurrently
- WHEN each save requests the document lock
- THEN writes are serialized or fail after the specified retry
- AND no duplicate date-shift record is created
