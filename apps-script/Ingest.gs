/**
 * Ingest.gs — Split from Code.gs
 * Role: Ingest validation — date/code parsing, calendar/window/permission guards, sheet filters, logging.
 * Original: Control de Asistencia — Registro Centralization.
 * Notes: Apps Script concatenates all .gs files; order does not matter. Do not change logic.
 */

function isInWindow(isoDate) {
  const today = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
  const yesterday = Utilities.formatDate(new Date(Date.now() - 864e5), CONFIG.TIMEZONE, 'yyyy-MM-dd');
  return isoDate === today || isoDate === yesterday;
}

function getYearMonth(sheet) {
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

function logToErrors(section, rangeA1, code, reason) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName(CONFIG.ERRORS);
    if (!sh) sh = ensureErrorsSheet();
    const ts = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    const user = 'unknown';
    sh.appendRow([ts, section || '', rangeA1 || '', code || '', reason || '', user]);
    SpreadsheetApp.flush();
  } catch (e) {
    Logger.log('logToErrors fail: ' + e.message);
  }
}

function parseE11ToIso(displayValue) {
  const s = String(displayValue || '').trim();
  if (!s) return null;
  const parts = s.split('/');
  if (parts.length !== 3) return null;
  const dRaw = parts[0].trim();
  const mRaw = parts[1].trim();
  const yRaw = parts[2].trim();
  if (!dRaw || !mRaw || !yRaw) return null;
  const d = dRaw.padStart(2, '0');
  const m = mRaw.padStart(2, '0');
  const y = yRaw;
  if (!/^\d{1,2}$/.test(dRaw) || !/^\d{1,2}$/.test(mRaw) || !/^\d{4}$/.test(y)) return null;
  const day = parseInt(d, 10);
  const month = parseInt(m, 10);
  const year = parseInt(y, 10);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) return null;
  return `${y}-${m}-${d}`;
}

function isCodeValid(code) {
  if (code === '') return true;
  const n = String(code).trim().toUpperCase();
  return CONFIG.CODES.indexOf(n) !== -1;
}

function normalizeCode(code) {
  return String(code).trim().toUpperCase();
}

function isCalendarRange(range) {
  const r1 = range.getRow();
  const c1 = range.getColumn();
  const r2 = r1 + range.getNumRows() - 1;
  const c2 = c1 + range.getNumColumns() - 1;
  const calRows = [7, 9];
  const calC1 = 19;
  const calC2 = 21;
  for (let i = 0; i < calRows.length; i++) {
    const cr = calRows[i];
    if (r1 <= cr && cr <= r2 && !(c2 < calC1 || c1 > calC2)) return true;
  }
  return false;
}

function rangeIntersectsInput(range) {
  const r1 = range.getRow();
  const c1 = range.getColumn();
  const r2 = r1 + range.getNumRows() - 1;
  const c2 = c1 + range.getNumColumns() - 1;
  const ir1 = CONFIG.INPUT_ROW_START;
  const ir2 = CONFIG.INPUT_ROW_END;
  const ic1 = CONFIG.INPUT_COL_START;
  const ic2 = CONFIG.INPUT_COL_END;
  return !(r2 < ir1 || r1 > ir2 || c2 < ic1 || c1 > ic2);
}

function isIgnorableSheet(sheetName) {
  const ignorable = [CONFIG.REGISTRO, CONFIG.CONFIG_SHEET, CONFIG.ERRORS, 'Hoja2', '- AYUDA -'];
  return ignorable.indexOf(sheetName) !== -1;
}

/**
 * Attendance sheet = any sheet that is not ignorable and not Apoyo.
 * Scalable: adding or renaming sheets needs no code change.
 * Config!A:B is an optional alias; if absent, the sheet's current name is used.
 */
function isAttendanceSheet(sheet) {
  const name = String(sheet.getName()).trim();
  return !isIgnorableSheet(name) && name !== CONFIG.APOYO_SHEET;
}
