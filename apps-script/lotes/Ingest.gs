/**
 * Ingest.gs — Form snapshot + trigger-intent helpers for the isolated Lotes project.
 *
 * Change: lotes — Daily Lot Tracking (lotes-form → db_lots)
 * Source: docs/lotes/PRD.md v0.1.0, openspec/changes/lotes/specs/lotes-lot-recording/spec.md
 * Isolation: apps-script/lotes/ only — no imports from sibling apps-script/* projects.
 * Built-ins only: SpreadsheetApp, LockService, Session, Utilities, PropertiesService, ScriptApp
 * D4 is native DATE dd/MM/yyyy passthrough via getValue() — no validation or coercion.
 * B8:H37 30×7 batch read via getDisplayValues through Config SSOT; B (No 1..30) ignored for DB.
 *
 * INSTALL: Extensions > Apps Script > paste this project > Save > Reload sheet > setupLotes once
 * VERIFY: Use a COPY of 19lBJHHKsusI6Eqkni-zh8us6ePoEHscEgrIPrFK-zhE — never prod.
 */

function lotesReadForm_(optSpreadsheet) {
  var ss = optSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  var form = lotesGetFormSheet_(ss);
  if (!form) {
    return { ok: false, error: 'missing_sheet', message: 'lotes-form no encontrada', range: LOTES_CONFIG.RANGES.FORM };
  }
  var fechaRaw = null;
  try {
    fechaRaw = lotesGetRange_(form, LOTES_CONFIG.RANGES.D4).getValue();
  } catch (e) {
    fechaRaw = null;
  }
  // Passthrough: no validation/coercion — only Date instances are valid; strings/blank → empty guard upstream
  var fechaKey = lotesDateKey_(fechaRaw);
  var fechaDisplay = lotesFechaDisplay_(fechaRaw);
  var fechaDate = (fechaRaw instanceof Date && !isNaN(fechaRaw.getTime())) ? fechaRaw : null;

  // Single batch read of B8:H37 as DISPLAY values — C:H are STRING payload (6 cols), B is visual No ignored
  var payload = [];
  try {
    var formRange = lotesGetRange_(form, LOTES_CONFIG.RANGES.FORM);
    payload = formRange.getDisplayValues();
  } catch (e2) {
    payload = [];
  }
  // FORM is B8:H37 30 rows × 7 cols: B=No(0), C=Titulo(1), D=TipoMaterial(2), E=LineaPresentacion(3), F=CodigoLote(4), G=Color(5), H=Observacion(6)
  var rows = [];
  for (var i = 0; i < LOTES_CONFIG.LIMITS.ROWS; i++) {
    var rawRow = payload[i] || ['', '', '', '', '', '', ''];
    var titulo = String(rawRow[1] || '').trim();
    var tipoMaterial = String(rawRow[2] || '');
    var lineaPresentacion = String(rawRow[3] || '');
    var codigoLote = String(rawRow[4] || '');
    var color = String(rawRow[5] || '');
    var observacion = String(rawRow[6] || '');
    rows.push({
      posicion: i + 1,
      titulo: titulo,
      tipo_material: tipoMaterial,
      linea_presentacion: lineaPresentacion,
      codigo_lote: codigoLote,
      color: color,
      observacion: observacion,
      rawRow: rawRow.slice()
    });
  }

  return {
    ok: true,
    fechaRaw: fechaRaw,
    fechaKey: fechaKey,
    fechaDisplay: fechaDisplay,
    fechaDate: fechaDate,
    rows: rows
  };
}

function lotesIsEmptyRow_(r) {
  if (!r) return true;
  // titulo is the persistence gate — empty titulo means no row (whitespace counts as empty)
  var titulo = r.titulo != null ? String(r.titulo).trim() : '';
  if (titulo !== '') return false;
  // Also treat tipo_material/linea_presentacion/codigo_lote/color/observacion in isolation as not enough — titulo is the gate.
  // For rehydration completeness, still consider completely blank C:H as empty.
  var fields = [r.tipo_material, r.linea_presentacion, r.codigo_lote, r.color, r.observacion];
  for (var i = 0; i < fields.length; i++) {
    if (String(fields[i] || '').trim() !== '') return false;
  }
  return true;
}

// --- Trigger-intent helpers: F4 checkbox guard + debounce + D4 edit routing ---
// These also exist in Menu.gs (shared global scope); keep identical so either file load order is safe.

function lotesNormalizeCheckboxValue_(v) {
  if (v === true) return 'TRUE';
  if (v === false) return 'FALSE';
  var s = String(v == null ? '' : v).trim().toUpperCase();
  if (s === 'VERDADERO') return 'TRUE';
  if (s === 'FALSO') return 'FALSE';
  return s;
}

function lotesIsSaveCheckboxEvent_(e) {
  if (!e || !e.range) return false;
  var valNorm = lotesNormalizeCheckboxValue_(e.value);
  var oldNorm = lotesNormalizeCheckboxValue_(e.oldValue);
  var rawOld = String(e.oldValue == null ? '' : e.oldValue).trim();
  var oldIsFalse = oldNorm === 'FALSE' || rawOld === '';
  if (valNorm !== 'TRUE' || !oldIsFalse) return false;
  var range = e.range;
  if (range.getNumRows() !== 1 || range.getNumColumns() !== 1) return false;
  var sheet = null;
  try { sheet = range.getSheet(); } catch (ignore) { return false; }
  if (!sheet || sheet.getName() !== LOTES_CONFIG.SHEETS.FORM) return false;
  var pos = lotesParseA1_(LOTES_CONFIG.RANGES.F4);
  return range.getRow() === pos.row && range.getColumn() === pos.col;
}

function lotesIsDateEdit_(e) {
  if (!e || !e.range) return false;
  var sheet = null;
  try { sheet = e.range.getSheet(); } catch (ignore) { return false; }
  if (!sheet || sheet.getName() !== LOTES_CONFIG.SHEETS.FORM) return false;
  var pos = lotesParseA1_(LOTES_CONFIG.RANGES.D4);
  return e.range.getRow() === pos.row && e.range.getColumn() === pos.col;
}

function lotesIsDebounced_() {
  try {
    var props = PropertiesService.getDocumentProperties();
    var last = props.getProperty('lotes-last-save-ms');
    if (!last) return false;
    var elapsed = new Date().getTime() - Number(last);
    return elapsed < LOTES_CONFIG.UI.DEBOUNCE_MS;
  } catch (e) {
    return false;
  }
}

function lotesMarkSaved_() {
  try {
    PropertiesService.getDocumentProperties().setProperty('lotes-last-save-ms', String(new Date().getTime()));
  } catch (ignore) {}
}
