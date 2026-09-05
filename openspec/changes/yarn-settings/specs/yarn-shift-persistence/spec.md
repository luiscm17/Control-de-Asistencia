# Yarn Shift Persistence Specification

## Purpose

Persist one explicitly saved `Settings` shift as auditable assignment and weighing snapshots without changing attendance modules.

## Requirements

### Requirement: Settings Date, Standards, and Persistence Boundary

`Settings!F4` MUST remain a Sheets-validated `DATE` displayed as `dd/MM/yyyy`; `J4` SHALL remain derived, and changing the date MUST NOT clear input grids. `guardarTurno()` MUST reject a missing or invalid date, an unknown populated title from `B10:C19`, or a form with neither a complete assignment nor numeric gross weight. It MUST persist only `C33:E42` assignments and `E50:H157` weighings, never calculator `E10:H24` or summary `L33:P42`.

#### Scenario: Valid dated form
- GIVEN `F4` contains a valid date and a title exists in Standards
- WHEN the user saves the shift
- THEN persistence uses that date and the allowed input ranges only

#### Scenario: Invalid form metadata
- GIVEN `F4` is invalid or a populated title is unknown
- WHEN the user saves
- THEN no DB changes occur and the failure is reported

### Requirement: Explicit Save Entry Points and Serialization

The system MUST expose `Yarn → Guardar Turno` (desktop) AND checkbox `Settings!K2` (or `K2:L2` merged) labeled `☑ GUARDAR TURNO` via `dataValidation` checkbox (desktop+móvil); both MUST invoke public `guardarTurno()`, and the checkbox handler MUST auto-clear `K2` to `FALSE` after ~1s on success or failure to make it reusable. No drawing button. A save MUST acquire the document lock for 5 seconds and retry once before failing; it MUST use `America/La_Paz` for audit timestamps.

#### Scenario: Contended save
- GIVEN another save owns the document lock
- WHEN the first 5-second acquisition fails
- THEN the system retries once and performs no persistence if it remains unavailable

### Requirement: Assignment Snapshot Upsert and Audit

The system MUST upsert at most 10 `DB_Asignaciones` rows per date by `(fecha, retorcedora)`. Each row SHALL snapshot assignment values, derived production values, and `rango_origen`; updates MUST preserve `creado` and refresh `actualizado` and `editado_por` (or `unknown`).

#### Scenario: Re-save an assignment
- GIVEN an assignment already exists for the saved date and retorcedora
- WHEN its form values are saved again
- THEN its existing row is updated without a duplicate and retains `creado`

### Requirement: Variable Weighing Snapshot and Net Weight

The system MUST upsert `DB_Descargas` by `(fecha, retorcedora, descarga_nro, lado)` for 0–80 weighings per day. It MUST recompute and store `peso_neto = bruto - (usos * peso_cono + peso_tacho)` with null inputs as zero and two-decimal rounding; `Settings!I50` remains a UX formula and is not authoritative. Each weighing MUST retain `creado` on update and refresh audit and source range fields.

#### Scenario: Save a weighing
- GIVEN a weighing has numeric gross weight and optional tare inputs
- WHEN the shift is saved
- THEN one PK row stores the Script-computed net weight and current audit fields

#### Scenario: Clear a previously saved weighing
- GIVEN a DB weighing exists for a visible weighing PK
- WHEN its gross weight is cleared and the shift is saved
- THEN only that DB weighing row is deleted

#### Scenario: No weighings for a machine
- GIVEN all its gross-weight cells are empty and no matching DB rows exist
- WHEN the shift is saved
- THEN no weighing rows are created for that machine

### Requirement: Save Feedback and Failure Evidence

The system MUST show a success toast containing date, assignment count, weighing count, and net kilograms. Validation, lock-exhaustion, and execution failures MUST create `Errors` evidence and show a failure toast; failures MUST NOT leave partial DB writes.

#### Scenario: Save failure
- GIVEN validation, locking, or execution fails
- WHEN `guardarTurno()` terminates
- THEN the user receives a failure toast and `Errors` contains the failure evidence
