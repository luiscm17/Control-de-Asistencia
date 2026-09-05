# Design: Yarn Mobile Form

## Technical Approach

Extend the existing native `produccion` form without changing its A:Q persistence contract. `setupYarnProduction()` configures an `M4` checkbox, `N4` label, row-4 touch height, and exactly one installable edit trigger. A narrow installed handler accepts only a single-cell `M4` `FALSE → TRUE` edit, rejects concurrent re-entry, and calls public `guardarProduccion()`. That shared action continues to validate `G2`, batch-read the three shifts, skip empty process rows, and delegate locked upserts to `yarnUpsertForDate_`. It returns an explicit success result so only successful checkbox saves reset `M4`; validation, integrity, or lock failures leave it checked. The menu and existing drawing remain assigned to `guardarProduccion`.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| One `M4` checkbox for all shifts | One explicit action; no per-shift state ambiguity; saver must inspect three rows | **Chosen** over two checkboxes because persistence is already independently keyed by `(fecha, turno)` and empty rows are skipped. |
| Installable edit trigger | Requires owner authorization and idempotent trigger reconciliation | **Chosen** because database writes must execute with authorized owner context; the simple `onEdit` remains limited to `G2` loading. |
| Keep drawing and menu | Three UI entry points require one stable public contract | **Chosen** for desktop continuity; all entry points call `guardarProduccion`, avoiding divergent validation/upsert logic. |
| `America/La_Paz` and native `d/M/yyyy` | Overrides stale `America/Lima` text in `openspec/config.yaml` | **Chosen** to match current `YARN_CONFIG`, proposal, spec, and stored IDs/audit timestamps. Existing native `SUM` formulas and es-BO formatting remain unchanged. |

## Data Flow

`G2` navigation remains separate and always materializes three form rows:

    G2 edit → simple onEdit → lookup A:Q by date → write/clear D6:L8 (3 shifts)

Checkbox save sequence:

    Android/User      Installed onEdit      guardarProduccion       Repository       datos_produccion
         | M4=TRUE            |                     |                    |                   |
         |------------------->| validate event      |                    |                   |
         |                    |--call-------------->| validate G2        |                   |
         |                    |                     | read C6:L8 once    |                   |
         |                    |                     | skip empty shifts  |                   |
         |                    |                     |--upsert----------->| try document lock |
         |                    |                     |                    | index A:Q         |
         |                    |                     |                    |--set/append rows->|
         |                    |                     |<--result-----------| release lock      |
         |                    |<--success/failure---|                    |                   |
         |<--toast; FALSE only on success-----------|                    |                   |

Each save reads DIA/TARDE/NOCHE. A row with no D:L value is omitted; populated rows normalize blank cells to zero and independently insert/update A:Q by `yyyy-MM-dd-TURNO`. Consequently, saving a later shift does not remove an earlier shift. Only a valid `G2` edit reloads all three rows or clears `D6:L8`.

## File Changes

| File | Action | Description |
|---|---|---|
| `apps-script/yarn-production/Config.gs` | Modify | Add M4/N4 coordinates, trigger handler name, row-height, and guard constants. |
| `apps-script/yarn-production/Form.gs` | Modify | Add narrow installable dispatcher; preserve simple `onEdit` as G2-only. Guard single-cell `FALSE → TRUE` and concurrent duplicate execution. |
| `apps-script/yarn-production/Menu.gs` | Modify | Make `guardarProduccion()` return a structured success/failure result while preserving toasts and public menu/drawing compatibility. |
| `apps-script/yarn-production/Setup.gs` | Modify | Idempotently configure checkbox/label/style and reconcile exactly one spreadsheet edit trigger without moving or deleting drawings. |

## Interfaces / Contracts

`guardarProduccion()` remains public and argument-free. It returns `{ok:boolean, reason:string, inserted:number, updated:number}`; callers may ignore it. `yarnMobileOnEdit(e)` is the installable handler. It resets M4 only when `ok === true`; all failures preserve `TRUE`. Programmatic reset events and edits lacking exact old/new checkbox values are ignored.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Helper | Event filtering, result mapping, empty-shift eligibility | Extend manual Apps Script harness with synthetic values/results. |
| Integration | M4 success/failure, one reconciled trigger, A:Q insert/update, audit and lock retry | Run setup and handler scenarios on an authorized spreadsheet copy; inspect Executions and A:Q. |
| E2E | Android touch target and save; G2 loads three rows; drawing/menu regressions | On copy, save DIA/NOCHE with TARDE empty, retry forced failure, then verify drawing assignment and mobile layout. |

## Threat Matrix

The installable trigger is a process-integration boundary, but the reference matrix's command/VCS rows do not apply.

| Boundary | Applicability | Reason |
|---|---|---|
| Documentation-like paths | N/A | No executable-file classification. |
| Git repository selection | N/A | No Git command or repository routing. |
| Commit state | N/A | No commit automation. |
| Push state | N/A | No push automation. |
| PR commands | N/A | No PR command composition. |

Trigger safety is covered by integration RED cases for non-M4 edits, missing event metadata, reset events, duplicate trigger installation, concurrent re-entry, validation failure, and lock failure.

## Migration / Rollout

No schema or data migration. Deploy scripts, run `setupYarnProduction()` once as owner on a copy, authorize the trigger, verify Android/menu/drawing paths, then repeat on production. Rollback deletes the installed handler and clears M4/N4 configuration; A:Q data remains valid.

## Open Questions

None.
