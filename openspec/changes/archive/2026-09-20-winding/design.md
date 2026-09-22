# Design: Winding Shift Persistence

## Technical Approach

Create an isolated Apps Script V8 project for `ctrl_embolsado`. `Snapshot.gs` batch-reads the form and produces validated records; `Repository.gs` owns indexed, locked persistence and read-once recovery; public menu/trigger functions only orchestrate, toast, and reset controls. All globals/functions use the `winding` namespace.

## Architecture Decisions

| Decision | Choice | Alternatives / rationale |
|---|---|---|
| Storage | Frozen 26-column `db_embolsado` table; `id = fecha\|turno\|lote` | Matches the form/PRD. `db_winding` would add needless terminology drift. |
| Identity normalization | Trim `turno`/`lote`, preserve case, reject `\|`; format native `H4` as `yyyy-MM-dd` in `America/La_Paz` | Avoids ambiguous IDs without inventing vocabularies or parsing displayed `dd/MM/yyyy`. |
| Save control | Keep verified-free `M4` checkbox and `N4` label; do not use rows 8–9 | Matches the approved geometry and existing mobile pattern. Installable `windingOnEdit` handles only `FALSE→TRUE` and resets `M4` in `finally`; simple triggers never write DB. |
| Rehydrate | Read DB once by `fecha + turno`, map by trimmed case-preserved `lote`, then write `B12:D23` and `F12:T23`; restore `L4`. Auto-refill may run only if `B12:T23` is fully empty; otherwise preserve the form and show the menu-recovery toast. | Two writes are required because `E` separates the ranges. `E12:E23` is never included in a write/clear range. |
| Corrections | `Winding → Correcciones → Eliminar registro…`; prompt for lote, show exact ID, require confirmation, delete under the standard lock, and append deletion evidence to `Errors` | Explicit, auditable correction; missing form rows never imply deletion. |
| Remaining scope | Exclude row 29. Keep `docs/devanado/PRD-devanado.md` until an approved atomic docs/code-reference rename | Prevents scope creep and broken references. |
| Title/meta | Before implementation, inspect `E12:E23` formulas and displayed values on a spreadsheet COPY, recording title coverage and formula consistency in the harness log | `E` remains a value snapshot only; no title→meta table or validation is introduced. A mismatch blocks setup/deployment, not saves already deployed. |

## Data Flow

```text
Editor → M4 TRUE → windingOnEdit → windingGuardarTurno
  → batch snapshot H4/J4/L4 + A12:T23
  → validate/normalize → acquire lock (5s, sleep, 5s)
  → read DB once/build unique-id index → batch updates/appends → flush
  → toast → finally M4=FALSE

Menu Recuperar → read keys → read DB once/filter/map by lote
  → build 12-row grids → setValues(B:D), setValues(F:T) → L4 → flush/toast
```

## Module and File Changes

| File | Action | Responsibility |
|---|---|---|
| `apps-script/winding/Config.gs` | Create | `WINDING_CONFIG`, geometry, frozen DB/Errors headers, indexes, timezone. |
| `apps-script/winding/Snapshot.gs` | Create | Batch capture, native-date keying, row eligibility, normalization, event filtering. |
| `apps-script/winding/Repository.gs` | Create | Read/index, locked upsert/delete, rehydrate query, error append, editor fallback (`active → effective → unknown`). |
| `apps-script/winding/Menu.gs` | Create | `onOpen`, `windingGuardarTurno`, recovery, correction, Spanish toasts. |
| `apps-script/winding/Setup.gs` | Create | Idempotent schema/validation/protection and single installable-trigger reconciliation. |
| `apps-script/winding/appsscript.json` | Create | V8 and `America/La_Paz`. |
| `apps-script/winding/tests/Winding.test.gs` | Create | Manual pure-helper/service-seam GAS harness. |

## Interfaces / Contracts

- `windingGuardarTurno(): {success, code, inserted, updated}`; no mutation on invalid keys, delimiter, duplicate DB IDs, or lock timeout.
- Snapshot rows contain native `fecha`, normalized key parts, positional `item`, supervisor, `B:E`, and 15 numeric operators (blank/non-numeric → `0`; non-numeric also logs source cell).
- `Errors` header is frozen: `timestamp, contexto, detalle, editado_por`; timestamps use `America/La_Paz`.
- Setup validates existing headers exactly and fails on drift rather than reordering populated tables; freezes/protects row 1, applies native date/checkbox/numeric validations, and never changes formulas, rows 10–11, footers, or row 29.

## Testing Strategy

No repository runner exists. Run `windingTestHelpers_` manually in Apps Script on a COPY and inspect `Logger` (`✅/❌`). Cover event routing/reset-on-failure, native-date La Paz key, trim/case/`|`, eligibility/zero fill, duplicate IDs, audit fallback, lock failure/no write, idempotent upsert/no implicit delete, corrective delete confirmation, read-once recovery, deterministic supervisor restore, and assertions that every recovery range excludes `E`. Cover guarded auto-recovery: fully empty `B12:T23` permits refill; any populated cell preserves the form and emits the menu-recovery toast. Then run setup, save, re-save, recover, and delete against copy-only sheets and inspect headers, `Errors`, trigger count, formulas, and toasts.

## Threat Matrix

Internal Sheets event routing applies, but none of the matrix's execution/VCS boundaries do.

| Boundary | Applicability | Reason |
|---|---|---|
| Documentation-like paths | N/A | No path classification or execution. |
| Git repository selection | N/A | No Git invocation. |
| Commit state | N/A | No commit automation. |
| Push state | N/A | No push automation. |
| PR commands | N/A | No PR automation. |

## Migration / Rollout

No data migration. On a spreadsheet COPY, complete title/meta verification, run `windingSetup`, authorize once, and verify one installable `windingOnEdit` trigger before deployment. Rollback disables that trigger/menu while retaining DB/audit rows.

## Open Questions

None.
