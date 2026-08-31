# registro-ingest Specification

## Purpose
Incremental upsert from `E15:AI44` (6 sections) and `Apoyo A3:E3` into `Registro` A:M, PK `section,operator_name,date`.

## Requirements

### Requirement: Incremental Upsert and Correction
The system MUST upsert one `Registro` row per valid `E15:AI44` edit using `E11` (`=+E13&"/"&$V$9&"/"&$S$7`); corrections MUST update in place, preserve `created_at`.

#### Scenario: Create and correct
- GIVEN `E11=15/03/2026`, no row for `Preparacion/Juan Pérez/2026-03-15`
- WHEN `G20=F` then `G20=A`
- THEN first creates `active` row; second updates same `record_id`

### Requirement: Void on Clear
The system MUST set `status=void` on clear to `""` when `E11` valid; blank `E11` columns MUST be ignored.

#### Scenario: Void
- GIVEN active row for `G20`
- WHEN cell cleared
- THEN `status=void`, toast `🗑️ void`

### Requirement: Bulk Paste Per-Cell
The system MUST process each `paste∩E15:AI44` cell with valid `E11` individually (validation+gate per-cell) and toast `N ins/M upd/K void/W fuera de ventana`.

#### Scenario: Bulk mixed
- GIVEN 30-cell paste, 2 cols blank `E11`, 3 out-of-window
- WHEN committed
- THEN only valid in-window cells written; counts correct

### Requirement: Calendar No-Write
The system MUST NOT write on `S7:U7`/`S9:U9` changes; only `E15:AI44` triggers writes.

#### Scenario: Month change
- GIVEN `S9:U9` Septiembre→Octubre
- WHEN `E11` regenerates
- THEN zero writes

### Requirement: Code Validation
The system MUST accept only `A,AT,BM,F,empty`; others MUST toast `⚠️ Código no válido` and not write.

#### Scenario: Invalid rejected
- GIVEN `E15` selected
- WHEN `X` entered
- THEN no write, toast shown

### Requirement: Apoyo Ingest
The system MUST on `Apoyo!A3:E3` upsert `is_apoyo=TRUE` with `D=C3, E=B3, F=A3 iso, L=E3`, same gate/validation.

#### Scenario: Apoyo row
- GIVEN `A3:E3=2026-03-15,Ana López,Preparacion,A,apoyo en conera 4`
- WHEN edited and gate passes
- THEN `Registro` row `is_apoyo=TRUE, nota=apoyo…`

### Requirement: Idempotent Backfill
The system MUST scan 6 sections `E15:AI44` where `E11` valid+non-empty, upsert idempotently; rerun MUST not duplicate.

#### Scenario: Backfill idempotent
- GIVEN empty `Registro` on COPY
- WHEN backfill then rerun
- THEN first creates rows; second zero changes
