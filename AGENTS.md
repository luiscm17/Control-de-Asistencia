# AGENTS.md — Control de Asistencia

## Snapshot
- **What:** Single GitHub repo, **3 isolated Apps Script V8 projects** under `apps-script/` (never share globals, each has own `appsscript.json` `America/La_Paz`):
  - `attendance-control/` (6 .gs: Core/Config/Registro/Apoyo/Ingest/Menu) — 6 section sheets → `Registro` (13 cols A:M, PK `section,operator,date`).
  - `yarn-production/` (Config/Repository/Form/Dashboard/Setup/Menu) — `produccion` (G2 `d/M/yyyy`, C6:L8) → `datos_produccion` (A:Q, PK `fecha,turno`).
  - `yarn-settings/` (Core/Persistence/Ingest/Config/Menu/Errors) — `Settings` (F4 `dd/MM/yyyy`, B33:H42 + B50:H157) → `db_asignaciones`/`db_descargas` via I8 checkbox.
- **Sheet (prod):** `1GrZ_9w3CPvsJ22nVCndFojkhrhGmFGY8XcLQrtW7jTs` (native, converted 2026-08-31 from `1iw9bduLeGXQMbjmMV1qrMqE2WoPWCBz3`). Never test on prod — use a COPY.
- **Source of truth:** `docs/PRD.md` v0.3.6 §5.2–5.3 + §7–§11 + `docs/playwright-evidence/Preparacion-analysis.md` for attendance; `docs/yarn-production/PRD.md` and `docs/yarn-settings/PRD-yarn-settings.md` for yarn. `README.md` is pointer only. `openspec/specs/` (6 specs) + `openspec/changes/archive/` (5 archived changes) are frozen requirements.
- **SDD style:** `openspec/config.yaml` — Spanish formulas verbatim, incremental upsert, `valueRenderOption=FORMULA`.

## Repo map
- `apps-script/attendance-control/` — attendance ingest (installable `onEdit` → `Registro`).
- `apps-script/yarn-production/` — shift form (`G2`, `M4` checkbox debounce 3s, `C6:L8`/`D6:L8`).
- `apps-script/yarn-settings/` — settings form (`F4`/`F5`, `I8` checkbox `TRUE→save`, `B33:H42` assignments + `B50:H157` weighings, `peso_neto = bruto-(usos*cono+tacho)`).
- `docs/` — PRDs + `playwright-evidence/` + `yarn-*/PRODUCCION.xlsx` fixtures.
- `tests/` — mirror of `.gs` harnesses (e.g. `yarn-production.test.gs` with `yarnTestHelpers_`).
- No `package.json` / `opencode.json` / `Makefile` / CI workflows. Remote `origin` `luiscm17/Control-de-Asistencia`, branch `main`. Don't invent `npm test`.

## Attendance wiring (where agents fail)
- **Never DOM/canvas scrape.** Grid is single `<canvas>` with `freezebar-handle` overlay; Playwright snapshot has no cell text. Truth is `input#t-name-box` + `div#t-formula-bar-input` + XHR `streamrows`/`selection`; for code use **Sheets API v4 + installable `onEdit`**, not `waffle_api`.
- **10 sheets, scalable detection:** `- AYUDA -` + N attendance sheets (initially 6) + `Registro` + `Apoyo` + `Hoja2`. Resolve `section` via `Config!A:B` (sheetId or name → alias) or sheet name fallback — never hardcode the 6 names. Ignorable list: `Registro,Config,Errors,Hoja2,- AYUDA -,Apoyo`.
- **Input zone:** `E15:AI44` (30 rows) + `Apoyo!A3:E3` (Fecha/Operador/Sección/Código/Motivo). `Registro` PK `(section,operator,date)` → `record_id`, 13 cols `A:M` (`nota`, `is_apoyo`, `status=void`), `Nº`/doc ignored. Writes are **incremental per-cell upsert** (never snapshot). Header order §9 frozen.
- **Calendar:** `S7:U7` (year) / `S9:U9` (month) regenerate `E11:AI13` via `V9`/`W7` — **no `Registro` writes** (FR-006, confirm+reload only). Only `E15:AI44` with valid `E11` triggers writes. Blank `E11` (`SI.ERROR→""`, e.g. 31/09) → ignore column entirely.
- **Spanish locale `es-BO`:** Functions `SI.ERROR`/`BUSCARV`/`DIASEM`/`CONTAR.SI`/`MAX` with `FALSO`; leading `=+` tolerated. Keep verbatim or use `valueRenderOption=FORMULA`. `S7:U7`/`S9:U9` are merged → normalize (`trim`, accept `S7:U7`), `V9==BUSCARV(S9,Hoja2!A1:B12,2,FALSO)` month 1–12. `E12` maps via `Hoja2!D1:E7` → `L/M/X/J/V/S/D`, `W7==CONTAR.SI(S)+CONTAR.SI(D)`, `AJ15==CONTAR.SI(E15:AI15,AJ$10)/(MAX(E13:AI13)-W7)`.
- **`Hoja2` is critical path:** `A1:B12` months + `D1:E7` weekdays. Deleting/reordering blanks `E12:AI12` and breaks `W7`. Never modify `Hoja2`; validate on install + on each `onEdit`.
- **Codes:** `A/AT/BM/F` + blank only — `streamrows` (4 entries) + `ARRAYFORMULA(OR(TRIM(EXACT(...))))`. Invalid → toast, no write.

