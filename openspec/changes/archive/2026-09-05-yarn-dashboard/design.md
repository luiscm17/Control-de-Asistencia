# Design: Yarn Dashboard

## Technical Approach

Read-only `dashboard` complement to `yarn-production` in same spreadsheet/project (`apps-script/yarn-production/`). One-time setup (`ensureDashboardSheet_`) creates validations, 10 filtered card formulas, `A10:C200` grouped `QUERY` + cumulative, and 3 native `EmbeddedChart`s at `G1-G3`. Runtime is zero Apps Script — native `SUM`/`FILTER`/`QUERY` over `datos_produccion!A:Q` with `es-BO` `d/M/yyyy` and `America/La_Paz`. No source writes.

## Architecture Decisions

### Decision: Zero-script runtime

| Option | Tradeoff | Decision |
|---|---|---|
| Native `SUM`/`FILTER`/`QUERY` | Zero quota, Android-safe, `es-BO` formula complexity | **Chosen** |
| `onEdit` recompute | Simple JS but burns 90 min/day, fails on mobile | Rejected — violates §6/§8 |
| `HtmlService` | Rich UI but quota + mobile gap, out-of-scope §9 | Rejected |

### Decision: Auxiliary range

| Option | Tradeoff | Decision |
|---|---|---|
| Single `A10:C200` grouped `QUERY` + cumulative | One range feeds `G2`/`G3`, sorted, capped 200 | **Chosen** |
| Three `QUERY`s per chart | Duplicates filter logic, drift risk | Rejected |
| Pivot table | Weak for running cumulative + stacked shifts | Rejected |

### Decision: Charts

| Option | Tradeoff | Decision |
|---|---|---|
| `EmbeddedChart` at `G1/G2/G3` (`newChart().setPosition()`) | Native, mobile-visible, persists on copy | **Chosen** |
| `HtmlService` Google Charts | Quota + Android gap | Rejected |

### Decision: Setup placement

| Option | Tradeoff | Decision |
|---|---|---|
| `Dashboard.gs` + extend `Setup.gs`/`Config.gs` | Preserves recording invariant, no new folder | **Chosen** |
| New `apps-script/yarn-dashboard/` | Violates proposal out-of-scope | Rejected |

## Data Flow

```
datos_produccion!A:Q (B=fecha, C=turno, D:L sections, M total)
        │ native refs
        ▼
B1:C1(date)+E1(shift) ─FILTER─▶ 10 cards SUM(FILTER(col;datePred;shiftPred)) #,##0.00
        │
        ▼
A10:C200 = QUERY grouped by fecha ASC + cumulative (respects B1:C1+E1, not F1, cap 200, ";" es-BO)
        │
        ▼
G1 bar(9 sections)   G2 line(daily vs cumulative)   G3 stacked(DIA/TARDE/NOCHE)
        └────────── zero Apps Script, auto-recalc ──────────┘
F1 highlight only → conditional format, never filters rows
```
Empty `B1`/`C1`/`E1=Todos` = unbounded. `F1` isolated.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps-script/yarn-production/Dashboard.gs` | Create | `ensureDashboardSheet_()`, `buildDashboardCardFormulas_()`, `buildAuxiliaryQuery_()`, `ensureDashboardCharts_()`. Idempotent, `;` `es-BO`, reuses `columnToLetter_`. |
| `apps-script/yarn-production/Setup.gs` | Modify | Call `ensureDashboardSheet_()` from `setupYarnProduction()` (or `setupYarnDashboard()` wrapper). |
| `apps-script/yarn-production/Config.gs` | Modify | Add `DASHBOARD_SHEET`, `DASHBOARD_AUX_RANGE:'A10:C200'`, `DASHBOARD_AUX_MAX_ROWS:200`, `CARD_RANGE` D:L map, `CHART_ANCHORS:{G1,G2,G3}`, `FORMAT='#,##0.00'`. |
| `Sheet dashboard` | Create | Validations `B1:C1` date, `E1` Todos/DIA/TARDE/NOCHE, `F1` Todas/finisor…madejitas; cards; auxiliary; 3 charts; row 1 height 28px. |

## Interfaces / Contracts

**Filters `B1:F1`** — `B1:C1` `requireDate`+`setAllowInvalid(true)` (empty=unbounded) `d/M/yyyy`; `E1` `Todos/DIA/TARDE/NOCHE`; `F1` `Todas/finisor…madejitas` highlight only. `setRowHeight(1,28)` ≥24px; cell-edit only.

**Auxiliary `A10:C200`** — `fecha|daily_total|cumulative`; `A11` (es-BO `;`):
```gs
=SI.ERROR(QUERY(datos_produccion!A:Q;
 "select B,sum(M) where B is not null"
 &SI(Y(E1="Todos";E1="");"";" and C='"&E1&"'")
 &SI(Y(B1="";C1="");"";SI(Y(B1<>"";C1<>"");" and B>=date '"&TEXTO(B1;"yyyy-mm-dd")&"' and B<=date '"&TEXTO(C1;"yyyy-mm-dd")&"'";SI(B1<>"";" and B>=date '"&TEXTO(B1;"yyyy-mm-dd")&"'";" and B<=date '"&TEXTO(C1;"yyyy-mm-dd")&"'")))
 &" group by B order by B asc limit 200 label B 'fecha',sum(M) 'daily'";0);"")
