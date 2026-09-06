/**
 * Persistence.test.gs — Pure-function checks for Yarn Settings DB mutation plans.
 * Run yarnRunPersistenceTests_ manually in Apps Script or through the local VM harness.
 */

function yarnPersistenceDate_() {
  return Object.freeze({ year: 2026, month: 9, day: 3 });
}

function yarnPersistenceTurno_() {
  return 'Día';
}

function yarnPersistenceSnapshot_(weighings) {
  return Object.freeze({
    date: yarnPersistenceDate_(),
    turno: yarnPersistenceTurno_(),
    assignments: Object.freeze([Object.freeze({
      machine: 'Retorcedora 1', cabos: 4, title: '9', fronts: 4,
      productionDay: 1000, productionShift: 333.33, lotsDay: 4.9,
      sourceRange: 'settings!C33:H33'
    })]),
    weighings: Object.freeze(weighings || [Object.freeze({
      machine: 'Retorcedora 1', discharge: 1, side: 'A', title: '9',
      grossWeight: 60, uses: 40, coneWeight: 0.037, bucketWeight: 15.2,
      sourceRange: 'settings!E50:H50'
    })])
  });
}

function yarnPersistedAssignment_(created) {
  return [
    '2026-09-03-Día-Retorcedora 1', new Date(2026, 8, 3), 'Día', 'Retorcedora 1',
    3, '9', 2, 500, 166.67, 2.45, created, 'old update', 'old@factory.bo',
    'settings!C33:H33'
  ];
}

function yarnPersistedWeighing_(created, side) {
  return [
    '2026-09-03-Día-Retorcedora 1-1-' + side, new Date(2026, 8, 3),
    'Día', 'Retorcedora 1', 1, side, '9', 50, 0, 0, 0, 50, created,
    'old update', 'old@factory.bo', 'settings!E50:H50'
  ];
}

function yarnPersistenceState_(assignments, weighings) {
  return Object.freeze({
    assignments: Object.freeze(assignments || []),
    weighings: Object.freeze(weighings || [])
  });
}

function yarnTestPersistenceResavePreservesCreated_() {
  const created = '2026-09-03 08:10:00';
  const plan = yarnBuildPersistencePlan_(
    yarnPersistenceSnapshot_(),
    yarnPersistenceState_([yarnPersistedAssignment_(created)], [yarnPersistedWeighing_(created, 'A')]),
    Object.freeze({ timestamp: '2026-09-03 09:00:00', editor: 'editor@factory.bo' })
  );

  yarnAssert_(plan.assignmentUpserts.length === 1, 'Re-save must update the matching assignment PK.');
  yarnAssert_(plan.weighingUpserts.length === 1, 'Re-save must update the matching weighing PK.');
  yarnAssert_(plan.assignmentUpserts[0].row[10] === created, 'Assignment creado must be preserved at index 10.');
  yarnAssert_(plan.weighingUpserts[0].row[12] === created, 'Weighing creado must be preserved at index 12.');
  yarnAssert_(plan.assignmentUpserts[0].row[11] === '2026-09-03 09:00:00', 'Assignment audit must refresh.');
  yarnAssert_(plan.weighingUpserts[0].row[14] === 'editor@factory.bo', 'Weighing editor must refresh.');
}

function yarnTestPersistenceRoundsNullTares_() {
  const snapshot = yarnPersistenceSnapshot_([Object.freeze({
    machine: 'Retorcedora 1', discharge: 1, side: 'A', title: '9',
    grossWeight: 10.005, uses: null, coneWeight: null, bucketWeight: null,
    sourceRange: 'settings!E50:H50'
  })]);
  const plan = yarnBuildPersistencePlan_(
    snapshot, yarnPersistenceState_(), Object.freeze({ timestamp: 'now', editor: 'unknown' })
  );

  yarnAssert_(plan.weighingUpserts[0].row[11] === 10.01,
    'Null tare values must become zero and net weight must round to two decimals at index 11.');
}

