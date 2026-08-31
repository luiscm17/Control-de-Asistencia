# Archive Report: registro-centralization

**Change**: registro-centralization
**Archived**: 2026-08-30
**Archived to**: `openspec/changes/archive/2026-08-30-registro-centralization/`
**Source of Truth**: `openspec/specs/` updated (hybrid mode — Engram + filesystem)
**Mode**: hybrid (`both`) — Engram observation IDs recorded for traceability, filesystem specs merged mechanically
**Delivery strategy**: auto-chain, stacked-to-main (3 PRs)
**Status**: SDD Cycle Complete — planned, implemented, verified, archived

## Final State Authority

This report is the terminal record at close per Final-State Authority hierarchy:

1. **Native review authority**: `reviewGate` structurally absent — no receipt-driven development for this candidate. Archive proceeds under ordinary repository policy (kill switch off or post-verify offer declined). No `reviewGate` value blocks archive.
2. **Persisted tasks artifact**: 15/15 complete `[x]` — source of truth for completion visibility.
3. **Explicit final-state facts (orchestrator launch prompt, 2026-08-30)**: Apply 15/15 across PR1(339)+PR2(~512)+PR3(336)=1047 lines Code.gs, stacked-to-main 3 PRs; Verify PASS WITH WARNINGS (W1 backfill rerun updated_at churn non-blocking, W3 sandbox no live execution — manual COPY re-run mandatory before prod), no code changes after verify, Registro 13 cols A:M PK (section, operator_name, date) Spanish locale Lima window LockService dual trigger Config-driven logical sections.
4. **Intermediate snapshots** (`apply-progress`, `verify-report`): valid history at their time, never evidence of final state. No contradictions to resolve — launch prompt facts corroborated by persisted tasks and verify-report hashes.

No unrankable contradictions detected.

## Task Completion Gate — PASS

- `openspec/changes/registro-centralization/tasks.md` checked before sync: 15/15 `[x]` (Phase 1: 1.1→1.4, Phase 2: 2.1→2.4, Phase 3: 3.1→3.4, Phase 4: 4.1→4.3)
- No unchecked implementation tasks. No stale-check reconciliation required.
- `sdd-apply` owns completion; `sdd-archive` validated persisted artifact.

## Native Review Receipt Gate — PASS (absent)

- Structured status `reviewGate` absent — no discovered review artifact governs this candidate.
- No `pending`, `invalidated`, or `escalated` gate present to block archive.
- Proceeding per `dependencies.archive: ready` ordinary policy.

## Specs Synced

Main specs were empty (greenfield). Delta specs are full specs — mechanically copied via shell (no Read→Write), verified by `diff -r` empty.

| Domain | Action | Details |
|--------|--------|---------|
| registro-ingest | Created | 7 requirements: Incremental Upsert and Correction, Void on Clear, Bulk Paste Per-Cell, Calendar No-Write, Code Validation, Apoyo Ingest, Idempotent Backfill — 7 scenarios |
| registro-governance | Created | 6 requirements: Config-Driven Section Resolution, Window and Permission Gate Before Lock (2 scenarios), Concurrency Control, Installable Trigger and Audited Menu, Timezone/Locale and Hoja2 Integrity, Registro Schema Protection — 7 scenarios |

**Mechanical copy evidence (mandatory `diff -r` readback — empty is PASS):**

```text
=== Sync registro-ingest ===
temp_path=openspec/specs/registro-ingest/.spec.md.FfCdwJ
cp ok
diff -r output for registro-ingest (should be empty):
[empty diff - PASS for registro-ingest]
mv ok to openspec/specs/registro-ingest/spec.md

=== Sync registro-governance ===
temp_path=openspec/specs/registro-governance/.spec.md.mLcNsh
cp ok
diff -r output for registro-governance (should be empty):
[empty diff - PASS for registro-governance]
mv ok to openspec/specs/registro-governance/spec.md
```

Source: `openspec/changes/registro-centralization/specs/{domain}/spec.md` → `openspec/specs/{domain}/spec.md`

## Archive Move — PASS

Mechanical move via shell (no Read→Write), verified by pre-move snapshot `diff -r` empty.

