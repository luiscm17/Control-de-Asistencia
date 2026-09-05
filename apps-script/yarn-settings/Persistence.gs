/**
 * Persistence.gs — Indexed, auditable mutation plans for the Yarn Settings DBs.
 * All callers must hold the document lock before loading state and applying a plan.
 */

function yarnLoadPersistenceState_(spreadsheet) {
  const ss = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  const assignmentSheet = ss.getSheetByName(YARN_SETTINGS_CONFIG.SHEETS.ASSIGNMENTS);
  const weighingSheet = ss.getSheetByName(YARN_SETTINGS_CONFIG.SHEETS.WEIGHINGS);
  if (!assignmentSheet || !weighingSheet) throw new Error('Yarn database sheets are unavailable.');

  return Object.freeze({
    assignmentSheet: assignmentSheet,
    weighingSheet: weighingSheet,
    assignments: yarnReadPersistedRows_(assignmentSheet, YARN_SETTINGS_CONFIG.ASSIGNMENT_HEADERS.length),
    weighings: yarnReadPersistedRows_(weighingSheet, YARN_SETTINGS_CONFIG.WEIGHING_HEADERS.length)
  });
}

function yarnReadPersistedRows_(sheet, width) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, width).getValues().map(function (values, index) {
    return Object.freeze({ rowNumber: index + 2, values: values });
  });
}

function yarnBuildPersistencePlan_(snapshot, persistedState, audit) {
  const state = yarnNormalizePersistenceState_(persistedState || {});
  const context = audit || {};
  const timestamp = context.timestamp || yarnAuditTimestamp_();
  const editor = context.editor || yarnEditorEmail_();
  const assignmentIndex = yarnIndexPersistedRows_(state.assignments, yarnAssignmentKeyFromRow_);
  const weighingIndex = yarnIndexPersistedRows_(state.weighings, yarnWeighingKeyFromRow_);
  const assignmentUpserts = [];
  const weighingUpserts = [];
  const weighingDeletes = [];

  (snapshot.assignments || []).forEach(function (assignment) {
    const key = yarnAssignmentKey_(snapshot.date, assignment.machine);
    const existing = assignmentIndex[key];
    assignmentUpserts.push(Object.freeze({
      key: key,
      rowNumber: existing ? existing.rowNumber : null,
      row: yarnAssignmentRow_(snapshot.date, assignment, existing ? existing.values[9] : timestamp,
        timestamp, editor)
    }));
  });

  (snapshot.weighings || []).forEach(function (weighing) {
    const key = yarnWeighingKey_(snapshot.date, weighing.machine, weighing.discharge, weighing.side);
    const existing = weighingIndex[key];
    if (weighing.grossWeight === null || weighing.grossWeight === undefined) {
      if (existing) weighingDeletes.push(Object.freeze({ key: key, rowNumber: existing.rowNumber, row: existing.values }));
      return;
    }
    weighingUpserts.push(Object.freeze({
      key: key,
      rowNumber: existing ? existing.rowNumber : null,
      row: yarnWeighingRow_(snapshot.date, weighing, existing ? existing.values[11] : timestamp,
        timestamp, editor)
    }));
  });

  return Object.freeze({
    assignmentUpserts: Object.freeze(assignmentUpserts),
    weighingUpserts: Object.freeze(weighingUpserts),
    weighingDeletes: Object.freeze(weighingDeletes),
    assignmentCount: assignmentUpserts.length,
    weighingCount: weighingUpserts.length,
    netKilograms: yarnRound2_(weighingUpserts.reduce(function (total, mutation) {
      return total + mutation.row[10];
    }, 0))
  });
}

function yarnNormalizePersistenceState_(state) {
  return Object.freeze({
    assignments: (state.assignments || []).map(function (entry, index) {
      return Array.isArray(entry) ? { rowNumber: index + 2, values: entry } : entry;
    }),
    weighings: (state.weighings || []).map(function (entry, index) {
      return Array.isArray(entry) ? { rowNumber: index + 2, values: entry } : entry;
    })
  });
}

function yarnIndexPersistedRows_(rows, keyForRow) {
  return rows.reduce(function (index, entry) {
    const key = keyForRow(entry.values);
    if (key) index[key] = entry;
    return index;
  }, {});
}

function yarnAssignmentRow_(date, assignment, created, timestamp, editor) {
  const dateKey = yarnDateKey_(date);
  return [
    dateKey + '-' + assignment.machine, yarnDateValue_(date), assignment.machine, assignment.cabos,
    assignment.title, assignment.fronts, assignment.productionDay, assignment.productionShift,
    assignment.lotsDay, created, timestamp, editor, assignment.sourceRange
  ];
}

function yarnWeighingRow_(date, weighing, created, timestamp, editor) {
  const dateKey = yarnDateKey_(date);
  const netWeight = yarnRound2_(Number(weighing.grossWeight) -
    (Number(weighing.uses || 0) * Number(weighing.coneWeight || 0) + Number(weighing.bucketWeight || 0)));
  return [
    dateKey + '-' + weighing.machine + '-' + weighing.discharge + '-' + weighing.side,
    yarnDateValue_(date), weighing.machine, weighing.discharge, weighing.side, weighing.title,
    weighing.grossWeight, weighing.uses || 0, weighing.coneWeight || 0, weighing.bucketWeight || 0,
    netWeight, created, timestamp, editor, weighing.sourceRange
  ];
}

