/**
 * Menu.gs — Desktop menu and installable handlers for Yarn Settings.
 * Handles I8 save checkbox and F4/F5 date+turno hydration (composite filter).
 */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Yarn')
    .addItem('Guardar Turno', 'guardarTurno')
    .addSeparator()
    .addItem('Ver db_descargas', 'yarnMenuVerDescargas')
    .addItem('Ver db_asignaciones', 'yarnMenuVerAsignaciones')
    .addItem('Re-sincronizar Settings', 'yarnMenuResincronizarSettings')
    .addToUi();
}

function yarnSetupYarnSettings() {
  yarnEnsureSettingsSchema();
  yarnEnsureSaveCheckboxTrigger_();
  SpreadsheetApp.getActiveSpreadsheet().toast('Settings y el guardado móvil están listos.', 'Yarn', 5);
}

function yarnMenuResincronizarSettings() {
  yarnSetupYarnSettings();
}

function yarnMenuVerDescargas() {
  yarnActivateYarnSheet_(YARN_SETTINGS_CONFIG.SHEETS.WEIGHINGS);
}

function yarnMenuVerAsignaciones() {
  yarnActivateYarnSheet_(YARN_SETTINGS_CONFIG.SHEETS.ASSIGNMENTS);
}

function yarnActivateYarnSheet_(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error(sheetName + ' is unavailable. Run Re-sincronizar Settings first.');
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(sheet);
}

function yarnEnsureSaveCheckboxTrigger_() {
  const handler = 'yarnSettingsOnEdit';
  const exists = ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === handler &&
      trigger.getEventType() === ScriptApp.EventType.ON_EDIT;
  });
  if (!exists) ScriptApp.newTrigger(handler).forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
}

function yarnSettingsOnEdit(event) {
  if (yarnIsSaveCheckboxEvent_(event)) {
    const checkbox = event.range;
    try { Utilities.sleep(300); } catch (e) {}
    try {
      guardarTurno();
    } finally {
      try { checkbox.setValue(false); } catch (e) {}
      try { SpreadsheetApp.flush(); } catch (e) {}
    }
    return;
  }
  if (yarnIsDateOrTurnoEdit_(event)) {
    try {
      var ss = (event && event.source) ? event.source : SpreadsheetApp.getActiveSpreadsheet();
      var settings = yarnGetSettingsSheet_(ss);
      if (!settings) return;
      var rawDate = settings.getRange(YARN_SETTINGS_CONFIG.RANGES.DATE).getValue();
      var rawTurno = settings.getRange(YARN_SETTINGS_CONFIG.RANGES.TURNO).getValue();
      var normalizedDate = (typeof yarnNormalizeDate_ === 'function') ? yarnNormalizeDate_(rawDate) : null;
      var normalizedTurno = (typeof yarnNormalizeTurno_ === 'function') ? yarnNormalizeTurno_(rawTurno) : null;
      if (!normalizedDate || !normalizedTurno) return;
      yarnHydrateSettingsForm_(ss, normalizedDate, normalizedTurno);
    } catch (error) {
      try {
        yarnLogError_('hydration', error.message || 'hydration_failed', String(error && error.message ? error.message : error),
          YARN_SETTINGS_CONFIG.SHEETS.SETTINGS + '!' + YARN_SETTINGS_CONFIG.RANGES.DATE + '/' + YARN_SETTINGS_CONFIG.RANGES.TURNO);
      } catch (ignore) {}
      try { SpreadsheetApp.getActiveSpreadsheet().toast('⚠️ No se pudo cargar el turno', 'Yarn', 5); } catch (ignore2) {}
    }
  }
}

