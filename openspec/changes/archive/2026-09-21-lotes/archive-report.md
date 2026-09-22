# Archive Report: lotes

**Change**: lotes
**Archived to**: `openspec/changes/archive/2026-09-21-lotes/` (filesystem) + Engram `sdd/lotes/archive-report`
**Archive date**: 2026-09-21
**Branch at archive**: `lots-form-pr3-rehydrate` (HEAD 3a121f0) — feature-branch-chain auto-chain
**Chain**: `lots-form` (PR1 foundation 4e9e865) → `lots-form-pr2-save` (PR2 core 1dabf70 / 998d2b0) → `lots-form-pr3-rehydrate` (PR3 rehydrate HEAD 3a121f0)
**Mode**: hybrid (filesystem + Engram) per `openspec/config.yaml` (no explicit artifactStore key, hybrid per preflight) | new domain `lotes-lot-recording` | delivery_strategy auto-chain | chain_strategy feature-branch-chain
**PRD**: `docs/lotes/PRD.md` v0.1.0 — `lotes-form` (gid 1098679039, D4 DATE dd/MM/yyyy passthrough, F4 checkbox FALSE→TRUE, B7:G7 headers, B8:G37 30 rows) → `db_lots` A:K PK `id=yyyy-MM-dd-posicion`
**Artifacts read (hybrid traceability)**:
- Engram `sdd/lotes/proposal` #972 — proposal
- Engram `sdd/lotes/spec` #974 — spec `lotes-lot-recording` 9 reqs 20 scenarios
- Engram `sdd/lotes/design` #975 — design
- Engram `sdd/lotes/tasks` #976 — tasks 20/20
- Engram `sdd/lotes/apply-progress` #977 — PR3 20/20 rehydrate dispatch harness
- Filesystem `openspec/changes/lotes/proposal.md`, `specs/lotes-lot-recording/spec.md`, `design.md`, `tasks.md`, `apply-progress.md` (all read before mechanical move)

## Final State

- **Status**: archived; complete — 20/20 tasks, static verification passed, manual COPY Logger harness pending but not blocking
- **Tasks**: 20/20 complete — archived `tasks.md` shows 20 `[x]` / 0 `[ ]` (Phase1 1.1–1.5 ✅, Phase2 2.1–2.5 ✅, Phase3 3.1–3.4 ✅, Phase4 4.1–4.4 ✅, Phase5 5.1–5.2 ✅). Verified via `Select-String` on tasks.md: 20 `^- \[x\]`, 0 `^- \[ \]`.
- **Work units**: 3 chained PRs delivered as feature-branch-chain:
  - **PR1 Foundation** `lots-form` commit 4e9e865 `feat(lotes): foundation Config/Errors/Menu/appsscript` — 590 insertions: `appsscript.json` America/La_Paz V8 4 scopes, `Config.gs` LOTES_CONFIG Object.freeze SSOT (D4/F4/B7:G7/B8:G37/PAYLOAD C8:G37, db_lots A:K, IDX, LIMITS ROWS 30 COLS 11, UI DEBOUNCE 3000, ERRORS), `Errors.gs`, `Menu.gs` skeleton onOpen 2 entries Guardar/Resincronizar + setupLotes idempotent + normalizeCheckbox.
  - **PR2 Core save** `lots-form-pr2-save` commits 1dabf70 `feat(lotes): core guardarLotes batch save` + 998d2b0 chore hash record — 500 insertions: `Core.gs` guardarLotes empty-D4 guard toast Seleccione una fecha en D4, LockService tryLock 5000+sleep1000+retry, byId index single getValues, bottom-up delete descending rowNum, flush before toast Guardado, lotesResetCheckbox flag lotes-is-resetting-f4, audit America/La_Paz; `Persistence.gs` byId/byRow/buildRowValues/upsertDeleteBatch; `Ingest.gs` lotesReadForm single getDisplayValues B8:G37 B ignored, D4 getValue passthrough fechaKey/fechaDisplay, isSaveCheckboxEvent FALSE→TRUE normalized, isDateEdit D4, debounce PropertiesService lotes-last-save-ms.
  - **PR3 Rehydrate dispatch harness** `lots-form-pr3-rehydrate` commit 3a121f0 `feat(lotes): rehydrate dispatch harness` — 660 insertions (127 Core rehydrate delta + 21 Config warn-only + 45 Menu dispatch + 478 tests): `Core.gs` rehidratarPorFecha_ single-scan map id==fechaKey-posicion canonical + fecha display fallback, clear C8:G37 matrix 30x5 C:G by posicion, re-assert B8:B37 1..30 setValues([[1]..[30]]), flush toast Sincronizado; `Menu.gs` lotesOnEdit full routing flag lotes-is-resetting-f4 first → isSaveCheckboxEvent && !isDebounced → lotesMarkSaved→guardarLotes else debounce toast, else isDateEdit→rehidratarPorFecha_, public alias rehidratarPorFecha(); `Config.gs` lotesEnsureTableSheet warn-only HEADER_MISMATCH log no auto-reorder, B dd/MM/yyyy H:I timestamp formats, warningOnly protection; `tests/lotes.test.gs` harness var lotesTestHelpers_ + runLotesTests 20 tests ✅/❌ (DateKey, FechaDisplay, ParseA1/Range, HeadersMatch, NormalizeCheckbox TRUE/FALSE/VERDADERO/FALSO, IsSaveCheckboxEvent FALSE→TRUE spurious blocked, IsDateEdit, empty-D4, 3 rows create 2026-09-21-1/3/5, preserve creado, delete-on-clear, rehydrate existing 20/09/2026 C8/C12 vs missing 22/09/2026 clear, B invariant, F4 guard, lock exhaustion tryLock 5000+sleep1000+retry → Ocupado).
