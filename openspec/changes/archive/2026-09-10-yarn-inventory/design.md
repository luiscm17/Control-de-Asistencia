# Design: Yarn Inventory

## Technical Approach
Keep `madejeras` A1:K21 + `lotes` A1:R1002 as daily forms; English `IF`/`SUM` stay live in sheet. Persist only inputs (`C8:G17` + `A6:F52`/`H6:O52`) into `db_madejeras` A:Q (PK `fecha,turno,maquina,lado`) + `db_lotes` A:X (PK `fecha,turno,lote_id→rowIndex`) via `Inventario` menu filtered by `fecha+turno`. Single frozen `YARN_INVENTORY_CONFIG` owns all sheets/A1/ranges/headers/PKs/lists/formula guards — pattern `yarn-production/Config.gs` + `yarn-settings/Config.gs`. Hydration on `fecha`/`turno` clears/fills input-only; one `LockService` per save, `Guardar Todo` sequential madejeras→lotes.

## Architecture Decisions

### Decision: Single Config SSOT

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Scattered `getRange("C8:G17")` | Drift, fails grep check | Rejected |
| Frozen `YARN_INVENTORY_CONFIG` + `ParseA1/Range` + `SHEETS/RANGES/HEADERS/IDX/LIMITS` | Verifiable SSOT | **Chosen** — any literal outside Config = violation |

### Decision: Input-only persistence

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Snapshot `H8:K17`/`G/P/Q/R` into DB | Duplicates formulas, drift | Rejected |
| Store inputs only, formulas recalc | Verbatim `IF`/`SUM`, 17/24 cols frozen | **Chosen** — `H8:K17`/`G6:G52`/`P/Q/R` never read/written/cleared (`valueRenderOption=FORMULA`) |

### Decision: 2 DBs vs 1 union

| Option | Tradeoff | Decision |
|--------|----------|----------|
| One wide union | Sparse nulls, mixed PKs | Rejected |
| `db_madejeras` ≤10/d + `db_lotes` ≤47/d | Clean PKs, independent lifecycles | **Chosen** — ~20.8k rows/yr <10M cells |

### Decision: Save trigger & concurrency

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Checkbox `M4`/`I8` debounce 3s | 2 checkboxes + timer complexity | Rejected |
| Menu-only + `tryLock(5000)`+1 retry, sequential Todo | Explicit, no deadlock | **Chosen** — partial success not rolled back, idempotent retry |

### Decision: Fecha timezone

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `formatDate(...,La_Paz)` on fecha | Shifts native DATE | Rejected |
| Native `DATE` as-is; `La_Paz` only `creado`/`actualizado` | Round-trip intact | **Chosen** — `getFullYear/getMonth/getDate` without formatDate |

## Data Flow

```
madejeras B3/F3+C8:G17 ─┐
                         ├─ Ingest.readSnapshot_ ─ validate (trim/CI vs Config) ─ Core.guardar* [Lock 5s+retry]
lotes C3/E3+A6:F52+H6:O52┘          │ loadState(batch A:Q/A:X) → buildPlan(creado preserved, rowIndex fallback) → apply(input-only) → flush → toast ✅/❌ + Errors

Hydration: onEdit fecha|turno → clear C8:G17 / A6:F52+H6:O52 → fill PK match → H8:K17/G/P/Q/R recalc
Guardar Todo: one lock → madejeras upsert → lotes upsert → flush → log partial
```

