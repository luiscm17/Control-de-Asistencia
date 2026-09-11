# Apply Progress: Yarn Inventory

## Mode

Standard. `strict_tdd` is disabled — no workspace runner for GAS harnesses; verification is manual via Apps Script editor and COPY.

## Delivery

- Strategy: `auto-chain`, `stacked-to-main`.
- Work unit: PR2 — Repository + Ingest + Persistence + lock (Phase 2: tasks 2.1–2.4) stacked on PR1.
- Boundary: Adds `Repository.gs` (batch DB reads + index), `Ingest.gs` (input-only snapshots), `Persistence.gs` (PK plans, void↔active, single lock, Guardar Todo sequential). No code outside `apps-script/yarn-inventory/` is touched. PR1 boundary: `appsscript.json` + `Config.gs` SSOT + `Errors.gs`.
- Review budget: PR2 693 lines (76 + 198 + 419) — exceeds 400-line budget → `size:exception` recommended. This slice is cohesive: Repository/Ingest/Persistence share lock + PK + void logic and were verified together; splitting further would break the save atomicity boundary. PR1 was 304 lines (within budget). Cumulative 997 lines across PR1+PR2.
- Rollback: Revert `Repository.gs`, `Ingest.gs`, `Persistence.gs` (delete 3 files) and revert Phase 2 checkboxes in `tasks.md` — PR1 rollback: delete `appsscript.json`, `Config.gs`, `Errors.gs`.

## Completed Tasks

- [x] 1.1 Create `apps-script/yarn-inventory/appsscript.json` with `timeZone: America/La_Paz`, `V8`, scopes `spreadsheets/scriptapp/container.ui/userinfo.email`
- [x] 1.2 Create `apps-script/yarn-inventory/Config.gs` frozen `YARN_INVENTORY_CONFIG` (SHEETS/RANGES/HEADERS A:Q 17 + A:X 24/IDX/TURNO `Turno Dia`/`Dia`/SUP/INV lists/LIMITS 10+47) + `GetSheet/ParseA1/DateKey/EnsureSchema`
- [x] 1.3 Create `apps-script/yarn-inventory/Errors.gs` with `LogError_/GetEditorEmail_` → `Errors` `A:F`, never throw
- [x] 2.1 Create `apps-script/yarn-inventory/Repository.gs` with `EnsureDbSheets_/LoadState_/BuildIndex_` batch `getRange(2,1,last-1,w)` for `db_madejeras`/`db_lotes`, `fecha` native DATE
- [x] 2.2 Create `apps-script/yarn-inventory/Ingest.gs` with `ReadMadejeras/LotesSnapshot_` only `C8:G17` + `A6:F52`/`H6:O52` via Config, trim/CI validate DATE + turno/sup/inv, eligibility `titulo_base+cabos`/`objetivo_neto`, ignore >52
- [x] 2.3 Create `apps-script/yarn-inventory/Persistence.gs` with `BuildMadejeras/LotesPlan_` PK `yyyy-MM-dd-turno-maquina-lado` / `fecha-turno-lote_id|row6..52` last-wins `⚠️`, `void`→`active`, `creado` preserved `actualizado/editado_por` `La_Paz` only
- [x] 2.4 Implement `guardarMadejeras/guardarLotes/guardarTodo` single `LockService.tryLock(5000)`+1 retry, `Todo` sequential partial not rolled back, idempotent, toasts `✅/⏳/❌/⚠️`

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `Select-String -Pattern 'getRange\("' apps-script/yarn-inventory/*.gs` → **PASS**: 0 hits outside `Config.gs` comment (1 hit is Config.gs doc line only). Syntax check via temp `.js` + `node --check` → **OK** for `Repository.gs`, `Ingest.gs`, `Persistence.gs` (exit 0). |
| Runtime harness command/scenario and exact result | Workbook COPY `1RCupngk5x95ev5N4Zv0veMMbOhz6eH_9Vs44a1txE3s`: PR1 — open → `Inventario` menu + `Re-sincronizar` creates `db_madejeras` A:Q (17) / `db_lotes` A:X (24) / `Errors` A:F with frozen headers + protection — **not run**: no authenticated COPY available to this executor; required before merge — run `yarnInventoryEnsureSchema()` then verify. PR2 — fill 4 madejera rows + 5 lote rows → `Guardar Madejeras` + `Guardar Lotes` + `Guardar Todo` sequential → verify `A:Q/A:X` batch upsert ≤10/≤47 per fecha+turno, last-wins, void→active, creado preserved, invalid ⚠️ → Errors — **not run**: same harness limitation; manual run in editor required (select `guardarTodo` → Run → Logger ✅). |
| Rollback boundary | Revert PR2: delete `apps-script/yarn-inventory/Repository.gs`, `Ingest.gs`, `Persistence.gs` and revert `openspec/changes/yarn-inventory/tasks.md` Phase 2 checkboxes. PR1 rollback: delete `appsscript.json`, `Config.gs`, `Errors.gs`. No other project or sheet is affected. |

## Verification Notes

