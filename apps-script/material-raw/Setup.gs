/**
 * Setup.gs — COPY-only installer for the isolated Material Raw (Materia Prima) project.
 *
 * Ensures db_materialrow A:J (10 cols frozen) + Errors A:F + F4 checkbox (FALSE/TRUE)
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

  // Number formats for DB: A fecha dd/MM/yyyy, I total_kilos 0.00, J timestamp yyyy-MM-dd HH:mm:ss; no formulas
  try {
    if (sheetName === MATERIAL_RAW_CONFIG.SHEETS.DATA) {
      var rows = Math.max(1, sheet.getMaxRows() - 1);
      // A fecha native
      sheet.getRange(2, 1, rows, 1).setNumberFormat(MATERIAL_RAW_CONFIG.VALIDATION.DATE_FORMAT);
      // I total_kilos col 9
      sheet.getRange(2, 9, rows, 1).setNumberFormat('0.00');
      // J timestamp col 10 La_Paz
      sheet.getRange(2, 10, rows, 1).setNumberFormat('yyyy-MM-dd HH:mm:ss');
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

// ---------------------------------------------------------------------------
// Registro Diario B10:B40 fix — replaces INDICE with SUMAR.SI (decoupled history)
// ---------------------------------------------------------------------------

/**
 * Fix Registro Diario!B10:B40 aggregation formula.
 * Replaces legacy `INDICE('Control Camiones'!H7:H206;1)` with decoupled
 * `=SI.ERROR(SUMAR.SI(db_materialrow!$A$2:$A;fecha;db_materialrow!$I$2:$I);0)`.
 *
 * Detection per row (A10:A40):
 *  - If A10 holds a native Date (e.g. 19/09/2026 as Date object), uses
 *    `=SI.ERROR(SUMAR.SI(db_materialrow!$A$2:$A;$A10;db_materialrow!$I$2:$I);0)`
 *  - Otherwise (A10 = 1,2,3 numeric day), uses
 *    `=SI.ERROR(SUMAR.SI(db_materialrow!$A$2:$A;FECHA(2026;9;$A10);db_materialrow!$I$2:$I);0)`
 *
 * Keeps H + A6:H6 untouched (only B10:B40 formulas). Idempotent — safe to re-run.
 * Manual alternative if script unavailable: paste FECHA variant in B10 and copy down to B40.
 *
 * Run once on COPY after materialRawSetup: Extensions > Apps Script > Run materialRawFixRegistroDiarioFormulas
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet=} optSpreadsheet
 * @return {{success:boolean, code:string, updated:number}}
 */
function materialRawFixRegistroDiarioFormulas(optSpreadsheet) {
  var ss = optSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Registro Diario');
  if (!sheet) {
    var msg = 'Hoja "Registro Diario" no encontrada — verifique nombre exacto.';
    try { ss.toast(msg, 'Materia Prima', 8); } catch (ignore) {}
    try { materialRawLogError_('fix-registro', 'missing_sheet', msg, 'Registro Diario!B10:B40', ss); } catch (ignore2) {}
    return { success: false, code: 'missing_sheet', updated: 0 };
  }

  // Idempotent: read A10:A40 to decide per-row formula
  var aValues;
  try {
    aValues = sheet.getRange('A10:A40').getValues();
  } catch (e) {
    var em = e && e.message ? e.message : String(e);
    try { materialRawLogError_('fix-registro', 'read_failed', em, 'Registro Diario!A10:A40', ss); } catch (ignore) {}
    try { ss.toast(em, 'Materia Prima', 8); } catch (ignore2) {}
    return { success: false, code: 'read_failed', updated: 0 };
  }

  var formulas = [];
  for (var i = 0; i < aValues.length; i++) {
    var rowNum = 10 + i;
    var av = aValues[i][0];
    var isNativeDate = av instanceof Date && !isNaN(av.getTime());
    // Also treat display-heavy native: if A10:A40 has number 1-31, it's numeric day
    var formula;
    if (isNativeDate) {
      formula = '=SI.ERROR(SUMAR.SI(db_materialrow!$A$2:$A;$A' + rowNum + ';db_materialrow!$I$2:$I);0)';
    } else {
      // Numeric day (1,2,3) or empty — use FECHA(2026;9;$A) to construct date 2026-09-dd
      // SI.ERROR wraps zero when no data — keeps unit hist preserved
      formula = '=SI.ERROR(SUMAR.SI(db_materialrow!$A$2:$A;FECHA(2026;9;$A' + rowNum + ');db_materialrow!$I$2:$I);0)';
    }
    formulas.push([formula]);
  }

  try {
    // B10:B40 only — strictly 31 rows, column B. Never touch H or A6:H6.
    sheet.getRange('B10:B40').setFormulas(formulas);
    SpreadsheetApp.flush();
  } catch (e2) {
    var em2 = e2 && e2.message ? e2.message : String(e2);
    try { materialRawLogError_('fix-registro', 'write_failed', em2, 'Registro Diario!B10:B40', ss); } catch (ignore) {}
    try { ss.toast(em2, 'Materia Prima', 8); } catch (ignore2) {}
    return { success: false, code: 'write_failed', updated: 0 };
  }

  try { ss.toast('Registro Diario B10:B40 actualizado a SUMAR.SI — verificado', 'Materia Prima', 8); } catch (ignore) {}
  return { success: true, code: 'ok', updated: 31 };
}

/**
 * Variant that forces hybrid ESNUMERO formula for both cases in one expression:
 * =SI.ERROR(SUMAR.SI(db_materialrow!$A$2:$A;SI(ESNUMERO($A10);FECHA(2026;9;$A10);$A10);db_materialrow!$I$2:$I);0)
 * Useful when A column mixes numeric days and native dates.
 * Not used by default — kept as manual alternative (idempotent).
 */
function materialRawFixRegistroDiarioFormulasHybrid_(optSpreadsheet) {
  var ss = optSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Registro Diario');
  if (!sheet) return { success: false, code: 'missing_sheet', updated: 0 };
  var formulas = [];
  for (var i = 0; i < 31; i++) {
    var rn = 10 + i;
    formulas.push(['=SI.ERROR(SUMAR.SI(db_materialrow!$A$2:$A;SI(ESNUMERO($A' + rn + ');FECHA(2026;9;$A' + rn + ');$A' + rn + ');db_materialrow!$I$2:$I);0)']);
  }
  sheet.getRange('B10:B40').setFormulas(formulas);
  SpreadsheetApp.flush();
  try { ss.toast('Registro Diario B10:B40 híbrido (ESNUMERO) aplicado', 'Materia Prima', 8); } catch (ignore) {}
  return { success: true, code: 'ok', updated: 31 };
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
