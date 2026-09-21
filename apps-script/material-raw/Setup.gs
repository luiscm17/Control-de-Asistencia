/**
 * Setup.gs — COPY-only installer for the isolated Material Raw (Materia Prima) project.
 *
 * Ensures db_materialrow A:K (11 cols frozen) + Errors A:F + F4 checkbox (FALSE/TRUE)
 * plus installable trigger materialRawOnEdit. Idempotent — safe to re-run.
 * No formulas in db_materialrow; only values. Preserves H=SI(F="";0;...) in form.
 *
 * INSTALL: Extensions > Apps Script > paste > Save > Run materialRawSetup once > Reload
 * VERIFY:  Use a COPY of 13vr2cJSG3Bukpd1Gk71-- — never prod.
 */

function materialRawSetup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  materialRawEnsureSchema(ss);
  materialRawReconcileTrigger_();
  SpreadsheetApp.flush();
  try { ss.toast('Esquema verificado — Control Camiones/db_materialrow/Errors listos', 'Materia Prima', 8); } catch (ignore) {}
  return { ok: true };
}

function materialRawEnsureSchema(optSpreadsheet) {
  var ss = optSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  materialRawEnsureTableSheet_(ss, MATERIAL_RAW_CONFIG.SHEETS.DATA, MATERIAL_RAW_CONFIG.DB_HEADERS, MATERIAL_RAW_CONFIG.UI.DB_HEADER_COLOR);
  materialRawEnsureErrorsSheet_(ss);
  try {
    var form = materialRawGetFormSheet_(ss);
    if (form) materialRawConfigureForm_(form);
  } catch (e) {
    Logger.log('materialRawEnsureSchema form config: ' + e.message);
  }
  SpreadsheetApp.flush();
  return ss;
}

function materialRawEnsureTableSheet_(ss, sheetName, headers, headerColor) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  var width = headers.length;
  var headerRange = sheet.getRange(1, 1, 1, width);
  var current = headerRange.getDisplayValues()[0].map(function (v) { return String(v || '').trim(); });
  var expected = headers.join('|');
  var headerIsEmpty = current.every(function (v) { return v === ''; });

  if (headerIsEmpty) {
    if (sheet.getLastRow() > 1) {
      throw new Error('Header drift in ' + sheetName + ': populated table has no valid header.');
    }
    headerRange.setValues([headers]);
  } else if (current.join('|') !== expected) {
    throw new Error('Header drift in ' + sheetName + ': expected frozen header order.');
  }

  headerRange.setFontWeight('bold').setBackground(headerColor);
  sheet.setFrozenRows(1);
  try { sheet.autoResizeColumns(1, width); } catch (e) {}
  materialRawEnsureHeaderProtection_(sheet, headerRange, MATERIAL_RAW_CONFIG.UI.HEADER_PROTECTION + ': ' + sheetName);

   // Number formats for DB: A fecha dd/MM/yyyy, I total_kilos 0.00, J actualizado yyyy-MM-dd HH:mm:ss, K editado_por plain; no formulas
  try {
    if (sheetName === MATERIAL_RAW_CONFIG.SHEETS.DATA) {
      var rows = Math.max(1, sheet.getMaxRows() - 1);
      // A fecha native
      sheet.getRange(2, 1, rows, 1).setNumberFormat(MATERIAL_RAW_CONFIG.VALIDATION.DATE_FORMAT);
      // I total_kilos col 9
      sheet.getRange(2, 9, rows, 1).setNumberFormat('0.00');
      // J actualizado col 10 La_Paz
      sheet.getRange(2, 10, rows, 1).setNumberFormat('yyyy-MM-dd HH:mm:ss');
      // K editado_por col 11 plain text
      sheet.getRange(2, 11, rows, 1).setNumberFormat('@');
      // Ensure no formulas in data rows (clear any stray formulas on setup, keep header only)
      // Do not clear values — only ensure header row has no formulas beyond header text
    }
  } catch (e) {
    Logger.log('materialRawEnsureTableSheet_ format: ' + e.message);
  }
  return sheet;
}

