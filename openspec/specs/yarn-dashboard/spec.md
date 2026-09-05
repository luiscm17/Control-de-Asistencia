# Yarn Dashboard Specification

## Purpose

Read-only `dashboard` for `datos_produccion!A:Q` totals/trends on desktop and Android, zero Apps Script on view. Complement to `yarn-production-recording`; isolated — no writes or schema changes.

## Requirements

### Requirement: Dashboard Worksheet and Isolation

The system SHALL provide worksheet `dashboard`. It SHALL be read-only with no write path to `datos_produccion` and SHALL NOT alter `yarn-production-recording`, `produccion!G2/C6:L8/C9:L9/J10`, or `datos_produccion!A:Q`.

#### Scenario: Read-only dashboard exists
- GIVEN `datos_produccion` exists
- WHEN user opens `dashboard`
- THEN sheet shows derived totals with no source-data write path

#### Scenario: Recording unaffected
- GIVEN `dashboard` setup done
- WHEN user saves via `M4 Guardar`
- THEN `datos_produccion` upsert and `G2/C6:L8` match `yarn-production-recording`

### Requirement: Summary Cards

The system SHALL show ten cards: nine sections `D:L` (`finisor..madejitas`) plus grand total `M`. Each SHALL be filtered `SUM` of its column formatted `#,##0.00`.

#### Scenario: Ten formatted cards
- GIVEN three rows with known `D:M`
- WHEN `dashboard` renders unfiltered
- THEN ten cards show correct sums as `#,##0.00`

#### Scenario: Cards follow filters
- GIVEN `B1=01/09/2026` and `E1=DIA`
- WHEN sheet recalculates
- THEN cards reflect only matching rows

### Requirement: Filters B1:F1

The system SHALL provide `B1:C1` date range `d/M/yyyy` (`B1<=fecha<=C1` on `B`), `E1` `Todos/DIA/TARDE/NOCHE` filtering `turno` (`C`) when not `Todos`, and `F1` `Todas/finisor..madejitas` highlighting only (SHALL NOT filter rows). Empty `B1`/`C1`/`E1` SHALL be unbounded; no filters SHALL show full history to latest `fecha`.

#### Scenario: Date range
- GIVEN `B1=05/09/2026`, `C1=06/09/2026`
- WHEN recalculating
- THEN only rows in inclusive range contribute

#### Scenario: Empty shows full history
- GIVEN `B1`/`C1` empty, `E1=Todos`
- WHEN recalculating
- THEN all rows to latest `fecha` contribute

#### Scenario: Shift filters, highlight isolated
- GIVEN `E1=TARDE`, `F1=finisor`
- WHEN recalculating
- THEN rows filter to `TARDE` and `finisor` highlights, others stay visible

### Requirement: Auxiliary Range A10:C200

The system SHALL keep `A10:C200` via `QUERY` grouped by `fecha` ascending as `fecha|daily_total|cumulative` where `cumulative` is running sum. It SHALL respect `B1:C1`/`E1` (not `F1`), cap at 200 rows, and use `d/M/yyyy` in `America/La_Paz`.

#### Scenario: Daily and cumulative
- GIVEN multiple shifts over three dates
- WHEN `A10:C200` evaluates
- THEN each `fecha` appears once with daily `SUM(M)` and cumulative

#### Scenario: Auxiliary respects filters
- GIVEN `B1=01/09/2026`, `E1=NOCHE`
- WHEN recalculating
- THEN only matching rows aggregate and cumulative restarts at first filtered date

### Requirement: Native Charts G1-G3

The system SHALL provide three native `EmbeddedChart`s anchored to `dashboard` bound to auxiliary/filtered ranges: `G1` bar by Section (X=9 sections, Y=section totals), `G2` line Cumulative (X=`fecha`, Y1=daily, Y2=cumulative), `G3` stacked bar by Shift (X=`fecha`, series `DIA/TARDE/NOCHE`). They SHALL auto-update on `datos_produccion` changes without Apps Script.

#### Scenario: Charts render
- GIVEN filtered data with distinct shifts/sections
- WHEN dashboard loads
- THEN `G1` has 9 bars, `G2` two lines, `G3` stacked bars per date

#### Scenario: Auto-update on append
- GIVEN new row appended to `datos_produccion`
- WHEN sheet recalculates
- THEN `G1`/`G2`/`G3` reflect new totals without refresh or script

### Requirement: Zero-Script Runtime, Interaction, and Compatibility

Aggregations SHALL use native `SUM`/`FILTER`/`QUERY` only; dashboard SHALL NOT invoke Apps Script on view/filter. Viewing SHALL need only switching to `dashboard`; filtering SHALL be direct edit of `B1`/`C1`/`E1`/`F1` with no menu or `HtmlService`. Dashboard SHALL work on Android Sheets and desktop Chrome; `B1:F1` height SHALL be >=24px; dates SHALL be `d/M/yyyy` `America/La_Paz` (`es-BO`). Setup SHALL live in `apps-script/yarn-production/` with no new folder.

#### Scenario: Zero trigger on filter
- GIVEN user edits `B1` or `E1`
- WHEN recalculation finishes
- THEN no execution appears and formulas update alone

#### Scenario: Usable without menu on Android
- GIVEN Android Sheets without menu
- WHEN user edits `E1` dropdown on `dashboard`
- THEN cards and charts update correctly and row height >=24px

#### Scenario: Locale date parsing
- GIVEN `B1=5/9/2026` in `es-BO`
- WHEN filtering
- THEN date is 5 Sep 2026 `America/La_Paz`, not 9 May
