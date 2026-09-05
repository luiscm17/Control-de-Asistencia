/**
 * Menu.gs — Desktop menu and installable K2 save-checkbox handler for Yarn Settings.
 */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Yarn')
    .addItem('Guardar Turno', 'guardarTurno')
    .addSeparator()
    .addItem('Ver DB_Descargas', 'yarnMenuVerDescargas')
    .addItem('Ver DB_Asignaciones', 'yarnMenuVerAsignaciones')
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
  if (!yarnIsSaveCheckboxEvent_(event)) return;
  const checkbox = event.range;
  try {
    guardarTurno();
  } finally {
    Utilities.sleep(1000);
    checkbox.setValue(false);
    SpreadsheetApp.flush();
  }
}

function yarnIsSaveCheckboxEvent_(event) {
  if (!event || !event.range) return false;
  const range = event.range;
  const sheet = range.getSheet();
  if (!sheet || sheet.getName() !== YARN_SETTINGS_CONFIG.SHEETS.SETTINGS) return false;
  if (range.getRow() !== 2 || range.getColumn() !== 11) return false;
  const value = event.value === undefined ? range.getValue() : event.value;
  return value === true || String(value).toUpperCase() === 'TRUE' ||
    String(value).toUpperCase() === 'VERDADERO';
}
