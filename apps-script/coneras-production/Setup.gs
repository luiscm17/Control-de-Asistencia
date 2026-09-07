/**
 * Setup.gs — COPY-only schema and form validation installer for Coneras.
 */

function conerasSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const form = conerasRequireSheet_(ss, 'CONERA');
  conerasEnsureTableSheet_(ss, 'DB', 'DB_HEADERS', CONERAS_CONFIG.DB_HEADERS, CONERAS_CONFIG.UI.DB_HEADER_COLOR);
  conerasEnsureTableSheet_(ss, 'ERRORS', 'ERRORS_HEADERS', CONERAS_CONFIG.ERRORS_HEADERS, CONERAS_CONFIG.UI.ERRORS_HEADER_COLOR);
  conerasConfigureForm_(form);
  conerasVerifyNativeFormulas_(form);
  SpreadsheetApp.flush();
}

function conerasEnsureTableSheet_(spreadsheet, key, headerRangeKey, headers, color) {
  let sheet = conerasGetSheet_(spreadsheet, key);
  if (!sheet) sheet = spreadsheet.insertSheet(CONERAS_CONFIG.SHEETS[key]);

  const headerRange = sheet.getRange(CONERAS_CONFIG.RANGES[headerRangeKey]);
  const currentHeaders = headerRange.getValues()[0];
  if (!conerasHeadersMatch_(currentHeaders, headers)) headerRange.setValues([headers]);
  headerRange.setFontWeight('bold').setBackground(color);
  sheet.setFrozenRows(1);
  conerasEnsureHeaderProtection_(sheet, headerRange);
  return sheet;
}

function conerasEnsureHeaderProtection_(sheet, headerRange) {
  const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  const exists = protections.some(function (protection) {
    return protection.getDescription() === CONERAS_CONFIG.UI.HEADER_PROTECTION &&
      protection.getRange().getA1Notation() === headerRange.getA1Notation();
  });
  if (exists) return;

  try {
    const protection = headerRange.protect();
    protection.setDescription(CONERAS_CONFIG.UI.HEADER_PROTECTION);
    protection.setWarningOnly(false);
  } catch (error) {
    Logger.log('Unable to protect Coneras header: ' + error.message);
  }
}

function conerasConfigureForm_(form) {
  const dateRule = SpreadsheetApp.newDataValidation()
    .requireDate().setAllowInvalid(false).setHelpText('Seleccioná una fecha válida.').build();
  const shiftRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONERAS_CONFIG.TURNO_VALUES, true).setAllowInvalid(false).build();
  const machineRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONERAS_CONFIG.MAQUINA_VALUES, true).setAllowInvalid(false).build();
  const checkboxRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();

  form.getRange(CONERAS_CONFIG.RANGES.FECHA).setDataValidation(dateRule).setNumberFormat('dd/MM/yyyy');
  form.getRange(CONERAS_CONFIG.RANGES.TURNO).setDataValidation(shiftRule);
  form.getRange(CONERAS_CONFIG.RANGES.MAQUINA).setDataValidation(machineRule);
  const checkbox = form.getRange(CONERAS_CONFIG.RANGES.SAVE_CHECKBOX);
  checkbox.setDataValidation(checkboxRule);
  if (checkbox.getValue() === '') checkbox.setValue(false);
  form.getRange(CONERAS_CONFIG.RANGES.SAVE_LABEL).setValue(CONERAS_CONFIG.UI.SAVE_LABEL);
}

function conerasVerifyNativeFormulas_(form) {
  conerasFormulaCells_().forEach(function (expected) {
    const actual = form.getRange(expected.range).getFormula();
    if (actual !== expected.formula) {
      throw new Error('Native formula changed or missing at ' + expected.range + '. Restore it before setup.');
    }
  });
}
