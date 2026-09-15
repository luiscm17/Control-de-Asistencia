# dyeing-lot-recording Specification

## Purpose

Persist single-lot `tenidos` (`B1:I25`, PK `C3`) into `db_tenidos` (`A:AD`, 30 cols, PK `Nº Lote`) via explicit typed upsert with two-times fill. Source `docs/dyeing/PRD.md` v0.1.0.

## Requirements

### Requirement: Form Boundary and Config SSOT

System MUST expose `DYEING_CONFIG` owning sheets/ranges (`C3`,`G4`,`B6:E15`,`B18:E25`,`A:AD`), header order and PK. Persist/hydrate MUST touch only `C3`+`B6:E15`+`B18:E25`; `G4`/`items` MUST never be written. No `getRange` outside Config.

#### Scenario: Boundary enforced
- GIVEN any save or Re-sincronizar
- WHEN batch runs
- THEN only `C3`/`B6:E15`/`B18:E25` touched

### Requirement: Typed Capture — Native Type is Truth

System MUST NOT validate/coerce. STRING via `getDisplayValue()` as STRING; `E11`→`H`, `E21/E22`→`S/T`, `E23/E24`→`U/V` via `getValue()` as NUMBER. Dates `C6`/`C18`→`L`/`R` as `dd/mm/yyyy` passthrough. `E12`→`E` keeps `"@ …"` verbatim. Paste bypass stored as-is. `La_Paz` only for audit.

#### Scenario: Typed preserved
- GIVEN `E11=60` NUMBER, `E12="@ 24/1"`, `C6="12/09/2026"`
- WHEN saved
- THEN `H` NUMBER, `E` verbatim, `L` passthrough

#### Scenario: Paste passthrough
- GIVEN unknown dropdown or invalid date pasted
- WHEN saved
- THEN raw string stored; no block

### Requirement: Explicit Save — Menu and G4 Checkbox

Save MUST be explicit: `Teñido → Guardar` and `G4` `FALSE→TRUE` (installable `dyeingOnEdit`→`guardarLote()`→`G4=FALSE` ~1s). `MOBILE_SAVE_DEBOUNCE_MS=3000` MUST ignore `TRUE` if <3s. Menu MUST be `Guardar | Re-sincronizar` only; MUST NOT contain `Ver db_…`. `onOpen` MUST create menu and ensure `G4` validation. Input-only, no formulas.

#### Scenario: Save paths
- GIVEN valid `C3`
- WHEN `Guardar` or `G4` TRUE
- THEN `guardarLote()` upserts

#### Scenario: Debounce
- GIVEN `G4` saved at T0
- WHEN `G4=TRUE` at T0+1s
- THEN ignored, toast `⏳ Guardado reciente, esperá 3s`

### Requirement: PK Upsert, Audit and Soft-Delete

Save MUST upsert by `C3` trimmed → `A`. If exists → overwrite `B:Y` (even empties); else append. `creado` (`Z`) MUST be preserved; `actualizado` (`AA`)/`editado_por` (`AB`) refreshed; `AD`=`tenidos!C3:I25`. If all `B:Y` empty → `AC`=`void`, else `active`; refill re-activates. Last write wins.

#### Scenario: Upsert and two-times fill
- GIVEN Day1 Teñido only (`O:Y=""`)
- WHEN Re-sincronizar, fill Muestra, save `LT-042`
- THEN same row updated; `creado` preserved

#### Scenario: Soft-delete and re-activate
- GIVEN `LT-042` active
- WHEN saved all `B:Y=""` then refilled
- THEN `void` then `active`; no duplicate

### Requirement: Re-sincronizar — Explicit Only

`Re-sincronizar` MUST hydrate `B6:E15`+`B18:E25` verbatim where `A=C3`. If found → populate; else toast `— sin registros para {ID Lote}, listo para cargar` unchanged. If `C3` empty → toast `⚠️ Ingresá ID Lote en C3` no-op. MUST NOT auto-hydrate on `C3` change; MUST NOT auto-clear after save.

#### Scenario: Hydrate or no-op
- GIVEN `LT-042` exists or `LT-999` missing
- WHEN Re-sincronizar
- THEN exists populates; missing toasts unchanged

#### Scenario: No auto-hydrate
- GIVEN `C3` changed without Re-sincronizar
- WHEN inspected
- THEN form not populated

### Requirement: Guards, Concurrency and Observability

Before write system MUST block if `C3` empty/whitespace: no row, toast `⚠️ Ingresá ID Lote en C3`, log `Errors`, reset `G4=FALSE`. Partial block MUST succeed. Every save MUST acquire `LockService.getDocumentLock()` 5s+retry; on exhaustion log `Errors`, toast `❌ Error — usá Re-sincronizar`, no write. Success toasts `✅ Guardado: {ID Lote} — {Color} {Código} por {user}`. Missing sheet or cols<30 MUST be created/fixed before write. Script MUST NOT read `items`.

#### Scenario: Guards
- GIVEN `C3=""` vs `C3=LT-042` one block filled
- WHEN Guardar
- THEN empty blocked; partial succeeds

#### Scenario: Lock serializes
- GIVEN two users save `LT-042`
- WHEN both request lock
- THEN serialize or retry once; no duplicate

### Requirement: Data Model A:AD and Isolation

`A:AD` order MUST be frozen (25+5 audit): `A` PK `Nº Lote` STRING, `B-G` STRING, `H` NUMBER `T(ºC)`, `I-Q` STRING, `R` STRING date, `S-V` NUMBER (`Titulo1/2`,`Torsión1/2`), `W-Y` STRING, `Z` `creado` DATETIME `La_Paz`, `AA` `actualizado`, `AB` `editado_por`, `AC` `active/void`, `AD` `rango_origen`; full names per PRD §8.1. Code MUST be `apps-script/dyeing/` only, isolated, `SpreadsheetApp`/`LockService`/`Session`/`Utilities` only.

#### Scenario: Types and isolation
- GIVEN row inserted
- WHEN `db_tenidos` inspected
- THEN `A:G`/`I:Q`/`R`/`W:Y` STRING, `H`/`S:V` NUMBER; no cross-project globals
