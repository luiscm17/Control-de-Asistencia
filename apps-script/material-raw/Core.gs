/**
 * Core.gs — Explicit save + rehydration for the isolated Material Raw (Materia Prima) project.
 *
 * Guard path: materialRawGuardarDia() triggered by F4 FALSE→TRUE (installable onEdit) + menu
 *   Materia Prima → Guardar d\u00EDa. Batch-reads D4 native Date via getValue() (no formatDate),
 *   aborts with toast 8s `Seleccione una fecha v\u00E1lida en D4.` if empty, filters B7:H37
 *   rows where F (tipo_fardo, index 4 within B:H) <> "", builds A:J rows with native fecha
 *   passthrough, validates header fail-closed, then locked delete+append by fecha (PK fecha
 *   idempotent). Lock 5s+1 retry toast \u23F3 ocupado 8s. Finally reset F4=FALSE + flush + toast 8s.
 *
 * Rehydrate: materialRawHydrate_(ss, fecha) under lock, filters db_materialrow A==fecha,
 *   hit -> setValues B7:G37 (31x6, H preserved), miss -> clearContent B7:G37 (H 0), toast 8s.
 *
 * Timezone: America/La_Paz only for J timestamp via materialRawAuditTimestamp_(); never for fecha.
 * Failure: Errors sheet + toast 8s, header drift fail-closed, lock timeout no write.
 *
 * INSTALL: Extensions > Apps Script > paste this project > Save > Reload sheet > materialRawSetup once
 * VERIFY:  Use a COPY of 13vr2cJSG3Bukpd1Gk71-- — never prod.
 */

/**
 * Normalize D4 value to valid native Date or null.
 * No Utilities.formatDate; no reformatting — only checks instanceof Date.
 */
function materialRawIsValidFecha_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return true;
  return false;
}

/**
 * Format native Date to dd/MM/yyyy for toast (no timezone via formatDate).
 * Uses local Date components to avoid La_Paz conversion for business date display;
 * component values come directly from the native Date object.
 */
function materialRawFormatFechaForToast_(fecha) {
  if (!(fecha instanceof Date) || isNaN(fecha.getTime())) return String(fecha || '');
  var dd = String(fecha.getDate()).padStart(2, '0');
  var mm = String(fecha.getMonth() + 1).padStart(2, '0');
  var yyyy = String(fecha.getFullYear());
  return dd + '/' + mm + '/' + yyyy;
}

/**
 * Reset F4 checkbox to FALSE (idempotent) and flush. Always call in finally.
 */
function materialRawResetCheckboxF4_(optSpreadsheet) {
  try {
    var ss = optSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
    var form = materialRawGetFormSheet_(ss);
    if (!form) return;
    var checkbox = materialRawGetRange_(form, MATERIAL_RAW_CONFIG.RANGES.CHECKBOX);
    try {
      if (checkbox.getValue() !== false) checkbox.setValue(false);
    } catch (e) {
      try { checkbox.setValue(false); } catch (ignore) {}
    }
    try { SpreadsheetApp.flush(); } catch (ignore2) {}
  } catch (ignore3) {}
}

/**
 * Public save: triggered by F4 FALSE\u2192TRUE via materialRawOnEdit and by
 * menu Materia Prima \u2192 Guardar d\u00EDa. Batch-reads D4 + B7:H37 + A7:A37, filters F<>"",
 * validates header, locked delete+append by fecha (native Date passthrough),
 * resets F4=FALSE even on error, toasts 8s.
 *
 * @return {{success:boolean, code:string, inserted:number, deleted:number}}
 */
