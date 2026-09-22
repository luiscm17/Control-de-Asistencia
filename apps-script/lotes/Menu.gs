/**
 * Menu.gs — Menu + trigger wiring for the isolated Lotes project.
 *
 * Change: lotes — Daily Lot Tracking (lotes-form → db_lots)
 * Source: docs/lotes/PRD.md v0.1.0, openspec/changes/lotes/specs/lotes-lot-recording/spec.md
 * Isolation: apps-script/lotes/ only — no imports from sibling apps-script/* projects.
 *
 * Menu: Lotes → Guardar | Resincronizar (2 items only — no Ver db_lots)
 * Save: F4 checkbox FALSE→TRUE triggers installable lotesOnEdit → guardarLotes()
 *       debounce DEBOUNCE_MS=3000 via PropertiesService + F4 reset guard
 * Rehydrate: D4 edit → rehidratarPorFecha_() (read-only, no lock) — wired in PR2/PR3
 * Timezone: audit only via America/La_Paz — never for D4 passthrough.
 * No literal getRange("D4") outside Config.gs — always lotesGetRange_.
 *
 * INSTALL: Extensions > Apps Script > paste > Save > Reload sheet > setupLotes once
 * VERIFY: Use a COPY of 19lBJHHKsusI6Eqkni-zh8us6ePoEHscEgrIPrFK-zhE — never prod.
 */

function onOpen() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    try { lotesEnsureSchema(ss); } catch (ignore) {}
    try { lotesConfigureForm_(ss); } catch (ignore2) {}
  } catch (ignore3) {}
  try {
    SpreadsheetApp.getUi()
      .createMenu('Lotes')
      .addItem('Guardar', 'guardarLotes')
      .addItem('Resincronizar', 'rehidratarPorFecha')
      .addToUi();
  } catch (e) {
    // Ui unavailable in headless/test — ignore
  }
}

// Simple trigger — delegates to lotesOnEdit so F4/D4 work even without installable trigger
function onEdit(e) {
  try { return lotesOnEdit(e); } catch (ignore) {}
}

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

function lotesIsDateEdit_(e) {
  if (!e || !e.range) return false;
  var sheet = null;
  try { sheet = e.range.getSheet(); } catch (ignore) { return false; }
  if (!sheet || sheet.getName() !== LOTES_CONFIG.SHEETS.FORM) return false;
  var pos = lotesParseA1_(LOTES_CONFIG.RANGES.D4);
  return e.range.getRow() === pos.row && e.range.getColumn() === pos.col;
}

// Installable trigger dispatch — full save/rehydrate wiring lands in PR2/PR3.
// Skeleton keeps F4 guard + debounce + delegates to guardarLotes/rehidratarPorFecha_ when available.
function lotesOnEdit(e) {
  // Guard: programmatic F4=FALSE reset sets this flag so the next onEdit is ignored
  try {
    var props = PropertiesService.getDocumentProperties();
    if (props.getProperty('lotes-is-resetting-f4')) return;
  } catch (ignore) {}

  // Save path: F4 FALSE→TRUE
  if (lotesIsSaveCheckboxEvent_(e)) {
    if (lotesIsDebounced_()) {
      try {
        var ssD = (e && e.source) ? e.source : SpreadsheetApp.getActiveSpreadsheet();
        ssD.toast('\u23F3 Guardado reciente, esper\u00E1 3s', 'Lotes', 4);
      } catch (ignore2) {}
      try { e.range.setValue(false); } catch (ignore3) {}
      try { SpreadsheetApp.flush(); } catch (ignore4) {}
      return;
    }
    lotesMarkSaved_();
    try {
      if (typeof guardarLotes === 'function') guardarLotes();
    } catch (err) {
      try { Logger.log('lotesOnEdit guardarLotes error: ' + (err && err.message ? err.message : String(err))); } catch (ignore) {}
    } finally {
      try { e.range.setValue(false); } catch (ignore2) {}
      try { SpreadsheetApp.flush(); } catch (ignore3) {}
    }
    return;
  }

  // Rehydrate path: D4 edit — no lock, read-only
  if (lotesIsDateEdit_(e)) {
    try {
      if (typeof rehidratarPorFecha_ === 'function') rehidratarPorFecha_();
      else if (typeof rehidratarPorFecha === 'function') rehidratarPorFecha();
    } catch (ignore5) {}
  }
}

// Public alias for menu Resincronizar — delegates to private impl when wired (PR3)
function rehidratarPorFecha() {
  if (typeof rehidratarPorFecha_ === 'function') return rehidratarPorFecha_();
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    ss.toast('Resincronizar no disponible hasta completar instalaci\u00F3n.', 'Lotes', 4);
  } catch (ignore) {}
  return 0;
}

function setupLotes() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  lotesEnsureSchema(ss);
  // Create installable trigger lotesOnEdit if not already present — dedupe via handler name
  var triggers = ScriptApp.getProjectTriggers();
  var exists = triggers.some(function (t) {
    return t.getHandlerFunction() === 'lotesOnEdit';
  });
  if (!exists) {
    ScriptApp.newTrigger('lotesOnEdit').forSpreadsheet(ss).onEdit().create();
  }
  try { SpreadsheetApp.getActiveSpreadsheet().toast('Lotes listo — recarg\u00E1 la hoja para ver el men\u00FA.', 'Lotes', 5); } catch (ignore) {}
  SpreadsheetApp.flush();
}