function yarnIsSaveCheckboxEvent_(event) {
  if (!event || !event.range) return false;
  const range = event.range;
  const sheet = range.getSheet();
  if (!sheet) return false;
  if (sheet.getName() !== YARN_SETTINGS_CONFIG.SHEETS.SETTINGS) return false;
  var ck = (typeof yarnParseA1_ === 'function')
    ? yarnParseA1_(YARN_SETTINGS_CONFIG.RANGES.SAVE_CHECKBOX)
    : { row: 8, col: 9 };
  if (range.getRow() !== ck.row || range.getColumn() !== ck.col) return false;
  const value = event.value === undefined ? range.getValue() : event.value;
  return value === true || String(value).toUpperCase() === 'TRUE' ||
    String(value).toUpperCase() === 'VERDADERO';
}

function yarnIsDateOrTurnoEdit_(event) {
  if (!event || !event.range) return false;
  var range = event.range;
  var sheet = range.getSheet();
  if (!sheet) return false;
  if (sheet.getName() !== YARN_SETTINGS_CONFIG.SHEETS.SETTINGS) return false;
  var datePos = (typeof yarnParseA1_ === 'function')
    ? yarnParseA1_(YARN_SETTINGS_CONFIG.RANGES.DATE)
    : { row: 4, col: 6 };
  var turnoPos = (typeof yarnParseA1_ === 'function')
    ? yarnParseA1_(YARN_SETTINGS_CONFIG.RANGES.TURNO)
    : { row: 5, col: 6 };
  var r = range.getRow();
  var c = range.getColumn();
  return (r === datePos.row && c === datePos.col) || (r === turnoPos.row && c === turnoPos.col);
}

