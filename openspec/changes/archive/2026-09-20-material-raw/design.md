# Design: Material Raw — Control Camiones → db_materialrow

## Technical Approach

Decouple `Registro Diario` from live `Control Camiones` via `fecha`-keyed idempotent DB. Reuse `yarn-settings` (`F4 FALSE→TRUE` + installable `onEdit`) + `winding` locked delete+append. `D4`/`A` as native `Date` (`getValue` passthrough); `La_Paz` only for `J`. `B10:B40` becomes pure `SUMAR.SI` — no script. Scope: `material-raw-persistence`; PRD v0.1.0 FR-001–FR-008.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Isolated V8 project | `apps-script/material-raw/` own `appsscript.json` `America/La_Paz` | Extend `attendance-control` | Isolation rule; avoids blast radius; mirrors `yarn-settings` |
| Trigger split | `onOpen` simple + `materialRawOnEdit` installable | Simple `onEdit` only | Installable for `LockService`; `onOpen` needs no auth |
| Idempotency | `PK=fecha` delete+append (collect rowNumbers descending, `deleteRow`, bulk append) | `(fecha,tipo_fardo)` upsert | PRD §4.1 PK is day snapshot (31 rows); matches `coneras`/`dyeing`; avoids partial overwrite |
| Timezone | `getValue()` native for `D4→A`; `formatDate(La_Paz)` only for `J` | Format both | `La_Paz` UTC-4 no-DST; formatting `fecha` shifts day at midnight edge |
| Header guard | Fail-closed exact `A1:J1`; `Errors`+toast 8s, no write | Auto-repair | Prevents shuffle corruption; parity `dyeing` |

## Data Flow

```
D4 getValue() Date ─┐
B7:H37 getValues() ─┤ filter F<>"" → Lock(5s+1 retry) → deleteRows(fecha) → appendRows → F4=FALSE → toast 8s → flush
                    └─→ db_materialrow A:J (A fecha native, I total_kilos, J La_Paz)
                              ├─→ D4 edit / Resincronizar → Lock → filter A==D4 → B7:G37 setValues / clearContents (H intact)
                              └─→ Registro Diario!B10:B40 =SI.ERROR(SUMAR.SI(db_materialrow!$A$2:$A;FECHA(2026;9;$A10);$I$2:$I);0)
```

Save (`F4 FALSE→TRUE`):
```
User F4→TRUE → installable materialRawOnEdit(e) [guard sheet==Control Camiones && col==6 row==4 && TRUE]
 → batchRead D4+B7:H37 (2 calls) → validate D4 Date && header exact else abort+reset
 → withLock(5s+sleep1s+retry) { delete+append by fecha } → F4=FALSE → toast 8s → flush
 → finally F4=FALSE + Errors on fail
```

Rehydrate (`D4` / Resincronizar):
```
D4 edit or Materia Prima→Resincronizar → guard sheet==Control Camiones (never F4 path)
 → withLock → getValues(A:J) filter A==D4 → hit: setValues(B7:G37) else clearContents(B7:G37) [H preserved] → toast 8s
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps-script/material-raw/appsscript.json` | Create | `timeZone America/La_Paz`, scopes `spreadsheets,scriptapp,container.ui,userinfo.email`, V8 |
| `apps-script/material-raw/Config.gs` | Create | Frozen `MATERIAL_RAW_CONFIG`: `SHEETS {FORM,DATA,ERRORS}`, `RANGES {DATE:D4, CHECKBOX:F4, FORM:B7:H37, CLEAR:B7:G37}`, `DB_HEADERS A:J` |
| `apps-script/material-raw/Setup.gs` | Create | `materialRawEnsureSchema()` — ensure `db_materialrow!A1:J1` frozen `#e8f0fe`, formats `A/I/J`, `Errors A:F`; `reconcileTrigger_()` |
| `apps-script/material-raw/Repository.gs` | Create | `materialRawWithLock_`, `failClosed_()`, delete/append/query by fecha, `auditTimestamp_()` La_Paz |
| `apps-script/material-raw/Core.gs` | Create | `materialRawGuardarDia()` batch read filter `F<>""` → rows native `fecha`; `materialRawHydrate_(ss,fecha)` |
| `apps-script/material-raw/Menu.gs` | Create | `onOpen()` ensureSchema+reconcile+`Materia Prima → Guardar día | Resincronizar` (2 items); `onEdit(e)` shim → `materialRawOnEdit(e)`; debounce via `PropertiesService` 3000ms |
| `apps-script/material-raw/tests/material-raw.test.gs` | Create | GAS harness mocked `SpreadsheetApp/LockService`; fixtures D4 native+B7:H37; asserts save/filter/lock/header/rehydrate |
| `Registro Diario!B10:B40` | Modify | Replace `INDICE(...;1)` with `=SI.ERROR(SUMAR.SI(db_materialrow!$A$2:$A;FECHA(2026;9;$A10);db_materialrow!$I$2:$I);0)` (or `$A10` variant) — via setup/manual, not script-watched |

