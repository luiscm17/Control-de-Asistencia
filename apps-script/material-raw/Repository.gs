/**
 * Repository.gs — Locked, indexed persistence helpers for Material Raw (Materia Prima).
 *
 * DB: db_materialrow A:J (fecha native Date passthrough, no formatDate for business date)
 *     PK = fecha (delete+append idempotent). J timestamp is La_Paz.
 * All writes use LockService 5s + 1 retry; fail-closed on header drift (Errors + toast 8s).
 * This file is PR1 skeleton — no Core save/rehydrate wiring yet; helpers are
 * consumed by Core.gs in PR2.
 */

// --- Lock wrapper: 5s + 1 retry, toast 8s on timeout, always release ---

function materialRawWithLock_(callback, optSpreadsheet) {
  var ss = optSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  var lock = LockService.getDocumentLock();
  var locked = false;
  try {
    locked = lock.tryLock(MATERIAL_RAW_CONFIG.LOCK.WAIT_MS);
    if (!locked) {
      try { Utilities.sleep(MATERIAL_RAW_CONFIG.LOCK.SLEEP_MS); } catch (e) {}
      locked = lock.tryLock(MATERIAL_RAW_CONFIG.LOCK.WAIT_MS);
    }
    if (!locked) {
      materialRawLogError_('lock', MATERIAL_RAW_CONFIG.ERRORS.LOCK_TIMEOUT, 'Document lock unavailable.', MATERIAL_RAW_CONFIG.SHEETS.DATA, ss);
      try { ss.toast(String.fromCharCode(9203) + ' ocupado — reintent' + String.fromCharCode(225) + ' en unos segundos.', 'Materia Prima', 8); } catch (ignore) {}
      return { success: false, code: MATERIAL_RAW_CONFIG.ERRORS.LOCK_TIMEOUT, inserted: 0, deleted: 0 };
    }
    return callback();
  } catch (error) {
    Logger.log('materialRaw repository error: ' + error.message);
    try { materialRawLogError_('repository', 'repository_error', error.message, MATERIAL_RAW_CONFIG.SHEETS.DATA, ss); } catch (ignore2) {}
    return { success: false, code: 'repository_error', inserted: 0, deleted: 0, detail: error.message };
  } finally {
    if (locked) { try { lock.releaseLock(); } catch (e) {} }
  }
}

function materialRawLockTimeoutResult_() {
  return { success: false, code: MATERIAL_RAW_CONFIG.ERRORS.LOCK_TIMEOUT, inserted: 0, deleted: 0 };
}

// --- Audit helpers: La_Paz only for timestamp ---

function materialRawAuditTimestamp_() {
  return Utilities.formatDate(new Date(), MATERIAL_RAW_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
}

function materialRawEditorEmail_() {
  try { var a = Session.getActiveUser().getEmail(); if (a) return a; } catch (e) {}
  try { var eff = Session.getEffectiveUser().getEmail(); if (eff) return eff; } catch (e2) {}
  return 'unknown';
}

// --- Errors sheet: fail-closed logging + toast 8s ---

function materialRawLogError_(scope, code, reason, range, optSpreadsheet) {
  var ss = optSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(MATERIAL_RAW_CONFIG.SHEETS.ERRORS);
  if (!sheet) {
    try { sheet = materialRawEnsureErrorsSheet_(ss); } catch (e) { throw new Error('Errors sheet unavailable. Run materialRawSetup first.'); }
  }
  var row = [materialRawAuditTimestamp_(), scope || '', range || '', code || '', reason || '', materialRawEditorEmail_()];
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, MATERIAL_RAW_CONFIG.ERRORS_HEADERS.length).setValues([row]);
}

function materialRawAppendErrorUnlocked_(ss, scope, detail, editor) {
  var spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet();
  var errors = spreadsheet.getSheetByName(MATERIAL_RAW_CONFIG.SHEETS.ERRORS);
  if (!errors) throw new Error('Errors sheet is unavailable. Run materialRawSetup first.');
  errors.getRange(errors.getLastRow() + 1, 1, 1, MATERIAL_RAW_CONFIG.ERRORS_HEADERS.length)
    .setValues([[materialRawAuditTimestamp_(), scope || '', '', '', detail || '', editor || materialRawEditorEmail_()]]);
}

function materialRawFailClosed_(code, reason, rangeA1, optSpreadsheet) {
  var ss = optSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  try { materialRawLogError_(MATERIAL_RAW_CONFIG.SHEETS.DATA, code, reason, rangeA1 || MATERIAL_RAW_CONFIG.SHEETS.DATA + '!A1:J1', ss); } catch (ignore) {}
  try { ss.toast(reason || code, 'Materia Prima', 8); } catch (ignore2) {}
  return { success: false, code: code };
}

// --- Header validation: exact A1:J1, fail-closed (no auto-repair) ---

function materialRawValidateDataHeader_(optSpreadsheet) {
  var ss = optSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(MATERIAL_RAW_CONFIG.SHEETS.DATA);
  if (!sheet) {
    return materialRawFailClosed_(MATERIAL_RAW_CONFIG.ERRORS.MISSING_SHEET, 'Falta hoja ' + MATERIAL_RAW_CONFIG.SHEETS.DATA + '. Ejecut' + String.fromCharCode(225) + ' materialRawSetup.', MATERIAL_RAW_CONFIG.SHEETS.DATA + '!A1:J1', ss);
  }
  var width = MATERIAL_RAW_CONFIG.DB_HEADERS.length;
  var current = sheet.getRange(1, 1, 1, width).getDisplayValues()[0].map(function (v) { return String(v || '').trim(); });
  if (!materialRawHeadersMatch_(current, MATERIAL_RAW_CONFIG.DB_HEADERS)) {
    return materialRawFailClosed_(MATERIAL_RAW_CONFIG.ERRORS.HEADER_MISMATCH, 'Encabezado db_materialrow inv' + String.fromCharCode(225) + 'lido — no se escribi' + String.fromCharCode(243) + '.', MATERIAL_RAW_CONFIG.SHEETS.DATA + '!A1:J1', ss);
  }
  return { success: true, code: 'ok', sheet: sheet };
}

