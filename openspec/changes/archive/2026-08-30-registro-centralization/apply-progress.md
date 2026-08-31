# Apply Progress: registro-centralization — PR 1 Foundation

**Change**: registro-centralization
**Mode**: Standard (strict_tdd false — docs-only, manual COPY verification per PRD §14)
**Work Unit**: PR 1 Foundation — Unit 1: Config/Registro/Errors + appsscript.json + Code.gs scaffold
**Chain**: stacked-to-main · PR 1 of 3 · slice autonomous · rollback without touching PR 2/3
**Date**: 2026-08-31
**Batch**: Phase 1 tasks 1.1→1.4

## Completed Tasks
- [x] 1.1 Create apps-script/appsscript.json with V8, timeZone America/Lima, oauthScopes spreadsheets.currentonly+script.scriptapp
- [x] 1.2 Ensure Registro 13-col header A1:M1 frozen + protected (via ensureRegistroHeader)
- [x] 1.3 Create Config A:B + Errors sheet + protect (via ensureConfigSheet / ensureErrorsSheet)
- [x] 1.4 Scaffold apps-script/Code.gs header + CONFIG + recordId/isInWindow/getYearMonth/validateHoja2 + onOpen

## Files Changed
| File | Action | What Was Done |
|------|--------|---------------|
| apps-script/appsscript.json | Created | V8 runtimeVersion, timeZone America/Lima, oauthScopes currentonly+scriptapp, STACKDRIVER logging |
| apps-script/Code.gs | Created | Header comment, CONFIG (13-col HEADER, CODES/LABELS, ERRORS_HEADER), onOpen minimal Asistencia menu, recordId PK, isInWindow Lima Utilities.formatDate, getYearMonth merged S7:U7/S9:U9 getDisplayValue().trim(), validateHoja2 A1:B12/D1:E7, ensureRegistroHeader/ensureConfigSheet/ensureErrorsSheet frozen+protected+flush(), setupInstallable dedup trigger, handleEdit scaffold |
| openspec/changes/registro-centralization/tasks.md | Modified | Mark 1.1–1.4 [x] |

## Work Unit Evidence

| Evidence | Value |
|----------|-------|
| Focused test command and exact result | `node -e "require('./apps-script/appsscript.json')"` → timeZone America/Lima, runtime V8, scopes spreadsheets.currentonly,script.scriptapp — pass (exit 0). Syntax: copy Code.gs→.js then `node --check` → exit 0. |
| Runtime harness command/scenario and exact result | Manual COPY harness (PRD §14): `clasp push --force` then open COPY of 1iw9bdu… → verify Registro A1:M1 header order per PRD §9 frozen+protected, Config!A:B present, Errors sheet present — N/A in CI (requires manual web deploy via Extensions > Apps Script paste). Harness deferred to verifier on COPY; scaffold guarantees handleEdit exists so trigger install succeeds. |
| Rollback boundary | Revert `apps-script/appsscript.json` + `apps-script/Code.gs` + their sheet header creations (ensureRegistroHeader/ensureConfigSheet/ensureErrorsSheet via menu). No ingest behavior to revert — lock/window/Code validation untouched, so PR 2/3 remain independent. |

## Deviations from Design
None — implementation matches design.md: single V8 Code.gs with CONFIG/REGISTRO/GOVERNANCE/MENU partitions, Spanish locale verbatim preserved (no English formulas), public functions only, batch getValues/setValues + flush() pattern prepared for PR 2, America/Lima via Utilities.formatDate everywhere.

## Issues Found
None. Note: Config!A:B dual purpose (sheetId→section and section→responsible) is intentionally generic via key/value header; RRHH fills rows manually or via setupInstallable discovery in PR 3 — matches PRD §4 and design Config-driven resolution.

## Remaining Tasks (not in this slice)
- [ ] 2.1 Hoja2 + S7:U7/S9:U9 guard
- [ ] 2.2 handleEdit upsert/void/correction + E11 + code validation
- [ ] 2.3 window+permission gate before lock
- [ ] 2.4 LockService batch commit
- [ ] 3.1 Apoyo handler
- [ ] 3.2 onOpen 6-item menu + dual trigger
- [ ] 3.3 idempotent backfill
- [ ] 3.4 Errors logging + toasts
- [ ] 4.1–4.3 verification on COPY

## Workload / PR Boundary
- Mode: stacked PR slice (auto-chain)
- Current work unit: PR 1 Foundation — autonomous, no ingest side effects
- Boundary: starts from empty apps-script/ → ends after scaffold + sheet header helpers; PR 2 will add handleEdit ingest under same Lock/config, PR 3 will expand menu/backfill/Apoyo
- Estimated review budget impact: ~145 lines (appsscript.json 10 + Code.gs ~135) — well within 400-line budget for this slice; remaining chain ~380–440 lines across PR 2+3

## Status
4/15 tasks complete. Ready for next batch (PR 2 Core Ingest) — do NOT mark verify/archive yet. Next recommended: sdd-apply PR 2.
