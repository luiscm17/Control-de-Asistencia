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
  // Per-row skip: one unknown title among two assignments must not abort the whole shift (I6)
  const input = yarnBaseSnapshotInput_();
  input.assignments = [
    ['Retorcedora 1', 4, 'unknown', 4, 1000, 333.33, 4.9],
    ['Retorcedora 2', 2, '9', 3, 500, 166.67, 2.45]
  ];
  input.weighings = [
    ['Retorcedora 2', 1, 'A', 60, 40, 0.037, 15.2]
  ];
  const result = yarnBuildShiftSnapshot_(input);
  yarnAssert_(result.valid, 'One UNKNOWN_TITLE must not invalidate the whole snapshot when another valid row exists (per-row skip).');
  yarnAssert_(result.assignments.length === 1 && result.assignments[0].machine === 'Retorcedora 2',
    'Only the valid assignment must survive an UNKNOWN_TITLE per-row skip.');
  yarnAssert_(result.errors.some(function (e) { return e.code === YARN_SETTINGS_CONFIG.ERRORS.UNKNOWN_TITLE; }),
    'An unknown title must still report UNKNOWN_TITLE as per-row error.');
  // Sole unknown title with no valid rows -> EMPTY_FORM blocking
  const input2 = yarnBaseSnapshotInput_();
  input2.assignments[0][2] = 'unknown';
  input2.weighings = [['Retorcedora 1', 1, 'A', '', '', '', '']];
  const r2 = yarnBuildShiftSnapshot_(input2);
  yarnAssert_(!r2.valid, 'Sole unknown title with no valid rows must be invalid via EMPTY_FORM.');
  yarnAssert_(r2.errors.some(function (e) { return e.code === YARN_SETTINGS_CONFIG.ERRORS.EMPTY_FORM; }),
    'Empty form after per-row skips must report EMPTY_FORM.');
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
  // Per-row skip: invalid gross/tare on one weighing must not abort sibling weighings
  const grossInput = yarnBaseSnapshotInput_();
  grossInput.weighings = [
    ['Retorcedora 1', 1, 'A', 'not-a-number', 40, 0.037, 15.2],
    ['Retorcedora 1', 1, 'B', 60, 40, 0.037, 15.2]
  ];
  const grossResult = yarnBuildShiftSnapshot_(grossInput);
  yarnAssert_(grossResult.valid, 'Invalid gross on one weighing must be per-row skip, not whole-snapshot invalid.');
  yarnAssert_(grossResult.weighings.length === 1 && grossResult.weighings[0].side === 'B',
    'Only the valid weighing PK must survive INVALID_GROSS_WEIGHT per-row skip.');
  yarnAssert_(grossResult.errors.some(function (e) { return e.code === YARN_SETTINGS_CONFIG.ERRORS.INVALID_GROSS_WEIGHT; }),
    'INVALID_GROSS_WEIGHT must be reported per-row.');

  const tareInput = yarnBaseSnapshotInput_();
  tareInput.weighings = [
    ['Retorcedora 1', 1, 'A', 60, 40, 0.037, 'not-a-number'],
    ['Retorcedora 1', 1, 'B', 60, 40, 0.037, 15.2]
  ];
  const tareResult = yarnBuildShiftSnapshot_(tareInput);
  yarnAssert_(tareResult.valid, 'Invalid tare on one weighing must be per-row skip.');
  yarnAssert_(tareResult.weighings.length === 1 && tareResult.weighings[0].side === 'B',
    'Only valid tare rows must survive INVALID_TARE per-row skip.');
  yarnAssert_(tareResult.errors.some(function (e) { return e.code === YARN_SETTINGS_CONFIG.ERRORS.INVALID_TARE; }),
    'INVALID_TARE must be reported per-row.');
}

