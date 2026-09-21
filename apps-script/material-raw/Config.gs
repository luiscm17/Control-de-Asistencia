/**
 * Config.gs — Frozen SSOT for the isolated Material Raw (Materia Prima) Apps Script project.
 *
 * Single source of truth for sheets, A1 ranges, DB headers (A:J 10 cols), PK indexes,
 * and UI/lock constants. Isolated V8 project — do not share globals with
 * attendance-control / yarn-production / yarn-settings / winding / dyeing.
 *
 * Data flow: Control Camiones D4 (Date) + B7:H37 (31 rows) → db_materialrow A:J (PK fecha, delete+append)
 *           → Registro Diario B10:B40 =SI.ERROR(SUMAR.SI(db_materialrow!$A$2:$A;FECHA(2026;9;$A10);$I$2:$I);0)
 * Fecha native pass-through (getValue) — America/La_Paz only for J timestamp.
 *
 * INSTALL: Extensions > Apps Script > paste this project > Save > Reload sheet
 * VERIFY:  Use a COPY of 13vr2cJSG3Bukpd1Gk71--gMIme0Fe0n2HP9-mrhVrw0 — never prod.
 */

var MATERIAL_RAW_CONFIG = Object.freeze({
  TIMEZONE: 'America/La_Paz',

  SHEETS: Object.freeze({
    FORM: 'Control Camiones',
    DATA: 'db_materialrow',
    ERRORS: 'Errors'
  }),

  RANGES: Object.freeze({
    DATE: 'D4',
    DATE_ROW: 4,
    DATE_COL: 4,
    CHECKBOX: 'F4',
    CHECKBOX_ROW: 4,
    CHECKBOX_COL: 6,
    LABEL: 'G4',
    FORM: 'B7:H37',
    CLEAR: 'B7:G37',
    FORM_ROW_START: 7,
    FORM_ROW_END: 37,
    FORM_COL_START: 2, // B
    FORM_COL_END: 8,   // H
    CLEAR_COL_START: 2, // B
    CLEAR_COL_END: 7   // G (H preserved)
  }),

  DB_HEADERS: Object.freeze([
    'fecha',
    'dia',
    'n_camion',
    'tipo_material',
    'n_partida',
    'n_bulto',
    'tipo_fardo',
    'cantidad',
    'total_kilos',
    'timestamp'
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
    FECHA: 0,
    DIA: 1,
    N_CAMION: 2,
    TIPO_MAT: 3,
    N_PARTIDA: 4,
    N_BULTO: 5,
    TIPO_FARDO: 6,
    CANTIDAD: 7,
    TOTAL_KILOS: 8,
    TIMESTAMP: 9
  }),

  LIMITS: Object.freeze({
    ROWS: 31,
    COLS: 10,
    ERROR_COLUMNS: 6
  }),

  UI: Object.freeze({
    DEBOUNCE_MS: 3000,
    DB_HEADER_COLOR: '#e8f0fe',
    ERRORS_HEADER_COLOR: '#fce8e6',
    HEADER_PROTECTION: 'Material Raw frozen header — do not reorder',
    SAVE_LABEL: String.fromCharCode(9745) + ' GUARDAR D' + String.fromCharCode(205) + 'A'
  }),

  VALIDATION: Object.freeze({
    DATE_FORMAT: 'dd/MM/yyyy',
    SAVE_TRIGGER_HANDLER: 'materialRawOnEdit'
  }),

  LOCK: Object.freeze({
    WAIT_MS: 5000,
    RETRIES: 1,
    SLEEP_MS: 1000
  }),

  ERRORS: Object.freeze({
    EMPTY_FECHA: 'empty_fecha',
    HEADER_MISMATCH: 'header_mismatch',
    LOCK_TIMEOUT: 'lock_timeout',
    MISSING_SHEET: 'missing_sheet'
  })
});

// --- Sheet access (no literal A1 outside Config helpers) ---

function materialRawGetFormSheet_(ss) {
  var spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet();
  return spreadsheet.getSheetByName(MATERIAL_RAW_CONFIG.SHEETS.FORM);
}

function materialRawGetDataSheet_(ss) {
  var spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet();
  return spreadsheet.getSheetByName(MATERIAL_RAW_CONFIG.SHEETS.DATA);
}

function materialRawGetErrorsSheet_(ss) {
  var spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet();
  return spreadsheet.getSheetByName(MATERIAL_RAW_CONFIG.SHEETS.ERRORS);
}

function materialRawRequireFormSheet_(ss) {
  var sheet = materialRawGetFormSheet_(ss);
  if (!sheet) throw new Error('Hoja "' + MATERIAL_RAW_CONFIG.SHEETS.FORM + '" no encontrada. Us' + String.fromCharCode(225) + ' una copia con la plantilla antes de configurar.');
  return sheet;
}

// --- A1 parsing (isolated, no shared global) ---

function materialRawParseA1_(a1) {
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

function materialRawParseRange_(a1Range) {
  var raw = String(a1Range).trim();
  var parts = raw.split(':');
  if (parts.length === 1) {
    var single = materialRawParseA1_(parts[0]);
    return { r1: single.row, c1: single.col, r2: single.row, c2: single.col };
  }
  var start = materialRawParseA1_(parts[0]);
  var end = materialRawParseA1_(parts[1]);
  return { r1: start.row, c1: start.col, r2: end.row, c2: end.col };
}

function materialRawGetRange_(sheet, a1Range) {
  var r = materialRawParseRange_(a1Range);
  return sheet.getRange(r.r1, r.c1, r.r2 - r.r1 + 1, r.c2 - r.c1 + 1);
}

// --- Fecha helpers: native Date passthrough only (no Utilities.formatDate for business date) ---

function materialRawFechaKey_(value) {
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

function materialRawIsSameFecha_(a, b) {
  var ka = materialRawFechaKey_(a);
  var kb = materialRawFechaKey_(b);
  return !!ka && ka === kb;
}

function materialRawHeadersMatch_(actual, expected) {
  if (!actual || actual.length !== expected.length) return false;
  for (var i = 0; i < expected.length; i++) {
    if (String(actual[i] || '').trim() !== expected[i]) return false;
  }
  return true;
}
