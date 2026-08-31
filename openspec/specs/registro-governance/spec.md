# registro-governance Specification

## Purpose
Govern writes: Config resolution, window/permission gate before lock, concurrency, menu/audit, timezone/locale, `Hoja2`.

## Requirements

### Requirement: Config-Driven Section Resolution
The system MUST resolve logical section via `Config!A:B` (`sheetId→section` primary, `tabName→section` fallback); unmapped MUST warn and not write.

#### Scenario: Renamed via sheetId
- GIVEN `Preparacion` renamed `PREP-XYZ` but `sheetId` mapped
- WHEN `E20` edited
- THEN resolves to `Preparacion`

### Requirement: Window and Permission Gate Before Lock
The system MUST before lock verify `activeUser==responsible(section)` (`Config!A:B ?? header`) AND `fecha_col∈{today,today-1}` Lima (`Utilities.formatDate(...,"America/Lima","yyyy-MM-dd")` from `E11`); fail MUST toast `⛔`, no write, log `Errors`; bulk per-cell.

#### Scenario: Out-of-window blocked
- GIVEN `E11=2026-03-10`, today `2026-03-15` Lima
- WHEN edit attempted
- THEN blocked, logged

#### Scenario: Cross-section blocked
- GIVEN `activeUser != responsible(Continua)`
- WHEN `Continua!G20` edited
- THEN blocked with permission toast

### Requirement: Concurrency Control
The system MUST wrap writes with `LockService.getDocumentLock()` 5s retry once; fail MUST queue via `PropertiesService`.

#### Scenario: Contention
- GIVEN concurrent same PK
- WHEN lock fails
- THEN retry then queue

### Requirement: Installable Trigger and Audited Menu
The system MUST use installable `onEdit` (owner) for writes; simple `onEdit` only toast. Menu `Asistencia` MUST offer `Ver Registro/Re-sincronizar/Solicitar corrección/Registro manual/Backfill/Autorizar`; corrections MUST bypass gate with `via_manual`.

#### Scenario: RRHH bypass
- GIVEN `fecha_col=today-5`
- WHEN `Registro manual` used
- THEN succeeds with `via_manual`

### Requirement: Timezone, Locale and Hoja2 Integrity
The system MUST use `America/Lima` for timestamps/window; keep Spanish formulas verbatim (`SI.ERROR/BUSCARV/DIASEM/CONTAR.SI`, `FALSO`, `=+`); validate `Hoja2!A1:B12`/`D1:E7` on install+each `onEdit`; missing MUST toast `⚠️ Hoja2 no accesible`, no writes; never modify `Hoja2`.

#### Scenario: Hoja2 missing
- GIVEN `Hoja2` deleted
- WHEN `E15` edited
- THEN warning, zero writes

### Requirement: Registro Schema Protection
The system MUST keep `Registro` `A:M` header (`record_id,created_at,updated_at,section,operator_name,date,code,code_label,is_apoyo,edited_by,source_range,nota,status`) frozen/protected, never reorder.

#### Scenario: Header protected
- GIVEN `Registro` init
- WHEN install runs
- THEN `A1:M1` per §9
