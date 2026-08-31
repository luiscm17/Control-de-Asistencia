/**
 * Registro.gs — Split from Code.gs
 * Role: Registro PK + sheet helpers + Config resolution + responsible lookup.
 * Original: Control de Asistencia — Registro Centralization.
 * Notes: Apps Script concatenates all .gs files; order does not matter. Do not change logic.
 */

// --- PK / REGISTRO HELPERS ---

function recordId(section, operatorName, isoDate) {
  return `${section}-${operatorName}-${isoDate}`;
}

function findRegistroRowId(recordIdStr) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const reg = ss.getSheetByName(CONFIG.REGISTRO);
    if (!reg || reg.getLastRow() < 2) return null;
    const ids = reg.getRange(2, 1, reg.getLastRow() - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === recordIdStr) return i + 2;
    }
  } catch (e) {}
  return null;
}

// --- SHEET SETUP HELPERS (Tasks 1.2 / 1.3) ---

function ensureRegistroHeader() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG.REGISTRO);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.REGISTRO);
  }
  const header = sh.getRange(1, 1, 1, CONFIG.HEADER.length).getValues()[0];
  const needsWrite = header.join('|') !== CONFIG.HEADER.join('|');
  if (needsWrite) {
    sh.getRange(1, 1, 1, CONFIG.HEADER.length).setValues([CONFIG.HEADER]);
  }
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, CONFIG.HEADER.length)
    .setFontWeight('bold')
    .setBackground('#f1f3f4');
  sh.autoResizeColumns(1, CONFIG.HEADER.length);
  try {
    const headerProt = sh.getRange('A1:M1').protect();
    headerProt.setDescription('Registro header — do not reorder');
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
    const examples = [
      ['// sheetId  | logical section — e.g. 740536758 | Preparacion', ''],
      ['// logical section | responsible email — e.g. Preparacion | resp.prep@factory.pe', '']
    ];
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

// --- PR 2 HELPERS: Config resolution ---

function getConfigMap() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.CONFIG_SHEET);
  const map = {};
  if (!sh) return map;
  const last = sh.getLastRow();
  if (last < 2) return map;
  const data = sh.getRange(2, 1, last - 1, 2).getValues();
  for (let i = 0; i < data.length; i++) {
    const k = String(data[i][0]).trim();
    const v = String(data[i][1]).trim();
    if (!k || !v) continue;
    if (k.indexOf('//') === 0) continue;
    map[k] = v;
  }
  return map;
}

function resolveSection(sheet) {
  const map = getConfigMap();
  const idStr = String(sheet.getSheetId());
  if (map[idStr]) return map[idStr];
  const name = String(sheet.getName()).trim();
  if (map[name]) return map[name];
  // Fallback: if name itself is a canonical logical section, resolve directly
  if (CONFIG.LOGICAL_SECTIONS.indexOf(name) !== -1) return name;
  return null;
}

function getResponsibleEmail(section) {
  const map = getConfigMap();
  if (map[section]) return map[section];
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(section);
    if (sh) {
      const probe = sh.getRange(1, 1, 10, 6).getDisplayValues();
      for (let r = 0; r < probe.length; r++) {
        for (let c = 0; c < probe[r].length; c++) {
          if (String(probe[r][c]).trim().toUpperCase() === 'RESPONSABLE' && c + 1 < probe[r].length) {
            const cand = String(probe[r][c + 1]).trim();
            if (cand && cand.indexOf('@') !== -1) return cand;
          }
        }
      }
    }
  } catch (e) {
    Logger.log('getResponsibleEmail fallback scan fail: ' + e.message);
  }
  return '';
}
