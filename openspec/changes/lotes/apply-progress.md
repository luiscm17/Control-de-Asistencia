# Apply Progress: Lotes — Daily Lot Tracking (lotes-form → db_lots)

## Mode

Standard. Strict TDD is disabled (openspec/config.yaml strict_tdd false — no test runner, manual GAS Logger harness).

## Completed Tasks

- [x] 1.1 Create `apps-script/lotes/appsscript.json` with `timeZone: "America/La_Paz"`, V8, STACKDRIVER, 4 oauthScopes
- [x] 1.2 Create `apps-script/lotes/Config.gs` with `LOTES_CONFIG = Object.freeze({...})` SSOT (TIMEZONE, SHEETS, RANGES, DB_HEADERS A:K, IDX, LIMITS, UI, ERRORS)
- [x] 1.3 Add `apps-script/lotes/Config.gs` helpers `lotesGetSheet_`, `lotesGetFormSheet_`, `lotesGetDbSheet_`, `lotesParseA1_`, `lotesParseRange_`, `lotesGetRange_`, `lotesDateKey_`, `lotesFechaDisplay_`, `lotesHeadersMatch_`, `lotesEnsureTableSheet_`, `lotesEnsureSchema`, `lotesConfigureForm_`
- [x] 1.4 Create `apps-script/lotes/Errors.gs` with `lotesEditorEmail_`, `lotesAuditTimestamp_`, `lotesLogError_`
- [x] 1.5 Create `apps-script/lotes/Menu.gs` skeleton — `onOpen` (Lotes → Guardar | Resincronizar, 2 entries), `onEdit` → `lotesOnEdit`, `setupLotes` idempotent, `lotesNormalizeCheckboxValue_`

Progress: 5/20 complete — PR1 Foundation delivered. Remaining tasks 2.1–5.2 pending for PR2/PR3.

## Work Unit Evidence

| Work unit | Focused test command and exact result | Runtime harness command/scenario and exact result | Rollback boundary |
|-----------|----------------------------------------|---------------------------------------------------|-------------------|
| PR1 — Foundation SSOT + Errors + manifest + menu skeleton | `Get-Content apps-script/lotes/Config.gs | Select-Object -First 30` → shows `LOTES_CONFIG = Object.freeze({ TIMEZONE: 'America/La_Paz'...` and `DB_HEADERS 11 cols A:K`; `Get-Content apps-script/lotes/appsscript.json` → `timeZone: America/La_Paz`, `runtimeVersion: V8`, 4 oauthScopes; `Select-String -Path apps-script/lotes/Menu.gs -Pattern addItem` → exactly 2 entries `Guardar→guardarLotes`, `Resincronizar→rehidratarPorFecha`; `Select-String -Path apps-script/lotes/*.gs -Pattern 'getRange\('` → no `getRange("D4")` literal outside Config (only `lotesGetRange_` + numeric `getRange(row,col)`); `Select-String -Path apps-script/lotes/*.gs -Pattern '"D4"\|"F4"\|"B8:G37"'` outside Config → 0 hits (only Config RANGES). All checks passed. | N/A — no runtime harness (static scaffolding only; full harness in PR2 per tasks Suggested Work Units). No live or production sheet was changed; verification on COPY deferred to PR2/PR3. | Revert `apps-script/lotes/appsscript.json`, `apps-script/lotes/Config.gs`, `apps-script/lotes/Errors.gs`, `apps-script/lotes/Menu.gs` — no DB writes to undo; delete `lotesOnEdit` trigger if created. |

## Delivery Boundary

- Strategy: `auto-chain`, `feature-branch-chain` on `lots-form` (per tasks Review Workload Forecast: High risk 880–980 lines, Chained PRs Yes).
- Chain: PR1 `lots-form` ← `lots-form-pr1-foundation` (current branch `lots-form` holds PR1; PR2 will branch from PR1, PR3 from PR2).
- Current work unit: PR1 Foundation (Phase 1 tasks 1.1–1.5 only) — isolated scaffolding, no DB write logic yet.
- Authored footprint: 442 lines (12 appsscript.json + 230 Config.gs + 55 Errors.gs + 145 Menu.gs) + tasks.md checkbox updates + this progress file. Within PR1 slice but over naive 280 estimate due to header docs + isolation comments + warning-only protection + F4 guard — honest count reported; no code-golf applied. Fits feature-branch-chain slice (each PR ≤350 target was estimate; PR1 slightly over but cohesive and reviewable ≤60 min).
- Commit: `9c926dac1a64d83333977b43d5102acfc69dd1f2` — `feat(lotes): foundation Config/Errors/Menu/appsscript PR1` on `lots-form` (590 insertions: 248 Config + 58 Errors + 157 Menu + 12 appsscript.json + 60 tasks.md + 55 progress; code-only 475 lines).

## Remaining Tasks

- [ ] 2.1 `Persistence.gs` — `lotesBuildDbState_`, `lotesFindRow_`, `lotesBuildRowValues_`, `lotesUpsertDeleteBatch_`
- [ ] 2.2 `Ingest.gs` — `lotesReadForm_`, `lotesIsEmptyRow_`, `lotesIsDebounced_`/`lotesMarkSaved_`, `lotesIsSaveCheckboxEvent_`, `lotesIsDateEdit_`
- [ ] 2.3 `Core.gs` — `guardarLotes()` (empty-D4 guard, lock 5s+retry, batch upsert/delete, flush, toast, reset F4)
- [ ] 2.4 `Core.gs` helpers — `lotesAcquireLock_`, `lotesResetCheckbox_`, audit wrappers
- [ ] 2.5 Delete-on-clear correctness + all-empty `C8:C37` → 0 lotes
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

Next recommended: `sdd-apply` PR2 — Core save path (tasks 2.1–2.5 + Ingest) on `lots-form-pr2-save` branching from PR1.

## Verification Notes (PR1 — no runner)

- No npm/lint/typecheck (per AGENTS.md — no package.json).
- Static checks: `LOTES_CONFIG` frozen, `Object.freeze` count 9, `timeZone America/La_Paz`, `appsscript.json` matches `dyeing`/`yarn-settings` pattern, Menu 2 entries, no literal range outside Config.
- Runtime verification deferred to PR2/PR3 harness on COPY `19lBJHHKsusI6Eqkni-zh8us6ePoEHscEgrIPrFK-zhE` (gid `1098679039` `lotes-form`): run `setupLotes()` once, reload, exercise `F4`/`Guardar`/`Resincronizar` after Core/Persistence land.
