/**
 * Menu.gs — Menu + mobile checkbox debounce for the isolated Dyeing (Teñido) project.
 *
 * Menu: Teñido → Guardar | Re-sincronizar (2 items only — no Ver db_...)
 * Mobile: G4 checkbox FALSE→TRUE triggers installable dyeingOnEdit → guardarLote()
 *         debounce MOBILE_SAVE_DEBOUNCE_MS=3000 via PropertiesService
 *         (document property dyeing-last-save-ms) + always reset G4=FALSE + flush.
 * onOpen: creates menu and ensures G4 checkbox validation (dyeingConfigureForm_).
 * Timezone: audit only via America/La_Paz — never for C6/C18 passthrough.
 * No literal getRange("A1") outside Config.gs — always dyeingGetRange_.
 *
 * INSTALL: Extensions > Apps Script > paste > Save > Reload sheet > dyeingSetup once
 * VERIFY:  Use a COPY — never prod.
 */

function onOpen() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    try { dyeingEnsureSchema(ss); } catch (ignore) {}
    // Fallback ensure G4 directly if schema helper unavailable
    try { dyeingConfigureForm_(ss); } catch (ignore2) {}
  } catch (ignore3) {}
  try {
    SpreadsheetApp.getUi()
      .createMenu('Teñido')
      .addItem('Guardar', 'guardarLote')
      .addItem('Re-sincronizar', 'dyeingResincronizar')
      .addToUi();
  } catch (e) {
    // Ui unavailable in headless/test — ignore
  }
}

// Simple trigger delegate — allows sheet-bound onEdit without install
function dyeingOnEditSimple(e) {
  return dyeingOnEdit(e);
}

function dyeingNormalizeCheckboxValue_(v) {
  if (v === true) return 'TRUE';
  if (v === false) return 'FALSE';
  var s = String(v == null ? '' : v).trim().toUpperCase();
  if (s === 'VERDADERO') return 'TRUE';
  if (s === 'FALSO') return 'FALSE';
  return s;
}

function dyeingIsSaveCheckboxEvent_(e) {
  if (!e || !e.range) return false;
  var valNorm = dyeingNormalizeCheckboxValue_(e.value);
  var oldNorm = dyeingNormalizeCheckboxValue_(e.oldValue);
  var rawOld = String(e.oldValue == null ? '' : e.oldValue).trim();
  var oldIsFalse = oldNorm === 'FALSE' || rawOld === '';
  if (valNorm !== 'TRUE' || !oldIsFalse) return false;
  var range = e.range;
  if (range.getNumRows() !== 1 || range.getNumColumns() !== 1) return false;
  var sheet = null;
  try { sheet = range.getSheet(); } catch (ignore) { return false; }
  if (!sheet || sheet.getName() !== DYEING_CONFIG.SHEETS.TENIDOS) return false;
  var pos = dyeingParseA1_(DYEING_CONFIG.RANGES.CHECKBOX);
  return range.getRow() === pos.row && range.getColumn() === pos.col;
}

function dyeingIsDebounced_() {
  try {
    var props = PropertiesService.getDocumentProperties();
    var last = props.getProperty('dyeing-last-save-ms');
    if (!last) return false;
    var elapsed = new Date().getTime() - Number(last);
    return elapsed < DYEING_CONFIG.UI.DEBOUNCE_MS;
  } catch (e) {
    return false;
  }
}

function dyeingMarkSaved_() {
  try {
    PropertiesService.getDocumentProperties().setProperty('dyeing-last-save-ms', String(new Date().getTime()));
  } catch (ignore) {}
}

function dyeingOnEdit(e) {
  if (!dyeingIsSaveCheckboxEvent_(e)) return;
  var ss = null;
  try { ss = (e && e.source) ? e.source : SpreadsheetApp.getActiveSpreadsheet(); } catch (ignore) {}
  if (dyeingIsDebounced_()) {
    try { (ss || SpreadsheetApp.getActiveSpreadsheet()).toast('⏳ Guardado reciente, esperá 3s', 'Teñido', 4); } catch (ignore2) {}
    // Keep checkbox checked — debounce ignored, caller expects no reset? But spec says reset after ~1s only on handled save.
    // For debounce we still reset to FALSE so next TRUE is detectable? Keep FALSE to allow retry after 3s.
    // Do NOT mark saved — preserve original timestamp.
    try { e.range.setValue(false); } catch (ignore3) {}
    try { SpreadsheetApp.flush(); } catch (ignore4) {}
    return;
  }
  // Mark before save to protect double-tap <3s (mirrors yarn-production M4 note+lock)
  dyeingMarkSaved_();
  try {
    guardarLote();
  } catch (err) {
    try { Logger.log('dyeingOnEdit guardarLote error: ' + (err && err.message ? err.message : String(err))); } catch (ignore) {}
  } finally {
    try { e.range.setValue(false); } catch (ignore2) {}
    try { SpreadsheetApp.flush(); } catch (ignore3) {}
  }
}
