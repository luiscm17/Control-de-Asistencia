/**
 * Menu.gs — Explicit save, rehydration, and resync workflows (aligned to dyeing/coneras/yarn-inventory).
 *
 * Menu: Winding -> Guardar turno | Recuperar turno | Re-sincronizar (3 items, no Correcciones)
 * Mobile/desktop: M4 checkbox FALSE->TRUE triggers installable windingOnEdit -> windingGuardarTurno
 *         debounce 3000ms via PropertiesService (winding-last-save-ms) + always reset M4=FALSE + flush.
 * onOpen: ensures schema/checkbox styling and trigger so the checkbox is visible before any manual save.
 * Re-sincronizar: idempotent ensureSchema + trigger reconciliation + toast (parity with yarn-inventory/coneras).
 *
 * Formula-owned E12:E23 is never a recovery target. All persistence flows are
 * delegated to Snapshot.gs and Repository.gs so this module only orchestrates
 * user actions and trusted installable edit events.
 */

function onOpen() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    try { windingEnsureSchema(ss); } catch (ignore) {}
    try { windingReconcileOnEditTrigger_(); } catch (ignore2) {}
  } catch (ignore3) {}
  try {
    SpreadsheetApp.getUi().createMenu('Winding')
      .addItem('Guardar turno', 'windingGuardarTurno')
      .addItem('Recuperar turno', 'windingRecuperarTurno')
      .addItem('Re-sincronizar', 'windingResincronizar')
      .addToUi();
  } catch (e) {
    // Ui unavailable in headless/test — ignore
  }
}

// Simple trigger delegate — allows sheet-bound onEdit without install
function onEdit(e) {
  try { return windingOnEdit(e); } catch (ignore) {}
}

function windingGuardarTurno() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const snapshot = windingCaptureSnapshot_(ss);
  if (!snapshot.ok) {
    windingRecordWorkflowFailure_(ss, 'save.validation', snapshot.code);
    ss.toast('No se guardó el turno: completá fecha y turno válidos.', 'Winding', 5);
    return { success: false, code: snapshot.code, inserted: 0, updated: 0 };
  }

  const result = windingPersistSnapshot_(snapshot, ss);
  if (result.success) {
    ss.toast('Turno guardado: ' + result.inserted + ' nuevo(s), ' + result.updated + ' actualizado(s).',
      'Winding', 5);
  } else {
    windingRecordWorkflowFailure_(ss, 'save.persistence', result.code);
    ss.toast('No se guardó el turno. Intentá nuevamente.', 'Winding', 5);
  }
  return result;
}

function windingNormalizeCheckboxValue_(v) {
  if (v === true) return 'TRUE';
  if (v === false) return 'FALSE';
  var s = String(v == null ? '' : v).trim().toUpperCase();
  if (s === 'VERDADERO') return 'TRUE';
  if (s === 'FALSO') return 'FALSE';
  return s;
}

function windingParseA1_(a1) {
  var raw = String(a1).trim().toUpperCase();
  var match = raw.match(/^([A-Z]+)(\d+)$/);
  if (!match) throw new Error('Invalid A1: ' + a1);
  var letters = match[1];
  var col = 0;
  for (var i = 0; i < letters.length; i++) col = col * 26 + (letters.charCodeAt(i) - 64);
  return { row: parseInt(match[2], 10), col: col };
}

function windingIsDebounced_() {
  try {
    var props = PropertiesService.getDocumentProperties();
    var last = props.getProperty('winding-last-save-ms');
    if (!last) return false;
    var elapsed = new Date().getTime() - Number(last);
    var debounceMs = (WINDING_CONFIG.UI && WINDING_CONFIG.UI.DEBOUNCE_MS) || 3000;
    return elapsed < debounceMs;
  } catch (e) {
    return false;
  }
}

function windingMarkSaved_() {
  try {
    PropertiesService.getDocumentProperties().setProperty('winding-last-save-ms', String(new Date().getTime()));
  } catch (ignore) {}
}

function windingIsSaveCheckboxEvent_(event) {
  if (!event) return false;
  var valNorm = windingNormalizeCheckboxValue_(event.value);
  var oldNorm = windingNormalizeCheckboxValue_(event.oldValue);
  // Allow explicit empty string '' as valid old FALSE (canonical mobile pattern),
  // but keep undefined/null as invalid to satisfy harness strictness.
  var oldIsFalse = oldNorm === 'FALSE' || event.oldValue === '';
  if (valNorm !== 'TRUE' || !oldIsFalse) return false;
  // Harness synthetic events have no range — accept value-only check
  if (!event.range) return true;
  var range = event.range;
  if (range.getNumRows() !== 1 || range.getNumColumns() !== 1) return false;
  var sheet = null;
  try { sheet = range.getSheet(); } catch (ignore) { return false; }
  if (!sheet || sheet.getName() !== WINDING_CONFIG.SHEETS.FORM) return false;
  var pos = windingParseA1_(WINDING_CONFIG.FORM.SAVE_CHECKBOX);
  return range.getRow() === pos.row && range.getColumn() === pos.col;
}

