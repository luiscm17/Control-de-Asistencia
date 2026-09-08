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
  conerasEnsureSaveCheckboxTrigger_();
  SpreadsheetApp.flush();
}

function conerasEnsureSaveCheckboxTrigger_() {
  const handler = 'conerasOnEdit';
  const exists = ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === handler &&
      trigger.getEventType() === ScriptApp.EventType.ON_EDIT;
  });
  if (!exists) ScriptApp.newTrigger(handler).forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
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
  dashboard.getRange('A' + ranges.DASHBOARD_FECHA.slice(1)).setValue('Fecha:');
  const fecha = dashboard.getRange(ranges.DASHBOARD_FECHA);
  fecha.setDataValidation(SpreadsheetApp.newDataValidation().requireDate()
    .setAllowInvalid(false).setHelpText('Seleccioná una fecha válida.').build())
    .setNumberFormat('dd/MM/yyyy');
  dashboard.getRange('A' + ranges.DASHBOARD_EFFICIENCY.slice(1)).setValue('Eficiencia del Personal:');
  const efficiency = dashboard.getRange(ranges.DASHBOARD_EFFICIENCY);
  if (efficiency.getValue() === '') efficiency.setValue(1);
  // Titles E7:E16 are numeric inputs (Escribe el Título) — never overwrite with a QUERY spill.
  // Totals F7:F16 are per-row formulas that query db_coneras filtered by E-row titulo + dashboard filters.
  // Legacy cleanup: previous Setup placed a spilling QUERY at E7; clear any E7:E16 formulas back to input values.
  try {
    const titleRange = dashboard.getRange(ranges.DASHBOARD_TITLES);
    const hasBatchApis = titleRange.getFormulas && titleRange.getValues && titleRange.clearContent && titleRange.setValues;
    if (hasBatchApis) {
      const formulas = titleRange.getFormulas();
      let needsClear = false;
      for (let i = 0; i < formulas.length; i++) {
        const f = String(formulas[i][0] || '');
        if (f && (f.toUpperCase().indexOf('QUERY') !== -1 || f.indexOf('db_coneras') !== -1)) {
          needsClear = true;
          break;
        }
      }
      if (needsClear) {
        const values = titleRange.getValues();
        const sanitized = values.map(function(row) {
          const v = row[0];
          if (typeof v === 'number' && isFinite(v)) return [v];
          if (typeof v === 'string') {
            const t = v.trim();
            if (t === '' || t.charAt(0) === '#' || t.indexOf('Nombre de hoja') !== -1 ||
                t.toLowerCase().indexOf('error de an') !== -1 || t.indexOf('QUERY') !== -1) return [''];
            if (/^-?\d+(\.\d+)?$/.test(t)) return [Number(t)];
            return [t];
          }
          return [''];
        });
        titleRange.clearContent();
        titleRange.setValues(sanitized);
      }
    } else {
      // Fallback per-cell for mocks or limited APIs
      const totalsStartRowFallback = Number(ranges.DASHBOARD_TITLES.split(':')[0].replace(/[^0-9]/g, '')) || 7;
      const totalsEndRowFallback = Number(ranges.DASHBOARD_TITLES.split(':')[1].replace(/[^0-9]/g, '')) || 16;
      const tituloColFallback = ranges.DASHBOARD_TITLES.replace(/[0-9:]/g, '').charAt(0) || 'E';
      for (let row = totalsStartRowFallback; row <= totalsEndRowFallback; row++) {
        const cell = dashboard.getRange(tituloColFallback + row);
        if (cell.getFormula) {
          const f = String(cell.getFormula() || '');
          if (f && (f.toUpperCase().indexOf('QUERY') !== -1 || f.indexOf('db_coneras') !== -1)) {
            if (cell.clearContent) cell.clearContent();
            else if (cell.setValue) {
              const v = cell.getValue ? cell.getValue() : '';
              if (typeof v === 'number' && isFinite(v)) cell.setValue(v);
              else cell.setValue('');
            }
          }
        }
      }
    }
  } catch (e) {
    Logger.log('Dashboard title cleanup skipped: ' + e.message);
  }
  const totalsStartRow = Number(ranges.DASHBOARD_TITLES.split(':')[0].replace(/[^0-9]/g, '')) || 7;
  const totalsEndRow = Number(ranges.DASHBOARD_TITLES.split(':')[1].replace(/[^0-9]/g, '')) || 16;
  const tituloCol = ranges.DASHBOARD_TITLES.replace(/[0-9:]/g, '').charAt(0) || 'E';
  const totalsCol = ranges.DASHBOARD_TOTALS.replace(/[^A-Z]/g, '').charAt(0) || 'F';
  for (let row = totalsStartRow; row <= totalsEndRow; row++) {
    const tituloCell = tituloCol + row;
    const totalsCell = totalsCol + row;
    dashboard.getRange(totalsCell).setFormula(conerasBuildDashboardTotalsFormula_(tituloCell));
  }
  dashboard.getRange(ranges.DASHBOARD_DAILY).setFormula(conerasBuildDashboardQuery_(
    CONERAS_CONFIG.FORMULAS.DASHBOARD_DAILY_SELECT,
    CONERAS_CONFIG.FORMULAS.DASHBOARD_DAILY_GROUP_BY,
    true));
  dashboard.getRange(ranges.DASHBOARD_PIVOT_TITULO).setFormula(conerasBuildDashboardPivotQuery_('F'));
  dashboard.getRange(ranges.DASHBOARD_PIVOT_MAQUINA).setFormula(conerasBuildDashboardPivotQuery_('D'));
  dashboard.getRange(ranges.DASHBOARD_PIVOT_TURNO).setFormula(conerasBuildDashboardPivotQuery_('C'));
  conerasEnsureDashboardCharts_(dashboard);
  try { conerasUpdateDashboardTitles_(dashboard); } catch (e) { Logger.log('Dashboard title update skipped: ' + e.message); }
}

