# Apply Progress: Yarn Inventory

## Mode

Standard. `strict_tdd` is disabled — no workspace runner for GAS harnesses; verification is manual via Apps Script editor and COPY.

## Delivery

- Strategy: `auto-chain`, `stacked-to-main`.
- Work unit: PR1 — Scaffold + SSOT + Errors (Phase 1: tasks 1.1–1.3).
- Boundary: Creates `apps-script/yarn-inventory/appsscript.json` (America/La_Paz), frozen `YARN_INVENTORY_CONFIG` SSOT + `ParseA1/Range/DateKey/EnsureSchema`, and `Errors.gs` audit. No code outside `apps-script/yarn-inventory/` is touched.
- Review budget: 304 lines (12 + 242 + 50) — within 400-line budget.
- Rollback: Delete `apps-script/yarn-inventory/appsscript.json`, `Config.gs`, `Errors.gs` and revert Phase 1 checkboxes in `tasks.md`.

## Completed Tasks

- [x] 1.1 Create `apps-script/yarn-inventory/appsscript.json` with `timeZone: America/La_Paz`, `V8`, scopes `spreadsheets/scriptapp/container.ui/userinfo.email`
- [x] 1.2 Create `apps-script/yarn-inventory/Config.gs` frozen `YARN_INVENTORY_CONFIG` (SHEETS/RANGES/HEADERS A:Q 17 + A:X 24/IDX/TURNO `Turno Dia`/`Dia`/SUP/INV lists/LIMITS 10+47) + `GetSheet/ParseA1/DateKey/EnsureSchema`
- [x] 1.3 Create `apps-script/yarn-inventory/Errors.gs` with `LogError_/GetEditorEmail_` → `Errors` `A:F`, never throw

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `Select-String -Pattern 'getRange\("' apps-script/yarn-inventory/*.gs` → **PASS**: no literal `getRange("` outside `Config.gs` (0 hits). Syntax check via temp `.js` + `node --check` → **OK** for `Config.gs` and `Errors.gs` (exit 0). |
| Runtime harness command/scenario and exact result | Workbook COPY `1RCupngk5x95ev5N4Zv0veMMbOhz6eH_9Vs44a1txE3s`: open → `Inventario` menu + `Re-sincronizar` creates `db_madejeras` A:Q (17) / `db_lotes` A:X (24) / `Errors` A:F with frozen headers + protection — **not run**: no authenticated COPY available to this executor; required before deployment — run `yarnInventoryEnsureSchema()` then verify headers `id…estado` order and `setFrozenRows(1)` + protection `YarnInventory frozen header`. |
| Rollback boundary | Delete `apps-script/yarn-inventory/` (3 files) and revert `openspec/changes/yarn-inventory/tasks.md` Phase 1 checkboxes — no other project or sheet is affected. |

## Verification Notes

