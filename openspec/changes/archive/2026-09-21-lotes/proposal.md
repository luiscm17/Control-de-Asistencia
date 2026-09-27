# Proposal: Lotes — Daily Lot Tracking (lotes-form → db_lots)

## Intent

Current `lotes-form` (`19lBJHHKsusI6Eqkni-zh8us6ePoEHscEgrIPrFK-zhE`, gid `1098679039`) is a reusable 30-row form with no persistence: editing `D4` or re-typing rows overwrites prior days and prior entries are not queryable. We need traceable, auditable daily lot history without changing the user layout (`B8:G37`) or adding validation friction on the date.

Source of truth: `docs/lotes/PRD.md` v0.1.0 — form `lotes-form` (`C2` title, `C4/D4` `DATE dd/MM/yyyy` via `getValue()` passthrough, `F4` checkbox `FALSE→TRUE`, `B7:G7` headers, `B8:G37` 30 editable rows), DB `db_lots` 11 cols `A:K`, plus live `playwright-cli` verification on branch `lots-form`.

## Scope

### In Scope
- Isolated Apps Script V8 project `apps-script/lotes/` (`America/La_Paz`, built-ins only: `SpreadsheetApp`/`LockService`/`Session`/`Utilities`) — `Config.gs`/`Core.gs`/`Persistence.gs`/`Ingest.gs`/`Menu.gs`/`Errors.gs` + `appsscript.json`.
- Explicit save: checkbox `lotes-form!F4` `FALSE→TRUE` → `guardarLotes()` and menu `Lotes → Guardar` invoking the same function; reset `F4=FALSE` at end with guard to avoid re-triggering `onEdit`.
- Idempotent upsert of `B8:G37` (30 rows) into `db_lots` `A:K` by PK `id = yyyy-MM-dd-posicion` (posicion 1..30 = `B8:B37` visual); skip when `C` (Titulo) empty; delete existing `id` when `C` becomes empty (clearing a previously saved row).
- Date navigation: `onEdit` on `D4` or menu `Lotes → Resincronizar` → read `db_lots` for `fecha = D4` (`dd/MM/yyyy`), populate `C8:G37` by posicion if found, else clear `C8:G37` leaving `B8:B37 = 1..30`.
- Audit `America/La_Paz` only for `actualizado` (`yyyy-MM-dd HH:mm:ss` via `Utilities.formatDate`) and `creado_por`/`actualizado_por` (`Session.getActiveUser().getEmail()` or `unknown`); `creado` preserved on update.
- Concurrency `LockService.getDocumentLock()` 5 s with one retry; batch `getValues()`/`setValues()`; `onOpen` menu `Lotes → Guardar | Resincronizar` only.

### Out of Scope
- Dashboards, charts, history/bitácora, external integrations.
- Advanced `items` (catalog `A=color, B=titulo, C=tipo-material`) validation in Script — reference only.
- Any change to `apps-script/attendance-control`, `yarn-production`, `yarn-settings`, `dyeing`, `coneras-production`, `material-raw`, `winding`, `yarn-inventory`, or attendance sheets/`Registro`.
- Script-side validation or transformation of `D4` — Sheets native `DATE dd/MM/yyyy` passthrough per PRD FR-004; only guard is empty `D4` → toast `Seleccione una fecha en D4.` with no writes.
- Persistence of `No` column (`B8:B37`) or calendar helpers — visual only.

## Capabilities

### New Capabilities
- `lotes-lot-recording`: Date-driven reusable lot form persistence — explicit save (checkbox `F4` + menu), PK `fecha-posicion` upsert/delete, and date-based rehydration of `lotes-form` ↔ `db_lots` with `America/La_Paz` audit.

### Modified Capabilities
- None — net-new isolated module; no existing spec requirements change. If `openspec/specs/` review reveals overlap, will list deltas in spec phase.

## Approach

Build only under `apps-script/lotes/` following the established isolated-GAS pattern confirmed in `apps-script/attendance-control`/`yarn-settings`/`dyeing` (`appsscript.json` `timeZone: America/La_Paz`, `oauthScopes: spreadsheets, script.scriptapp, script.container.ui, userinfo.email`).

**Config SSOT** (`Config.gs`): freeze `SHEET_FORM = lotes-form` (ranges `D4`, `F4`, `B7:G7`, `B8:G37`), `SHEET_DB = db_lots`, header order `A:K` (`id, fecha, titulo, tipo_material, codigo_lote, color, observacion, creado, actualizado, creado_por, actualizado_por`), `PK = fecha-posicion`, batch sizes, lock/timezone constants. No global sharing across `apps-script/*`.