function yarnTestPersistenceCreatesNoBlankWeighings_() {
  const blankSlot = Object.freeze({
    machine: 'Retorcedora 1', discharge: 1, side: 'A', title: '', grossWeight: null,
    uses: 0, coneWeight: 0, bucketWeight: 0, sourceRange: 'settings!E50:H50'
  });
  const plan = yarnBuildPersistencePlan_(
    yarnPersistenceSnapshot_([blankSlot]), yarnPersistenceState_(),
    Object.freeze({ timestamp: 'now', editor: 'unknown' })
  );

  yarnAssert_(plan.weighingUpserts.length === 0, 'A blank gross weight must not create a DB row.');
  yarnAssert_(plan.weighingDeletes.length === 0, 'A blank gross weight without an existing PK must not delete anything.');
}

function yarnTestPersistenceDeletesOnlyClearedPk_() {
  const blankSlot = Object.freeze({
    machine: 'Retorcedora 1', discharge: 1, side: 'A', title: '', grossWeight: null,
    uses: 0, coneWeight: 0, bucketWeight: 0, sourceRange: 'settings!E50:H50'
  });
  const created = '2026-09-03 08:10:00';
  const plan = yarnBuildPersistencePlan_(
    yarnPersistenceSnapshot_([blankSlot]),
    yarnPersistenceState_([], [yarnPersistedWeighing_(created, 'A'), yarnPersistedWeighing_(created, 'B')]),
    Object.freeze({ timestamp: 'now', editor: 'unknown' })
  );

  yarnAssert_(plan.weighingDeletes.length === 1, 'EC-03 must delete exactly the cleared visible PK.');
  yarnAssert_(plan.weighingDeletes[0].key === '2026-09-03|Día|Retorcedora 1|1|A',
    'EC-03 must not delete a sibling weighing PK.');
}

function yarnTestPersistenceTurnoIsolation_() {
  var snapshotDia = yarnPersistenceSnapshot_();
  var snapshotTarde = Object.freeze({
    date: yarnPersistenceDate_(),
    turno: 'Tarde',
    assignments: snapshotDia.assignments,
    weighings: snapshotDia.weighings
  });
  var created = '2026-09-03 08:10:00';
  var state = yarnPersistenceState_([yarnPersistedAssignment_(created)], [yarnPersistedWeighing_(created, 'A')]);
  var planTarde = yarnBuildPersistencePlan_(snapshotTarde, state, Object.freeze({ timestamp: 'now', editor: 'unknown' }));
  // Same date+machine but different turno must be insert, not update
  yarnAssert_(planTarde.assignmentUpserts[0].rowNumber === null, 'Different turno must not match existing PK (insert).');
  yarnAssert_(planTarde.assignmentUpserts[0].key === '2026-09-03|Tarde|Retorcedora 1', 'Turno must be part of assignment key.');
  yarnAssert_(planTarde.weighingUpserts[0].key === '2026-09-03|Tarde|Retorcedora 1|1|A', 'Turno must be part of weighing key.');
}

function yarnTestPersistenceCompensatesInjectedWriteFailure_() {
  const assignmentSheet = yarnFakePersistenceSheet_([['header'], yarnPersistedAssignment_('created')]);
  const weighingSheet = yarnFakePersistenceSheet_([['header'], yarnPersistedWeighing_('created', 'A')]);
  weighingSheet.failNextSet = true;
  const plan = Object.freeze({
    assignmentUpserts: Object.freeze([Object.freeze({ rowNumber: 2, row: yarnPersistedAssignment_('created') })]),
    weighingUpserts: Object.freeze([Object.freeze({ rowNumber: 2, row: yarnPersistedWeighing_('created', 'A') })]),
    weighingDeletes: Object.freeze([])
  });
  plan.assignmentUpserts[0].row[4] = 99;
  const originalCabos = assignmentSheet.rows[1][4];
  let threw = false;
  try {
    yarnApplyPersistencePlan_({ assignmentSheet: assignmentSheet, weighingSheet: weighingSheet }, plan);
  } catch (error) {
    threw = true;
  }

  yarnAssert_(threw, 'The injected DB write failure must reach the caller.');
  yarnAssert_(assignmentSheet.rows[1][4] === originalCabos,
    'Compensation must restore prior affected rows after a later write fails.');
}