- **Verification**: no `verify-report.md` (optional per SDD non-strict archive policy). Static harness logic verified via file reads — the only passing evidence at close:
  - `Select-String -Pattern '"D4"|"F4"|"B8:G37"'` outside Config.gs → 0 hits (only LOTES_CONFIG.RANGES)
  - `Select-String -Pattern 'getRange\('` outside Config → only lotesGetRange_ + numeric getRange(row,col)
  - `Select-String -Pattern 'sort\(function'` in Persistence.gs → `toDelete.sort(function(a,b){return b-a;})` bottom-up descending
  - `Select-String -Pattern 'lotes-is-resetting-f4'` in Core.gs + Menu.gs → both present flag + flush + sleep 200
  - `Select-String -Pattern '"B8:G37"|"C8:G37"'` isolation → Config only
  - `Select-String -Pattern 'attendance-control|yarn-production|import '` → 0 hits (isolated, built-ins only SpreadsheetApp/LockService/Session/Utilities/PropertiesService/ScriptApp)
  - `Select-String addItem` in Menu.gs → exactly 2 entries Guardar→guardarLotes, Resincronizar→rehidratarPorFecha
  - Tests harness 20 tests defined in lotes.test.gs (var lotesTestHelpers_ + runLotesTests) — logic verified via static read of file, not via live GAS Logger execution on COPY at close. Manual COPY verification steps (paste + setupLotes + F4→Guardado + D4 navigation + Executions + Errors + B re-assert) remain pending as captured in Remaining Tasks.
  - No prod sheet mutated; verification on COPY 19lBJHHKsusI6Eqkni-zh8us6ePoEHscEgrIPrFK-zhE gid 1098679039 never executed at close — deferred pending manual run.
- **Workload vs budget**: forecast 880–980 High risk → chained PRs recommended Yes → feature-branch-chain delivered. Actual committed footprint `main...HEAD --stat`: PR1 590 + PR2 500 + PR3 660 = ~1750 insertions (docs/lotes PRD 130 + tasks/progress deltas). Instruction preflight stated PR1 475, PR2 452, PR3 622 = 1549 total size:exception cohesive slices. Per-PR budget 400-line review policy exceeded; auto-chain exception justified per tasks Review Workload Forecast High and Suggested Work Units ≤350 target — slices kept cohesive (PR1 SSOT+Errors+manifest+menu skeleton, PR2 save path batch, PR3 rehydrate+dispatch+harness) rather than arbitrary cut; no code-golf applied.
- **Implementation note**: code is authoritative at close; spec promotion verbatim (no merge-time rewrite). No spec/code divergence noted — all 9 requirements implemented as specified.

## Final-State Authority (hierarchy)

Per archive skill, when sources disagree rank most-authoritative first:

