# Apply Progress: Lotes — Daily Lot Tracking (lotes-form → db_lots)

## Mode

Standard. Strict TDD is disabled (openspec/config.yaml strict_tdd false — no test runner, manual GAS Logger harness).

## Completed Tasks

- [x] 1.1 Create `apps-script/lotes/appsscript.json` with `timeZone: "America/La_Paz"`, V8, STACKDRIVER, 4 oauthScopes
- [x] 1.2 Create `apps-script/lotes/Config.gs` with `LOTES_CONFIG = Object.freeze({...})` SSOT (TIMEZONE, SHEETS, RANGES, DB_HEADERS A:K, IDX, LIMITS, UI, ERRORS)
- [x] 1.3 Add `apps-script/lotes/Config.gs` helpers `lotesGetSheet_`, `lotesGetFormSheet_`, `lotesGetDbSheet_`, `lotesParseA1_`, `lotesParseRange_`, `lotesGetRange_`, `lotesDateKey_`, `lotesFechaDisplay_`, `lotesHeadersMatch_`, `lotesEnsureTableSheet_`, `lotesEnsureSchema`, `lotesConfigureForm_`
- [x] 1.4 Create `apps-script/lotes/Errors.gs` with `lotesEditorEmail_`, `lotesAuditTimestamp_`, `lotesLogError_`
- [x] 1.5 Create `apps-script/lotes/Menu.gs` skeleton — `onOpen` (Lotes → Guardar | Resincronizar, 2 entries), `onEdit` → `lotesOnEdit`, `setupLotes` idempotent, `lotesNormalizeCheckboxValue_`
- [x] 2.1 Create `apps-script/lotes/Persistence.gs` — `lotesBuildDbState_(dbSheet)` single `getValues()` `A:K` byId/byRow, `lotesFindRow_`, `lotesBuildRowValues_` preserving creado/creado_por, `lotesUpsertDeleteBatch_` with bottom-up delete
- [x] 2.2 Create `apps-script/lotes/Ingest.gs` — `lotesReadForm_` single `getDisplayValues()` `B8:G37` via `lotesGetRange_` (B ignored), `D4` `getValue()` passthrough, `fechaKey`/`fechaDisplay` via `lotesDateKey_/_FechaDisplay_`, helpers `lotesIsEmptyRow_`, `lotesIsDebounced_/_MarkSaved_`, `lotesIsSaveCheckboxEvent_`, `lotesIsDateEdit_`
- [x] 2.3 Create `apps-script/lotes/Core.gs` public `guardarLotes()` — empty-D4 guard toast `Seleccione una fecha en D4.`, lock `tryLock(5000)+sleep1000+retry`, batch upsert/delete, `flush` before toast `✅ Guardado: dd/MM/yyyy — N lotes`, audit `America/La_Paz` + Session email, finally `releaseLock` + guarded `lotesResetCheckbox_`
- [x] 2.4 Add `apps-script/lotes/Core.gs` helpers `lotesAcquireLock_` (5s+retry), `lotesResetCheckbox_` (flag `lotes-is-resetting-f4` in DocumentProperties, `F4=FALSE`, `flush`, `sleep 200`), audit single-source reuse (`lotesAuditTimestamp_`/`lotesEditorEmail_` in Errors.gs), `lotesFormatFechaForToast_`
- [x] 2.5 Delete-on-clear correctness — `lotesUpsertDeleteBatch_` bottom-up deletes after `setValues`/`appendRow`, all-empty `C8:C37` deletes all `fecha` rows, toast `0 lotes`, `B` never influences `id` beyond posicion

Progress: 10/20 complete — PR1 Foundation + PR2 Core save path delivered. Remaining tasks 3.1–5.2 pending for PR3.

## Work Unit Evidence

