# Coneras Dashboard

## Requirements

### Requirement: Controls and period semantics (FR-011, FR-013)

The dashboard MUST provide Periodo (`Fecha`, `Semana`, `Mes`), Turno, Maquina, Supervisor, and conditional Fecha. `Todos` MUST omit its predicate. Fecha MUST be required only for `Fecha`; Semana MUST include the last 7 days, and Mes the current calendar month. Semana and Mes MUST ignore Fecha, using `America/La_Paz` dates.

#### Scenario: Apply a selected period (EC-09, EC-10, EC-11, EC-14)

- GIVEN dashboard controls are changed
- WHEN formulas recalculate
- THEN a missing Fecha-period date MUST yield an empty result
- AND Semana/Mes MUST ignore Fecha while Todos adds no filter

### Requirement: Aggregation and read-only behavior (FR-012, FR-016)

The dashboard MUST use native `SUMPRODUCT` formulas directly on `db_coneras!A:P` (with English `IF`/`TODAY`/`DATE`/`EOMONTH`, no `QUERY`/`SUBSTITUTE`/`upper`) to compute per-title and daily totals under the active filters. It MUST filter automatically with formulas and MUST NOT provide a dashboard-to-database write path.

#### Scenario: Filter production totals

- GIVEN matching database records and active controls
- WHEN formulas recalculate (`F7:F16` per-title `SUMPRODUCT`, `H/I` daily, pivots `K/S/V`)
- THEN they MUST return grouped title totals from `db_coneras!L2:L` with `F2:F=E7` and date/criteria filters (`>0` predicate for `Todos`)
- AND blank titles MUST remain representable as `(sin título)`

### Requirement: Charts and meta real (FR-014, FR-015, FR-017)

The primary `Peso Neto por Titulo` chart MUST always show the `E7` result. The daily-evolution chart MUST show only for Semana or Mes and MUST be hidden for Fecha. `conera!E4` SHOULD remain the native formula deriving manual meta from editable `dashboard!B7`; an absent or nonnumeric factor MUST not block saves.

#### Scenario: Change chart period (EC-12)

- GIVEN a dashboard period changes from Semana or Mes to Fecha
- WHEN formulas and charts refresh
- THEN the primary chart MUST remain visible and the secondary chart MUST hide
- AND invalid efficiency MUST leave Meta Real blank without affecting recording