function yarnHydrateSettingsForm_(ss, date, turno) {
  var spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet();
  var settings = yarnGetSettingsSheet_(spreadsheet);
  if (!settings) throw new Error('Settings sheet is not available.');
  var dateKey = yarnDateKey_(date);
  var turnoKey = yarnText_(turno);
  var state;
  try {
    state = yarnLoadPersistenceState_(spreadsheet);
  } catch (error) {
    throw error;
  }

  var weighingRangeA1 = YARN_SETTINGS_CONFIG.RANGES.WEIGHINGS;

  // Filter assignments matching composite key
  var matchingAssignments = [];
  (state.assignments || []).forEach(function (entry) {
    var values = entry.values;
    var key = yarnAssignmentKeyFromRow_(values);
    if (key === dateKey + '|' + turnoKey + '|' + yarnText_(values.length >= 14 ? values[3] : values[2])) {
      matchingAssignments.push(values);
    }
  });
  // Fallback: direct date+turno match using turno column
  if (matchingAssignments.length === 0) {
    (state.assignments || []).forEach(function (entry) {
      var v = entry.values;
      if (!v || !v[1]) return;
      var dk = yarnDateKey_(v[1]);
      var tk = v.length >= 14 ? yarnText_(v[2]) : '';
      if (dk === dateKey && tk === turnoKey) {
        var already = matchingAssignments.some(function (m) { return m[0] === v[0]; });
        if (!already) matchingAssignments.push(v);
      }
    });
  }

  var matchingWeighings = [];
  (state.weighings || []).forEach(function (entry) {
    var v = entry.values;
    if (!v || !v[1]) return;
    var dk = yarnDateKey_(v[1]);
    var tk = v.length >= 16 ? yarnText_(v[2]) : '';
    if (dk === dateKey && tk === turnoKey) matchingWeighings.push(v);
  });

  if (matchingAssignments.length === 0 && matchingWeighings.length === 0) {
    // Fix: clear form before returning so switching to an empty turno wipes previous values.
    try {
      yarnClearSettingsForm_(settings);
    } catch (clearError) {
      try { settings.getRange('C33:E42').clearContent(); } catch (ignoreClear) {}
      var clearWp;
      try { clearWp = yarnParseRange_(weighingRangeA1); } catch (e2) { clearWp = { r1: 50, c1: 2, r2: 157, c2: 8 }; }
      var clearVals = [];
      try { clearVals = settings.getRange(weighingRangeA1).getValues(); } catch (e3) { clearVals = []; }
      for (var clearIdx = 0; clearIdx < clearVals.length; clearIdx++) {
        if (yarnIsWeighingHeaderRow_(clearVals[clearIdx])) continue;
        if (!yarnIsWeighingDataRow_(clearVals[clearIdx])) continue;
        try { settings.getRange('E' + (clearWp.r1 + clearIdx) + ':H' + (clearWp.r1 + clearIdx)).clearContent(); } catch (ignore2) {}
      }
      try { SpreadsheetApp.flush(); } catch (ignore3) {}
    }
    try { spreadsheet.toast('Nuevo turno — sin datos guardados', 'Yarn', 3); } catch (ignore) {}
    return;
  }

  // Assignments: only C33:E42 (cabos/titulo/frentes) — preserve B labels and F:H formulas
  // Build map machine -> [cabos, titulo, frentes] then fill C:E by PK
  var assignmentMap = {};
  matchingAssignments.sort(function (a, b) {
    var ma = yarnText_(a.length >= 14 ? a[3] : a[2]);
    var mb = yarnText_(b.length >= 14 ? b[3] : b[2]);
    return ma.localeCompare(mb);
  });
  matchingAssignments.forEach(function (av) {
    var retorcedora, cabos, titulo, frentes;
    if (av.length >= 14) {
      retorcedora = av[3]; cabos = av[4]; titulo = av[5]; frentes = av[6];
    } else {
      retorcedora = av[2]; cabos = av[3]; titulo = av[4]; frentes = av[5];
    }
    var key = yarnText_(retorcedora).toUpperCase();
    if (key) assignmentMap[key] = [cabos, titulo, frentes];
  });

  // Read current B33:B42 labels to map correctly; fallback to sequential if unavailable
  var assignmentLabels = [];
  try {
    assignmentLabels = settings.getRange('B33:B42').getValues();
  } catch (ignore) {
    assignmentLabels = [];
  }
  var assignmentInputs = [];
  for (var i = 0; i < 10; i++) {
    var label = '';
    if (assignmentLabels[i] && assignmentLabels[i][0] != null) label = yarnText_(assignmentLabels[i][0]);
    if (!label) label = 'Retorcedora ' + (i + 1);
    var key = label.toUpperCase();
    var found = assignmentMap[key];
    if (found) {
      assignmentInputs.push([found[0] === undefined || found[0] === null ? '' : found[0], found[1] === undefined || found[1] === null ? '' : found[1], found[2] === undefined || found[2] === null ? '' : found[2]]);
    } else {
      // Fallback sequential if label not found and we have sorted list (preserve old behavior for dense fills)
      // Try sequential position as fallback only when map miss and we have exactly 10 sequential entries
      assignmentInputs.push(['', '', '']);
    }
  }
  // If map was not matched by label (e.g., labels missing), fallback to sequential fill for dense case
  var sequentialFallback = false;
  var matchedByLabel = assignmentInputs.some(function (r) { return r[0] !== '' || r[1] !== '' || r[2] !== ''; });
  if (!matchedByLabel && matchingAssignments.length > 0) {
    sequentialFallback = true;
    assignmentInputs = [];
    for (var s = 0; s < 10; s++) assignmentInputs.push(['', '', '']);
    for (var idx = 0; idx < matchingAssignments.length && idx < 10; idx++) {
      var av2 = matchingAssignments[idx];
      var cab2, tit2, fre2;
      if (av2.length >= 14) { cab2 = av2[4]; tit2 = av2[5]; fre2 = av2[6]; } else { cab2 = av2[3]; tit2 = av2[4]; fre2 = av2[5]; }
      assignmentInputs[idx] = [cab2 === null || cab2 === undefined ? '' : cab2, tit2 === null || tit2 === undefined ? '' : tit2, fre2 === null || fre2 === undefined ? '' : fre2];
    }
  }
  try {
    settings.getRange('C33:E42').setValues(assignmentInputs);
  } catch (e) {
    // Fallback: per-row write if bulk fails
    for (var r = 0; r < assignmentInputs.length; r++) {
      try { settings.getRange('C' + (33 + r) + ':E' + (33 + r)).setValues([assignmentInputs[r]]); } catch (ignore2) {}
    }
  }

  // Weighings: PK-aware hydration — mirrors Ingest block parsing, no sequential pointer.
  var wp;
  try { wp = yarnParseRange_(weighingRangeA1); } catch (e) { wp = { r1: 50, c1: 2, r2: 157, c2: 8 }; }
  var weighFullValues = [];
  try { weighFullValues = settings.getRange(weighingRangeA1).getValues(); } catch (e) { weighFullValues = []; }

  // Local fallbacks so hydration works even if Ingest helpers are reordered at runtime.
  var _yarnText = (typeof yarnText_ === 'function') ? yarnText_ : function (v) { return v == null ? '' : String(v).trim(); };
  var _yarnHasValue = (typeof yarnHasValue_ === 'function') ? yarnHasValue_ : function (v) { return v !== null && v !== undefined && String(v).trim() !== ''; };
  var _yarnOptionalNumber = (typeof yarnOptionalNumber_ === 'function') ? yarnOptionalNumber_ : function (v) {
    if (v == null || String(v).trim() === '') return null;
    if (typeof v === 'boolean') return false;
    var n = Number(v);
    return isFinite(n) ? n : false;
  };
  var _yarnNormalizeSide = (typeof yarnNormalizeSide_ === 'function') ? yarnNormalizeSide_ : function (v) {
    var raw = _yarnText(v).toUpperCase();
    if (raw === 'A' || raw === 'LADO A') return 'A';
    if (raw === 'B' || raw === 'LADO B') return 'B';
    return raw;
  };
  var _yarnNormalizeRet = (typeof yarnNormalizeRetorcedora_ === 'function') ? yarnNormalizeRetorcedora_ : function (v) {
    var raw = _yarnText(v);
    var m = raw.match(/retorcedora\s*(\d+)/i);
    if (m) return 'Retorcedora ' + parseInt(m[1], 10);
    return raw;
  };
  var _yarnIsRetHeader = (typeof yarnIsRetorcedoraHeader_ === 'function') ? yarnIsRetorcedoraHeader_ : function (v) {
    return _yarnText(v).toUpperCase().indexOf('RETORCEDORA') === 0;
  };

  // Build PK map: key = RETORCEDORA|descarga|lado (canonical upper) -> [gross, usos, cone, tacho]
  var weighingMap = {};
  for (var w = 0; w < matchingWeighings.length; w++) {
    var wv = matchingWeighings[w];
    var wRet, wDis, wSide, wGross, wUsos, wCone, wTacho;
    if (wv.length >= 16) {
      wRet = wv[3]; wDis = wv[4]; wSide = wv[5];
      wGross = wv[7]; wUsos = wv[8]; wCone = wv[9]; wTacho = wv[10];
    } else {
      wRet = wv[2]; wDis = wv[3]; wSide = wv[4];
      wGross = wv[6]; wUsos = wv[7]; wCone = wv[8]; wTacho = wv[9];
    }
    var disNum = _yarnOptionalNumber(wDis);
    if (disNum === null || disNum === false || disNum < 1 || disNum > 4 || Math.floor(disNum) !== disNum) continue;
    var sideNorm = _yarnNormalizeSide(wSide);
    if (sideNorm !== 'A' && sideNorm !== 'B') continue;
    var retNorm = _yarnNormalizeRet(wRet);
    if (!_yarnText(retNorm)) continue;
    var key = _yarnText(retNorm).toUpperCase() + '|' + disNum + '|' + sideNorm.toUpperCase();
    weighingMap[key] = [
      wGross === null || wGross === undefined ? '' : wGross,
      wUsos === null || wUsos === undefined ? '' : wUsos,
      wCone === null || wCone === undefined ? '' : wCone,
      wTacho === null || wTacho === undefined ? '' : wTacho
    ];
  }

  // Detect block mode same as Ingest: any RETORCEDORA header with empty C.
  var useBlockMode = false;
  for (var b = 0; b < weighFullValues.length; b++) {
    if (_yarnIsRetHeader(weighFullValues[b][0]) && !_yarnHasValue(weighFullValues[b][1])) { useBlockMode = true; break; }
  }

  // Clear all data-row E:H first to ensure empty slots are blank (preserve headers)
  for (var i = 0; i < weighFullValues.length; i++) {
    if (yarnIsWeighingHeaderRow_(weighFullValues[i])) continue;
    if (!yarnIsWeighingDataRow_(weighFullValues[i])) continue;
    var clearRow = wp.r1 + i;
    try { settings.getRange('E' + clearRow + ':H' + clearRow).clearContent(); } catch (ignore3) {}
  }

  // PK-aware fill: for each sheet data row infer its PK and look up weighingMap.
  if (useBlockMode) {
    var currentMachine = null;
    var hasInitialHeader = weighFullValues.length > 0 && _yarnIsRetHeader(weighFullValues[0][0]) && !_yarnHasValue(weighFullValues[0][1]);
    if (!hasInitialHeader) currentMachine = 'Retorcedora 1';
    for (var r = 0; r < weighFullValues.length; r++) {
      var row = weighFullValues[r];
      var rawB = _yarnText(row[0]);
      if (_yarnIsRetHeader(rawB)) { currentMachine = _yarnNormalizeRet(rawB); continue; }
      var upperB = rawB.toUpperCase();
      var upperC = _yarnText(row[1]).toUpperCase();
      if (upperB === 'DESCARGA #' || upperB === 'DESCARGA' || upperC === 'LADO') continue;
      if (yarnIsWeighingHeaderRow_(row)) continue;
      if (!yarnIsWeighingDataRow_(row)) continue;
      if (!currentMachine) continue;
      var dNum = _yarnOptionalNumber(row[0]);
      var sNorm = _yarnNormalizeSide(row[1]);
      if (dNum === null || dNum === false || dNum < 1 || dNum > 4 || Math.floor(dNum) !== dNum) continue;
      if (sNorm !== 'A' && sNorm !== 'B') continue;
      var k = _yarnNormalizeRet(currentMachine).toUpperCase() + '|' + dNum + '|' + sNorm.toUpperCase();
      var entry = weighingMap[k];
      if (!entry) continue;
      var sheetRow = wp.r1 + r;
      try { settings.getRange('E' + sheetRow + ':H' + sheetRow).setValues([entry]); } catch (ignore4) {}
    }
  } else {
    // Flat fallback: B=machine, C=discharge, D=lado (legacy)
    for (var r2 = 0; r2 < weighFullValues.length; r2++) {
      var row2 = weighFullValues[r2];
      if (yarnIsWeighingHeaderRow_(row2)) continue;
      if (!yarnIsWeighingDataRow_(row2)) continue;
      var mach2 = _yarnNormalizeRet(row2[0]);
      var dNum2 = _yarnOptionalNumber(row2[1]);
      var sNorm2 = _yarnNormalizeSide(row2[2]);
      if (!_yarnText(mach2) || dNum2 === null || dNum2 === false) continue;
      if (sNorm2 !== 'A' && sNorm2 !== 'B') continue;
      var k2 = _yarnText(mach2).toUpperCase() + '|' + dNum2 + '|' + sNorm2.toUpperCase();
      var entry2 = weighingMap[k2];
      if (!entry2) continue;
      var sheetRow2 = wp.r1 + r2;
      try { settings.getRange('E' + sheetRow2 + ':H' + sheetRow2).setValues([entry2]); } catch (ignore5) {}
    }
  }

  SpreadsheetApp.flush();
  try { spreadsheet.toast('Turno cargado: ' + dateKey + ' ' + turnoKey, 'Yarn', 3); } catch (ignore) {}
}

