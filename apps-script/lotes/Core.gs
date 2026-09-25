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

  // Snapshot reads D4 via getValue passthrough (no validation) + B8:H37 batch displayValues
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

/**
 * rehidratarPorFecha_ — full single-scan rehydrate (PR3 Phase 3.1).
 *
 * - D4 passthrough via getValue() — empty/invalid Date clears C8:H37, re-asserts B8:B37=1..30, flush, toast, return 0
 * - Valid date: derive fechaDisplay (dd/MM/yyyy) + fechaKey (yyyy-MM-dd), single getValues() scan of db_lots A:L (no lock, read-only),
 *   build posicion→row map where row[ID]==fechaKey-posicion canonical OR row[FECHA]==fechaDisplay fallback (legacy display),
 *   clear C8:H37, build 30x6 matrix C:H ordered by posicion 1..30 (empty strings for missing), setValues on C8:H37,
 *   re-assert B8:B37=1..30, flush, toast "↻ Sincronizado: dd/MM/yyyy — M lotes" or "— sin registros para dd/MM/yyyy, listo para cargar".
 * - Writes only C:H (payload) + B No re-assert — B never persisted per spec "No column persisted".
 */
function rehidratarPorFecha_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var form = lotesGetFormSheet_(ss);
  if (!form) return 0;
  var raw = null;
  try { raw = lotesGetRange_(form, LOTES_CONFIG.RANGES.D4).getValue(); } catch (ignore) { raw = null; }
  var fechaKey = lotesDateKey_(raw);
  var fechaDisplay = lotesFechaDisplay_(raw);
  // Empty or invalid D4 — clear payload, re-assert No 1..30, no DB read error
  if (!fechaKey || !fechaDisplay) {
    try {
      lotesGetRange_(form, LOTES_CONFIG.RANGES.PAYLOAD).clearContent();
      var noRange = form.getRange(8, 2, LOTES_CONFIG.LIMITS.ROWS, 1);
      var nums = [];
      for (var i = 0; i < LOTES_CONFIG.LIMITS.ROWS; i++) nums.push([i + 1]);
      noRange.setValues(nums);
      SpreadsheetApp.flush();
      try { ss.toast('Seleccione una fecha en D4 para rehidratar.', 'Lotes', 4); } catch (ignoreToast) {}
    } catch (ignore2) {}
    return 0;
  }
  // Valid date — single batch scan of db_lots A:L (no lock, read-only)
  var dbSheet = lotesGetDbSheet_(ss);
  var byPos = {};
  if (dbSheet && dbSheet.getLastRow() >= 2) {
    try {
      var lastRow = dbSheet.getLastRow();
      var width = LOTES_CONFIG.LIMITS.COLS;
      var values = dbSheet.getRange(2, 1, lastRow - 1, width).getValues();
      for (var r = 0; r < values.length; r++) {
        var row = values[r];
        var id = String(row[LOTES_CONFIG.IDX.ID] || '').trim();
        var fechaCol = String(row[LOTES_CONFIG.IDX.FECHA] || '').trim();
        var pos = 0;
        // Canonical PK match: id == fechaKey-posicion
        if (id.indexOf(fechaKey + '-') === 0) {
          var suffix = id.substring((fechaKey + '-').length);
          pos = parseInt(suffix, 10);
          if (pos >= 1 && pos <= LOTES_CONFIG.LIMITS.ROWS && !byPos[pos]) {
            byPos[pos] = row;
            continue;
          }
        }
        // Fallback: legacy display comparison on fecha column (dd/MM/yyyy)
        if (fechaCol === fechaDisplay) {
          var dash = id.lastIndexOf('-');
          if (dash > -1) {
            var legacyPos = parseInt(id.substring(dash + 1), 10);
            if (legacyPos >= 1 && legacyPos <= LOTES_CONFIG.LIMITS.ROWS && !byPos[legacyPos]) {
              byPos[legacyPos] = row;
            }
          }
        }
      }
    } catch (eScan) {
      try { Logger.log('rehidratarPorFecha_ scan: ' + (eScan && eScan.message ? eScan.message : String(eScan))); } catch (ignore) {}
    }
  }
  // Clear C8:H37 then build 30x6 matrix C:H by posicion (empty strings for missing)
  try { lotesGetRange_(form, LOTES_CONFIG.RANGES.PAYLOAD).clearContent(); } catch (ignoreClear) {}
  var matrix = [];
  var matched = 0;
  for (var p = 1; p <= LOTES_CONFIG.LIMITS.ROWS; p++) {
    var entry = byPos[p];
    if (entry) {
      matched++;
      matrix.push([
        String(entry[LOTES_CONFIG.IDX.TITULO] || ''),
        String(entry[LOTES_CONFIG.IDX.TIPO_MATERIAL] || ''),
        String(entry[LOTES_CONFIG.IDX.LINEA_PRESENTACION] || ''),
        String(entry[LOTES_CONFIG.IDX.CODIGO_LOTE] || ''),
        String(entry[LOTES_CONFIG.IDX.COLOR] || ''),
        String(entry[LOTES_CONFIG.IDX.OBSERVACION] || '')
      ]);
    } else {
      matrix.push(['', '', '', '', '', '']);
    }
  }
  try {
    lotesGetRange_(form, LOTES_CONFIG.RANGES.PAYLOAD).setValues(matrix);
    // Re-assert B8:B37 1..30 — visual No invariant (B never persisted, never overwritten by DB)
    var noVals = [];
    for (var k = 0; k < LOTES_CONFIG.LIMITS.ROWS; k++) noVals.push([k + 1]);
    form.getRange(8, 2, LOTES_CONFIG.LIMITS.ROWS, 1).setValues(noVals);
    SpreadsheetApp.flush();
    if (matched > 0) {
      try { ss.toast('\u21BB Sincronizado: ' + fechaDisplay + ' \u2014 ' + matched + ' lotes', 'Lotes', 4); } catch (ignoreToast2) {}
    } else {
      try { ss.toast('\u21BB Sincronizado: ' + fechaDisplay + ' \u2014 sin registros para ' + fechaDisplay + ', listo para cargar', 'Lotes', 5); } catch (ignoreToast3) {}
    }
  } catch (eWrite) {
    try { Logger.log('rehidratarPorFecha_ write: ' + (eWrite && eWrite.message ? eWrite.message : String(eWrite))); } catch (ignore) {}
  }
  return matched;
}

// Public alias for menu Lotes → Resincronizar (must not end with underscore per spec)
function rehidratarPorFecha() {
  return rehidratarPorFecha_();
}

function lotesFormatFechaForToast_(fechaDisplay) {
  return String(fechaDisplay || '').trim();
}
