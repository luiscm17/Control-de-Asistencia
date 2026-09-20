/**
 * Config.gs — Winding shift persistence configuration.
 *
 * This is an isolated Apps Script V8 project for ctrl_embolsado. Do not share
 * globals with the sibling Apps Script projects.
 */

const WINDING_CONFIG = Object.freeze({
  TIMEZONE: 'America/La_Paz',

  SHEETS: Object.freeze({
    FORM: 'ctrl_embolsado',
    DATA: 'db_embolsado',
    ERRORS: 'Errors'
  }),

  FORM: Object.freeze({
    DATE: 'H4',
    TURNO: 'J4',
    SUPERVISOR: 'L4',
    SAVE_CHECKBOX: 'M4',
    SAVE_LABEL: 'N4',
    ITEM_RANGE: 'A12:A23',
    DATA_RANGE: 'A12:T23',
    PERSISTED_ZONE: 'B12:T23',
    INPUT_LEFT: 'B12:D23',
    META: 'E12:E23',
    INPUT_RIGHT: 'F12:T23',
    PROTECTED_ROWS: Object.freeze([10, 11, 29]),
    FIRST_ITEM_ROW: 12,
    LAST_ITEM_ROW: 23,
    FIRST_OPERATOR_COLUMN: 6,
    LAST_OPERATOR_COLUMN: 20
  }),

  DB_HEADERS: Object.freeze([
    'id', 'fecha', 'turno', 'item', 'supervisor', 'color', 'lote', 'titulo',
    'meta_kg', 'op_01', 'op_02', 'op_03', 'op_04', 'op_05', 'op_06',
    'op_07', 'op_08', 'op_09', 'op_10', 'op_11', 'op_12', 'op_13',
    'op_14', 'op_15', 'actualizado', 'editado_por'
  ]),

  ERRORS_HEADERS: Object.freeze([
    'timestamp', 'contexto', 'detalle', 'editado_por'
  ]),

  IDX: Object.freeze({
    ID: 0,
    FECHA: 1,
    TURNO: 2,
    ITEM: 3,
    SUPERVISOR: 4,
    COLOR: 5,
    LOTE: 6,
    TITULO: 7,
    META_KG: 8,
    OP_01: 9,
    OP_15: 23,
    ACTUALIZADO: 24,
    EDITADO_POR: 25
  }),

  VALIDATION: Object.freeze({
    DATE_FORMAT: 'dd/MM/yyyy',
    NUMBER_FORMAT: '0.00',
    HEADER_PROTECTION_DESCRIPTION: 'Winding frozen header — do not reorder',
    FORM_PROTECTION_DESCRIPTION: 'Winding formula and label protection',
    SAVE_TRIGGER_HANDLER: 'windingOnEdit'
  }),

  UI: Object.freeze({
    DEBOUNCE_MS: 3000,
    SAVE_LABEL: '☑ GUARDAR TURNO',
    DB_HEADER_COLOR: '#e8f0fe',
    ERRORS_HEADER_COLOR: '#fce8e6'
  }),

  LOCK: Object.freeze({
    WAIT_MS: 5000,
    RETRIES: 1
  })
});
