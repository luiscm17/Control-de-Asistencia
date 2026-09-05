/**
 * Config.gs — Yarn Settings form and database schema configuration.
 * This isolated Apps Script project must be deployed separately from attendance-control.
 */

const YARN_SETTINGS_CONFIG = Object.freeze({
  TIMEZONE: 'America/La_Paz',
  SHEETS: Object.freeze({
    SETTINGS: 'Settings',
    ASSIGNMENTS: 'DB_Asignaciones',
    WEIGHINGS: 'DB_Descargas',
    ERRORS: 'Errors'
  }),
  RANGES: Object.freeze({
    DATE: 'F4',
    STANDARDS: 'B10:C19',
    TITLE_DROPDOWN: 'D33:D42',
    ASSIGNMENTS: 'B33:H42',
    WEIGHINGS: 'B50:H157',
    SAVE_CHECKBOX: 'K2',
    SAVE_LABEL: 'L2'
  }),
  LIMITS: Object.freeze({
    ASSIGNMENTS_PER_DAY: 10,
    WEIGHINGS_PER_DAY: 80,
    DISCHARGES_PER_MACHINE: 4
  }),
  ASSIGNMENT_HEADERS: Object.freeze([
    'id', 'fecha', 'retorcedora', 'cabos', 'titulo_asignado',
    'frentes_asignados', 'prod_dia', 'prod_turno', 'lotes_dia',
    'creado', 'actualizado', 'editado_por', 'rango_origen'
  ]),
  WEIGHING_HEADERS: Object.freeze([
    'id', 'fecha', 'retorcedora', 'descarga_nro', 'lado', 'titulo',
    'peso_bruto', 'usos', 'peso_cono', 'peso_tacho', 'peso_neto',
    'creado', 'actualizado', 'editado_por', 'rango_origen'
  ]),
  ERRORS_HEADER: Object.freeze([
    'timestamp', 'scope', 'range', 'code', 'reason', 'user'
  ]),
  ERRORS: Object.freeze({
    INVALID_DATE: 'invalid_date',
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
