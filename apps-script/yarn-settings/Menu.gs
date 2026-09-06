/**
 * Menu.gs — Desktop menu and installable handlers for Yarn Settings.
 * Handles K2 save checkbox and F4/F5 date+turno hydration (composite filter).
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
      if (!normalizedDate || !normalizedTurno) {
        // Incomplete composite key → clear for new entry, keep UX responsive
        yarnClearSettingsForm_(settings);
        return;
      }
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
    : { row: 2, col: 11 };
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
    yarnClearSettingsForm_(settings);
    throw error;
  }

  var assignmentRangeA1 = YARN_SETTINGS_CONFIG.RANGES.ASSIGNMENTS;
  var weighingRangeA1 = YARN_SETTINGS_CONFIG.RANGES.WEIGHINGS;
  var ap = yarnParseRange_(assignmentRangeA1);
  var wp = yarnParseRange_(weighingRangeA1);
  var assignmentHeight = ap.r2 - ap.r1 + 1;
  var assignmentWidth = ap.c2 - ap.c1 + 1;
  var weighingHeight = wp.r2 - wp.r1 + 1;
  var weighingWidth = wp.c2 - wp.c1 + 1;

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
    yarnClearSettingsForm_(settings);
    try { spreadsheet.toast('Nuevo turno — formulario vacío', 'Yarn', 3); } catch (ignore) {}
    return;
  }

  // Build assignment form matrix B33:H42 (7 cols)
  var assignmentMatrix = [];
  for (var i = 0; i < assignmentHeight; i++) assignmentMatrix.push(new Array(assignmentWidth).fill(''));
  // Sort assignments by machine for stable hydration then fill sequentially
  matchingAssignments.sort(function (a, b) {
    var ma = yarnText_(a.length >= 14 ? a[3] : a[2]);
    var mb = yarnText_(b.length >= 14 ? b[3] : b[2]);
    return ma.localeCompare(mb);
  });
  for (var idx = 0; idx < matchingAssignments.length && idx < assignmentHeight; idx++) {
    var av = matchingAssignments[idx];
    // New schema: retorcedora 3, cabos 4, titulo 5, frentes 6, prod_dia 7, prod_turno 8, lotes 9
    // Old schema: retorcedora 2, cabos 3, titulo 4, frentes 5, prod_dia 6, etc.
    var retorcedora, cabos, titulo, frentes, prodDia, prodTurno, lotes;
    if (av.length >= 14) {
      retorcedora = av[3]; cabos = av[4]; titulo = av[5]; frentes = av[6]; prodDia = av[7]; prodTurno = av[8]; lotes = av[9];
    } else {
      retorcedora = av[2]; cabos = av[3]; titulo = av[4]; frentes = av[5]; prodDia = av[6]; prodTurno = av[7]; lotes = av[8];
    }
    assignmentMatrix[idx] = [retorcedora, cabos, titulo, frentes, prodDia, prodTurno, lotes];
  }

  // Build weighing form matrix B50:H157 (7 cols)
  var weighingMatrix = [];
  for (var j = 0; j < weighingHeight; j++) weighingMatrix.push(new Array(weighingWidth).fill(''));
  matchingWeighings.sort(function (a, b) {
    var ka = (a.length >= 16 ? yarnText_(a[3]) + '|' + a[4] + '|' + yarnText_(a[5]) : yarnText_(a[2]) + '|' + a[3] + '|' + yarnText_(a[4]));
    var kb = (b.length >= 16 ? yarnText_(b[3]) + '|' + b[4] + '|' + yarnText_(b[5]) : yarnText_(b[2]) + '|' + b[3] + '|' + yarnText_(b[4]));
    return ka.localeCompare(kb);
  });
  // Map weighings into rows sequentially (form rows are sequential PK slots)
  for (var wIdx = 0; wIdx < matchingWeighings.length && wIdx < weighingHeight; wIdx++) {
    var wv = matchingWeighings[wIdx];
    var wMachine, wDischarge, wSide, wGross, wUsos, wCone, wTacho;
    if (wv.length >= 16) {
      wMachine = wv[3]; wDischarge = wv[4]; wSide = wv[5]; wGross = wv[7]; wUsos = wv[8]; wCone = wv[9]; wTacho = wv[10];
    } else {
      wMachine = wv[2]; wDischarge = wv[3]; wSide = wv[4]; wGross = wv[6]; wUsos = wv[7]; wCone = wv[8]; wTacho = wv[9];
    }
    weighingMatrix[wIdx] = [wMachine, wDischarge, wSide, wGross, wUsos, wCone, wTacho];
  }

  settings.getRange(assignmentRangeA1).setValues(assignmentMatrix);
  settings.getRange(weighingRangeA1).setValues(weighingMatrix);
  SpreadsheetApp.flush();
  try { spreadsheet.toast('Turno cargado: ' + dateKey + ' ' + turnoKey, 'Yarn', 3); } catch (ignore) {}
}

function yarnClearSettingsForm_(settings) {
  var sheet = settings || yarnGetSettingsSheet_(SpreadsheetApp.getActiveSpreadsheet());
  if (!sheet) return;
  var ap = yarnParseRange_(YARN_SETTINGS_CONFIG.RANGES.ASSIGNMENTS);
  var wp = yarnParseRange_(YARN_SETTINGS_CONFIG.RANGES.WEIGHINGS);
  var aH = ap.r2 - ap.r1 + 1; var aW = ap.c2 - ap.c1 + 1;
  var wH = wp.r2 - wp.r1 + 1; var wW = wp.c2 - wp.c1 + 1;
  var emptyA = []; for (var i = 0; i < aH; i++) emptyA.push(new Array(aW).fill(''));
  var emptyW = []; for (var j = 0; j < wH; j++) emptyW.push(new Array(wW).fill(''));
  sheet.getRange(YARN_SETTINGS_CONFIG.RANGES.ASSIGNMENTS).setValues(emptyA);
  sheet.getRange(YARN_SETTINGS_CONFIG.RANGES.WEIGHINGS).setValues(emptyW);
  SpreadsheetApp.flush();
}
