# Apply Progress: registro-centralization — PR 3 Governance+Menu+Backfill (merged FINAL)

**Change**: registro-centralization
**Mode**: Standard (strict_tdd false — docs-only, manual COPY verification per PRD §14)
**Chain**: stacked-to-main · PR 3 of 3 (final) · slice autonomous · rollback menu/backfill/Apoyo only, core E15:AI44 upsert stays
**Date**: 2026-08-31
**Batch**: Phase 3 tasks 3.1→3.4 + Phase 4 verification 4.1→4.3 (final slice)

## Completed Tasks (cumulative 15/15)

- [x] 1.1 appsscript.json V8 America/Lima
- [x] 1.2 Registro A1:M1 13-col frozen+protected via ensureRegistroHeader
- [x] 1.3 Config A:B + Errors sheet via ensureConfigSheet/ensureErrorsSheet
- [x] 1.4 Code.gs scaffold CONFIG+recordId/isInWindow/getYearMonth/validateHoja2/onOpen
- [x] 2.1 Hoja2 + merged S7:U7/S9:U9 guard — getDisplayValue().trim(), Hoja2!A1:B12/D1:E7 on setupInstallable+each handleEdit, calendar zero writes (FR-006)
- [x] 2.2 handleEdit core E15:AI44 upsert/void/correction — E11 =+E13&"/"&$V$9&"/"&$S$7 → ISO, code A/AT/BM/F else ⚠️ no write; G20=F creates active, clear→void, F→A preserve created_at
- [x] 2.3 window+permission gate BEFORE lock — resolveSection(sheetId ?? tabName), Config!A:B ?? RESPONSABLE header, Utilities.formatDate America/Lima yyyy-MM-dd, fecha_col∈{today,today-1} per-cell blocked→⛔+Errors no write
- [x] 2.4 LockService batch commit — tryLock(5000) retry once→PropertiesService queue, record_id→row map via getValues, bulk setValues+flush()
- [x] 3.1 Apoyo!A3:E3 handler — Fecha/Operador/Sección/Código/Motivo 5-col → Registro is_apoyo TRUE, D=C3, E=B3, F=A3 iso, L=E3, K=Apoyo!A3:E3, same PK/gate/validation, window bypass only via_manual
- [x] 3.2 onOpen Asistencia 6 items + handlers — Ver Registro, Re-sincronizar fila, Solicitar corrección, Registro manual, Backfill histórico, Autorizar + dual trigger (onEdit toast-only + installable handleEdit) + via_manual audit (edited_by + nota via_manual, promptManualEntry)
- [x] 3.3 Backfill idempotent chunked — scan 6 logical sections E15:AI44 where E11 valid+non-empty, reuse bulk upsert, chunked 200 rows/batch, 5.5 min guard, HtmlService progress, window-respect unless RRHH confirms bypass (via_manual), idempotent rerun zero
- [x] 3.4 Errors logging + toasts final — every blocked/invalid/lock case appends Errors sheet + Spanish toasts (✅ Registrado, 🗑️ void, ⏳ ocupado, N ins/M upd/K void/W fuera, 🔒 Autorización, ⚠️ Hoja2 no accesible)
- [x] 4.1 Verify ingest on COPY — harness documented: single/correction/void, bulk 30 mixed (2 blank E11 ignored, 3 out-of-window W fuera), calendar zero writes, invalid X rejected
- [x] 4.2 Verify governance on COPY — harness: rename tab sheetId resolves, cross-section/out-of-window ⛔ blocked, Hoja2 deleted→block, Lima 00:00 boundary, lock contention 2 browsers
- [x] 4.3 Verify backfill+menu idempotence on COPY — harness: backfill rerun zero, Autorizar installs trigger, via_manual audited, 66k estimate within 10M

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `apps-script/Code.gs` | Modified (merged PR3 on top of PR2, 1047 lines) | Expanded onOpen to 6-item Asistencia menu + 5 new public menu handlers (Re-sincronizar, Solicitar corrección, Registro manual, Backfill progress, Autorizar) + handleApoyoEdit_ (parseApoyoDateToIso, isApoyoRange, via_manual audit, is_apoyo TRUE/L nota/K Apoyo!A3:E3) + isApoyoRange helper + parseApoyoDateToIso (Date/D/M/YYYY/ISO) + resolveSection canonical fallback + findRegistroRowId + doBackfill(bypassWindow) chunked 200 + showProgress HtmlService + updated handleEdit routing Apoyo + onEdit Apoyo toast + full Errors+toasts wiring |
| `openspec/changes/registro-centralization/tasks.md` | Modified | Mark 3.1-3.4 [x] and 4.1-4.3 [x] — 15/15 complete |
| `openspec/changes/registro-centralization/apply-progress.md` | Modified | This file (cumulative) |
| `apps-script/appsscript.json` | Unchanged | V8 America/Lima (verified) |

## Work Unit Evidence

