```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:2d1b2808f565fb56757beb603ceca3fe93205e831397dd905789311b804c461d
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 5/5
scenarios: 11/11
test_command: "pwsh Select-String getRange formatDate getFullYear guards plus harness inspection yarn-inventory.test.gs 14 tests"
test_exit_code: 0
test_output_hash: sha256:473c84e6d1ef467750177ebca3369c522f66c82c439880ca7f9b49b4bf960301
build_command: "pwsh Copy-Item gs to js plus node --check for 7 files Config Errors Repository Ingest Persistence Menu tests"
build_exit_code: 0
build_output_hash: sha256:fc1aa0894fa1e28029630ba8d26aa2f61bb03502d8b1ba098c4f7c5bcf498e52
```

## Verification Report

**Change**: yarn-inventory
**Version**: PRD docs/yarn-inventory/PRD.md v0.2.0 / spec yarn-inventory-recording v1
**Mode**: Standard (strict_tdd: false, runner: none — GAS Logger harness + manual COPY evidence)
**Artifact store**: both (openspec file + Engram)
**Spec source**: openspec/changes/yarn-inventory/specs/yarn-inventory-recording/spec.md (5 requirements, 11 scenarios)
**Design source**: openspec/changes/yarn-inventory/design.md
**Tasks source**: openspec/changes/yarn-inventory/tasks.md (13/13) + apply-progress.md
**Implementation**: apps-script/yarn-inventory/ (appsscript.json, Config.gs, Repository.gs, Ingest.gs, Persistence.gs, Menu.gs, Errors.gs, tests/yarn-inventory.test.gs)

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 13 |
| Tasks complete | 13 |
| Tasks incomplete | 0 |
| Phases | 1.1-1.3 Foundation ✅, 2.1-2.4 Core ✅, 3.1-3.3 Integration ✅, 4.1-4.3 Testing/Verification ✅ |

All 13 tasks checked in tasks.md and apply-progress.md. PR1 (304 lines scaffold SSOT+Errors), PR2 (693 lines Repository+Ingest+Persistence+Lock — size:exception noted, chained), PR3 (348 lines Menu hydration + 14-test harness — within 400-line budget) delivered stacked-to-main. No pending task blocks verification.

### Build & Tests Execution
**Build**: ✅ Passed
```text
Copy .gs -> .js + node --check — 7/7 files exit 0:
  apps-script/yarn-inventory/Config.gs -> exit 0
  apps-script/yarn-inventory/Errors.gs -> exit 0
  apps-script/yarn-inventory/Repository.gs -> exit 0
  apps-script/yarn-inventory/Ingest.gs -> exit 0
  apps-script/yarn-inventory/Persistence.gs -> exit 0
  apps-script/yarn-inventory/Menu.gs -> exit 0
  apps-script/yarn-inventory/tests/yarn-inventory.test.gs -> exit 0
Build command: pwsh Copy-Item gs to js plus node --check for 7 files Config Errors Repository Ingest Persistence Menu tests
Build exit code: 0
Build output hash: sha256:fc1aa0894fa1e28029630ba8d26aa2f61bb03502d8b1ba098c4f7c5bcf498e52
```

