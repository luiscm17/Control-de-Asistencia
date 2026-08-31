/**
 * Control de Asistencia — Registro Centralization (PR 1 Foundation)
 *
 * Centralizes 6 section sheets + Apoyo into Registro (A:M) via installable onEdit.
 * This PR scaffolds foundation only: CONFIG, Registro header, Config/Errors sheets, onOpen.
 * No ingest/window/lock logic yet — that ships in PR 2 (Core Ingest).
 *
 * INSTALL: Extensions > Apps Script > paste Code.gs + appsscript.json > Save > Reload sheet
 * VERIFY:  Use a COPY of 1iw9bduLeGXQMbjmMV1qrMqE2WoPWCBz3 — never prod.
 */

// --- CONFIGURATION ---
const CONFIG = {
  INPUT: 'E15:AI44',
  INPUT_ROW_START: 15,
  INPUT_ROW_END: 44,
  INPUT_COL_START: 5, // E
  INPUT_COL_END: 35,  // AI
  CALENDAR: ['S7:U7', 'S9:U9'],
  APOYO_RANGE: 'Apoyo!A3:E3',
  REGISTRO: 'Registro',
  CONFIG_SHEET: 'Config',
  ERRORS: 'Errors',
  CODES: ['A', 'AT', 'BM', 'F'],
  LABELS: { A: 'Asistencia', AT: 'Tardanza', BM: 'Baja Médica', F: 'Falta' },
  HEADER: [
    'record_id', 'created_at', 'updated_at', 'section', 'operator_name',
    'date', 'code', 'code_label', 'is_apoyo', 'edited_by', 'source_range', 'nota', 'status'
  ],
  ERRORS_HEADER: ['timestamp', 'section', 'range', 'code', 'reason', 'user'],
  CONFIG_HEADER: ['key', 'value'],
  TIMEZONE: 'America/Lima'
};

// --- MENU SETUP (scaffold — full 6 items land in PR 3) ---
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Asistencia')
    .addItem('Ver Registro', 'menuVerRegistro')
    .addItem('Autorizar', 'menuAutorizar')
    .addToUi();
}

// Public stubs called from menu — full logic in PR 3
function menuVerRegistro() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.REGISTRO);
  if (!sh) {
    ss.toast('Registro no encontrado. Ejecutá Autorizar.', 'Asistencia', 5);
    return;
  }
  ss.setActiveSheet(sh);
}

function menuAutorizar() {
  setupInstallable();
}

// --- PK / WINDOW / CALENDAR HELPERS (scaffold — wired in PR 2) ---

function recordId(section, operatorName, isoDate) {
  return `${section}-${operatorName}-${isoDate}`;
}

function isInWindow(isoDate) {
  const today = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
  const yesterday = Utilities.formatDate(new Date(Date.now() - 864e5), CONFIG.TIMEZONE, 'yyyy-MM-dd');
  return isoDate === today || isoDate === yesterday;
}

function getYearMonth(sheet) {
  // Merged ranges S7:U7 / S9:U9 — normalize via getDisplayValue().trim()
  let y = '';
  let m = '';
  try {
    y = String(sheet.getRange('S7:U7').getDisplayValue() || sheet.getRange('S7').getValue()).trim();
  } catch (e) {
    y = String(sheet.getRange('S7').getValue()).trim();
  }
  try {
    m = String(sheet.getRange('S9:U9').getDisplayValue() || sheet.getRange('S9').getValue()).trim();
  } catch (e) {
    m = String(sheet.getRange('S9').getValue()).trim();
  }
  return { y: y, m: m };
}

function validateHoja2() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja2 = ss.getSheetByName('Hoja2');
  if (!hoja2) return false;
  try {
    const months = hoja2.getRange('A1:B12').getValues();
    const weekdays = hoja2.getRange('D1:E7').getValues();
    const monthsOk = months.some(function (r) { return String(r[0]).trim() !== '' && String(r[1]).trim() !== ''; });
    const weekdaysOk = weekdays.some(function (r) { return String(r[0]).trim() !== '' && String(r[1]).trim() !== ''; });
    return monthsOk && weekdaysOk;
  } catch (e) {
    return false;
  }
}

// --- SHEET SETUP HELPERS (Tasks 1.2 / 1.3) ---

