/**
 * Menu.gs — Explicit save and resync workflows (aligned to coneras/yarn-inventory).
 *
 * Menu: Winding -> Guardar turno | Re-sincronizar (2 items only — Recuperar turno removido por paridad)
 * Mobile/desktop: M4 checkbox FALSE->TRUE triggers installable windingOnEdit -> windingGuardarTurno
 *         debounce 3000ms via PropertiesService (winding-last-save-ms) + always reset M4=FALSE + flush.
 * onOpen: ensures schema/checkbox styling and trigger so the checkbox is visible before any manual save.
 * Re-sincronizar: idempotent ensureSchema + trigger reconciliation + toast (parity con yarn-inventory/coneras).
 * Rehidrate: H4 (Fecha) o J4 (Turno) cambian -> hydrate incondicional por fecha+turno:
 *            limpia SOLO B12:D23 + F12:T23 + L4 (nunca E12:E23 formulas ni A12:A23), luego llena si hay
 *            registros en db_embolsado; si no hay, deja limpio y toast "Nuevo turno — sin datos".
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
  var oldIsFalse = oldNorm === 'FALSE' || event.oldValue === '';
  if (valNorm !== 'TRUE' || !oldIsFalse) return false;
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

  // Rehidrate incondicional por Fecha+Turno — parity con coneras/yarn-inventory
  // Nunca disparado por el checkbox M4.
  var a1 = '';
  try { a1 = range.getA1Notation(); } catch (ignore10) {}
  if (a1 === WINDING_CONFIG.FORM.DATE || a1 === WINDING_CONFIG.FORM.TURNO) {
    try {
      // No guard: siempre hidrata — si hay datos los carga, si no limpia B:D + F:T + L4 (nunca E)
      windingHydratePorFiltro_(event.source || SpreadsheetApp.getActiveSpreadsheet());
    } catch (ignore11) {}
  }
}

function windingResetSaveCheckbox_(form) {
  form.getRange(WINDING_CONFIG.FORM.SAVE_CHECKBOX).setValue(false);
}

// --- Rehidrate central — incondicional, limpia solo rangos permitidos (nunca E12:E23) ---

function windingHydratePorFiltro_(spreadsheet) {
  var ss = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  var form = null;
  try { form = windingRequireFormSheet_(ss); } catch (e) { return { success: false, code: 'missing_form' }; }
  var keys = windingValidateSnapshotKeys_(
    form.getRange(WINDING_CONFIG.FORM.DATE).getValue(),
    form.getRange(WINDING_CONFIG.FORM.TURNO).getDisplayValue());
  if (!keys.ok) {
    // Claves inválidas -> no tocar el form, solo avisar (parity yarn-inventory/coneras no borra en clave inválida)
    ss.toast('No se puede cargar: completá fecha y turno válidos.', 'Winding', 5);
    return { success: false, code: keys.code };
  }
  return windingRecoverFromCurrentKeys_(ss, false);
}

// Legacy alias — antes era guardado con check de zona vacía; ahora delega a hydrate incondicional
function windingIntentarRecuperacionAutomatica_(spreadsheet) {
  return windingHydratePorFiltro_(spreadsheet);
}

// Legacy menu item — mantenido por compatibilidad pero ya no expuesto (usar hydrate automático por Fecha+Turno)
function windingRecuperarTurno() {
  return windingHydratePorFiltro_(SpreadsheetApp.getActiveSpreadsheet());
}

function windingCanAutoRecover_(displayValues) {
  // Kept for test harness compatibility — logica legacy guardada (B12:T23 vacía)
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
  // Escribir SOLO B12:D23 y F12:T23 — nunca E12:E23 (formulas) ni A12:A23
  form.getRange(WINDING_CONFIG.FORM.INPUT_LEFT).setValues(grids.left);
  form.getRange(WINDING_CONFIG.FORM.INPUT_RIGHT).setValues(grids.right);
  form.getRange(WINDING_CONFIG.FORM.SUPERVISOR).setValue(windingRecoverySupervisor_(records));
  SpreadsheetApp.flush();
  if (records.length) {
    ss.toast('Turno cargado: ' + keys.fechaKey + ' ' + keys.turno + ' (' + records.length + ' registros)', 'Winding', 5);
  } else {
    ss.toast('Nuevo turno — sin datos guardados', 'Winding', 3);
  }
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

// Re-sincronizar — parity con dyeing/coneras/yarn-inventory: ensure schema + trigger + toast
function windingResincronizar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  try { windingEnsureSchema(ss); } catch (e) {}
  try { windingReconcileOnEditTrigger_(); } catch (e2) {}
  try { SpreadsheetApp.flush(); } catch (e3) {}
  try { ss.toast('✅ Esquema verificado — ctrl_embolsado/db_embolsado/Errors listos', 'Winding', 5); } catch (ignore) {}
  return { ok: true };
}

function windingMenuResincronizar() {
  return windingResincronizar();
}

// Legacy corrective delete kept for audit but no longer exposed in menu — parity favorece Re-sincronizar
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
