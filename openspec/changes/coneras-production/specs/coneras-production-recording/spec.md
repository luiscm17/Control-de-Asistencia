# Coneras Recording

## Requirements

### Requirement: Form selection and hydration (FR-001, FR-002)

The system MUST use `conera`; Fecha (`E5`), Turno (`G4`), Maquina (`C5`), and Supervisor (`G5`) MUST be valid. On selector changes, it MUST match `db_coneras` by normalized date, shift, then machine; populate or clear `B8:G22` and set the saved supervisor. It MUST retain `A8:A22` and MUST NOT write `H8:H22`, `H23`, or `E4`.

#### Scenario: Hydrate a selection (EC-07)

- GIVEN valid selectors, including a datetime normalized to its date
- WHEN hydration runs
- THEN matching records MUST populate `B8:G22` and `G5`, or no match MUST clear `B8:G22`
- AND `H`, `H23`, and `E4` MUST remain unchanged

### Requirement: Explicit validated batch persistence (FR-003, FR-004, FR-005, FR-006, FR-007, FR-009)

The system MUST save only from `Coneras → Guardar Turno` or installable `I8` `FALSE`→`TRUE`, then reset `I8`. A batch MUST upsert 0–15 numeric-bruto rows by `(fecha, turno, maquina, descarga_nro)`, capture numeric `H` to `peso_neto` (two decimals), and never persist `H23`. It MUST preserve `creado`, refresh `actualizado`/`editado_por`, and denormalize supervisor outside the PK in `America/La_Paz`. Each batch MUST use one document lock (5 seconds, one retry); failure MUST log `Errors` and direct the user to re-sync.

#### Scenario: Save rows or handle failure (EC-01, EC-02, EC-03, EC-05, EC-08, EC-13, EC-14)

- GIVEN valid or invalid selectors, rows, and lock availability
- WHEN save is requested
- THEN valid rows MUST upsert without duplicates while invalid metadata writes nothing and invalid rows are skipped
- AND lock exhaustion MUST log after one retry; saved weights MUST never be negative

### Requirement: Deletion, audit, and menu (FR-008, FR-010)

The system MUST provide `Coneras` menu actions for save, viewing `db_coneras`, and re-synchronization. When an existing record's bruto is cleared, it MUST show one native alert listing affected unload numbers; Continue MUST delete only those PKs, while Cancel MUST preserve them and audit history.

#### Scenario: Confirm or cancel deletions (EC-04)

- GIVEN one or more existing unloads have blank bruto
- WHEN the user saves and responds to the deletion alert
- THEN Continue MUST delete the listed records
- AND Cancel MUST leave every listed record unchanged
