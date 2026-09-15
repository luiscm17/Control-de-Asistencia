/**
 * Errors.gs — Best-effort, La Paz timestamped error evidence for Dyeing.
 * Writes to `Errors` A:F (timestamp, scope, range, code, reason, user).
 * Never throws — returns boolean. Isolated to apps-script/dyeing/.
 */

function dyeingEditorEmail_() {
  try {
    var active = Session.getActiveUser().getEmail();
    if (active && String(active).trim()) return String(active).trim();
    var effective = Session.getEffectiveUser().getEmail();
    return effective && String(effective).trim() ? String(effective).trim() : 'unknown';
  } catch (e) {
    return 'unknown';
  }
}

function dyeingAuditTimestamp_(date) {
  try {
    return Utilities.formatDate(date || new Date(), DYEING_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  } catch (e) {
    var d = date || new Date();
    return d.toISOString().replace('T', ' ').slice(0, 19);
  }
}

function dyeingLogError_(code, reason, range, optSpreadsheet) {
  try {
    var ss = optSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(DYEING_CONFIG.SHEETS.ERRORS);
    if (!sheet) {
      try {
        dyeingEnsureSchema(ss);
        sheet = ss.getSheetByName(DYEING_CONFIG.SHEETS.ERRORS);
      } catch (ignore) {}
    }
    if (!sheet) throw new Error('Errors sheet is unavailable.');
    var width = DYEING_CONFIG.LIMITS.ERROR_COLUMNS;
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, width).setValues([[
      dyeingAuditTimestamp_(),
      'dyeing',
      range || '',
      code || 'execution_failure',
      reason || '',
      dyeingEditorEmail_()
    ]]);
    return true;
  } catch (error) {
    try { Logger.log('Unable to write Dyeing error evidence: ' + error.message); } catch (ignore) {}
    return false;
  }
}