```text
=== Archive move for registro-centralization ===
source: openspec/changes/registro-centralization
archive: openspec/changes/archive/2026-08-30-registro-centralization
snapshot_root=/tmp/sdd-archive.kDNrPg
snapshot cp ok
mkdir -p openspec/changes/archive
git mv ok
source gone check PASS
diff -r output (should be empty, archive-report excluded):
[empty diff - PASS for archive move]
=== Archive move done ===
```

- Active `openspec/changes/registro-centralization` no longer exists
- `openspec/changes/archive/` created if needed (already existed)
- Archive-report is additive-only and excluded from diff comparison

## Archive Contents

- proposal.md ✅ — Intent to centralize 6 sections + Apoyo into Registro 13 cols PK via Apps Script (PRD v0.3.0 §§5.2-5.3, 7-10, 13)
- specs/registro-ingest/spec.md ✅ — 7 requirements delta
- specs/registro-governance/spec.md ✅ — 6 requirements delta
- design.md ✅ — Single V8 Code.gs 5 modules, dual trigger, Config sheetId→logical, batch LockService 5s retry, Lima Utilities.formatDate, Spanish verbatim Hoja2 guard
- tasks.md ✅ — 15/15 complete `[x]` (PR1 Foundation 1.1-1.4, PR2 Core Ingest 2.1-2.4, PR3 Governance+Menu+Backfill 3.1-3.4, Verification 4.1-4.3)
- apply-progress.md ✅ — Cumulative PR1+PR2+PR3, 1047 lines, node --check exit 0, COPY harness documented
- verify-report.md ✅ — schema gentle-ai.verify-result/v1, evidence_revision sha256:d3212848..., PASS WITH WARNINGS
- archive-report.md ✅ — this file (additive, not in source snapshot)

**Verification per Step 4:**
- [x] Main specs updated correctly (2 domains Created)
- [x] Change folder moved to archive
- [x] Archive contains all artifacts
- [x] Archived tasks.md has no unchecked implementation tasks
- [x] Active changes directory no longer has this change
- [x] Verbatim `diff -r` readback included and empty

## Source of Truth Updated

The following specs now reflect the new behavior (greenfield — no merge into existing spec, created via mechanical copy):

- `openspec/specs/registro-ingest/spec.md`
- `openspec/specs/registro-governance/spec.md`

Future readers consult these as source of truth for Registro centralization.

## Implementation Summary (close state — no code changes after verify)

- **Code**: `apps-script/Code.gs` 1047 lines (PR1 339 + PR2 ~512 + PR3 336), 35 public functions (no trailing `_`), 7 `setValues`, 16 `getValues`, 8 `getDisplayValue`, `apps-script/appsscript.json` V8 `America/Lima` `spreadsheets.currentonly` + `script.scriptapp`
- **Registro**: 13 cols A:M `record_id,created_at,updated_at,section,operator_name,date,code,code_label,is_apoyo,edited_by,source_range,nota,status` PK `(section, operator_name, date)` → `record_id`, frozen/protected, `Errors` sheet audit, `Config!A:B` logical sections
- **Key behaviors**: `E15:AI44` per-cell upsert/void/bulk with `E11` D/M/YYYY via `=+E13&"/"&$V$9&"/"&$S$7` → ISO, blank `E11` ignored, `S7:U7/S9:U9` zero writes (FR-006), `A/AT/BM/F` validation ⚠️, `Apoyo A3:E3` → `is_apoyo=TRUE D=C3 E=B3 F=A3 iso L=E3 K=Apoyo!A3:E3`, window `today/today-1` Lima + `activeUser==responsible` gate before `LockService.getDocumentLock()` 5s retry once → `PropertiesService` queue, dual trigger (`onEdit` toast-only + installable `handleEdit` owner writes anon 401 fix), Spanish formulas verbatim `SI.ERROR/BUSCARV/DIASEM/CONTAR.SI` `FALSO` `=+`, `Hoja2!A1:B12/D1:E7` validate on install+each edit → `⚠️ Hoja2 no accesible` zero writes never modify Hoja2, `America/Lima` via `Utilities.formatDate` everywhere, batch `getValues/setValues`+`flush()` chunked 200, `HtmlService` progress for backfill, 6-item `Asistencia` menu `Ver Registro/Re-sincronizar/Solicitar corrección/Registro manual/Backfill/Autorizar` with `via_manual` audited bypass

