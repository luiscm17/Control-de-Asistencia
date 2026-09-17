/**
 * Config.gs — Frozen SSOT for the isolated Dyeing (Teñido) Apps Script project.
 *
 * Single source of truth for sheets, A1 ranges, headers (A:AF 32 cols),
 * PK indexes, typed capture map, limits and UI debouncing.
 * No literal `getRange("A1")` outside this file — use helpers below.
 * Typed: H/S:V NUMBER (T(ºC), Titulo 1/2, Torsión 1/2), rest STRING (@ verbatim, fechas passthrough).
 * Audit (AB:AF) in America/La_Paz only.
 * Layout A:AF (32 physical cols):
 *   A Nº Lote (PK C3)
 *   B Color (E6)  C Código (E7)  D tipo colorante (E8)  E Titulo m/g (E12 STRING @)
 *   F Material (E9)  G Linea (E10)  H T(ºC) (E11 NUMBER)  I Tina (E13)  J Nº Ingreso (E14)
 *   K Cliente (E15)  L Fecha Teñido (C6)  M Sup. Teñido (C8)  N Turno Teñido (C7)
 *   O Secado 1 (E18)  P Secado 2 (E19)  Q Revisión (E20)  R Fecha Muestreo (C18)
 *   S Titulo 1 (E21 NUMBER)  T Titulo 2 (E22 NUMBER)  U Torsión 1 (E23 NUMBER)  V Torsión 2 (E24 NUMBER)
 *   W C.C. Muestra (C21)  X Turno Muestra (C19)  Y Sup. Muestra (C20 NEW)  Z C.C. Teñido (C9 NEW)
 *   AA Observación (E25)
 *   AB creado  AC actualizado  AD editado_por  AE estado  AF rango_origen
 * New cols Y/Z (Sup. Muestra / C.C. Teñido) inserted before Observación to preserve audit at AB:AF.
 *
 * INSTALL: Extensions > Apps Script > paste this project > Save > Reload sheet
 * VERIFY:  Use a COPY of the live spreadsheet — never prod.
 */

var DYEING_CONFIG = Object.freeze({
  TIMEZONE: 'America/La_Paz',
  SHEETS: Object.freeze({
    TENIDOS: 'tenidos',
    DB: 'db_tenidos',
    ITEMS: 'items',
    ERRORS: 'Errors'
  }),
  RANGES: Object.freeze({
    PK: 'C3',
    PK_ROW: 3,
    PK_COL: 3,
    CHECKBOX: 'G4',
    CHECKBOX_ROW: 4,
    CHECKBOX_COL: 7,
    LABEL: 'H4',
    TENIDO: 'B6:E15',
    MUESTRA: 'B18:E25',
    DB_HEADERS: 'A1:AF1',
    ERRORS_HEADERS: 'A1:F1'
  }),
  DB_HEADERS: Object.freeze([
    'Nº Lote',
    'Color',
    'Código',
    'tipo colorante',
    'Titulo m/g',
    'Material',
    'Linea',
    'T(ºC)',
    'Tina',
    'Nº Ingreso',
    'Cliente',
    'Fecha Teñido',
    'Sup. Teñido',
    'Turno Teñido',
    'Secado 1',
    'Secado 2',
    'Revisión',
    'Fecha Muestreo',
    'Titulo 1',
    'Titulo 2',
    'Torsión 1',
    'Torsión 2',
    'C.C. Muestra',
    'Turno Muestra',
    'Sup. Muestra',
    'C.C. Teñido',
    'Observación',
    'creado',
    'actualizado',
    'editado_por',
    'estado',
    'rango_origen'
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
    LOTE: 0,
    COLOR: 1,
    CODIGO: 2,
    TIPO_COLORANTE: 3,
    TITULO_MG: 4,
    MATERIAL: 5,
    LINEA: 6,
    TEMP: 7,
    TINA: 8,
    NRO_INGRESO: 9,
    CLIENTE: 10,
    FECHA_TENIDO: 11,
    SUP: 12,
    SUP_TENIDO: 12,
    TURNO: 13,
    TURNO_TENIDO: 13,
    SECADO1: 14,
    SECADO2: 15,
    REVISION: 16,
    FECHA_MUESTREO: 17,
    TITULO1: 18,
    TITULO2: 19,
    TORSION1: 20,
    TORSION2: 21,
    CC: 22,
    CC_MUESTRA: 22,
    TURNO_M: 23,
    TURNO_MUESTRA: 23,
    SUP_MUESTRA: 24,
    Y_SUP_MUESTRA: 24,
    CC_TENIDO: 25,
    Z_CC_TENIDO: 25,
    OBS: 26,
    OBSERVACION: 26,
    CREADO: 27,
    ACTUALIZADO: 28,
    EDITADO_POR: 29,
    ESTADO: 30,
    RANGO_ORIGEN: 31
  }),
  // Columns that must be stored as NUMBER (native 0.00/General): H, S:V
  NUMBER_COLS: Object.freeze([7, 18, 19, 20, 21]),
  LIMITS: Object.freeze({
    COLS: 32,
    ERROR_COLUMNS: 6
  }),
  UI: Object.freeze({
    DEBOUNCE_MS: 3000,
    HEADER_PROTECTION: 'Dyeing frozen header — do not reorder',
    DB_HEADER_COLOR: '#e8f0fe',
    ERRORS_HEADER_COLOR: '#fce8e6',
    SAVE_LABEL: '☑ GUARDAR'
  }),
  ERRORS: Object.freeze({
    EMPTY_LOTE: 'empty_lote',
    LOCK_TIMEOUT: 'lock_timeout',
    VALIDATION_FAILED: 'validation_failed',
    MISSING_SHEET: 'missing_sheet',
    HEADER_MISMATCH: 'header_mismatch'
  })
});

