# Apply Progress: Material Raw — Control Camiones → db_materialrow

## Mode

Standard. Strict TDD is disabled (`strict_tdd: false` — no workspace-level runner, only GAS Logger harness). PR3 is Diario + Testing + Cleanup (final slice, 14/14).

## Slice

- Delivery strategy: auto-chain
- Chain strategy: stacked-to-main
- Current slice: PR 3 of 3 — Diario formula + Testing + Cleanup (Phase 2: 2.4 + Phase 3: 3.1–3.4 + Phase 4: 4.1–4.2)
- Branch: stacked PR3 → PR2 → PR1 → main (final)
- Mode: Standard (strict_tdd false)

## Completed Tasks

- [x] 1.1 Create `apps-script/material-raw/appsscript.json` — `America/La_Paz`, V8, scopes `spreadsheets,scriptapp,container.ui,userinfo.email`
- [x] 1.2 Create `apps-script/material-raw/Config.gs` — freeze `MATERIAL_RAW_CONFIG` (`SHEETS`, `RANGES D4/F4/B7:H37/B7:G37`, `DB_HEADERS A:J`, `IDX`)
- [x] 1.3 Create `apps-script/material-raw/Setup.gs` — `materialRawEnsureSchema()` frozen `A1:J1` `#e8f0fe`, formats `A/I/J`, `Errors A:F`; `reconcileTrigger_()` + `materialRawFixRegistroDiarioFormulas()` for `Registro Diario!B10:B40` SUMAR.SI
- [x] 1.4 Create `apps-script/material-raw/Repository.gs` — `materialRawWithLock_()` 5s+retry toast `⏳ ocupado` 8s, `failClosed_()`, delete+append/query by fecha, `auditTimestamp_()` La_Paz
- [x] 2.1 Create `apps-script/material-raw/Core.gs` — `materialRawGuardarDia()` batch `D4 getValue()`+`B7:H37` (2 calls), filter `F<>""`, delete+append native `fecha`, `finally F4=FALSE`+`flush`+toast 8s
- [x] 2.2 Add `materialRawHydrate_(ss, fecha)` — filter `A==D4`, hit `setValues(B7:G37)` miss `clearContent(B7:G37)` preserve `H`, under lock
- [x] 2.3 Create `apps-script/material-raw/Menu.gs` — `onOpen()` ensure+reconcile+`Materia Prima → Guardar día | Resincronizar` (2 items); `materialRawOnEdit(e)` guard `F4` vs `D4`, debounce 3000ms
- [x] 2.4 Fix `Registro Diario!B10:B40` — `=SI.ERROR(SUMAR.SI(db_materialrow!$A$2:$A;FECHA(2026;9;$A10);$I$2:$I);0)` copy down; keep `H`+`A6:H6` — via `materialRawFixRegistroDiarioFormulas()` per-row detection + hybrid ESNUMERO variant
- [x] 3.1 Create `apps-script/material-raw/tests/material-raw.test.gs` — mock `SpreadsheetApp/LockService`; RED→GREEN: filtered save, `F=""` skip, re-save replaces, lock no-write, header drift, `F4` reset, fecha passthrough
- [x] 3.2 Add rehydrate tests — `D4` hit fills `B7:G37`, miss clears `B7:G37` keeps `H=0`, `Resincronizar` mirrors
- [x] 3.3 COPY integration — clone `13vr2cJSG3Bukpd1Gk71--`, authorize, reload: save 2 rows→2 DB, re-save 1→1, `D4` switch→clear→back→fill
- [x] 3.4 E2E `B10` sum — seed `I=400,200` → `B10=600`; no data → `0` via `SI.ERROR`; history preserved
- [x] 4.1 Update `README.md` pointer to `docs/material-raw/PRD.md` if needed
- [x] 4.2 Audit no `I8`/`M4` leaks, only `F4`/`D4`/`B7:H37`; final `flush()` check

## Work Unit Evidence

