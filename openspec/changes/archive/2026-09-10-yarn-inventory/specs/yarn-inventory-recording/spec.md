# yarn-inventory-recording Specification

## Purpose

Persist `madejeras` (A1:K21) + `lotes` (A1:R1002) as auditable per-shift inputs into `db_madejeras` (A:Q 17 cols) + `db_lotes` (A:X 24 cols) via `fecha+turno` filter; formulas stay live and are never stored, cleared, or written.

## Requirements

### Requirement: Single Config SSOT and Formula Boundary

The system MUST expose one `YARN_INVENTORY_CONFIG` owning all sheet names, ranges, header order, PKs, lists, and formula guards. Persist/clear/refill MUST touch only `madejeras!C8:G17` and `lotes!A6:F52`+`H6:O52`. Formula ranges MUST stay `valueRenderOption=FORMULA` verbatim and MUST NOT be persisted/cleared/written: `madejeras!H8:K17` (`H=IF(D>0,C/D,0)`, `I=H*E`, `J=IF(F>0,I/F,0)`, `K=IF(G>0,I/G,0)`) and `lotes!G6:G52` (`IF(E="","",E+F)`), `P6:P52` (`SUM(H:O)`), `Q6:Q52` (`G-P`), `R6:R52` (`IF(P>G,"EXCEDIDO",IF(P=G,"EXACTO","FALTA"))`). No literal `getRange("A1")` outside Config.

#### Scenario: Boundary enforced
- GIVEN any load/save/clear
- WHEN system batches reads/writes
- THEN only inputs are included; formulas never touched

#### Scenario: Scattered address fails verification
- GIVEN `H8` referenced outside Config
- WHEN design verification runs
- THEN it fails

### Requirement: Fecha+Turno Filter Hydration

`madejeras!B3`+`F3` (`Turno Dia/Tarde/Noche`) and `lotes!C3`+`E3` (`Dia/Tarde/Noche`) MUST be the load filter. Changing either valid selector MUST clear only inputs and re-fill for that `fecha+turno`; formulas MUST remain untouched and recalculate. `B3`/`C3` are native `DATE` stored as-is; `America/La_Paz` only for `creado`/`actualizado`.

#### Scenario: Hydrate existing shift
- GIVEN DB has rows for `2026-09-10` + `Turno Dia`
- WHEN filter changes to that key
- THEN inputs repopulate; formulas untouched

#### Scenario: No rows for filter
- GIVEN no rows for `2026-09-11` + `Dia`
- WHEN filter changes there
- THEN inputs cleared; formulas untouched

### Requirement: Explicit Validated Batch Upsert and Audit

Save MUST be menu-only (`Inventario → Guardar Madejeras | Guardar Lotes | Guardar Todo`; `Todo` runs sequentially). Before any write the system MUST validate `fecha` is valid `DATE` and `turno`/`supervisor`/`inventario` are in Config lists (trimmed, case-insensitive); invalid blocks that form, toasts `⚠️`, logs `Errors`, writes nothing. Each form upserts ≤10 / ≤47 rows by PK: `db_madejeras (fecha,turno,maquina,lado)` → `id=yyyy-MM-dd-turno-maquina-lado`, `db_lotes (fecha,turno,lote_id→rowIndex)` → `id=fecha-turno-lote_id` or `fecha-turno-row{6..52}` when empty (duplicate `lote_id` last-row-wins with toast). `fecha` native `DATE`; `creado` preserved; `actualizado`/`editado_por` refreshed in `America/La_Paz`. Empty `madejeras` (`titulo_base`/`cabos` missing) and `lotes` (`objetivo_neto` missing) rows skipped; rows beyond 52 ignored; column orders frozen.

#### Scenario: Upsert preserves creado
- GIVEN PK exists with `creado=08:00`
- WHEN same PK resaved with new inputs
- THEN row updates in place; `creado` unchanged

#### Scenario: Invalid header blocks form
- GIVEN `F3=Invalido`
- WHEN `Guardar Madejeras` runs
- THEN no writes; `Errors` logged

#### Scenario: Empty lote_id fallback
- GIVEN two empty `lote_id` rows at 6 and 7 for same `fecha+turno`
- WHEN saved then they map to `row6` and `row7`

### Requirement: Void Soft-Delete and Idempotent Re-activation

Clearing inputs for an existing PK then saving MUST set `estado=void` (not delete) and refresh audit; re-adding inputs and saving MUST return it to `active`. `void` rows remain queryable.

#### Scenario: Soft-delete
- GIVEN PK `2026-09-10-Dia-VERDE` is `active`
- WHEN `objetivo_neto` cleared and saved
- THEN row becomes `void` with fresh audit

#### Scenario: Re-activate
- GIVEN PK is `void`
- WHEN inputs refilled and saved
- THEN row returns to `active` without duplication

### Requirement: Concurrency-Safe Save and Observability

Every save MUST acquire `LockService.getDocumentLock()` (5s + one retry); on exhaustion it MUST toast `⏳` → `❌ Error — use Re-sincronizar`, log `Errors`, write nothing. `Guardar Todo` partial success MUST not roll back the succeeded table; failure is logged and retry is idempotent. Success MUST toast `✅ Guardado: {fecha} {turno} — {N} madejeras, {M} lotes por {user}`. Code MUST live only in `apps-script/yarn-inventory/` (`appsscript.json` `America/La_Paz`). Missing `db_*` MUST be created with frozen header before use.

#### Scenario: Concurrent serialize
- GIVEN two users save same `fecha+turno`
- WHEN both request the lock
- THEN writes serialize or second retries once and logs; no dup PKs

#### Scenario: Partial Guardar Todo
- GIVEN `db_madejeras` succeeds, `db_lotes` lock fails
- WHEN `Guardar Todo` ends
- THEN madejeras persists; partial warning + `Errors` for lotes
