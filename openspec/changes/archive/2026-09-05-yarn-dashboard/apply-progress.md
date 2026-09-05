# Apply Progress: Yarn Dashboard

## Completed Tasks

- [x] 1.1–1.2 Dashboard configuration and existing Yarn configuration reuse.
- [x] 2.1–2.4 Idempotent sheet setup, cards, auxiliary formulas, and setup wiring.
- [x] 3.1–3.3 Filter validation, native charts, and isolated focus formatting.
- [ ] 4.1–4.3 COPY-only runtime verification.

## Implementation Notes

- `setupYarnProduction()` now configures the existing production form and the dashboard. It does not write to `datos_produccion` except through the existing setup header path, and does not alter `produccion!G2`, `C6:L8`, totals, or the Guardar drawing.
- Cards use native `SI.ERROR`, `SUM`, and `FILTER`; the auxiliary range uses `QUERY` and a native running total. `F1` appears only in the conditional-format rule.
- The design's cumulative example summed column `C`, which is circular. The implementation sums daily totals in column `B` to produce a valid cumulative series.

## Work Unit Evidence

| Evidence | Result |
|---|---|
| Focused test command and exact result | `node -e "...new Function(fs.readFileSync(file))..."` for Config.gs, Dashboard.gs, and Setup.gs — exit 0. `node -e "...dashboard static contract..."` — `dashboard static contract: PASS (10 cards, filters, auxiliary, charts, F1 isolated)`. `git diff --check` — exit 0. |
| Runtime harness command/scenario and exact result | Not run: no authorized spreadsheet COPY was supplied, and production must not be used. The COPY harness below is required before verification; no production spreadsheet was accessed. |
| Rollback boundary | Revert `apps-script/yarn-production/Config.gs`, `Dashboard.gs`, and `Setup.gs`; delete only the `dashboard` sheet. No source production records or form inputs are reverted. |

## COPY Verification Harness (Phase 4)

1. On an authorized spreadsheet COPY, run `setupYarnProduction()` twice. Inspect `dashboard`: `B1:C1` date validations allow invalid blanks, `E1` and `F1` lists match the contract, D4:M4 is `#,##0.00`, row 1 is at least 24 px, and `getCharts().length === 3` with anchors G1, G2, and G3.
2. Seed six `datos_produccion` rows for two dates and three shifts. Set `B1=5/9/2026`, `C1=6/9/2026`, `E1=TARDE`, and `F1=finisor`. Hand-check D4:M4, A11:C, and that clearing B1/C1 and choosing Todos restores full history. Confirm F1 changes only card highlighting.
3. After setup, edit B1 and E1 and confirm the Executions page has no new Apps Script execution. Append a valid source row and confirm the three native charts recalculate. On Android Sheets, change E1 from its dropdown without using a custom menu. Confirm `produccion!M4`, `G2`, `C6:L8`, and `datos_produccion!A:Q` remain unchanged.

## Status

9/12 implementation tasks complete. Phase 4 is blocked on an authorized spreadsheet COPY; independent SDD verification should execute the listed harness.
