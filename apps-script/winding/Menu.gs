/**
 * Menu.gs — Explicit save, recovery, and corrective deletion workflows.
 *
 * Formula-owned E12:E23 is never a recovery target. All persistence flows are
 * delegated to Snapshot.gs and Repository.gs so this module only orchestrates
 * user actions and trusted installable edit events.
 */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Winding')
    .addItem('Guardar turno', 'windingGuardarTurno')
    .addItem('Recuperar turno', 'windingRecuperarTurno')
    .addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu('Correcciones')
      .addItem('Eliminar registro…', 'windingEliminarRegistro'))
    .addToUi();
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

function windingOnEdit(event) {
  if (!event || !event.range) return;
  const range = event.range;
  const form = range.getSheet();
  if (form.getName() !== WINDING_CONFIG.SHEETS.FORM) return;

  if (range.getA1Notation() === WINDING_CONFIG.FORM.SAVE_CHECKBOX) {
    if (!windingIsSaveCheckboxEvent_(event)) return;
    try {
      windingGuardarTurno();
    } finally {
      form.getRange(WINDING_CONFIG.FORM.SAVE_CHECKBOX).setValue(false);
      SpreadsheetApp.flush();
    }
    return;
  }

  if (range.getA1Notation() === WINDING_CONFIG.FORM.DATE ||
      range.getA1Notation() === WINDING_CONFIG.FORM.TURNO) {
    windingIntentarRecuperacionAutomatica_(event.source || SpreadsheetApp.getActiveSpreadsheet());
  }
}

function windingIsSaveCheckboxEvent_(event) {
  return event && event.value === 'TRUE' && event.oldValue === 'FALSE';
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
