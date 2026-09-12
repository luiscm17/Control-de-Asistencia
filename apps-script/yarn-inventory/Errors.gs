/**
 * Errors.gs — Best-effort, La Paz timestamped error evidence for Yarn Inventory.
 * Writes to `Errors` A:F (timestamp, scope, range, code, reason, user).
 * Never throws — returns boolean. Isolated to apps-script/yarn-inventory/.
 */

function yarnInventoryEditorEmail_() {
  try {
    var active = Session.getActiveUser().getEmail();
    if (active && String(active).trim()) return String(active).trim();
    var effective = Session.getEffectiveUser().getEmail();
    return effective && String(effective).trim() ? String(effective).trim() : 'unknown';
  } catch (e) {
    return 'unknown';
  }
}

function yarnInventoryAuditTimestamp_(date) {
  try {
    return Utilities.formatDate(date || new Date(), YARN_INVENTORY_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  } catch (e) {
    var d = date || new Date();
    return d.toISOString().replace('T', ' ').slice(0, 19);
  }
}

function yarnInventoryLogError_(code, reason, range, optSpreadsheet) {
  try {
    var ss = optSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(YARN_INVENTORY_CONFIG.SHEETS.ERRORS);
    if (!sheet) {
      // Re-sincronizar should have created it — create lazily without throwing
      try {
        yarnInventoryEnsureSchema(ss);
        sheet = ss.getSheetByName(YARN_INVENTORY_CONFIG.SHEETS.ERRORS);
      } catch (ignore) {}
    }
    if (!sheet) throw new Error('Errors sheet is unavailable.');
    var width = YARN_INVENTORY_CONFIG.LIMITS.ERROR_COLUMNS;
    sheet.getRange(sheet.getLastRow() + 1, 1, 1, width).setValues([[
      yarnInventoryAuditTimestamp_(),
      'yarn-inventory',
      range || '',
      code || 'execution_failure',
      reason || '',
      yarnInventoryEditorEmail_()
    ]]);
    return true;
  } catch (error) {
    try { Logger.log('Unable to write YarnInventory error evidence: ' + error.message); } catch (ignore) {}
    return false;
  }
}