```
`C11` cumulative:
```gs
=SI.ERROR(ARRAYFORMULA(SI(B11:B="";"";SUMA.SI(FILA(B11:B);"<="&FILA(B11:B);C11:C)));"")
```
**10 cards** — `SI.ERROR(SUM(FILTER(col;datePred;shiftPred));0)` formatted `#,##0.00`; nine `D:L` + `M`.

**Charts `G1-G3`** — `newChart().setChartType(...).setPosition(row,col,0,0)`:
- `G1` bar: X=9 names, Y=card totals; anchor `G1`.
- `G2` line: X=`A11:A`, Y1=`B11:B`, Y2=`C11:C`; anchor `G2`.
- `G3` stacked: X=`A11:A`, 3× `FILTER` by shift; `isStacked:true`; anchor `G3`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Cards `SUM/FILTER` combos, empty unbounded, `F1` isolation; auxiliary grouping + cumulative restart | COPY: seed 6 rows (2 dates×3 shifts), toggle `B1/C1/E1`, assert vs hand-calc, check `#,##0.00` |
| Integration | Idempotence (2× setup), validations/lists, `d/M/yyyy` format, row height ≥24px, 3 charts at `G1-G3` | Run setup twice on copy; check `getDataValidations`, `getNumberFormat`, `getRowHeight`, `getCharts().length===3` |
| E2E | Edit `B1/E1/F1` zero executions; append row auto-updates `G1-G3`; Android dropdown | Check Executions=0, `appendRow` then chart reflect, test on Android Sheets |

Verify on COPY only.

## Threat Matrix

N/A — no routing/shell/VCS/PR/executable/process boundary.

| Row | Applicable | Reason |
|-----|-----------|--------|
| Routing/URL | N/A | Native sheet refs only |
| Shell/subprocess | N/A | No `UrlFetch`/`exec` |
| VCS/PR automation | N/A | No git/gh |
| Executable-file classification | N/A | No file-type decisions |
| Process integration | N/A | No view triggers |

No RED tests required.

## Migration / Rollout

Idempotent, backward-compatible, no migration. Owner runs `setupYarnProduction` (extended) once on COPY, verifies 10 cards + 3 charts + filters, then prod. `ensureDashboardSheet_()` reuses existing sheet, updates formulas/charts in place. Rollback: delete `dashboard` sheet, revert commit (`Dashboard.gs`/`Setup.gs`/`Config.gs`). No data loss.

## Open Questions

- [ ] G3 source: `QUERY pivot C` vs 3× `FILTER` series — pivot cleaner but `es-BO` pivot needs COPY validation; default 3× `FILTER` pending proof.
- [ ] F1 highlight: conditional format on `G1` bar color vs card border — bar color may not render on Android; fallback to card highlight?
