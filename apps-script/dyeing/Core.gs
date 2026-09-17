/**
 * Core.gs — Explicit save + re-hydration for the isolated Dyeing (Teñido) project.
 *
 * Guard path: trim(C3) blocks empty/whitespace — no row, toast ⚠️, log Errors, reset G4.
 * Lock: LockService.getDocumentLock() tryLock(5000) → sleep 1000 → tryLock(5000) or ❌.
 * Upsert: typed batch read (Ingest) → Map A→row (Persistence) → preserve Z creado,
 *         refresh AA/AB, void/active via all B:Y empty, AD rango_origen.
 * Audit: Utilities.formatDate(..., America/La_Paz) via Errors helpers.
 * Toasts: ✅ Guardado: {ID} — {Color} {Código} por {user} on success.
 *
 * INSTALL: Extensions > Apps Script > paste this project > Save > Reload sheet
 * VERIFY:  Use a COPY — never prod.
 */

function guardarLote() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tenidos = null;
  try { tenidos = dyeingGetSheet_(ss, 'TENIDOS'); } catch (ignore) {}
  if (!tenidos) {
    var msgMissing = 'Hoja tenidos no encontrada';
    try { dyeingLogError_(DYEING_CONFIG.ERRORS.MISSING_SHEET, msgMissing, DYEING_CONFIG.RANGES.PK, ss); } catch (ignore2) {}
    try { ss.toast('❌ Error — usá Re-sincronizar', 'Teñido', 7); } catch (ignore3) {}
    return { ok: false, reason: DYEING_CONFIG.ERRORS.MISSING_SHEET };
  }

  var loteRaw = '';
  try { loteRaw = String(dyeingGetRange_(tenidos, DYEING_CONFIG.RANGES.PK).getDisplayValue() || ''); } catch (e) { loteRaw = ''; }
  var loteId = loteRaw.trim();

  if (!loteId) {
    try { dyeingLogError_(DYEING_CONFIG.ERRORS.EMPTY_LOTE, 'C3 vacío — guard bloqueado', DYEING_CONFIG.RANGES.PK, ss); } catch (ignore) {}
    try { ss.toast('⚠️ Ingresá ID Lote en C3', 'Teñido', 5); } catch (ignore2) {}
    dyeingResetCheckbox_(ss);
    return { ok: false, reason: DYEING_CONFIG.ERRORS.EMPTY_LOTE };
  }

  var lock = LockService.getDocumentLock();
  if (!dyeingAcquireLock_(lock)) {
    try { dyeingLogError_(DYEING_CONFIG.ERRORS.LOCK_TIMEOUT, 'Document lock exhausted after one retry.', DYEING_CONFIG.RANGES.PK, ss); } catch (ignore) {}
    try { ss.toast('❌ Error — usá Re-sincronizar', 'Teñido', 7); } catch (ignore2) {}
    return { ok: false, reason: DYEING_CONFIG.ERRORS.LOCK_TIMEOUT };
  }

  try {
    var snapshot = dyeingReadForm_(ss);
    if (!snapshot || !snapshot.ok) {
      var errCode = (snapshot && snapshot.error) || DYEING_CONFIG.ERRORS.VALIDATION_FAILED;
      var errRange = (snapshot && snapshot.range) || DYEING_CONFIG.RANGES.PK;
      try { dyeingLogError_(errCode, (snapshot && snapshot.message) || 'snapshot falló', errRange, ss); } catch (ignore) {}
      try { ss.toast('❌ Error — usá Re-sincronizar', 'Teñido', 7); } catch (ignore2) {}
      return { ok: false, reason: errCode };
    }
    // Enforce trimmed ID for PK consistency (Ingest already trims, but re-assert)
    snapshot.loteId = loteId;

    var result = dyeingUpsertLote_(ss, snapshot);
    SpreadsheetApp.flush();

    var color = String((snapshot.dbBY && snapshot.dbBY[0]) || '').trim();
    var codigo = String((snapshot.dbBY && snapshot.dbBY[1]) || '').trim();
    var cliente = String((snapshot.dbBY && snapshot.dbBY[9]) || '').trim();
    var detalle = '';
    if (color || codigo) detalle = (color + ' ' + codigo).trim();
    else if (cliente) detalle = cliente;
    else detalle = '—';
    var editor = dyeingEditorEmail_();
    var estadoLabel = result && result.estado ? ' (' + result.estado + ')' : '';
    try { ss.toast('✅ Guardado: ' + loteId + ' — ' + detalle + ' por ' + editor + estadoLabel, 'Teñido', 5); } catch (ignore) {}

    dyeingResetCheckbox_(ss);
    return { ok: true, loteId: loteId, rowNum: result.rowNum, estado: result.estado, isNew: result.isNew };
  } catch (e) {
    var msg = e && e.message ? e.message : String(e);
    try { dyeingLogError_('execution_failure', msg, DYEING_CONFIG.RANGES.PK, ss); } catch (ignore) {}
    try { ss.toast('❌ Error — usá Re-sincronizar', 'Teñido', 7); } catch (ignore2) {}
    throw e;
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function dyeingAcquireLock_(lock) {
  if (lock.tryLock(5000)) return true;
  try { Utilities.sleep(1000); } catch (ignore) {}
  return lock.tryLock(5000);
}

function dyeingResetCheckbox_(ss) {
  try {
    var spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet();
    var tenidos = dyeingGetSheet_(spreadsheet, 'TENIDOS');
    if (!tenidos) return;
    var checkbox = dyeingGetRange_(tenidos, DYEING_CONFIG.RANGES.CHECKBOX);
    if (checkbox.getValue() !== false) checkbox.setValue(false);
    SpreadsheetApp.flush();
  } catch (ignore) {}
}

// --- Re-sincronizar: explicit hydrate B6:E15 + B18:E25 where A=C3 ---

function dyeingHydrate_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tenidos = null;
  try { tenidos = dyeingGetSheet_(ss, 'TENIDOS'); } catch (ignore) {}
  if (!tenidos) {
    try { ss.toast('❌ Error — usá Re-sincronizar', 'Teñido', 5); } catch (ignore2) {}
    return 0;
  }
  var loteRaw = '';
  try { loteRaw = String(dyeingGetRange_(tenidos, DYEING_CONFIG.RANGES.PK).getDisplayValue() || ''); } catch (e) { loteRaw = ''; }
  var loteId = loteRaw.trim();
  if (!loteId) {
    try { ss.toast('⚠️ Ingresá ID Lote en C3', 'Teñido', 5); } catch (ignore) {}
    return 0;
  }

  var row = null;
  try { row = dyeingFindDbRowForHydrate_(ss, loteId); } catch (e) { row = null; }
  if (!row) {
    // ID Lote string not found -> clear only inputs for new lot, preserve labels B6:B9, D6:D16, B18:B21, D18:D21
    try {
      var tenidosForClear = dyeingGetSheet_(ss, 'TENIDOS');
      if (tenidosForClear) {
        tenidosForClear.getRange('C6:C9').clearContent();
        tenidosForClear.getRange('E6:E15').clearContent();
        tenidosForClear.getRange('C18:C21').clearContent();
        tenidosForClear.getRange('E18:E25').clearContent();
        SpreadsheetApp.flush();
      }
    } catch (ignoreClear) {}
    try { ss.toast('— sin registros para ' + loteId + ', listo para cargar', 'Teñido', 5); } catch (ignore) {}
    return 0;
  }

  try {
    dyeingWriteForm_(ss, row);
    SpreadsheetApp.flush();
    try { ss.toast('↻ Sincronizado: ' + loteId, 'Teñido', 4); } catch (ignore) {}
    return 1;
  } catch (e) {
    try { dyeingLogError_('hydration_failed', e && e.message ? e.message : String(e), DYEING_CONFIG.RANGES.PK, ss); } catch (ignore) {}
    try { ss.toast('❌ Error — usá Re-sincronizar', 'Teñido', 5); } catch (ignore2) {}
    return 0;
  }
}

// Public alias for menu (must be public — no trailing underscore)
function dyeingResincronizar() {
  return dyeingHydrate_();
}

// Legacy alias kept for menu compatibility
function menuDyeingResincronizar() {
  return dyeingHydrate_();
}
