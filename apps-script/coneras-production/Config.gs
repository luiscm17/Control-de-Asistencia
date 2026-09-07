/**
 * Config.gs — Frozen configuration for the isolated Coneras Apps Script project.
 */

const CONERAS_CONFIG = Object.freeze({
  TIMEZONE: 'America/La_Paz',
  SHEETS: Object.freeze({
    CONERA: 'conera',
    DASHBOARD: 'dashboard',
    DB: 'db_coneras',
    ERRORS: 'Errors'
  }),
  RANGES: Object.freeze({
    BANNER: 'A1:H2',
    META_MANUAL: 'C4',
    META_REAL: 'E4',
    TURNO: 'G4',
    MAQUINA: 'C5',
    FECHA: 'E5',
    SUPERVISOR: 'G5',
    FORM_INPUTS: 'B8:G22',
    DESCARGA_NUMBERS: 'A8:A22',
    NET_WEIGHT_FIRST: 'H8',
    NET_WEIGHT_FORMULAS: 'H8:H22',
    TOTAL_NET_WEIGHT: 'H23',
    SAVE_CHECKBOX: 'I8',
    SAVE_LABEL: 'J8',
    DB_HEADERS: 'A1:P1',
    ERRORS_HEADERS: 'A1:F1',
    DASHBOARD_EFFICIENCY: 'B7'
  }),
  LIMITS: Object.freeze({
    DESCARGAS: 15,
    DB_COLUMNS: 16,
    ERROR_COLUMNS: 6
  }),
  TURNO_VALUES: Object.freeze(['Dia', 'Tarde', 'Noche']),
  MAQUINA_VALUES: Object.freeze([
    'Autoconer 1', 'Autoconer 2', 'Autoconer 3', 'Conera 3', 'Conera 4'
  ]),
  DB_HEADERS: Object.freeze([
    'id', 'fecha', 'turno', 'maquina', 'descarga_nro', 'titulo', 'operador',
    'peso_bruto', 'usos', 'peso_canilla', 'peso_tacho', 'peso_neto',
    'supervisor', 'creado', 'actualizado', 'editado_por'
  ]),
  ERRORS_HEADERS: Object.freeze([
    'timestamp', 'scope', 'range', 'code', 'reason', 'user'
  ]),
  ERRORS: Object.freeze({
    INVALID_FECHA: 'invalid_fecha',
    INVALID_TURNO: 'invalid_turno',
    INVALID_MAQUINA: 'invalid_maquina',
    EMPTY_FORM: 'empty_form',
    LOCK_TIMEOUT: 'lock_timeout',
    SETUP_INVALID_FORMULA: 'setup_invalid_formula'
  }),
  FORMULAS: Object.freeze({
    NET_WEIGHT_FIRST: '=SI(ESNUMERO(D8),MAX(0,D8-(E8*F8)-G8),"")',
    TOTAL_NET_WEIGHT: '=SUMA(H8:H22)',
    META_REAL: '=SI(ESNUMERO(C4),C4*dashboard!B7,"")'
  }),
  UI: Object.freeze({
    SAVE_LABEL: '☑ GUARDAR TURNO',
    DB_HEADER_COLOR: '#e8f0fe',
    ERRORS_HEADER_COLOR: '#fce8e6',
    HEADER_PROTECTION: 'Coneras frozen header — do not reorder'
  })
});

function conerasGetSheet_(spreadsheet, key) {
  const ss = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(CONERAS_CONFIG.SHEETS[key]);
}

function conerasRequireSheet_(spreadsheet, key) {
  const sheet = conerasGetSheet_(spreadsheet, key);
  if (!sheet) throw new Error('Required sheet is missing: ' + CONERAS_CONFIG.SHEETS[key]);
  return sheet;
}

function conerasNormalizeFecha_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, CONERAS_CONFIG.TIMEZONE, 'yyyy-MM-dd');
  }

  const match = String(value || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return '';
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

function conerasBuildId_(fecha, turno, maquina, descargaNro) {
  const number = Number(descargaNro);
  if (!fecha || !turno || !maquina || !Number.isInteger(number) || number < 1 ||
      number > CONERAS_CONFIG.LIMITS.DESCARGAS) return '';
  const machineId = String(maquina).trim().toUpperCase().replace(/\s+/g, '_');
  return [fecha, String(turno).trim().toUpperCase(), machineId,
    String(number).padStart(2, '0')].join('-');
}

function conerasHeadersMatch_(actual, expected) {
  return actual.length === expected.length && actual.every(function (value, index) {
    return value === expected[index];
  });
}

function conerasFormulaCells_() {
  return Object.freeze([
    Object.freeze({ range: CONERAS_CONFIG.RANGES.META_REAL, formula: CONERAS_CONFIG.FORMULAS.META_REAL }),
    Object.freeze({ range: CONERAS_CONFIG.RANGES.TOTAL_NET_WEIGHT, formula: CONERAS_CONFIG.FORMULAS.TOTAL_NET_WEIGHT }),
    Object.freeze({ range: CONERAS_CONFIG.RANGES.NET_WEIGHT_FIRST, formula: CONERAS_CONFIG.FORMULAS.NET_WEIGHT_FIRST })
  ]);
}
