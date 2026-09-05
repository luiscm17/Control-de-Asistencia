# Proposal: Yarn Dashboard

## Intent

Read-only `dashboard` for `datos_produccion` totals and trends — desktop + Android, zero Apps Script on view. Complement to `yarn-production` in same spreadsheet/project. Source: `PRD-dashboard.md` v0.1.0 §§1–2.

## Scope

### In Scope
- `dashboard` sheet, read-only (PRD §5.1).
- 10 cards `#,##0.00`: 9 × `D:L` + grand total `M` (`SUM`/`FILTER`, §5.2).
- 3 filters `B1:F1`: `B1:C1` `d/M/yyyy`, `E1` `Todos/DIA/TARDE/NOCHE`, `F1` highlight (§5.3); empty = unbounded.
- Auxiliary `A10:C200` `QUERY` by `fecha` — daily + cumulative, filtered (§5.4).
- 3 native charts `G1` bar, `G2` line, `G3` stacked (§5.5); auto-update.
- One-time setup `apps-script/yarn-production/` (`Setup.gs`/`Dashboard.gs`), native formulas only (§6), `America/La_Paz`.

### Out of Scope
- Editing, `registrado_por`, PDF, `HtmlService`, mass clear (§9).
- `produccion` `G2`/`C6:L8`, `datos_produccion` `A:Q`, `M4` `Guardar` changes.
- New `apps-script/yarn-dashboard` folder.

## Capabilities

### New Capabilities
- `yarn-dashboard`: Cards, filters, auxiliary range, native charts — read-only view.

### Modified Capabilities
- None. `yarn-production-recording` unchanged.

## Approach

- **Setup once:** `ensureDashboardSheet_` — validations `B1:C1`/`E1`/`F1`, 10 card formulas, `A10:C200` `QUERY` + cumulative, 3 `EmbeddedChart` anchors. Idempotent.
- **Runtime:** `SUM`/`FILTER`/`QUERY` only, zero Apps Script (§6). Cell-edit filters, no menu (§7). ≥24px, Android-ready (§8). `es-BO` + `America/La_Paz` `d/M/yyyy`.

## Alternatives

- **HtmlService:** rejected — breaks Android, quota, out of scope §9.
- **onEdit recompute:** rejected — violates zero-runtime, 90 min/day quota.
- **Pivot table:** rejected — weak for cumulative + stacked; `QUERY` keeps single range.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps-script/yarn-production/Setup.gs`+`Dashboard.gs` | Modified/New | Sheet, validations, formulas, charts. |
| `apps-script/yarn-production/Config.gs` | Modified | `DASHBOARD_*` constants. |
| Sheet `dashboard` | New | Cards, `B1:F1`, `A10:C200`, `G1–G3`. |
| `docs/yarn-production/PRD-dashboard.md` | Reference | §§5–8 contract; §9 out-of-scope. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `es-BO` `QUERY` syntax | Med | Test `;` + `d/M/yyyy` on copy. |
| Cumulative drift | Med | Sorted `QUERY` + cross-check grand total. |
| Chart anchor loss | Low | Fixed anchor; re-anchor idempotently. |
| Full history scan | Low | Cap `C200`; ~1k rows/yr, no script cost. |

## Rollback Plan

Delete `dashboard` sheet; revert `Setup.gs`/`Dashboard.gs`/`Config.gs` (single commit). No data loss — `datos_produccion`/`produccion`/`M4` untouched. Test on copy.

## Dependencies

- `datos_produccion!A:Q` exists (`yarn-production` deployed).
- Owner auth for one-time setup on copy.
- Native Sheets only.

## Success Criteria

- [ ] `dashboard` with 10 cards `#,##0.00` from `D:M` (PRD §5.2/§10).
- [ ] `B1:C1`/`E1`/`F1` filter cards + `G1–G3`; empty = full history.
- [ ] `G1–G3` auto-update on new row, zero Apps Script on view.
- [ ] Android + desktop usable without menu/dialog; ≥24px targets.
- [ ] No `M4`/`G2` or `A:Q` regression on copy.