function materialRawGuardarDia() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var form = null;
  try { form = materialRawRequireFormSheet_(ss); } catch (e) {
    var msg = e && e.message ? e.message : String(e);
    try { materialRawLogError_('guardar', MATERIAL_RAW_CONFIG.ERRORS.MISSING_SHEET, msg, MATERIAL_RAW_CONFIG.SHEETS.FORM, ss); } catch (ignore) {}
    try { ss.toast(msg, 'Materia Prima', 8); } catch (ignore2) {}
    try { materialRawResetCheckboxF4_(ss); } catch (ignore3) {}
    return { success: false, code: MATERIAL_RAW_CONFIG.ERRORS.MISSING_SHEET, inserted: 0, deleted: 0 };
  }

  // Wrap entire guard in try/finally to guarantee F4=FALSE even on abort.
  // Read fecha first via getValue() native (no formatDate, no validation).
  var fecha;
  var formValues;
  var diaValues;
  try {
    fecha = form.getRange(MATERIAL_RAW_CONFIG.RANGES.DATE).getValue();
  } catch (e) {
    fecha = '';
  }

  // EC-01: D4 empty / not a valid native Date -> abort, toast 8s, reset F4, no write
  if (!materialRawIsValidFecha_(fecha)) {
    try { materialRawLogError_('guardar', MATERIAL_RAW_CONFIG.ERRORS.EMPTY_FECHA, 'D4 vac\u00EDa o inv\u00E1lida — guard bloqueado', MATERIAL_RAW_CONFIG.RANGES.DATE, ss); } catch (ignore) {}
    try { ss.toast('Seleccione una fecha v\u00E1lida en D4.', 'Materia Prima', 8); } catch (ignore2) {}
    try { materialRawResetCheckboxF4_(ss); } catch (ignore3) {}
    return { success: false, code: MATERIAL_RAW_CONFIG.ERRORS.EMPTY_FECHA, inserted: 0, deleted: 0 };
  }

  // Header fail-closed before any write (no lock yet — fast fail)
  var headerCheck = materialRawValidateDataHeader_(ss);
  if (!headerCheck.success) {
    // materialRawValidateDataHeader_ already toasted 8s + logged Errors
    try { materialRawResetCheckboxF4_(ss); } catch (ignore) {}
    return { success: false, code: headerCheck.code, inserted: 0, deleted: 0 };
  }

  // Batch read form: B7:H37 (31x7) + A7:A37 (31x1) — 2 getValues calls after D4
  try {
    formValues = form.getRange(MATERIAL_RAW_CONFIG.RANGES.FORM).getValues();
    diaValues = form.getRange('A7:A37').getValues();
  } catch (e) {
    var rmsg = e && e.message ? e.message : String(e);
    try { materialRawLogError_('guardar', 'read_failed', rmsg, MATERIAL_RAW_CONFIG.RANGES.FORM, ss); } catch (ignore) {}
    try { ss.toast('' + rmsg, 'Materia Prima', 8); } catch (ignore2) {}
    try { materialRawResetCheckboxF4_(ss); } catch (ignore3) {}
    return { success: false, code: 'read_failed', inserted: 0, deleted: 0, detail: rmsg };
  }

  // Build rows: filter F<>"" (index 4 within B:H is tipo_fardo, col F)
  // B:H mapping: B(0)=n_camion, C(1)=tipo_material, D(2)=n_partida, E(3)=n_bulto, F(4)=tipo_fardo, G(5)=cantidad, H(6)=total_kilos
  var newRows = [];
  var sumKilos = 0;
  for (var i = 0; i < formValues.length; i++) {
    var row = formValues[i];
    var tipoFardo = String(row[4] == null ? '' : row[4]).trim();
    if (tipoFardo === '') continue;
    var dia = diaValues && diaValues[i] ? diaValues[i][0] : '';
    // Respect existing dia value if numeric/string, otherwise keep as '' (let sheet formula handle)
    // Do not coerce dia — pass through
    var nCamion = row[0];
    var tipoMat = row[1];
    var nPartida = row[2];
    var nBulto = row[3];
    var cantidad = row[5];
    var totalKilos = row[6];
    // Normalize totalKilos numeric sum: handle number or string numeric
    var kilosNum = Number(totalKilos);
    if (isFinite(kilosNum)) sumKilos += kilosNum;
    var timestamp = materialRawAuditTimestamp_();
    // fecha is native Date passthrough — same object for all rows (no formatDate)
    newRows.push([fecha, dia, nCamion, tipoMat, nPartida, nBulto, tipoFardo, cantidad, totalKilos, timestamp]);
  }

  // Even if newRows empty (all F=""), still perform delete+append: this clears the day (idempotent PK fecha)
  // That matches spec: only F<>"" rows persisted; clearing then saving deletes that PK.

  var lockResult = null;
  try {
    lockResult = materialRawWithLock_(function () {
      // Re-validate header inside lock (race protection)
      var insideHeader = materialRawValidateDataHeader_(ss);
      if (!insideHeader.success) {
        return { success: false, code: insideHeader.code, inserted: 0, deleted: 0 };
      }
      var del = materialRawDeleteByFecha_(fecha, ss);
      if (!del.success) return { success: false, code: del.code, inserted: 0, deleted: del.deleted || 0 };
      var ins = materialRawAppendRows_(newRows, ss);
      if (!ins.success) return { success: false, code: ins.code, inserted: 0, deleted: del.deleted || 0 };
      return { success: true, code: 'ok', inserted: ins.inserted, deleted: del.deleted || 0 };
    }, ss);
  } catch (e) {
    var emsg = e && e.message ? e.message : String(e);
    try { materialRawLogError_('guardar', 'execution_failure', emsg, MATERIAL_RAW_CONFIG.SHEETS.DATA, ss); } catch (ignore) {}
    lockResult = { success: false, code: 'execution_failure', inserted: 0, deleted: 0, detail: emsg };
  } finally {
    // Always reset F4=FALSE even on success/failure/lock timeout
    try { materialRawResetCheckboxF4_(ss); } catch (ignore) {}
  }

  // Handle lock timeout already toasted \u23F3 by materialRawWithLock_ (8s) — add Errors already logged
  if (!lockResult || !lockResult.success) {
    // If lock timeout, materialRawWithLock_ already toasted \u23F3 ocupado 8s and logged; ensure 8s toast if not
    if (lockResult && lockResult.code === MATERIAL_RAW_CONFIG.ERRORS.LOCK_TIMEOUT) {
      // toast already done inside withLock; ensure no duplicate but keep 8s
      return { success: false, code: lockResult.code, inserted: 0, deleted: lockResult.deleted || 0 };
    }
    // Header drift inside lock already toasted
    if (lockResult && lockResult.code === MATERIAL_RAW_CONFIG.ERRORS.HEADER_MISMATCH) {
      return { success: false, code: lockResult.code, inserted: 0, deleted: lockResult.deleted || 0 };
    }
    var failCode = lockResult ? lockResult.code : 'save_failed';
    var failMsg = failCode === 'execution_failure' && lockResult && lockResult.detail ? lockResult.detail : failCode;
    // Avoid double-toast if already header/lock; otherwise toast generic 8s
    try { ss.toast('' + failMsg, 'Materia Prima', 8); } catch (ignore) {}
    try { materialRawLogError_('guardar', failCode, failMsg, MATERIAL_RAW_CONFIG.SHEETS.DATA, ss); } catch (ignore2) {}
    return { success: false, code: failCode, inserted: 0, deleted: lockResult ? (lockResult.deleted || 0) : 0 };
  }

  // Success toast 8s: \u2705 D\u00EDa guardado: dd/MM/yyyy \u2014 N fardos, X kg
  var fechaStr = materialRawFormatFechaForToast_(fecha);
  // Format kilos with up to 2 decimals without locale shift
  var kilosStr = String(Math.round(sumKilos * 100) / 100);
  try { ss.toast('\u2705 D\u00EDa guardado: ' + fechaStr + ' \u2014 ' + lockResult.inserted + ' fardos, ' + kilosStr + ' kg', 'Materia Prima', 8); } catch (ignore) {}
  try { SpreadsheetApp.flush(); } catch (ignore2) {}
  return { success: true, code: 'ok', inserted: lockResult.inserted, deleted: lockResult.deleted };
}

