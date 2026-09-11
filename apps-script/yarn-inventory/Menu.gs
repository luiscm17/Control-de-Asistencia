/**
 * Menu.gs — Inventario menu + hydration (fecha+turno) for Yarn Inventory.
 *
 * Menu: Inventario → Guardar Madejeras | Guardar Lotes | Guardar Todo
 *       + Ver db_madejeras | Ver db_lotes | Re-sincronizar
 * Hydration: B3/F3 (madejeras) or C3/E3 (lotes) change → clear input-only
 *            then fill matching PK fecha+turno from DB. Formulas never touched:
 *            madejeras H8:K17 (H=IF(D>0,C/D,0) I=H*E J=IF(F>0,I/F,0) K=IF(G>0,I/G,0))
 *            lotes G6:G52 META, P6:P52 TOTAL, Q6:Q52 AJUSTE, R6:R52 ESTADO.
 * Timezone: fecha native DATE via getFullYear/getMonth/getDate (no formatDate);
 *           audit creado/actualizado via Utilities.formatDate(...,America/La_Paz) only.
 * No literal getRange("A1") outside Config.gs — always via yarnInventoryGetRange_.
 *
 * INSTALL: Extensions > Apps Script > paste this project > Save > Reload sheet
 * VERIFY:  Use a COPY of 1RCupngk5x95ev5N4Zv0veMMbOhz6eH_9Vs44a1txE3s — never prod.
 */

// --- MENU SETUP ---

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Inventario')
    .addItem('Guardar Madejeras', 'guardarMadejeras')
    .addItem('Guardar Lotes', 'guardarLotes')
    .addItem('Guardar Todo', 'guardarTodo')
    .addSeparator()
    .addItem('Ver db_madejeras', 'yarnInventoryMenuVerMadejeras')
    .addItem('Ver db_lotes', 'yarnInventoryMenuVerLotes')
    .addSeparator()
    .addItem('Re-sincronizar', 'yarnInventoryMenuResincronizar')
    .addToUi();
}

// Keep simple trigger delegate for sheet-bound onEdit hydration (no install needed for read)
function onEdit(e) {
  yarnInventoryOnEdit(e);
}

// --- MENU ACTIONS (public, no trailing underscore) ---

function yarnInventoryMenuVerMadejeras() {
  yarnInventoryActivateSheet_(YARN_INVENTORY_CONFIG.SHEETS.DB_MADEJERAS);
}

function yarnInventoryMenuVerLotes() {
  yarnInventoryActivateSheet_(YARN_INVENTORY_CONFIG.SHEETS.DB_LOTES);
}

function yarnInventoryMenuResincronizar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  yarnInventoryEnsureSchema(ss);
  yarnInventoryEnsureEditTrigger_();
  ss.toast('\u2705 Esquema verificado — db_madejeras/db_lotes/Errors listos', 'Inventario', 5);
}

function yarnInventoryActivateSheet_(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    // Recreate via Config then retry
    yarnInventoryEnsureSchema(ss);
    sheet = ss.getSheetByName(sheetName);
  }
  if (!sheet) throw new Error(sheetName + ' is unavailable. Run Re-sincronizar first.');
  ss.setActiveSheet(sheet);
}

function yarnInventoryEnsureEditTrigger_() {
  var handler = 'yarnInventoryOnEdit';
  var exists = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === handler && t.getEventType() === ScriptApp.EventType.ON_EDIT;
  });
  if (!exists) {
    ScriptApp.newTrigger(handler).forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
  }
}

// --- HYDRATION: fecha OR turno change → clear input-only then fill PK fecha+turno ---

function yarnInventoryOnEdit(e) {
  try {
    if (!e || !e.range) return;
    var sheet = e.range.getSheet();
    if (!sheet) return;
    var name = sheet.getName();
    var ss = e.source || SpreadsheetApp.getActiveSpreadsheet();
    if (name === YARN_INVENTORY_CONFIG.SHEETS.MADEJERAS) {
      if (!yarnInventoryIsMadejerasFilterEdit_(e)) return;
      yarnInventoryHydrateMadejerasByFilter_(ss);
    } else if (name === YARN_INVENTORY_CONFIG.SHEETS.LOTES) {
      if (!yarnInventoryIsLotesFilterEdit_(e)) return;
      yarnInventoryHydrateLotesByFilter_(ss);
    }
  } catch (err) {
    try {
      yarnInventoryLogError_('hydration_failed', err && err.message ? err.message : String(err), 'onEdit', e && e.source ? e.source : null);
    } catch (ignore) {}
    try { SpreadsheetApp.getActiveSpreadsheet().toast('\u26a0\ufe0f No se pudo cargar el turno', 'Inventario', 5); } catch (ignore2) {}
  }
}