function yarnTestNormalizesSideLadoAB_() {
  const input = yarnBaseSnapshotInput_();
  input.weighings = [
    ['Retorcedora 1', 1, 'LADO A', 60, 40, 0.037, 15.2],
    ['Retorcedora 1', 2, 'lado b', 50, 30, 0.037, 15.2],
    ['Retorcedora 1', 3, '  A  ', 55, 35, 0.037, 15.2]
  ];
  const result = yarnBuildShiftSnapshot_(input);
  yarnAssert_(result.valid, 'LADO A / LADO B / trimmed A must be accepted as visible PK.');
  yarnAssert_(result.weighings.length === 3, 'All three normalized sides must produce weighings.');
  yarnAssert_(result.weighings[0].side === 'A' && result.weighings[1].side === 'B' && result.weighings[2].side === 'A',
    'Sides must be canonicalized to A/B after normalization.');
}

function yarnTestParsesBlockLayout_() {
  const input = yarnBaseSnapshotInput_();
  input.assignments = [
    ['Retorcedora 1', 4, '9', 4, 1000, 333.33, 4.9],
    ['Retorcedora 2', 2, '9', 3, 500, 166.67, 2.45]
  ];
  // Block-per-machine vertical layout: headers + Descarga#/Lado headers + 8 data rows per machine.
  // B=descarga, C=lado, D=titulo, E=gross, F=usos, G=cone, H=bucket (I neto excluded from B50:H157)
  input.weighings = [
    ['RETORCEDORA 1', '', '', '', '', '', ''],
    ['Descarga #', 'Lado', 'Título', 'Peso Bruto', 'Usos', 'Peso Cono', 'Peso Tacho'],
    ['1', 'Lado A', '9', '57.3', '27', '0.037', '15.2'],
    ['2', 'Lado A', '9', '81.45', '27', '0.037', '15.2'],
    ['1', 'Lado B', '9', '55.4', '27', '0.037', '15.2'],
    ['', '', '', '', '', '', ''],
    ['RETORCEDORA 2', '', '', '', '', '', ''],
    ['Descarga #', 'Lado', 'Título', 'Peso Bruto', 'Usos', 'Peso Cono', 'Peso Tacho'],
    ['1', 'Lado A', '9', '60', '40', '0.037', '15.2'],
    ['2', 'Lado B', '9', '70', '40', '0.037', '15.2']
  ];
  const result = yarnBuildShiftSnapshot_(input);
  yarnAssert_(result.valid, 'Block layout must be valid (blocking only on date/turno/empty/tooMany).');
  yarnAssert_(result.weighings.length === 5, 'Block layout must parse 5 weighings (3 for R1 + 2 for R2), got ' + result.weighings.length);
  yarnAssert_(result.weighings[0].machine === 'Retorcedora 1' && result.weighings[0].discharge === 1 && result.weighings[0].side === 'A' && result.weighings[0].grossWeight === 57.3,
    'First block weighing must map B=1 C=Lado A -> machine Retorcedora 1 discharge 1 side A gross 57.3');
  yarnAssert_(result.weighings[1].machine === 'Retorcedora 1' && result.weighings[1].discharge === 2 && result.weighings[1].side === 'A',
    'Second weighing in first block must still be Retorcedora 1');
  yarnAssert_(result.weighings[2].machine === 'Retorcedora 1' && result.weighings[2].side === 'B' && result.weighings[2].discharge === 1,
    'Lado B in first block must be Retorcedora 1 side B');
  yarnAssert_(result.weighings[3].machine === 'Retorcedora 2' && result.weighings[3].side === 'A',
    'First weighing after RETORCEDORA 2 header must be Retorcedora 2');
  yarnAssert_(result.weighings[4].machine === 'Retorcedora 2' && result.weighings[4].side === 'B',
    'Block layout side Lado B must normalize to B for second machine');
  // Verify LADO A normalization inside block (already covered but explicit)
  yarnAssert_(result.weighings[0].side === 'A' && result.weighings[2].side === 'B',
    'Block LADO A/B must canonicalize to A/B');
  // Verify title comes from assignment map, not row D
  yarnAssert_(result.weighings[0].title === '9' && result.weighings[3].title === '9',
    'Weighing title must come from titleByMachine assignment map');
  // Verify per-row invalid still works in block mode: one bad gross in block must not kill others
  var badInput = yarnBaseSnapshotInput_();
  badInput.assignments = [['Retorcedora 1', 4, '9', 4, 100, 33, 1]];
  badInput.weighings = [
    ['RETORCEDORA 1', '', '', '', '', '', ''],
    ['Descarga #', 'Lado', 'Título', 'Peso Bruto', 'Usos', 'Peso Cono', 'Peso Tacho'],
    ['1', 'Lado A', '9', 'not-a-number', '27', '0.037', '15.2'],
    ['1', 'Lado B', '9', '55.4', '27', '0.037', '15.2']
  ];
  var badResult = yarnBuildShiftSnapshot_(badInput);
  yarnAssert_(badResult.valid && badResult.weighings.length === 1 && badResult.weighings[0].side === 'B',
    'Invalid gross in block mode must be per-row skip');
  yarnAssert_(badResult.errors.some(function (e) { return e.code === YARN_SETTINGS_CONFIG.ERRORS.INVALID_GROSS_WEIGHT; }),
    'Block mode must report INVALID_GROSS_WEIGHT per-row');
}