function yarnTestPersistenceFallsBackToUnknownEditor_() {
  yarnAssert_(yarnEditorEmail_() === 'unknown',
    'An unavailable active-user identity must use the unknown editor fallback.');
}

function yarnTestPersistenceHandlesOldSchemaRows_() {
  // Old 13/15 col rows without turno must be read with empty turno key, but new snapshot with turno must not collide
  var oldAssignment13 = ['2026-09-03-Retorcedora 1', new Date(2026, 8, 3), 'Retorcedora 1', 3, '9', 2, 500, 166.67, 2.45, 'created-old', 'old update', 'old@factory.bo', 'settings!C33:H33'];
  var oldWeighing15 = ['2026-09-03-Retorcedora 1-1-A', new Date(2026, 8, 3), 'Retorcedora 1', 1, 'A', '9', 50, 0, 0, 0, 50, 'created-old', 'old update', 'old@factory.bo', 'settings!E50:H50'];
  var keyA = yarnAssignmentKeyFromRow_(oldAssignment13);
  var keyW = yarnWeighingKeyFromRow_(oldWeighing15);
  yarnAssert_(keyA === '2026-09-03||Retorcedora 1', 'Old assignment row must produce empty turno segment.');
  yarnAssert_(keyW === '2026-09-03||Retorcedora 1|1|A', 'Old weighing row must produce empty turno segment.');
  // Old created extraction
  yarnAssert_(yarnExtractAssignmentCreated_(oldAssignment13) === 'created-old', 'Old assignment created at index 9.');
  yarnAssert_(yarnExtractWeighingCreated_(oldWeighing15) === 'created-old', 'Old weighing created at index 11.');
}

function yarnFakePersistenceSheet_(rows) {
  return {
    rows: rows.map(function (row) { return row.slice(); }),
    failNextSet: false,
    getLastRow: function () { return this.rows.length; },
    getRange: function (row, column, height, width) {
      const sheet = this;
      return {
        getValues: function () {
          const output = [];
          for (let offset = 0; offset < height; offset += 1) {
            output.push((sheet.rows[row - 1 + offset] || []).slice(column - 1, column - 1 + width));
          }
          return output;
        },
        setValues: function (values) {
          if (sheet.failNextSet) {
            sheet.failNextSet = false;
            throw new Error('injected write failure');
          }
          values.forEach(function (valuesRow, offset) {
            const target = sheet.rows[row - 1 + offset] || [];
            valuesRow.forEach(function (value, valueOffset) {
              target[column - 1 + valueOffset] = value;
            });
            sheet.rows[row - 1 + offset] = target;
          });
        }
      };
    },
    deleteRow: function (row) { this.rows.splice(row - 1, 1); },
    deleteRows: function (row, count) { this.rows.splice(row - 1, count); },
    insertRowBefore: function (row) { this.rows.splice(row - 1, 0, []); }
  };
}

function yarnRunPersistenceTests_() {
  const tests = [
    yarnTestPersistenceResavePreservesCreated_,
    yarnTestPersistenceRoundsNullTares_,
    yarnTestPersistenceCreatesNoBlankWeighings_,
    yarnTestPersistenceDeletesOnlyClearedPk_,
    yarnTestPersistenceTurnoIsolation_,
    yarnTestPersistenceCompensatesInjectedWriteFailure_,
    yarnTestPersistenceFallsBackToUnknownEditor_,
    yarnTestPersistenceHandlesOldSchemaRows_
  ];
  tests.forEach(function (test) { test(); });
  return tests.length + ' Persistence tests passed.';
}