function conerasEnsureDashboardCharts_(dashboard) {
  const ranges = CONERAS_CONFIG.RANGES;
  const chartRanges = [
    ranges.DASHBOARD_TOTALS_CHART_RANGE,
    ranges.DASHBOARD_DAILY_CHART_RANGE,
    ranges.DASHBOARD_PIVOT_TITULO_CHART_RANGE,
    ranges.DASHBOARD_PIVOT_MAQUINA_CHART_RANGE,
    ranges.DASHBOARD_PIVOT_TURNO_CHART_RANGE
  ];
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
    .setOption('title', conerasDashboardChartTitle_('Evolución Total Diaria', dashboard))
    .build());
  dashboard.insertChart(dashboard.newChart()
    .setChartType(Charts.ChartType.AREA)
    .addRange(dashboard.getRange(ranges.DASHBOARD_PIVOT_TITULO_CHART_RANGE))
    .setPosition(26, 10, 0, 0)
    .setOption('title', conerasDashboardChartTitle_('Evolución por Título', dashboard))
    .setOption('isStacked', true)
    .build());
  dashboard.insertChart(dashboard.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(dashboard.getRange(ranges.DASHBOARD_PIVOT_MAQUINA_CHART_RANGE))
    .setPosition(42, 10, 0, 0)
    .setOption('title', conerasDashboardChartTitle_('Evolución por Máquina', dashboard))
    .build());
  dashboard.insertChart(dashboard.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(dashboard.getRange(ranges.DASHBOARD_PIVOT_TURNO_CHART_RANGE))
    .setPosition(58, 10, 0, 0)
    .setOption('title', conerasDashboardChartTitle_('Comparativo por Turno', dashboard))
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
  if (key === 'DB') {
    try {
      // Column B (fecha) is stored as plain string yyyy-MM-dd (calendar date only, no timezone).
      // Plain text avoids midnight/21:00 shifts; string comparison `B = '2026-09-07'` matches.
      // Only audit columns (creado/actualizado) use America/La_Paz.
      sheet.getRange('B2:B').setNumberFormat('@');
    } catch (e) {
      Logger.log('Unable to set db_coneras fecha format: ' + e.message);
    }
  }
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
  if (!conerasHasNetWeightFormula_(form.getRange(CONERAS_CONFIG.RANGES.NET_WEIGHT_FIRST).getFormula())) {
    throw new Error('Native formula missing at ' + CONERAS_CONFIG.RANGES.NET_WEIGHT_FIRST + '. Restore it before setup.');
  }
  if (!conerasHasFormula_(form.getRange(CONERAS_CONFIG.RANGES.META_REAL).getFormula())) {
    throw new Error('Native formula missing at ' + CONERAS_CONFIG.RANGES.META_REAL + '. Restore it before setup.');
  }
  if (!conerasHasTotalFormula_(form.getRange(CONERAS_CONFIG.RANGES.TOTAL_NET_WEIGHT).getFormula())) {
    throw new Error('Native formula missing at ' + CONERAS_CONFIG.RANGES.TOTAL_NET_WEIGHT + '. Restore it before setup.');
  }
}

function conerasHasNetWeightFormula_(formula) {
  if (typeof formula !== 'string') return false;
  const trimmed = formula.trim();
  if (trimmed.charAt(0) !== '=') return false;
  const upper = trimmed.toUpperCase();
  const normalized = upper.replace(/\s+/g, '').replace(/\$/g, '');
  const hasConditional = normalized.indexOf('SI(') !== -1 || normalized.indexOf('IF(') !== -1;
  if (!hasConditional) return false;
  const hasNumberCheck = normalized.indexOf('ESNUMERO') !== -1 || normalized.indexOf('ISNUMBER') !== -1;
  if (!hasNumberCheck) return false;
  if (normalized.indexOf('MAX') === -1) return false;
  if (normalized.indexOf('D8') === -1 || normalized.indexOf('E8') === -1 ||
      normalized.indexOf('F8') === -1 || normalized.indexOf('G8') === -1) return false;
  return true;
}

function conerasHasFormula_(formula) {
  return typeof formula === 'string' && formula.trim().charAt(0) === '=';
}

function conerasHasTotalFormula_(formula) {
  if (typeof formula !== 'string') return false;
  const trimmed = formula.trim();
  if (trimmed.charAt(0) !== '=') return false;
  const upper = trimmed.toUpperCase();
  const hasSum = upper.indexOf('SUMA') !== -1 || upper.indexOf('SUM') !== -1;
  if (!hasSum) return false;
  const normalized = upper.replace(/\s+/g, '').replace(/\$/g, '');
  return normalized.indexOf('H8:H22') !== -1;
}