**Tests**: ✅ 14 harness tests defined / ⚠️ runtime Logger not executed by this executor (manual COPY required) / ✅ static guards passed
```text
Test command: pwsh Select-String getRange formatDate getFullYear guards plus harness inspection yarn-inventory.test.gs 14 tests
Test exit code: 0 (static guards)
Test output hash: sha256:473c84e6d1ef467750177ebca3369c522f66c82c439880ca7f9b49b4bf960301

Guard results:
  Select-String getRange literal -> 0 literal hits outside Config.gs (only 2 doc comments Config.gs:6 Menu.gs:12, no code literal) — PASS
  Select-String formatDate -> 1 hit only Errors.gs:20 via YARN_INVENTORY_CONFIG.TIMEZONE (audit); Ingest/Persistence/Menu/Repository zero — PASS (fecha native, audit La_Paz only)
  Select-String getFullYear|getMonth|getDate -> only Config.gs yarnInventoryDateKey_ (fecha native) — PASS
  Headers: MADEJERAS 17 A:Q, LOTES 24 A:X, LIMITS 10/47/52, IDX 0..16/23 — PASS via yarnInventoryTestHeadersFrozen_
  Isolation: no refs to attendance-control/yarn-production/yarn-settings — PASS
  appsscript.json: timeZone America/La_Paz, runtime V8, scopes spreadsheets/scriptapp/container.ui/userinfo.email — PASS

Harness yarn-inventory.test.gs: 14 tests (code inspection — each maps to spec scenarios):
  yarnInventoryTestConfigFrozen_, yarnInventoryTestHeadersFrozen_, yarnInventoryTestBoundaryNeverPersisted_, yarnInventoryTestFechaNative_,
  yarnInventoryTestLimits_, yarnInventoryTestMadejerasPkAndLimits_, yarnInventoryTestLotesPkRowFallbackAndLastWins_,
  yarnInventoryTestVoidSoftDeleteAndReactivate_, yarnInventoryTestCreadoPreserved_, yarnInventoryTestInvalidBlocksForm_,
  yarnInventoryTestLockExhaustion_, yarnInventoryTestHydrationInputOnly_, yarnInventoryTestParseHelpers_, yarnInventoryTestMenuGuards_
  Entry yarnInventoryRunTests_ -> Logger 14/14 (aliases yarnInventoryTest_/yarnTestHelpers_) — defined, not executed in this workspace (GAS editor required).

COPY evidence (apply-progress Verification Notes): workbook COPY 1RCupngk5x95ev5N4Zv0veMMbOhz6eH_9Vs44a1txE3s not available to this executor (no authenticated SpreadsheetApp); steps documented as not run: same harness limitation; manual run in editor required — PR1 Re-sincronizar headers, PR2 fill 4+5 rows Guardar, PR3 hydration fecha+turno input-only + Todo sequential + lock busy->error + invalid warning -> Errors. Requires manual execution: select yarnInventoryRunTests_ -> Run -> Logger 14/14 plus COPY fill->Guardar->verify A:Q/A:X before merge.
```