// --- Sheet access (no literal A1 outside Config) ---

function dyeingGetSheet_(ss, key) {
  var spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet();
  var name = DYEING_CONFIG.SHEETS[key];
  if (!name) throw new Error('Unknown sheet key: ' + key);
  return spreadsheet.getSheetByName(name);
}

function dyeingRequireSheet_(ss, key) {
  var sheet = dyeingGetSheet_(ss, key);
  if (!sheet) throw new Error('Required sheet is missing: ' + DYEING_CONFIG.SHEETS[key]);
  return sheet;
}

// --- A1 parsing ---

function dyeingParseA1_(a1) {
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

function dyeingParseRange_(a1Range) {
  var raw = String(a1Range).trim();
  var parts = raw.split(':');
  if (parts.length === 1) {
    var single = dyeingParseA1_(parts[0]);
    return { r1: single.row, c1: single.col, r2: single.row, c2: single.col };
  }
  var start = dyeingParseA1_(parts[0]);
  var end = dyeingParseA1_(parts[1]);
  return { r1: start.row, c1: start.col, r2: end.row, c2: end.col };
}

function dyeingGetRange_(sheet, a1Range) {
  var r = dyeingParseRange_(a1Range);
  return sheet.getRange(r.r1, r.c1, r.r2 - r.r1 + 1, r.c2 - r.c1 + 1);
}

// --- Date helpers: passthrough only, audit alone uses La_Paz ---

function dyeingDateKey_(value) {
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

function dyeingHeadersMatch_(actual, expected) {
  if (!actual || actual.length !== expected.length) return false;
  for (var i = 0; i < expected.length; i++) {
    if (String(actual[i] || '').trim() !== expected[i]) return false;
  }
  return true;
}

// --- Schema: ensure db_tenidos A:AF + Errors A:F + G4 checkbox ---

function dyeingEnsureSchema(optSpreadsheet) {
  var ss = optSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  dyeingEnsureTableSheet_(ss, 'DB', DYEING_CONFIG.DB_HEADERS, DYEING_CONFIG.UI.DB_HEADER_COLOR);
  dyeingEnsureTableSheet_(ss, 'ERRORS', DYEING_CONFIG.ERRORS_HEADERS, DYEING_CONFIG.UI.ERRORS_HEADER_COLOR);
  dyeingConfigureForm_(ss);
  SpreadsheetApp.flush();
}

function dyeingEnsureTableSheet_(ss, sheetKey, headers, headerColor) {
  var sheetName = DYEING_CONFIG.SHEETS[sheetKey];
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  var width = headers.length;
  var headerRange = sheet.getRange(1, 1, 1, width);
  var current = headerRange.getValues()[0];
  if (!dyeingHeadersMatch_(current, headers)) {
    headerRange.setValues([headers]);
  }
  headerRange.setFontWeight('bold').setBackground(headerColor);
  sheet.setFrozenRows(1);
  try { sheet.autoResizeColumns(1, width); } catch (e) {}
  dyeingEnsureHeaderProtection_(sheet, headerRange);
  // Number formats for DB columns
  try {
    if (sheetKey === 'DB' && sheet.getMaxRows() > 1) {
      // H, S:V as NUMBER 0.00; dates/string passthrough
      var rows = Math.max(1, sheet.getMaxRows() - 1);
      // H = col 8, S=19, T=20, U=21, V=22 (unchanged; audit shifted to AB:AC)
      sheet.getRange(2, 8, rows, 1).setNumberFormat('0.00');
      sheet.getRange(2, 19, rows, 4).setNumberFormat('0.00');
      // E Titulo m/g must stay @ to preserve "@ 24/1"
      sheet.getRange(2, 5, rows, 1).setNumberFormat('@');
      // Audit timestamps La_Paz — AB:AC (cols 28-29, was Z:AA 26-27)
      sheet.getRange(2, DYEING_CONFIG.IDX.CREADO + 1, rows, 2).setNumberFormat('yyyy-MM-dd HH:mm:ss');
    }
  } catch (e) {
    Logger.log('dyeingEnsureTableSheet_ format: ' + e.message);
  }
  return sheet;
}

function dyeingEnsureHeaderProtection_(sheet, headerRange) {
  var description = DYEING_CONFIG.UI.HEADER_PROTECTION;
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
    Logger.log('Unable to protect Dyeing header: ' + e.message);
  }
}

function dyeingConfigureForm_(ss) {
  var spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet();
  try {
    var tenidos = dyeingGetSheet_(spreadsheet, 'TENIDOS');
    if (!tenidos) return;
    var label = dyeingGetRange_(tenidos, DYEING_CONFIG.RANGES.LABEL);
    var checkbox = dyeingGetRange_(tenidos, DYEING_CONFIG.RANGES.CHECKBOX);
    var rule = SpreadsheetApp.newDataValidation().requireCheckbox().setAllowInvalid(false).setHelpText('Marcar para guardar lote.').build();
    checkbox.setDataValidation(rule);
    try {
      var cur = checkbox.getValue();
      if (cur !== false) checkbox.setValue(false);
    } catch (e1) {
      try { checkbox.setValue(false); } catch (ignore) {}
    }
    if (String(label.getDisplayValue() || '').trim() === '') label.setValue(DYEING_CONFIG.UI.SAVE_LABEL);
    label.setFontWeight('bold').setFontSize(10).setVerticalAlignment('middle').setFontColor('#174ea6');
    checkbox.setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground('#e8f0fe').setBorder(true, true, true, true, true, true, '#1a73e8', SpreadsheetApp.BorderStyle.SOLID);
  } catch (e) {
    Logger.log('dyeingConfigureForm_: ' + e.message);
  }
}
