/**
 * Menu.gs — Menu + debounced installable onEdit for the isolated Material Raw (Materia Prima) project.
 *
 * Menu: Materia Prima \u2192 Guardar d\u00EDa | Resincronizar (2 items only — no Ver db)
 * Trigger: F4 checkbox FALSE\u2192TRUE (installable materialRawOnEdit \u2192 materialRawGuardarDia)
 *          + D4 fecha change \u2192 materialRawHydrate_ (rehydrate B7:G37, preserve H)
 *          debounce 3000ms via PropertiesService (document property material-raw-last-save-ms)
 *          + always reset F4=FALSE + flush. onOpen ensures schema + trigger + menu.
 * Timezone: audit only via America/La_Paz — never for D4/A passthrough.
 * No literal getRange("A1") outside Config.gs — always materialRawGetRange_.
 *
 * INSTALL: Extensions > Apps Script > paste > Save > Reload sheet > materialRawSetup once
 * VERIFY:  Use a COPY \u2014 never prod.
 */

function onOpen() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    try { materialRawEnsureSchema(ss); } catch (ignore) {}
    try { materialRawReconcileTrigger_(); } catch (ignore2) {}
  } catch (ignore3) {}
  try {
    SpreadsheetApp.getUi()
      .createMenu('Materia Prima')
      .addItem('Guardar d\u00EDa', 'materialRawGuardarDia')
      .addItem('Resincronizar', 'materialRawResincronizar')
      .addToUi();
  } catch (e) {
    // Ui unavailable in headless/test — ignore
  }
}

// Simple trigger delegate — allows sheet-bound onEdit without install
function onEdit(e) {
  try { return materialRawOnEdit(e); } catch (ignore) {}
}

function materialRawNormalizeCheckboxValue_(v) {
  if (v === true) return 'TRUE';
  if (v === false) return 'FALSE';
  var s = String(v == null ? '' : v).trim().toUpperCase();
  if (s === 'VERDADERO') return 'TRUE';
  if (s === 'FALSO') return 'FALSE';
  return s;
}

function materialRawIsSaveCheckboxEvent_(e) {
  if (!e || !e.range) return false;
  var valNorm = materialRawNormalizeCheckboxValue_(e.value);
  // Fallback to range getValue when e.value is undefined (e.g., programmatic setValue)
  if (valNorm === '' || valNorm === 'FALSE') {
    try { valNorm = materialRawNormalizeCheckboxValue_(e.range.getValue()); } catch (ignore) {}
  }
  var oldNorm = materialRawNormalizeCheckboxValue_(e.oldValue);
  var rawOld = String(e.oldValue == null ? '' : e.oldValue).trim();
  var oldIsFalse = oldNorm === 'FALSE' || rawOld === '';
  if (valNorm !== 'TRUE' || !oldIsFalse) return false;
  var range = e.range;
  if (range.getNumRows() !== 1 || range.getNumColumns() !== 1) return false;
  var sheet = null;
  try { sheet = range.getSheet(); } catch (ignore) { return false; }
  if (!sheet || sheet.getName() !== MATERIAL_RAW_CONFIG.SHEETS.FORM) return false;
  var pos = materialRawParseA1_(MATERIAL_RAW_CONFIG.RANGES.CHECKBOX);
  return range.getRow() === pos.row && range.getColumn() === pos.col;
}

function materialRawIsDateEdit_(e) {
  if (!e || !e.range) return false;
  var sheet = null;
  try { sheet = e.range.getSheet(); } catch (ignore) { return false; }
  if (!sheet || sheet.getName() !== MATERIAL_RAW_CONFIG.SHEETS.FORM) return false;
  var pos = materialRawParseA1_(MATERIAL_RAW_CONFIG.RANGES.DATE);
  return e.range.getRow() === pos.row && e.range.getColumn() === pos.col;
}

function materialRawIsDebounced_() {
  try {
    var props = PropertiesService.getDocumentProperties();
    var last = props.getProperty('material-raw-last-save-ms');
    if (!last) return false;
    var elapsed = new Date().getTime() - Number(last);
    return elapsed < MATERIAL_RAW_CONFIG.UI.DEBOUNCE_MS;
  } catch (e) {
    return false;
  }
}

function materialRawMarkSaved_() {
  try {
    PropertiesService.getDocumentProperties().setProperty('material-raw-last-save-ms', String(new Date().getTime()));
  } catch (ignore) {}
}

function materialRawOnEdit(e) {
  // Route 1: F4 checkbox FALSE\u2192TRUE -> guarded save with debounce
  if (materialRawIsSaveCheckboxEvent_(e)) {
    var ssSave = null;
    try { ssSave = (e && e.source) ? e.source : SpreadsheetApp.getActiveSpreadsheet(); } catch (ignore) {}
    var spreadsheetSave = ssSave || SpreadsheetApp.getActiveSpreadsheet();
    if (materialRawIsDebounced_()) {
      try { spreadsheetSave.toast('\u23F3 Guardado reciente, esper\u00E1 3s', 'Materia Prima', 4); } catch (ignore2) {}
      // Keep debounce guard: reset F4 to FALSE so next TRUE is detectable, but do not mark saved
      try { e.range.setValue(false); } catch (ignore3) {}
      try { SpreadsheetApp.flush(); } catch (ignore4) {}
      return;
    }
    materialRawMarkSaved_();
    try {
      materialRawGuardarDia();
    } catch (err) {
      try { Logger.log('materialRawOnEdit guardar error: ' + (err && err.message ? err.message : String(err))); } catch (ignore) {}
      try { materialRawLogError_('onEdit', 'guardar_failed', err && err.message ? err.message : String(err), MATERIAL_RAW_CONFIG.RANGES.CHECKBOX, spreadsheetSave); } catch (ignore2) {}
    } finally {
      // materialRawGuardarDia already resets F4 in finally; ensure once more for installable path
      try { e.range.setValue(false); } catch (ignore3) {}
      try { SpreadsheetApp.flush(); } catch (ignore4) {}
    }
    return;
  }

  // Route 2: D4 fecha change -> rehydrate B7:G37 (no save, no debounce)
  if (materialRawIsDateEdit_(e)) {
    try {
      var ssHyd = (e && e.source) ? e.source : SpreadsheetApp.getActiveSpreadsheet();
      // Read native fecha from D4 (event value may be stale; prefer sheet getValue)
      var fechaVal = null;
      try {
        var form = materialRawGetFormSheet_(ssHyd);
        if (form) fechaVal = form.getRange(MATERIAL_RAW_CONFIG.RANGES.DATE).getValue();
        else fechaVal = e.range.getValue();
      } catch (ignore) {
        try { fechaVal = e.range.getValue(); } catch (ignore2) { fechaVal = null; }
      }
      // Only hydrate if fecha is a valid native Date; empty -> clear via hydrate miss path handled there
      // Call hydrate with ssHyd + fechaVal (hydrate handles invalid toast)
      materialRawHydrate_(ssHyd, fechaVal);
    } catch (err2) {
      try { Logger.log('materialRawOnEdit hydrate error: ' + (err2 && err2.message ? err2.message : String(err2))); } catch (ignore) {}
    }
    return;
  }
}
