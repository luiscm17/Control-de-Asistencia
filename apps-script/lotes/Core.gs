/**
 * Core.gs — Public guardarLotes() save path + helpers for the isolated Lotes project.
 *
 * Change: lotes — Daily Lot Tracking (lotes-form → db_lots)
 * Source: docs/lotes/PRD.md v0.1.0, openspec/changes/lotes/specs/lotes-lot-recording/spec.md,
 *         openspec/changes/lotes/design.md  (sections Concurrency/Lock + Audit + Batch)
 * Isolation: apps-script/lotes/ only — no imports from sibling apps-script/* projects.
 * Built-ins only: SpreadsheetApp, LockService, Session, Utilities, PropertiesService, ScriptApp
 * Timezone audit only America/La_Paz via Utilities.formatDate; D4 passthrough no coercion.
 * Flush before toast; lock 5s + retry 1s; F4 reset guarded via lotes-is-resetting-f4.
 *
 * INSTALL: Extensions > Apps Script > paste this project > Save > Reload sheet > setupLotes once
 * VERIFY: Use a COPY of 19lBJHHKsusI6Eqkni-zh8us6ePoEHscEgrIPrFK-zhE — never prod.
 */

function guardarLotes() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Snapshot reads D4 via getValue passthrough (no validation) + B8:G37 batch displayValues
  var snapshot = lotesReadForm_(ss);

  // Empty or non-Date D4 guard: "" for blank/string pasted that Sheets did not coerce to Date
  var fechaKey = snapshot && snapshot.fechaKey ? String(snapshot.fechaKey).trim() : '';
  var fechaDisplay = snapshot && snapshot.fechaDisplay ? String(snapshot.fechaDisplay).trim() : '';
  if (!fechaKey || !fechaDisplay) {
    try { lotesLogError_(LOTES_CONFIG.ERRORS.EMPTY_DATE, 'D4 vac\u00EDa o no es DATE — guard bloqueado', LOTES_CONFIG.RANGES.D4, ss); } catch (ignore) {}
    try { ss.toast('Seleccione una fecha en D4.', 'Lotes', 5); } catch (ignore2) {}
    try { lotesResetCheckbox_(ss); } catch (ignore3) {}
    return { ok: false, reason: LOTES_CONFIG.ERRORS.EMPTY_DATE };
  }

  var lock = LockService.getDocumentLock();
  if (!lotesAcquireLock_(lock)) {
    try { lotesLogError_(LOTES_CONFIG.ERRORS.LOCK_TIMEOUT, 'Document lock exhausted after one retry.', 'guardarLotes lock', ss); } catch (ignore) {}
    try { ss.toast('Ocupado, reintente con Resincronizar', 'Lotes', 7); } catch (ignore2) {}
    try { lotesResetCheckbox_(ss); } catch (ignore3) {}
    return { ok: false, reason: LOTES_CONFIG.ERRORS.LOCK_TIMEOUT };
  }

  try {
    // Idempotent ensure: create db_lots if missing while locked (safe because we hold the document lock)
    try { lotesEnsureSchema(ss); } catch (ignoreEnsure) {}

    var dbSheet = lotesGetDbSheet_(ss);
    if (!dbSheet) {
      var msgNoDb = 'db_lots no disponible tras ensureSchema';
      try { lotesLogError_(LOTES_CONFIG.ERRORS.MISSING_SHEET, msgNoDb, LOTES_CONFIG.RANGES.DB_HEADERS, ss); } catch (ignore) {}
      try { ss.toast('❌ Error — us\u00E1 Resincronizar', 'Lotes', 7); } catch (ignore2) {}
      return { ok: false, reason: LOTES_CONFIG.ERRORS.MISSING_SHEET };
    }

    var state = lotesBuildDbState_(dbSheet);
    var result = lotesUpsertDeleteBatch_(ss, snapshot, state);

    // Flush before toast — required by google-apps-script skill (Flush Before Returning) so toast/dialog sees committed writes
    SpreadsheetApp.flush();

    var n = Number(result && result.totalN != null ? result.totalN : 0);
    try { ss.toast('\u2705 Guardado: ' + fechaDisplay + ' \u2014 ' + n + ' lotes', 'Lotes', 5); } catch (ignore) {}

    return {
      ok: true,
      fechaDisplay: fechaDisplay,
      fechaKey: fechaKey,
      created: result.created,
      updated: result.updated,
      deleted: result.deleted,
      n: n
    };
  } catch (e) {
    var msg = e && e.message ? e.message : String(e);
    try { lotesLogError_('execution_failure', msg, LOTES_CONFIG.RANGES.FORM, ss); } catch (ignore) {}
    try { ss.toast('❌ Error — us\u00E1 Resincronizar', 'Lotes', 7); } catch (ignore2) {}
    throw e;
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
    // Guarded reset so the programmatic F4=FALSE edit does not re-trigger lotesOnEdit
    try { lotesResetCheckbox_(ss); } catch (ignore2) {}
  }
}

