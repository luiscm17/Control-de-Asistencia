/**
 * Errors.gs — Audit identity and best-effort failure evidence for Yarn Settings.
 */

function yarnEditorEmail_() {
  try {
    const email = Session.getActiveUser().getEmail();
    return email && String(email).trim() ? String(email).trim() : 'unknown';
  } catch (error) {
    return 'unknown';
  }
}

function yarnAuditTimestamp_(date) {
  const value = date || new Date();
  if (typeof Utilities !== 'undefined' && Utilities.formatDate) {
    return Utilities.formatDate(value, YARN_SETTINGS_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  }
  return value.toISOString().replace('T', ' ').slice(0, 19);
}

function yarnLogError_(scope, code, reason, range, spreadsheet) {
  try {
    const ss = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(YARN_SETTINGS_CONFIG.SHEETS.ERRORS);
    if (!sheet) throw new Error('Errors sheet is unavailable.');
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, YARN_SETTINGS_CONFIG.ERRORS_HEADER.length)
      .setValues([[
        yarnAuditTimestamp_(), scope || 'yarn-settings', range || '', code || 'execution_failure',
        reason || '', yarnEditorEmail_()
      ]]);
    return true;
  } catch (error) {
    if (typeof Logger !== 'undefined' && Logger.log) {
      Logger.log('Unable to write Yarn error evidence: ' + error.message);
    }
    return false;
  }
}
