# Proposal: Dyeing (Teñido) — Single-Lot Persistence

## Intent

`tenidos` `B1:I25` PK `C3` overwrites on `C3` change — no history/audit. Two-stage lots (teñido→muestreo) lose state. Explicit save (`Teñido → Guardar` + `G4` checkbox) → `db_tenidos` `A:AD` upsert (PK `Nº Lote`) gives traceability + queryable DB. Typed capture `H/S:V` NUMBER, `E12` `@` verbatim keeps aggregation without coercion. Source `docs/dyeing/PRD.md` v0.1.0 + `lotes-tenidos.xlsx`.

## Scope

### In Scope
- `apps-script/dyeing/` V8 `America/La_Paz` — Config/Core/Persistence/Ingest/Menu/Errors
- `tenidos` `B1:I25` (`B6:E15`+`B18:E25`, `C3` PK) + `G4` `FALSE→TRUE` 3000ms + menu `Guardar | Re-sincronizar`
- `db_tenidos` `A:AD` 30 cols (25+5 audit) upsert `A=C3`, `creado` preserved, `LockService` 5s+retry
- Typed: `E11/E21:E24` NUMBER, rest STRING (`E12` `@` verbatim), dates `dd/mm/yyyy` passthrough

### Out of Scope
- Dashboard, calculator, email/web, auto-hydrate, `Ver db_…`, version history, Script validation, JOIN, other projects

## Capabilities

### New Capabilities
- `dyeing-lot-recording`: Single-lot upsert + two-times fill + typed persistence

### Modified Capabilities
- None

## Approach

`DYEING_CONFIG` SSOT (ranges, `A:AD` frozen, PK) — pattern `yarn-production/Config.gs`. Skill `google-apps-script` (registry `.atl/skill-registry.md:37`). Menu+`G4` share `guardarLote()` via installable `dyeingOnEdit` (reset `G4=FALSE` ~1s). Batch `getDisplayValue`/`getValue` → `setValues` 1 row; `B:Y` overwrite, all-empty→`void`; audit `Z:AD` `America/La_Paz`.

**Tradeoffs:** NUMBER `H/S:V` vs all-string — keeps `QUERY`/`SUM` viable; all-number breaks `E12` `@`. Explicit save vs per-cell `onEdit` — avoids partial writes. `G4` debounce mirrors `yarn-production` `M4`/`yarn-settings` `I8`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps-script/dyeing/Config.gs` | New | `DYEING_CONFIG`, `C3/G4/B6:E15/B18:E25`, `A:AD` |
| `apps-script/dyeing/*.gs` | New | Typed capture, upsert, debounce, menu, `Errors` |
| `apps-script/dyeing/appsscript.json` | New | `timeZone: America/La_Paz` |
| `openspec/specs/dyeing-lot-recording/spec.md` | New | Spec at archive |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `E12` `@` coerced / dates tz-shift | Med | Only `E11/E21:E24` `getValue`; rest `getDisplayValue` passthrough |
| Two-times fill clears Teñido | Med | `Re-sincronizar` before stage-2 |
| `G4` double-tap | Low | Debounce 3000ms `PropertiesService` |
| Concurrency same `ID` | Low | `LockService` 5s+retry, idempotent |
| `items` written / header drift | Low | Never write `items`; Config freezes `A:AD` |

## Rollback Plan

COPY only: delete trigger `dyeingOnEdit`, redeploy `onOpen`; keep `db_tenidos` (void `editado_por` if needed). Restore sheet history. `git revert` branch `tenidos`.

## Dependencies

- Sheet COPY (`tenidos`/`db_tenidos`/`items`/`Errors`) + owner trigger auth
- Branch `tenidos` (auto-chain); `openspec/config.yaml` has `dyeing`

## Success Criteria

- [ ] `DYEING_CONFIG` owns ranges; `G4` debounce+reset
- [ ] Upsert 1 row per `C3` (no dups); `creado` preserved, audit `La_Paz`
- [ ] `H/S:V` NUMBER, `E12` `@` verbatim, dates passthrough — no validation
- [ ] Empty `C3` blocks (`⚠️ Ingresá ID Lote en C3`); partial valid; all-empty→`void`
- [ ] `Re-sincronizar` hydrates `B6:E15`+`B18:E25`; no auto-hydrate
- [ ] Only `C3/B6:E15/B18:E25` persisted; `G4`/`items` never written
