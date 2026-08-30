# Preparación — Playwright Analysis (playwright-cli 0.1.18)

> **Goal:** Deep dive on sheet `Preparacion` (second operational sheet) using only `playwright-cli`. Google Sheets renders as `<canvas>` — snapshot never shows cell values — so all insight comes from formula-bar (`#t-name-box`, `#t-formula-bar-input`), `selection`/`streamrows` network, and incremental name-box navigation.

## 1. Overview

| Field | Value |
|-------|-------|
| Spreadsheet | `Control-de-Asistencia.xlsx` — `https://docs.google.com/spreadsheets/d/1iw9bduLeGXQMbjmMV1qrMqE2WoPWCBz3/edit?…` |
| Title (DOM) | `Control-de-Asistencia.xlsx - Hojas de cálculo de Google` |
| Analyzed gid | `740536758` → tab `Preparacion` (id `:1d`, tab index 1) |
| All tabs discovered (`w` at 2026-08-30) | `- AYUDA -` (active on load, gid `1765343219`), `Preparacion` (`740536758`), `Continua`, `Acoplado`, `Retorcedoras`, `Madejeras`, `Producto Terminado`, `Registro`, `Apoyo`, `Hoja2` (aux lookup sheet) |
| Viewer state | Anonymous (`ANONYMOUS_00801369372001435688`), `Iniciar sesión` visible, Share disabled → **view-only**. Cannot commit edits, validation reject logic unreachable. |
| Language | UI `es-BO` (`Archivo/Editar/Ver…`), formulas Spanish (`SI.ERROR`, `BUSCARV`, `DIASEM`, `CONTAR.SI`, `MAX`) |
| Window | `1280×720`, canvas `1264×524` at `(0,142)` |

**Screenshot baseline:** `Preparacion-01-overview.png` (viewport at 100% zoom, Arial default, after clicking Preparacion tab).

## 2. Tab Navigation

**Initial load** lands on `- AYUDA -` (`gid=1765343219`, `docs-sheet-active-tab` → `- AYUDA -`). Tab bar `role="navigation" aria-label="Barra de pestañas de la hoja"` contains:

```html
<button> - AYUDA - </button>
<button>Preparacion</button>  <!-- ref e346, id :1d, active after click -->
...
<button>Hoja2</button>
```

- Playwright snapshot reliably lists all 10 tabs (refs `e338`..`e402` + Hoja2). DOM fallback `querySelectorAll('button')` only returned 2 — toolbar filter mismatch; snapshot + `.docs-sheet-tab-name` is truth.
- **Action:** `playwright-cli click e346` → navigation to `https://docs.google.com/spreadsheets/d/…/edit?gid=740536758#gid=740536758` in ~0.8s, `docs-sheet-active-tab` → `Preparacion`, name-box resets to `A1`.
- Verified via `eval("location.href")` and `.docs-sheet-active-tab .docs-sheet-tab-name`.
- Scrolling not needed; all tabs fit at 1280px (fade-right visible but inactive). Hoja2 initially hidden behind overflow (`Desplazar a la derecha` enabled).

**Evidence:** snapshot `page-2026-08-30T18-36-56-342Z.yml`, `eval tabs/active`.

## 3. Grid Rendering

Google Sheets paints data on a single `<canvas dir="ltr" width="1264" height="524">` (style `1264px × 524px`, rect `(0,142,1264,524)`). No `<td>` grid.

- Container: `#waffle-grid-container` → `#waffle-disclaimer-bar`, `.overlay-container-ltr static-overlay-container` (`#740536758-static-overlay-container`) holding freezebar handles/row-col draggers/resizers on top of canvas.
- The `freezebar-handle` (`left:412px` → freezes at col ~D/E) and horizontal handle (`top:24px`) intercept `click` on canvas → direct `playwright-cli click "canvas"` timed out: `freezebar-handle … intercepts pointer events`. Workaround: `mousemove` + `mousedown`/`mouseup` at canvas centre `(632,404)` succeeded (selected `I12`).
- `#waffle-rich-text-editor` (`contenteditable`, off-screen `-9998` when not editing, `4,-9998,0,30`) is the true cell editor; formula bar mirrors it.
- Snapshot `#t-name-box = A1` at idle, font `Arial` 11, zoom 100% — corroborates header styling.
- `performance.getEntriesByType('resource')` shows wasm `calcworker_wasm_cd.wasm`, `sheets-images-rt`, `play.google.com/log`, but sheet data flows over XHR `streamrows` / `selection`, not static resources.
- Visual: `Preparacion-05-grid.png` (canvas with frozen panes, merged headers, coloured legend). Text extraction impossible from canvas — confirms Playwright's limits.

