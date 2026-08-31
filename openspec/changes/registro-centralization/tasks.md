# Tasks: registro-centralization

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 520–580 (Code.gs ~500 + appsscript.json ~15 + sheets setup ~30 + Errors/Config) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 Foundation → PR 2 Core Ingest → PR 3 Governance+Menu+Backfill |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Foundation: Config/Registro/Errors + appsscript.json + Code.gs scaffold | PR 1 | `clasp push --force` then open COPY → verify `Registro A1:M1` + `Config` protected | COPY `1iw9bdu…` copy: check `Registro` header frozen + `Config!A:B` mapping present | Revert `apps-script/appsscript.json` + `apps-script/Code.gs` scaffold + sheet header creation — no ingest behavior |
| 2 | Core ingest: `handleEdit` E15:AI44 upsert/void/bulk + validation + window/permission + LockService batch | PR 2 | Manual: edit COPY `Preparacion!G20=F` → check `Registro` row <2s; paste 30 cells → toast `N ins/M upd/K void` | COPY: single/correct/void + bulk 30 + invalid X → no write + blank E11 ignored | Revert `handleEdit`/`onEdit` ingest logic only; foundation sheets remain intact |
| 3 | Governance completeness: Apoyo+menu 6 items+backfill+Hoja2/S7:U7+Errors logging | PR 3 | Manual: edit `Apoyo!A3:E3` → `is_apoyo=TRUE`; run `Asistencia → Backfill` → idempotent rerun zero | COPY: calendar `S9:U9` Sept→Oct zero writes; delete `Hoja2` → `⚠️ Hoja2 no accesible` block; `Autorizar` creates installable trigger | Revert menu/backfill/Apoyo/Hoja2 handlers only; core E15:AI44 upsert stays |

## Phase 1: Foundation / Infrastructure

- [x] 1.1 Create `apps-script/appsscript.json` with V8, `timeZone:America/Lima`, oauthScopes `spreadsheets.currentonly`+`script.scriptapp` — AC: `clasp` validates JSON | Deps: none | Size: S (~15 lines)
- [x] 1.2 Ensure `Registro` 13-col header `A1:M1` (`record_id,created_at,updated_at,section,operator_name,date,code,code_label,is_apoyo,edited_by,source_range,nota,status`) frozen + protected — AC: header order per PRD §9, never reorder | Deps: 1.1 | Size: S (~25 lines helper)
- [x] 1.3 Create `Config` sheet `A:B` (sheetId|tabName→section + responsible email) + `Errors` sheet (`timestamp,section,range,code,reason,user`) + protect — AC: unmapped tab warns+skip | Deps: 1.2 | Size: S (~20 lines)
- [x] 1.4 Scaffold `apps-script/Code.gs` header + `CONFIG` + `recordId()` PK + `isInWindow()`/`getYearMonth()`/`validateHoja2()` stubs + `onOpen()` empty — AC: `onOpen` loads without error | Deps: 1.1 | Size: M (~60 lines)

## Phase 2: Core Ingest

- [ ] 2.1 Implement `Hoja2` + merged `S7:U7`/`S9:U9` guard in `apps-script/Code.gs` — normalize via `getDisplayValue().trim()`, validate `Hoja2!A1:B12`/`D1:E7` on `setupInstallable`+each `handleEdit`, S7:U7/S9:U9 range → zero writes (FR-006) — AC: `⚠️ Hoja2 no accesible` no write; calendar change zero rows | Deps: 1.4 | Size: M (~50 lines)
- [ ] 2.2 Implement `handleEdit` core for `E15:AI44` upsert/void/correction + `E11` date via `=+E13&"/"&$V$9&"/"&$S$7` ISO + code validation `A/AT/BM/F,empty` else `⚠️ Código no válido` no write — AC: `G20=F` creates `active`, clear→`void`, `F→A` updates `updated_at` preserve `created_at` | Deps: 2.1 | Size: L (~120 lines)
- [ ] 2.3 Implement window+permission gate BEFORE lock in `apps-script/Code.gs` — `resolveSection(sheetId ?? tabName)`, `Config!A:B ?? RESPONSABLE header`, `Utilities.formatDate(...,"America/Lima","yyyy-MM-dd")`, `fecha_col∈{today,today-1}` per-cell, blocked→`⛔` toast+`Errors`+optional revert no write — AC: out-of-window + cross-section blocked, bulk per-cell | Deps: 2.2 | Size: M (~70 lines)
- [ ] 2.4 Implement `LockService.getDocumentLock()` batch commit — `tryLock(5000)` retry once→`PropertiesService` queue, `record_id→row` map via `getValues`, bulk `setValues`+`flush()` — AC: concurrent same PK no duplicate; 30-cell <10s | Deps: 2.3 | Size: M (~80 lines)

## Phase 3: Integration / Menu & Apoyo & Backfill

- [ ] 3.1 Implement `Apoyo!A3:E3` handler (Fecha/Operador/Sección/Código/Motivo 5-col → `Registro` `is_apoyo=TRUE, D=C3, E=B3, F=A3 iso, L=E3`) same gate/validation single row — AC: `Apoyo` edit → one `is_apoyo=TRUE` row | Deps: 2.4 | Size: M (~45 lines)
- [ ] 3.2 Implement `onOpen` menu `Asistencia` 6 items + handlers in `apps-script/Code.gs` — `Ver Registro`, `Re-sincronizar fila`, `Solicitar corrección`/`Registro manual` (`via_manual` bypass gate audited), `Backfill histórico`, `Autorizar` (`setupInstallable` creates installable `handleEdit` as owner) + simple `onEdit` toast-only dual trigger — AC: menu visible; `via_manual` succeeds `today-5` with audit | Deps: 2.4 | Size: M (~90 lines)
- [ ] 3.3 Implement idempotent Backfill in `apps-script/Code.gs` — scan 6 logical sections `E15:AI44` where `E11` valid+non-empty, reuse bulk upsert, chunked if >6min, `HtmlService` progress — AC: empty Registro first run creates rows, rerun zero | Deps: 3.1, 3.2 | Size: M (~70 lines)
- [ ] 3.4 Wire `Errors` logging + toasts (`✅ Registrado`, `🗑️ void`, `⏳ ocupado`, `N ins/M upd/K void/W fuera`, `🔒 Autorización`) in `apps-script/Code.gs` — AC: every blocked/invalid/lock case logged | Deps: 2.3, 3.2 | Size: S (~30 lines)

## Phase 4: Verification (COPY only — never prod `1iw9bduLeGXQMbjmMV1qrMqE2WoPWCBz3`)

- [ ] 4.1 Verify ingest on COPY — single/correction/void, bulk 30 mixed (2 blank E11 ignored, 3 out-of-window counted `W fuera`), calendar `S7:U7/S9:U9` zero writes, invalid X rejected — AC: per spec `registro-ingest` scenarios pass | Deps: Phase 2, 3 | Size: S (manual)
- [ ] 4.2 Verify governance on COPY — rename tab `PREP-XYZ` sheetId still resolves, cross-section & out-of-window ⛔ blocked, `Hoja2` deleted→block, Lima 00:00 boundary, lock contention 2 browsers — AC: per spec `registro-governance` scenarios pass | Deps: 4.1 | Size: S (manual)
- [ ] 4.3 Verify backfill+menu idempotence on COPY — backfill rerun zero, `Autorizar` installs trigger, `via_manual` audited — AC: 66k worst-case estimate within 10M cells | Deps: 4.1 | Size: S (manual)
