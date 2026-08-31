# Design: registro-centralization

## Technical Approach

Single V8 `apps-script/Code.gs` with 5 logical modules (`CONFIG`, `Registro`, `Ingest`, `Governance`, `Menu`) implements per-cell upsert `E15:AI44` + `Apoyo!A3:E3` → `Registro A:M` (PK `section,operator_name,date`). Dual trigger: simple `onEdit` (toast-only) + installable `handleEdit` (owner writes, anon 401 fix). Batch `getValues`/`setValues`+`flush()`, Config sheetId→logical mapping, `America/Lima` window `today/today-1` checked before `LockService` (5s retry once). Spanish locale verbatim, `Hoja2` validated on install+each edit. Covers `registro-ingest`/`registro-governance` FR-001–013.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| **Single `Code.gs` partitions** vs multi-file | GAS concatenates; multi-file adds indirection, no isolation | **Single file** `// --- CONFIG/REGISTRO/INGEST/GOVERNANCE/MENU ---` — matches skill template, `clasp` simple |
| **Dual trigger** vs installable-only | Installable-only loses toast when unauth; simple-only cannot write as owner (NFR-04, anon 401) | **Dual**: `onEdit` validates+toasts only; `handleEdit` (installable, owner) mutates `Registro` |
| **Config `sheetId→section` primary, `tabName` fallback** vs hardcoded names | Hardcode breaks on placeholder rename (PRD §5.1, High risk); sheetId immutable | **Config-driven** `resolveSection(sheet)` = `Config[sheet.getSheetId()] ?? Config[sheet.getName()]` → warn+skip if unmapped |
| **Batch get/set + one Lock per commit** vs per-cell | Per-cell 70× slower, hits 90-min quota | **Batch**: one read for `E11`+operators+`Registro` → `record_id→row` map → bulk `setValues` under `Lock.tryLock(5000)`+one retry→queue `PropertiesService` |
| **Lima via `Utilities.formatDate(...,"America/Lima")`** vs browser date | UTC drift | **Lima everywhere**: `todayStr`/`yesterdayStr` ISO compare; timestamps `yyyy-MM-dd HH:mm:ss` Lima |
| **Spanish verbatim + Hoja2 guard** vs English | English untested (`SI.ERROR`/`BUSCARV`/`DIASEM`/`CONTAR.SI`/`FALSO`/`=+`) | **Verbatim**: normalize merged `S7:U7`/`S9:U9` via `getDisplayValue().trim()`; validate `Hoja2!A1:B12`/`D1:E7` on `setupInstallable`+each edit → toast `⚠️ Hoja2 no accesible`, zero writes |

## Data Flow

```
E15:AI44 ─┐                          ┌─ Config!A:B ──┐
E11 D/M/YYYY┼─▶ onEdit light ─▶ handleEdit(owner) ─▶ Gate ─▶ Lock(5s) ─▶ Registro A:M
Apoyo A3:E3 ┘  (toast)          (batch read)    window+perm  retry  PK map + setValues+flush
S7:U7/S9:U9 ──▶ no-write (FR-006)                     └─▶ Errors + toast ⛔/⚠️/✅/🗑️
Hoja2 A1:B12/D1:E7 ──▶ validate (block if missing)
```

Sequence (single cell):

```
G20=F → onEdit: in E15:AI44? E11 valid? code∈{A,AT,BM,F}? → invalid→⚠️ toast
      → handleEdit: Hoja2 ok? resolveSection(sheetId)? window? permission? → blocked→⛔ toast+Errors, no lock
      → allowed: tryLock(5000) → findRow(record_id) → insert/update or void → setValues+flush → toast ✅
Bulk: intersect range∩E15:AI44 per-cell gate, one bulk commit → toast "N ins/M upd/K void/W fuera"
Calendar: range∩S7:U7|S9:U9 → return zero writes
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps-script/Code.gs` | Create | Header+CONFIG+onOpen/onEdit/handleEdit+5 modules (~500 lines) |
| `apps-script/appsscript.json` | Create | V8, `timeZone:"America/Lima"`, scopes `spreadsheets.currentonly`+`script.scriptapp` |
| `Config` sheet | Create | `A:B` sheetId→section, code labels, responsible; protected |
| `Registro` sheet | Modify | Ensure `A1:M1` 13-col header frozen/protected (PRD §9) |
| `Errors` sheet | Create | `timestamp,section,range,code,reason,user` audit log |
| `tools/.clasp.json` | Create | `clasp` under `tools/` only, copy never prod `1iw9bdu…` |

