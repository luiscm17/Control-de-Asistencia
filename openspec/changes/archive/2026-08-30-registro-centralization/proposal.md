# Proposal: registro-centralization

## Intent
Centralize 6 sections + Apoyo into `Registro` (13 cols A:M, PK `section,operator_name,date`) via Apps Script. Fixes empty `Registro`, no cross-section reporting/audit, fragile `CONTAR.SI`. Source: PRD v0.3.0 §§5.2-5.3, 7-10, 13; Playwright canvas/name-box.

## Scope

### In Scope
- Installable `onEdit` + toast; per-cell upsert/void/bulk `E15:AI44`→`Registro` (FR-001,003-005,008)
- Date via `E11` (`=+E13&"/"&$V$9&"/"&$S$7`), blank `E11` ignored; `S7:U7/S9:U9` zero writes (FR-006)
- `Apoyo A3:E3`→`Registro` `is_apoyo=TRUE` (`D=C3`, `L=Motivo`) (FR-007)
- `Config!A:B` logical mapping (sheetId|tabName→section, header fallback), window `today/today-1` `America/Lima` + `activeUser==responsible` gate before lock (FR-013)
- `LockService` 5s retry, Spanish formulas verbatim, `Hoja2` validate, idempotent backfill; menu `Asistencia` 6 items

### Out of Scope
- Manual Table conversion, dashboards, `AJ:AM` rewrite, notifications/payroll, DOM/canvas scraping

## Capabilities

### New Capabilities
- `registro-ingest`: `E15:AI44` → `Registro` upsert/void/bulk/Apoyo/backfill with `E11` + code validation (FR-001,003-009)
- `registro-governance`: Config mapping, window+permission gate, `LockService`, installable trigger, menu/audit, timezone/locale handling (FR-010-013, NFR-03-05)

### Modified Capabilities
- None — `openspec/specs/` empty; this is greenfield.

## Approach
GAS V8 `apps-script/Code.gs` (skill template: header, `CONFIG`, `onOpen` menu). `onEdit(e)` gate (intersection/validation/`Hoja2`) → `handleEdit(e)` installable. Batch `getValues/setValues`, `flush()`, public funcs, `PropertiesService` queue. Validate `Hoja2` on install+edit. `tools/clasp` only; verify on COPY never prod `1iw9bduLeGXQMbjmMV1qrMqE2WoPWCBz3`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps-script/Code.gs` | New | onEdit, upsert/void, Apoyo, backfill, menu |
| `apps-script/appsscript.json` | New | V8, `America/Lima`, scopes |
| `Config` sheet | New | `A:B` logical→email + labels |
| `Registro` | Modified | 13-col frozen, PK, `Errors` log |
| `tools/` | New | `clasp` only |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `Hoja2` deletion blanks `E12/W7` | Med | Validate install+edit; toast+`Errors`; protect |
| Placeholder tab rename | High | `sheetId→logical` primary; tabName fallback + warning |
| Concurrent overwrites | Med | `LockService` 5s retry; queue via menu |
| Timezone drift | Low | `Utilities.formatDate(..."America/Lima")` everywhere |
| 90 min quota (backfill) | Low | Batch ops; chunked backfill; retry |

## Rollback Plan
Delete installable trigger (`ScriptApp.deleteTrigger`); remove `apps-script/` deploy; `Registro` retains `void` rows queryable. No formula changes. `Config` inert.

## Dependencies
- Owner auth for installable trigger (anon `401` blocked)
- `Registro` A:M frozen; manual Table conversion confirmed

## Success Criteria

- [ ] Edit `E15:AI44` with `A/AT/BM/F` + valid `E11` → `Registro` upsert <2s; clear → `status=void`; correction updates `updated_at`
- [ ] Bulk paste 30 cells <10s with toast `N ins/M upd/K void`
- [ ] Change `S7:U7/S9:U9` creates zero `Registro` rows
- [ ] `Apoyo A3:E3` creates single `is_apoyo=TRUE` row
- [ ] Out-of-window/cross-section → toast ⛔, no write, logged; RRHH menu bypass audited `via_manual`
- [ ] Backfill idempotent on COPY; `Hoja2`/merged `S7:U7` handled