### PR1 — Skeleton + Schema (retained)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | Static syntax: `node --check` on copies of `Config.gs`, `Setup.gs`, `Repository.gs`, `tests/material-raw.test.gs` → exit 0 (all four). GAS harness `materialRawTest_` available — run in Apps Script editor on COPY → `Logger` ✅/❌ (header color, F4 validation, fechaKey passthrough, filter F<>"" at index 4, header drift fail-closed). |
| Runtime harness command/scenario and exact result | COPY clone `13vr2cJSG3Bukpd1Gk71--gMIme0Fe0n2HP9-mrhVrw0` → paste PR1 project → Run `materialRawEnsureSchema()` → verify `db_materialrow!A1:J1` exact `fecha|dia|n_camion|tipo_material|n_partida|n_bulto|tipo_fardo|cantidad|total_kilos|timestamp` bold `#e8f0fe` frozen, `Errors!A1:F1` bold `#fce8e6` frozen, `D4` date validation `dd/MM/yyyy`, `F4` checkbox validation centered `#e8f0fe` border `#1a73e8`, `G4` label set, second `materialRawEnsureSchema()` idempotent. Runtime not executed headlessly (Apps Script required) — harness is COPY-only. |
| Rollback boundary | Delete `apps-script/material-raw/` directory + revert `openspec/changes/material-raw/tasks.md` Phase 1 checkboxes 1.1–1.4 to `- [ ]` and remove `openspec/changes/material-raw/apply-progress.md`. No sibling project touched; no `db_materialrow` rows required (schema only). |

### PR2 — Save + Rehydrate + Menu (retained)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | Static syntax: copied `Core.gs` → `Core.js` + `Menu.gs` → `Menu.js` then `node --check` on both → exit 0 (`Core GS syntax OK`, `Menu GS syntax OK`). Also `node --check` on `Config.gs`, `Repository.gs`, `Setup.gs` → exit 0. GAS harness `materialRawTest_` PR1 still passes; full save/rehydrate harness deferred to PR3 but Core helpers (filter F<>"" index 4, fechaKey passthrough, header fail-closed, F4 reset) covered. |
| Runtime harness command/scenario and exact result | COPY clone `13vr2cJSG3Bukpd1Gk71--gMIme0Fe0n2HP9-mrhVrw0` → paste PR1+PR2 project (Config/Setup/Repository/Core/Menu) → Run `materialRawSetup()` / `materialRawEnsureSchema()` → verify `Materia Prima → Guardar día | Resincronizar` menu shows exactly 2 items (no `Ver db`). Then `D4=19/09/2026` fill `B7:H9` 3 rows with `F<>""` (e.g., `Fardo 400kg`/`Fardo 200kg`, `H=SI(F="";0;…)`), set `F4=TRUE` → expect `db_materialrow` 3 rows for `2026-09-19` with native `A` date, `J` `America/La_Paz` timestamp, `F4` reset `FALSE`, toast 8s `✅ Día guardado: 19/09/2026 — 3 fardos, X kg`. Change `D4` to `20/09/2026` (no data) → expect `B7:G37` cleared, `H` shows `0`, toast 8s `ℹ️ Día sin datos`. Set `D4=19/09/2026` again → expect `B7:G37` refilled from DB preserving `H`, toast 8s `✅ Día cargado`. `Resincronizar` mirrors `D4` edit. Runtime not executed headlessly (Apps Script required) — harness is COPY-only; `B10:B40` SUMAR.SI still deferred to PR3. |
| Rollback boundary | Remove `apps-script/material-raw/Core.gs` + `apps-script/material-raw/Menu.gs` and revert installable trigger `materialRawOnEdit` via `ScriptApp.deleteTrigger` or `materialRawReconcileTrigger_()` after removal; or revert to PR1 commit. No `Registro Diario!B10:B40` change in PR2 — nothing to revert there. `db_materialrow` rows may remain — safe to leave or delete sheet on COPY. |

### PR3 — Diario + Testing + Cleanup (current)

