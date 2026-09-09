/**
 * Errors.gs — Best-effort, La Paz timestamped error evidence for Coneras.
 */

function conerasEditorEmail_() {
  try {
    const active = Session.getActiveUser().getEmail();
    if (active && String(active).trim()) return String(active).trim();
    const effective = Session.getEffectiveUser().getEmail();
    return effective && String(effective).trim() ? String(effective).trim() : 'unknown';
  } catch (error) {
    return 'unknown';
  }
}

function conerasAuditTimestamp_(date) {
  return Utilities.formatDate(date || new Date(), CONERAS_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
}

function conerasToastForError_(code) {
  if (code === CONERAS_CONFIG.ERRORS.LOCK_TIMEOUT) return '❌ Error — usá Re-sincronizar';
  return '⚠️ Revisá los datos del formulario antes de guardar.';
}

function conerasLogError_(code, reason, range, spreadsheet) {
  try {
    const ss = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
    const sheet = conerasGetSheet_(ss, 'ERRORS');
    if (!sheet) throw new Error('Errors sheet is unavailable.');
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, CONERAS_CONFIG.LIMITS.ERROR_COLUMNS).setValues([[
      conerasAuditTimestamp_(), 'coneras-production', range || '', code || 'execution_failure',
      reason || '', conerasEditorEmail_()
    ]]);
    return true;
  } catch (error) {
    Logger.log('Unable to write Coneras error evidence: ' + error.message);
    return false;
  }
}
