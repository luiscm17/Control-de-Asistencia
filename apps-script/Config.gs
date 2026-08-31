/**
 * Config.gs — Split from Code.gs (original ~1047 lines, 40 functions)
 * Role: Central CONFIG + HEADER + ERRORS_HEADER + TIMEZONE.
 * Original: Control de Asistencia — Registro Centralization.
 * Notes: Apps Script concatenates all .gs files; order does not matter. Do not change logic.
 * Attendance sheets = any non-ignorable sheet except Apoyo (detected via structure).
 * Config!A:B optional alias (sheetId or name -> logical display name).
 * Apoyo is fixed.
 */

/**
 * Control de Asistencia — Registro Centralization (PR 3 Governance+Menu+Backfill)
 *
 * Centralizes 6 section sheets + Apoyo into Registro (A:M) via installable onEdit.
 * PR 1: scaffold + Registro/Config/Errors headers. PR 2: E15:AI44 upsert/void/bulk + Hoja2/S7:U7 guard + window/permission gate + LockService. PR 3: Apoyo A3:E3 is_apoyo, 6-item menu, dual trigger, via_manual bypass, backfill idempotent, Errors+toasts.
 *
 * INSTALL: Extensions > Apps Script > paste Code.gs + appsscript.json > Save > Reload sheet
 * VERIFY:  Use a COPY of 1iw9bduLeGXQMbjmMV1qrMqE2WoPWCBz3 — never prod.
 */

// --- CONFIGURATION ---
const CONFIG = {
  INPUT: 'E15:AI44',
  INPUT_ROW_START: 15,
  INPUT_ROW_END: 44,
  INPUT_COL_START: 5, // E
  INPUT_COL_END: 35,  // AI
  CALENDAR: ['S7:U7', 'S9:U9'],
  APOYO_SHEET: 'Apoyo',
  APOYO_RANGE: 'Apoyo!A3:E3',
  APOYO_A3_ROW: 3,
  APOYO_A3_COL_START: 1, // A
  APOYO_A3_COL_END: 5,   // E
  REGISTRO: 'Registro',
  CONFIG_SHEET: 'Config',
  ERRORS: 'Errors',
  CODES: ['A', 'AT', 'BM', 'F'],
  LABELS: { A: 'Asistencia', AT: 'Tardanza', BM: 'Baja Médica', F: 'Falta' },
  HEADER: [
    'record_id', 'created_at', 'updated_at', 'section', 'operator_name',
    'date', 'code', 'code_label', 'is_apoyo', 'edited_by', 'source_range', 'nota', 'status'
  ],
  ERRORS_HEADER: ['timestamp', 'section', 'range', 'code', 'reason', 'user'],
  CONFIG_HEADER: ['key', 'value'],
  TIMEZONE: 'America/La_Paz',
  LOGICAL_SECTIONS: ['Preparacion', 'Continua', 'Acoplado', 'Retorcedoras', 'Madejeras', 'Producto Terminado']
};