function yarnInventoryIsMadejerasFilterEdit_(e) {
  var range = e.range;
  var sheet = range.getSheet();
  if (sheet.getName() !== YARN_INVENTORY_CONFIG.SHEETS.MADEJERAS) return false;
  var datePos = yarnInventoryParseA1_(YARN_INVENTORY_CONFIG.RANGES.MADEJERAS_DATE);
  var turnoPos = yarnInventoryParseA1_(YARN_INVENTORY_CONFIG.RANGES.MADEJERAS_TURNO);
  var r = range.getRow();
  var c = range.getColumn();
  return (r === datePos.row && c === datePos.col) || (r === turnoPos.row && c === turnoPos.col);
}

function yarnInventoryIsLotesFilterEdit_(e) {
  var range = e.range;
  var sheet = range.getSheet();
  if (sheet.getName() !== YARN_INVENTORY_CONFIG.SHEETS.LOTES) return false;
  var datePos = yarnInventoryParseA1_(YARN_INVENTORY_CONFIG.RANGES.LOTES_DATE);
  var turnoPos = yarnInventoryParseA1_(YARN_INVENTORY_CONFIG.RANGES.LOTES_TURNO);
  var r = range.getRow();
  var c = range.getColumn();
  return (r === datePos.row && c === datePos.col) || (r === turnoPos.row && c === turnoPos.col);
}

function yarnInventoryHydrateMadejerasByFilter_(ss) {
  var spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet();
  var sheet = yarnInventoryGetSheet_(spreadsheet, 'MADEJERAS');
  if (!sheet) return;
  var dateVal = yarnInventoryGetRange_(sheet, YARN_INVENTORY_CONFIG.RANGES.MADEJERAS_DATE).getValue();
  var turnoVal = yarnInventoryGetRange_(sheet, YARN_INVENTORY_CONFIG.RANGES.MADEJERAS_TURNO).getValue();
  var fechaKey = yarnInventoryDateKey_(dateVal);
  var turnoNorm = String(turnoVal || '').trim();
  // Invalid blocks that form: do not clear/fill if selector invalid — no partial write
  if (!fechaKey) return;
  if (!yarnInventoryIsInListCI_(turnoNorm, YARN_INVENTORY_CONFIG.TURNO_MADEJERAS)) return;
  yarnInventoryHydrateMadejeras_(spreadsheet, sheet, fechaKey, turnoNorm);
}

function yarnInventoryHydrateLotesByFilter_(ss) {
  var spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet();
  var sheet = yarnInventoryGetSheet_(spreadsheet, 'LOTES');
  if (!sheet) return;
  var dateVal = yarnInventoryGetRange_(sheet, YARN_INVENTORY_CONFIG.RANGES.LOTES_DATE).getValue();
  var turnoVal = yarnInventoryGetRange_(sheet, YARN_INVENTORY_CONFIG.RANGES.LOTES_TURNO).getValue();
  var fechaKey = yarnInventoryDateKey_(dateVal);
  var turnoNorm = String(turnoVal || '').trim();
  if (!fechaKey) return;
  if (!yarnInventoryIsInListCI_(turnoNorm, YARN_INVENTORY_CONFIG.TURNO_LOTES)) return;
  yarnInventoryHydrateLotes_(spreadsheet, sheet, fechaKey, turnoNorm);
}

// Core hydrate: clear input-only then fill PK fecha+turno (active only), formulas never touched

