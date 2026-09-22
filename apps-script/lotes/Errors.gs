/**
 * Errors.gs — Best-effort, La Paz timestamped error evidence for Lotes.
 *
 * Change: lotes — Daily Lot Tracking (lotes-form → db_lots)
 * Source: docs/lotes/PRD.md v0.1.0
 * Isolation: apps-script/lotes/ only — no imports from sibling apps-script/* projects.
 * Writes to `Errors` A:F (timestamp, scope, range, code, reason, user).
 * Never throws — returns boolean. Built-ins only.
 *
 * INSTALL: Extensions > Apps Script > paste this project > Save > Reload sheet
 */

function lotesEditorEmail_() {
  try {
    var active = Session.getActiveUser().getEmail();
    if (active && String(active).trim()) return String(active).trim();
    var effective = Session.getEffectiveUser().getEmail();
    return effective && String(effective).trim() ? String(effective).trim() : 'unknown';
  } catch (e) {
    return 'unknown';
  }
}

function lotesAuditTimestamp_(date) {
  try {
    return Utilities.formatDate(date || new Date(), LOTES_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  } catch (e) {
    var d = date || new Date();
    return d.toISOString().replace('T', ' ').slice(0, 19);
  }
}

function lotesLogError_(code, reason, range, optSpreadsheet) {
  try {
    var ss = optSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(LOTES_CONFIG.SHEETS.ERRORS);
    if (!sheet) {
      try {
        lotesEnsureSchema(ss);
        sheet = ss.getSheetByName(LOTES_CONFIG.SHEETS.ERRORS);
      } catch (ignore) {}
    }
    if (!sheet) throw new Error('Errors sheet is unavailable.');
    var width = LOTES_CONFIG.LIMITS.ERROR_COLUMNS;
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, width).setValues([[
      lotesAuditTimestamp_(),
      'lotes',
      range || '',
      code || 'execution_failure',
      reason || '',
      lotesEditorEmail_()
    ]]);
    return true;
  } catch (error) {
    try { Logger.log('Unable to write Lotes error evidence: ' + error.message); } catch (ignore) {}
    return false;
  }
}
