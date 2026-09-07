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
    try {
      guardarTurno();
    } finally {
      Utilities.sleep(1000);
      checkbox.setValue(false);
      SpreadsheetApp.flush();
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

  // Weighings: only E:H for data rows, skipping header rows (RETORCEDORA blocks)
  var wp;
  try { wp = yarnParseRange_(weighingRangeA1); } catch (e) { wp = { r1: 50, c1: 2, r2: 157, c2: 8 }; }
  var weighFullValues = [];
  try { weighFullValues = settings.getRange(weighingRangeA1).getValues(); } catch (e) { weighFullValues = []; }

  // Sort weighings for stable sequential hydration
  matchingWeighings.sort(function (a, b) {
    var ka = (a.length >= 16 ? yarnText_(a[3]) + '|' + a[4] + '|' + yarnText_(a[5]) : yarnText_(a[2]) + '|' + a[3] + '|' + yarnText_(a[4]));
    var kb = (b.length >= 16 ? yarnText_(b[3]) + '|' + b[4] + '|' + yarnText_(b[5]) : yarnText_(b[2]) + '|' + b[3] + '|' + yarnText_(b[4]));
    return ka.localeCompare(kb);
  });

  // Build list of E:H values for weighings in sorted order
  var weighingInputs = [];
  for (var w = 0; w < matchingWeighings.length; w++) {
    var wv = matchingWeighings[w];
    var wGross, wUsos, wCone, wTacho;
    if (wv.length >= 16) {
      wGross = wv[7]; wUsos = wv[8]; wCone = wv[9]; wTacho = wv[10];
    } else {
      wGross = wv[6]; wUsos = wv[7]; wCone = wv[8]; wTacho = wv[9];
    }
    weighingInputs.push([
      wGross === null || wGross === undefined ? '' : wGross,
      wUsos === null || wUsos === undefined ? '' : wUsos,
      wCone === null || wCone === undefined ? '' : wCone,
      wTacho === null || wTacho === undefined ? '' : wTacho
    ]);
  }

  // Clear all data-row E:H first to ensure empty slots are blank (preserve headers)
  for (var i = 0; i < weighFullValues.length; i++) {
    if (yarnIsWeighingHeaderRow_(weighFullValues[i])) continue;
    if (!yarnIsWeighingDataRow_(weighFullValues[i])) continue;
    var clearRow = wp.r1 + i;
    try { settings.getRange('E' + clearRow + ':H' + clearRow).clearContent(); } catch (ignore3) {}
  }

  // Sequential write skipping header rows
  var pointer = 0;
  for (var wIdx = 0; wIdx < weighingInputs.length; wIdx++) {
    while (pointer < weighFullValues.length && (yarnIsWeighingHeaderRow_(weighFullValues[pointer]) || !yarnIsWeighingDataRow_(weighFullValues[pointer]))) {
      pointer++;
    }
    if (pointer >= weighFullValues.length) break;
    var sheetRow = wp.r1 + pointer;
    try { settings.getRange('E' + sheetRow + ':H' + sheetRow).setValues([weighingInputs[wIdx]]); } catch (ignore4) {}
    pointer++;
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
