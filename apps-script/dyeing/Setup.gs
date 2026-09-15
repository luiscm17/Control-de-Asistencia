/**
 * Setup.gs — COPY-only installer for the isolated Dyeing (Teñido) project.
 *
 * Ensures db_tenidos A:AD (30 cols frozen) + Errors + G4 checkbox (FALSE/TRUE)
 * plus installable trigger dyeingOnEdit. Idempotent — safe to re-run.
 *
 * INSTALL: Extensions > Apps Script > paste > Save > Run dyeingSetup once > Reload
 * VERIFY:  Use a COPY — never prod.
 */

function dyeingSetup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  dyeingEnsureSchema(ss);
  dyeingEnsureDyeingTrigger_();
  SpreadsheetApp.flush();
  try { ss.toast('✅ Esquema verificado — tenidos/db_tenidos/Errors listos', 'Teñido', 5); } catch (ignore) {}
  return { ok: true };
}

function dyeingEnsureDyeingTrigger_() {
  var handler = 'dyeingOnEdit';
  var triggers = [];
  try { triggers = ScriptApp.getProjectTriggers(); } catch (e) { triggers = []; }
  var exists = triggers.some(function (t) {
    try {
      return t.getHandlerFunction() === handler && t.getEventType() === ScriptApp.EventType.ON_EDIT;
    } catch (ignore) { return false; }
  });
  if (!exists) {
    try {
      ScriptApp.newTrigger(handler).forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
    } catch (e) {
      // Re-throw as setup failure — caller should authorize
      throw new Error('No se pudo instalar trigger dyeingOnEdit: ' + (e && e.message ? e.message : String(e)));
    }
  }
  return exists;
}

// Convenience: remove trigger (for rollback tests)
function dyeingRemoveTrigger_() {
  var handler = 'dyeingOnEdit';
  var triggers = [];
  try { triggers = ScriptApp.getProjectTriggers(); } catch (e) { return 0; }
  var removed = 0;
  triggers.forEach(function (t) {
    try {
      if (t.getHandlerFunction() === handler) {
        ScriptApp.deleteTrigger(t);
        removed += 1;
      }
    } catch (ignore) {}
  });
  return removed;
}
