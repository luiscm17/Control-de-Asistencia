/**
 * Ingest.test.gs — Pure-function checks for the Yarn Settings shift snapshot.
 * Run yarnRunIngestTests_ manually in the Apps Script editor or in the local VM harness.
 */

function yarnAssert_(condition, message) {
  if (!condition) throw new Error(message);
}

function yarnBaseSnapshotInput_() {
  return {
    date: new Date(2026, 8, 3),
    standards: [['9', 250]],
    assignments: [
      ['Retorcedora 1', 4, '9', 4, 1000, 333.33, 4.9]
    ],
    weighings: [
      ['Retorcedora 1', 1, 'A', 60, 40, 0.037, 15.2]
    ]
  };
}

function yarnTestRejectsInvalidDate_() {
  const input = yarnBaseSnapshotInput_();
  input.date = '';
  const result = yarnBuildShiftSnapshot_(input);
  yarnAssert_(!result.valid, 'A missing F4 date must be invalid.');
  yarnAssert_(result.errors[0].code === YARN_SETTINGS_CONFIG.ERRORS.INVALID_DATE,
    'A missing F4 date must report INVALID_DATE.');
}

function yarnTestRejectsUnknownTitle_() {
  const input = yarnBaseSnapshotInput_();
  input.assignments[0][2] = 'unknown';
  const result = yarnBuildShiftSnapshot_(input);
  yarnAssert_(!result.valid, 'A populated unknown title must be invalid.');
  yarnAssert_(result.errors.some(function (error) {
    return error.code === YARN_SETTINGS_CONFIG.ERRORS.UNKNOWN_TITLE;
  }), 'An unknown title must report UNKNOWN_TITLE.');
}

function yarnTestRejectsEmptyForm_() {
  const input = yarnBaseSnapshotInput_();
  input.assignments = [['Retorcedora 1', '', '', '', '', '', '']];
  input.weighings = [['Retorcedora 1', 1, 'A', '', '', '', '']];
  const result = yarnBuildShiftSnapshot_(input);
  yarnAssert_(!result.valid, 'A form without an assignment or gross weight must be invalid.');
  yarnAssert_(result.errors.some(function (error) {
    return error.code === YARN_SETTINGS_CONFIG.ERRORS.EMPTY_FORM;
  }), 'An empty form must report EMPTY_FORM.');
}

function yarnTestExcludesHelpersAndKeepsVisiblePk_() {
  const input = yarnBaseSnapshotInput_();
  input.weighings.push(['Calculator helper', '', '', 999, '', '', '']);
  const result = yarnBuildShiftSnapshot_(input);
  yarnAssert_(result.valid, 'A non-slot helper row must not invalidate the input ranges.');
  yarnAssert_(result.weighings.length === 1, 'Only valid visible weighing PK metadata may enter the snapshot.');
  yarnAssert_(result.weighings[0].sourceRange === 'Settings!E50:H50',
    'Weighing source ranges must point to the persisted input cells only.');
}

function yarnTestRejectsInvalidNumericGrossOrTare_() {
  const grossInput = yarnBaseSnapshotInput_();
  grossInput.weighings[0][3] = 'not-a-number';
  const grossResult = yarnBuildShiftSnapshot_(grossInput);
  yarnAssert_(!grossResult.valid, 'A populated non-numeric gross weight must be invalid.');

  const tareInput = yarnBaseSnapshotInput_();
  tareInput.weighings[0][6] = 'not-a-number';
  const tareResult = yarnBuildShiftSnapshot_(tareInput);
  yarnAssert_(!tareResult.valid, 'A populated non-numeric tare must be invalid.');
}

function yarnTestBatchReadsOnlySnapshotRanges_() {
  const reads = [];
  const values = {
    F4: new Date(2026, 8, 3),
    'B10:C19': [['9', 250]],
    'B33:H42': [['Retorcedora 1', 4, '9', 4, 1000, 333.33, 4.9]],
    'B50:H157': [['Retorcedora 1', 1, 'A', 60, 40, 0.037, 15.2]]
  };
  const settings = {
    getRange: function (range) {
      reads.push(range);
      return {
        getValue: function () { return values[range]; },
        getValues: function () { return values[range]; }
      };
    }
  };
  const snapshot = yarnReadShiftSnapshot_({
    getSheetByName: function () { return settings; }
  });
  yarnAssert_(snapshot.valid, 'A valid batch-read form must produce a valid snapshot.');
  yarnAssert_(reads.join('|') === 'F4|B10:C19|B33:H42|B50:H157',
    'Ingest must batch-read only F4, Standards, assignments, and weighings.');
}

function yarnRunIngestTests_() {
  const tests = [
    yarnTestRejectsInvalidDate_,
    yarnTestRejectsUnknownTitle_,
    yarnTestRejectsEmptyForm_,
    yarnTestExcludesHelpersAndKeepsVisiblePk_,
    yarnTestRejectsInvalidNumericGrossOrTare_,
    yarnTestBatchReadsOnlySnapshotRanges_
  ];
  tests.forEach(function (test) { test(); });
  return tests.length + ' Ingest tests passed.';
}
