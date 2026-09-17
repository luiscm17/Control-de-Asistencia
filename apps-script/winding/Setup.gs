/**
 * Setup.gs — Idempotent schema and trigger setup for winding persistence.
 *
 * Run windingSetup manually on a COPY of ctrl_embolsado before deployment.
 * This module does not write form values, formulas, rows 10–11, or row 29.
 */

function windingSetup() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const form = windingRequireFormSheet_(spreadsheet);

  windingEnsureTableSheet_(spreadsheet, WINDING_CONFIG.SHEETS.DATA,
    WINDING_CONFIG.DB_HEADERS, '#e8f0fe');
  windingEnsureTableSheet_(spreadsheet, WINDING_CONFIG.SHEETS.ERRORS,
    WINDING_CONFIG.ERRORS_HEADERS, '#fce8e6');
  windingConfigureForm_(form);
  windingProtectFormulasAndLabels_(form);
  windingReconcileOnEditTrigger_();

  SpreadsheetApp.flush();
  spreadsheet.toast('Configuración de Winding lista.', 'Winding', 5);
}

function windingRequireFormSheet_(spreadsheet) {
  const form = spreadsheet.getSheetByName(WINDING_CONFIG.SHEETS.FORM);
  if (!form) {
    throw new Error('Hoja "' + WINDING_CONFIG.SHEETS.FORM +
      '" no encontrada. Usá una copia con la plantilla antes de configurar.');
  }
  return form;
}

function windingEnsureTableSheet_(spreadsheet, sheetName, headers, color) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) sheet = spreadsheet.insertSheet(sheetName);

  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  const current = headerRange.getDisplayValues()[0].map(function (value) {
    return String(value || '').trim();
  });
  const headerIsEmpty = current.every(function (value) { return value === ''; });
  const expected = headers.join('|');

  if (headerIsEmpty) {
    if (sheet.getLastRow() > 1) {
      throw new Error('Header drift in ' + sheetName + ': populated table has no valid header.');
    }
    headerRange.setValues([headers]);
  } else if (current.join('|') !== expected) {
    throw new Error('Header drift in ' + sheetName + ': expected frozen header order.');
  }

  headerRange.setFontWeight('bold').setBackground(color);
  sheet.setFrozenRows(1);
  windingProtectRange_(sheet, headerRange,
    WINDING_CONFIG.VALIDATION.HEADER_PROTECTION_DESCRIPTION + ': ' + sheetName);
  return sheet;
}

function windingConfigureForm_(form) {
  const dateRule = SpreadsheetApp.newDataValidation()
    .requireDate()
    .setAllowInvalid(false)
    .setHelpText('Seleccioná una fecha válida.')
    .build();
  form.getRange(WINDING_CONFIG.FORM.DATE)
    .setDataValidation(dateRule)
    .setNumberFormat(WINDING_CONFIG.VALIDATION.DATE_FORMAT);

  const checkbox = form.getRange(WINDING_CONFIG.FORM.SAVE_CHECKBOX);
  checkbox.setDataValidation(SpreadsheetApp.newDataValidation()
    .requireCheckbox()
    .setAllowInvalid(false)
    .build());
  if (checkbox.getValue() === '') checkbox.setValue(false);

  const label = form.getRange(WINDING_CONFIG.FORM.SAVE_LABEL);
  if (String(label.getDisplayValue() || '').trim() === '') {
    label.setValue('Guardar turno');
  }

  const numericRange = form.getRange(WINDING_CONFIG.FORM.INPUT_RIGHT);
  numericRange.setDataValidation(SpreadsheetApp.newDataValidation()
    .requireNumberGreaterThanOrEqualTo(0)
    .setAllowInvalid(true)
    .setHelpText('Ingresá un número mayor o igual a cero.')
    .build());
  numericRange.setNumberFormat(WINDING_CONFIG.VALIDATION.NUMBER_FORMAT);
}

function windingProtectFormulasAndLabels_(form) {
  const ranges = [
    WINDING_CONFIG.FORM.META,
    'B10:T11',
    'A29:V29'
  ];
  ranges.forEach(function (a1) {
    windingProtectRange_(form, form.getRange(a1),
      WINDING_CONFIG.VALIDATION.FORM_PROTECTION_DESCRIPTION + ': ' + a1);
  });
}

function windingProtectRange_(sheet, range, description) {
  const exists = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE)
    .some(function (protection) {
      return protection.getDescription() === description &&
        protection.getRange().getA1Notation() === range.getA1Notation();
    });
  if (exists) return;

  try {
    const protection = range.protect();
    protection.setDescription(description);
    protection.setWarningOnly(true);
  } catch (error) {
    Logger.log('Unable to protect ' + range.getA1Notation() + ': ' + error.message);
  }
}

function windingReconcileOnEditTrigger_() {
  const handler = WINDING_CONFIG.VALIDATION.SAVE_TRIGGER_HANDLER;
  let retained = false;

  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() !== handler) return;
    const isInstallableEdit = trigger.getEventType() === ScriptApp.EventType.ON_EDIT;
    if (isInstallableEdit && !retained) {
      retained = true;
      return;
    }
    ScriptApp.deleteTrigger(trigger);
  });

  if (!retained) {
    ScriptApp.newTrigger(handler)
      .forSpreadsheet(SpreadsheetApp.getActive())
      .onEdit()
      .create();
  }
}