function yarnInventoryHydrateMadejeras_(ss, sheet, fechaKey, turno) {
  var spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet();
  var targetSheet = sheet || yarnInventoryGetSheet_(spreadsheet, 'MADEJERAS');
  if (!targetSheet) return;
  // Clear C8:G17 input-only — never H8:K17
  yarnInventoryClearMadejerasInputs_(targetSheet);

  var state = null;
  try {
    state = yarnInventoryLoadState_(spreadsheet);
  } catch (err) {
    yarnInventoryLogError_('hydration_failed', err && err.message ? err.message : String(err), 'madejeras', spreadsheet);
    return;
  }
  var byId = (state && state.madejerasById) || {};
  // Filter active rows for this fecha+turno
  var matches = [];
  for (var id in byId) {
    if (!Object.prototype.hasOwnProperty.call(byId, id)) continue;
    var entry = byId[id];
    var data = entry.data;
    if (String(data[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.ESTADO] || '').toLowerCase() !== 'active') continue;
    var rowFechaKey = yarnInventoryDateKey_(data[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.FECHA]);
    if (rowFechaKey !== fechaKey) continue;
    var rowTurno = String(data[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.TURNO] || '').trim();
    if (rowTurno.toLowerCase() !== String(turno).trim().toLowerCase()) continue;
    matches.push(data);
  }
  if (matches.length === 0) {
    SpreadsheetApp.flush();
    try { spreadsheet.toast('Nuevo turno — sin datos guardados', 'Inventario', 3); } catch (ignore) {}
    return;
  }
  // Build 10x5 matrix for C8:G17 (maquina/lado → row idx)
  var rows = 10;
  var cols = 5;
  var matrix = [];
  for (var i = 0; i < rows; i++) matrix.push(['', '', '', '', '']);
  for (var m = 0; m < matches.length; m++) {
    var d = matches[m];
    var maquina = String(d[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.MAQUINA] || '').trim();
    var lado = String(d[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.LADO] || '').trim().toUpperCase();
    // Parse Máquina 1..5
    var numMatch = maquina.match(/(\d+)/);
    var machineNum = numMatch ? parseInt(numMatch[1], 10) : 0;
    if (machineNum < 1 || machineNum > 5) continue;
    var ladoIdx = lado === 'B' ? 1 : 0;
    if (lado !== 'A' && lado !== 'B') continue;
    var idx = (machineNum - 1) * 2 + ladoIdx;
    if (idx < 0 || idx >= rows) continue;
    matrix[idx][0] = d[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.TITULO_BASE];
    matrix[idx][1] = d[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.CABOS];
    matrix[idx][2] = d[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.PESO_DESEADO];
    matrix[idx][3] = d[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.TAMANO_ASPA];
    matrix[idx][4] = d[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.VELOCIDAD];
  }
  yarnInventoryGetRange_(targetSheet, YARN_INVENTORY_CONFIG.RANGES.MADEJERAS_INPUTS).setValues(matrix);
  SpreadsheetApp.flush();
  try { spreadsheet.toast('Turno cargado: ' + fechaKey + ' ' + turno, 'Inventario', 3); } catch (ignore2) {}
}

