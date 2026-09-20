## Exploration: Winding production form persistence

### Current State
The repository contains isolated Google Apps Script V8 projects. `yarn-production` is the closest structural match: it reads a reusable form in bulk, filters eligible rows, normalizes blanks and numbers, builds explicit IDs, indexes the database, and performs locked upserts. Its `Form.gs` also demonstrates a checkbox-driven installable edit handler and date-change rehydration. `yarn-settings` provides the stronger persistence architecture: snapshot extraction and validation are separated from persistence planning, existing rows are indexed by logical keys, writes are serialized under `LockService.getDocumentLock()`, and multi-sheet mutations have compensation logic. All projects use `America/La_Paz`, `SpreadsheetApp.flush()`, audit fields, and manual GAS harnesses rather than a repository test runner.

The PRD defines a new isolated project under the `winding` namespace. The form is the existing `ctrl_embolsado` sheet, with native date `H4`, turno `J4`, supervisor `L4`, source rows `B12:T23`, formula-owned meta column `E`, and save checkbox `M4`. Rows are saved only when `B/C/D` are populated; blank operator cells become zero; `E` is snapshotted as a value but never touched during rehydrate. The database uses an explicit first-column `id` keyed by `fecha|turno|lote`, followed by frozen business columns and audit fields. Rehydrate is primarily menu-driven by date and turno, with guarded automatic fallback only when the form is empty.

### Affected Areas
- `docs/devanado/PRD-devanado.md` — approved functional source; contains the geometry, row rules, formula-owned column, key semantics, open questions, and database schema.
- `openspec/config.yaml` — establishes isolated GAS projects, manual verification, locale/timezone, and OpenSpec artifact conventions.
- `apps-script/yarn-production/Config.gs` — closest configuration pattern: isolated constants, ranges, schema, field indexes, checkbox trigger settings, and timezone.
- `apps-script/yarn-production/Form.gs` — closest form behavior pattern: checkbox event filtering/debounce, batch form reads/writes, and safe date-change loading.
- `apps-script/yarn-production/Repository.gs` — closest single-table pattern: batch lookup, duplicate-ID detection, locked upsert, retry, audit construction, and flush.
- `apps-script/yarn-production/Menu.gs` — public save/menu orchestration and user-facing result handling.
- `apps-script/yarn-settings/Ingest.gs` — reusable snapshot/validation boundary and source-range error reporting.
- `apps-script/yarn-settings/Persistence.gs` — indexed mutation-plan pattern, created-field preservation, explicit deletes, and rollback/compensation.
- `apps-script/yarn-settings/Core.gs` — serialized save orchestration with validation, lock acquisition, persistence, error logging, and toast responses.
- `apps-script/yarn-settings/Config.gs` — schema/setup/header protection and checkbox configuration conventions.

### Approaches
1. **Single-table winding repository modeled on yarn-production** — implement `winding` as a small isolated project with one config, one batch ingest module, one repository, one menu, and one installable checkbox handler. Build an `id` index, upsert eligible rows, preserve `creado` on updates, and load rows by `fecha + turno`.
   - Pros: closest fit to one DB sheet and at most 12 item rows per shift; low surface area; easy to manually verify; keeps the 400-line review budget more achievable.
   - Cons: needs careful custom handling for `E` formula ownership, non-destructive rehydrate clearing, supervisor restoration, and explicit no-auto-delete semantics; less transactional protection than yarn-settings.
   - Effort: Medium

2. **Snapshot/plan/apply repository modeled on yarn-settings** — separate form snapshot and validation, indexed persistence plan, application, rollback receipt, and orchestration seams, while retaining one winding DB sheet.
   - Pros: strongest separation of concerns; easier unit-style harness testing; safer if future requirements add corrective deletion or multiple related tables; explicit audit and failure paths.
   - Cons: disproportionate complexity for one small table; rollback of appended/updated rows increases implementation and verification burden; likely exceeds the focused change budget when combined with setup and tests.
   - Effort: High

3. **Direct bulk append/overwrite by date and turno** — replace all matching DB rows for the current shift in one operation.
   - Pros: simple initial implementation and straightforward rehydrate query.
   - Cons: violates the PRD's idempotent per-`id` upsert semantics, risks deleting historical rows or losing audit/create metadata, and creates race windows without a robust index under lock.
   - Effort: Low initially, High risk

### Recommendation
Use Approach 1 with the yarn-settings discipline applied selectively: batch snapshot extraction, explicit validation, a locked indexed upsert, audit preservation, structured error logging, and a small public menu orchestrator. Do not copy yarn-production's date parser because the PRD explicitly trusts the native `H4` date value and forbids script-side format validation. Keep `E12:E23` completely outside rehydrate writes and clears. Rehydrate should read all matching rows once, map by `lote`, clear only `B:D` and `F:T` in a single batch write, and restore `L4` from a deterministic matching record. Keep the project isolated and use `winding` for all new identifiers; retain `ctrl_embolsado` as the configured real form sheet name.

Before design, resolve the remaining PRD questions: verify the live title-to-meta formula and operator/header geometry, confirm `M4/N4`, confirm whether row 29 notes are excluded, and define the explicit corrective deletion path. Also record as proposal decisions whether the documentation directory/PRD should be renamed from `devanado` to `winding`, and whether the DB sheet should be `db_embolsado` or `db_winding`; neither should be implemented implicitly.

### Risks
- **Requirements contradiction risk:** the PRD text retains historical wording in places; the authoritative current decision is `id = fecha|turno|lote`, with `item` reference-only. Design/spec must normalize this before code.
- **Formula ownership risk:** writing or clearing `E12:E23` during rehydrate would destroy live formulas and violate the core requirement.
- **Date identity risk:** using string parsing or browser/UTC dates can shift the native `H4` value or produce a key different from the stored date. Capture the native `Date` and derive a La Paz key only for the ID.
- **Key collision risk:** turno is open text and lote is user-entered; delimiters, whitespace, and case normalization need a documented policy without inventing a closed vocabulary.
- **Partial-write risk:** a loop of per-row writes can leave a partially saved shift. Build the index and mutation decisions under one document lock, and prefer batched append plus controlled in-place updates.
- **Rehydrate overwrite risk:** automatic fallback must never overwrite unsaved data. The emptiness check must cover the complete persisted form zones, not only one representative cell.
- **Audit identity risk:** `Session.getActiveUser()` can be unavailable in some executions; define the fallback and ensure installable-trigger execution still records a useful editor value.
- **Schema drift risk:** the DB header order is frozen, while the DB sheet name and documentation namespace remain open decisions. Setup must validate headers rather than silently reorder existing data.
- **No automated runner:** verification requires a copied spreadsheet and manual GAS Logger/harness execution; tests should target pure snapshot/key/row-normalization helpers where practical.

### Ready for Proposal
Yes. The implementation direction is sufficiently bounded for proposal/spec/design. The proposal should explicitly carry the namespace decision, the `id`/PK decision, the formula-owned `E` rule, no-auto-delete behavior, and the two naming decisions as open proposal questions.