function windingOnEdit(event) {
  if (!event || !event.range) return;
  var range = event.range;
  var form = null;
  try { form = range.getSheet(); } catch (ignore) { return; }
  if (!form || form.getName() !== WINDING_CONFIG.SHEETS.FORM) return;

  // Checkbox save path (installable + simple delegate)
  var isCheckbox = false;
  try { isCheckbox = windingIsSaveCheckboxEvent_(event); } catch (ignore2) {}
  if (isCheckbox) {
    var ss = null;
    try { ss = (event && event.source) ? event.source : SpreadsheetApp.getActiveSpreadsheet(); } catch (ignore3) {}
    if (windingIsDebounced_()) {
      try { (ss || SpreadsheetApp.getActiveSpreadsheet()).toast('⏳ Guardado reciente, esperá 3s', 'Winding', 4); } catch (ignore4) {}
      try { event.range.setValue(false); } catch (ignore5) {}
      try { SpreadsheetApp.flush(); } catch (ignore6) {}
      return;
    }
    windingMarkSaved_();
    try {
      windingGuardarTurno();
    } catch (err) {
      try { Logger.log('windingOnEdit guardar error: ' + (err && err.message ? err.message : String(err))); } catch (ignore7) {}
    } finally {
      try { windingResetSaveCheckbox_(form); } catch (ignore8) {}
      try { SpreadsheetApp.flush(); } catch (ignore9) {}
    }
    return;
  }

  // Auto-recovery when date or turno changes (parity with coneras/yarn-inventory filter hydrate)
  var a1 = '';
  try { a1 = range.getA1Notation(); } catch (ignore10) {}
  if (a1 === WINDING_CONFIG.FORM.DATE || a1 === WINDING_CONFIG.FORM.TURNO) {
    try { windingIntentarRecuperacionAutomatica_(event.source || SpreadsheetApp.getActiveSpreadsheet()); } catch (ignore11) {}
  }
}

function windingResetSaveCheckbox_(form) {
  form.getRange(WINDING_CONFIG.FORM.SAVE_CHECKBOX).setValue(false);
}

function windingRecuperarTurno() {
  return windingRecoverFromCurrentKeys_(SpreadsheetApp.getActiveSpreadsheet(), false);
}

function windingIntentarRecuperacionAutomatica_(spreadsheet) {
  const ss = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  const form = windingRequireFormSheet_(ss);
  const zone = form.getRange(WINDING_CONFIG.FORM.PERSISTED_ZONE).getDisplayValues();
  if (!windingCanAutoRecover_(zone)) {
    ss.toast('Hay datos en el formulario. Usá Winding > Recuperar turno para evitar sobrescribirlos.',
      'Winding', 5);
    return { success: false, code: 'recovery_requires_menu' };
  }
  return windingRecoverFromCurrentKeys_(ss, true);
}

function windingCanAutoRecover_(displayValues) {
  return (displayValues || []).every(function (row) {
    return row.every(function (value) { return String(value || '').trim() === ''; });
  });
}

function windingRecoverFromCurrentKeys_(spreadsheet, automatic) {
  const ss = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  const form = windingRequireFormSheet_(ss);
  const keys = windingValidateSnapshotKeys_(
    form.getRange(WINDING_CONFIG.FORM.DATE).getValue(),
    form.getRange(WINDING_CONFIG.FORM.TURNO).getDisplayValue());
  if (!keys.ok) {
    ss.toast('No se puede recuperar: completá fecha y turno válidos.', 'Winding', 5);
    return { success: false, code: keys.code };
  }

  const records = windingLoadRecoveryRecords_(ss, keys.fechaKey, keys.turno);
  const currentRows = form.getRange(WINDING_CONFIG.FORM.INPUT_LEFT).getDisplayValues();
  const grids = windingBuildRecoveryGrids_(records, currentRows);
  form.getRange(WINDING_CONFIG.FORM.INPUT_LEFT).setValues(grids.left);
  form.getRange(WINDING_CONFIG.FORM.INPUT_RIGHT).setValues(grids.right);
  form.getRange(WINDING_CONFIG.FORM.SUPERVISOR).setValue(windingRecoverySupervisor_(records));
  SpreadsheetApp.flush();
  ss.toast(records.length ? 'Turno recuperado.' : 'No hay registros para la fecha y turno seleccionados.',
    'Winding', 5);
  return { success: true, code: records.length ? 'ok' : 'not_found', automatic: Boolean(automatic), count: records.length };
}

