# Apply Progress: Winding Shift Persistence

## Slice

- Delivery strategy: auto-chain
- Chain strategy: feature-branch-chain
- Current slice: PR 2 of 3 — Snapshot and Persistence
- Branch: `sdd/winding`
- Mode: Standard (strict TDD inactive; no repository test runner)

## Completed Tasks

- [x] 1.1 Create the V8 `America/La_Paz` Apps Script manifest.
- [x] 1.2 Create frozen configuration for the 26-column DB, Errors table, form geometry, and setup constants.
- [x] 1.3 Create the manual RED helper-seam harness.
- [x] 1.4 Create idempotent setup for schema validation, protection, validations, and one installable edit trigger.
- [x] 2.1 Create batch snapshot capture for trusted native dates, normalized identity, displayed E snapshots, row eligibility, zero-filled operators, and error evidence.
- [x] 2.2 Extend the manual helper harness with invalid-key, duplicate-ID, lock-timeout, idempotent-upsert, and no-implicit-delete seams.
- [x] 2.3 Create locked, read-once indexed repository upsert with La Paz audit, editor fallback, and frozen Errors appends.

## Work Unit Evidence

| Evidence | Exact result |
|---|---|
| Focused static command | `python3 -m json.tool apps-script/winding/appsscript.json`; `git show HEAD:apps-script/winding/{Config,Setup,tests/Winding.test}.gs \| node --check --input-type=commonjs`; `git diff --check main...HEAD` — exit 0. |
| Static header/shape check | `git diff --stat main...HEAD` — 4 files changed, 284 insertions; `Config.gs` declares 26 DB headers with indexes `0..25`, and recovery contracts remain unimplemented RED seams. |
| Runtime harness | COPY-only `windingTestHelpers_` in the Apps Script editor — not executed locally because Apps Script cannot run in this workspace. Expected current result: `❌` seam lines until Phase 2/3 helper implementations are added. Human must run it on a COPY after later slices. |
| Rollback boundary | Revert commits `3c68590`, `ecb356b`, `da58e0e`, and `9d3f430` to remove only `apps-script/winding/`; no sibling Apps Script project was changed. |

### PR 2 — Snapshot and Persistence

| Evidence | Exact result |
|---|---|
| Focused static command | `git show :apps-script/winding/Config.gs :apps-script/winding/Snapshot.gs :apps-script/winding/Repository.gs :apps-script/winding/tests/Winding.test.gs \| node --check --input-type=commonjs` — exit 0. |
| Focused helper-seam command | Node VM loading the staged four GAS files and running `windingTestHelpers_` with a La Paz `Utilities.formatDate` stub — `manual-harness-pure-seams passed=12 failed=0`, exit 0. This is a local pure-helper surrogate, not an Apps Script execution. |
| Runtime harness | COPY-only `windingTestHelpers_`, save/re-save, and Errors inspection in the Apps Script editor — not executed in this workspace. Apps Script runtime access is unavailable locally; no runtime result is claimed. |
| Rollback boundary | Revert `32f9cd8` to remove only `Snapshot.gs`, `Repository.gs`, and the Phase 2 helper seams; it retains prior schema/setup and any DB rows already created on a COPY. |

## Commits

- `3c68590` — `chore(winding): add Apps Script manifest`
- `ecb356b` — `feat(winding): add frozen persistence configuration`
- `da58e0e` — `test(winding): add red helper seam harness`
- `9d3f430` — `feat(winding): add idempotent setup and trigger reconciliation`
- `32f9cd8` — `feat(winding): persist validated shift snapshots`

## Remaining Tasks

- [ ] Phase 3 — Workflow and Safe Recovery
- [ ] Phase 4 — Copy-only Rollout Verification

## Human COPY Verification Pending

1. Open a COPY of `ctrl_embolsado` in Apps Script and add this isolated project.
2. Run `windingSetup`, authorize it, and inspect the manifest timezone, frozen/protected headers, form formulas, rows 10–11/29, validations, and exactly one `windingOnEdit` trigger.
3. Run `windingTestHelpers_`; its RED seams are expected to fail until their Phase 2/3 implementations land.