## Apps Script rules (all 3 projects)
- **Isolation:** Do not share globals/Config across `attendance-control`/`yarn-production`/`yarn-settings`. Each is a separate bound project deployment.
- **Installable trigger required** for any DB write (runs as owner). Simple `onEdit` only for toast/routing. Anon (`ANONYMOUS`, `401`) cannot write.
- **Permission + window gate before lock:** `responsible = Config!A:B[section] ?? RESPONSABLE header`; check `activeUser == responsible(section)` **and** `fecha_col ∈ {today, today-1}` in `America/La_Paz` (`Utilities.formatDate(...,"America/La_Paz","yyyy-MM-dd")`). Blocked → toast (`⛔ Solo podés registrar…` / `⛔ No tenés permiso…`), optional revert, **no write**, log to `Errors`. Bulk paste: per-cell. RRHH override only via `Asistencia → Solicitar corrección / Registro manual` (`via_manual`).
- **Concurrency:** Wrap every DB write with `LockService.getDocumentLock()` (5s, retry once), queue failed via menu. Yarn `guardarTurno()` / `yarnSettings` same pattern.
- **Timezone:** `America/La_Paz` (UTC-4, no DST) everywhere — script `timeZone`, timestamps, window calc. Never browser/UTC.
- **No external deps:** `SpreadsheetApp`/`LockService`/`Session`/`Utilities` only. Any `clasp`/tooling under project dir (`tools/`), never `/tmp`.

## Yarn gotchas
- `yarn-production`: `G2` is `d/M/yyyy` with Sheets dataValidation; `M4` is checkbox (`M4` label `N4`), debounce 3s, handler `yarnMobileOnEdit`, `MOBILE_SAVE_DEBOUNCE_MS=3000`. Process cols `D:L` ↔ `PROCESS_FIELDS`; `C9:L9` totals are `SUM` formulas, never persisted. PKs: `datos_produccion` `(fecha,turno)`, `yarn-settings` `db_asignaciones` `(fecha,turno,retorcedora)` etc.
- `yarn-settings`: Save is explicit `I8` checkbox `FALSE→TRUE` (installable `yarnSettingsOnEdit` → `guardarTurno()` → reset `I8=FALSE`). `B10:C19` standards (`BUSCARV`), `F4` date + `J4=ELEGIR(DIASEM(...))`, `F33`/`G33`/`H33` and `I50=peso_neto` formulas. Only `B33:H42`/`B50:H157` are persisted; `E10:H24` calculator and `L33:P42` Resumen are excluded. Empty `peso_bruto` → no row; clearing then saving deletes that PK.

## Commands & verification
- **No npm/lint/typecheck.** Executable truth is config + scripts, not prose. If docs conflict with `.gs`/`appsscript.json`, trust the `.gs`.
- **Tests:** No runner. `.gs` harnesses run in Apps Script editor: select `yarnTestHelpers_` (or `tests/yarn-production.test.gs` mirror) → Run → check `Logger` (`✅/❌`). Hardcoded dates are fixtures, not smells. `apps-script/yarn-settings/tests/` and `apps-script/yarn-production/tests/` same pattern.
- **Skills:** `skills-lock.json` pins `google-apps-script` (`jezweb/claude-skills`). Registry at `.atl/skill-registry.md` (auto-generated, don't edit by hand); `.atl/` and `.playwright-cli/` are ignored.
- **Playwright evidence:** Use `fill input#t-name-box "E15" --submit` + `div#t-formula-bar-input.textContent` for cell truth; `press ArrowRight` to walk. `click "canvas"` times out; `querySelectorAll('button')` undercounts tabs — use `.docs-sheet-tab-name`.
- **Verify on COPY only.** Auth required beyond anon view-only; `streamrows` truth for anon is read-only. After clone/deploy, run installer once (`yarnSetupYarnSettings` / `setupYarnProduction`) and re-authorize scopes, then reload for menu.

## Before you change anything
1. Read `docs/PRD.md` §5.2, §5.3, §7–§11 + `docs/playwright-evidence/Preparacion-analysis.md` §6/§8; for yarn read the matching `docs/yarn-*/PRD*.md` and the target `apps-script/*/Config.gs`.
2. Keep Spanish formulas verbatim, respect `E15:AI44`/`Hoja2` boundaries (attendance) and `B33:H42`/`B50:H157` + `I8`/`M4` boundaries (yarn); never modify `Hoja2` or reorder `Registro`/DB headers.
3. Add to this file only if an agent would miss it without help — no generic advice, no exhaustive file tree, no speculative claims. `VSCode` maps `*.gs` → javascript (`files.associations`).
