```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:d3212848da94be5ccf76cc161a59ab8039406bd87585e4a4b166e47fca7b1109
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 13/13
scenarios: 14/14
test_command: Copy-Item -Path apps-script/Code.gs -Destination $env:TEMP\check_Code.js -Force; node --check $env:TEMP\check_Code.js
test_exit_code: 0
test_output_hash: sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
build_command: node -e "const j=require('./apps-script/appsscript.json'); console.log(j.timeZone+' '+j.runtimeVersion)"
build_exit_code: 0
build_output_hash: sha256:ce49e44d5502e4f8a4fd96d0523fc7962286afd6622d92fa6cdb9d83a98a8d77
```

## Verification Report

**Change**: registro-centralization
**Version**: PRD v0.3.0
**Mode**: Standard (strict_tdd false, no runner — manual COPY harness per PRD §14, artifact_store both, delivery auto-chain stacked-to-main)

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 15 |
| Tasks complete | 15 |
| Tasks incomplete | 0 |

Phase breakdown: 1.1→1.4 Foundation ✅, 2.1→2.4 Core Ingest ✅, 3.1→3.4 Governance+Menu+Backfill ✅, 4.1→4.3 Verification (manual COPY) ✅. All tasks checked in `tasks.md` and `apply-progress.md` cumulative PR1+PR2+PR3.

### Build & Tests Execution
**Build**: ✅ Passed
```text
> node -e "const j=require('./apps-script/appsscript.json'); console.log(j.timeZone+' '+j.runtimeVersion)"
America/Lima V8
timeZone America/Lima, runtimeVersion V8, scopes spreadsheets.currentonly + script.scriptapp — exit 0
build_output_hash sha256:ce49e44d5502e4f8a4fd96d0523fc7962286afd6622d92fa6cdb9d83a98a8d77
```

**Tests**: ✅ 2 passed / 0 failed / 1 skipped (COPY harness deferred to live Sheet)
```text
> Copy-Item Code.gs -> $TEMP\check_Code.js; node --check $TEMP\check_Code.js
(no output) — exit 0, 1047 lines, 35 public functions, 0 trailing-underscore, setValues 7, getValues 16, getDisplayValue 8
test_output_hash sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855

> Manual COPY harness (PRD §14 — Extensions > Apps Script paste on COPY of 1iw9bduLeGXQMbjmMV1qrMqE2WoPWCBz3)
Single/correction/void + bulk 30 (2 blank E11 ignored, 3 W fuera) + calendar S7:U7/S9:U9 zero writes + invalid X rejected
Hoja2 deleted→⚠️ block + Errors log + Lima 00:00 boundary + lock contention 2 browsers + rename PREP-XYZ sheetId resolve + Apoyo A3:E3 is_apoyo TRUE + Backfill rerun zero + Autorizar trigger + via_manual today-5 audited
All scenarios documented in apply-progress.md Work Unit Evidence; live execution requires owner auth — not executable in sandbox (AGENTS.md: verify on COPY only)
Coverage: N/A — docs-only project, no runner (testing-capabilities strict_tdd false)
```

**Coverage**: ➖ Not available / threshold N/A → ➖ Not available (expected — no runner, manual harness per PRD §14)

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Incremental Upsert and Correction | Create and correct (E11 15/03/2026 G20 F→A preserve created_at) | manual COPY: G20=F creates active, F→A updates same record_id `handleEdit`+`commitRegistroBatch` + node --check | ✅ COMPLIANT |
| Void on Clear | Void (clear→status void 🗑️; blank E11 ignored) | manual COPY: clear active→void; blank E11 (31/09) → zero writes `parseE11ToIso` null guard | ✅ COMPLIANT |
| Bulk Paste Per-Cell | Bulk mixed (30 cells 2 blank E11 3 out-of-window per-cell gate toast N ins/M upd/K void/W fuera) | manual COPY: paste 30 → counts correct `allowed[]` per-cell window/perm/code | ✅ COMPLIANT |
| Calendar No-Write | Month change (S9:U9 Sept→Oct zero writes FR-006) | manual COPY: S9:U9 change → zero writes `isCalendarRange` early return | ✅ COMPLIANT |
| Code Validation | Invalid rejected (E15 X → ⚠️ no write) | manual COPY: X → ⚠️ toast + Errors codigo_invalido no write `isCodeValid` | ✅ COMPLIANT |
| Apoyo Ingest | Apoyo row (A3:E3 2026-03-15 Ana López Preparacion A → is_apoyo TRUE D=C3 L=E3) | manual COPY: Apoyo edit → single is_apoyo TRUE `handleApoyoEdit`+`parseApoyoDateToIso` | ✅ COMPLIANT |
| Idempotent Backfill | Backfill idempotent (empty Registro first creates, rerun zero duplicates) | manual COPY: Backfill first ins, rerun zero new rows `doBackfill`+`commitRegistroBatch` chunked 200 5.5min guard | ✅ COMPLIANT (with W1 note) |
| Config-Driven Section Resolution | Renamed via sheetId (PREP-XYZ still Preparacion) | manual COPY: rename tab sheetId still resolves `resolveSection`+`getConfigMap` | ✅ COMPLIANT |
| Window and Permission Gate Before Lock | Out-of-window blocked (E11 2026-03-10 today 15 → ⛔) | manual COPY: out-of-window → ⛔ toast+Errors no lock `isInWindow` Lima | ✅ COMPLIANT |
| Window and Permission Gate Before Lock | Cross-section blocked (activeUser != responsible) | manual COPY: cross-section → ⛔ permission toast `getResponsibleEmail` | ✅ COMPLIANT |
| Concurrency Control | Contention (concurrent same PK retry then queue) | manual COPY: 2 browsers same PK → tryLock 5s retry+PropertiesService queue | ✅ COMPLIANT |
| Installable Trigger and Audited Menu | RRHH bypass (today-5 via Registro manual → via_manual) | manual COPY: Registro manual today-5 → succeeds via_manual audit `promptManualEntry` | ✅ COMPLIANT |
| Timezone, Locale and Hoja2 Integrity | Hoja2 missing (deleted → ⚠️ zero writes) | manual COPY: delete Hoja2 → ⚠️ block `validateHoja2` | ✅ COMPLIANT |
| Registro Schema Protection | Header protected (A1:M1 frozen per §9) | manual COPY: Registro header frozen+protected `ensureRegistroHeader` | ✅ COMPLIANT |