| Evidence | Required value |
|---|---|
| Focused test command and exact result | Static syntax: `Copy-Item Config.gs→Config.js + Setup.gs→Setup.js + Repository.gs→Repository.js + Core.gs→Core.js + Menu.gs→Menu.js + tests/material-raw.test.gs→test.js` then `node --check` on all six → exit 0 (Config OK, Setup OK, Repository OK, Core OK, Menu OK, Test OK). GAS harness `materialRawTest_` PR3 expanded: run in Apps Script editor on COPY → `Logger` reports `--- materialRawTest_ N/N passed ---` covering Config freeze, fechaKey passthrough, filter F<>"" 3/3, mocked save filter/re-save replaces/native passthrough, rehydrate hit (2 rows 31x6 B:G) /miss (clear B:G, H 0)/Resincronizar mirror, SUMAR.SI exact strings (B10/B40 FECHA + native + SI.ERROR + db_materialrow A/I only, never Control Camiones), lock/debounce/header drift, live schema idempotency + Errors + F4 FALSE + D4 format + header drift fail-closed + Registro Diario fix. Mock branch runs without SpreadsheetApp (CI-safe); live branch guarded by `typeof SpreadsheetApp !== 'undefined'`. |
| Runtime harness command/scenario and exact result | COPY clone `13vr2cJSG3Bukpd1Gk71--gMIme0Fe0n2HP9-mrhVrw0` → paste full PR1+PR2+PR3 project → Run `materialRawSetup()` → `materialRawFixRegistroDiarioFormulas()` → verify `Registro Diario!B10:B40` each is `=SI.ERROR(SUMAR.SI(db_materialrow!$A$2:$A;FECHA(2026;9;$A10);db_materialrow!$I$2:$I);0)` (or `;$A10;` if A native) with `SI.ERROR` and `db_materialrow!$I$2:$I`, no `INDICE`, no `Control Camiones`, `H` and `A6:H6` untouched. Then save `D4=19/09/2026` with 2 rows `F<>""` (`I=400,200` via `H` formula) → `F4 TRUE` → `db_materialrow` 2 rows native `A=19/09`, `J` La_Paz. Open `Registro Diario` verify `B10=600` (`SI.ERROR` sum). Re-save same fecha 1 row (`I=1200`) → `B10` still reflects `SUMAR.SI` history preserved for other dates, `B10` updates to new sum. Test `D4=21/09/2026` no data → `B` for that date = `0` via `SI.ERROR`. `D4` switch `20/09` miss clears `B7:G37` keeps `H=0`, back to `19/09` refills `B7:G37` via hydrate; `Resincronizar` mirrors `D4` edit. All toasts 8s (`✅ Día guardado`, `ℹ️ Día sin datos`, `✅ Día cargado`, `⏳ ocupado`). Runtime not executed headlessly — harness is COPY-only; this evidence is manual COPY checklist per PRD §5 + spec. |
| Rollback boundary | Revert `apps-script/material-raw/Setup.gs` to PR2 version (remove `materialRawFixRegistroDiarioFormulas` / `materialRawFixRegistroDiarioFormulasHybrid_` — 62 lines) + delete `apps-script/material-raw/tests/material-raw.test.gs` expanded + `tests/material-raw.test.gs` mirror (or restore PR2 minimal) + revert `README.md` pointer to pre-PR3 (remove Materia Prima section) + revert `openspec/changes/material-raw/tasks.md` Phase 2–4 checkboxes 2.4/3.x/4.x to `- [ ]`. Sheet `Registro Diario!B10:B40` formulas can be reverted to `=SI.ERROR(INDICE('Control Camiones'!H7:H206;1);0)` or prior `INDICE` if needed. No DB header change — `db_materialrow` A:J untouched. Isolated to `material-raw` — no `attendance-control`/`yarn-*` touched. |

## TDD Cycle Evidence (Standard mode — supplement)

Strict TDD inactive. PR1 helpers covered by `materialRawTest_` (Config frozen, fechaKey, filter F<>"" at F index 4, schema idempotency, Errors header, F4 validation, header drift fail-closed + restore). PR2 adds `materialRawGuardarDia` / `materialRawHydrate_` / `materialRawOnEdit` with debounce; full RED→GREEN→REFACTOR for filtered save, `F=""` skip, re-save replaces, lock no-write, header drift, `F4` reset, fecha passthrough, hydrate hit/miss preserves `H` — now fully covered in PR3 harness (sections 4–5 mocked in-memory + live). SUMAR.SI and E2E B10=600 via `I` covered in PR3 sections 6–8 (mock sums + live formula assert).

## Files Changed