function yarnClearSettingsForm_(settings) {
  var sheet = settings || yarnGetSettingsSheet_(SpreadsheetApp.getActiveSpreadsheet());
  if (!sheet) return;
  // Assignments: only C33:E42 (cabos/titulo/frentes) — preserve B labels and F:H formulas (F33=SI.ERROR(E33*BUSCARV...), G33, H33)
  try {
    sheet.getRange('C33:E42').clearContent();
  } catch (e) {
    try {
      var emptyA = [];
      for (var i = 0; i < 10; i++) emptyA.push(['', '', '']);
      sheet.getRange('C33:E42').setValues(emptyA);
    } catch (ignore) {}
  }
  // Weighings: only E:H for data rows, skipping header rows (RETORCEDORA headers and column headers)
  var weighingRangeA1 = YARN_SETTINGS_CONFIG.RANGES.WEIGHINGS; // B50:H157
  var wp;
  try { wp = yarnParseRange_(weighingRangeA1); } catch (e) { wp = { r1: 50, c1: 2, r2: 157, c2: 8 }; }
  var fullValues = [];
  try { fullValues = sheet.getRange(weighingRangeA1).getValues(); } catch (e) { fullValues = []; }
  for (var i = 0; i < fullValues.length; i++) {
    var row = fullValues[i];
    if (yarnIsWeighingHeaderRow_(row)) continue;
    if (!yarnIsWeighingDataRow_(row)) continue;
    var sheetRow = wp.r1 + i;
    try { sheet.getRange('E' + sheetRow + ':H' + sheetRow).clearContent(); } catch (ignore2) {}
  }
  SpreadsheetApp.flush();
}

