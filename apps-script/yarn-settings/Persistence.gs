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
    const key = yarnAssignmentKey_(snapshot.date, snapshot.turno, assignment.machine);
    const existing = assignmentIndex[key];
    assignmentUpserts.push(Object.freeze({
      key: key,
      rowNumber: existing ? existing.rowNumber : null,
      row: yarnAssignmentRow_(snapshot.date, snapshot.turno, assignment, existing ? yarnExtractAssignmentCreated_(existing.values) : timestamp,
        timestamp, editor)
    }));
  });

  (snapshot.weighings || []).forEach(function (weighing) {
    const key = yarnWeighingKey_(snapshot.date, snapshot.turno, weighing.machine, weighing.discharge, weighing.side);
    const existing = weighingIndex[key];
    if (weighing.grossWeight === null || weighing.grossWeight === undefined) {
      if (existing) weighingDeletes.push(Object.freeze({ key: key, rowNumber: existing.rowNumber, row: existing.values }));
      return;
    }
    weighingUpserts.push(Object.freeze({
      key: key,
      rowNumber: existing ? existing.rowNumber : null,
      row: yarnWeighingRow_(snapshot.date, snapshot.turno, weighing, existing ? yarnExtractWeighingCreated_(existing.values) : timestamp,
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
      return total + mutation.row[11];
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

function yarnAssignmentRow_(date, turno, assignment, created, timestamp, editor) {
  const dateKey = yarnDateKey_(date);
  var safeTurno = turno || '';
  return [
    dateKey + '-' + safeTurno + '-' + assignment.machine, yarnDateValue_(date), safeTurno, assignment.machine, assignment.cabos,
    assignment.title, assignment.fronts, assignment.productionDay, assignment.productionShift,
    assignment.lotesDay, created, timestamp, editor, assignment.sourceRange
  ];
}

function yarnWeighingRow_(date, turno, weighing, created, timestamp, editor) {
  const dateKey = yarnDateKey_(date);
  var safeTurno = turno || '';
  const netWeight = yarnRound2_(Number(weighing.grossWeight) -
    (Number(weighing.uses || 0) * Number(weighing.coneWeight || 0) + Number(weighing.bucketWeight || 0)));
  return [
    dateKey + '-' + safeTurno + '-' + weighing.machine + '-' + weighing.discharge + '-' + weighing.side,
    yarnDateValue_(date), safeTurno, weighing.machine, weighing.discharge, weighing.side, weighing.title,
    weighing.grossWeight, weighing.uses || 0, weighing.coneWeight || 0, weighing.bucketWeight || 0,
    netWeight, created, timestamp, editor, weighing.sourceRange
  ];
}

function yarnAssignmentKey_(date, turno, machine) {
  return yarnDateKey_(date) + '|' + (turno || '') + '|' + machine;
}

function yarnWeighingKey_(date, turno, machine, discharge, side) {
  return yarnDateKey_(date) + '|' + (turno || '') + '|' + machine + '|' + discharge + '|' + side;
}

function yarnAssignmentKeyFromRow_(row) {
  if (!row || !row[1]) return '';
  // New schema 14 cols: fecha at 1, turno at 2, machine at 3
  // Old schema 13 cols: fecha at 1, machine at 2
  if (row.length >= 14) {
    return row[2] !== undefined && row[3] ? yarnDateKey_(row[1]) + '|' + yarnText_(row[2]) + '|' + yarnText_(row[3]) : '';
  }
  return row[2] ? yarnDateKey_(row[1]) + '|' + '' + '|' + yarnText_(row[2]) : '';
}

function yarnWeighingKeyFromRow_(row) {
  if (!row || !row[1]) return '';
  // New schema 16 cols: fecha 1, turno 2, machine 3, discharge 4, side 5
  // Old schema 15 cols: fecha 1, machine 2, discharge 3, side 4
  if (row.length >= 16) {
    return row[2] !== undefined && row[3] !== '' && row[4] !== '' && row[5] ?
      yarnDateKey_(row[1]) + '|' + yarnText_(row[2]) + '|' + yarnText_(row[3]) + '|' + row[4] + '|' + yarnText_(row[5]).toUpperCase() : '';
  }
  return row[2] && row[3] !== '' && row[4] ?
    yarnDateKey_(row[1]) + '|' + '' + '|' + yarnText_(row[2]) + '|' + row[3] + '|' + yarnText_(row[4]).toUpperCase() : '';
}

function yarnExtractAssignmentCreated_(values) {
  if (!values) return '';
  if (values.length >= 14) return values[10];
  return values[9];
}

function yarnExtractWeighingCreated_(values) {
  if (!values) return '';
  if (values.length >= 16) return values[12];
  return values[11];
}

function yarnDateKey_(date) {
  if (date && typeof date.year === 'number') {
    return date.year + '-' + yarnPad2_(date.month) + '-' + yarnPad2_(date.day);
  }
  var isDate = date && typeof date.getTime === 'function' && Object.prototype.toString.call(date) === '[object Date]';
  if (!isDate || isNaN(date.getTime())) return '';
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
    yarnLogError_('persistence.rollback', 'rollback_failure', error.message, YARN_SETTINGS_CONFIG.SHEETS.ASSIGNMENTS + '/' + YARN_SETTINGS_CONFIG.SHEETS.WEIGHINGS);
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
