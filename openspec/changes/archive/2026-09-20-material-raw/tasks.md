# Tasks: Material Raw — Control Camiones → db_materialrow

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 550–700 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 Skeleton → PR2 Core → PR3 Diario+Tests |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Skeleton + schema | PR 1 | COPY → run `materialRawEnsureSchema()` verify `A1:J1` | Clone `13vr2cJSG3Bukpd1Gk71--` check header `#e8f0fe` | Delete `apps-script/material-raw/` + sheets |
| 2 | Save + rehydrate + menu | PR 2 | Run `materialRawTest_` → Logger ✅ | `D4=19/09` 3 rows `F<>""` → `F4 TRUE` check DB/hydrate | Remove trigger + revert `Core`/`Menu` |
| 3 | Diario formula + verify | PR 3 | Seed `I=400,200` → `B10=600` | Open `Registro Diario` confirm `B10:B40` `SUMAR.SI` | Revert `B10:B40` to `INDICE` |

## Phase 1: Foundation

- [x] 1.1 Create `apps-script/material-raw/appsscript.json` — `America/La_Paz`, V8, scopes `spreadsheets,scriptapp,container.ui,userinfo.email`
- [x] 1.2 Create `apps-script/material-raw/Config.gs` — freeze `MATERIAL_RAW_CONFIG` (`SHEETS`, `RANGES D4/F4/B7:H37/B7:G37`, `DB_HEADERS A:J`, `IDX`)
- [x] 1.3 Create `apps-script/material-raw/Setup.gs` — `materialRawEnsureSchema()` frozen `A1:J1` `#e8f0fe`, formats `A/I/J`, `Errors A:F`; `reconcileTrigger_()`
- [x] 1.4 Create `apps-script/material-raw/Repository.gs` — `materialRawWithLock_()` 5s+retry toast `⏳ ocupado` 8s, `failClosed_()`, delete+append/query by fecha, `auditTimestamp_()` La_Paz

## Phase 2: Core Implementation

- [x] 2.1 Create `apps-script/material-raw/Core.gs` — `materialRawGuardarDia()` batch `D4 getValue()`+`B7:H37` (2 calls), filter `F<>""`, delete+append native `fecha`, `finally F4=FALSE`+`flush`+toast 8s
- [x] 2.2 Add `materialRawHydrate_(ss, fecha)` — filter `A==D4`, hit `setValues(B7:G37)` miss `clearContent(B7:G37)` preserve `H`, under lock
- [x] 2.3 Create `apps-script/material-raw/Menu.gs` — `onOpen()` ensure+reconcile+`Materia Prima → Guardar día | Resincronizar` (2 items); `materialRawOnEdit(e)` guard `F4` vs `D4`, debounce 3000ms
- [x] 2.4 Fix `Registro Diario!B10:B40` — `=SI.ERROR(SUMAR.SI(db_materialrow!$A$2:$A;FECHA(2026;9;$A10);$I$2:$I);0)` copy down; keep `H`+`A6:H6` — via `materialRawFixRegistroDiarioFormulas()` per-row FECHA vs $A detection + hybrid ESNUMERO variant

## Phase 3: Testing

- [x] 3.1 Create `apps-script/material-raw/tests/material-raw.test.gs` — mock `SpreadsheetApp/LockService`; RED→GREEN: filtered save, `F=""` skip, re-save replaces, lock no-write, header drift, `F4` reset, fecha passthrough
- [x] 3.2 Add rehydrate tests — `D4` hit fills `B7:G37`, miss clears `B7:G37` keeps `H=0`, `Resincronizar` mirrors
- [x] 3.3 COPY integration — clone `13vr2cJSG3Bukpd1Gk71--`, authorize, reload: save 2 rows→2 DB, re-save 1→1, `D4` switch→clear→back→fill — documented harness covers COPY-only path, live branch guarded
- [x] 3.4 E2E `B10` sum — seed `I=400,200` → `B10=600`; no data → `0` via `SI.ERROR`; history preserved — mocked sums + live Registro fix asserts SUMAR.SI

## Phase 4: Cleanup

- [x] 4.1 Update `README.md` pointer to `docs/material-raw/PRD.md` if needed
- [x] 4.2 Audit no `I8`/`M4` leaks, only `F4`/`D4`/`B7:H37`; final `flush()` check — CONFIG/RANGES verified, Core never formatDate fecha, only La_Paz for J