**Coverage**: ➖ Not available (GAS harness has no coverage tool; threshold 0 per openspec/config.yaml verify.coverage_threshold) → N/A — file-scoped correctness via harness + batch range guards.

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Single Config SSOT and Formula Boundary | Boundary enforced — only C8:G17 / A6:F52+H6:O52 batched, formulas never touched | tests/yarn-inventory.test.gs > yarnInventoryTestBoundaryNeverPersisted_ + yarnInventoryTestHydrationInputOnly_ + Ingest.gs:ReadMadejerasSnapshot_(C8:G17) + Menu.gs:ClearMadejerasInputs_(C8:G17) | ✅ COMPLIANT |
| Single Config SSOT and Formula Boundary | Scattered address fails verification — H8 outside Config -> fail | tests/yarn-inventory.test.gs > yarnInventoryTestBoundaryNeverPersisted_ + Config.gs:YARN_INVENTORY_CONFIG.RANGES.MADEJERAS_FORMULAS='H8:K17' + grep guard 0 literal getRange outside Config | ✅ COMPLIANT |
| Fecha+Turno Filter Hydration | Hydrate existing shift 2026-09-10 + Turno Dia -> inputs repopulate, formulas untouched | tests/yarn-inventory.test.gs > yarnInventoryTestHydrationInputOnly_ + Menu.gs:yarnInventoryHydrateMadejerasByFilter_ / yarnInventoryHydrateMadejeras_ (clear C8:G17 then setValues matrix 10x5, H8:K17 never touched) | ✅ COMPLIANT |
| Fecha+Turno Filter Hydration | No rows for filter 2026-09-11 Dia -> inputs cleared, formulas untouched | tests/yarn-inventory.test.gs > yarnInventoryTestHydrationInputOnly_ + Menu.gs:yarnInventoryHydrateMadejeras_ (clear then matches.length==0 -> toast Nuevo turno, no fill) + yarnInventoryHydrateLotes_ same | ✅ COMPLIANT |
| Explicit Validated Batch Upsert and Audit | Upsert preserves creado — PK exists creado 08:00 resaved -> creado unchanged | tests/yarn-inventory.test.gs > yarnInventoryTestCreadoPreserved_ + Persistence.gs:yarnInventoryBuildMadejerasPlan_ creado preserved, BuildLotesPlan_ same | ✅ COMPLIANT |
| Explicit Validated Batch Upsert and Audit | Invalid header blocks form — F3 Invalido -> no writes, Errors logged | tests/yarn-inventory.test.gs > yarnInventoryTestInvalidBlocksForm_ + Ingest.gs:ReadMadejerasSnapshot_ valid=false errorCode invalid_turno + Persistence guarda bloquea | ✅ COMPLIANT |
| Explicit Validated Batch Upsert and Audit | Empty lote_id fallback — two empty rows at 6 and 7 -> row6 and row7 | tests/yarn-inventory.test.gs > yarnInventoryTestLotesPkRowFallbackAndLastWins_ (empty row6/row7 fallback ids) + Persistence.gs:yarnInventoryLotesId_ row fallback | ✅ COMPLIANT |
| Void Soft-Delete and Idempotent Re-activation | Soft-delete — PK active objetivo_neto cleared then saved -> void with fresh audit | tests/yarn-inventory.test.gs > yarnInventoryTestVoidSoftDeleteAndReactivate_ (empty snapshot void plan) + Persistence.gs:BuildMadejerasPlan_/BuildLotesPlan_ void branch (estado void, actualizado/editado_por refreshed) | ✅ COMPLIANT |
| Void Soft-Delete and Idempotent Re-activation | Re-activate — PK void inputs refilled and saved -> active without duplication | tests/yarn-inventory.test.gs > yarnInventoryTestVoidSoftDeleteAndReactivate_ (refill -> active) + Persistence.gs: void->active (estado active, creado preserved) | ✅ COMPLIANT |
| Concurrency-Safe Save and Observability | Concurrent serialize — two saves same fecha+turno -> serialize or retry once and log, no dup PKs | tests/yarn-inventory.test.gs > yarnInventoryTestLockExhaustion_ (tryLock 2x) + Persistence.gs:yarnInventoryAcquireLock_ tryLock(5000)+sleep+retry + guardarMadejeras/Lotes/Todo single DocumentLock | ✅ COMPLIANT |
| Concurrency-Safe Save and Observability | Partial Guardar Todo — db_madejeras succeeds, db_lotes lock fails -> madejeras persists, partial warning + Errors | tests/yarn-inventory.test.gs > yarnInventoryTestLimits_ + Menu guards + Persistence.gs:guardarTodo sequential madejeras->lotes, partial toast, Errors partial_save log | ✅ COMPLIANT |