function materialRawCheckDataHeader_(ss) {
  return materialRawValidateDataHeader_(ss);
}

// --- DB read helpers: batch only ---

function materialRawReadAllRows_(optSpreadsheet) {
  var ss = optSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(MATERIAL_RAW_CONFIG.SHEETS.DATA);
  if (!sheet) throw new Error('Data sheet is unavailable. Run materialRawSetup first.');
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, MATERIAL_RAW_CONFIG.DB_HEADERS.length).getValues().map(function (values, index) {
    return { rowNumber: index + 2, values: values };
  });
}

function materialRawFilterRowsByFecha_(allRows, nativeFecha) {
  var key = materialRawFechaKey_(nativeFecha);
  if (!key) return [];
  return allRows.filter(function (entry) {
    return materialRawFechaKey_(entry.values[MATERIAL_RAW_CONFIG.IDX.FECHA]) === key;
  });
}

function materialRawQueryByFecha_(nativeFecha, optSpreadsheet) {
  var all = materialRawReadAllRows_(optSpreadsheet);
  return materialRawFilterRowsByFecha_(all, nativeFecha);
}

// --- DB write helpers: delete+append by fecha (PK fecha), no per-cell writes ---

function materialRawDeleteByFecha_(nativeFecha, optSpreadsheet) {
  var ss = optSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  var headerCheck = materialRawValidateDataHeader_(ss);
  if (!headerCheck.success) return headerCheck;
  var sheet = headerCheck.sheet;
  var allRows = materialRawReadAllRows_(ss);
  var toDelete = materialRawFilterRowsByFecha_(allRows, nativeFecha);
  if (toDelete.length === 0) return { success: true, code: 'ok', deleted: 0, sheet: sheet };
  // Collect rowNumbers descending to avoid index shift
  var rowNumbers = toDelete.map(function (e) { return e.rowNumber; }).sort(function (a, b) { return b - a; });
  rowNumbers.forEach(function (rn) { sheet.deleteRow(rn); });
  try { SpreadsheetApp.flush(); } catch (e) {}
  return { success: true, code: 'ok', deleted: rowNumbers.length, sheet: sheet };
}

function materialRawAppendRows_(rows, optSpreadsheet) {
  if (!rows || rows.length === 0) return { success: true, code: 'ok', inserted: 0 };
  var ss = optSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  var headerCheck = materialRawValidateDataHeader_(ss);
  if (!headerCheck.success) return headerCheck;
  var sheet = headerCheck.sheet;
  // Validate width
  var width = MATERIAL_RAW_CONFIG.DB_HEADERS.length;
  var sanitized = rows.map(function (r) {
    if (r.length !== width) throw new Error('Append row width mismatch: expected ' + width + ' got ' + r.length);
    return r;
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, sanitized.length, width).setValues(sanitized);
  try { SpreadsheetApp.flush(); } catch (e) {}
  return { success: true, code: 'ok', inserted: sanitized.length, sheet: sheet };
}

// Locked delete+append (idempotent save helper for PR2 — lock included)
function materialRawDeleteAppendByFecha_(nativeFecha, newRows, optSpreadsheet) {
  var ss = optSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  return materialRawWithLock_(function () {
    var headerCheck = materialRawValidateDataHeader_(ss);
    if (!headerCheck.success) return { success: false, code: headerCheck.code, inserted: 0, deleted: 0 };
    var del = materialRawDeleteByFecha_(nativeFecha, ss);
    if (!del.success) return del;
    var ins = materialRawAppendRows_(newRows, ss);
    if (!ins.success) return ins;
    return { success: true, code: 'ok', inserted: ins.inserted, deleted: del.deleted };
  }, ss);
}

// --- Form batch read helper (used by Core in PR2, exposed here for isolation tests) ---

function materialRawReadFormSnapshot_(optSpreadsheet) {
  var ss = optSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  var form = materialRawRequireFormSheet_(ss);
  var fecha = form.getRange(MATERIAL_RAW_CONFIG.RANGES.DATE).getValue();
  var formValues = form.getRange(MATERIAL_RAW_CONFIG.RANGES.FORM).getValues();
  var checkboxVal = form.getRange(MATERIAL_RAW_CONFIG.RANGES.CHECKBOX).getValue();
  return { fecha: fecha, formValues: formValues, checkbox: checkboxVal, form: form };
}

function materialRawBuildRowsFromForm_(fecha, formValues) {
  // B7:H37 is 7 cols B..H physical: B(0)=n_camion, C(1)=tipo_material, D(2)=n_partida,
  // E(3)=n_bulto, F(4)=tipo_fardo, G(5)=cantidad, H(6)=total_kilos (formula SI(F="";0;...)*G).
  // Dia is A7:A37 col A, not in this range — Core will merge it separately in PR2.
  // Filter: F<>"" (index 4 within B:H). Native fecha passthrough (no formatDate).
  var out = [];
  for (var i = 0; i < formValues.length; i++) {
    var row = formValues[i];
    var tipoFardo = String(row[4] == null ? '' : row[4]).trim();
    if (tipoFardo === '') continue;
    out.push(row);
  }
  return out;
}