/**
 * Rehydrate B7:G37 (preserve H7:H37 formulas) by filtering db_materialrow where A == nativeFecha.
 * Under lock 5s+1 retry. Hit -> setValues B7:G37 sequentially; Miss -> clearContent B7:G37.
 * MUST NOT trigger save. Toast 8s.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet=} optSpreadsheet
 * @param {Date|string} nativeFecha
 * @return {{success:boolean, code:string, count:number}}
 */
function materialRawHydrate_(optSpreadsheet, nativeFecha) {
  var ss = optSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  var fecha = nativeFecha;
  // If no fecha supplied, read D4 current
  if (fecha === undefined || fecha === null) {
    try {
      var formTmp = materialRawGetFormSheet_(ss);
      fecha = formTmp ? formTmp.getRange(MATERIAL_RAW_CONFIG.RANGES.DATE).getValue() : null;
    } catch (e) { fecha = null; }
  }
  if (!materialRawIsValidFecha_(fecha)) {
    // No valid fecha -> nothing to hydrate; toast 8s per spec (treated as empty)
    try { ss.toast('Seleccione una fecha v\u00E1lida en D4.', 'Materia Prima', 8); } catch (ignore) {}
    return { success: false, code: MATERIAL_RAW_CONFIG.ERRORS.EMPTY_FECHA, count: 0 };
  }

  // Validate header before lock (fast fail)
  var headerCheck = materialRawValidateDataHeader_(ss);
  if (!headerCheck.success) {
    return { success: false, code: headerCheck.code, count: 0 };
  }

  var result = materialRawWithLock_(function () {
    var all = materialRawReadAllRows_(ss);
    var matches = materialRawFilterRowsByFecha_(all, fecha);
    var form = materialRawGetFormSheet_(ss);
    if (!form) {
      materialRawLogError_('rehydrate', MATERIAL_RAW_CONFIG.ERRORS.MISSING_SHEET, 'Falta hoja ' + MATERIAL_RAW_CONFIG.SHEETS.FORM, MATERIAL_RAW_CONFIG.SHEETS.FORM, ss);
      try { ss.toast('Falta hoja ' + MATERIAL_RAW_CONFIG.SHEETS.FORM, 'Materia Prima', 8); } catch (ignore) {}
      return { success: false, code: MATERIAL_RAW_CONFIG.ERRORS.MISSING_SHEET, count: 0 };
    }

    if (matches.length === 0) {
      // Miss -> clear B7:G37 leaving H intact
      try {
        materialRawGetRange_(form, MATERIAL_RAW_CONFIG.RANGES.CLEAR).clearContent();
        // Also clear A7:A37? Spec says only B7:G37; preserve A static labels? Keep A as-is to avoid erasing dia numbers
        // Do not touch H7:H37 — formulas will show 0
        SpreadsheetApp.flush();
      } catch (e) {
        var em = e && e.message ? e.message : String(e);
        materialRawLogError_('rehydrate', 'clear_failed', em, MATERIAL_RAW_CONFIG.RANGES.CLEAR, ss);
        try { ss.toast(em, 'Materia Prima', 8); } catch (ignore) {}
        return { success: false, code: 'clear_failed', count: 0 };
      }
      var fechaStrMiss = materialRawFormatFechaForToast_(fecha);
      try { ss.toast('\u2139\uFE0F D\u00EDa sin datos: ' + fechaStrMiss + ' \u2014 formulario listo', 'Materia Prima', 8); } catch (ignore) {}
      return { success: true, code: 'miss', count: 0 };
    }

    // Hit -> build 31x6 matrix for B7:G37 (B..G) — preserve H7:H37 formulas + leave A untouched per spec
    var rows = 31;
    var matrix = [];
    for (var r = 0; r < rows; r++) {
      if (r < matches.length) {
        var v = matches[r].values;
        // DB: 0 fecha,1 dia,2 n_camion,3 tipo_mat,4 n_partida,5 n_bulto,6 tipo_fardo,7 cantidad,8 total_kilos,9 timestamp
        var nCamion = v[MATERIAL_RAW_CONFIG.IDX.N_CAMION];
        var tipoMat = v[MATERIAL_RAW_CONFIG.IDX.TIPO_MAT];
        var nPartida = v[MATERIAL_RAW_CONFIG.IDX.N_PARTIDA];
        var nBulto = v[MATERIAL_RAW_CONFIG.IDX.N_BULTO];
        var tipoFardo = v[MATERIAL_RAW_CONFIG.IDX.TIPO_FARDO];
        var cantidad = v[MATERIAL_RAW_CONFIG.IDX.CANTIDAD];
        matrix.push([nCamion, tipoMat, nPartida, nBulto, tipoFardo, cantidad]);
      } else {
        matrix.push(['', '', '', '', '', '']);
      }
    }
    try {
      materialRawGetRange_(form, MATERIAL_RAW_CONFIG.RANGES.CLEAR).setValues(matrix);
      // H7:H37 formulas remain — not overwritten (CLEAR is B:G only); A7:A37 left intact per spec
      SpreadsheetApp.flush();
    } catch (e) {
      var em2 = e && e.message ? e.message : String(e);
      materialRawLogError_('rehydrate', 'write_failed', em2, MATERIAL_RAW_CONFIG.RANGES.CLEAR, ss);
      try { ss.toast(em2, 'Materia Prima', 8); } catch (ignore) {}
      return { success: false, code: 'write_failed', count: 0 };
    }
    var fechaStrHit = materialRawFormatFechaForToast_(fecha);
    try { ss.toast('\u2705 D\u00EDa cargado: ' + fechaStrHit + ' \u2014 ' + matches.length + ' fardos', 'Materia Prima', 8); } catch (ignore) {}
    return { success: true, code: 'hit', count: matches.length };
  }, ss);

  // materialRawWithLock_ returns timeout object on lock failure (success false)
  if (!result || result.success === false && result.code === MATERIAL_RAW_CONFIG.ERRORS.LOCK_TIMEOUT) {
    // Lock timeout already toasted \u23F3 8s inside withLock
    return result || { success: false, code: MATERIAL_RAW_CONFIG.ERRORS.LOCK_TIMEOUT, count: 0 };
  }
  // Unwrap the inner result: withLock returns callback return directly on success
  // Callback already returned object with count. Normalize.
  if (result && typeof result.count === 'number') return result;
  if (result && result.success !== undefined) return result;
  return { success: true, code: 'ok', count: 0 };
}

// Public alias for menu Resincronizar (must be public — no trailing underscore)
function materialRawResincronizar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var form = materialRawGetFormSheet_(ss);
  if (!form) {
    try { ss.toast('Falta hoja ' + MATERIAL_RAW_CONFIG.SHEETS.FORM, 'Materia Prima', 8); } catch (ignore) {}
    return { success: false, code: MATERIAL_RAW_CONFIG.ERRORS.MISSING_SHEET, count: 0 };
  }
  var fecha = form.getRange(MATERIAL_RAW_CONFIG.RANGES.DATE).getValue();
  return materialRawHydrate_(ss, fecha);
}