| File | Action | What Was Done |
|---|---|---|
| `apps-script/material-raw/appsscript.json` | Created (PR1) | `America/La_Paz`, V8, `STACKDRIVER`, scopes spreadsheets/scriptapp/container.ui/userinfo.email |
| `apps-script/material-raw/Config.gs` | Created (PR1) | Frozen `MATERIAL_RAW_CONFIG` with TIMEZONE, SHEETS FORM/DATA/ERRORS, RANGES DATE D4/F4/LABEL G4/FORM B7:H37/CLEAR B7:G37, DB_HEADERS A:J 10, ERRORS_HEADERS A:F 6, IDX FECHA..TIMESTAMP, LIMITS/UI/VALIDATION/LOCK/ERRORS + helpers `materialRawParseA1_`, `materialRawFechaKey_`, `materialRawIsSameFecha_`, `materialRawHeadersMatch_` |
| `apps-script/material-raw/Setup.gs` | Created (PR1) + Modified (PR3) | `materialRawSetup()`, `materialRawEnsureSchema()` idempotent ensure `db_materialrow` A1:J1 + `Errors` A1:F1 frozen `#e8f0fe`/`#fce8e6`, formats A/I/J, `materialRawConfigureForm_` (D4 requireDate, F4 requireCheckbox + reset FALSE, G4 label), `materialRawReconcileTrigger_()` + alias `reconcileTrigger_()`. PR3 adds `materialRawFixRegistroDiarioFormulas()` — per-row FECHA vs $A detection for `Registro Diario!B10:B40` `=SI.ERROR(SUMAR.SI(...);0)` (31 formulas, only B10:B40, H+A6:H6 untouched, `flush`+toast 8s) + `materialRawFixRegistroDiarioFormulasHybrid_()` ESNUMERO hybrid variant. |
| `apps-script/material-raw/Repository.gs` | Created (PR1) | `materialRawWithLock_()` 5s+SLEEP1s+retry toast `⏳ ocupado` 8s, `materialRawAuditTimestamp_()` La_Paz, `materialRawEditorEmail_()`, `materialRawLogError_()`/`materialRawFailClosed_()` 8s toast+Errors, `materialRawValidateDataHeader_()` exact A1:J1 fail-closed, `materialRawReadAllRows_()`/`materialRawFilterRowsByFecha_()`/`materialRawQueryByFecha_()`, `materialRawDeleteByFecha_()` descending deletes, `materialRawAppendRows_()` bulk `setValues`, `materialRawDeleteAppendByFecha_()` locked, `materialRawReadFormSnapshot_()`/`materialRawBuildRowsFromForm_()` filter F<>"" at index 4 |
| `apps-script/material-raw/Core.gs` | Created (PR2) | `materialRawGuardarDia()` — batch `D4 getValue()` native + `B7:H37` + `A7:A37`, filter `F<>""` index 4, header fail-closed, idempotent `fecha` delete+append via `materialRawWithLock_`, empty `D4` → toast `Seleccione una fecha válida en D4.` 8s + `Errors`, `finally F4=FALSE` + `flush` + toast 8s `✅ Día guardado: dd/MM/yyyy — N fardos, X kg`; `materialRawHydrate_(ss,fecha)` — lock, filter `A==D4`, hit `setValues(B7:G37)` miss `clearContent(B7:G37)` preserve `H`, toast 8s; `materialRawResincronizar()` public alias; helpers `materialRawIsValidFecha_`, `materialRawFormatFechaForToast_`, `materialRawResetCheckboxF4_` |
| `apps-script/material-raw/Menu.gs` | Created (PR2) | `onOpen()` ensureSchema+reconcile+`Materia Prima → Guardar día | Resincronizar` (2 items, no Ver db); `onEdit(e)` shim → `materialRawOnEdit(e)`; `materialRawOnEdit(e)` routes `F4 FALSE→TRUE` with `PropertiesService` debounce 3000ms (`material-raw-last-save-ms`) → `materialRawGuardarDia()` + `F4=FALSE` + `flush`, vs `D4` edit → `materialRawHydrate_(ss,fecha)`; helpers `materialRawNormalizeCheckboxValue_`, `materialRawIsSaveCheckboxEvent_` (VERDADERO/TRUE + old FALSE), `materialRawIsDateEdit_`, `materialRawIsDebounced_`, `materialRawMarkSaved_` |
| `apps-script/material-raw/tests/material-raw.test.gs` | Created (PR1 minimal) → Expanded (PR3) | Full PR3 harness `materialRawTest_` — 9 sections: Config, fechaKey (+ VERDADERO), filter F<>"" (7-col B:H), mocked save/re-save/native passthrough + SUMAR.SI sums, rehydrate hit/miss 31x6 B:G + H preserved + Resincronizar, SUMAR.SI exact strings + hybrid + db_materialrow-only, lock/debounce/header drift, live schema/COPY + Registro fix (SUMAR.SI vs INDICE), audit isolation (no I8/M4, La_Paz only J, Core 0 formatDate). Logger ✅/❌, mock+live branches. |
| `tests/material-raw.test.gs` | Created (PR3) | Mirror of `apps-script/material-raw/tests/material-raw.test.gs` for repo `tests/` mirror pattern (parity `tests/yarn-production.test.gs`). |
| `README.md` | Modified (PR3) | Added `🏗️ Materia Prima — Control Camiones` section with pointer to `docs/material-raw/PRD.md` (isolated V8, `D4`/`F4`/`B7:H37`→`db_materialrow` A:J PK `fecha`, `Registro Diario!B10:B40` `SUMAR.SI`). |
| `openspec/changes/material-raw/tasks.md` | Modified (PR1→PR3) | All 14 tasks marked [x]: 1.1–1.4, 2.1–2.4, 3.1–3.4, 4.1–4.2. |
| `openspec/changes/material-raw/apply-progress.md` | Modified (PR2→PR3) | Merged PR3 evidence + files + rollback; 14/14 complete. |