- **PR1**: `appsscript.json` `America/La_Paz` V8 verified via `ConvertFrom-Json`; `YARN_INVENTORY_CONFIG` frozen with nested freezes: `SHEETS` (5), `RANGES` (10 + frozen `LOTES_FORMULAS` / `MADEJERAS_FORMULAS_PARTS`), `MADEJERAS_HEADERS` 17 A:Q, `LOTES_HEADERS` 24 A:X, `ERRORS_HEADERS` 6 A:F, `IDX_*` covering all header positions, `TURNO_MADEJERAS`/`TURNO_LOTES`/`SUPERVISOR_VALUES`/`INVENTARIO_VALUES`/`TIPO_ORDEN_VALUES`, `LIMITS` (10/47/52/1002), `UI` header protection + colors, `ERRORS` codes — matches PRD §8 and design interfaces. `fecha` via `getFullYear/getMonth/getDate` no formatDate; `America/La_Paz` only for audit. `Errors.gs` never throws; numeric `getRange(row,col,…)`.
- **PR2 — Repository**: `yarnInventoryEnsureDbSheets_` delegates to `yarnInventoryEnsureSchema`; `yarnInventoryLoadState_` loads both DBs via `getRange(2,1,last-1,w)` with `LIMITS.DB_*_COLUMNS` (17/24) — single batch per table; `yarnInventoryBuildIndex_` builds id→rowNum (first wins, duplicate logs). `fecha` kept as native DATE object; `yarnInventoryDateFromKey_` creates noon Date to avoid TZ shift.
- **PR2 — Ingest**: `ReadMadejerasSnapshot_` reads only `B3/F3/B4/F4` + `C8:G17` via `yarnInventoryGetRange_`; `ReadLotesSnapshot_` reads only `C3/E3/G3/I3` + `A6:F52`/`H6:O52` via Config — formulas `H8:K17`/`G/P/Q/R` never touched. Trim+CI validation vs `TURNO_MADEJERAS` (`Turno Dia` etc) / `TURNO_LOTES` (`Dia`) / `SUPERVISOR_VALUES`/`INVENTARIO_VALUES`; `fecha` via `yarnInventoryDateKey_` (native DATE). Eligibility: madejeras `titulo_base+cabos` both numeric non-null; lotes `objetivo_neto` non-null; empty rows skipped; rows beyond 52 ignored (slice to LIMITS). `rango_origen` uses `SHEETS.MADEJERAS/LOTES` SSOT.
- **PR2 — Persistence**: `BuildMadejerasPlan_` PK `yyyy-MM-dd-turno-maquina-lado` (derived `Máquina 1..5 × A/B` from row idx), `BuildLotesPlan_` PK `fecha-turno-lote_id` or `fecha-turno-row{6..52}` fallback — last-wins via norm lowercase map with `⚠️` warning toast. Void handling: existing `active` rows for same `fecha+turno` not in snapshot become `void` with refreshed `actualizado/editado_por`; re-adding flips `void`→`active` with `creado` preserved (from existing row) and `actualizado` refreshed in `America/La_Paz` only. `fecha` stored as Date at noon; `creado` never overwritten. `ApplyPlans_` writes contiguous updates in one `setValues` batch per group and appends inserts together.
- **PR2 — Lock/Save**: `guardarMadejeras/guardarLotes` single `LockService.getDocumentLock()` `tryLock(5000)`+1 retry via `yarnInventoryAcquireLock_`; on exhaustion log `Errors` + toast `⏳→❌ Error — use Re-sincronizar`, no writes. `guardarTodo` single lock sequential `madejeras→lotes`; partial success not rolled back, second form still attempted; failure logged `partial_save`; retry idempotent (PK upsert). Success toasts `✅ Guardado: {fecha} {turno} — {N} … por {user}`; invalid fecha/turno/sup/inv blocks that form (toast `⚠️`, log, no partial write).
- **Isolation**: All code only in `apps-script/yarn-inventory/` — no file outside that path changed (verified `git status`). No shared globals with `attendance-control/yarn-production/yarn-settings/coneras-production`. Single Config SSOT — no literal `getRange("A1")` outside Config.
- **No runner**: Standard mode per `openspec/config.yaml` `strict_tdd: false`; harness is manual Logger in Apps Script editor.

## Remaining Tasks

- [ ] 3.1 Create `apps-script/yarn-inventory/Menu.gs` `onOpen` `Inventario → Guardar Madejeras|Lotes|Todo + Ver db_* + Re-sincronizar`, no checkbox/debounce
- [ ] 3.2 Implement `yarnInventoryOnEdit` hydration: `B3/F3` or `C3/E3` change → clear+fill only input ranges for `fecha+turno`; `H8:K17` + `G/P/Q/R` never touched `FORMULA` verbatim
- [ ] 3.3 Enforce `fecha` native DATE (`getFullYear/getMonth/getDate` no `formatDate`) + audit `Utilities.formatDate(...,La_Paz)` only, invalid blocks that form no partial write
- [ ] 4.1 Create `apps-script/yarn-inventory/tests/yarn-inventory.test.gs` harness (no runner) — boundary untouched, PK rowIndex fallback, void re-activate, `creado` preserved, invalid block, lock `⏳→❌`, ≤10/≤47
- [ ] 4.2 Verify on COPY `1RCupngk5x95ev5N4Zv0veMMbOhz6eH_9Vs44a1txE3s` only: `Guardar Todo` sequential ≤10+≤47 per `fecha+turno`, clearing→`void` re-adding→`active`, formulas recalc
- [ ] 4.3 Final guard: grep no `getRange("` outside `Config.gs`, no file outside `apps-script/yarn-inventory/` changed, headers frozen

Progress: 7/13 tasks complete — PR2 delivered (Repository+Ingest+Persistence+lock); next is PR3 (Menu hydration + verification).
