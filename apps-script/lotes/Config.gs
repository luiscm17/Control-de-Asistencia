/**
 * Config.gs — Frozen SSOT for the isolated Lotes Apps Script project.
 *
 * Change: lotes — Daily Lot Tracking (lotes-form → db_lots)
 * Source: docs/lotes/PRD.md v0.1.0, openspec/changes/lotes/specs/lotes-lot-recording/spec.md
 * Isolation: apps-script/lotes/ only — no imports from sibling apps-script/* projects.
 * Built-ins only: SpreadsheetApp, LockService, Session, Utilities, PropertiesService, ScriptApp
 * Timezone: America/La_Paz (UTC-4, no DST) for all audit timestamps.
 *
 * Sheet: lotes-form (gid 1098679039) — D4 DATE dd/MM/yyyy passthrough, F4 checkbox FALSE→TRUE,
 *        B7:H7 headers, B8:H37 30 rows (C8:H37 payload 6 cols, B8:B37 visual 1..30 not persisted).
 * DB: db_lots A:L — PK id = yyyy-MM-dd-posicion (posicion 1 maps B8, 30 maps B37).
 *
 * No literal getRange("D4") outside this file — use lotesGetRange_ helpers.
 *
 * INSTALL: Extensions > Apps Script > paste this project > Save > Reload sheet
 * VERIFY: Use a COPY of 19lBJHHKsusI6Eqkni-zh8us6ePoEHscEgrIPrFK-zhE — never prod.
 */

var LOTES_CONFIG = Object.freeze({
  TIMEZONE: 'America/La_Paz',
  SHEETS: Object.freeze({
    FORM: 'lotes-form',
    DB: 'db_lots',
    ERRORS: 'Errors'
  }),
  RANGES: Object.freeze({
    D4: 'D4',
    F4: 'F4',
    HEADERS: 'B7:H7',
    FORM: 'B8:H37',
    PAYLOAD: 'C8:H37',
    DB_HEADERS: 'A1:L1',
    ERRORS_HEADERS: 'A1:F1'
  }),
  DB_HEADERS: Object.freeze([
    'id',
    'fecha',
    'titulo',
    'tipo_material',
    'linea_presentacion',
    'codigo_lote',
    'color',
    'observacion',
    'creado',
    'actualizado',
    'creado_por',
    'actualizado_por'
  ]),
  ERRORS_HEADERS: Object.freeze([
    'timestamp',
    'scope',
    'range',
    'code',
    'reason',
    'user'
  ]),
  IDX: Object.freeze({
    ID: 0,
    FECHA: 1,
    TITULO: 2,
    TIPO_MATERIAL: 3,
    LINEA_PRESENTACION: 4,
    CODIGO_LOTE: 5,
    COLOR: 6,
    OBSERVACION: 7,
    CREADO: 8,
    ACTUALIZADO: 9,
    CREADO_POR: 10,
    ACTUALIZADO_POR: 11
  }),
  LIMITS: Object.freeze({
    ROWS: 30,
    COLS: 12,
    ERROR_COLUMNS: 6
  }),
  UI: Object.freeze({
    DEBOUNCE_MS: 3000,
    SAVE_LABEL: '\u2611 GUARDAR',
    DB_HEADER_COLOR: '#e8f0fe',
    ERRORS_HEADER_COLOR: '#fce8e6',
    HEADER_PROTECTION: 'Lotes frozen header \u2014 do not reorder'
  }),
  ERRORS: Object.freeze({
    EMPTY_DATE: 'empty_date',
    LOCK_TIMEOUT: 'lock_timeout',
    MISSING_SHEET: 'missing_sheet',
    HEADER_MISMATCH: 'header_mismatch'
  })
});

// --- Sheet access (no literal A1 outside Config) ---

function lotesGetSheet_(ss, key) {
  var spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet();
  var name = LOTES_CONFIG.SHEETS[key];
  if (!name) throw new Error('Unknown sheet key: ' + key);
  return spreadsheet.getSheetByName(name);
}

function lotesGetFormSheet_(ss) {
  return lotesGetSheet_(ss, 'FORM');
}

function lotesGetDbSheet_(ss) {
  return lotesGetSheet_(ss, 'DB');
}

// --- A1 parsing ---

function lotesParseA1_(a1) {
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

function lotesParseRange_(a1Range) {
  var raw = String(a1Range).trim();
  var parts = raw.split(':');
  if (parts.length === 1) {
    var single = lotesParseA1_(parts[0]);
    return { r1: single.row, c1: single.col, r2: single.row, c2: single.col };
  }
  var start = lotesParseA1_(parts[0]);
  var end = lotesParseA1_(parts[1]);
  return { r1: start.row, c1: start.col, r2: end.row, c2: end.col };
}

function lotesGetRange_(sheet, a1Range) {
  var r = lotesParseRange_(a1Range);
  return sheet.getRange(r.r1, r.c1, r.r2 - r.r1 + 1, r.c2 - r.c1 + 1);
}

// --- Date helpers: D4 passthrough — audit only uses America/La_Paz ---

function lotesDateKey_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    try {
      return Utilities.formatDate(value, LOTES_CONFIG.TIMEZONE, 'yyyy-MM-dd');
    } catch (e) {
      var y = value.getFullYear();
      var m = value.getMonth() + 1;
      var d = value.getDate();
      return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    }
  }
  return '';
}