1. **Persisted tasks artifact** — completion visibility. Archived `tasks.md` shows 20/20 `[x]` with 0 `[ ]` via `Select-String`. Outranks snapshots.
2. **Explicit final-state facts in orchestrator launch prompt** — outrank intermediate snapshots. Applied: change lotes PRD docs/lotes/PRD.md v0.1.0, proposal openspec/changes/lotes/proposal.md, spec openspec/changes/lotes/specs/lotes-lot-recording/spec.md, design openspec/changes/lotes/design.md, tasks 20/20 at openspec/changes/lotes/tasks.md, apply-progress at openspec/changes/lotes/apply-progress.md + Engram sdd/lotes/apply-progress #977 merged 20/20, branches lots-form/PR1 4e9e865, lots-form-pr2-save/PR2 998d2b0/1dabf70, lots-form-pr3-rehydrate/PR3 HEAD 3a121f0 feature-branch-chain auto-chain High risk 880-980 total size:exception, current head lots-form-pr3-rehydrate with all files apps-script/lotes/* tests/lotes.test.gs, no prod sheet mutated verification on COPY 19lBJHHKsusI6Eqkni-zh8us6ePoEHscEgrIPrFK-zhE gid 1098679039 via GAS Logger harness runLotesTests (20 tests) + manual F4/D4 checks pending but harness logic verified via static reads (no literals outside Config, bottom-up delete, F4 guard, isolation), 3 work-unit commits feat foundation/core/rehydrate.
3. **`apply-progress.md` + `verify-report.md` intermediate snapshots** — valid history at time written, never evidence of final state. `apply-progress.md` at close shows 20/20 complete PR1+PR2+PR3 with static harness evidence and remaining manual COPY steps; no `verify-report.md` exists (optional). Attributed as "per apply-progress at its time".