Sequence: `Menu → Ingest → validate → tryLock → loadState → buildPlan(PK) → apply(update preserves creado/append) → flush → toast`.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps-script/yarn-inventory/appsscript.json` | Create | `timeZone: America/La_Paz`, spreadsheets scopes |
| `apps-script/yarn-inventory/Config.gs` | Create | Frozen `YARN_INVENTORY_CONFIG` (SHEETS/RANGES/HEADERS/IDX/TURNO/SUP/INV/LIMITS/ERRORS) + `GetSheet/ParseA1/ParseRange/DateKey/EnsureSchema` |
| `apps-script/yarn-inventory/Repository.gs` | Create | `LoadState_/ReadRows_/BuildIndex_/EnsureDbSheets_` — batch `getRange(2,1,last-1,w)` |
| `apps-script/yarn-inventory/Ingest.gs` | Create | `ReadMadejeras/LotesSnapshot_`, normalize/validate, row eligibility (`titulo_base+cabos` / `objetivo_neto`) |
| `apps-script/yarn-inventory/Persistence.gs` | Create | `BuildMadejeras/LotesPlan_` (id `yyyy-MM-dd-turno-maquina-lado` / `fecha-turno-lote_id|row6..52`, last-wins, void→active) + `ApplyPlans_` |
| `apps-script/yarn-inventory/Menu.gs` | Create | `onOpen` Inventario (Guardar Madejeras/Lotes/Todo + Ver DBs + Re-sincronizar), `yarnInventoryOnEdit` hydration, trigger helper |
| `apps-script/yarn-inventory/Errors.gs` | Create | `LogError_/GetEditorEmail_`, `Errors` A:F |
| `apps-script/yarn-inventory/tests/yarn-inventory.test.gs` | Create | Harness (no runner) — boundary, PK, lock, void checks |

## Interfaces / Contracts

```javascript
const YARN_INVENTORY_CONFIG = Object.freeze({
  TIMEZONE:'America/La_Paz',
  SHEETS:{ MADEJERAS:'madejeras', LOTES:'lotes', DB_MADEJERAS:'db_madejeras', DB_LOTES:'db_lotes', ERRORS:'Errors' },
  RANGES:{ MADEJERAS_DATE:'B3', MADEJERAS_TURNO:'F3', MADEJERAS_SUP:'B4', MADEJERAS_INV:'F4',
           MADEJERAS_INPUTS:'C8:G17', MADEJERAS_FORMULAS:'H8:K17',
           LOTES_DATE:'C3', LOTES_TURNO:'E3', LOTES_SUP:'G3', LOTES_INV:'I3',
           LOTES_INPUTS_A:'A6:F52', LOTES_INPUTS_B:'H6:O52',
           LOTES_FORMULAS:{ META:'G6:G52', TOTAL:'P6:P52', AJUSTE:'Q6:Q52', ESTADO:'R6:R52' } },
  MADEJERAS_HEADERS:['id','fecha','turno','supervisor','inventario','maquina','lado','titulo_base','cabos','peso_deseado','tamano_aspa','velocidad','creado','actualizado','editado_por','rango_origen','estado'], // A:Q 17
  LOTES_HEADERS:['id','fecha','turno','supervisor','inventario','lote_id','tipo_orden','color','titulo','objetivo_neto','aumento','pesada_1','pesada_2','pesada_3','pesada_4','pesada_5','pesada_6','pesada_7','pesada_8','creado','actualizado','editado_por','rango_origen','estado'], // A:X 24
  IDX_MADEJERAS:{ID:0,FECHA:1,TURNO:2}, IDX_LOTES:{ID:0,FECHA:1,TURNO:2},
  TURNO_MADEJERAS:['Turno Dia','Turno Tarde','Turno Noche'], TURNO_LOTES:['Dia','Tarde','Noche'],
  LIMITS:{MADEJERAS_PER_DAY:10, LOTES_PER_DAY:47, LOTES_MAX_ROW:52}
});
function guardarMadejeras(); function guardarLotes(); function guardarTodo(); // single lock each
function yarnInventoryOnEdit(e); // fecha|turno → clear+fill input-only
```

PK: `madejeras id=yyyy-MM-dd-Turno-Maquina-lado` (`A/B`); `lotes id=fecha-turno-lote_id` or `fecha-turno-row{6..52}` when empty; duplicate `lote_id` last-wins + `⚠️ Lote duplicado`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Config SSOT, IDX=header len, CI trim validation | `yarn-inventory.test.gs` → Run → Logger ✅/❌ |
| Integration | Boundary untouched, fecha native, void/active | COPY `1RCupngk...` batch reads, `valueRenderOption=FORMULA` verbatim |
| E2E | Menu saves, hydration, lock contention | Manual COPY: fill→Guardar→change fecha+turno→verify; concurrent `⏳`→retry |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration. Verify on COPY `1RCupngk5x95ev5N4Zv0veMMbOhz6eH_9Vs44a1txE3s`: `Re-sincronizar` creates `db_madejeras`/`db_lotes`/`Errors` with frozen headers+protection. Rollback: remove menu/trigger, keep DBs, delete by `editado_por` if needed.

## Open Questions

- [ ] `maquina` canonical `Máquina 1..5` fixed? Assume fixed pending Q1.
- [ ] `lado` stored `A/B` — normalize `Lado A→A`.
- [ ] `turno` verbatim per form (`Turno Dia` vs `Dia`) kept distinct.