function ensureRegistroHeader() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG.REGISTRO);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.REGISTRO);
  }
  // Write header if empty or mismatched — always enforce frozen order per PRD §9
  const header = sh.getRange(1, 1, 1, CONFIG.HEADER.length).getValues()[0];
  const needsWrite = header.join('|') !== CONFIG.HEADER.join('|');
  if (needsWrite) {
    sh.getRange(1, 1, 1, CONFIG.HEADER.length).setValues([CONFIG.HEADER]);
  }
  sh.setFrozenRows(1);
  // Header styling
  sh.getRange(1, 1, 1, CONFIG.HEADER.length)
    .setFontWeight('bold')
    .setBackground('#f1f3f4');
  sh.autoResizeColumns(1, CONFIG.HEADER.length);
  // Protect header row
  try {
    const protections = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    // Keep existing sheet protection if any; add range protection for header
    const headerProt = sh.getRange('A1:M1').protect();
    headerProt.setDescription('Registro header — do not reorder');
    // Restrict to owner only initially; editors added via Config later
    headerProt.setWarningOnly(false);
  } catch (e) {
    Logger.log('ensureRegistroHeader protection note: ' + e.message);
  }
  SpreadsheetApp.flush();
  return sh;
}

function ensureConfigSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG.CONFIG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.CONFIG_SHEET);
  }
  const header = sh.getRange(1, 1, 1, CONFIG.CONFIG_HEADER.length).getValues()[0];
  const needsWrite = header.join('|') !== CONFIG.CONFIG_HEADER.join('|');
  if (needsWrite) {
    sh.getRange(1, 1, 1, CONFIG.CONFIG_HEADER.length).setValues([CONFIG.CONFIG_HEADER]);
    sh.getRange(1, 1, 1, CONFIG.CONFIG_HEADER.length).setFontWeight('bold').setBackground('#e8f0fe');
    // Example rows (owner fills sheetId→section and section→responsible)
    // A = key (sheetId or logical section), B = value (logical section or email)
    const examples = [
      ['// sheetId  | logical section — e.g. 740536758 | Preparacion', ''],
      ['// logical section | responsible email — e.g. Preparacion | resp.prep@factory.pe', '']
    ];
    // Only write examples if sheet is empty beyond header
    if (sh.getLastRow() === 1) {
      sh.getRange(2, 1, examples.length, 2).setValues(examples).setFontColor('#5f6368').setFontStyle('italic');
    }
  }
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, 2);
  try {
    const prot = sh.protect();
    prot.setDescription('Config — logical section mapping');
    prot.setWarningOnly(true);
  } catch (e) {
    Logger.log('ensureConfigSheet protection note: ' + e.message);
  }
  SpreadsheetApp.flush();
  return sh;
}

function ensureErrorsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG.ERRORS);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.ERRORS);
  }
  const header = sh.getRange(1, 1, 1, CONFIG.ERRORS_HEADER.length).getValues()[0];
  const needsWrite = header.join('|') !== CONFIG.ERRORS_HEADER.join('|');
  if (needsWrite) {
    sh.getRange(1, 1, 1, CONFIG.ERRORS_HEADER.length).setValues([CONFIG.ERRORS_HEADER]);
    sh.getRange(1, 1, 1, CONFIG.ERRORS_HEADER.length).setFontWeight('bold').setBackground('#fce8e6');
  }
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, CONFIG.ERRORS_HEADER.length);
  SpreadsheetApp.flush();
  return sh;
}

function setupInstallable() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // Validate Hoja2 before creating trigger
  if (!validateHoja2()) {
    ss.toast('⚠️ Hoja2 no accesible — verificá Hoja2!A1:B12 y D1:E7 antes de autorizar.', 'Asistencia', 7);
    Logger.log('setupInstallable blocked: Hoja2 invalid');
    return;
  }
  // Ensure foundation sheets exist
  ensureRegistroHeader();
  ensureConfigSheet();
  ensureErrorsSheet();
  // Deduplicate trigger for handleEdit
  const existing = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === 'handleEdit';
  });
  if (existing.length > 0) {
    ss.toast('🔒 Autorización ya activa (' + existing.length + ' trigger(s)).', 'Asistencia', 5);
    return;
  }
  ScriptApp.newTrigger('handleEdit')
    .forSpreadsheet(ss)
    .onEdit()
    .create();
  ss.toast('🔒 Autorización concedida — handleEdit instalado como owner.', 'Asistencia', 5);
}

// Placeholder for installable handler — full logic in PR 2
function handleEdit(e) {
  // PR 1: foundation only — no ingest yet; exists so trigger creation succeeds
  Logger.log('handleEdit scaffold — ingest ships in PR 2. Range: ' + (e && e.range ? e.range.getA1Notation() : 'unknown'));
}