function yarnIsWeighingDataRow_(row) {
  if (!row) return false;
  var txt = (typeof yarnText_ === 'function') ? yarnText_ : function (v) { return v == null ? '' : String(v).trim(); };
  var optNum = (typeof yarnOptionalNumber_ === 'function') ? yarnOptionalNumber_ : function (v) {
    if (v == null || String(v).trim() === '') return null;
    var n = Number(v);
    return isFinite(n) ? n : false;
  };
  var b = txt(row[0]);
  var cVal = row[1];
  var d = txt(row[2]);
  // New layout: B=machine, C=discharge 1..4, D=side A/B
  var cNum = optNum(cVal);
  var dU = d.toUpperCase();
  var isSideNew = (dU === 'A' || dU === 'B' || dU === 'LADO A' || dU === 'LADO B');
  if (b && cNum !== null && cNum !== false && cNum >= 1 && cNum <= 4 && Math.floor(cNum) === cNum && isSideNew) {
    return true;
  }
  // Old layout fallback: B=discharge 1..4, C=side A/B
  var bNum = optNum(row[0]);
  var cText = txt(cVal);
  var cU = cText.toUpperCase();
  var isSideOld = (cU === 'A' || cU === 'B' || cU === 'LADO A' || cU === 'LADO B');
  if (bNum !== null && bNum !== false && bNum >= 1 && bNum <= 4 && Math.floor(bNum) === bNum && isSideOld) {
    return true;
  }
  return false;
}

function yarnIsWeighingHeaderRow_(row) {
  if (!row) return true;
  // Header rows are those that are not data rows but contain header-like text
  if (yarnIsWeighingDataRow_(row)) return false;
  var txt = (typeof yarnText_ === 'function') ? yarnText_ : function (v) { return v == null ? '' : String(v).trim(); };
  var b = txt(row[0]).toUpperCase();
  var c = txt(row[1]).toUpperCase();
  var d = txt(row[2]).toUpperCase();
  var e = txt(row[3]).toUpperCase();
  if (b.indexOf('RETORCEDORA') !== -1) return true;
  if (b.indexOf('DESCARGA') !== -1) return true;
  if (c === 'LADO' || d === 'LADO' || e.indexOf('PESO BRUTO') !== -1) return true;
  if (c.indexOf('LADO') !== -1 && !yarnIsWeighingDataRow_(row)) return true;
  if (e.indexOf('PESO') !== -1 && e.indexOf('BRUTO') !== -1) return true;
  if (b === 'DESCARGA #' || b === 'DESCARGA') return true;
  // Any non-data row is treated as header to be skipped (safer to preserve)
  return true;
}
