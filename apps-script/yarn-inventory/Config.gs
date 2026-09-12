/**
 * Config.gs — Frozen SSOT for the isolated Yarn Inventory Apps Script project.
 *
 * Single source of truth for sheets, A1 ranges, headers (A:Q 17 + A:X 24),
 * PK indexes, turno/supervisor/inventario lists, limits and formula guards.
 * No literal `getRange("A1")` outside this file — use helpers below.
 *
 * INSTALL: Extensions > Apps Script > paste this project > Save > Reload sheet
 * VERIFY:  Use a COPY of 1RCupngk5x95ev5N4Zv0veMMbOhz6eH_9Vs44a1txE3s — never prod.
 */

var YARN_INVENTORY_CONFIG = Object.freeze({
  TIMEZONE: 'America/La_Paz',
  SHEETS: Object.freeze({
    MADEJERAS: 'madejeras',
    LOTES: 'lotes',
    DB_MADEJERAS: 'db_madejeras',
    DB_LOTES: 'db_lotes',
    ERRORS: 'Errors'
  }),
  RANGES: Object.freeze({
    MADEJERAS_DATE: 'B3',
    MADEJERAS_TURNO: 'F3',
    MADEJERAS_SUP: 'B4',
    MADEJERAS_INV: 'F4',
    MADEJERAS_INPUTS: 'C8:G17',
    MADEJERAS_FORMULAS: 'H8:K17',
    MADEJERAS_FORMULAS_PARTS: Object.freeze({
      FACTOR: 'H8:H17',
      METRAJE: 'I8:I17',
      VUELTAS: 'J8:J17',
      TIEMPO: 'K8:K17'
    }),
    MADEJERAS_LABEL: 'G3',
    MADEJERAS_CHECKBOX: 'G4',
    LOTES_DATE: 'C3',
    LOTES_TURNO: 'E3',
    LOTES_SUP: 'G3',
    LOTES_INV: 'I3',
    LOTES_LABEL: 'J3',
    LOTES_CHECKBOX: 'K3',
    LOTES_INPUTS_A: 'A6:F52',
    LOTES_INPUTS_B: 'H6:O52',
    LOTES_FORMULAS: Object.freeze({
      META: 'G6:G52',
      TOTAL: 'P6:P52',
      AJUSTE: 'Q6:Q52',
      ESTADO: 'R6:R52'
    })
  }),
  MOBILE_SAVE_DEBOUNCE_MS: 3000,
  MOBILE_SAVE_HANDLER: 'yarnInventoryMobileOnEdit',
  MOBILE_SAVE_NOTE_PREFIX: 'yarn-inventory-save:',
  MADEJERAS_HEADERS: Object.freeze([
    'id', 'fecha', 'turno', 'supervisor', 'inventario', 'maquina', 'lado',
    'titulo_base', 'cabos', 'peso_deseado', 'tamano_aspa', 'velocidad',
    'creado', 'actualizado', 'editado_por', 'rango_origen', 'estado'
  ]),
  LOTES_HEADERS: Object.freeze([
    'id', 'fecha', 'turno', 'supervisor', 'inventario', 'lote_id', 'tipo_orden',
    'color', 'titulo', 'objetivo_neto', 'aumento',
    'pesada_1', 'pesada_2', 'pesada_3', 'pesada_4', 'pesada_5', 'pesada_6', 'pesada_7', 'pesada_8',
    'creado', 'actualizado', 'editado_por', 'rango_origen', 'estado'
  ]),
  ERRORS_HEADERS: Object.freeze([
    'timestamp', 'scope', 'range', 'code', 'reason', 'user'
  ]),
  IDX_MADEJERAS: Object.freeze({
    ID: 0, FECHA: 1, TURNO: 2, SUPERVISOR: 3, INVENTARIO: 4, MAQUINA: 5, LADO: 6,
    TITULO_BASE: 7, CABOS: 8, PESO_DESEADO: 9, TAMANO_ASPA: 10, VELOCIDAD: 11,
    CREADO: 12, ACTUALIZADO: 13, EDITADO_POR: 14, RANGO_ORIGEN: 15, ESTADO: 16
  }),
  IDX_LOTES: Object.freeze({
    ID: 0, FECHA: 1, TURNO: 2, SUPERVISOR: 3, INVENTARIO: 4, LOTE_ID: 5, TIPO_ORDEN: 6,
    COLOR: 7, TITULO: 8, OBJETIVO_NETO: 9, AUMENTO: 10,
    PESADA_1: 11, PESADA_2: 12, PESADA_3: 13, PESADA_4: 14, PESADA_5: 15, PESADA_6: 16, PESADA_7: 17, PESADA_8: 18,
    CREADO: 19, ACTUALIZADO: 20, EDITADO_POR: 21, RANGO_ORIGEN: 22, ESTADO: 23
  }),
  IDX_ERRORS: Object.freeze({
    TIMESTAMP: 0, SCOPE: 1, RANGE: 2, CODE: 3, REASON: 4, USER: 5
  }),
  TURNO_MADEJERAS: Object.freeze(['Turno Dia', 'Turno Tarde', 'Turno Noche']),
  TURNO_LOTES: Object.freeze(['Dia', 'Tarde', 'Noche']),
  SUPERVISOR_VALUES: Object.freeze(['Junior', 'Rondi', 'Pablo']),
  INVENTARIO_VALUES: Object.freeze(['Ricky', 'Benacio', 'Cojeno']),
  TIPO_ORDEN_VALUES: Object.freeze(['Lote', 'Stock']),
  LIMITS: Object.freeze({
    MADEJERAS_PER_DAY: 10,
    LOTES_PER_DAY: 47,
    LOTES_MAX_ROW: 52,
    LOTES_SHEET_MAX_ROW: 1002,
    DB_MADEJERAS_COLUMNS: 17,
    DB_LOTES_COLUMNS: 24,
    ERROR_COLUMNS: 6
  }),
  UI: Object.freeze({
    HEADER_PROTECTION: 'YarnInventory frozen header — do not reorder',
    DB_MADEJERAS_COLOR: '#e8f0fe',
    DB_LOTES_COLOR: '#e8f0fe',
    ERRORS_COLOR: '#fce8e6'
  }),
  ERRORS: Object.freeze({
    INVALID_FECHA: 'invalid_fecha',
    INVALID_TURNO: 'invalid_turno',
    INVALID_SUPERVISOR: 'invalid_supervisor',
    INVALID_INVENTARIO: 'invalid_inventario',
    EMPTY_FORM: 'empty_form',
    LOCK_TIMEOUT: 'lock_timeout',
    VALIDATION_FAILED: 'validation_failed'
  })
});