function materialRawEnsureErrorsSheet_(ss) {
  var sheetName = MATERIAL_RAW_CONFIG.SHEETS.ERRORS;
  var headers = MATERIAL_RAW_CONFIG.ERRORS_HEADERS;
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  var width = headers.length;
  var headerRange = sheet.getRange(1, 1, 1, width);
  var current = headerRange.getDisplayValues()[0].map(function (v) { return String(v || '').trim(); });
  var expected = headers.join('|');
  var headerIsEmpty = current.every(function (v) { return v === ''; });
  if (headerIsEmpty) {
    if (sheet.getLastRow() > 1) throw new Error('Header drift in ' + sheetName + ': populated table has no valid header.');
    headerRange.setValues([headers]);
  } else if (current.join('|') !== expected) {
    throw new Error('Header drift in ' + sheetName + ': expected frozen header order.');
  }
  headerRange.setFontWeight('bold').setBackground(MATERIAL_RAW_CONFIG.UI.ERRORS_HEADER_COLOR);
  sheet.setFrozenRows(1);
  try { sheet.autoResizeColumns(1, width); } catch (e) {}
  materialRawEnsureHeaderProtection_(sheet, headerRange, MATERIAL_RAW_CONFIG.UI.HEADER_PROTECTION + ': ' + sheetName);
  try {
    var rows = Math.max(1, sheet.getMaxRows() - 1);
    sheet.getRange(2, 1, rows, 1).setNumberFormat('yyyy-MM-dd HH:mm:ss');
  } catch (e2) { Logger.log('materialRawEnsureErrorsSheet_ format: ' + e2.message); }
  return sheet;
}

function materialRawEnsureHeaderProtection_(sheet, headerRange, description) {
  var a1 = headerRange.getA1Notation();
  var exists = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).some(function (p) {
    try {
      return p.getDescription() === description && p.getRange().getA1Notation() === a1;
    } catch (ignore) { return false; }
  });
  if (exists) return;
  try {
    var protection = headerRange.protect();
    protection.setDescription(description);
    protection.setWarningOnly(false);
  } catch (e) {
    Logger.log('Unable to protect Material Raw header ' + a1 + ': ' + e.message);
  }
}

function materialRawConfigureForm_(form) {
  // D4 requireDate dd/MM/yyyy
  try {
    var dateRule = SpreadsheetApp.newDataValidation()
      .requireDate()
      .setAllowInvalid(false)
      .setHelpText('Seleccion' + String.fromCharCode(225) + ' una fecha v' + String.fromCharCode(225) + 'lida.')
      .build();
    form.getRange(MATERIAL_RAW_CONFIG.RANGES.DATE)
      .setDataValidation(dateRule)
      .setNumberFormat(MATERIAL_RAW_CONFIG.VALIDATION.DATE_FORMAT);
  } catch (e) {
    Logger.log('materialRawConfigureForm_ D4: ' + e.message);
  }

  // F4 checkbox + G4 label styling (parity dyeing G4 / winding M4)
  try {
    var checkbox = form.getRange(MATERIAL_RAW_CONFIG.RANGES.CHECKBOX);
    var label = form.getRange(MATERIAL_RAW_CONFIG.RANGES.LABEL);
    var rule = SpreadsheetApp.newDataValidation().requireCheckbox().setAllowInvalid(false).setHelpText('Marcar para guardar d' + String.fromCharCode(237) + 'a.').build();
    checkbox.setDataValidation(rule);
    try {
      var cur = checkbox.getValue();
      if (cur !== false) checkbox.setValue(false);
    } catch (e1) {
      try { checkbox.setValue(false); } catch (ignore) {}
    }
    if (String(label.getDisplayValue() || '').trim() === '') label.setValue(MATERIAL_RAW_CONFIG.UI.SAVE_LABEL);
    try {
      label.setFontWeight('bold').setFontSize(10).setVerticalAlignment('middle').setFontColor('#174ea6');
      checkbox.setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground('#e8f0fe').setBorder(true, true, true, true, true, true, '#1a73e8', SpreadsheetApp.BorderStyle.SOLID);
    } catch (styleIgnore) {}
  } catch (e2) {
    Logger.log('materialRawConfigureForm_ F4: ' + e2.message);
  }
}

function materialRawReconcileTrigger_() {
  var handler = MATERIAL_RAW_CONFIG.VALIDATION.SAVE_TRIGGER_HANDLER;
  var retained = false;
  var triggers = [];
  try { triggers = ScriptApp.getProjectTriggers(); } catch (e) { triggers = []; }
  triggers.forEach(function (trigger) {
    try {
      if (trigger.getHandlerFunction() !== handler) return;
      var isInstallableEdit = trigger.getEventType() === ScriptApp.EventType.ON_EDIT;
      if (isInstallableEdit && !retained) { retained = true; return; }
      ScriptApp.deleteTrigger(trigger);
    } catch (ignore) {}
  });
  if (!retained) {
    try {
      ScriptApp.newTrigger(handler).forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
    } catch (e) {
      throw new Error('No se pudo instalar trigger ' + handler + ': ' + (e && e.message ? e.message : String(e)));
    }
  }
  return retained;
}

// Alias for design spec name reconcileTrigger_
function reconcileTrigger_() {
  return materialRawReconcileTrigger_();
}

// Legacy alias parity with other projects
function materialRawEnsureTrigger_() {
  return materialRawReconcileTrigger_();
}
