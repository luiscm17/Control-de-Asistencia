/**
 * Config.gs — Yarn Production (isolated V8 module)
 *
 * Defines the separate bound-project constants for the reusable
 * produccion form and its datos_produccion database table.
 * Do NOT share globals with the attendance project (apps-script/*.gs).
 *
 * INSTALL: Extensions > Apps Script > paste this project > Save > Reload sheet
 * VERIFY:  Use a COPY of the live spreadsheet — never prod.
 */

// --- YARN PRODUCTION CONFIGURATION ---
const YARN_CONFIG = {
  // Sheets
  FORM_SHEET: 'produccion',
  DATA_SHEET: 'datos_produccion',

  // Form geometry (1-indexed for getRange)
  DATE_CELL_A1: 'G2',
  DATE_ROW: 2,
  DATE_COL: 7, // G

  // Native mobile save control. Keep the existing drawing untouched.
  MOBILE_SAVE_CELL_A1: 'M4',
  MOBILE_SAVE_LABEL_CELL_A1: 'N4',
  MOBILE_SAVE_ROW: 4,
  MOBILE_SAVE_COL: 13, // M
  MOBILE_SAVE_MIN_ROW_HEIGHT_PX: 24,
  MOBILE_SAVE_TRIGGER_HANDLER: 'yarnMobileOnEdit',
  MOBILE_SAVE_DEBOUNCE_MS: 3000,

  // C6:L8 includes fixed TURNO (C) + 9 process columns (D:L)
  SHIFT_COL: 3, // C
  PROCESS_COL_START: 4, // D
  PROCESS_COL_END: 12, // L
  FORM_ROW_START: 6,
  FORM_ROW_END: 8,

  // Convenience A1s
  FORM_RANGE_C6_L8: 'C6:L8',
  PROCESS_RANGE_D6_L8: 'D6:L8',
  SHIFT_RANGE_C6_C8: 'C6:C8',
  TOTAL_RANGE_C9_L9: 'C9:L9',
  TOTAL_LABEL_C9: 'C9',
  TOTAL_LABEL_C10: 'C10',
  TOTAL_PRODUCTO_CELL_J10: 'J10',

  // Totals (native SUM, preserved — never persisted)
  TOTAL_ROW: 9,
  TOTAL_PRODUCTO_ROW: 10,

  // Database schema A:Q (fixed order — PRD §6.1)
  HEADER: [
    'id',
    'fecha',
    'turno',
    'finisor',
    'retorcido',
    'madejeras',
    'tintoreria',
    'secado',
    'devanado',
    'embolsado',
    'ovillado',
    'madejitas',
    'total_producto_terminado',
    'registrado_por',
    'editado_por',
    'creado',
    'actualizado'
  ],

  // Process columns D:L correspond 1:1 to these fields
  PROCESS_FIELDS: [
    'finisor',
    'retorcido',
    'madejeras',
    'tintoreria',
    'secado',
    'devanado',
    'embolsado',
    'ovillado',
    'madejitas'
  ],

  // Fixed shifts — C6:C8 literal values, single source of truth
  SHIFTS: ['DIA', 'TARDE', 'NOCHE'],

  // Timezone — America/La_Paz (UTC-4, no DST) everywhere
  TIMEZONE: 'America/La_Paz',

  // Header index shortcuts (0-based for array access)
  IDX: {
    ID: 0,
    FECHA: 1,
    TURNO: 2,
    FINISOR: 3,
    RETORCIDO: 4,
    MADEJERAS: 5,
    TINTORERIA: 6,
    SECADO: 7,
    DEVANADO: 8,
    EMBOLSADO: 9,
    OVILLADO: 10,
    MADEJITAS: 11,
    TOTAL: 12,
    REGISTRADO_POR: 13,
    EDITADO_POR: 14,
    CREADO: 15,
    ACTUALIZADO: 16
  }
};

// --- YARN DASHBOARD CONFIGURATION ---
const DASHBOARD_SHEET = 'dashboard';
const DASHBOARD_AUX_RANGE = 'A10:C200';
const DASHBOARD_AUX_MAX_ROWS = 200;
const DASHBOARD_CARD_RANGE = {
  finisor: 'D',
  retorcido: 'E',
  madejeras: 'F',
  tintoreria: 'G',
  secado: 'H',
  devanado: 'I',
  embolsado: 'J',
  ovillado: 'K',
  madejitas: 'L',
  total_producto_terminado: 'M'
};
const DASHBOARD_CHART_ANCHORS = { SECTION: 'G1', CUMULATIVE: 'G18', SHIFT: 'G35' };
const DASHBOARD_FORMAT = '#,##0.00';
const DASHBOARD_FILTER_RANGES = { SHIFT: 'B1', FOCUS: 'D1', PERIOD: 'F1' };
const DASHBOARD_PERIOD_OPTIONS = ['Mes actual', 'Últimos 7 días', 'Histórico'];