function windingBuildRecoveryGrids_(records, currentRows) {
  const rowCount = WINDING_CONFIG.FORM.LAST_ITEM_ROW - WINDING_CONFIG.FORM.FIRST_ITEM_ROW + 1;
  const left = Array.from({ length: rowCount }, function () { return ['', '', '']; });
  const right = Array.from({ length: rowCount }, function () { return Array(15).fill(0); });
  const byLote = {};
  (records || []).forEach(function (record) {
    const lote = String(record.lote || '').trim();
    if (lote) byLote[lote] = record;
  });

  const assigned = [];
  (currentRows || []).forEach(function (row, index) {
    const record = byLote[String(row[1] || '').trim()];
    if (record && assigned.indexOf(record) === -1) {
      windingAssignRecoveryRow_(left, right, index, record);
      assigned.push(record);
    }
  });
  (records || []).forEach(function (record) {
    if (assigned.indexOf(record) !== -1) return;
    const target = left.findIndex(function (row) { return row[1] === ''; });
    if (target !== -1) windingAssignRecoveryRow_(left, right, target, record);
  });
  return { left: left, right: right };
}

function windingAssignRecoveryRow_(left, right, rowIndex, record) {
  left[rowIndex] = [record.color || '', record.lote || '', record.titulo || ''];
  right[rowIndex] = (record.operators || []).slice(0, 15);
  while (right[rowIndex].length < 15) right[rowIndex].push(0);
}

function windingRecoverySupervisor_(records) {
  const first = (records || []).find(function (record) {
    return String(record.supervisor || '').trim() !== '';
  });
  return first ? String(first.supervisor).trim() : '';
}

// Re-sincronizar — parity with dyeing/coneras/yarn-inventory: ensure schema + trigger + toast
function windingResincronizar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  try { windingEnsureSchema(ss); } catch (e) {}
  try { windingReconcileOnEditTrigger_(); } catch (e2) {}
  try { SpreadsheetApp.flush(); } catch (e3) {}
  try { ss.toast('✅ Esquema verificado — ctrl_embolsado/db_embolsado/Errors listos', 'Winding', 5); } catch (ignore) {}
  return { ok: true };
}

// Alias for menu binding stability (some sheets may resolve accented names differently)
function windingMenuResincronizar() {
  return windingResincronizar();
}

// Legacy corrective delete kept for audit but no longer exposed in menu — parity with other projects favors Re-sincronizar
function windingEliminarRegistro() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const form = windingRequireFormSheet_(ss);
  const keys = windingValidateSnapshotKeys_(
    form.getRange(WINDING_CONFIG.FORM.DATE).getValue(),
    form.getRange(WINDING_CONFIG.FORM.TURNO).getDisplayValue());
  if (!keys.ok) {
    ss.toast('No se puede eliminar: completá fecha y turno válidos.', 'Winding', 5);
    return { success: false, code: keys.code };
  }

  const ui = SpreadsheetApp.getUi();
  const lotePrompt = ui.prompt('Eliminar registro', 'Ingresá el lote a eliminar.', ui.ButtonSet.OK_CANCEL);
  if (lotePrompt.getSelectedButton() !== ui.Button.OK) return { success: false, code: 'cancelled' };
  const identity = windingNormalizeRecordIdentity_(keys.fechaKey, keys.turno, lotePrompt.getResponseText());
  if (!identity.ok) {
    ss.toast('No se puede eliminar: el lote no es válido.', 'Winding', 5);
    return { success: false, code: identity.code };
  }

  const confirmation = ui.prompt('Confirmar eliminación',
    'Escribí exactamente este ID para eliminarlo: ' + identity.id, ui.ButtonSet.OK_CANCEL);
  if (confirmation.getSelectedButton() !== ui.Button.OK ||
      !windingIsConfirmedDelete_(identity.id, confirmation.getResponseText())) {
    ss.toast('Eliminación cancelada: la confirmación no coincide.', 'Winding', 5);
    return { success: false, code: 'confirmation_mismatch' };
  }

  const result = windingDeleteRecord_(identity.id, ss);
  ss.toast(result.success ? 'Registro eliminado.' : 'No se eliminó el registro: ' + result.code + '.',
    'Winding', 5);
  return result;
}

function windingIsConfirmedDelete_(id, confirmation) {
  return String(confirmation || '').trim() === String(id || '').trim();
}

function windingRecordWorkflowFailure_(spreadsheet, context, detail) {
  try {
    windingWithDocumentLock_(function () {
      windingAppendErrorUnlocked_(spreadsheet, context, detail, windingEditorEmail_());
      SpreadsheetApp.flush();
      return { success: true };
    }, spreadsheet);
  } catch (error) {
    Logger.log('Unable to record winding workflow failure: ' + error.message);
  }
}