### Hidden structure (inferred from DOM + network)
- `waffle-api.getInstanceOfApp()` exists (keys `W_`, `Gb`, `qc`, … obfuscated). `ritz_api` empty. No readable `waffle` global — minified.
- `renderdata` returns image URL only (`sheets-images-rt/...`), not cell values.
- `streamrows` (POST `.../streamrows?smv=2147483647…&rpwf=a`) carries compressed snapshots. Raw bodies contain obfuscated style IDs (`67094526`) and literal values later extracted via formula-bar loop (see §6). Anonymous session still receives `streamrows` 200, so outline is fetchable even view-only.

## 4. Cell Interaction Attempts

### 4.1 Name-box navigation (reliable)
- `input#t-name-box.jfk-textinput.waffle-name-box` → value is truth source. `fill e252 "E15" --submit` (Enter) navigates synchronously; subsequent `eval #t-name-box.value` + `#t-formula-bar-input.textContent` reflects new cell within ~200 ms.
- Works for any A1 notation including merged ranges: `S7:U7` (year), `S9:U9` (month). Tested sequentially for >15 addresses via repeated fill/submit — 100% reliable.
- Pure JS dispatch (`nb.value='E15'; dispatchEvent('keydown Enter')`) **fails** — Sheets listens on Playwright's trusted keyboard events only. Must use `playwright-cli fill` or `press`.

### 4.2 Arrow-key walk (reliable)
- `playwright-cli press ArrowRight` from `E15` → `F15` → `G15` → `H15` etc., confirmed by name-box increment (`E15→F15→G15…`). Allowed sampling without re-typing. Example chain: `E15(A)` → `F15(AT)` → `G15(AT)` → `H15("")` → `I15("")`.

### 4.3 Direct canvas click (flaky)
- Centre click `(600-640,350-404)` selects cell under cursor but mapping from pixels → A1 is opaque. First attempt landed on `I12` (formula weekday). Subsequent `mousemove 600 350 + mousedown/mouseup` replicated. Click helper `playwright-cli click "canvas"` always times out due to overlay intercept — documented limitation.
- `snapshot --boxes` essential for locating canvas rect; otherwise coordinates are blind.