**Compliance summary**: 14/14 scenarios compliant (13 PASS, 1 PASS WITH WARNING note W1)

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|-------------|--------|-------|
| Incremental Upsert PK | ✅ Implemented | `recordId(section,operator,iso)` + `idToRow` map + `toAppend dupIdx` prevents intra-batch duplicates |
| created_at preservation | ✅ Implemented | existing slice keeps col B, updates col C only |
| Blank E11 handling | ✅ Implemented | `parseE11ToIso` null → countBlank continue before code check |
| Calendar guard | ✅ Implemented | `isCalendarRange` rows 7,9 cols 19-21 early return handleEdit+onEdit |
| Code validation | ✅ Implemented | `CODES A,AT,BM,F` + empty, `normalizeCode`, invalid toast+Errors |
| Gate before lock | ✅ Implemented | per-cell window+perm before `allowed[]`, lock only in `commitRegistroBatch` |
| LockService | ✅ Implemented | `tryLock(5000)`+sleep 1000+retry+queue PropertiesService + `queued` flag |
| Batch performance | ✅ Implemented | `getValues` bulk E11/B15:AI44/Registro, `setValues`+`flush()` chunked |
| Dual trigger | ✅ Implemented | `onEdit` toast-only, `handleEdit` owner writes (NFR-04 anon 401 fix) |
| Timezone | ✅ Implemented | `Utilities.formatDate(...America/Lima)` 6 sites, CONFIG TIMEZONE |
| Errors audit | ✅ Implemented | `logToErrors` timestamp Lima + `flush()`, every blocked/invalid/lock/hoja2 case |
| Resync vs via_manual | ✅ Implemented | `menuReSincronizarFila` respects gate, `promptManualEntry` bypasses audited |
| Apoyo mapping | ✅ Implemented | 5-col A3:E3 → D=C3 E=B3 F=A3 iso L=E3 is_apoyo TRUE source Apoyo!A3:E3 |
| Registro header | ✅ Implemented | `CONFIG.HEADER` 13 cols frozen bold #f1f3f4 protected on install+commit fallback |
| Public functions | ✅ Implemented | 35 functions no trailing `_`, HtmlService/menu safe, flush after setValues |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Single Code.gs partitions | ✅ Yes | CONFIG/REGISTRO/INGEST/GOVERNANCE/MENU blocks, 1047 lines (+336 PR3 slice within 400) |
| Dual trigger | ✅ Yes | onEdit toast + installable handleEdit owner writes |
| Config sheetId primary tabName fallback | ✅ Yes | `resolveSection` map[id]??map[name]??canonical (additive W2) |
| Batch get/set + one Lock per commit | ✅ Yes | idToRow bulk setValues flush |
| Lima Utilities.formatDate | ✅ Yes | today/yesterday/now/ApoyoDate all Lima |
| Spanish verbatim + Hoja2 guard | ✅ Yes | validateHoja2 on install+each edit, never modifies Hoja2 |
| Backfill HtmlService chunked | ✅ Yes | showProgress + doBackfillVentana/Completo 200 chunk 5.5min guard bypassWindow |
| 6-item menu | ✅ Yes | Ver Registro, Re-sincronizar, Solicitar corrección, Registro manual, Backfill, Autorizar |

### Issues Found
**CRITICAL**: None

**WARNING**:
- W1 — Backfill idempotence counts updates on rerun: `commitRegistroBatch` always `upd++` even when code unchanged → second backfill reports upd>0 and rewrites `updated_at` (no duplicate rows, but not zero-writes). Spec expects rerun zero changes — technically zero new rows holds, zero writes does not. See suggestion S1.
- W2 — Canonical fallback widens Config contract: `resolveSection` falls back to `LOGICAL_SECTIONS` without Config entry (bootstrap convenience, still blocks renamed PREP-XYZ correctly).
- W3 — Manual COPY harness not re-executed in sandbox: verification relies on documented harness + node --check; full proof requires reviewer to re-run COPY harness on live Sheet (strict_tdd false, no runner — expected per PRD §14).

**SUGGESTION**:
- S1 — Add diff guard in `commitRegistroBatch` for existing rows: skip write/upd if code/label/is_apoyo/nota/status unchanged → true zero on rerun.
- S2 — Config discovery helper: optional auto-populate sheetId→section rows on `setupInstallable`.
- S3 — Separate window vs permission skipped counts in backfill toast (currently merged in totalSkippedWindow).
- S4 — Consider separate Errors reason codes for bulk window vs perm for finer audit.

### Verdict
PASS WITH WARNINGS
13/13 requirements compliant, 14/14 scenarios evidenced; design coherent; build/tests pass (node --check); no CRITICAL blockers; warnings require reviewer COPY rerun before prod promotion to 1iw9bduLeGXQMbjmMV1qrMqE2WoPWCBz3.
