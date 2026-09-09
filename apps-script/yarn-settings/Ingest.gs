/**
 * Ingest.gs — Batch extraction and validation for the Yarn Settings shift form.
 * Only Settings!F4, Settings!F5, B10:C19, B33:H42, and B50:H157 are read by this module.
 */

function yarnReadShiftSnapshot_(spreadsheet) {
  const ss = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  const settings = (typeof yarnGetSettingsSheet_ === 'function')
    ? yarnGetSettingsSheet_(ss)
    : ss.getSheetByName(YARN_SETTINGS_CONFIG.SHEETS.SETTINGS);
  if (!settings) throw new Error('Settings sheet is not available.');
  var prefix = (typeof yarnSettingsPrefixForSheet_ === 'function')
    ? yarnSettingsPrefixForSheet_(settings)
    : settings.getName() + '!';

  return yarnBuildShiftSnapshot_({
    date: settings.getRange(YARN_SETTINGS_CONFIG.RANGES.DATE).getValue(),
    turno: settings.getRange(YARN_SETTINGS_CONFIG.RANGES.TURNO).getValue(),
    standards: settings.getRange(YARN_SETTINGS_CONFIG.RANGES.STANDARDS).getValues(),
    assignments: settings.getRange(YARN_SETTINGS_CONFIG.RANGES.ASSIGNMENTS).getValues(),
    weighings: settings.getRange(YARN_SETTINGS_CONFIG.RANGES.WEIGHINGS).getValues(),
    settingsPrefix: prefix
  });
}