### 4.4 Edit / validation trigger (blocked by permissions)
- View-only anon cannot write. Attempting to focus `waffle-rich-text-editor` and typing via `playwright-cli type` was not pursued at scale (would still be rejected server-side, with no toast observable via snapshot). Snapshot after focusing `E15` shows no dropdown widget (`[role=listbox]` only toolbar comboboxes; validation listbox never appears). Therefore **data-validation UI for `A/AT/BM/F` cannot be demonstrated as anon**.
- However validation source *is* visible in `streamrows` response: literal values `A`, `AT`, `BM`, `F` appear in a validation block (`"1":0,"5":[[{"1":0}],[2,"A"]] …) with four entries and conditional formatting attached. This matches prior offline analysis (`A,AT,BM,F`) and was corroborated by navigating `E15(F? actually A)/F15(AT)`.
- Trying `type "X"` into `E15` would be the correct manual test for invalid entry when authenticated; as anon we note expected behavior: toast/red triangle + rejection, but unobservable here.

### 4.5 Keyboard navigation to summary
- `fill AJ15 / AK15 / AM15` all succeed and expose summary formulas (see §6). `press ArrowRight` etc. leaves frozen-pane headers visible.

## 5. Validation Behavior (observable via DOM + network)

**Declared allowed values:** `A`, `AT`, `BM`, `F` (Attendance codes). Evidence:

- `streamrows` chunk for Preparacion (gid `950512471` in decomposed snapshot — actual shipping gid differs from tab gid due to internal reindex; but payload contains):
  ```json
  [{"1":24,"2":[[{"1":0,"5":[[{"1":0}],[2,"A"]]}],
               [{"1":0,"5":[[{"1":0}],[2,"AT"]]}],
               [{"1":0,"5":[[{"1":0}],[2,"BM"]]}],
               [{"1":0,"5":[[{"1":0}],[2,"F"]]}]],
    "6":[...color mappings...],"7":0}
  // plus a parallel validator: =ARRAYFORMULA(OR(TRIM(EXACT(...))))
  ```
  Attached to range `[E15:AI15]` (inferred from `selection` and `COUNTIF` ranges below). Colors per code mapped in same block (BM→12575222 etc.)

- Navigating `E15`→`A`, `F15`→`AT` shows live values already conforming; `H15` empty shows permissive blank.

- Conditional-formatting & data-validation palette IDs `t-text-color-cond-fmt` / `t-cell-color-cond-fmt` exist in hidden `goog-menu` (display:none) — validation UI hooks present but not rendered.

- `Apoyo` sheet (support sheet) examined briefly — contains legend `%`, helpers; validation source likely duplicated there.

- **Implication:** `onEdit` Apps Script would be required to enforce `A/AT/BM/F` server-side and to auto-clear invalid `X`; client-side dropdown would appear for editors. Playwright cannot trigger it anon.

## 6. Formula Bar

The authoritative in-DOM sheet model is the formula bar pair:

- `input#t-name-box` (value = selected A1 or merged range)
- `div#t-formula-bar-input > div.cell-input[contenteditable]` (rich HTML with syntax-highlighted `<span>` per token)

Collected via sequential `fill` + `eval`:

| Range | Formula / Value | Interpretation |
|-------|-----------------|----------------|
| `S7:U7` | `2026` | Academic year (merged header) |
| `S9:U9` | `Septiembre` | Month name (merged, validated via `Hoja2!A1:B12`) |
| `V9` | `=+BUSCARV(S9,Hoja2!$A$1:$B$12,2,FALSO)` | Month number lookup (Enero→12) |
| `E13:AI13` | `1` (row 13, e.g. `E13=1`, `I13=?`) | Day numbers 1..30 (with `I13` etc. as running day index) |
| `E11:AI11` | `=+E13&"/"&$V$9&"/"&$S$7` | Full date string `D/M/YYYY` built from day + month num + year |
| `E12:AI12` | `=+SI.ERROR(BUSCARV(DIASEM(E11,2),Hoja2!$D$1:$E$7,2,FALSO),"")` | Weekday initial: `WEEKDAY(date,2)→VLOOKUP(Hoja2 D1:E7)` returns `L,M,X,J,V,S,D`. Wrapped in `IFERROR` → blank on invalid date (e.g. 31/09) |
| `W7` | `=+CONTAR.SI($E$12:$AI$12,"S")+CONTAR.SI($E$12:$AI$12,"D")` | Weekend count `S/D` in row 12 (used as divisor offset) |
| `AJ15:AM15` etc. | `=+CONTAR.SI($E15:$AI15,AJ$10)/(MAX($E$13:$AI$13)-$W$7)` | Attendance % per code: count of code `AJ$10` in `E15:AI15` divided by working days `MAX(dayRow)-weekends`. `AJ10` etc. hold code headers (`AJ10=1`? Actually sheet shows `AJ10:AM10` are numeric headers; underlying `AJ10=1` corresponds to count weight; pattern repeats for `AK15`, `AM15`.) |
| `I12` example | same `SI.ERROR(BUSCARV(DIASEM(I11,2),Hoja2!$D$1:$E$7,2,FALSO),"")` | Confirms calendar dynamic |
| `E15` | `A` | Sample attendance (live value, not formula) |

**Observables:**
- Formula HTML is syntax-coloured: `=`, `+`, `BUSCARV` in default color, cell refs like `I11` in orange `#f7981d`, ranges like `Hoja2!$D$1:$E$7` in purple `#7e3794`, numbers `2` as `.number`.
- Row 11 uses `&"/"&` concatenation — day/month/year assembled without `DATE()` to stay locale-agnostic.
- Spanish function names confirm file originated as `.xlsx` imported (retains `SI.ERROR` etc. rather than `IFERROR`).

**Screenshots:** `Preparacion-02-I12-formula.png` shows I12 highlighted, `Preparacion-03-E15.png` shows E15=`A`, `Preparacion-04-AJ15.png` shows summary zone after navigating to `AJ15`.

## 7. Network / Console Observations

### Console (13 errors, 15-22 warnings at final idle)
- `net::ERR_BLOCKED_BY_CLIENT @ chrome-extension://invalid/:0` — headless extension shim, benign.
- `filesystem:...woff2` 404 — font cache miss, benign.
- `401` on `peoplestackwebexperiments`, `peopleStackAutocomplete`, `appsgenaiserver/quotaSummary`, `appsgrowthpromo/FetchRecommendation`, `accounts.google.com/ServiceLogin` — expected for `ANONYMOUS` (no OAuth). Does **not** block sheet load.
- `405` on `GET .../renderdata?...` — endpoint requires POST.
- Warnings: repeated preload CSS `4225608131-waffle_k_ltr.css` unused spec — Google's own perf hint.

### Requests (selected; run `playwright-cli requests` + `request N`, `response-body N`)
- `POST docos/p/sync` (sid `7d20c...`) → comment/presence, 200.
- `POST renderdata` ×2 → returns `sheets-images-rt/...` only (image layer).
- `GET .../test?...MODE=init` → bootstrap with `includes_info_params`, 200.
- `POST streamrows` (ids 126,148) → `gridRange: ["1765343219",100…]` and `["950512471",…]` etc. Response is decomposed JSON with:
  - style table (`Calibri`, font sizes, borders, fills `002...`, cond-fmt `670...`),
  - values / literals (`A`, `AT` validation, month names Enero-Diciembre, weekday letters `L`..`D`),
  - named validation blocks `CONDITION_EQ`,
  - dimensions (`29921628` → column widths `0:18`, `1:115` …; row heights hidden).
  **Preparacion rows** are inside `950512471` / `1679302751` snapshots — same payload appears twice (one per grid chunk). Extraction required `response-body` not `resource` entries.
- `POST selection` (≈ 30×) → `selection=[[[...gid...,row,col],[...gid...,row,col,width,height]]]` each navigation (`E15→F15` etc.) 200, body `{}` (fires but no data).
- `POST bind` + `externaldata/fetchData` → offline/wasm `calcworker_wasm_cd.wasm` 200.
- Static assets filtered unless `requests --static`.

All 200s except intentional 401/405; sheet fully loads anon except editing endpoints.

**Performance:**
- `eval("performance.getEntriesByType('resource').slice(-8).map(r=>r.name)")` → last 8 fetches are `play.google.com/log`, `waffle` js, `emojidata`, `spreadsheets-2026-v3.ico` — confirm woff2 not cached, wasm fetched once.

## 8. Limitations & Implications for Apps Script

| Limitation | Evidence | Workaround for automation |
|------------|----------|---------------------------|
| **Canvas rendering** — no DOM cells | `canvas.width=1264 height=524`, snapshot shows only toolbars/tabs | Must read via formula bar or `streamrows` API, not `find`/`snapshot` on cell text |
| **Overlay intercepts clicks** | `freezebar-handle` blocks `click "canvas"` → timeout | Use `mousemove+mousedown+mouseup` at computed centre or use name-box navigation exclusively |
| **View-only anon** — no write, no validation toast | `Compartir disabled`, `401` on auth endpoints, `waffle-rich-text-editor` stays read-only | Authenticate (Service Account / OAuth) or use Sheets API v4 with `valueRenderOption=FORMULA` for ground truth |
| **Data-validation UI hidden anon** | No `[role=listbox]` dropdown after focusing `E15`; only toolbar comboboxes | Verify validation via `spreadsheets.get` → `sheets.dataValidation` rather than UI |
| **Obfuscated waffle internals** | `waffle_api.getInstanceOfApp()` keys are `wLa`, `Gb`… | Don't rely on internal JS; use public `sheets.googleapis.com/v4/...` + `batchGet` |
| **Range aliasing (merged `S7:U7` etc.)** | Name-box shows `S7:U7` not `S7` alone | Always normalize with `trim` and accept `A1:B1` notation; treat merged as single value holder |
| **Formula locale** | `SI.ERROR`/`BUSCARV`/`DIASEM` Spanish; `+` prefix tolerated | When pushing via API, either keep Spanish (`userEnteredValue.formulaValue`) or convert to English via `convertTo...` — test with `setFormula` |
| **Calendar dynamic depends on `Hoja2`** | `Hoja2!D1:E7` (weekday initials) and `Hoja2!A1:B12` (month map) | Ensure `Hoja2` is replicated intact; missing lookup causes `IFERROR` blank → appears as weekend bug |
| **Weekend handling** | `W7 = COUNTIF(S)+COUNTIF(D)` subtracted from `MAX(E13:AI13)` | Apps Script `onEdit` should recalc `W7` when month changes; hard-coding September (30 days) would miss 28/31 logic |
| **Summary `%` columns** | `AJ15:AM15` share `COUNTIF(range, header)/(MAX-W7)` | Header row `10` must contain exactly `A,AT,BM,F` strings; verify via API before aggregating |

**Recommended Apps Script shape (derived):**
```js
function onEdit(e){
  const sh = e.range.getSheet();
  if(sh.getName()!=='Preparacion') return;
  // 1) validate E15:AI44 ∈ {A,AT,BM,F,""}
  // 2) recalc weekday row 12 via =SI.ERROR(BUSCARV(DIASEM(...)))  or script backup
  // 3) recompute W7, summary columns AJ:AM, conditional formats (BM→color)
}
function onSelectionChange(e){ /* highlight row/col, show legend */ }
```
But Playwright alone cannot prove `onEdit`/`onSelectionChange` triggers exist — they must be inspected via `ScriptApp.getProjectTriggers()` or Apps Script editor, not DOM.

**What Playwright _can_ prove for regression:** tab existence, canvas presence, formula-bar values for critical cells (`S7`, `S9`, `V9`, `E11/E12`, `I11/I12`, `W7`, `AJ15`), and that anon view does not leak edit capability.

## 9. Evidence

| File / Ref | Purpose |
|------------|---------|
| `Preparacion-01-overview.png` | First viewport after `click e346` → Preparacion active, canvas visible |
| `Preparacion-02-I12-formula.png` | Canvas-centre click selects `I12`; formula bar `=+SI.ERROR(BUSCARV(DIASEM(I11,2),Hoja2!$D$1:$E$7,2,FALSO),"")` |
| `Preparacion-03-E15.png` | Name-box `E15` → value `A`, formula bar `A` |
| `Preparacion-04-AJ15.png` | `AJ15` summary formula `=+CONTAR.SI($E15:$AI15,AJ$10)/(MAX($E$13:$AI$13)-$W$7)` |
| `Preparacion-05-grid.png` | Final idle grid after arrow-key walk; freeze panes intact |
| Snapshots | `.playwright-cli/page-2026-08-30T18-36-56-342Z.yml` (post-click Preparacion), `page-2026-08-30T18-38-37-202Z.yml` (I12 select), `page-2026-08-30T18-47-00-818Z.yml` (AJ15) |
| `eval` outputs | `document.title="Control-de-Asistencia.xlsx…"`, `location.href="?gid=740536758"`, `canvas rect`, `#t-name-box/#t-formula-bar-input` per-cell table above, `performance.resources`, `waffle_api` keys, `console`/`requests` lists, `response-body 126/148` (streamrows) |
| Network | `renderdata 200`, `streamrows 200` (decomposed ranges), `selection 200×30`, `401` anon set |

All evidence saved under `/home/luis-cm/Documents/Github/Control-de-Asistencia/docs/playwright-evidence/` (mkdir created). No `/tmp` writes, no npm/pip installs.

---

### Repro steps (minimal)

```bash
/home/luis-cm/.local/share/pnpm/bin/playwright-cli open "https://docs.google.com/spreadsheets/d/1iw9bduLeGXQMbjmMV1qrMqE2WoPWCBz3/edit?usp=sharing&ouid=117451366137059836661&rtpof=true&sd=true"
# wait for snapshot → confirm "- AYUDA -" active
playwright-cli click e346  # Preparacion
playwright-cli eval "document.getElementById('t-name-box').value"
playwright-cli fill e252 "E15" --submit && playwright-cli eval "document.getElementById('t-formula-bar-input').textContent"
playwright-cli fill e252 "AJ15" --submit && playwright-cli eval "document.getElementById('t-formula-bar-input').textContent"
playwright-cli screenshot --filename=docs/playwright-evidence/Preparacion-01-overview.png
```
Toggle `snapshot --boxes` for coordinates; use `request`/`response-body` for `streamrows` truth.