function yarnTestParsesBlockLayoutWithoutInitialHeader_() {
  // Real envelope B50:H157 starts at data rows for Retorcedora 1 (header at row 48 outside range)
  // Ingest defaults currentMachine to Retorcedora 1 before first in-range header.
  const input = yarnBaseSnapshotInput_();
  input.assignments = [
    ['Retorcedora 1', 4, '9', 4, 1000, 333, 4.9],
    ['Retorcedora 2', 2, '9', 3, 500, 166, 2.45]
  ];
  input.weighings = [
    ['1', 'Lado A', '9', '57.3', '27', '0.037', '15.2'],
    ['2', 'Lado A', '9', '81.45', '27', '0.037', '15.2'],
    ['1', 'Lado B', '9', '55.4', '27', '0.037', '15.2'],
    ['', '', '', '', '', '', ''],
    ['RETORCEDORA 2', '', '', '', '', '', ''],
    ['Descarga #', 'Lado', 'Título', 'Peso Bruto', 'Usos', 'Peso Cono', 'Peso Tacho'],
    ['1', 'Lado A', '9', '60', '40', '0.037', '15.2']
  ];
  const result = yarnBuildShiftSnapshot_(input);
  yarnAssert_(result.valid, 'Block without initial header must be valid via default Retorcedora 1');
  yarnAssert_(result.weighings.length === 4, 'Must parse 4 weighings (3 implicit R1 + 1 explicit R2)');
  yarnAssert_(result.weighings[0].machine === 'Retorcedora 1' && result.weighings[2].machine === 'Retorcedora 1',
    'First three rows before RETORCEDORA 2 header must default to Retorcedora 1');
  yarnAssert_(result.weighings[3].machine === 'Retorcedora 2',
    'Row after RETORCEDORA 2 header must be Retorcedora 2');
}

function yarnTestMissingWeighingTitleIsPerRow_() {
  const input = yarnBaseSnapshotInput_();
  input.assignments = [
    ['Retorcedora 1', 4, '9', 4, 1000, 333.33, 4.9]
  ];
  input.weighings = [
    ['Retorcedora 1', 1, 'A', 60, 40, 0.037, 15.2],
    ['Retorcedora 9', 1, 'A', 60, 40, 0.037, 15.2]
  ];
  const result = yarnBuildShiftSnapshot_(input);
  yarnAssert_(result.valid, 'MISSING_WEIGHING_TITLE must be per-row skip, not whole-snapshot invalid.');
  yarnAssert_(result.weighings.length === 1 && result.weighings[0].machine === 'Retorcedora 1',
    'Only weighings whose machine has a valid assignment title must survive.');
  yarnAssert_(result.errors.some(function (e) { return e.code === YARN_SETTINGS_CONFIG.ERRORS.MISSING_WEIGHING_TITLE; }),
    'Missing weighing title must be reported as per-row error.');
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
    yarnTestNormalizesSideLadoAB_,
    yarnTestParsesBlockLayout_,
    yarnTestParsesBlockLayoutWithoutInitialHeader_,
    yarnTestMissingWeighingTitleIsPerRow_,
    yarnTestBatchReadsOnlySnapshotRanges_
  ];
  tests.forEach(function (test) { test(); });
  return tests.length + ' Ingest tests passed.';
}