function yarnBuildShiftSnapshot_(input) {
  const source = input || {};
  const errors = [];
  var prefix = source.settingsPrefix || YARN_SETTINGS_CONFIG.SHEETS.SETTINGS + '!';
  var ap = (typeof yarnParseRange_ === 'function')
    ? yarnParseRange_(YARN_SETTINGS_CONFIG.RANGES.ASSIGNMENTS)
    : { r1: 33, c1: 2, r2: 42, c2: 8 };
  var wp = (typeof yarnParseRange_ === 'function')
    ? yarnParseRange_(YARN_SETTINGS_CONFIG.RANGES.WEIGHINGS)
    : { r1: 50, c1: 2, r2: 157, c2: 8 };
  var weighingsRangeA1 = prefix + YARN_SETTINGS_CONFIG.RANGES.WEIGHINGS;
  const date = yarnNormalizeDate_(source.date);
  if (!date) yarnAddSnapshotError_(errors, YARN_SETTINGS_CONFIG.ERRORS.INVALID_DATE, prefix + YARN_SETTINGS_CONFIG.RANGES.DATE);

  const turno = yarnNormalizeTurno_(source.turno);
  if (!turno) yarnAddSnapshotError_(errors, YARN_SETTINGS_CONFIG.ERRORS.INVALID_TURNO, prefix + YARN_SETTINGS_CONFIG.RANGES.TURNO);

  const standardTitles = yarnStandardTitles_(source.standards || []);
  const assignments = [];
  const titleByMachine = {};
  const assignmentRows = source.assignments || [];

  assignmentRows.forEach(function (row, index) {
    const rowNumber = ap.r1 + index;
    const machine = yarnText_(row[0]);
    const cabos = yarnOptionalNumber_(row[1]);
    const title = yarnText_(row[2]);
    const fronts = yarnOptionalNumber_(row[3]);
    const populated = yarnHasValue_(row[1]) || yarnHasValue_(row[2]) || yarnHasValue_(row[3]);

    if (title && !standardTitles[title]) {
      yarnAddSnapshotError_(errors, YARN_SETTINGS_CONFIG.ERRORS.UNKNOWN_TITLE, prefix + 'D' + rowNumber);
    }
    if (!populated) return;
    if (!machine || !title || cabos === null || fronts === null) {
      yarnAddSnapshotError_(errors, YARN_SETTINGS_CONFIG.ERRORS.INCOMPLETE_ASSIGNMENT,
        prefix + 'C' + rowNumber + ':E' + rowNumber);
      return;
    }
    if (cabos === false || fronts === false) {
      yarnAddSnapshotError_(errors, YARN_SETTINGS_CONFIG.ERRORS.INVALID_ASSIGNMENT_NUMBER,
        prefix + 'C' + rowNumber + ':E' + rowNumber);
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
      sourceRange: prefix + 'C' + rowNumber + ':H' + rowNumber
    });
    assignments.push(assignment);
    titleByMachine[machine] = title;
  });

  const weighings = [];
  const weighingRows = source.weighings || [];
  var useBlockMode = weighingRows.some(function (row) {
    return yarnIsRetorcedoraHeader_(row[0]) && !yarnHasValue_(row[1]);
  });

  if (useBlockMode) {
    var currentMachine = null;
    // B50:H157 envelope starts mid-block for Retorcedora 1 (header at row 48 outside envelope).
    // Default to Retorcedora 1 so rows 50-57 are not orphaned before first in-range header.
    var hasInitialHeader = weighingRows.length > 0 && yarnIsRetorcedoraHeader_(weighingRows[0][0]) && !yarnHasValue_(weighingRows[0][1]);
    if (!hasInitialHeader) {
      currentMachine = 'Retorcedora 1';
    }
    weighingRows.forEach(function (row, index) {
      const rowNumber = wp.r1 + index;
      var rawB = yarnText_(row[0]);
      var rawC = yarnText_(row[1]);
      var upperB = rawB.toUpperCase();
      var upperC = rawC.toUpperCase();

      if (yarnIsRetorcedoraHeader_(rawB)) {
        currentMachine = yarnNormalizeRetorcedora_(rawB);
        return;
      }
      if (upperB === 'DESCARGA #' || upperB === 'DESCARGA' || upperC === 'LADO') {
        return;
      }

      var discharge = yarnOptionalNumber_(row[0]);
      var side = yarnNormalizeSide_(row[1]);
      var gross = yarnOptionalNumber_(row[3]);
      var uses = yarnOptionalNumber_(row[4]);
      var coneWeight = yarnOptionalNumber_(row[5]);
      var bucketWeight = yarnOptionalNumber_(row[6]);
      var hasGross = yarnHasValue_(row[3]);
      var visiblePk = currentMachine && discharge !== null && discharge !== false &&
        discharge >= 1 && discharge <= YARN_SETTINGS_CONFIG.LIMITS.DISCHARGES_PER_MACHINE &&
        (side === 'A' || side === 'B');

      if (!visiblePk) {
        return;
      }
      if (gross === false) {
        yarnAddSnapshotError_(errors, YARN_SETTINGS_CONFIG.ERRORS.INVALID_GROSS_WEIGHT,
          prefix + 'E' + rowNumber);
        return;
      }
      if (uses === false || coneWeight === false || bucketWeight === false) {
        yarnAddSnapshotError_(errors, YARN_SETTINGS_CONFIG.ERRORS.INVALID_TARE,
          prefix + 'F' + rowNumber + ':H' + rowNumber);
        return;
      }
      if (hasGross && !titleByMachine[currentMachine]) {
        yarnAddSnapshotError_(errors, YARN_SETTINGS_CONFIG.ERRORS.MISSING_WEIGHING_TITLE,
          prefix + 'E' + rowNumber);
        return;
      }

      weighings.push(Object.freeze({
        machine: currentMachine,
        discharge: discharge,
        side: side,
        title: titleByMachine[currentMachine] || '',
        grossWeight: gross,
        uses: uses === null ? 0 : uses,
        coneWeight: coneWeight === null ? 0 : coneWeight,
        bucketWeight: bucketWeight === null ? 0 : bucketWeight,
        sourceRange: prefix + 'E' + rowNumber + ':H' + rowNumber
      }));
    });
  } else {
    weighingRows.forEach(function (row, index) {
      const rowNumber = wp.r1 + index;
      const machine = yarnText_(row[0]);
      const discharge = yarnOptionalNumber_(row[1]);
      const side = yarnNormalizeSide_(row[2]);
      const gross = yarnOptionalNumber_(row[3]);
      const uses = yarnOptionalNumber_(row[4]);
      const coneWeight = yarnOptionalNumber_(row[5]);
      const bucketWeight = yarnOptionalNumber_(row[6]);
      const hasGross = yarnHasValue_(row[3]);
      const visiblePk = machine && discharge !== null && discharge !== false &&
        discharge >= 1 && discharge <= YARN_SETTINGS_CONFIG.LIMITS.DISCHARGES_PER_MACHINE &&
        (side === 'A' || side === 'B');

      if (!visiblePk) {
        return;
      }
      if (gross === false) {
        yarnAddSnapshotError_(errors, YARN_SETTINGS_CONFIG.ERRORS.INVALID_GROSS_WEIGHT,
          prefix + 'E' + rowNumber);
        return;
      }
      if (uses === false || coneWeight === false || bucketWeight === false) {
        yarnAddSnapshotError_(errors, YARN_SETTINGS_CONFIG.ERRORS.INVALID_TARE,
          prefix + 'F' + rowNumber + ':H' + rowNumber);
        return;
      }
      if (hasGross && !titleByMachine[machine]) {
        yarnAddSnapshotError_(errors, YARN_SETTINGS_CONFIG.ERRORS.MISSING_WEIGHING_TITLE,
          prefix + 'E' + rowNumber);
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
        sourceRange: prefix + 'E' + rowNumber + ':H' + rowNumber
      }));
    });
  }

  if (weighings.length > YARN_SETTINGS_CONFIG.LIMITS.WEIGHINGS_PER_DAY) {
    yarnAddSnapshotError_(errors, YARN_SETTINGS_CONFIG.ERRORS.TOO_MANY_WEIGHINGS, weighingsRangeA1);
  }
  if (assignments.length === 0 && !weighings.some(function (weighing) {
    return weighing.grossWeight !== null;
  })) {
    yarnAddSnapshotError_(errors, YARN_SETTINGS_CONFIG.ERRORS.EMPTY_FORM, YARN_SETTINGS_CONFIG.SHEETS.SETTINGS);
  }

  var blockingCodes = {};
  blockingCodes[YARN_SETTINGS_CONFIG.ERRORS.INVALID_DATE] = true;
  blockingCodes[YARN_SETTINGS_CONFIG.ERRORS.INVALID_TURNO] = true;
  blockingCodes[YARN_SETTINGS_CONFIG.ERRORS.EMPTY_FORM] = true;
  blockingCodes[YARN_SETTINGS_CONFIG.ERRORS.TOO_MANY_WEIGHINGS] = true;
  var hasBlockingError = errors.some(function (e) { return !!blockingCodes[e.code]; });

  return Object.freeze({
    valid: !hasBlockingError,
    date: date,
    turno: turno,
    assignments: Object.freeze(assignments),
    weighings: Object.freeze(weighings),
    errors: Object.freeze(errors)
  });
}

