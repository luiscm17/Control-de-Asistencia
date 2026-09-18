# Proposal: Winding Shift Persistence

## Intent

Persist reusable `ctrl_embolsado` shift output as auditable, queryable item records without altering its live calculation behavior or losing history on form navigation.

## Scope

### In Scope
- Add one isolated `apps-script/winding/` Apps Script V8 project for `ctrl_embolsado`.
- Save eligible `B12:T23` item snapshots by explicit `M4` checkbox and menu actions; rehydrate primarily from the menu by date and shift.
- Create one locked, indexed DB-table upsert flow with error evidence and audit fields.

### Out of Scope
- Template layout, footer formulas, `Hoja 1`, `Instrucciones_y_Reglas`, payroll, imports, and per-cell persistence.
- Closed turno, supervisor, or title vocabularies; no title-to-meta table is introduced.

## Capabilities

### New Capabilities
- `winding-shift-persistence`: Persist and recover winding/packaging item records for a selected shift.

### Modified Capabilities
None.

## Approach

Use a small single-table repository modeled on `yarn-production`, with yarn-settings-style batch snapshot/validation and audit discipline. Trust native `H4` `dd/MM/yyyy`; derive the La Paz date key without script-side date-format validation. Save only rows with `B/C/D`; store blank `F:T` as `0`. Materialize first-column `id = fecha|turno|lote`; `item` is reference-only. Updates are idempotent and preserve creation audit data. Rehydrate writes/clears only `B:D` and `F:T`: `E12:E23` is formula-owned, snapshot-only on save, and never written or cleared. Missing form rows never auto-delete DB rows.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `apps-script/winding/` | New | Isolated save, repository, menu, setup, and trigger modules. |
| `ctrl_embolsado` | Modified | Configuration-driven form/DB integration; no layout or formula changes. |
| `docs/devanado/PRD-devanado.md` | Modified | Resolve naming and design-verification decisions if approved. |

## Open Items for Design

- Docs/PRD rename `devanado`→`winding`: **Recommend keep current path until an approved, atomic rename.**
- DB name: **Recommend `db_embolsado`** to match the production form and PRD.
- Corrective deletion: **Recommend a confirmed menu action with an explicit confirmation and audit log; never implicit deletion.**
- `M4/N4` placement: **Recommend validate live availability; otherwise use rows 8–9.**
- Row-29 notes: **Recommend exclude from v1 persistence.**
- Title→meta: **Recommend inspect the complete live formula/list before design; persist only its value snapshot.**
- Key normalization: **Recommend trim key components, preserve case, and reject/escape delimiter ambiguity without a closed vocabulary.**

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Historical PRD wording conflicts with identity | Medium | Treat `id`/PK `fecha|turno|lote`, with reference-only `item`, as authoritative. |
| Rehydrate damages formula meta | Medium | Exclude column `E` from every rehydrate write/clear range. |
| Unsaved data is overwritten | Medium | Menu-first recovery; automatic fallback only for a fully empty persisted zone. |

## Rollback Plan

Disable the installable trigger and remove the `Winding` menu; retain DB rows for audit. Revert the isolated project deployment only—do not change or clear `ctrl_embolsado` formulas or historical records.

## Dependencies

- A copy of the target spreadsheet for setup and manual GAS harness verification.
- Design-time live-sheet verification of placement, notes, and title-to-meta formula coverage.

## Success Criteria

- [ ] A valid explicit save upserts at most one record per `fecha|turno|lote` under a 5-second lock plus one retry in `America/La_Paz`.
- [ ] Recovery restores DB values without touching `E12:E23` or deleting absent historical rows.
- [ ] Missing keys, invalid eligible rows, and lock failures produce no unintended DB mutation and create usable error evidence.