**Triggers & menu** (`Menu.gs` + `Ingest.gs`): `onOpen()` creates `Lotes → Guardar | Resincronizar` (two entries only). Installable `lotesOnEdit(e)` (created by one-time `setupLotes()`, re-auth required) handles two routes: (a) `F4` `FALSE→TRUE` → `guardarLotes()` — debounce guard similar to `yarn-production` `M4`/`yarn-settings` `I8`/`dyeing` `G4` (3000 ms pattern) not strictly required for single-checkbox but include guard flag via `PropertiesService` to ignore the programmatic `F4=FALSE` reset; (b) `D4` edit → `rehidratarPorFecha_()` (or menu `Resincronizar`). Simple `onEdit` only for routing/toast if installable missing.

**Persistence** (`Persistence.gs` + `Core.gs`): `guardarLotes()` — read `D4` via `getValue()` direct (no validation; empty → toast, no write); `getDisplayValues()` for `B8:G37` (typed passthrough; `No` ignored); build `fechaKey = yyyy-MM-dd` for `id` and retain `dd/MM/yyyy` display for `fecha` col `B` (Sheet `DATE` format `dd/MM/yyyy`); acquire `LockService.getDocumentLock()` 5 s, retry once, else toast `Ocupado, reintente con Resincronizar`; within lock read `db_lots` full range in one `getValues()`, index by `id`, then for each posicion 1..30: if `C` non-empty → `findRow(id)` update else append with `creado=actualizado=nowLaPaz`, `creado_por`; if `C` empty and `id` exists → delete row (bottom-up to avoid index shift); `No` never persisted; `creado` preserved, `actualizado`/`actualizado_por` refreshed; batch `setValues()` + `deleteRow()` handling; `SpreadsheetApp.flush()`; toast `✅ Guardado: dd/MM/yyyy — N lotes`; always reset `F4=FALSE` via guard (`isResettingF4_` flag). `rehidratarPorFecha_()` — single `getValues()` scan of `db_lots` for `fecha = D4 display`, clear `C8:G37`, then `setValues()` for matching posiciones; empty fecha → clear only.