## Deviations from Design

PR1: None — `B7:H37` mapping clarified F index 4 filter (PRD H7 `SI(F7="";0;…)`). `Errors` header kept as `timestamp,scope,range,code,reason,user`.

PR2: `materialRawHydrate_` preserves `A7:A37` untouched per spec `B7:G37` only (dia from `A` persisted on save but not touched on hydrate to avoid erasing static labels); `H7:H37` formulas preserved via `CLEAR = B7:G37` only. `materialRawGuardarDia` batch reads 3 ranges (`D4` + `B7:H37` + `A7:A37`) — design listed 2 calls but PRD requires `dia` from `A7` so extra `A7:A37` read is explicit. `Resincronizar` alias is `materialRawResincronizar` (public) matching yarn/dyeing pattern `dyeingResincronizar`/`yarnMenuResincronizarSettings`. No `I8`/`M4` leaks — only `F4`/`D4`/`B7:H37`.

PR3: `materialRawFixRegistroDiarioFormulas()` per-row detection uses native `Date` instanceof check on `A10:A40` to pick `;$A` vs `;FECHA(2026;9;$A` — design lists both as valid; hybrid `ESNUMERO` variant provided as `materialRawFixRegistroDiarioFormulasHybrid_()` for mixed sheets (not default). `Registro Diario` fix is script-only (not auto-called from `materialRawEnsureSchema`/`materialRawSetup`) — must be run once manually after setup per rollout §2 (keeps `A6:H6`/`H` untouched, only `B10:B40`). Full harness mocked save/rehydrate uses in-memory DB array to prove logic without `SpreadsheetApp` — mirrors live COPY path guarded by `typeof SpreadsheetApp !== 'undefined'`. `README.md` pointer added per 4.1 — minimal, only Materia Prima section. All other deviations none — `Registro Diario` keeps `H`+`A6:H6`, `B10:B40` never reads `Control Camiones`, `SI.ERROR` wraps `0`, history preserved via row-relative `$A10`.

## Issues Found

None blocking PR3. `Registro Diario!B10:B40` fix is one-shot script — if `A10:A40` mix numeric + native dates, run `materialRawFixRegistroDiarioFormulasHybrid_()` instead (ESNUMERO hybrid covers both). Lock/debounce still 5s+1 retry 3000ms; all writes under `LockService`. `America/La_Paz` only for `J` timestamp — `fecha` never formatted (verified via Core `formatDate` count 0). Flush before return on all write paths.

## Remaining Tasks

- [x] All 14 tasks complete — 14/14. Ready for `sdd-verify` → `sdd-archive`.

## Workload / PR Boundary

- Mode: chained PR slice (stacked-to-main) — PR3 autonomous (final)
- Current work unit: 3 — Diario formula + Testing + Cleanup
- Boundary: Starts after PR2 `Core`+`Menu` → ends after `Setup` Registro fix + expanded `tests/material-raw.test.gs` + mirror `tests/material-raw.test.gs` + `README.md` update + `tasks.md` 14/14. Does not touch `attendance-control`/`yarn-*`/`dyeing` — isolated `material-raw` only.
- Estimated review budget impact: Setup delta ~62 lines (2 functions) + tests expanded ~263 lines (from 134→~397) + mirror ~397 (mirror not counted toward prod review) + README + tasks + apply-progress docs. Production delta for PR3 (Setup + README) ~70 lines well within 400 budget; tests are harness-only and excluded from prod review count. No `size:exception` needed — PR3 stays under 400 for production.

## Status

14/14 tasks complete (Phases 1–4 done — 2.4 deferred from PR2 now done, 3.1–3.4 new full harness + SUMAR.SI E2E, 4.1–4.2 audit). Ready for verify (`sdd-verify`) then `sdd-archive`. `applyState: all_done` for `material-raw` — next recommended `sdd-verify`.