function yarnInventoryHydrateLotes_(ss, sheet, fechaKey, turno) {
  var spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet();
  var targetSheet = sheet || yarnInventoryGetSheet_(spreadsheet, 'LOTES');
  if (!targetSheet) return;
  // Clear A6:F52 + H6:O52 input-only — never G/P/Q/R
  yarnInventoryClearLotesInputs_(targetSheet);

  var state = null;
  try {
    state = yarnInventoryLoadState_(spreadsheet);
  } catch (err) {
    yarnInventoryLogError_('hydration_failed', err && err.message ? err.message : String(err), 'lotes', spreadsheet);
    return;
  }
  var byId = (state && state.lotesById) || {};
  var matches = [];
  for (var id in byId) {
    if (!Object.prototype.hasOwnProperty.call(byId, id)) continue;
    var entry = byId[id];
    var data = entry.data;
    if (String(data[YARN_INVENTORY_CONFIG.IDX_LOTES.ESTADO] || '').toLowerCase() !== 'active') continue;
    var rowFechaKey = yarnInventoryDateKey_(data[YARN_INVENTORY_CONFIG.IDX_LOTES.FECHA]);
    if (rowFechaKey !== fechaKey) continue;
    var rowTurno = String(data[YARN_INVENTORY_CONFIG.IDX_LOTES.TURNO] || '').trim();
    if (rowTurno.toLowerCase() !== String(turno).trim().toLowerCase()) continue;
    matches.push(data);
  }
  if (matches.length === 0) {
    SpreadsheetApp.flush();
    try { spreadsheet.toast('Nuevo turno — sin datos guardados', 'Inventario', 3); } catch (ignore) {}
    return;
  }
  // Sort by rango_origen row number so hydration is deterministic
  matches.sort(function (a, b) {
    var ra = String(a[YARN_INVENTORY_CONFIG.IDX_LOTES.RANGO_ORIGEN] || '');
    var rb = String(b[YARN_INVENTORY_CONFIG.IDX_LOTES.RANGO_ORIGEN] || '');
    var na = ra.match(/A(\d+):/);
    var nb = rb.match(/A(\d+):/);
    var rna = na ? parseInt(na[1], 10) : 9999;
    var rnb = nb ? parseInt(nb[1], 10) : 9999;
    return rna - rnb;
  });

  // Build maps rowNum -> values for both input blocks
  var loteRangeA = yarnInventoryParseRange_(YARN_INVENTORY_CONFIG.RANGES.LOTES_INPUTS_A);
  var loteRangeB = yarnInventoryParseRange_(YARN_INVENTORY_CONFIG.RANGES.LOTES_INPUTS_B);
  // Prepare 47 rows each
  var rowsA = loteRangeA.r2 - loteRangeA.r1 + 1; // 47
  var rowsB = loteRangeB.r2 - loteRangeB.r1 + 1; // 47
  var matrixA = [];
  var matrixB = [];
  for (var i = 0; i < rowsA; i++) matrixA.push(['', '', '', '', '', '']);
  for (var j = 0; j < rowsB; j++) matrixB.push(['', '', '', '', '', '', '', '']);

  for (var k = 0; k < matches.length; k++) {
    var d2 = matches[k];
    var rango = String(d2[YARN_INVENTORY_CONFIG.IDX_LOTES.RANGO_ORIGEN] || '');
    var m = rango.match(/A(\d+):/);
    var sheetRow = m ? parseInt(m[1], 10) : 0;
    // Fallback: parse id suffix row6..52 when rango missing and lote_id empty
    if (!sheetRow || sheetRow < loteRangeA.r1 || sheetRow > loteRangeA.r2) {
      var idStr = String(d2[YARN_INVENTORY_CONFIG.IDX_LOTES.ID] || '');
      var rowFallback = idStr.match(/row(\d+)$/i);
      if (rowFallback) sheetRow = parseInt(rowFallback[1], 10);
    }
    if (!sheetRow || sheetRow < loteRangeA.r1 || sheetRow > loteRangeA.r2) continue;
    var idxRow = sheetRow - loteRangeA.r1;
    // A6:F52: lote_id, tipo_orden, color, titulo, objetivo_neto, aumento
    matrixA[idxRow][0] = d2[YARN_INVENTORY_CONFIG.IDX_LOTES.LOTE_ID];
    matrixA[idxRow][1] = d2[YARN_INVENTORY_CONFIG.IDX_LOTES.TIPO_ORDEN];
    matrixA[idxRow][2] = d2[YARN_INVENTORY_CONFIG.IDX_LOTES.COLOR];
    matrixA[idxRow][3] = d2[YARN_INVENTORY_CONFIG.IDX_LOTES.TITULO];
    matrixA[idxRow][4] = d2[YARN_INVENTORY_CONFIG.IDX_LOTES.OBJETIVO_NETO];
    matrixA[idxRow][5] = d2[YARN_INVENTORY_CONFIG.IDX_LOTES.AUMENTO];
    // H6:O52: pesada_1..8
    matrixB[idxRow][0] = d2[YARN_INVENTORY_CONFIG.IDX_LOTES.PESADA_1];
    matrixB[idxRow][1] = d2[YARN_INVENTORY_CONFIG.IDX_LOTES.PESADA_2];
    matrixB[idxRow][2] = d2[YARN_INVENTORY_CONFIG.IDX_LOTES.PESADA_3];
    matrixB[idxRow][3] = d2[YARN_INVENTORY_CONFIG.IDX_LOTES.PESADA_4];
    matrixB[idxRow][4] = d2[YARN_INVENTORY_CONFIG.IDX_LOTES.PESADA_5];
    matrixB[idxRow][5] = d2[YARN_INVENTORY_CONFIG.IDX_LOTES.PESADA_6];
    matrixB[idxRow][6] = d2[YARN_INVENTORY_CONFIG.IDX_LOTES.PESADA_7];
    matrixB[idxRow][7] = d2[YARN_INVENTORY_CONFIG.IDX_LOTES.PESADA_8];
  }

  yarnInventoryGetRange_(targetSheet, YARN_INVENTORY_CONFIG.RANGES.LOTES_INPUTS_A).setValues(matrixA);
  yarnInventoryGetRange_(targetSheet, YARN_INVENTORY_CONFIG.RANGES.LOTES_INPUTS_B).setValues(matrixB);
  SpreadsheetApp.flush();
  try { spreadsheet.toast('Turno cargado: ' + fechaKey + ' ' + turno, 'Inventario', 3); } catch (ignore2) {}
}

function yarnInventoryClearMadejerasInputs_(sheet) {
  var target = sheet || yarnInventoryGetSheet_(SpreadsheetApp.getActiveSpreadsheet(), 'MADEJERAS');
  if (!target) return;
  // Only C8:G17 — nunca H8:K17
  yarnInventoryGetRange_(target, YARN_INVENTORY_CONFIG.RANGES.MADEJERAS_INPUTS).clearContent();
  SpreadsheetApp.flush();
}

function yarnInventoryClearLotesInputs_(sheet) {
  var target = sheet || yarnInventoryGetSheet_(SpreadsheetApp.getActiveSpreadsheet(), 'LOTES');
  if (!target) return;
  // Only A6:F52 + H6:O52 — nunca G/P/Q/R formulas
  yarnInventoryGetRange_(target, YARN_INVENTORY_CONFIG.RANGES.LOTES_INPUTS_A).clearContent();
  yarnInventoryGetRange_(target, YARN_INVENTORY_CONFIG.RANGES.LOTES_INPUTS_B).clearContent();
  SpreadsheetApp.flush();
}
