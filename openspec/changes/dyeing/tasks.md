# Tasks: Dyeing (Teñido)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 750–900 (9 files) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 Config → PR2 Ingest/Persist → PR3 Core/Menu/Harness |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Config SSOT | PR1 | `dyeing.test.gs` Config→Logger | COPY `dyeingSetup()`→`A:AD`+`G4` | `Config.gs` `appsscript.json` `Errors.gs` |
| 2 | Typed ingest+upsert | PR2 | typed `H/S:V` vs `@`→Logger | COPY `C3+B6:E15/B18:E25`→`guardarLote()` | `Ingest.gs` `Persistence.gs` |
| 3 | Core/Menu/E2E | PR3 | lock/debounce/hydrate→Logger | COPY `G4`3s+`Guardar/Re-sincronizar` | `Core.gs` `Menu.gs` `Setup.gs` `tests/dyeing.test.gs` |

## Phase 1: Config

- [ ] 1.1 Create `apps-script/dyeing/appsscript.json` La_Paz V8 — G:install W:load T:La_Paz; Verify:reload ok; Dep:none
- [ ] 1.2 Create `apps-script/dyeing/Config.gs` `DYEING_CONFIG` `C3/G4/B6:E15/B18:E25/A1:AD1` 30col `A:AD` — G:missing W:ensure T:`A:AD`+`G4 FALSE`; Verify:delete→ensure AD; Dep:1.1
- [ ] 1.3 Create `apps-script/dyeing/Errors.gs` `dyeingLogError_` La_Paz — G:`C3=""` W:log T:`Errors` row; Verify:empty→Errors; Dep:1.2

## Phase 2: Persistence

- [ ] 2.1 Create `apps-script/dyeing/Ingest.gs` batch `C3+B6:E15+B18:E25` — G:`E11=60` `E12="@ 24/1"` W:read T:`H/S:V` NUMBER else STRING `@`/passthrough; Verify:types; Dep:1.2
- [ ] 2.2 Create `apps-script/dyeing/Persistence.gs` Map `A→row` upsert `H/S:V 0.00` — G:`A=C3` exists W:upsert T:`B:Y` overwrite preserve `Z` all-empty→`void`; Verify:LT-042 x2→1 row; Dep:2.1

## Phase 3: Core

- [ ] 3.1 Create `apps-script/dyeing/Core.gs` `guardarLote()` guard `trim(C3)` — G:`C3=""` W:save T:block `⚠️ Ingresá ID Lote` reset `G4`; partial ok; Verify:empty vs partial; Dep:2.2
- [ ] 3.2 Extend `apps-script/dyeing/Core.gs` `LockService` 5s+retry audit La_Paz `Z/AA/AB` — G:concurrent W:lock T:serialize or `❌ Error — usá Re-sincronizar`; Verify:hold→block; Dep:3.1
- [ ] 3.3 Add `dyeingHydrate_()` in `apps-script/dyeing/Core.gs` Re-sincronizar — G:`LT-042` exists W:hydrate T:`B6:E15+B18:E25`; missing→`— sin registros` empty→`⚠️` no auto; Verify:3 cases; Dep:3.2

## Phase 4: Menu/Setup

- [ ] 4.1 Create `apps-script/dyeing/Menu.gs` `onOpen` `Teñido → Guardar|Re-sincronizar` + `dyeingOnEdit` `G4` debounce 3000 `PropertiesService`→`G4=FALSE` — G:double-tap <3s W:second `TRUE` T:ignore `⏳`; Verify:1s apart 1 write; Dep:3.3
- [ ] 4.2 Create `apps-script/dyeing/Setup.gs` `dyeingSetup()` trigger+`A:AD` fix — G:install W:setup T:trigger exists; Verify:remove→setup exists; Dep:4.1
- [ ] 4.3 Wire toasts `✅ Guardado: {ID} — {Color} {Código} por {user}` in `apps-script/dyeing/Core.gs` — G:success/fail W:save T:correct toast; Verify:both; Dep:4.2

## Phase 5: Harness

- [ ] 5.1 Create `apps-script/dyeing/tests/dyeing.test.gs` Logger `dyeingTestHelpers_` — G:helpers W:run T:trim/typed/debounce/void ✅; Verify:Run→Logger ✅; Dep:4.3
- [ ] 5.2 E2E COPY two-times fill — G:day1 Teñido save Re-sync day3 Muestra W:save T:same row `H/S:V` NUMBER `E12 @` `creado` preserved `items`/`G4` untouched; Verify:full flow; Dep:5.1