function yarnNormalizeDate_(value) {
  var isDate = value && typeof value.getTime === 'function' && Object.prototype.toString.call(value) === '[object Date]';
  if (!isDate || isNaN(value.getTime())) return null;
  return Object.freeze({
    year: value.getFullYear(),
    month: value.getMonth() + 1,
    day: value.getDate()
  });
}

function yarnNormalizeTurno_(value) {
  var raw = yarnText_(value);
  if (!raw) return null;
  var normalized = raw.toLowerCase().trim();
  // Normalize accent-less 'dia' to 'día' canonical
  if (normalized === 'dia' || normalized === 'día') return 'Día';
  if (normalized === 'tarde') return 'Tarde';
  if (normalized === 'noche') return 'Noche';
  return null;
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

function yarnNormalizeSide_(value) {
  var raw = yarnText_(value).toUpperCase().trim();
  if (raw === 'A' || raw === 'LADO A') return 'A';
  if (raw === 'B' || raw === 'LADO B') return 'B';
  return raw;
}

function yarnIsRetorcedoraHeader_(value) {
  return yarnText_(value).toUpperCase().indexOf('RETORCEDORA') === 0;
}

function yarnNormalizeRetorcedora_(value) {
  var raw = yarnText_(value);
  var match = raw.match(/retorcedora\s*(\d+)/i);
  if (match) return 'Retorcedora ' + parseInt(match[1], 10);
  return raw;
}

function yarnAddSnapshotError_(errors, code, range) {
  errors.push(Object.freeze({ code: code, range: range }));
}
