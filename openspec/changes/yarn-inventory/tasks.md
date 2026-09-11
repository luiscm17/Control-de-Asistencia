# Tasks: Yarn Inventory

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 650–750 (8 files) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 → PR2 → PR3 stacked to main |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Scaffold + SSOT + Errors | PR1 | Grep no `getRange("` outside `Config.gs`; harness stub → Logger | COPY `1RCupngk…` open → `Inventario` menu + `Re-sincronizar` creates `db_*` headers | Delete `appsscript.json`, `Config.gs`, `Errors.gs` |
| 2 | Repository + Ingest + Persistence + lock | PR2 | Run `yarnInventoryTest_` → Logger `✅` (void/creado/PK rowIndex) | COPY: fill 4+5 rows → `Guardar Madejeras/Lotes` → verify `A:Q/A:X` batch | Revert `Repository.gs`, `Ingest.gs`, `Persistence.gs` |
| 3 | Menu hydration + verification | PR3 | Change `B3/F3` & `C3/E3` → inputs refilled, formulas `H8:K17`/`G/P/Q/R` untouched | COPY: `Guardar Todo` sequential + lock `⏳→❌` + invalid `⚠️` → `Errors` | Revert `Menu.gs`, `tests/yarn-inventory.test.gs` |

## Phase 1: Foundation / Isolation

- [x] 1.1 Create `apps-script/yarn-inventory/appsscript.json` with `timeZone: America/La_Paz`, `V8`, scopes `spreadsheets/scriptapp/container.ui/userinfo.email`
- [x] 1.2 Create `apps-script/yarn-inventory/Config.gs` frozen `YARN_INVENTORY_CONFIG` (SHEETS/RANGES/HEADERS A:Q 17 + A:X 24/IDX/TURNO `Turno Dia`/`Dia`/SUP/INV lists/LIMITS 10+47) + `GetSheet/ParseA1/DateKey/EnsureSchema`
- [x] 1.3 Create `apps-script/yarn-inventory/Errors.gs` with `LogError_/GetEditorEmail_` → `Errors` `A:F`, never throw

## Phase 2: Core Implementation

- [x] 2.1 Create `apps-script/yarn-inventory/Repository.gs` with `EnsureDbSheets_/LoadState_/BuildIndex_` batch `getRange(2,1,last-1,w)` for `db_madejeras`/`db_lotes`, `fecha` native DATE
- [x] 2.2 Create `apps-script/yarn-inventory/Ingest.gs` with `ReadMadejeras/LotesSnapshot_` only `C8:G17` + `A6:F52`/`H6:O52` via Config, trim/CI validate DATE + turno/sup/inv, eligibility `titulo_base+cabos`/`objetivo_neto`, ignore >52
- [x] 2.3 Create `apps-script/yarn-inventory/Persistence.gs` with `BuildMadejeras/LotesPlan_` PK `yyyy-MM-dd-turno-maquina-lado` / `fecha-turno-lote_id|row6..52` last-wins `⚠️`, `void`→`active`, `creado` preserved `actualizado/editado_por` `La_Paz` only
- [x] 2.4 Implement `guardarMadejeras/guardarLotes/guardarTodo` single `LockService.tryLock(5000)`+1 retry, `Todo` sequential partial not rolled back, idempotent, toasts `✅/⏳/❌/⚠️`

## Phase 3: Integration / Wiring

- [x] 3.1 Create `apps-script/yarn-inventory/Menu.gs` `onOpen` `Inventario → Guardar Madejeras|Lotes|Todo + Ver db_* + Re-sincronizar`, no checkbox/debounce
- [x] 3.2 Implement `yarnInventoryOnEdit` hydration: `B3/F3` or `C3/E3` change → clear+fill only input ranges for `fecha+turno`; `H8:K17` + `G/P/Q/R` never touched `FORMULA` verbatim
- [x] 3.3 Enforce `fecha` native DATE (`getFullYear/getMonth/getDate` no `formatDate`) + audit `Utilities.formatDate(...,La_Paz)` only, invalid blocks that form no partial write

## Phase 4: Testing / Verification

- [x] 4.1 Create `apps-script/yarn-inventory/tests/yarn-inventory.test.gs` harness (no runner) — boundary untouched, PK rowIndex fallback, void re-activate, `creado` preserved, invalid block, lock `⏳→❌`, ≤10/≤47
- [x] 4.2 Verify on COPY `1RCupngk5x95ev5N4Zv0veMMbOhz6eH_9Vs44a1txE3s` only: `Guardar Todo` sequential ≤10+≤47 per `fecha+turno`, clearing→`void` re-adding→`active`, formulas recalc
- [x] 4.3 Final guard: grep no `getRange("` outside `Config.gs`, no file outside `apps-script/yarn-inventory/` changed, headers frozen