// --- Sheet access (no literal A1 outside Config) ---

function yarnInventoryGetSheet_(ss, key) {
  var spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet();
  var name = YARN_INVENTORY_CONFIG.SHEETS[key];
  if (!name) throw new Error('Unknown sheet key: ' + key);
  return spreadsheet.getSheetByName(name);
}

function yarnInventoryRequireSheet_(ss, key) {
  var sheet = yarnInventoryGetSheet_(ss, key);
  if (!sheet) throw new Error('Required sheet is missing: ' + YARN_INVENTORY_CONFIG.SHEETS[key]);
  return sheet;
}

// --- A1 parsing ---

function yarnInventoryParseA1_(a1) {
  var raw = String(a1).trim().toUpperCase();
  var match = raw.match(/^([A-Z]+)(\d+)$/);
  if (!match) throw new Error('Invalid A1: ' + a1);
  var letters = match[1];
  var col = 0;
  for (var i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return { row: parseInt(match[2], 10), col: col };
}

function yarnInventoryParseRange_(a1Range) {
  var raw = String(a1Range).trim();
  var parts = raw.split(':');
  if (parts.length === 1) {
    var single = yarnInventoryParseA1_(parts[0]);
    return { r1: single.row, c1: single.col, r2: single.row, c2: single.col };
  }
  var start = yarnInventoryParseA1_(parts[0]);
  var end = yarnInventoryParseA1_(parts[1]);
  return { r1: start.row, c1: start.col, r2: end.row, c2: end.col };
}

function yarnInventoryGetRange_(sheet, a1Range) {
  var r = yarnInventoryParseRange_(a1Range);
  return sheet.getRange(r.r1, r.c1, r.r2 - r.r1 + 1, r.c2 - r.c1 + 1);
}

// --- Fecha: native DATE passthrough (raw getValue/setValues, no new Date) ---
// For ID/filter/hydration comparison only — fecha column itself is stored as raw Date.

function yarnInventoryDateKey_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    var y = value.getFullYear();
    var m = value.getMonth() + 1;
    var d = value.getDate();
    return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }
  var raw = String(value || '').trim();
  if (!raw) return '';
  var iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    var yr = Number(iso[1]); var mo = Number(iso[2]); var da = Number(iso[3]);
    if (mo < 1 || mo > 12 || da < 1 || da > 31) return '';
    return yr + '-' + String(mo).padStart(2, '0') + '-' + String(da).padStart(2, '0');
  }
  var dm = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!dm) return '';
  var dd = Number(dm[1]); var mm = Number(dm[2]); var yy = Number(dm[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return '';
  return yy + '-' + String(mm).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
}

function yarnInventoryIsValidDate_(value) {
  return yarnInventoryDateKey_(value) !== '';
}

// --- Helpers for validation (trim + case-insensitive) ---

function yarnInventoryNormalizeText_(value) {
  return String(value || '').trim();
}

function yarnInventoryIsInListCI_(value, list) {
  var norm = yarnInventoryNormalizeText_(value).toLowerCase();
  if (!norm) return false;
  for (var i = 0; i < list.length; i++) {
    if (String(list[i]).trim().toLowerCase() === norm) return true;
  }
  return false;
}

function yarnInventoryHeadersMatch_(actual, expected) {
  if (!actual || actual.length !== expected.length) return false;
  for (var i = 0; i < expected.length; i++) {
    if (String(actual[i] || '').trim() !== expected[i]) return false;
  }
  return true;
}

// --- Schema: Re-sincronizar creates db_madejeras/db_lotes/Errors with frozen headers+protection ---

function yarnInventoryEnsureSchema(optSpreadsheet) {
  var ss = optSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  yarnInventoryEnsureTableSheet_(ss, 'DB_MADEJERAS', YARN_INVENTORY_CONFIG.MADEJERAS_HEADERS, YARN_INVENTORY_CONFIG.UI.DB_MADEJERAS_COLOR);
  yarnInventoryEnsureTableSheet_(ss, 'DB_LOTES', YARN_INVENTORY_CONFIG.LOTES_HEADERS, YARN_INVENTORY_CONFIG.UI.DB_LOTES_COLOR);
  yarnInventoryEnsureTableSheet_(ss, 'ERRORS', YARN_INVENTORY_CONFIG.ERRORS_HEADERS, YARN_INVENTORY_CONFIG.UI.ERRORS_COLOR);
  yarnInventoryConfigureMobileCheckboxes_(ss);
  SpreadsheetApp.flush();
}

function yarnInventoryConfigureMobileCheckboxes_(ss) {
  var spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet();
  try {
    var madejerasSheet = yarnInventoryGetSheet_(spreadsheet, 'MADEJERAS');
    if (madejerasSheet) {
      var labelM = yarnInventoryGetRange_(madejerasSheet, YARN_INVENTORY_CONFIG.RANGES.MADEJERAS_LABEL);
      var checkboxM = yarnInventoryGetRange_(madejerasSheet, YARN_INVENTORY_CONFIG.RANGES.MADEJERAS_CHECKBOX);
      var ruleM = SpreadsheetApp.newDataValidation().requireCheckbox().setAllowInvalid(false).setHelpText('Marcar para guardar madejeras.').build();
      checkboxM.setDataValidation(ruleM);
      try {
        var curM = checkboxM.getValue();
        if (curM !== false) {
          // Normalize any TRUE/VERDADERO/empty string to FALSE so user can re-tap
          checkboxM.setValue(false);
        }
      } catch (e1) {
        try { checkboxM.setValue(false); } catch (ignore) {}
      }
      if (String(labelM.getDisplayValue() || '').trim() === '') labelM.setValue('Guardar');
      labelM.setFontWeight('bold').setFontSize(10).setVerticalAlignment('middle').setFontColor('#174ea6');
      checkboxM.setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground('#e8f0fe').setBorder(true, true, true, true, true, true, '#1a73e8', SpreadsheetApp.BorderStyle.SOLID);
    }
  } catch (e) { Logger.log('yarnInventoryConfigureMobileCheckboxes_ madejeras: ' + e.message); }
  try {
    var lotesSheet = yarnInventoryGetSheet_(spreadsheet, 'LOTES');
    if (lotesSheet) {
      var labelL = yarnInventoryGetRange_(lotesSheet, YARN_INVENTORY_CONFIG.RANGES.LOTES_LABEL);
      var checkboxL = yarnInventoryGetRange_(lotesSheet, YARN_INVENTORY_CONFIG.RANGES.LOTES_CHECKBOX);
      var ruleL = SpreadsheetApp.newDataValidation().requireCheckbox().setAllowInvalid(false).setHelpText('Marcar para guardar lotes.').build();
      checkboxL.setDataValidation(ruleL);
      try {
        var curL = checkboxL.getValue();
        if (curL !== false) checkboxL.setValue(false);
      } catch (e2) {
        try { checkboxL.setValue(false); } catch (ignore2) {}
      }
      if (String(labelL.getDisplayValue() || '').trim() === '') labelL.setValue('Guardar');
      labelL.setFontWeight('bold').setFontSize(10).setVerticalAlignment('middle').setFontColor('#174ea6');
      checkboxL.setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground('#e8f0fe').setBorder(true, true, true, true, true, true, '#1a73e8', SpreadsheetApp.BorderStyle.SOLID);
    }
  } catch (e3) { Logger.log('yarnInventoryConfigureMobileCheckboxes_ lotes: ' + e3.message); }
}

function yarnInventoryEnsureTableSheet_(ss, sheetKey, headers, headerColor) {
  var sheetName = YARN_INVENTORY_CONFIG.SHEETS[sheetKey];
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  var width = headers.length;
  var headerRange = sheet.getRange(1, 1, 1, width);
  var current = headerRange.getValues()[0];
  if (!yarnInventoryHeadersMatch_(current, headers)) {
    headerRange.setValues([headers]);
  }
  headerRange.setFontWeight('bold').setBackground(headerColor);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, width);
  yarnInventoryEnsureHeaderProtection_(sheet, headerRange);
  // Number formats for DB columns
  try {
    if (sheetKey === 'DB_MADEJERAS' && sheet.getMaxRows() > 1) {
      // B fecha as native DATE dd/MM/yyyy — raw passthrough, no conversion
      sheet.getRange(2, YARN_INVENTORY_CONFIG.IDX_MADEJERAS.FECHA + 1, Math.max(1, sheet.getMaxRows() - 1), 1).setNumberFormat('dd/MM/yyyy');
      sheet.getRange(2, YARN_INVENTORY_CONFIG.IDX_MADEJERAS.CREADO + 1, Math.max(1, sheet.getMaxRows() - 1), 2).setNumberFormat('yyyy-MM-dd HH:mm:ss');
    }
    if (sheetKey === 'DB_LOTES' && sheet.getMaxRows() > 1) {
      sheet.getRange(2, YARN_INVENTORY_CONFIG.IDX_LOTES.FECHA + 1, Math.max(1, sheet.getMaxRows() - 1), 1).setNumberFormat('dd/MM/yyyy');
      sheet.getRange(2, YARN_INVENTORY_CONFIG.IDX_LOTES.CREADO + 1, Math.max(1, sheet.getMaxRows() - 1), 2).setNumberFormat('yyyy-MM-dd HH:mm:ss');
    }
  } catch (e) {
    Logger.log('yarnInventoryEnsureTableSheet_ format: ' + e.message);
  }
  return sheet;
}

function yarnInventoryEnsureHeaderProtection_(sheet, headerRange) {
  var description = YARN_INVENTORY_CONFIG.UI.HEADER_PROTECTION;
  var a1 = headerRange.getA1Notation();
  var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  var exists = protections.some(function (p) {
    return p.getDescription() === description && p.getRange().getA1Notation() === a1;
  });
  if (exists) return;
  try {
    var protection = headerRange.protect();
    protection.setDescription(description);
    protection.setWarningOnly(false);
  } catch (e) {
    Logger.log('Unable to protect YarnInventory header: ' + e.message);
  }
}
