/**
 * Setup.gs — COPY-only schema and form validation installer for Coneras.
 */

function conerasSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const form = conerasRequireSheet_(ss, 'CONERA');
  conerasEnsureTableSheet_(ss, 'DB', 'DB_HEADERS', CONERAS_CONFIG.DB_HEADERS, CONERAS_CONFIG.UI.DB_HEADER_COLOR);
  conerasEnsureTableSheet_(ss, 'ERRORS', 'ERRORS_HEADERS', CONERAS_CONFIG.ERRORS_HEADERS, CONERAS_CONFIG.UI.ERRORS_HEADER_COLOR);
  conerasConfigureForm_(form);
  conerasConfigureDashboard_(conerasRequireSheet_(ss, 'DASHBOARD'));
  conerasVerifyNativeFormulas_(form);
  SpreadsheetApp.flush();
}

function conerasConfigureDashboard_(dashboard) {
  const ranges = CONERAS_CONFIG.RANGES;
  const controls = [
    ['Periodo', ranges.DASHBOARD_PERIODO, CONERAS_CONFIG.DASHBOARD.PERIODO_VALUES, 'Fecha'],
    ['Turno', ranges.DASHBOARD_TURNO, ['Todos'].concat(CONERAS_CONFIG.TURNO_VALUES), 'Todos'],
    ['Máquina', ranges.DASHBOARD_MAQUINA, ['Todos'].concat(CONERAS_CONFIG.MAQUINA_VALUES), 'Todos'],
    ['Supervisor', ranges.DASHBOARD_SUPERVISOR, ['Todos'], 'Todos']
  ];
  controls.forEach(function (control) {
    const valueRange = dashboard.getRange(control[1]);
    dashboard.getRange('A' + control[1].slice(1)).setValue(control[0]);
    valueRange.setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInList(control[2], true).setAllowInvalid(false).build());
    if (valueRange.getValue() === '') valueRange.setValue(control[3]);
  });
  dashboard.getRange('A8').setValue('Fecha');
  const fecha = dashboard.getRange(ranges.DASHBOARD_FECHA);
  fecha.setDataValidation(SpreadsheetApp.newDataValidation().requireDate()
    .setAllowInvalid(false).setHelpText('Seleccioná una fecha válida.').build())
    .setNumberFormat('dd/MM/yyyy');
  dashboard.getRange('A7').setValue('Eficiencia');
  const efficiency = dashboard.getRange(ranges.DASHBOARD_EFFICIENCY);
  if (efficiency.getValue() === '') efficiency.setValue(1);
  dashboard.getRange(ranges.DASHBOARD_TOTALS).setFormula(conerasBuildDashboardQuery_(
    CONERAS_CONFIG.FORMULAS.DASHBOARD_TOTALS_SELECT,
    CONERAS_CONFIG.FORMULAS.DASHBOARD_TOTALS_GROUP_BY,
    false));
  dashboard.getRange(ranges.DASHBOARD_DAILY).setFormula(conerasBuildDashboardQuery_(
    CONERAS_CONFIG.FORMULAS.DASHBOARD_DAILY_SELECT,
    CONERAS_CONFIG.FORMULAS.DASHBOARD_DAILY_GROUP_BY,
    true));
  conerasEnsureDashboardCharts_(dashboard);
}

function conerasEnsureDashboardCharts_(dashboard) {
  const ranges = CONERAS_CONFIG.RANGES;
  const chartRanges = [ranges.DASHBOARD_TOTALS_CHART_RANGE, ranges.DASHBOARD_DAILY_CHART_RANGE];
  dashboard.getCharts().forEach(function (chart) {
    const isManaged = chart.getRanges().some(function (range) {
      return chartRanges.indexOf(range.getA1Notation()) !== -1;
    });
    if (isManaged) dashboard.removeChart(chart);
  });
  dashboard.insertChart(dashboard.newChart()
    .setChartType(Charts.ChartType.BAR)
    .addRange(dashboard.getRange(ranges.DASHBOARD_TOTALS_CHART_RANGE))
    .setPosition(10, 1, 0, 0)
    .setOption('title', 'Peso Neto por Título')
    .build());
  dashboard.insertChart(dashboard.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(dashboard.getRange(ranges.DASHBOARD_DAILY_CHART_RANGE))
    .setPosition(10, 10, 0, 0)
    .setOption('title', 'Evolución diaria (Semana/Mes)')
    .build());
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