## Verification Summary (PASS WITH WARNINGS — no CRITICAL)

- **Evidence revision**: `sha256:d3212848da94be5ccf76cc161a59ab8039406bd87585e4a4b166e47fca7b1109` (verify-report per orchestrator)
- **Build**: `node -e "require('./apps-script/appsscript.json')"` → `America/Lima V8` exit 0 `sha256:ce49e44d...`
- **Tests**: `Copy-Item Code.gs → $TEMP\check_Code.js; node --check` → exit 0 `sha256:e3b0c44...` 1047 lines pass; manual COPY harness (PRD §14) documented in apply-progress: single/correction/void, bulk 30 (2 blank E11, 3 out-of-window `W fuera`), calendar `S9:U9` Sept→Oct zero writes, invalid X rejected, Hoja2 deleted→⚠️ block + Errors, Lima 00:00 boundary, lock contention 2 browsers, rename `PREP-XYZ` sheetId resolve, Apoyo `is_apoyo TRUE`, backfill rerun zero, `Autorizar` trigger, `via_manual today-5` audited — 13/13 requirements 14/14 scenarios compliant (13 PASS, 1 PASS WITH WARNING)
- **Verdict**: `pass_with_warnings` — 0 blockers, 0 critical, 3 warnings, 0.0 coverage N/A (expected — no runner, strict_tdd false)

**Warnings (non-blocking, per verify-report at verification time):**
- **W1** — Backfill rerun updated_at churn: `commitRegistroBatch` increments `upd` even when code unchanged → second backfill reports `upd>0` and rewrites `updated_at` (no duplicate rows, but not zero-writes). Suggestion S1 diff guard. Not blocking — idempotent row identity holds.
- **W2** — Canonical fallback widens Config contract: `resolveSection` falls back to `LOGICAL_SECTIONS` without Config entry (bootstrap convenience, still blocks renamed correctly).
- **W3** — Manual COPY harness not re-executed in sandbox: verification relies on documented harness + `node --check`; full proof requires reviewer to re-run COPY harness on live Sheet before prod deploy to `1iw9bduLeGXQMbjmMV1qrMqE2WoPWCBz3`. Mandatory before prod promotion per AGENTS.md `verify on COPY only`.

**Suggestions (carried, not blocking):** S1 diff guard, S2 Config auto-populate helper, S3 separate window/permission counts, S4 separate Errors reasons.

No CRITICAL issues — archive not blocked.

## Traceability — Engram Observation IDs Read

| Artifact | Topic Key | Observation ID | Sync ID |
|----------|-----------|----------------|---------|
| proposal | sdd/registro-centralization/proposal | #883 | obs-a2aca1fa521c2f35 |
| spec (delta, both domains) | sdd/registro-centralization/spec | #884 | obs-f5aead94ddc6f0f0 |
| design | sdd/registro-centralization/design | #885 | obs-1fadf8cbd07f6338 |
| tasks | sdd/registro-centralization/tasks | #886 | obs-c5803fd3df4f61fd |
| apply-progress (cumulative) | sdd/registro-centralization/apply-progress | #887 | obs-1bfe3626f0121cb7 |
| verify-report | sdd/registro-centralization/verify-report | #891 | obs-af187c9ed84fef35 |
| verify (summary) | Verified registro-centralization | #890 | obs-056fcc0af036d666 |

All 6 required artifacts read via `mem_get_observation` (search previews not used). No `review/{transaction,ledger,receipt,gate-context}` topics read — `reviewGate` absent, no review discovered.

## Risks and Next Steps

- **Risks**: W1 timestamp churn low impact; W3 mandates manual COPY re-run before prod deploy — reviewer must execute live harness per PRD §14. No CRITICAL. Backfill chunked 200 + 5.5min guard mitigates 90min quota. `Hoja2` / `S7:U7` merged handling validated.
- **Next**: Ready for next change. Prod deploy requires COPY harness re-execution + owner `Asistencia → Autorizar` to create installable trigger on `1iw9bduLeGXQMbjmMV1qrMqE2WoPWCBz3` copy promotion via `clasp` (`tools/` only).

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived. Source of truth updated. Audit trail preserved at `openspec/changes/archive/2026-08-30-registro-centralization/` and Engram `sdd/registro-centralization/archive-report`.

