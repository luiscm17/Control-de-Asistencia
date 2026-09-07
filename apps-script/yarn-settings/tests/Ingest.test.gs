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
    turno: 'Día',
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

function yarnTestRejectsInvalidTurno_() {
  const input = yarnBaseSnapshotInput_();
  input.turno = '';
  const result = yarnBuildShiftSnapshot_(input);
  yarnAssert_(!result.valid, 'A missing F5 turno must be invalid.');
  yarnAssert_(result.errors.some(function (e) { return e.code === YARN_SETTINGS_CONFIG.ERRORS.INVALID_TURNO; }),
    'A missing F5 turno must report INVALID_TURNO.');
  var input2 = yarnBaseSnapshotInput_();
  input2.turno = 'noche';
  var r2 = yarnBuildShiftSnapshot_(input2);
  yarnAssert_(r2.valid && r2.turno === 'Noche', 'Turno normalization must be case-insensitive and canonical.');
  var input3 = yarnBaseSnapshotInput_();
  input3.turno = 'DIA';
  var r3 = yarnBuildShiftSnapshot_(input3);
  yarnAssert_(r3.valid && r3.turno === 'Día', 'Turno Dia without accent must normalize to Día.');
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
  var expectedPrefix = YARN_SETTINGS_CONFIG.SHEETS.SETTINGS + '!';
  yarnAssert_(result.weighings[0].sourceRange === expectedPrefix + 'E50:H50',
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
  var expectedTurno = YARN_SETTINGS_CONFIG.RANGES.TURNO;
  var expectedDate = YARN_SETTINGS_CONFIG.RANGES.DATE;
  const values = {};
  values[expectedDate] = new Date(2026, 8, 3);
  values[expectedTurno] = 'Día';
  values[YARN_SETTINGS_CONFIG.RANGES.STANDARDS] = [['9', 250]];
  values[YARN_SETTINGS_CONFIG.RANGES.ASSIGNMENTS] = [['Retorcedora 1', 4, '9', 4, 1000, 333.33, 4.9]];
  values[YARN_SETTINGS_CONFIG.RANGES.WEIGHINGS] = [['Retorcedora 1', 1, 'A', 60, 40, 0.037, 15.2]];
  const settings = {
    getName: function () { return YARN_SETTINGS_CONFIG.SHEETS.SETTINGS; },
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
  yarnAssert_(snapshot.turno === 'Día', 'Batch-read must capture turno.');
  var expectedReads = [expectedDate, expectedTurno, YARN_SETTINGS_CONFIG.RANGES.STANDARDS, YARN_SETTINGS_CONFIG.RANGES.ASSIGNMENTS, YARN_SETTINGS_CONFIG.RANGES.WEIGHINGS].join('|');
  yarnAssert_(reads.join('|') === expectedReads,
    'Ingest must batch-read F4+F5, Standards, assignments, and weighings. Got: ' + reads.join('|'));
}

function yarnRunIngestTests_() {
  const tests = [
    yarnTestRejectsInvalidDate_,
    yarnTestRejectsInvalidTurno_,
    yarnTestRejectsUnknownTitle_,
    yarnTestRejectsEmptyForm_,
    yarnTestExcludesHelpersAndKeepsVisiblePk_,
    yarnTestRejectsInvalidNumericGrossOrTare_,
    yarnTestBatchReadsOnlySnapshotRanges_
  ];
  tests.forEach(function (test) { test(); });
  return tests.length + ' Ingest tests passed.';
}
