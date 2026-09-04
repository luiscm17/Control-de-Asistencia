# Design: Yarn Settings

## Technical Approach

Add an isolated V8 Apps Script project under `apps-script/yarn-settings/`. The public `guardarTurno()` entry point batch-reads the `Settings` form, builds and validates an immutable shift snapshot, then applies assignment and weighing mutations under one document lock. This implements the five `yarn-shift-persistence` requirements: explicit save, bounded serialization, idempotent PK upserts, EC-03 deletion, audit evidence, and no attendance-control changes.

## Architecture Decisions

| Decision | Alternatives considered | Rationale |
|---|---|---|
| Validate the complete snapshot before locking; re-read DB state after locking | Validate/write row by row | Business failures cause zero DB writes while the short critical section still uses current PK state. |
| Keep `Settings!I50:I157` formulas for UX; recompute net weight in Script | Persist formula output; move formula into Script | Meets the weighing contract without making Apps Script responsible for sheet UX formulas. |
| Index each DB body in memory and execute one mutation plan | Repeated `findRow`; append-only history | O(n) scans support deterministic upsert/delete and preserve `creado`. |
| Capture original affected rows and append boundary for compensating rollback | Independent writes; full-table rewrite | Apps Script has no transactions; compensation under the same lock minimizes partial state without rewriting ~33k annual rows. |
| Separate Yarn globals/files from attendance-control | Reuse attendance `CONFIG`, `onOpen`, or helpers | Apps Script concatenates project files; an independent deployment prevents global/function collisions and honors scope isolation. |

## Data Flow

```text
Button / Yarn menu -> guardarTurno() -> readShiftSnapshot_()
  -> validateShiftSnapshot_() -> acquire lock (5s, sleep, 5s retry)
  -> load DB indexes -> plan assignment upserts + weighing upserts/deletes
  -> apply plan -> flush -> success toast
       | failure: compensate -> Errors + failure toast
```

`Ingest.gs` batch-reads `F4`, Standards `B10:C19`, assignments `B33:H42`, and weighing metadata/input `B50:H157`. A row is a weighing slot only when its machine, discharge number, and side metadata form a valid visible PK; blank gross weight deletes that existing PK and otherwise creates nothing. Numeric gross/tare values are normalized with blank tare as zero; `peso_neto = round2(bruto - (usos * peso_cono + peso_tacho))`.

## File Changes

| File | Action | Description |
|---|---|---|
| `apps-script/yarn-settings/Config.gs` | Create | Names, ranges, headers, timezone, limits, and error codes. |
| `apps-script/yarn-settings/Ingest.gs` | Create | Batch snapshot extraction and all business validation. |
| `apps-script/yarn-settings/Persistence.gs` | Create | PK indexes, mutation plans, upsert/delete, audit preservation, compensation. |
| `apps-script/yarn-settings/Core.gs` | Create | `guardarTurno()`, lock lifecycle, orchestration, feedback. |
| `apps-script/yarn-settings/Errors.gs` | Create | Best-effort `Errors` evidence and editor identity fallback. |
| `apps-script/yarn-settings/Menu.gs` | Create | `onOpen`, DB navigation, and re-sync menu handlers. |
| `apps-script/yarn-settings/appsscript.json` | Create | V8, `America/La_Paz`, Sheets/UI/user-email scopes. |

## Interfaces / Contracts

- Public: `guardarTurno(): void`; `onOpen(): void`; DB navigation and `menuResincronizarSettings()` handlers.
- Assignment PK: `(fecha, retorcedora)`; columns A:M: `id, fecha, retorcedora, cabos, titulo_asignado, frentes_asignados, prod_dia, prod_turno, lotes_dia, creado, actualizado, editado_por, rango_origen`.
- Weighing PK: `(fecha, retorcedora, descarga_nro, lado)`; columns A:O: `id, fecha, retorcedora, descarga_nro, lado, titulo, peso_bruto, usos, peso_cono, peso_tacho, peso_neto, creado, actualizado, editado_por, rango_origen`.
- Dates remain Sheets `Date` values; IDs use a La Paz `yyyy-MM-dd` date key. Audit timestamps use `Utilities.formatDate(..., 'America/La_Paz', 'yyyy-MM-dd HH:mm:ss')`; editor falls back to `unknown`.
- Sheet validation/formatting owns `F4`, numeric formats, and title dropdown. Script owns date/business checks, Standards existence/lookup, numeric gross/tare checks, locking, and persistence.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | PKs, validation, net rounding, mutation planning | Pure-function cases in Apps Script editor until a runner exists. |
| Integration | Insert/update, preserved `creado`, EC-03 delete, compensation, lock retry, Errors | Execute against a workbook copy with seeded DB rows and injected failing write/lock seams. |
| E2E | Menu/button save, formulas retained, counts/kg toast, DB navigation | Manual authenticated verification on a sheet copy; never production. |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or OS process-integration boundary.

## Migration / Rollout

No data migration required. Deploy the isolated Apps Script project to a workbook copy, verify exact frozen headers and protected Standards/formula cells, then bind the drawing to `guardarTurno()`. Roll back by detaching the menu/button deployment; retain DB rows for audit.

## Open Questions

None.
