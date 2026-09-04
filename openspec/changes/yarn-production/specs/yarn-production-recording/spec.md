# Yarn Production Recording Specification

## Purpose

Persist reusable `produccion` form entries as auditable production records per date and fixed shift.

## Requirements

### Requirement: Production Record Schema and Form Boundary

The system MUST maintain the `produccion` table in fixed A:Q header order defined by PRD §6. `id` MUST identify a record by `(fecha, turno)`. The form MUST use `G2` as its date and `C6:L8` as its shift input area. `C6:C8` (`TURNO` = `DIA`/`TARDE`/`NOCHE`) are fixed layout values, not editable nor cleared on `G2` navigation, but their values MUST be persisted as the `turno` key. `C9:L9` and `C10:L10` total rows MUST NOT create records.

#### Scenario: Persist fixed shift rows

- GIVEN valid `G2`, fixed `C6:C8` shift labels, and populated process values
- WHEN the user saves the form
- THEN each populated fixed shift has at most one record for its date using its fixed label as `turno`
- AND neither total row is persisted

#### Scenario: Preserve totals as calculations

- GIVEN the form contains native Sheets `SUM` formulas in `C9:L9` and `C10`
- WHEN the user saves or loads a date
- THEN total rows remain native formulas and are neither cleared nor persisted

### Requirement: Date-Controlled Form Loading

`G2` MUST use native Sheets date validation and the `d/M/yyyy` display format. When `G2` is edited to a valid date, the system MUST load matching process values into `D6:L8` only. On a `G2` change to a valid date without records, ONLY `D6:L8` numeric process values MUST be cleared; `C6:C8` MUST remain, and `C9:L9` and `C10` total rows with native Sheets `SUM` formulas MUST never be cleared nor persisted. A blank or invalid `G2` MUST NOT load or save records.

#### Scenario: Load a previously saved date

- GIVEN records exist for the date selected in `G2`
- WHEN `G2` changes to that valid date
- THEN the corresponding process values populate `D6:L8` only
- AND fixed shift labels and total formulas remain unchanged

#### Scenario: Navigate to a new or invalid date

- GIVEN `G2` changes to a valid date without records
- WHEN the edit handler runs
- THEN only `D6:L8` is cleared
- AND `C6:C8` and the native total formulas in `C9:L9` and `C10` remain unchanged and excluded from records
- AND a blank or invalid date performs no load

### Requirement: Single Save Upsert and Audit

One `Guardar` action MUST inspect all fixed shift rows and upsert every row containing at least one process value by `(fecha, turno)`. Empty process cells MUST be stored as zero. An inserted record MUST set `registrado_por` and `creado`; every upsert MUST set `editado_por` and `actualizado`. `total_producto_terminado` MUST equal `embolsado + ovillado + madejitas`.

#### Scenario: Save multiple shifts

- GIVEN valid `G2` and populated DIA and NOCHE rows
- WHEN the user invokes `Guardar`
- THEN both rows are inserted or updated independently
- AND their totals and audit fields are recorded

#### Scenario: Correct an existing shift

- GIVEN a record already exists for `(fecha, TARDE)`
- WHEN the TARDE row is changed and saved
- THEN the existing record is updated without a duplicate
- AND `editado_por` and `actualizado` change

### Requirement: Validation, Timezone, and Concurrent Saves

Process input ranges MUST use native Sheets numeric validation permitting values greater than or equal to zero. Save operations MUST use `LockService.getDocumentLock()` with a five-second timeout and one retry. Dates, identifiers, and audit timestamps MUST be normalized in `America/La_Paz`. The implementation MUST reside only in `apps-script/yarn-production/` as `*.gs` files.

#### Scenario: Reject invalid process data

- GIVEN a process cell contains a negative or nonnumeric value
- WHEN the user attempts to enter it in the Sheet
- THEN native Sheets validation rejects the value

#### Scenario: Serialize concurrent saves

- GIVEN two users save records concurrently
- WHEN each save requests the document lock
- THEN writes are serialized or fail after the specified retry
- AND no duplicate date-shift record is created
