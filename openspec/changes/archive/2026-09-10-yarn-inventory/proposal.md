# Proposal: Yarn Inventory

## Intent

Two daily templates (`madejeras` A1:K21, `lotes` A1:R1002) lose history on date change; formulas are sheet-only `IF`/`SUM`. Persist each via explicit shift-close into `db_madejeras` (A:Q 17 cols, PK fecha,turno,maquina,lado) + `db_lotes` (A:X 24 cols, PK fecha,turno,lote_id→rowIndex) storing only inputs; formulas recalculate on re-fill. Source: `docs/yarn-inventory/PRD.md` v0.2.0 §4–§10.

## Scope

### In Scope
- Isolated `apps-script/yarn-inventory/` V8 project (`appsscript.json` `America/La_Paz`) — Config, Core, Persistence, Ingest, Menu, Errors
- `Inventario` menu: Guardar Madejeras | Guardar Lotes | Guardar Todo + Ver DBs + Re-sincronizar; batch upsert ≤10+≤47 rows per `fecha+turno`, `estado=void` soft-delete
- Input-only (`madejeras C8:G17`, `lotes A6:F52`+`H6:O52`); fecha native DATE no timezone; `America/La_Paz` only for `creado`/`actualizado`

### Out Of Scope
- Dashboard/charts, calculator blocks, hardware, `EXCEDIDO` alerts, web app, undo, cross-form JOIN, row history
- Any change to attendance/yarn-production/yarn-settings/coneras-production or `Registro`

## Capabilities

### New Capabilities
- `yarn-inventory-recording`: Form hydration + explicit auditable persistence (2 DBs, fecha+turno filter)

### Modified Capabilities
- None

## Approach

Single `YARN_INVENTORY_CONFIG` SSOT (all A1/ranges, headers, lists, formula guards) — pattern `yarn-production/Config.gs` + `coneras-production/Config.gs`. Menu-only save (reject M4 checkbox/debounce: 2 forms would need 2 checkboxes + 3s complexity for ≤57 rows). One `LockService.getDocumentLock()` per save (5s+1 retry); `Guardar Todo` sequential madejeras→lotes, partial failure logged not rolled back (idempotent retry). Batch reads/writes scoped to input ranges; `H8:K17`/`G/P/Q/R` never touched.

**Tradeoffs:** 2 DBs>1 (independent lifecycles, no sparse union); input-only>snapshot (English formulas stay verbatim, DB queryable); sequential lock>parallel (avoids deadlock).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps-script/yarn-inventory/Config.gs` | New | `YARN_INVENTORY_CONFIG` — sheets, ranges, headers, PKs, validations |
| `apps-script/yarn-inventory/Core\|Persistence\|Ingest\|Menu\|Errors.gs` | New | Hydration, locked upsert/void, routing, menu, `Errors` |
| `docs/yarn-inventory/PRD.md` | Reference | v0.2.0 §4–§10 source |
| `openspec/specs/yarn-inventory-recording/spec.md` | New | Spec at archive |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Overwrite formulas (`H8:K17`, `G/P/Q/R`) | Med | Config guards + range-scoped batches; harness |
| PK collision (`lote_id` empty/dup) | Med | Row-index fallback; last-row-wins + toast |
| Concurrency corruption | Low | Document lock + idempotent PK; Re-sincronizar |
| Fecha timezone drift | Low | Native DATE as-is; La_Paz only for audit strings |

## Rollback Plan

Remove trigger/menu deployment from COPY; keep `db_madejeras`/`db_lotes` intact. Restore version history or delete rows by `editado_por` of failed deploy. Never prod `1RCupngk5x95ev5N4Zv0veMMbOhz6eH_9Vs44a1txE3s` until COPY passes.

## Dependencies

- Sheet COPY `1RCupngk5x95ev5N4Zv0veMMbOhz6eH_9Vs44a1txE3s` (madejeras, lotes, db_madejeras, db_lotes, Errors)
- Owner installable trigger auth for DB writes

## Success Criteria

- [ ] Single `YARN_INVENTORY_CONFIG` owns all ranges; no scattered `getRange` outside Config
- [ ] Valid save upserts ≤10+≤47 per `fecha+turno` without dup PKs; clearing inputs→`void`
- [ ] Only `C8:G17`/`A6:F52`+`H6:O52` persisted/cleared/refilled; formulas untouched
- [ ] `creado` preserved, `actualizado`/`editado_por` refreshed; fecha round-trips as native DATE
- [ ] Invalid fecha/turno/supervisor/inventario blocks that form; toast + `Errors`, no partial write
- [ ] No file outside `apps-script/yarn-inventory/` changed