**Alternatives rejected:** per-cell `onEdit` auto-save — would capture partial rows, pressure trigger quota (90 min/day), and make intentional deletion (clear `C` → delete) ambiguous; all-string persistence — acceptable here (all `C:G` STRING) but keep consistent with `getDisplayValues` passthrough; drawing button — rejected in favor of checkbox+menu hybrid (mobile-compatible, as in `yarn-settings` `I8`/`dyeing` `G4`).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps-script/lotes/Config.gs` | New | SSOT: `D4/F4/B7:G7/B8:G37`, `db_lots` `A:K` frozen order, PK `fecha-posicion`, timezone/lock constants |
| `apps-script/lotes/Core.gs` | New | Date helpers (`getValue()` passthrough, `yyyy-MM-dd` key vs `dd/MM/yyyy` display), audit `America/La_Paz` formatting |
| `apps-script/lotes/Persistence.gs` | New | `guardarLotes()` upsert/delete batch, `rehidratarPorFecha_()`, `LockService` 5 s + retry, `creado` preservation |
| `apps-script/lotes/Ingest.gs` | New | `lotesOnEdit(e)` dispatch (`F4` vs `D4`), `F4=FALSE` reset guard, `Resincronizar` handler |
| `apps-script/lotes/Menu.gs` | New | `onOpen()` `Lotes → Guardar | Resincronizar`, `setupLotes()` installable trigger setup |
| `apps-script/lotes/Errors.gs` | New | `Errors` sheet logging (mirrors `dyeing`/`yarn-settings` pattern) |
| `apps-script/lotes/appsscript.json` | New | `timeZone: America/La_Paz`, V8, scopes `spreadsheets/script.scriptapp/script.container.ui/userinfo.email` |
| `apps-script/lotes/tests/` | New | GAS Logger harness `lotes.test.gs` (manual, no runner) — PK upsert, delete-on-clear, rehydrate, lock, empty-D4 |
| `docs/lotes/PRD.md` | Reference | v0.1.0 field/range and frozen `A:K` source — not modified |
| `apps-script/attendance-control/` et al. | None | Pattern reference only; no shared globals or edits |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Concurrent `guardarLotes()` duplicate/lost rows | Med | `LockService.getDocumentLock()` 5 s + one retry; PK `id=fecha-posicion` idempotent; toast `Ocupado, reintente con Resincronizar` on exhaustion |
| `F4` reset re-triggers `onEdit` loop | Med | Guard flag (`PropertiesService` or in-memory `isResettingF4_`) — programmatic `F4=FALSE` ignored by `lotesOnEdit`; also check oldValue `FALSE→TRUE` only triggers save |
| `D4` empty or non-date passthrough mis-handled | Low | PRD mandates no Script validation; only guard is empty `D4` at save → toast `Seleccione una fecha en D4.` no writes; `getValue()` direct retains Sheets `DATE` semantics |
| `No` persisted or `B8:B37` overwritten on rehydrate | Low | `B8:B37` excluded from DB; rehydrate writes only `C8:G37`, leaves `B` as `1..30`; `Config` freezes the boundary |
| Cross-module global leak | Low | Strict isolation: all code under `apps-script/lotes/`; no import from other `apps-script/*`; each project own `appsscript.json` |
| Sheet name/header drift (`db_lots` not yet existent) | Low | `setupLotes()` creates `db_lots` with frozen `A:K` headers + `dd/MM/yyyy` number format on `B`; `getSheetByName` guards with toast if missing |

## Rollback Plan

Verify and deploy on a **COPY** of `19lBJHHKsusI6Eqkni-zh8us6ePoEHscEgrIPrFK-zhE` only (never prod). To rollback: delete the installable trigger `lotesOnEdit`, remove/revert `apps-script/lotes/` deployment, and keep `db_lots` unchanged for audit (delete only `id` rows created by the rolled-back deployment after review, or restore the sheet version-history snapshot). `F4` remains a plain checkbox (`FALSE` default) and the `Lotes` menu disappears after reload. `git revert` on branch `lots-form` (change `lotes`); no migration to undo because `creado`/`actualizado` writes are idempotent and isolated.

## Dependencies

- Sheet COPY of `19lBJHHKsusI6Eqkni-zh8us6ePoEHscEgrIPrFK-zhE` containing `lotes-form` + `items` for auth/verification; owner one-time trigger authorization for `lotesOnEdit`.
- Branch `lots-form` (current, `auto-chain` per preflight; `>400 lines` splits automatically per review policy).
- `openspec/config.yaml` `hybrid` artifact store — proposal persisted to Engram `sdd/lotes/proposal` and `openspec/changes/lotes/proposal.md`.
- Frozen inputs: `lotes-form` ranges `D4`/`F4`/`B7:G7`/`B8:G37` and `db_lots` `A:K` from PRD v0.1.0 — no `Hoja2`-like dependency to protect.

## Success Criteria

- [ ] New isolated project `apps-script/lotes/` exists with `appsscript.json` `America/La_Paz` and `Lotes → Guardar | Resincronizar` menu (two entries only) on `lotes-form`.
- [ ] `F4` `FALSE→TRUE` and `Lotes → Guardar` invoke the same `guardarLotes()`; on success or failure `F4` resets to `FALSE` without re-triggering a second save, and concurrent saves serialize via `LockService` 5 s + one retry.
- [ ] Empty `D4` at save shows `Seleccione una fecha en D4.` and writes nothing; non-empty `D4` `dd/MM/yyyy` passthrough (`getValue()` direct) populates `db_lots!B` correctly.
- [ ] Upsert is PK-idempotent `id=yyyy-MM-dd-posicion`: re-saving `fecha` + posicion updates in place preserving `creado` and refreshing `actualizado`/`actualizado_por`; `No` (`B8:B37`) is never persisted.
- [ ] Clearing `C` (Titulo) for a previously saved `id` and saving deletes only that `db_lots` row; rows with `C` non-empty are created/updated; toast `✅ Guardado: dd/MM/yyyy — N lotes` reports count.
- [ ] `onEdit` on `D4` or `Lotes → Resincronizar` rehydrates `C8:G37` by posicion for that `fecha`, clearing `C8:G37` when no records exist while leaving `B8:B37 = 1..30`.
- [ ] Audit `actualizado` and `creado_por`/`actualizado_por` use `America/La_Paz` (`Utilities.formatDate`) and `Session.getActiveUser().getEmail()`; no file outside `apps-script/lotes/` is modified.