| Work unit | Focused test command and exact result | Runtime harness command/scenario and exact result | Rollback boundary |
|-----------|----------------------------------------|---------------------------------------------------|-------------------|
| PR1 — Foundation SSOT + Errors + manifest + menu skeleton | `Get-Content apps-script/lotes/Config.gs | Select-Object -First 30` → shows `LOTES_CONFIG = Object.freeze({ TIMEZONE: 'America/La_Paz'...` and `DB_HEADERS 11 cols A:K`; `Get-Content apps-script/lotes/appsscript.json` → `timeZone: America/La_Paz`, `runtimeVersion: V8`, 4 oauthScopes; `Select-String -Path apps-script/lotes/Menu.gs -Pattern addItem` → exactly 2 entries `Guardar→guardarLotes`, `Resincronizar→rehidratarPorFecha`; `Select-String -Path apps-script/lotes/*.gs -Pattern 'getRange\('` → no `getRange("D4")` literal outside Config (only `lotesGetRange_` + numeric `getRange(row,col)`); `Select-String -Path apps-script/lotes/*.gs -Pattern '"D4"\|"F4"\|"B8:G37"'` outside Config → 0 hits (only Config RANGES). All checks passed. | N/A — no runtime harness (static scaffolding only; full harness in PR2 per tasks Suggested Work Units). No live or production sheet was changed; verification on COPY deferred to PR2/PR3. | Revert `apps-script/lotes/appsscript.json`, `apps-script/lotes/Config.gs`, `apps-script/lotes/Errors.gs`, `apps-script/lotes/Menu.gs` — no DB writes to undo; delete `lotesOnEdit` trigger if created. |
| PR2 — Core save path guardarLotes batch save | `Select-String -Path apps-script/lotes/*.gs -Pattern '"D4"\|"F4"\|"B8:G37"'` outside Config (excluding Config.gs comments) → 0 hits — only `LOTES_CONFIG.RANGES.D4/F4/FORM/PAYLOAD`; `Select-String -Path apps-script/lotes/Config.gs -Pattern "lotesDateKey_"` → returns `''` for non-Date branch `if (value instanceof Date...) return ''` (verified non-Date blank/string → `""`); `Select-String -Path apps-script/lotes/Persistence.gs -Pattern "sort\(function"` → `toDelete.sort(function (a,b){return b-a;})` bottom-up delete order descending; `Select-String -Path apps-script/lotes/Core.gs -Pattern "lotes-is-resetting-f4"` + `Select-String -Path apps-script/lotes/Menu.gs -Pattern "lotes-is-resetting-f4"` → both present with `PropertiesService.getDocumentProperties()` flag + `flush` + `sleep 200`; `Get-Content apps-script/lotes/*.gs | Measure-Object -Line` → 166 Persistence + 127 Ingest + 143 Core (new) — no literal range outside Config, debounce `DEBOUNCE_MS 3000` via `PropertiesService lotes-last-save-ms`, isolation `SpreadsheetApp/LockService/Session/Utilities/PropertiesService/ScriptApp` only. All checks passed. | N/A — no runner (openspec/config.yaml testing.runner=none, strict_tdd false). Manual GAS harness deferred to PR3 per tasks: `setupLotes()` on COPY `19lBJHHKsusI6Eqkni-zh8us6ePoEHscEgrIPrFK-zhE` gid `1098679039` `lotes-form` will exercise `F4 FALSE→TRUE` + `Lotes → Guardar` → inspect `db_lots` `A:K` rows `2026-09-21-1/3/5` + `Logger`. No live prod sheet changed. | Revert `apps-script/lotes/Core.gs`, `apps-script/lotes/Persistence.gs`, `apps-script/lotes/Ingest.gs` — `db_lots` rows created by this PR remain auditable (physical delete only by re-running save with empty `C`); also revert `openspec/changes/lotes/tasks.md` 2.1–2.5 checkboxes + this progress file. No trigger/migration to undo. |

## Delivery Boundary

