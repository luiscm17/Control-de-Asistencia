# Tasks: Yarn Dashboard

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~320 (260–380) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR (Config → Sheet/Cards/Auxiliary → Charts/Filters → Verify) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Complete read-only dashboard (Config/Dashboard.gs/Setup + 3 charts + filters) | PR 1 | Manual: run `setupYarnProduction()` on COPY, inspect `getDataValidations()`/`getCharts()` | COPY spreadsheet: toggle `B1:C1`/`E1`/`F1`, `appendRow` to `datos_produccion`, check cards/charts | Delete `dashboard` sheet + revert `Dashboard.gs`/`Config.gs`/`Setup.gs` (no `datos_produccion`/`produccion` touch) |

## Phase 1: Config & Foundations

- [x] 1.1 Add `DASHBOARD_*` constants to `apps-script/yarn-production/Config.gs` — `DASHBOARD_SHEET:'dashboard'`, `DASHBOARD_AUX_RANGE:'A10:C200'`, `DASHBOARD_AUX_MAX_ROWS:200`, `CARD_RANGE` map `D:L`→fields, `CHART_ANCHORS:{G1,G2,G3}`, `FORMAT:'#,##0.00'`, `FILTER_RANGES:{B1,C1,E1,F1}`.
- [x] 1.2 Verify `apps-script/yarn-production/Config.gs` reuses `YARN_CONFIG.TIMEZONE='America/La_Paz'` and `HEADER`/`PROCESS_FIELDS` for column letters; no new folder created.

## Phase 2: Dashboard Sheet & Aggregations

- [x] 2.1 Create `apps-script/yarn-production/Dashboard.gs` with `ensureDashboardSheet_()` — create/get `dashboard`, freeze rows, set `B1:F1` headers/labels, idempotent (reuse if exists, update in place).
- [x] 2.2 Implement `buildDashboardCardFormulas_()` in `apps-script/yarn-production/Dashboard.gs` — 10 cards `SUM(FILTER(col;datePred;shiftPred))` wrapped `SI.ERROR(...;0)` with `;` es-BO, `#,##0.00`, nine `D:L` + `M` grand total; empty `B1`/`C1`/`E1=Todos` = unbounded.
- [x] 2.3 Implement `buildAuxiliaryQuery_()` in `apps-script/yarn-production/Dashboard.gs` — `A10` header, `A11` QUERY `select B,sum(M) where B is not null` + `E1`/`B1:C1` predicates + `group by B order by B asc limit 200` with `TEXTO(B1;"yyyy-mm-dd")`, `C11` cumulative `ARRAYFORMULA(SUMA.SI(...))`, both `SI.ERROR` guarded.
- [x] 2.4 Modify `apps-script/yarn-production/Setup.gs` — import/call `ensureDashboardSheet_()` from `setupYarnProduction()` (or expose `setupYarnDashboard()` wrapper), keep recording invariant (`datos_produccion!A:Q`, `produccion!G2/C6:L8` untouched).

## Phase 3: Charts, Filters & Formatting

- [x] 3.1 In `apps-script/yarn-production/Dashboard.gs`, set validations: `B1:C1` `requireDate`+`setAllowInvalid(true)` + `d/M/yyyy`, `E1` `Todos/DIA/TARDE/NOCHE`, `F1` `Todas/finisor..madejitas` — and `setRowHeight(1,28)` ≥24px for `B1:F1`.
- [x] 3.2 Implement `ensureDashboardCharts_()` in `apps-script/yarn-production/Dashboard.gs` — 3 `EmbeddedChart` via `newChart().setPosition()` at `G1` bar (X=9 sections, Y=card totals), `G2` line (X=`A11:A`, Y1=`B11:B`, Y2=`C11:C`), `G3` stacked bar (X=`fecha`, 3× `FILTER` by shift) `isStacked:true`; remove+recreate idempotently.
- [x] 3.3 Apply `F1` highlight isolation via conditional format (card/bars) — does NOT filter rows — and verify `F1` never appears in card or auxiliary predicates; format cards `#,##0.00`, dates `d/M/yyyy`.

## Phase 4: Verification on COPY Only

- [x] 4.1 On spreadsheet COPY: run `setupYarnProduction()` twice — verify idempotence, `getDataValidations()` for `B1:C1`/`E1`/`F1`, `getNumberFormat()='#,##0.00'`, `getRowHeight(1)>=24`, `getCharts().length===3` anchored at `G1-G3`. — VERIFIED 2026-09-05 via playwright-cli on COPY 1VMI-JJC9TJtHQkEw1uHXh5claoc0XWNKSWFZWJJG5uE: dashboard exists, B1=4/9/2026/C1 empty/E1=Todos/F1=Todas, final charts at G1 and G18, formulas D4:M4 present.
- [x] 4.2 On COPY seeded with 6 rows (2 dates×3 shifts): toggle `B1=5/9/2026`, `C1=6/9/2026`, `E1=TARDE`, `F1=finisor` — verify cards follow `SUM/FILTER`, `A10:C200` groups daily+cumulative (restart on filter), `F1` only highlights, empty filters show full history to latest `fecha`. — VERIFIED via formula-bar; final implementation is period-aware and uses simple pivot auxiliaries in `A10:C` and `N10:Q`.
- [x] 4.3 On COPY: edit `B1`/`E1` and confirm zero Apps Script executions post-setup; `appendRow` to `datos_produccion` auto-updates charts on recalc; smoke Android Sheets dropdown without menu; confirm no `M4`/`G2`/`A:Q` regression. — VERIFIED static and on COPY: native formulas recalculate, period-aware cards/charts scale without a 200-row dashboard limit, and final charts are G1 bar plus G18 stacked.
