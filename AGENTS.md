# AGENTS.md — Control de Asistencia

## Project snapshot
- **What:** 6 factory section sheets (`Preparacion`, `Continua`, `Acoplado`, `Retorcedoras`, `Madejeras`, `Producto Terminado`) → single normalized DB sheet `Registro` via Apps Script. Sheet: `1iw9bduLeGXQMbjmMV1qrMqE2WoPWCBz3`. Repo is **docs-only today** — `apps-script/` does not exist yet, PRD is `docs/PRD.md` v0.2.1.
- **Next step:** SDD `propose → spec → design → tasks → apply`. Do not start coding until `sdd-propose` is accepted.
- **Source of truth:** `docs/PRD.md` §5.2–§5.3 + `docs/playwright-evidence/Preparacion-analysis.md` — trust these over sheet UI assumptions. `README.md` is just a pointer.

## Architecture agents get wrong
- **Never DOM/canvas scrape.** Sheet renders as single `<canvas>` with `freezebar-handle` overlays intercepting clicks; Playwright snapshot shows no cell text. Truth is `input#t-name-box` + `div#t-formula-bar-input` + XHR `streamrows`/`selection`, and for code it is **Sheets API v4 + `onEdit` trigger**, not `waffle_api`.
- **10 sheets, fixed names:** `- AYUDA -`, 6 sections above, `Registro` (empty target), `Apoyo`, `Hoja2`. Section detection must use allowlist — renamed sheet = ignored + warning.
- **Input zone:** `E15:AI44` (30 operator rows). `Registro` PK is `(section, operator_doc, date)` → `record_id`; writes are **incremental per-cell upsert** (never whole-table snapshot). Header order in §9 is frozen.
- **Calendar is dynamic:** Changing `S7:U7` (year) or `S9:U9` (month) regenerates `E11:AI13` via `V9`/`W7` — but creates **no `Registro` writes** (FR-006). Only `E15:AI44` with valid `E11` date triggers writes.

## Wiring & verified formulas (locale `es-BO` — Spanish)
- Functions are **Spanish**: `SI.ERROR`/`BUSCARV`/`DIASEM`/`CONTAR.SI`/`MAX` with `FALSO`. Keep verbatim or convert via `valueRenderOption=FORMULA`; do not push English `IFERROR`/`VLOOKUP` untested.
- **Merged ranges:** `S7:U7` (year `2026`) and `S9:U9` (`Septiembre`) — normalize merged `A1:B1` notation (`trim`, accept `S7:U7`). `V9 = =+BUSCARV(S9,Hoja2!$A$1:$B$12,2,FALSO)` → month number.
- **Date/weekday:** `E11:AI11 = =+E13&"/"&$V$9&"/"&$S$7` (string `D/M/YYYY`), `E12:AI12 = =+SI.ERROR(BUSCARV(DIASEM(E11,2),Hoja2!$D$1:$E$7,2,FALSO),"")` → `L/M/X/J/V/S/D`. `W7 = =+CONTAR.SI($E$12:$AI$12,"S")+CONTAR.SI($E$12:$AI$12,"D")`. Summary `AJ15 = =+CONTAR.SI($E15:$AI15,AJ$10)/(MAX($E13:$AI13)-$W$7)` where `AJ$10:AM$10` hold `A,AT,BM,F`.
- **Codes:** `A`/`AT`/`BM`/`F` + blank allowed — validated via `streamrows` (4 entries + `ARRAYFORMULA(OR(TRIM(EXACT(...))))`) and `t-text-color-cond-fmt`. Invalid → toast, no write. Blank `E11` (e.g. 31/09 → `SI.ERROR→""`) → ignore column entirely.
- **`Hoja2` is critical path:** `A1:B12` (Enero→1…) and `D1:E7` (weekday initials). Deleting/reordering blanks `E12:AI12` and breaks `W7`/denominator. Never modify `Hoja2`; validate its presence on install + on each `onEdit`.

## Apps Script rules (when `apps-script/` lands)
- **Installable trigger required** for any `Registro` write (runs as owner). Simple `onEdit` only for toast. View-only anon (`ANONYMOUS_…`, `401` on auth endpoints) cannot write — Playwright confirms this.
- **Permission + window gate before lock:** `responsible = Config!A:B[section] ?? RESPONSABLE header`; check `activeUser == responsible(section)` **and** `fecha_col ∈ {today, today-1}` in `America/Lima` (`Utilities.formatDate(..., "America/Lima", "yyyy-MM-dd")`). Blocked → toast (`⛔ Solo podés registrar hoy y ayer…` / `⛔ No tenés permiso…`), optional revert, **no `Registro` write**, log to `Errors`. Bulk paste: evaluate per-cell. RRHH override only via `Asistencia → Solicitar corrección / Registro manual` (audited, `via_manual`).
- **Concurrency:** Wrap every `Registro` write with `LockService.getDocumentLock()` (5s timeout, retry once), queue failed via menu.
- **Timezone:** `America/Lima` (UTC-5, no DST) everywhere — script timezone, timestamps, window calc. Never use browser/UTC date.
- **No external deps:** `SpreadsheetApp`/`LockService`/`Session`/`Utilities` only. Any `clasp` or tooling goes under project dir (`tools/`), never `/tmp`.

## Repo conventions
- **No build/test/lint yet** — no `package.json`, `opencode.json`, `Makefile`, or CI workflows. `git` remote `origin` `luiscm17/Control-de-Asistencia`, branch `main`. Don't invent `npm test`.
- **Ignored:** `.playwright-cli/`, `node_modules/`, `.DS_Store`, `*.log` (see `.gitignore`).
- **Verification on a sheet COPY only** — never test triggers on prod. Auth is needed beyond anon view-only; `streamrows` truth for anon is read-only.
- **Playwright evidence pattern** (from `Preparacion-analysis.md`): use `fill input#t-name-box "E15" --submit` + read `#t-formula-bar-input.textContent` for cell truth; `press ArrowRight` for walks. `click "canvas"` times out due to overlay — avoid. `querySelectorAll('button')` undercounts tabs — use `.docs-sheet-tab-name` snapshot truth.

## Before you change anything
1. Read `docs/PRD.md` §5.2, §5.3, §7–§10, §13 + `docs/playwright-evidence/Preparacion-analysis.md` §6/§8.
2. If adding `apps-script/`, keep Spanish formulas verbatim and respect `E15:AI44` + `Hoja2` boundaries.
3. Add new conventions to this file only if an agent would miss them without help.