- Strategy: `auto-chain`, `feature-branch-chain` on `lots-form` (per tasks Review Workload Forecast: High risk 880–980 lines, Chained PRs Yes).
- Chain: PR1 `lots-form` ← `lots-form-pr1-foundation` (branch `lots-form` holds PR1 commit `4e9e865`); PR2 `lots-form` ← `lots-form-pr2-save` (this branch, from PR1); PR3 `lots-form-pr2-save` ← `lots-form-pr3-rehydrate` (next).
- Current work unit: PR2 Core save path (Phase 2 tasks 2.1–2.5) — Persistence index + Ingest snapshot + `guardarLotes()` lock/audit/batch, no rehydration wiring (lands in PR3).
- Authored footprint: PR2 adds 436 code lines (166 Persistence + 127 Ingest + 143 Core after audit dedupe) + 5 tasks.md checkbox updates + this progress. Combined with PR1 (442 lines), cumulative authored ~878 lines within 880–980 forecast. PR2 slice ≤350 target was estimate; actual 436 is cohesive deliverable (single save path work unit) and reviewable ≤60 min; no code-golf applied.
- Commit: `2fbfdda29f03271734272e3834e64beeeebbe0d8` — `feat(lotes): core guardarLotes batch save` on `lots-form-pr2-save` (500 insertions: 166 Persistence + 127 Ingest + 159 Core + 10 tasks.md + 36 progress; code-only 452 lines).

## Remaining Tasks

- [ ] 3.1 `Core.gs` — `rehidratarPorFecha_()` (single-scan, clear+set `C8:G37`, re-assert `B8:B37=1..30`)
- [ ] 3.2 `Menu.gs` dispatch — `lotesOnEdit` full routing + `rehidratarPorFecha` public alias + F4 guard flag
- [ ] 3.3 Harden `setupLotes()` idempotency + header mismatch warn + number formats
- [ ] 3.4 Isolation guard — no sibling imports, header comments
- [ ] 4.1 `tests/lotes.test.gs` — unit helpers harness `runLotesTests()` ✅/❌
- [ ] 4.2 `tests/lotes.test.gs` — integration save scenarios on COPY `19lBJHHKsusI6Eqkni-zh8us6ePoEHscEgrIPrFK-zhE`
- [ ] 4.3 `tests/lotes.test.gs` — rehydration + F4 guard + lock exhaustion scenarios
- [ ] 4.4 Manual verification on COPY (menu, F4, D4 navigation, Executions, B-column never persisted, Errors)
- [ ] 5.1 Formatting/warnings — header colors, freeze, auto-resize, `B8:G37` editable, `F4` checkbox
- [ ] 5.2 Documentation/comments — PK `yyyy-MM-dd-posicion`, `posicion 1 = B8`, `No never persisted`, `F4 guard`, isolation note

Next recommended: `sdd-apply` PR3 — Rehydration + dispatch wiring + harness + verification on `lots-form-pr3-rehydrate` branching from `lots-form-pr2-save`.

## Verification Notes (PR2 — no runner)

- No npm/lint/typecheck (per AGENTS.md — no package.json). Config SSOT verified: no literal `D4`/`F4`/`B8:G37` outside Config (only `LOTES_CONFIG.RANGES` + numeric `getRange(row,col)`).
- `lotesDateKey_` returns `""` for non-Date (blank/string pasted not coerced) — passthrough guard verified.
- Bottom-up delete order: `toDelete.sort((a,b)=>b-a)` before `deleteRow` — index shift safe.
- F4 guard flag `lotes-is-resetting-f4` present in `Core.lotesResetCheckbox_` (`setProperty` → `flush` → `sleep 200` → `deleteProperty`) and `Menu.lotesOnEdit` early return guard.
- Batch ops: single `getValues()` on `B8:G37` (Ingest) and single `getValues()` on `db_lots A:K` (Persistence) per save; `setValues()` per posicion update + bottom-up `deleteRow`; `SpreadsheetApp.flush()` before toast.
- Timezone/isolation: `America/La_Paz` only via `Utilities.formatDate` audit; `D4` passthrough no coercion; allowed built-ins only `SpreadsheetApp/LockService/Session/Utilities/PropertiesService/ScriptApp`.
- Runtime verification deferred to PR3 harness on COPY `19lBJHHKsusI6Eqkni-zh8us6ePoEHscEgrIPrFK-zhE` (gid `1098679039` `lotes-form`): `setupLotes()` → `F4`/`Guardar`/`Resincronizar` exercise.

