# Design: Yarn Production

## Technical Approach

Create a separately deployed, spreadsheet-bound V8 Apps Script project from `apps-script/yarn-production/*.gs`; it does not share globals, triggers, or files with the attendance project in `apps-script/`. The module batch-reads the fixed form, loads records on `G2` edits, and performs locked idempotent upserts against the A:Q production store. Sheet setup installs validations, protects fixed labels/formulas, and binds both the menu and the single `Guardar` drawing to the same public handler.

## Architecture Decisions

| Option | Tradeoff | Decision and rationale |
|---|---|---|
| Separate bound project vs. adding handlers to attendance | Separate deployment requires independent installation but prevents `onOpen`/`onEdit` name collisions | **Separate project.** The repository folder is a deployment boundary, preserving attendance behavior. |
| Batch repository vs. per-cell access | Batch reads use more memory but sharply reduce Apps Script calls | **Batch A:Q reads/writes.** Expected volume is only ~1,095 records/year and supports one in-lock ID index. |
| ISO key plus native date vs. display-text identity | Native dates are queryable but timezone-sensitive | **`yyyy-MM-dd-TURNO` ID; native DATE in B.** Both derive from `G2` using `America/La_Paz`, preventing display-format drift. |
| Preserve formulas vs. recreate during navigation | Preservation requires strict range boundaries | **Never write outside `D6:L8` during load/clear.** Setup owns native `SUM` formulas in `C9:L9` and `C10`, while runtime leaves them untouched. |
| Simple `onEdit` vs. installable edit trigger | Loading uses only bound spreadsheet services | **Simple `onEdit(e)`.** It handles only a single-cell `G2` edit on the form sheet; save remains an explicit authorized menu/button action. |

## Data Flow

```text
G2 edit -> onEdit -> normalize date -> read A:Q -> map by fixed turno -> set D6:L8
                                                   `-> no matches -> clear D6:L8

Guardar -> read G2 + C6:L8 -> validate/normalize -> document lock -> index IDs
        -> insert/update A:Q -> flush -> release -> toast summary
```

## File Changes

| File | Action | Description |
|---|---|---|
| `apps-script/yarn-production/Config.gs` | Create | Sheet names, ranges, fixed shifts, A:Q headers, timezone. |
| `apps-script/yarn-production/Setup.gs` | Create | Header/layout checks, date/numeric validation, protections, and total formulas. |
| `apps-script/yarn-production/Repository.gs` | Create | Batched lookup/load and locked A:Q upsert. |
| `apps-script/yarn-production/Form.gs` | Create | Date parsing, `onEdit`, form loading/clearing, row normalization. |
| `apps-script/yarn-production/Menu.gs` | Create | `onOpen`, public `guardarProduccion`, view, clear, and authorization/setup actions. |

## Interfaces / Contracts

`C6:C8` must equal `DIA`, `TARDE`, `NOCHE`; only `D6:L8` is mutable process input. A row is eligible when at least one process cell is nonblank; blanks then normalize to `0`. Store order is `id, fecha, turno, finisor, retorcido, madejeras, tintoreria, secado, devanado, embolsado, ovillado, madejitas, total_producto_terminado, registrado_por, editado_por, creado, actualizado`. `turno` is a STRING. Inserts set all audit fields; updates preserve `registrado_por`/`creado` and replace `editado_por`/`actualizado`. Editor identity uses active email, then effective email, then `unknown`.

The lock uses `tryLock(5000)`, sleeps once, retries `tryLock(5000)`, and fails without writes if still unavailable. Existing duplicate IDs are treated as an integrity error rather than silently selecting one.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Date/key normalization, eligibility, zero filling, totals, audit merge | Extract pure helpers and execute focused manual harness functions; no runner exists. |
| Integration | Insert/update, multi-turn save, no duplicate IDs, lock timeout, load/clear boundaries | Run against a spreadsheet copy and inspect A:Q plus formulas before/after. |
| E2E | Menu/button save, `G2` navigation, native validation rejection | Authorized-user walkthrough on a copy only; verify `C6:C8`, `C9:L9`, and `C10` remain unchanged. |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

Deploy only to a sheet copy, run setup, verify formulas/validations and all scenarios, then bind `Guardar`. Rollback removes the binding/project while retaining stored rows.

## Open Questions

- [ ] **Blocking:** confirm the physical A:Q data location. The source workbook already has a form tab named `produccion`, so a second database tab cannot use the same name; the implementation needs either an approved distinct data-tab name or a defined non-overlapping table range.