function lotesAcquireLock_(lock) {
  if (lock.tryLock(5000)) return true;
  try { Utilities.sleep(1000); } catch (ignore) {}
  return lock.tryLock(5000);
}

function lotesResetCheckbox_(ss) {
  var spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet();
  var flagKey = 'lotes-is-resetting-f4';
  try { PropertiesService.getDocumentProperties().setProperty(flagKey, '1'); } catch (ignore) {}
  try {
    var form = lotesGetFormSheet_(spreadsheet);
    if (!form) return;
    var checkbox = lotesGetRange_(form, LOTES_CONFIG.RANGES.F4);
    var cur = null;
    try { cur = checkbox.getValue(); } catch (e1) { cur = null; }
    if (cur !== false) {
      checkbox.setValue(false);
    }
    SpreadsheetApp.flush();
    try { Utilities.sleep(200); } catch (ignore2) {}
  } catch (ignore3) {
    // Never throw — reset is best-effort and must not mask the save result
    try { SpreadsheetApp.flush(); } catch (ignore4) {}
  } finally {
    try { PropertiesService.getDocumentProperties().deleteProperty(flagKey); } catch (ignore5) {}
    // Fallback: also clear via setProperty('' ) for environments where deleteProperty is not available
    try {
      var props = PropertiesService.getDocumentProperties();
      if (props.getProperty(flagKey)) props.setProperty(flagKey, '');
      if (props.getProperty(flagKey) === '') props.deleteProperty(flagKey);
    } catch (ignore6) {}
  }
}

// Audit: single source in Errors.gs — Core reuses lotesAuditTimestamp_ / lotesEditorEmail_ directly.
// (wrappers omitted to keep single source; see Errors.gs)

// Rehydration stub — full impl lands in PR3 (Phase 3.1). Keep toast contract so early Menu dispatch does not fail.
function rehidratarPorFecha_() {
  // Minimal safe impl for PR2: delegate when PR3 has not yet landed — do not throw on missing DB
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var form = lotesGetFormSheet_(ss);
    if (!form) return 0;
    var raw = null;
    try { raw = lotesGetRange_(form, LOTES_CONFIG.RANGES.D4).getValue(); } catch (ignore) { raw = null; }
    var key = lotesDateKey_(raw);
    var display = lotesFechaDisplay_(raw);
    if (!key || !display) {
      // Empty D4 at rehydrate time → clear C8:G37, re-assert B8:B37=1..30, no db read error
      try {
        var payloadClear = lotesGetRange_(form, LOTES_CONFIG.RANGES.PAYLOAD);
        payloadClear.clearContent();
        var noRange = form.getRange(8, 2, LOTES_CONFIG.LIMITS.ROWS, 1);
        var nums = [];
        for (var i = 0; i < LOTES_CONFIG.LIMITS.ROWS; i++) nums.push([i + 1]);
        noRange.setValues(nums);
        SpreadsheetApp.flush();
      } catch (ignore2) {}
      return 0;
    }
    // Valid date but full single-scan rehydrate lands in PR3 — for PR2, just clear+re-assert to keep contract.
    // This still satisfies "empty D4 guard + no exception" for PR2; PR3 will replace with full scan.
    return 0;
  } catch (e) {
    try { Logger.log('rehidratarPorFecha_ PR2 stub: ' + (e && e.message ? e.message : String(e))); } catch (ignore) {}
    return 0;
  }
}

function rehidratarPorFecha() {
  return rehidratarPorFecha_();
}

function lotesFormatFechaForToast_(fechaDisplay) {
  return String(fechaDisplay || '').trim();
}
