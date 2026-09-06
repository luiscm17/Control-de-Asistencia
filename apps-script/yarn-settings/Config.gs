/**
 * Config.gs — Yarn Settings form and database schema configuration.
 * This isolated Apps Script project must be deployed separately from attendance-control.
 */

const YARN_SETTINGS_CONFIG = Object.freeze({
  TIMEZONE: 'America/La_Paz',
  SHEETS: Object.freeze({
    SETTINGS: 'settings',
    ASSIGNMENTS: 'db_asignaciones',
    WEIGHINGS: 'db_descargas',
    ERRORS: 'errors'
  }),
  RANGES: Object.freeze({
    DATE: 'F4',
    TURNO: 'F5',
    STANDARDS: 'B10:C19',
    TITLE_DROPDOWN: 'D33:D42',
    ASSIGNMENTS: 'B33:H42',
    WEIGHINGS: 'B50:H157',
    SAVE_CHECKBOX: 'K2',
    SAVE_LABEL: 'L2'
  }),
  TURNO_VALUES: Object.freeze(['Día', 'Tarde', 'Noche']),
  LIMITS: Object.freeze({
    ASSIGNMENTS_PER_DAY: 10,
    WEIGHINGS_PER_DAY: 80,
    DISCHARGES_PER_MACHINE: 4
  }),
  ASSIGNMENT_HEADERS: Object.freeze([
    'id', 'fecha', 'turno', 'retorcedora', 'cabos', 'titulo_asignado',
    'frentes_asignados', 'prod_dia', 'prod_turno', 'lotes_dia',
    'creado', 'actualizado', 'editado_por', 'rango_origen'
  ]),
  WEIGHING_HEADERS: Object.freeze([
    'id', 'fecha', 'turno', 'retorcedora', 'descarga_nro', 'lado', 'titulo',
    'peso_bruto', 'usos', 'peso_cono', 'peso_tacho', 'peso_neto',
    'creado', 'actualizado', 'editado_por', 'rango_origen'
  ]),
  ERRORS_HEADER: Object.freeze([
    'timestamp', 'scope', 'range', 'code', 'reason', 'user'
  ]),
  ERRORS: Object.freeze({
    INVALID_DATE: 'invalid_date',
    INVALID_TURNO: 'invalid_turno',
    UNKNOWN_TITLE: 'unknown_title',
    EMPTY_FORM: 'empty_form',
    INCOMPLETE_ASSIGNMENT: 'incomplete_assignment',
    INVALID_ASSIGNMENT_NUMBER: 'invalid_assignment_number',
    INVALID_WEIGHING_METADATA: 'invalid_weighing_metadata',
    INVALID_GROSS_WEIGHT: 'invalid_gross_weight',
    INVALID_TARE: 'invalid_tare',
    MISSING_WEIGHING_TITLE: 'missing_weighing_title',
    TOO_MANY_WEIGHINGS: 'too_many_weighings'
  })
});

function yarnGetSettingsSheet_(ss) {
  var spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet();
  return spreadsheet.getSheetByName(YARN_SETTINGS_CONFIG.SHEETS.SETTINGS);
}

function yarnSettingsPrefixForSheet_(sheet) {
  if (sheet && typeof sheet.getName === 'function') return sheet.getName() + '!';
  return YARN_SETTINGS_CONFIG.SHEETS.SETTINGS + '!';
}

function yarnSettingsPrefix_(ss) {
  var spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet();
  var sheet = yarnGetSettingsSheet_(spreadsheet);
  return sheet ? yarnSettingsPrefixForSheet_(sheet) : YARN_SETTINGS_CONFIG.SHEETS.SETTINGS + '!';
}

function yarnParseA1_(a1) {
  var raw = String(a1).trim().toUpperCase();
  var match = raw.match(/^([A-Z]+)(\d+)$/);
  if (!match) throw new Error('Invalid A1: ' + a1);
  var letters = match[1];
  var col = 0;
  for (var i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return { row: parseInt(match[2], 10), col: col };
}

function yarnParseRange_(a1) {
  var raw = String(a1).trim();
  var parts = raw.split(':');
  if (parts.length === 1) {
    var single = yarnParseA1_(parts[0]);
    return { r1: single.row, c1: single.col, r2: single.row, c2: single.col };
  }
  var start = yarnParseA1_(parts[0]);
  var end = yarnParseA1_(parts[1]);
  return { r1: start.row, c1: start.col, r2: end.row, c2: end.col };
}

function yarnEnsureSettingsSchema() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settings = ss.getSheetByName(YARN_SETTINGS_CONFIG.SHEETS.SETTINGS);
  if (!settings) throw new Error('Settings sheet is required before Yarn setup.');

  yarnEnsureTableSheet_(ss, YARN_SETTINGS_CONFIG.SHEETS.ASSIGNMENTS,
    YARN_SETTINGS_CONFIG.ASSIGNMENT_HEADERS, '#e8f0fe');
  yarnEnsureTableSheet_(ss, YARN_SETTINGS_CONFIG.SHEETS.WEIGHINGS,
    YARN_SETTINGS_CONFIG.WEIGHING_HEADERS, '#e8f0fe');
  yarnEnsureTableSheet_(ss, YARN_SETTINGS_CONFIG.SHEETS.ERRORS,
    YARN_SETTINGS_CONFIG.ERRORS_HEADER, '#fce8e6');
  yarnConfigureSettingsForm_(settings);
  SpreadsheetApp.flush();
}

function yarnEnsureTableSheet_(ss, sheetName, headers, headerColor) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  const currentHeaders = headerRange.getValues()[0];
  if (currentHeaders.join('|') !== headers.join('|')) headerRange.setValues([headers]);

  headerRange.setFontWeight('bold').setBackground(headerColor);
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
  yarnEnsureHeaderProtection_(sheet, headers.length);
  return sheet;
}

function yarnEnsureHeaderProtection_(sheet, width) {
  const a1 = sheet.getRange(1, 1, 1, width).getA1Notation();
  const description = 'Yarn frozen header — do not reorder';
  const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  const exists = protections.some(function (protection) {
    return protection.getDescription() === description &&
      protection.getRange().getA1Notation() === a1;
  });
  if (exists) return;

  try {
    const protection = sheet.getRange(a1).protect();
    protection.setDescription(description);
    protection.setWarningOnly(false);
  } catch (error) {
    Logger.log('Unable to protect Yarn header: ' + error.message);
  }
}

function yarnConfigureSettingsForm_(settings) {
  const dateRule = SpreadsheetApp.newDataValidation()
    .requireDate()
    .setAllowInvalid(false)
    .setHelpText('Seleccioná una fecha válida.')
    .build();
  settings.getRange(YARN_SETTINGS_CONFIG.RANGES.DATE)
    .setDataValidation(dateRule)
    .setNumberFormat('dd/MM/yyyy');

  const standardsRange = settings.getRange(YARN_SETTINGS_CONFIG.RANGES.STANDARDS);
  const titleRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(standardsRange.offset(0, 0, standardsRange.getNumRows(), 1), true)
    .setAllowInvalid(false)
    .setHelpText('Seleccioná un título definido en Standards.')
    .build();
  settings.getRange(YARN_SETTINGS_CONFIG.RANGES.TITLE_DROPDOWN).setDataValidation(titleRule);

  const checkbox = settings.getRange(YARN_SETTINGS_CONFIG.RANGES.SAVE_CHECKBOX);
  checkbox.setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
  if (checkbox.getValue() === '') checkbox.setValue(false);
  settings.getRange(YARN_SETTINGS_CONFIG.RANGES.SAVE_LABEL).setValue('☑ GUARDAR TURNO');
}
