# Winding Shift Persistence Specification

## Purpose

Persist auditable `ctrl_embolsado` shift item snapshots and safely recover them without changing formula-owned form behavior.

## Requirements

### Requirement: Explicit Save Activation

The system MUST save only through the `Winding` menu or an installable edit trigger when `M4` changes from `FALSE` to `TRUE`. The trigger MUST reset `M4` to `FALSE` after every attempted save; simple triggers MUST NOT write the DB.

#### Scenario: Checkbox save
- GIVEN `M4` is `FALSE` and the form is valid
- WHEN an editor changes `M4` to `TRUE`
- THEN the installable trigger saves the shift
- AND resets `M4` to `FALSE`

#### Scenario: Failed checkbox save
- GIVEN `M4` is changed to `TRUE`
- WHEN validation or persistence fails
- THEN no unintended DB mutation occurs
- AND `M4` is reset to `FALSE`

### Requirement: Validated Snapshot Rows

The system MUST require non-empty `H4` and `J4` before saving and MUST trust native `H4` `dd/MM/yyyy` without script-side format validation. It MUST omit a row when `B`, `C`, or `D` is blank; eligible rows MUST persist blank `F:T` values as `0` and `E` as its displayed value snapshot.

#### Scenario: Save eligible rows
- GIVEN both shift keys and a row with `B`, `C`, and `D`
- WHEN the shift is saved
- THEN the row and its `E` value snapshot are persisted
- AND blank operator values are stored as `0`

#### Scenario: Missing key or row value
- GIVEN a required key or one of `B`, `C`, or `D` is blank
- WHEN a save is attempted
- THEN a missing key prevents all writes, while incomplete rows are omitted
- AND the applicable toast and error evidence are produced

### Requirement: Normalized Record Identity and Upsert

The system MUST materialize first-column `id` as `fecha|turno|lote`, where `fecha` is the trusted native date represented in `America/La_Paz`. It MUST trim key components, preserve their case, and reject key values containing `|` with no write. `item` MUST be persisted only as a reference. Saves MUST upsert idempotently by `id` and MUST NOT auto-delete records absent from the form.

#### Scenario: Re-save the same record
- GIVEN an existing normalized `fecha|turno|lote` record
- WHEN an eligible row with that identity is saved again
- THEN that record is updated without creating a duplicate
- AND absent historical rows remain retained

#### Scenario: Ambiguous delimiter
- GIVEN `turno` or `lote` contains `|`
- WHEN a save is attempted
- THEN the system rejects the key and performs no write
- AND records usable error evidence

### Requirement: Safe Rehydration

The system MUST make menu recovery by `fecha + turno` the primary rehydration path. Automatic recovery MAY run after a key change only when `B12:T23` is fully empty; otherwise it MUST preserve the form and instruct the editor to use the menu. Recovery MUST write or clear only `B:D` and `F:T`, restore `L4`, and MUST NEVER write or clear `E12:E23`.

#### Scenario: Menu recovery
- GIVEN persisted records exist for the selected date and shift
- WHEN the editor selects recovery from the menu
- THEN matching values refill the permitted form ranges
- AND `E12:E23` remains untouched

#### Scenario: Guarded automatic recovery
- GIVEN the form contains persisted-zone data
- WHEN the date or shift changes
- THEN automatic recovery does not overwrite the form
- AND a toast directs the editor to menu recovery

### Requirement: Concurrent Audit-Safe Persistence

The system MUST wrap every DB write in a document lock with a 5-second attempt and one retry. On final lock failure it MUST not write, MUST toast the failure, and MUST log it to `Errors`. Every persisted row MUST retain `actualizado` and `editado_por` audit values using `America/La_Paz` timestamps; `Errors` MUST record timestamp, context, detail, and editor.

#### Scenario: Lock contention
- GIVEN the document lock remains unavailable after one retry
- WHEN a save is attempted
- THEN no DB row is changed
- AND the editor receives a retry toast and `Errors` entry

#### Scenario: Audited update
- GIVEN a valid save obtains the lock
- WHEN an item record is upserted
- THEN its last-update audit fields are recorded in `America/La_Paz`
- AND the save result is communicated by toast