**Compliance summary**: 11/11 scenarios compliant (5/5 requirements). All via harness code + static batch/formula/lock evidence; runtime Logger + COPY manual pending (see WARNING).

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|-------------|--------|-------|
| Single Config SSOT and Formula Boundary | ✅ Implemented | YARN_INVENTORY_CONFIG frozen (SHEETS 5, RANGES 10+ frozen FORMULAS/PARTS, HEADERS 17/24, IDX 0..16/23, LIMITS 10/47/52/1002, TURNO/SUP/INV lists). All reads/writes via yarnInventoryGetRange_+ParseA1/Range + numeric getRange(2,1,last-1,w). Grep 0 literal getRange outside Config docs. Formulas H8:K17 (H=IF(D>0,C/D,0) I=H*E J=IF(F>0,I/F,0) K=IF(G>0,I/G,0)) and lotes G6:G52/P6:P52/Q6:Q52/R6:R52 in Config only, never in Ingest/Menu/Persistence. Input-only: C8:G17 (3,8->7,17) vs H8:K17 non-overlap verified (mi.c2 < mf.c1), A6:F52 vs G vs H:O vs P verified. |
| Fecha+Turno Filter Hydration | ✅ Implemented | B3/F3 (Turno Dia/Tarde/Noche) and C3/E3 (Dia/Tarde/Noche) are filters. IsMadejerasFilterEdit checks B3 (2,3) or F3 (3,6); IsLotesFilterEdit checks C3 (3,3) or E3 (3,5). Hydrate reads fechaKey via yarnInventoryDateKey_ (native Date getFullYear/Month/Date, no formatDate) + turno CI via isInListCI_; invalid returns without clear (blocks that form, no partial). ClearMadejerasInputs clears 1 range C8:G17; ClearLotesInputs clears 2 ranges A6:F52 + H6:O52 — flush then fill. Fill filters estado=active + fechaKey+turno CI, builds 10x5 matrix and 47x6+47x8 matrices mapped by rango_origen row, setValues in 1-2 batches. Formulas never cleared/written. |
| Explicit Validated Batch Upsert and Audit | ✅ Implemented | Ingest: ReadMadejeras/LotesSnapshot_ read only B3/F3/B4/F4 + C8:G17 / C3/E3/G3/I3 + A6:F52/H6:O52 via Config; trim/CI validate DATE + turno/sup/inv vs TURNO lists; eligibility madejeras titulo_base+cabos numeric else skip, lotes objetivo_neto null skip; maxRows min(inputsA.length, LOTES_PER_DAY 47) ignores >52. Persistence: BuildMadejerasPlan PK yyyy-MM-dd-turno-maquina-lado (Maquina 1..5 x A/B), BuildLotesPlan PK fecha-turno-lote_id or row6..52 fallback last-wins norm map with warning toast; void->active, creado preserved, fecha Date at noon, actualizado/editado_por America/La_Paz only (Errors formatDate audit). guardarMadejeras/Lotes/Todo validate invalid blocks that form (toast, log Errors, no write); sequential Todo partial not rolled back, idempotent. Headers frozen A:Q 17 / A:X 24 checked. |
| Void Soft-Delete and Idempotent Re-activation | ✅ Implemented | BuildMadejerasPlan/LotesPlan void branch: for same fecha+turno existing PKs not in snapshotById (active) -> push plan with isVoid, voidValues = data.slice(), actualizado=timestamp, editado_por=editor, estado=void (creado preserved). Re-adding eligible row flips void->active via normal upsert path (same id lookup, creado from void data, estado active). void rows remain queryable via LoadState. Tests cover empty->void + refill->active. |
| Concurrency-Safe Save and Observability | ✅ Implemented | Every save acquires LockService.getDocumentLock() via yarnInventoryAcquireLock_ (tryLock 5000 + sleep 1000 + tryLock 5000 — 5s+1 retry). Exhaustion -> yarnInventoryLogError lock_timeout + toast busy->error, writes nothing. guardarTodo single lock sequential madejeras->lotes (one DocumentLock). Partial success not rolled back, failure logged partial_save, retry idempotent (PK upsert). Success toasts Guardado with fecha turno N madejeras M lotes por user. Observability Errors A:F via LogError_ never throw, missing db_* created via EnsureSchema with frozen header + protection. appsscript.json America/La_Paz isolated. |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Single Config SSOT (Frozen YARN_INVENTORY_CONFIG + ParseA1/Range + SHEETS/RANGES/HEADERS/IDX/LIMITS) | ✅ Yes | Config.gs 261 lines frozen nested; scattered getRange absent (0 literal hits). All 23 yarnInventoryGetRange_ calls go through Config. Verifiable SSOT matches design Interfaces table. |
| Input-only persistence (C8:G17 + A6:F52/H6:O52 only; H8:K17/G/P/Q/R never read/written/cleared, verbatim IF/SUM) | ✅ Yes | Ingest reads only inputs via RANGES.MADEJERAS_INPUTS etc; Menu clear/hydrate only inputs; Persistence DB cols 17/24 no formula columns; valueRenderOption=FORMULA verbatim per PRD. Non-overlap asserted in Boundary test. |
| 2 DBs vs 1 union (db_madejeras <=10/d + db_lotes <=47/d, independent PKs) | ✅ Yes | Repository LoadState batch getRange(2,1,last-1,w) with DB_MADEJERAS_COLUMNS 17 / DB_LOTES_COLUMNS 24; PKs as designed. No union. Storage ~20.8k rows/yr <10M cells. |
| Save trigger and concurrency (menu-only tryLock 5000+1 retry, sequential Todo, no checkbox/debounce) | ✅ Yes | Menu.gs Inventario menu (Guardar Madejeras/Lotes/Todo + Ver db_* + Re-sincronizar), onOpen/onEdit delegation, no M4/I8 checkbox. Persistence single lock per save, guardarTodo sequential madejeras->lotes, partial not rolled back. Matches PRD FR-003/FR-008. |
| Fecha timezone (native DATE as-is; La_Paz only creado/actualizado) | ✅ Yes | yarnInventoryDateKey_ uses getFullYear/getMonth/getDate (no formatDate on fecha); DateFromKey_ noon Date avoids TZ shift; formatDate only Errors.gs:20 via YARN_INVENTORY_CONFIG.TIMEZONE audit (verified grep). Repository keeps Date objects, Batch loads preserve fecha as Date. |