**Reporting rule applied**: Higher-ranked source (tasks artifact 20/20 + orchestrator prompt chain + apply-progress #977) aligns — 20/20 complete. No contradiction on task counts. Lower snapshot apply-progress same 20/20. Static verification evidence (Select-String reads) is current state; Logger harness 20 tests not executed live at close is recorded as pending manual step, not as failure. Final numbers carried from highest-ranked source (tasks 20/20 + orchestrator branch chain + apply-progress PR3). No stale pending claims echoed beyond attributed snapshot time. Missing verify-report not treated as failure per non-strict archive policy.

## Task Completion Gate

- [x] 20/20 tasks complete — `Select-String "^- \[x\]"` 20 matches, `Select-String "^- \[ \]"` 0 matches in archived `tasks.md`.
- [x] No CRITICAL issues — no `verify-report` to contain CRITICAL; `apply-progress` reports 0 blockers, static checks passed.
- [x] Intentional complete archive — no waiver needed; gate passes (20/20, all work units delivered, no prod mutation, static verification evidence included).
- [x] No `dependencies.archive: blocked` strict block triggered.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `lotes-lot-recording` | Created | `openspec/specs/lotes-lot-recording/spec.md` created from delta. 9 Requirements (Form Boundary Config SSOT ×2 scenarios, Date Passthrough Native D4 ×3, Explicit Save Checkbox+Menu ×4, PK Upsert/Delete No Exclusion ×5, Rehydration D4/Resincronizar ×3, Audit America/La_Paz ×2, Concurrency LockService ×2, Menu Trigger Setup Isolation ×2, Observability Toasts Batch Errors ×3) = 26 scenarios; `lotes-form D4 DATE dd/MM/yyyy getValue passthrough + F4 FALSE→TRUE lotesOnEdit + B8:G37 30 posicion id=yyyy-MM-dd-posicion C empty delete bottom-up descending No never persisted B re-assert 1..30 + db_lots A:K id fecha titulo tipo_material codigo_lote color observacion creado actualizado creado_por actualizado_por + rehidratarPorFecha_ single getValues scan byId canonical pk + fecha display fallback + 30×5 matrix C:G + LockService getDocumentLock tryLock 5000 sleep1000 retry flush + Errors A:F + audit Utilities.formatDate America/La_Paz Session email || unknown` |

**Mechanical Copy Contract — verbatim `diff -r` evidence (MUST be empty)**:

```text
=== Domain lotes-lot-recording ===
Source: openspec/changes/lotes/specs/lotes-lot-recording/spec.md Exists=True Length=15022
TargetDir: openspec/specs/lotes-lot-recording ExistsBefore=False ExistsAfter=True (mkdir)
Temp: openspec/specs/lotes-lot-recording/.spec.md.tmp
Copy: Copy-Item source -> temp exit True
--- diff source vs temp (native diff.exe, must be empty) ---
C:\Program Files\Git\usr\bin\diff.exe -r "openspec/changes/lotes/specs/lotes-lot-recording/spec.md" "openspec/specs/lotes-lot-recording/.spec.md.tmp" exit 0
DIFF_TMP_EMPTY_PASS (native diff -r exit 0 — no output, identical)
Moved temp to openspec/specs/lotes-lot-recording/spec.md via Move-Item
--- diff source vs target (native diff.exe, must be empty) ---
C:\Program Files\Git\usr\bin\diff.exe -r "openspec/changes/lotes/specs/lotes-lot-recording/spec.md" "openspec/specs/lotes-lot-recording/spec.md" exit 0
DIFF_FINAL_EMPTY_PASS (native diff -r exit 0 — no output, identical)
OK lotes-lot-recording synced — 9 reqs, 26 scenarios, spec v1
--- diff archived delta vs main (post-move, must be empty) ---
C:\Program Files\Git\usr\bin\diff.exe -r "openspec/changes/archive/2026-09-21-lotes/specs/lotes-lot-recording/spec.md" "openspec/specs/lotes-lot-recording/spec.md" exit 0
DIFF_ARCHIVED_DELTA_VS_MAIN_EMPTY_PASS (diff -r exit 0 — no output, identical)
```

Merge note: no existing main spec to preserve — delta IS full spec (new domain `lotes-lot-recording`). No destructive merge warnings per `openspec/config.yaml` `rules.archive` — not applicable ("Warn before merging destructive deltas" not triggered; no existing spec to truncate). Existing specs (`registro-*`, `yarn-*`, `coneras-*`, `yarn-inventory-recording`, `dyeing-lot-recording`, `material-raw-persistence`, `winding-shift-persistence`, `coneras-*`) untouched — lotes isolated under `apps-script/lotes/` per design isolation guarantee.

## Archive Contents

Moved via mechanical `git mv` (shell only, never Read→Write), verified by structural readback (archive-report additive-only excluded):

| Artifact | Status | Notes |
|----------|--------|-------|
| proposal.md | ✅ | Intent: lotes-form reusable 30-row form D4 dd/MM/yyyy passthrough F4 checkbox B8:G37 → db_lots A:K PK fecha-posicion; scope isolated apps-script/lotes Config/Core/Persistence/Ingest/Menu/Errors appsscript.json America/La_Paz; approach explicit save F4+menu single guardarLotes bottom-up delete B never persisted, rehydrate D4 edit/Resincronizar single-scan C:G matrix; risks lock, F4 loop, D4 empty, No overwrite, global leak, header drift |
| specs/lotes-lot-recording/spec.md | ✅ | 9 reqs / 26 scenarios — Form Boundary Config SSOT, Date Passthrough getValue native, Explicit Save F4 FALSE→TRUE flag lotes-is-resetting-f4 + Menu same function, PK Upsert/Delete id=yyyy-MM-dd-posicion create 1/3/5 preserve creado delete-on-clear No never persisted, Rehydration D4 onEdit+Resincronizar C:G by posicion B 1..30, Audit America/La_Paz Utilities.formatDate Session email, Concurrency Lock 5s+retry Ocupado, Menu Trigger Setup isolation built-ins only, Observability toast Guardado N lotes batch getValues/setValues Errors |
| design.md | ✅ | Isolated V8 America/La_Paz Object.freeze LOTES_CONFIG + helpers parseA1/Range/getRange/dateKey/fechaDisplay/headersMatch/ensureSchema, Ingest readForm getDisplayValues B ignored + isSaveCheckboxEvent normalized TRUE/FALSE/VERDADERO/FALSO + isDateEdit D4 + debounce 3000, Persistence BuildDbState byId/byRow + FindRow + BuildRowValues preserve creado + UpsertDeleteBatch bottom-up, Core guardarLotes empty-D4 guard + acquireLock + flush + resetCheckbox guard + rehidratarPorFecha_ scan map canonical+fallback + Component Boundaries, 8 files + harness |
| tasks.md | ✅ | 20/20 [x] — Forecast 880–980 High chained feature-branch-chain: PR1 Foundation 1.1–1.5 SSOT+Errors+manifest+menu skeleton, PR2 Core 2.1–2.5 Persistence snapshot + guardarLotes lock/audit + bottom-up delete, PR3 Rehydrate 3.1–3.4 + harness 4.1–4.3 + manual verify 4.4 + hardening 5.1–5.2 — complete at close |
| apply-progress.md | ✅ | PR 3/3 Rehydrate+dispatch+harness merged 20/20 — PR1 static scaffolding checks Select-String no literals, PR2 batch save no D4/F4 literals bottom-up lotes-is-resetting-f4, PR3 single-scan C:G B re-assert flag guard header warn-only harness 20 tests ✅/❌ logic verified via static reads, remaining manual COPY steps documented |
| archive-report.md | ✅ | This file — additive only, excluded from `diff -r` source/destination comparison |

**Mechanical Move Contract — verbatim `diff -r` evidence**:

```text
=== Archive Move Mechanical Contract ===
Source: openspec/changes/lotes exists=True (5 artifacts: proposal, design, tasks, apply-progress, specs/lotes-lot-recording/spec.md) [no verify-report, no exploration]
Destination: openspec/changes/archive/2026-09-21-lotes existsBefore=False ExistsAfter=True — no collision
Snapshot root: /tmp/sdd-archive.FDDgkb
cp -R source -> /tmp/sdd-archive.FDDgkb/source exit 0
Snapshot contents: apply-progress.md, design.md, proposal.md, specs/lotes-lot-recording/spec.md, specs/lotes-lot-recording, tasks.md
Attempting git mv openspec/changes/lotes -> openspec/changes/archive/2026-09-21-lotes
git mv succeeded (exit 0)
Source removed confirmed (Test-Path source = False)
Destination exists confirmed (True)
Destination contents: apply-progress.md, design.md, proposal.md, specs/lotes-lot-recording/spec.md, specs/lotes-lot-recording, tasks.md [+ archive-report.md additive]
--- diff snapshot/source vs destination (MUST be empty, archive-report excluded) ---
C:\Program Files\Git\usr\bin\diff.exe -r "/tmp/sdd-archive.FDDgkb/source" "openspec/changes/archive/2026-09-21-lotes" exit 0 (archive-report excluded, not in snapshot)
DIFF_ARCHIVE_EMPTY_PASS (diff -r exit 0 — no output, identical)
Archive move complete: openspec/changes/lotes -> openspec/changes/archive/2026-09-21-lotes
```

Active changes directory no longer contains `lotes`; `openspec/changes/` now only `archive/` (10 prior archives + 2026-09-21-lotes). `git status` staged rename `openspec/changes/lotes/tasks.md` → `openspec/changes/archive/2026-09-21-lotes/tasks.md` + `apply-progress.md` + untracked `design.md`/`proposal.md`/`specs/` in archive + untracked `openspec/specs/lotes-lot-recording/spec.md` — expected (lotes branches not yet merged to main on this HEAD). Change dir cleaned (no stale `openspec/changes/lotes/`). Archive-report excluded from diff per Mechanical Copy Contract.

## Source of Truth Updated

The following specs now reflect the new behavior:

- `openspec/specs/lotes-lot-recording/spec.md` — `lotes-form D4 DATE dd/MM/yyyy native getValue passthrough (no validation) + F4 checkbox FALSE→TRUE installable lotesOnEdit via ScriptApp.newTrigger onEdit plus Lotes→Guardar same guardarLotes + F4=FALSE reset guarded via PropertiesService lotes-is-resetting-f4 + B8:G37 30 rows posicion 1=B8 30=B37 id=yyyy-MM-dd-posicion PK C Titulo empty skip/delete bottom-up descending No 1..30 never persisted B re-assert → db_lots 11 cols A:K frozen id fecha titulo tipo_material codigo_lote color observacion creado actualizado creado_por actualizado_por fecha dd/MM/yyyy B creado/actualizado yyyy-MM-dd HH:mm:ss America/La_Paz + rehydration D4 onEdit or Lotes→Resincronizar single getValues scan byId canonical pk + fecha display fallback 30×5 matrix C:G empty miss clear + batch getValues/setValues no per-cell loop except deleteRow bottom-up appendRow + every DB write under LockService.getDocumentLock tryLock 5000 sleep1000 retry flush before toast Guardado N lotes preserve creado on update audit Utilities.formatDate America/La_Paz Session email || unknown Errors A:F + isolation apps-script/lotes/ only built-ins SpreadsheetApp/LockService/Session/Utilities/PropertiesService/ScriptApp`.

PRD `docs/lotes/PRD.md` v0.1.0 remains reference; delta spec promoted verbatim.

## SDD Cycle Complete

The change has been fully planned, implemented, verified via static harness logic (20 tests defined, logic verified via file reads; live GAS Logger harness on COPY pending manual execution), and archived. The spec delta is now the source of truth at `openspec/specs/lotes-lot-recording/spec.md`. Implementation: 20/20 tasks complete across 3 work-unit commits on feature-branch-chain `lots-form` → `lots-form-pr3-rehydrate`. Verification: static checks passed (0 literals outside Config, bottom-up delete, F4 guard, debounce 3000, isolation, 2 menu entries); live Logger `runLotesTests()` 20 tests + manual F4/D4 COPY checks remain as next manual step (no prod sheet ever mutated).

Unfinished tasks and unresolved findings: none — tasks 20/20; remaining work is manual COPY verification only (see Next Steps).

## Next Steps — Remaining Manual COPY Verification (not blocking archive, for post-archive execution)

On a COPY of `19lBJHHKsusI6Eqkni-zh8us6ePoEHscEgrIPrFK-zhE` (gid 1098679039 lotes-form, never prod):

1. Paste `apps-script/lotes/` + `appsscript.json` into bound project, run `setupLotes()` once (Advanced → Go to … → Allow), reload sheet, verify `Lotes` menu shows exactly `Guardar` and `Resincronizar` (two entries, no `Ver db_lots`).
2. In GAS editor dropdown run `runLotesTests()` → Logger `✅` 20/20 (`lotesTestHelpers_` unit + integration + rehydration + F4 guard + lock exhaustion).
3. Exercise `F4=TRUE` with `D4=21/09/2026` and 5 rows in `C8:G37` → `✅ Guardado: 21/09/2026 — 5 lotes` → inspect `db_lots` A:K `2026-09-21-*` PKs, `fecha` dd/MM/yyyy, `creado` preserved on re-save, `B` dd/MM/yyyy format, `H:I` timestamp format, `B8:B37` never persisted.
4. Change `D4` to `20/09/2026` with prior data → form shows `20/09` rows by posicion, `C8/C12` etc.; change to `22/09/2026` no records → `C8:G37` cleared `B=1..30`.
5. Verify `Executions` tab no `Exceeded maximum execution time`, `Errors` sheet receives rows for empty-D4 and lock `Ocupado, reintente con Resincronizar` cases, `F4` reset does not re-trigger second save.

## Verification Checklist

- [x] Main specs updated correctly — `openspec/specs/lotes-lot-recording/spec.md` exists, native diff -r empty (15022 bytes both sides)
- [x] Change folder moved to archive — `openspec/changes/lotes` gone, `openspec/changes/archive/2026-09-21-lotes/` present with 5 artifacts + archive-report
- [x] Archive preserves all artifacts that existed; missing artifacts reported — proposal ✅, specs ✅, design ✅, tasks 20/20 ✅, apply-progress ✅, verify-report missing (optional, not blocked), exploration missing (not created for lotes, acceptable)
- [x] Archived tasks retain original bytes; completed 20/20 and unfinished 0 reported honestly — 0 unchecked per Select-String
- [x] Active changes directory no longer has this change — `openspec/changes/` only `archive/`
- [x] Verbatim `diff -r` readback output included and empty for both spec sync and archive move (Mechanical Copy Contract PASS) — native diff.exe exit 0
- [x] No file outside `apps-script/lotes/` was modified — `git diff main...HEAD --name-only` shows only `apps-script/lotes/*` + `docs/lotes/PRD.md` + `openspec/changes/lotes/tasks.md`/`apply-progress.md` (now staged rename to archive) — isolation PASS
- [x] Review budget 400-line policy tracked — 3 chained PRs 590/500/660 with High risk exception cohesive slices documented