## Interfaces / Contracts

```javascript
const CONFIG = {
  INPUT:'E15:AI44', CALENDAR:['S7:U7','S9:U9'], APOYO:'Apoyo!A3:E3',
  REGISTRO:'Registro', CONFIG_SHEET:'Config', ERRORS:'Errors',
  CODES:['A','AT','BM','F'], LABELS:{A:'Asistencia',F:'Falta',AT:'Tardanza',BM:'Baja Médica'},
  HEADER:['record_id','created_at','updated_at','section','operator_name','date','code','code_label','is_apoyo','edited_by','source_range','nota','status']
};
function recordId(s,op,iso){ return `${s}-${op}-${iso}`; } // PK section-operator_name-date
// Registro A:M: [record_id, created_at, updated_at, section, operator_name, date(iso), code, code_label, is_apoyo, edited_by, source_range, nota, status]
// Public (no _): onOpen,onEdit,handleEdit,setupInstallable,menuVerRegistro,menuResincronizar,menuSolicitarCorreccion,menuRegistroManual,menuBackfill,menuAutorizar
```

Non-obvious — merged + window:

```javascript
function isInWindow(iso){
  const t=Utilities.formatDate(new Date(),'America/Lima','yyyy-MM-dd');
  const y=Utilities.formatDate(new Date(Date.now()-864e5),'America/Lima','yyyy-MM-dd');
  return iso===t||iso===y;
}
function getYearMonth(sh){
  const y=String(sh.getRange('S7:U7').getDisplayValue()||sh.getRange('S7').getValue()).trim();
  const m=String(sh.getRange('S9:U9').getDisplayValue()||sh.getRange('S9').getValue()).trim();
  return {y,m};
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Manual (copy only) | upsert/correct/void; bulk 30; calendar no-write; invalid X; Hoja2 missing→block; Apoyo `D=C3 L=E3` | Copy never prod; `Logger`+Executions+toast; verify PK + `Errors` + `flush()` |
| Integration | Lock contention same PK; rename tab (sheetId still resolves); Lima 23:59 boundary | Two browsers on copy; rename after Config; midnight edge |
| Menu/audit | 6 items `Ver Registro/Re-sincronizar/Solicitar corrección/Registro manual/Backfill/Autorizar`; `via_manual` | `onOpen` visible; `Autorizar` creates installable trigger as owner |

No runner/coverage (docs-only, PRD §14). Backfill: scan 6 sections `E15:AI44` where `E11` valid+non-empty, reuse upsert; idempotent (rerun zero).

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. GAS sandboxed (`SpreadsheetApp`/`LockService`), no external deps/shell.

## Migration / Rollout

1. Copy: create `Config`/`Registro` header/`Errors`; owner runs `Autorizar` (creates installable `handleEdit`, validates `Hoja2`). 2. Backfill chunked (1 section/exec if >6 min) via `Backfill histórico` + `HtmlService` progress. 3. Verify toasts/`Errors`, then `clasp push` copy→prod. Rollback: `ScriptApp.deleteTrigger` + remove deploy; `void` rows retained. No formula changes.

## Open Questions

- [ ] `Config!A:B` population — auto-discover sheetIds on `setupInstallable` or manual RRHH entry?
- [ ] `edited_by` empty when `Session.getActiveUser().getEmail()==""` — fallback `unknown` per FR-010 ok?
