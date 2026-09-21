# Proposal: Material Raw — Control Camiones → db_materialrow

## Intent

Decouple `Registro Diario` from live `Control Camiones` to preserve history. Fix `B10` `INDICE(...;1)` single-row bug. Reuse `Control Camiones` as per-day form (`D4` native `dd/MM/yyyy`, `B7:H37`, `H=SI(F="";0;…)`) with DB `db_materialrow` (PRD v0.1.0 §§1–5, FR-001–FR-008).

## Scope

### In Scope
- `apps-script/material-raw/` V8 `America/La_Paz` (Config/Repository/Menu/Setup + installable `onEdit`).
- `db_materialrow` A:J frozen header, no formulas: `fecha,dia,n_camion,tipo_material,n_partida,n_bulto,tipo_fardo,cantidad,total_kilos,timestamp`; PK `fecha` (delete+append).
- Save: `F4` checkbox `FALSE→TRUE` (pattern `yarn-settings!I8`), `D4 getValue()` only, persist rows `F<>""`, reset `F4=FALSE`, toast 8s.
- Rehydrate on `D4` edit: filter by `fecha=D4` → `B7:H37`; no match → clear `B7:G37` (keep `H` formulas).
- `Registro Diario!B10:B40`: `SI.ERROR(SUMAR.SI(db_materialrow!$A$2:$A;fecha;$I$2:$I);0)` (`FECHA(2026;9;$A10)` or `$A10`).

### Out of Scope
- `H`/`A6:H6` formula changes; imports/payroll; per-cell upsert.

## Capabilities

### New Capabilities
- `material-raw-persistence`: Persist/recover `B7:H37` by native `fecha`; `Registro Diario` via `SUMAR.SI`.

### Modified Capabilities
- None

## Approach

Repo pattern `yarn-settings` (`F4` checkbox) + `winding` (batch, locked upsert). Batch-read `D4`+`B7:H37`; native `Date` pass-through only (EC-03/FR-006); `America/La_Paz` only for `J timestamp`. Filter `F<>""`; `LockService` 5s+1 retry; toasts 8s. `onOpen` ensures `db_materialrow` + menu `Materia Prima → Guardar día | Resincronizar` (no `Ver db`).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps-script/material-raw/` | New | Isolated GAS project |
| `Control Camiones` | Modified | `F4` checkbox + `onEdit`; no layout change |
| `db_materialrow` A:J | New | Bale DB (§4) |
| `Registro Diario!B10:B40` | Modified | `SUMAR.SI` replaces `INDICE` |
| `docs/material-raw/PRD.md` | Reference | v0.1.0 source |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `D4` text not Date | Low | No reformat; EC-01 toast; `SUMAR.SI` handles `FECHA()` vs native |
| Lock contention | Medium | 5s+retry; `⏳ ocupado` 8s; no partial writes |
| Rehydrate overwrites unsaved | Medium | Only on `D4`/Resincronizar; `B7:G37` clear preserves `H` |
| Header drift | Low | Validate exact A:J; fail-closed + `Errors` |

## Rollback Plan

Disable `onEdit` trigger + remove menu; keep `db_materialrow` rows. Revert `B10:B40` formula if needed; revert `apps-script/material-raw/` only.

## Dependencies

- COPY of `13vr2cJSG3Bukpd1Gk71--gMIme0Fe0n2HP9-mrhVrw0` for setup + GAS `Logger` harness; COPY only.

## Success Criteria

- [ ] `F4 FALSE→TRUE` under lock persists only `F<>""` rows with native `fecha`; resets `F4`; toast 8s.
- [ ] Re-save same `fecha` replaces rows (no dupes).
- [ ] `D4` rehydrate loads `B7:H37` or clears `B7:G37`; `H` intact.
- [ ] `B10:B40` sums `total_kilos` per `fecha` via `SUMAR.SI`; history preserved.
- [ ] `America/La_Paz` only for `timestamp`; `fecha` never formatted.