function lotesFechaDisplay_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    try {
      return Utilities.formatDate(value, LOTES_CONFIG.TIMEZONE, 'dd/MM/yyyy');
    } catch (e) {
      var y2 = value.getFullYear();
      var m2 = value.getMonth() + 1;
      var d2 = value.getDate();
      return String(d2).padStart(2, '0') + '/' + String(m2).padStart(2, '0') + '/' + y2;
    }
  }
  return '';
}

function lotesHeadersMatch_(actual, expected) {
  if (!actual || actual.length !== expected.length) return false;
  for (var i = 0; i < expected.length; i++) {
    if (String(actual[i] || '').trim() !== expected[i]) return false;
  }
  return true;
}

// --- Schema: ensure db_lots A:L + Errors A:F + F4 checkbox ---

function lotesEnsureSchema(optSpreadsheet) {
  var ss = optSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  lotesEnsureTableSheet_(ss, 'DB', LOTES_CONFIG.DB_HEADERS, LOTES_CONFIG.UI.DB_HEADER_COLOR);
  lotesEnsureTableSheet_(ss, 'ERRORS', LOTES_CONFIG.ERRORS_HEADERS, LOTES_CONFIG.UI.ERRORS_HEADER_COLOR);
  lotesConfigureForm_(ss);
  SpreadsheetApp.flush();
}

function lotesEnsureTableSheet_(ss, sheetKey, headers, headerColor) {
  var sheetName = LOTES_CONFIG.SHEETS[sheetKey];
  var sheet = ss.getSheetByName(sheetName);
  var isNew = false;
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    isNew = true;
  }
  var width = headers.length;
  var headerRange = sheet.getRange(1, 1, 1, width);
  var current = headerRange.getValues()[0];
  var isBlank = true;
  for (var b = 0; b < width; b++) {
    if (String(current[b] || '').trim() !== '') { isBlank = false; break; }
  }
  if (isBlank || isNew) {
    // Fresh sheet — create frozen header row (only case where we write headers)
    headerRange.setValues([headers]);
  } else if (!lotesHeadersMatch_(current, headers)) {
    // Existing sheet with mismatched header — warn only, do NOT auto-reorder (migration guard)
    try {
      lotesLogError_(LOTES_CONFIG.ERRORS.HEADER_MISMATCH,
        'Header mismatch in ' + sheetName + ': expected ' + headers.join('|') + ' got ' + current.join('|'),
        'A1:' + String.fromCharCode(64 + width) + '1', ss);
    } catch (ignore) {}
    try { Logger.log('lotes header mismatch warn-only: ' + sheetName); } catch (ignore2) {}
  }
  headerRange.setFontWeight('bold').setBackground(headerColor);
  sheet.setFrozenRows(1);
  try { sheet.autoResizeColumns(1, width); } catch (e) {}
  lotesEnsureHeaderProtection_(sheet, headerRange);
  try {
    if (sheetKey === 'DB' && sheet.getMaxRows() > 1) {
      var rows = Math.max(1, sheet.getMaxRows() - 1);
      // B fecha dd/MM/yyyy (col 2), I:J timestamps yyyy-MM-dd HH:mm:ss (cols 9-10)
      sheet.getRange(2, 2, rows, 1).setNumberFormat('dd/MM/yyyy');
      sheet.getRange(2, LOTES_CONFIG.IDX.CREADO + 1, rows, 2).setNumberFormat('yyyy-MM-dd HH:mm:ss');
    }
  } catch (e) {
    Logger.log('lotesEnsureTableSheet_ format: ' + e.message);
  }
  return sheet;
}

function lotesEnsureHeaderProtection_(sheet, headerRange) {
  var description = LOTES_CONFIG.UI.HEADER_PROTECTION;
  var a1 = headerRange.getA1Notation();
  var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  var exists = protections.some(function (p) {
    return p.getDescription() === description && p.getRange().getA1Notation() === a1;
  });
  if (exists) return;
  try {
    var protection = headerRange.protect();
    protection.setDescription(description);
    protection.setWarningOnly(true);
  } catch (e) {
    Logger.log('Unable to protect Lotes header: ' + e.message);
  }
}

function lotesConfigureForm_(ss) {
  var spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet();
  try {
    var form = lotesGetFormSheet_(spreadsheet);
    if (!form) return;
    var checkbox = lotesGetRange_(form, LOTES_CONFIG.RANGES.F4);
    var rule = SpreadsheetApp.newDataValidation().requireCheckbox().setAllowInvalid(false).build();
    checkbox.setDataValidation(rule);
    try {
      var cur = checkbox.getValue();
      if (cur !== false) checkbox.setValue(false);
    } catch (e1) {
      try { checkbox.setValue(false); } catch (ignore) {}
    }
    checkbox.setHorizontalAlignment('center').setVerticalAlignment('middle');
  } catch (e) {
    Logger.log('lotesConfigureForm_: ' + e.message);
  }
}