### Issues Found
**CRITICAL**: None — all 13 tasks complete, no literal A1 outside Config, no cross-project mutation, headers frozen, fecha native vs audit isolated, single lock per save, input-only boundary enforced, PKs void/last-wins correct.

**WARNING**:
- W1 — Runtime Logger + COPY not executed by this executor (no authenticated GAS/SpreadsheetApp). Harness yarn-inventory.test.gs 14 tests exist and pass code inspection, but require manual run: Apps Script editor select yarnInventoryRunTests_ -> Run -> Logger 14/14; plus COPY 1RCupngk5x95ev5N4Zv0veMMbOhz6eH_9Vs44a1txE3s manual steps (fill 4+5 rows -> Guardar Madejeras/Lotes/Todo -> verify A:Q/A:X batch <=10/<=47 per fecha+turno, last-wins, clearing->void re-adding->active, formulas recalc, invalid ->Errors, lock busy->error). Must complete before merge — apply-progress notes this as pending. Static guards + inspection are strong evidence but not GAS runtime.
- W2 — PR2 size:exception (693 lines) already recorded in apply-progress — chained PR2 exceeded 400-line budget; PR3 is within budget (348) and cohesive. Not a new issue but carry-forward.
- W3 — apply-progress and tasks.md show M on git status (tasks/apply-progress modified) and untracked docs/inventory/yarn-inventory.xlsx + docs/yarn-inventory/PRD.md + design/proposal/specs — they are declared scope per PRD 4-10 and SDD change docs, not isolation violation, but reviewer should confirm docs/inventory fixture is intended untracked.

**SUGGESTION**:
- S1 — Consider adding explicit guard for tipo_orden invalid CI in Ingest (currently typed but not blocking snapshot); align with PRD FR-011 if strict blocking desired.
- S2 — Hydration toast strings are Spanish UX; ensure consistent voseo (Selecciona) already matched — no action, just preserve.
- S3 — Add apps-script/yarn-inventory/.clasp.json ignore check to ensure no accidental clasp push from wrong project root.

### Verdict
PASS WITH WARNINGS — implementation matches spec/design/tasks: input-only C8:G17 / A6:F52+H6:O52 vs H8:K17 / G/P/Q/R never persisted/cleared/written, PKs fecha+turno+maquina/lado and fecha+turno+lote_id->row fallback with last-wins, filter fecha+turno fecha native DATE America/La_Paz only audit, single LockService 5s+1 retry sequential Todo partial not rolled back, headers frozen 17/24, grep 0 literal getRange outside Config, isolation to apps-script/yarn-inventory/. Runtime Logger/COPY manual pending before merge (W1) and PR2 size:exception noted — no CRITICAL blockers.