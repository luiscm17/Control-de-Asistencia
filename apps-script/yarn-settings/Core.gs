/**
 * Core.gs — Explicit, serialized save orchestration for Yarn Settings.
 */

let YARN_SETTINGS_SEAMS = null;

function guardarTurno() {
  const services = yarnCoreServices_();
  let snapshot;
  try {
    snapshot = services.readSnapshot();
  } catch (error) {
    return yarnCoreFailure_(services, 'read_failed', error.message, 'Settings');
  }

  if (!snapshot.valid) {
    const validationError = snapshot.errors[0] || { code: 'invalid_form', range: 'Settings' };
    return yarnCoreFailure_(services, validationError.code, validationError.code, validationError.range);
  }

  const lock = services.getLock();
  let locked = false;
  try {
    locked = lock.tryLock(5000);
    if (!locked) {
      services.toast('⏳ Guardado ocupado, reintentando…', 'Yarn');
      services.sleep(1000);
      locked = lock.tryLock(5000);
    }
    if (!locked) return yarnCoreFailure_(services, 'lock_timeout', 'Document lock unavailable.', 'Settings');

    const state = services.loadState();
    const plan = services.buildPlan(snapshot, state);
    services.applyPlan(state, plan);
    services.flush();
    services.toast(
      '✅ Guardado: ' + yarnDateKey_(snapshot.date) + ' — ' + plan.assignmentCount +
        ' asignaciones, ' + plan.weighingCount + ' descargas (' + plan.netKilograms + ' kg)',
      'Yarn'
    );
    return Object.freeze({ success: true, code: 'saved', plan: plan });
  } catch (error) {
    return yarnCoreFailure_(services, 'save_failed', error.message, 'DB_Asignaciones/DB_Descargas');
  } finally {
    if (locked) lock.releaseLock();
  }
}

function yarnCoreFailure_(services, code, reason, range) {
  services.logError('guardarTurno', code, reason, range);
  services.toast('❌ Error — ' + yarnCoreFailureMessage_(code) + '. Use Re-sincronizar.', 'Yarn');
  return Object.freeze({ success: false, code: code });
}

function yarnCoreFailureMessage_(code) {
  const messages = {
    invalid_date: 'Seleccioná fecha válida',
    unknown_title: 'Título no existe',
    empty_form: 'Completá una asignación o descarga',
    lock_timeout: 'Guardado ocupado'
  };
  return messages[code] || 'No se pudo guardar el turno';
}

function yarnCoreServices_() {
  const seams = YARN_SETTINGS_SEAMS || {};
  return {
    readSnapshot: seams.readSnapshot || yarnReadShiftSnapshot_,
    getLock: seams.getLock || function () { return LockService.getDocumentLock(); },
    sleep: seams.sleep || function (milliseconds) { Utilities.sleep(milliseconds); },
    loadState: seams.loadState || yarnLoadPersistenceState_,
    buildPlan: seams.buildPlan || yarnBuildPersistencePlan_,
    applyPlan: seams.applyPlan || yarnApplyPersistencePlan_,
    flush: seams.flush || function () { SpreadsheetApp.flush(); },
    toast: seams.toast || function (message, title) {
      SpreadsheetApp.getActiveSpreadsheet().toast(message, title, 5);
    },
    logError: seams.logError || yarnLogError_
  };
}
