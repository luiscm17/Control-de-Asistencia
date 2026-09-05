/**
 * Ingest.gs — Batch extraction and validation for the Yarn Settings shift form.
 * Only Settings!F4, B10:C19, B33:H42, and B50:H157 are read by this module.
 */

function yarnReadShiftSnapshot_(spreadsheet) {
  const ss = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  const settings = ss.getSheetByName(YARN_SETTINGS_CONFIG.SHEETS.SETTINGS);
  if (!settings) throw new Error('Settings sheet is not available.');

  return yarnBuildShiftSnapshot_({
    date: settings.getRange(YARN_SETTINGS_CONFIG.RANGES.DATE).getValue(),
    standards: settings.getRange(YARN_SETTINGS_CONFIG.RANGES.STANDARDS).getValues(),
    assignments: settings.getRange(YARN_SETTINGS_CONFIG.RANGES.ASSIGNMENTS).getValues(),
    weighings: settings.getRange(YARN_SETTINGS_CONFIG.RANGES.WEIGHINGS).getValues()
  });
}

function yarnBuildShiftSnapshot_(input) {
  const source = input || {};
  const errors = [];
  const date = yarnNormalizeDate_(source.date);
  if (!date) yarnAddSnapshotError_(errors, YARN_SETTINGS_CONFIG.ERRORS.INVALID_DATE, 'Settings!F4');

  const standardTitles = yarnStandardTitles_(source.standards || []);
  const assignments = [];
  const titleByMachine = {};
  const assignmentRows = source.assignments || [];

  assignmentRows.forEach(function (row, index) {
    const rowNumber = 33 + index;
    const machine = yarnText_(row[0]);
    const cabos = yarnOptionalNumber_(row[1]);
    const title = yarnText_(row[2]);
    const fronts = yarnOptionalNumber_(row[3]);
    const populated = yarnHasValue_(row[1]) || yarnHasValue_(row[2]) || yarnHasValue_(row[3]);

    if (title && !standardTitles[title]) {
      yarnAddSnapshotError_(errors, YARN_SETTINGS_CONFIG.ERRORS.UNKNOWN_TITLE, 'Settings!D' + rowNumber);
    }
    if (!populated) return;
    if (!machine || !title || cabos === null || fronts === null) {
      yarnAddSnapshotError_(errors, YARN_SETTINGS_CONFIG.ERRORS.INCOMPLETE_ASSIGNMENT,
        'Settings!C' + rowNumber + ':E' + rowNumber);
      return;
    }
    if (cabos === false || fronts === false) {
      yarnAddSnapshotError_(errors, YARN_SETTINGS_CONFIG.ERRORS.INVALID_ASSIGNMENT_NUMBER,
        'Settings!C' + rowNumber + ':E' + rowNumber);
      return;
    }
    if (!standardTitles[title]) return;

    const assignment = Object.freeze({
      machine: machine,
      cabos: cabos,
      title: title,
      fronts: fronts,
      productionDay: yarnOptionalNumberOrNull_(row[4]),
      productionShift: yarnOptionalNumberOrNull_(row[5]),
      lotsDay: yarnOptionalNumberOrNull_(row[6]),
      sourceRange: 'Settings!C' + rowNumber + ':H' + rowNumber
    });
    assignments.push(assignment);
    titleByMachine[machine] = title;
  });

  const weighings = [];
  const weighingRows = source.weighings || [];
  weighingRows.forEach(function (row, index) {
    const rowNumber = 50 + index;
    const machine = yarnText_(row[0]);
    const discharge = yarnOptionalNumber_(row[1]);
    const side = yarnText_(row[2]).toUpperCase();
    const gross = yarnOptionalNumber_(row[3]);
    const uses = yarnOptionalNumber_(row[4]);
    const coneWeight = yarnOptionalNumber_(row[5]);
    const bucketWeight = yarnOptionalNumber_(row[6]);
    const hasGross = yarnHasValue_(row[3]);
    const visiblePk = machine && discharge !== null && discharge !== false &&
      discharge >= 1 && discharge <= YARN_SETTINGS_CONFIG.LIMITS.DISCHARGES_PER_MACHINE &&
      (side === 'A' || side === 'B');

    if (!visiblePk) {
      // The form includes non-persistent helper rows. Only rows with a complete,
      // visible weighing PK are snapshot candidates.
      return;
    }
    if (gross === false) {
      yarnAddSnapshotError_(errors, YARN_SETTINGS_CONFIG.ERRORS.INVALID_GROSS_WEIGHT,
        'Settings!E' + rowNumber);
      return;
    }
    if (uses === false || coneWeight === false || bucketWeight === false) {
      yarnAddSnapshotError_(errors, YARN_SETTINGS_CONFIG.ERRORS.INVALID_TARE,
        'Settings!F' + rowNumber + ':H' + rowNumber);
      return;
    }
    if (hasGross && !titleByMachine[machine]) {
      yarnAddSnapshotError_(errors, YARN_SETTINGS_CONFIG.ERRORS.MISSING_WEIGHING_TITLE,
        'Settings!E' + rowNumber);
      return;
    }

    weighings.push(Object.freeze({
      machine: machine,
      discharge: discharge,
      side: side,
      title: titleByMachine[machine] || '',
      grossWeight: gross,
      uses: uses === null ? 0 : uses,
      coneWeight: coneWeight === null ? 0 : coneWeight,
      bucketWeight: bucketWeight === null ? 0 : bucketWeight,
      sourceRange: 'Settings!E' + rowNumber + ':H' + rowNumber
    }));
  });

  if (weighings.length > YARN_SETTINGS_CONFIG.LIMITS.WEIGHINGS_PER_DAY) {
    yarnAddSnapshotError_(errors, YARN_SETTINGS_CONFIG.ERRORS.TOO_MANY_WEIGHINGS, 'Settings!B50:H157');
  }
  if (assignments.length === 0 && !weighings.some(function (weighing) {
    return weighing.grossWeight !== null;
  })) {
    yarnAddSnapshotError_(errors, YARN_SETTINGS_CONFIG.ERRORS.EMPTY_FORM, 'Settings');
  }

  return Object.freeze({
    valid: errors.length === 0,
    date: date,
    assignments: Object.freeze(assignments),
    weighings: Object.freeze(weighings),
    errors: Object.freeze(errors)
  });
}

function yarnNormalizeDate_(value) {
  if (!(value instanceof Date) || isNaN(value.getTime())) return null;
  return Object.freeze({
    year: value.getFullYear(),
    month: value.getMonth() + 1,
    day: value.getDate()
  });
}

function yarnStandardTitles_(standards) {
  const titles = {};
  standards.forEach(function (row) {
    const title = yarnText_(row[0]);
    if (title) titles[title] = true;
  });
  return titles;
}

function yarnOptionalNumber_(value) {
  if (!yarnHasValue_(value)) return null;
  if (typeof value === 'boolean') return false;
  const number = Number(value);
  return isFinite(number) ? number : false;
}

function yarnOptionalNumberOrNull_(value) {
  const number = yarnOptionalNumber_(value);
  return number === false ? null : number;
}

function yarnHasValue_(value) {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function yarnText_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function yarnAddSnapshotError_(errors, code, range) {
  errors.push(Object.freeze({ code: code, range: range }));
}