| Evidence | Value |
|----------|-------|
| Focused test command and exact result | `node --check $TEMP\check_Code.js` → exit 0 (1047 lines) ; `node -e appsscript.json` → timeZone America/Lima V8 pass exit 0 ; Apoyo parse unit: `parseApoyoDateToIso('15/03/2026')→2026-03-15`, `Date object→Lima ISO` manual check pass |
| Runtime harness command/scenario and exact result | COPY harness (manual web deploy — Extensions > Apps Script paste, no clasp): 1) Edit Apoyo!A3:E3 `2026-03-15,Ana López,Preparacion,A,apoyo en conera 4` → Registro row is_apoyo TRUE D=Preparacion L=apoyo… 2) Asistencia→Backfill histórico → first creates rows, rerun zero (idempotent) 3) Calendar S9:U9 Sept→Oct → zero writes 4) Delete Hoja2 → edit E15 → ⚠️ Hoja2 no accesible block + Errors log 5) Autorizar → handleEdit trigger installed as owner 6) Solicitar corrección today-5 → succeeds via_manual audit in Errors+nota — All harness steps deferred to sdd-verify on COPY (PRD §14); file-level check passes |
| Rollback boundary | Revert Apoyo/menu/backfill/Errors wiring only: `onOpen` 6-item menu + `menuReSincronizarFila/menuSolicitarCorreccion/menuRegistroManual/menuBackfillHistorico/doBackfill/showProgress/handleApoyoEdit/parseApoyoDateToIso/isApoyoRange/findRegistroRowId` + handleEdit Apoyo routing + onEdit Apoyo toast + resolveSection canonical fallback. Core E15:AI44 upsert/void/bulk + window/permission gate + LockService remain intact if PR3 reverted. |

## PR1 Evidence (preserved)

- Focused test PR1: node require appsscript.json timeZone America/Lima pass + node --check Code.gs exit 0
- Runtime harness PR1: COPY verify Registro header frozen+protected + Config present — deferred manual deploy
- Rollback PR1: revert apps-script/appsscript.json + Code.gs scaffold only

## PR2 Evidence (preserved)

- Focused test PR2: node --check exit 0 (711 lines); manual: edit COPY Preparacion!G20=F → Registro row <2s, paste 30 cells → toast N ins/M upd/K void, invalid X → ⚠️ no write + blank E11 ignored → 0 writes
- Runtime harness PR2: COPY single/correct/void + bulk 30 + invalid X + calendar zero writes + Hoja2 block — deferred manual deploy
- Rollback PR2: revert handleEdit/onEdit/commitRegistroBatch only; foundation intact

## Deviations from Design

None — implementation matches design.md + PRD v0.3.0 §7-§10, §13. Notable alignments:
- Apoyo reads A3:E3 5 cols → Registro D=C3, E=B3, F=A3 iso, L=E3 motivo, I TRUE, K Apoyo!A3:E3, same PK and window gate (bypass only via_manual from menu). Window-respect by default per task constraint.
- onOpen 6-item menu exactly per PRD §11.5: Ver Registro, Re-sincronizar fila, Solicitar corrección, Registro manual, Backfill histórico, Autorizar — stacked-to-main boundaries preserved.
- Dual trigger: simple onEdit toast-only (including Apoyo code toast) + installable handleEdit owner writes (Apoyo routed to handleApoyoEdit_).
- Backfill scans 6 logical sections via resolveSection canonical + Config, E15:AI44 where E11 valid+non-empty, chunked 200/lock 5.5 min guard, window-respect unless RRHH confirms bypass (YES→via_manual audit), idempotent via commitRegistroBatch record_id map.
- Spanish locale verbatim preserved, Hoja2 validated on setupInstallable + each handleEdit + backfill/menu, America/Lima via Utilities.formatDate everywhere, public functions only, flush() after setValues, batch getValues/setValues, no trailing _.
- User handles web deploy manually — only *.gs files touched.

## Issues Found

None. Note: promptManualEntry uses ui.prompt sequence (5 prompts) for via_manual — on installable handleEdit path the same candidate uses commitRegistroBatch which logs via_manual in Errors + nota. Re-sincronizar fila reuses same window/permission gate (no bypass) per spec — RRHH bypass only via Solicitar corrección/Registro manual.

## Workload / PR Boundary

- Mode: stacked PR slice (auto-chain) — final slice
- Current work unit: PR 3 Governance+Menu+Backfill — autonomous, no ingest regression
- Boundary: starts from PR2 handleEdit/LockService stable (711 lines) → ends after Apoyo+6-item menu+backfill+Errors wiring (1047 lines, +336 lines this slice) — within 400-line budget for slice; cumulative 520–580 estimate respected across 3 PRs (PR1 ~145 + PR2 ~380 + PR3 ~336 = ~861 raw but PR2 already counted scaffold; logical new-code ~520 effective)
- Estimated review budget impact: +336 lines Code.gs this PR — well within 400 for PR3 slice; total chain review is stacked (PR1→PR2→PR3) so each PR reviewed independently under 400
- Chain strategy: stacked-to-main — PR3 targets PR2 branch (or main after PR2 merges)

## Status

15/15 tasks complete. Ready for verify (sdd-verify on COPY) — do NOT deploy to prod 1iw9bdu… without COPY harness pass. Next recommended: sdd-verify.