## Interfaces / Contracts

```javascript
const MATERIAL_RAW_CONFIG = Object.freeze({
  TIMEZONE:'America/La_Paz',
  SHEETS:{ FORM:'Control Camiones', DATA:'db_materialrow', ERRORS:'Errors' },
  RANGES:{ DATE:'D4', CHECKBOX:'F4', LABEL:'G4', FORM:'B7:H37', CLEAR:'B7:G37' },
  DB_HEADERS:['fecha','dia','n_camion','tipo_material','n_partida','n_bulto','tipo_fardo','cantidad','total_kilos','timestamp'],
  IDX:{ FECHA:0, DIA:1, N_CAMION:2, TIPO_MAT:3, N_PARTIDA:4, N_BULTO:5, TIPO_FARDO:6, CANTIDAD:7, TOTAL_KILOS:8, TIMESTAMP:9 }
});
function materialRawGuardarDia() -> {success, code, inserted, deleted}
function materialRawHydrate_(ss, nativeFecha) -> {success, code, count}
function materialRawWithLock_(cb) // tryLock(5000)+sleep(1000)+retry; toast ⏳ 8s on timeout
// H=SI(F="";0;SI(F="Fardo 400kg";400;200)*N(G)) preserved — only B:G written; Spanish formulas verbatim; D4 requireDate dd/MM/yyyy
```

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | filter `F<>""`, native `fecha` passthrough, `B7:G37` clear preserves `H`, header fail-closed, re-save no dupes | `material-raw.test.gs` mocked `SpreadsheetApp` (`getValue` Date, `getValues` 31×7), inject `LockService`; `Logger ✅/❌` |
| Integration | `F4→TRUE`→DB→`D4` hit/miss, `Resincronizar` mirrors, `Errors` logged | COPY `13vr2cJSG3Bukpd1Gk71--` clone: `D4=19/09/2026` fill 3 rows → `F4 TRUE` (3 rows, `F4 FALSE`), switch fecha (clear), back (fill) |
| E2E | `B10` sums `I` per fecha | Seed `I=400,200` for 19/09 → `B10=600`; re-save single row → still 600 |
| Quota | ≤90 min/day triggers, 6 min/exec | Batch only (2 reads/1-2 writes); delete descending; `flush()` before return; no UrlFetch/Mail |

Errors: every write under `LockService` 5s+1 retry; `Errors` row La_Paz; toasts `toast(msg,title,8)`; `F4=FALSE` in `finally`.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file or process-integration boundary. Pure `SpreadsheetApp/LockService` within one spreadsheet.

## Migration / Rollout

1. COPY `13vr2cJSG3Bukpd1Gk71--gMIme0Fe0n2HP9-mrhVrw0`: paste project, run `materialRawEnsureSchema()`+`reconcileTrigger_()`, authorize, reload menu.
2. Fix `B10:B40` to `SUMAR.SI` (FECHA vs native per A10 type); verify `H7:H37` intact.
3. Canary: save `D4=19/09` with 2 rows `F<>""` → 2 rows `J` La_Paz; re-save same fecha 1 row → 1 row; `D4` rehydrate → `B7:G37` correct.
4. Rollback: delete trigger `materialRawOnEdit`, remove menu, keep `db_materialrow`; revert `B10:B40` to `INDICE` if needed.

## Open Questions

- [ ] Confirm `D4` date / `F4` checkbox — 1-cell shift breaks detection.
- [ ] Confirm `dia` source: `A7:A37` vs `B7`.
