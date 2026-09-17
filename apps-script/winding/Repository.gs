/**
 * Repository.gs — Locked, indexed persistence for winding item snapshots.
 *
 * All DB and Errors writes pass through the document lock. Snapshot records
 * are upserted by id; records absent from a form snapshot are never deleted.
 */

function windingPersistSnapshot_(snapshot, spreadsheet) {
  const ss = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  if (!snapshot || !snapshot.ok) {
    return { success: false, code: snapshot ? snapshot.code : 'invalid_snapshot', inserted: 0, updated: 0 };
  }

  return windingWithDocumentLock_(function () {
    const dataSheet = ss.getSheetByName(WINDING_CONFIG.SHEETS.DATA);
    if (!dataSheet) throw new Error('Data sheet is unavailable. Run windingSetup first.');
    const indexed = windingLoadRecordIndex_(dataSheet);
    if (!indexed.ok) {
      windingAppendErrorUnlocked_(ss, 'repository.index', 'Duplicate id found in db_embolsado.', windingEditorEmail_());
      return { success: false, code: indexed.code, inserted: 0, updated: 0 };
    }

    const auditTimestamp = windingAuditTimestamp_();
    const editor = windingEditorEmail_();
    const plan = windingBuildUpsertPlan_(snapshot.records, indexed.index, auditTimestamp, editor);
    plan.updates.forEach(function (mutation) {
      dataSheet.getRange(mutation.rowNumber, 1, 1, WINDING_CONFIG.DB_HEADERS.length)
        .setValues([mutation.values]);
    });
    if (plan.appends.length) {
      dataSheet.getRange(dataSheet.getLastRow() + 1, 1, plan.appends.length,
        WINDING_CONFIG.DB_HEADERS.length).setValues(plan.appends);
    }
    (snapshot.errors || []).forEach(function (error) {
      windingAppendErrorUnlocked_(ss, error.context, error.detail, editor);
    });
    SpreadsheetApp.flush();
    return { success: true, code: 'ok', inserted: plan.appends.length, updated: plan.updates.length };
  }, ss);
}

function windingWithDocumentLock_(callback, spreadsheet) {
  const lock = LockService.getDocumentLock();
  let locked = false;
  try {
    locked = lock.tryLock(WINDING_CONFIG.LOCK.WAIT_MS);
    if (!locked) {
      Utilities.sleep(1000);
      locked = lock.tryLock(WINDING_CONFIG.LOCK.WAIT_MS);
    }
    if (!locked) return windingLockTimeoutResult_();
    return callback();
  } catch (error) {
    Logger.log('winding repository error: ' + error.message);
    return { success: false, code: 'repository_error', inserted: 0, updated: 0, detail: error.message };
  } finally {
    if (locked) {
      try { lock.releaseLock(); } catch (error) {}
    }
  }
}

function windingLockTimeoutResult_() {
  return { success: false, code: 'lock_timeout', inserted: 0, updated: 0 };
}

function windingLoadRecordIndex_(sheet) {
  const lastRow = sheet.getLastRow();
  const rows = lastRow < 2 ? [] : sheet.getRange(2, 1, lastRow - 1,
    WINDING_CONFIG.DB_HEADERS.length).getValues();
  return windingBuildRecordIndex_(rows);
}

function windingBuildRecordIndex_(rows) {
  const index = {};
  for (let indexOffset = 0; indexOffset < rows.length; indexOffset += 1) {
    const id = String(rows[indexOffset][WINDING_CONFIG.IDX.ID] || '').trim();
    if (!id) continue;
    if (index[id]) {
      return { ok: false, code: 'duplicate_id' };
    }
    index[id] = { rowNumber: indexOffset + 2, values: rows[indexOffset] };
  }
  return { ok: true, index: index };
}

function windingBuildUpsertPlan_(records, index, timestamp, editor) {
  const updates = [];
  const appends = [];
  (records || []).forEach(function (record) {
    const existing = index[record.id];
    const values = windingBuildRecordValues_(record, timestamp, editor);
    if (existing) {
      updates.push({ rowNumber: existing.rowNumber, values: values });
    } else {
      appends.push(values);
    }
  });
  return { updates: updates, appends: appends, deletes: [] };
}

function windingBuildRecordValues_(record, timestamp, editor) {
  return [record.id, record.fecha, record.turno, record.item, record.supervisor,
    record.color, record.lote, record.titulo, record.metaKg].concat(record.operators)
    .concat([timestamp, editor]);
}

function windingAppendErrorUnlocked_(spreadsheet, context, detail, editor) {
  const errors = spreadsheet.getSheetByName(WINDING_CONFIG.SHEETS.ERRORS);
  if (!errors) throw new Error('Errors sheet is unavailable. Run windingSetup first.');
  errors.getRange(errors.getLastRow() + 1, 1, 1, WINDING_CONFIG.ERRORS_HEADERS.length)
    .setValues([[windingAuditTimestamp_(), context, detail, editor || windingEditorEmail_()]]);
}

function windingAuditTimestamp_() {
  return Utilities.formatDate(new Date(), WINDING_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
}

function windingEditorEmail_() {
  try {
    const active = Session.getActiveUser().getEmail();
    if (active) return active;
  } catch (error) {}
  try {
    const effective = Session.getEffectiveUser().getEmail();
    if (effective) return effective;
  } catch (error) {}
  return 'unknown';
}