- `appsscript.json`: `timeZone America/La_Paz`, `runtimeVersion V8`, scopes `spreadsheets/script.scriptapp/container.ui/userinfo.email` — verified via `ConvertFrom-Json`.
- `YARN_INVENTORY_CONFIG` is `Object.freeze` with nested freezes: `SHEETS` (5), `RANGES` (10 + frozen `LOTES_FORMULAS` / `MADEJERAS_FORMULAS_PARTS`), `MADEJERAS_HEADERS` 17 cols A:Q, `LOTES_HEADERS` 24 cols A:X, `ERRORS_HEADERS` 6 cols A:F, `IDX_*` covering all header positions, `TURNO_MADEJERAS`/`TURNO_LOTES`/`SUPERVISOR_VALUES`/`INVENTARIO_VALUES`/`TIPO_ORDEN_VALUES`, `LIMITS` (10/47/52/1002), `UI` header protection + colors, `ERRORS` codes — matches `docs/yarn-inventory/PRD.md` §8 and `design.md` interfaces.
- `fecha` handling: `yarnInventoryDateKey_` uses `getFullYear/getMonth/getDate` without `Utilities.formatDate` timezone conversion; `America/La_Paz` is reserved only for `yarnInventoryAuditTimestamp_` (creado/actualizado). Headers include `rango_origen` + `estado` (active/void) soft-delete per spec.
- Formula boundary: `RANGES.MADEJERAS_FORMULAS = H8:K17` and `LOTES_FORMULAS {G,P,Q,R}` are declared as guards in Config — never read/written/cleared outside Config; no code outside `apps-script/yarn-inventory/` was changed.
- `Errors.gs` never throws: `yarnInventoryLogError_` returns `boolean`, lazily calls `yarnInventoryEnsureSchema` if `Errors` missing, uses numeric `getRange(row, col, ...)` — passes `getRange("` grep guard.
- Isolation: all code lives only in `apps-script/yarn-inventory/` — `git status` shows no changes outside that path (plus `openspec/` artifacts). No shared globals with `attendance-control / yarn-production / yarn-settings / coneras-production`.
- No `npm`/runner used — Standard mode per `openspec/config.yaml` `strict_tdd: false`.
- `Re-sincronizar` entry point `yarnInventoryEnsureSchema()` creates `db_madejeras`/`db_lotes`/`Errors` with frozen headers, `bold`+`#e8f0fe`/`#fce8e6`, `setFrozenRows(1)`, header protection `YarnInventory frozen header — do not reorder`, and `yyyy-MM-dd` / `yyyy-MM-dd HH:mm:ss` number formats — idempotent.

## Remaining Tasks

- [ ] 2.1 Create `apps-script/yarn-inventory/Repository.gs` with `EnsureDbSheets_/LoadState_/BuildIndex_` batch `getRange(2,1,last-1,w)` for `db_madejeras`/`db_lotes`, `fecha` native DATE
- [ ] 2.2 Create `apps-script/yarn-inventory/Ingest.gs` with `ReadMadejeras/LotesSnapshot_` only `C8:G17` + `A6:F52`/`H6:O52` via Config, trim/CI validate DATE + turno/sup/inv, eligibility `titulo_base+cabos`/`objetivo_neto`, ignore >52
- [ ] 2.3 Create `apps-script/yarn-inventory/Persistence.gs` with `BuildMadejeras/LotesPlan_` PK `yyyy-MM-dd-turno-maquina-lado` / `fecha-turno-lote_id|row6..52` last-wins `⚠️`, `void`→`active`, `creado` preserved `actualizado/editado_por` `La_Paz` only
- [ ] 2.4 Implement `guardarMadejeras/guardarLotes/guardarTodo` single `LockService.tryLock(5000)`+1 retry, `Todo` sequential partial not rolled back, idempotent, toasts `✅/⏳/❌/⚠️`
- [ ] 3.1 Create `apps-script/yarn-inventory/Menu.gs` `onOpen` `Inventario → Guardar Madejeras|Lotes|Todo + Ver db_* + Re-sincronizar`, no checkbox/debounce
- [ ] 3.2 Implement `yarnInventoryOnEdit` hydration: `B3/F3` or `C3/E3` change → clear+fill only input ranges for `fecha+turno`; `H8:K17` + `G/P/Q/R` never touched `FORMULA` verbatim
- [ ] 3.3 Enforce `fecha` native DATE (`getFullYear/getMonth/getDate` no `formatDate`) + audit `Utilities.formatDate(...,La_Paz)` only, invalid blocks that form no partial write
- [ ] 4.1 Create `apps-script/yarn-inventory/tests/yarn-inventory.test.gs` harness (no runner) — boundary untouched, PK rowIndex fallback, void re-activate, `creado` preserved, invalid block, lock `⏳→❌`, ≤10/≤47
- [ ] 4.2 Verify on COPY `1RCupngk5x95ev5N4Zv0veMMbOhz6eH_9Vs44a1txE3s` only: `Guardar Todo` sequential ≤10+≤47 per `fecha+turno`, clearing→`void` re-adding→`active`, formulas recalc
- [ ] 4.3 Final guard: grep no `getRange("` outside `Config.gs`, no file outside `apps-script/yarn-inventory/` changed, headers frozen

Progress: 3/13 tasks complete — PR1 delivered; next is PR2 (Repository + Ingest + Persistence + lock).
