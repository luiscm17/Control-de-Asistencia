# Material Raw Persistence Specification

## Purpose

Persist/recover `Control Camiones!B7:H37` by native `fecha` in `db_materialrow` and decouple `Registro Diario!B10:B40` via `SUMAR.SI`; keep `H=SI(F="";0;…)` and `A6:H6` untouched.

## Requirements

### Requirement: Explicit Save Trigger

System MUST save only when installable `onEdit` observes `F4 FALSE→TRUE` on `Control Camiones`. Simple trigger MUST NOT write. After every attempt system MUST reset `F4=FALSE` and toast 8s.

#### Scenario: Checkbox save success
- GIVEN `F4=FALSE` and `D4` native date
- WHEN editor sets `F4=TRUE`
- THEN trigger persists eligible rows and resets `F4=FALSE` with toast 8s

#### Scenario: Reset on failure
- GIVEN `F4=TRUE` but `D4` empty or lock fails
- WHEN save aborts
- THEN no rows mutated, `F4=FALSE` still, failure toast 8s

### Requirement: Validated Batch Upsert

System MUST batch-read `D4` via `getValue()` + `B7:H37`, MUST filter `F<>""` only, MUST pass `fecha` as native `Date` without `Utilities.formatDate`. `db_materialrow A:J` `fecha,dia,n_camion,tipo_material,n_partida,n_bulto,tipo_fardo,cantidad,total_kilos,timestamp` MUST be frozen header; drift MUST fail-closed with `Errors` + toast. PK `fecha` MUST delete+append idempotently. Every write MUST use `LockService.getDocumentLock()` 5s+1 retry; final failure MUST NOT write, MUST toast `⏳ ocupado` 8s. `J` MUST be `America/La_Paz` `yyyy-MM-dd HH:mm:ss`; `A` MUST never use timezone.

#### Scenario: Filtered native save
- GIVEN `D4=19/09/2026` native, rows with `F<>""`
- WHEN `F4` save obtains lock
- THEN only those rows in `db_materialrow` with `A=D4` exact

#### Scenario: Re-save replaces
- GIVEN `db_materialrow` has rows for `D4`
- WHEN re-save same `fecha`
- THEN old rows deleted, new filtered rows appended, no dupes

#### Scenario: Empty tipo_fardo skipped
- GIVEN row with `F=""` and `H=0`
- WHEN saved
- THEN row omitted

#### Scenario: Lock contention
- GIVEN lock unavailable after retry
- WHEN save attempted
- THEN no write, toast `⏳ ocupado` 8s + `Errors`

#### Scenario: Header drift blocks
- GIVEN `A1:J1` != frozen header
- WHEN save/rehydrate attempted
- THEN abort with toast 8s + `Errors`

### Requirement: Rehydration by Fecha

System MUST rehydrate `B7:H37` on `D4` edit (native `Date`) or `Materia Prima → Resincronizar`, filtering `db_materialrow A=D4`. If matches, MUST write `B7:G37` from DB preserving `H7:H37` formulas (via `F`/`G`); if none, MUST clear `B7:G37` leaving `H` intact. MUST use lock 5s+1 retry and MUST NOT trigger save.

#### Scenario: Rehydrate hit
- GIVEN rows exist for `D4`
- WHEN `D4` changes to that date
- THEN `B7:G37` populated from matches in order

#### Scenario: Rehydrate miss clears
- GIVEN no rows for `D4`
- WHEN `D4` edit or `Resincronizar`
- THEN `B7:G37` cleared, `H` shows `0`

#### Scenario: Resincronizar mirrors D4
- GIVEN `D4` unchanged
- WHEN `Resincronizar` invoked
- THEN same filter/clear-or-fill

### Requirement: Registro Diario Aggregation

`Registro Diario!B10:B40` MUST be `=SI.ERROR(SUMAR.SI(db_materialrow!$A$2:$A;fecha;db_materialrow!$I$2:$I);0)` where `fecha` is `FECHA(2026;9;$A10)` or `$A10` if native. MUST sum `I total_kilos` natively, never read `Control Camiones`.

#### Scenario: Daily sum
- GIVEN two rows for `19/09/2026` `I=400,200`
- WHEN `B10` for that date recalculates
- THEN `B10=600`

#### Scenario: No data zero
- GIVEN no rows for day
- WHEN `B10` evaluates
- THEN `B10=0` via `SI.ERROR`

### Requirement: Timezone Isolation

`D4`/`A fecha` MUST never use `Utilities.formatDate`/`America/La_Paz`; that zone MUST apply only to `J timestamp`.

#### Scenario: Fecha isolation
- GIVEN `D4` native date
- WHEN persisted and aggregated
- THEN stored `A` equals `D4` value without timezone conversion

### Requirement: Menu, onOpen and Error Handling

`onOpen` MUST ensure `db_materialrow` with `A:J` header (frozen, no formulas) and create `Materia Prima → Guardar día | Resincronizar` (no `Ver db`). `Guardar día` MUST call same locked save. `D4` empty MUST abort with toast `Seleccione una fecha válida en D4.` 8s, no write.

#### Scenario: onOpen ensures DB and menu
- GIVEN open with missing `db_materialrow`
- WHEN `onOpen` runs
- THEN header created and menu shows two items only

#### Scenario: Empty D4 blocked
- GIVEN `D4` empty and `F4→TRUE`
- WHEN trigger fires
- THEN no write, toast `Seleccione una fecha válida en D4.` 8s
