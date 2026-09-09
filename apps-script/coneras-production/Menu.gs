/**
 * Menu.gs — Explicit user actions for the isolated Coneras project.
 */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Coneras')
    .addItem('Guardar Turno', 'menuGuardarTurno')
    .addItem('Ver db_coneras', 'menuVerDb')
    .addItem('Re-sincronizar', 'menuResincronizar')
    .addToUi();
}

function menuGuardarTurno() {
  return guardarTurno();
}

function menuVerDb() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setActiveSheet(conerasRequireSheet_(ss, 'DB'));
}

function menuResincronizar() {
  return conerasHydrate_();
}