function yarnAssignmentKey_(date, machine) {
  return yarnDateKey_(date) + '|' + machine;
}

function yarnWeighingKey_(date, machine, discharge, side) {
  return yarnDateKey_(date) + '|' + machine + '|' + discharge + '|' + side;
}

function yarnAssignmentKeyFromRow_(row) {
  return row && row[1] && row[2] ? yarnDateKey_(row[1]) + '|' + yarnText_(row[2]) : '';
}

function yarnWeighingKeyFromRow_(row) {
  return row && row[1] && row[2] && row[3] !== '' && row[4] ?
    yarnDateKey_(row[1]) + '|' + yarnText_(row[2]) + '|' + row[3] + '|' + yarnText_(row[4]).toUpperCase() : '';
}

function yarnDateKey_(date) {
  if (date && typeof date.year === 'number') {
    return date.year + '-' + yarnPad2_(date.month) + '-' + yarnPad2_(date.day);
  }
  if (!(date instanceof Date) || isNaN(date.getTime())) return '';
  if (typeof Utilities !== 'undefined' && Utilities.formatDate) {
    return Utilities.formatDate(date, YARN_SETTINGS_CONFIG.TIMEZONE, 'yyyy-MM-dd');
  }
  return date.getFullYear() + '-' + yarnPad2_(date.getMonth() + 1) + '-' + yarnPad2_(date.getDate());
}

function yarnDateValue_(date) {
  return new Date(date.year, date.month - 1, date.day);
}

function yarnPad2_(value) {
  return value < 10 ? '0' + value : String(value);
}

function yarnRound2_(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function yarnApplyPersistencePlan_(state, plan) {
  const receipt = {
    assignmentSheet: state.assignmentSheet,
    weighingSheet: state.weighingSheet,
    assignmentOriginals: [],
    weighingOriginals: [],
    weighingDeletes: [],
    appendedAssignments: 0,
    appendedWeighings: 0
  };
  try {
    yarnApplyUpserts_(state.assignmentSheet, plan.assignmentUpserts, YARN_SETTINGS_CONFIG.ASSIGNMENT_HEADERS.length,
      receipt.assignmentOriginals, function () { receipt.appendedAssignments += 1; });
    yarnApplyUpserts_(state.weighingSheet, plan.weighingUpserts, YARN_SETTINGS_CONFIG.WEIGHING_HEADERS.length,
      receipt.weighingOriginals, function () { receipt.appendedWeighings += 1; });
    yarnApplyDeletes_(state.weighingSheet, plan.weighingDeletes, receipt.weighingDeletes);
    return receipt;
  } catch (error) {
    yarnCompensatePersistence_(receipt);
    throw error;
  }
}

function yarnApplyUpserts_(sheet, mutations, width, originals, appended) {
  mutations.forEach(function (mutation) {
    if (mutation.rowNumber) {
      const range = sheet.getRange(mutation.rowNumber, 1, 1, width);
      originals.push({ rowNumber: mutation.rowNumber, row: range.getValues()[0] });
      range.setValues([mutation.row]);
      return;
    }
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, width).setValues([mutation.row]);
    appended();
  });
}

function yarnApplyDeletes_(sheet, mutations, deleted) {
  mutations.slice().sort(function (left, right) { return right.rowNumber - left.rowNumber; })
    .forEach(function (mutation) {
      sheet.deleteRow(mutation.rowNumber);
      deleted.push(mutation);
    });
}

function yarnCompensatePersistence_(receipt) {
  try {
    yarnRemoveAppendedRows_(receipt.assignmentSheet, receipt.appendedAssignments);
    yarnRemoveAppendedRows_(receipt.weighingSheet, receipt.appendedWeighings);
    yarnRestoreUpdatedRows_(receipt.assignmentSheet, receipt.assignmentOriginals, []);
    yarnRestoreUpdatedRows_(receipt.weighingSheet, receipt.weighingOriginals, receipt.weighingDeletes);
    yarnRestoreDeletedRows_(receipt.weighingSheet, receipt.weighingDeletes);
    return true;
  } catch (error) {
    yarnLogError_('persistence.rollback', 'rollback_failure', error.message, 'DB_Asignaciones/DB_Descargas');
    return false;
  }
}

function yarnRemoveAppendedRows_(sheet, count) {
  if (!count) return;
  const start = sheet.getLastRow() - count + 1;
  sheet.deleteRows(start, count);
}

function yarnRestoreUpdatedRows_(sheet, originals, deleted) {
  originals.forEach(function (original) {
    const movedByDeletes = deleted.filter(function (removed) {
      return removed.rowNumber < original.rowNumber;
    }).length;
    sheet.getRange(original.rowNumber - movedByDeletes, 1, 1, original.row.length).setValues([original.row]);
  });
}

function yarnRestoreDeletedRows_(sheet, deleted) {
  deleted.slice().sort(function (left, right) { return left.rowNumber - right.rowNumber; })
    .forEach(function (mutation) {
      sheet.insertRowBefore(mutation.rowNumber);
      sheet.getRange(mutation.rowNumber, 1, 1, mutation.row.length).setValues([mutation.row]);
    });
}
