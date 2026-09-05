/**
 * Form.gs — Yarn Production form helpers + G2 navigation
 *
 * Pure helpers: date key normalization (America/La_Paz), eligibility,
 * zero-filling, totals, audit merging. Simple onEdit for G2 only.
 * Batch reads/writes; never touches C6:C8 or totals C9:L9 / C10:J10.
 */

// --- PURE HELPERS (testable via manual harness) ---

/**
 * Normalize a G2 value to yyyy-MM-dd in America/La_Paz.
 * Accepts Date, number (serial), or string (d/M/yyyy, M/d/yyyy, yyyy-MM-dd).
 * Returns iso string or '' if blank/invalid.
 */
function yarnParseG2ToIso_(value) {
  if (value == null || value === '') return '';
  // Date object
  if (value instanceof Date && !isNaN(value)) {
    return Utilities.formatDate(value, YARN_CONFIG.TIMEZONE, 'yyyy-MM-dd');
  }
  // Numeric serial (Sheets date) — treat as days since 1899-12-30
  if (typeof value === 'number' && !isNaN(value)) {
    // Convert via Sheets epoch: use Java date
    const d = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!isNaN(d)) return Utilities.formatDate(d, YARN_CONFIG.TIMEZONE, 'yyyy-MM-dd');
  }
  const s = String(value).trim();
  if (s === '') return '';
  // Try yyyy-MM-dd directly
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const parts = s.split('-');
    const y = Number(parts[0]); const m = Number(parts[1]); const d = Number(parts[2]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) return s;
    return '';
  }
  // Try d/M/yyyy or M/d/yyyy with slash — PRD uses d/M/yyyy
  const slash = s.split('/');
  if (slash.length === 3) {
    let d, m, y;
    // Heuristic: PRD format is d/M/yyyy; accept both d/M and M/d by validating month <=12
    // Prefer d/M/yyyy: first token is day
    d = Number(slash[0]); m = Number(slash[1]); y = Number(slash[2]);
    if (y < 100) y += 2000;
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100) {
      const mm = (m < 10 ? '0' : '') + m;
      const dd = (d < 10 ? '0' : '') + d;
      return y + '-' + mm + '-' + dd;
    }
    return '';
  }
  // Try ISO parse via Date
  const d2 = new Date(s);
  if (!isNaN(d2)) {
    return Utilities.formatDate(d2, YARN_CONFIG.TIMEZONE, 'yyyy-MM-dd');
  }
  return '';
}

function yarnBuildId_(isoDate, turno) {
  return isoDate + '-' + turno;
}

function yarnIsValidTurno_(turno) {
  return YARN_CONFIG.SHIFTS.indexOf(String(turno).trim().toUpperCase()) !== -1;
}

/**
 * A form row is eligible when at least one process cell is non-blank.
 * Values may be numbers, numeric strings, or empty.
 */
function yarnIsRowEligible_(processValues) {
  for (let i = 0; i < processValues.length; i++) {
    const v = processValues[i];
    if (v == null) continue;
    const s = String(v).trim();
    if (s !== '') return true;
  }
  return false;
}

/**
 * Normalize process values: blank -> 0, numeric string -> number, invalid -> 0 (validation should have rejected negatives).
 * Returns array of numbers length 9.
 */
function yarnNormalizeProcessValues_(processValues) {
  const out = [];
  for (let i = 0; i < processValues.length; i++) {
    const v = processValues[i];
    const s = String(v == null ? '' : v).trim();
    if (s === '') { out.push(0); continue; }
    // Replace comma decimal if user typed with locale
    const norm = s.replace(',', '.');
    const n = Number(norm);
    out.push(isNaN(n) ? 0 : n);
  }
  return out;
}

function yarnComputeTotalProductoTerminado_(embolsado, ovillado, madejitas) {
  const a = Number(embolsado) || 0;
  const b = Number(ovillado) || 0;
  const c = Number(madejitas) || 0;
  return a + b + c;
}

function yarnBuildRecordFromFormRow_(isoDate, turno, normalizedValues, editorEmail, nowStr, existingRow) {
  const embolsado = normalizedValues[6];
  const ovillado = normalizedValues[7];
  const madejitas = normalizedValues[8];
  const total = yarnComputeTotalProductoTerminado_(embolsado, ovillado, madejitas);
  // Build fecha as native Date at noon La Paz to avoid midnight shift
  const parts = isoDate.split('-');
  const fechaDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
  const isInsert = !existingRow;
  const creado = isInsert ? nowStr : existingRow[YARN_CONFIG.IDX.CREADO];
  const registradoPor = isInsert ? editorEmail : existingRow[YARN_CONFIG.IDX.REGISTRADO_POR];
  const row = [];
  row[YARN_CONFIG.IDX.ID] = yarnBuildId_(isoDate, turno);
  row[YARN_CONFIG.IDX.FECHA] = fechaDate;
  row[YARN_CONFIG.IDX.TURNO] = turno;
  row[YARN_CONFIG.IDX.FINISOR] = normalizedValues[0];
  row[YARN_CONFIG.IDX.RETORCIDO] = normalizedValues[1];
  row[YARN_CONFIG.IDX.MADEJERAS] = normalizedValues[2];
  row[YARN_CONFIG.IDX.TINTORERIA] = normalizedValues[3];
  row[YARN_CONFIG.IDX.SECADO] = normalizedValues[4];
  row[YARN_CONFIG.IDX.DEVANADO] = normalizedValues[5];
  row[YARN_CONFIG.IDX.EMBOLSADO] = normalizedValues[6];
  row[YARN_CONFIG.IDX.OVILLADO] = normalizedValues[7];
  row[YARN_CONFIG.IDX.MADEJITAS] = normalizedValues[8];
  row[YARN_CONFIG.IDX.TOTAL] = total;
  row[YARN_CONFIG.IDX.REGISTRADO_POR] = registradoPor;
  row[YARN_CONFIG.IDX.EDITADO_POR] = editorEmail;
  row[YARN_CONFIG.IDX.CREADO] = creado;
  row[YARN_CONFIG.IDX.ACTUALIZADO] = nowStr;
  return row;
}

// --- FORM LOAD / CLEAR (D6:L8 only) ---

function yarnClearProcessInputs_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(YARN_CONFIG.FORM_SHEET);
  if (!sh) return;
  const rows = YARN_CONFIG.FORM_ROW_END - YARN_CONFIG.FORM_ROW_START + 1;
  const cols = YARN_CONFIG.PROCESS_COL_END - YARN_CONFIG.PROCESS_COL_START + 1;
  sh.getRange(YARN_CONFIG.FORM_ROW_START, YARN_CONFIG.PROCESS_COL_START, rows, cols).clearContent();
  // Do NOT clear C6:C8, C9:L9, C10:J10 — preserve labels/formulas
  SpreadsheetApp.flush();
}

function yarnLoadRecordsIntoForm_(recordsByTurno) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(YARN_CONFIG.FORM_SHEET);
  if (!sh) return;
  const shifts = YARN_CONFIG.SHIFTS;
  const rows = shifts.length;
  const cols = YARN_CONFIG.PROCESS_COL_END - YARN_CONFIG.PROCESS_COL_START + 1;
  // Build grid D6:L8
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const turno = shifts[r];
    const rec = recordsByTurno[turno];
    const rowVals = [];
    if (rec) {
      // rec is array A:Q — extract process fields
      rowVals.push(rec[YARN_CONFIG.IDX.FINISOR]);
      rowVals.push(rec[YARN_CONFIG.IDX.RETORCIDO]);
      rowVals.push(rec[YARN_CONFIG.IDX.MADEJERAS]);
      rowVals.push(rec[YARN_CONFIG.IDX.TINTORERIA]);
      rowVals.push(rec[YARN_CONFIG.IDX.SECADO]);
      rowVals.push(rec[YARN_CONFIG.IDX.DEVANADO]);
      rowVals.push(rec[YARN_CONFIG.IDX.EMBOLSADO]);
      rowVals.push(rec[YARN_CONFIG.IDX.OVILLADO]);
      rowVals.push(rec[YARN_CONFIG.IDX.MADEJITAS]);
    } else {
      for (let c = 0; c < cols; c++) rowVals.push('');
    }
    grid.push(rowVals);
  }
  // Only write D6:L8
  sh.getRange(YARN_CONFIG.FORM_ROW_START, YARN_CONFIG.PROCESS_COL_START, rows, cols).setValues(grid);
  SpreadsheetApp.flush();
}

// --- SIMPLE onEdit — G2 navigation only ---
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const sh = e.range.getSheet();
    if (sh.getName() !== YARN_CONFIG.FORM_SHEET) return;
    // Must be single-cell G2
    if (e.range.getRow() !== YARN_CONFIG.DATE_ROW ||
      e.range.getColumn() !== YARN_CONFIG.DATE_COL ||
      e.range.getNumRows() !== 1 ||
      e.range.getNumColumns() !== 1) {
      return;
    }
    const raw = e.range.getValue();
    const iso = yarnParseG2ToIso_(raw);
    if (iso === '') {
      // Blank/invalid — do nothing per spec
      return;
    }
    // Batch lookup by date
    const byTurno = yarnLookupByDate_(iso);
    const hasAny = byTurno && (byTurno['DIA'] || byTurno['TARDE'] || byTurno['NOCHE']);
    if (hasAny) {
      yarnLoadRecordsIntoForm_(byTurno);
      e.source.toast('📥 Produccion ' + iso + ' cargada.', 'Produccion', 5);
    } else {
      yarnClearProcessInputs_();
      e.source.toast('🆕 ' + iso + ' sin registros — formulario listo.', 'Produccion', 5);
    }
  } catch (err) {
    Logger.log('onEdit yarn-production: ' + err.message + ' stack: ' + err.stack);
    try {
      const ss = e && e.source ? e.source : SpreadsheetApp.getActiveSpreadsheet();
      ss.toast('❌ Error al cargar produccion: ' + err.message, 'Produccion', 7);
    } catch (e2) { }
  }
}

// Delegate lookup to Repository (defined there, declared here for simple trigger resolution)
function yarnLookupByDate_(isoDate) {
  // If Repository.gs is loaded, this will be overridden; fallback inline if not.
  if (typeof yarnRepositoryLookupByDate_ === 'function') {
    return yarnRepositoryLookupByDate_(isoDate);
  }
  // Fallback inline read
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSh = ss.getSheetByName(YARN_CONFIG.DATA_SHEET);
  const out = {};
  if (!dataSh || dataSh.getLastRow() < 2) return out;
  const rows = dataSh.getRange(2, 1, dataSh.getLastRow() - 1, YARN_CONFIG.HEADER.length).getValues();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const id = String(r[YARN_CONFIG.IDX.ID] || '').trim();
    if (!id) continue;
    // Derive iso from fecha col (native Date or string)
    let rowIso = '';
    const fechaVal = r[YARN_CONFIG.IDX.FECHA];
    if (fechaVal instanceof Date && !isNaN(fechaVal)) {
      rowIso = Utilities.formatDate(fechaVal, YARN_CONFIG.TIMEZONE, 'yyyy-MM-dd');
    } else {
      rowIso = yarnParseG2ToIso_(fechaVal);
    }
    if (rowIso !== isoDate) continue;
    const turno = String(r[YARN_CONFIG.IDX.TURNO] || '').trim().toUpperCase();
    if (!yarnIsValidTurno_(turno)) continue;
    out[turno] = r;
  }
  return out;
}

// --- MANUAL HARNESS (run from editor for unit verification) ---
function yarnTestHelpers_() {
  const tests = [];
  function assert(name, got, expected) {
    const pass = JSON.stringify(got) === JSON.stringify(expected);
    tests.push((pass ? '✅ ' : '❌ ') + name + ' | got=' + JSON.stringify(got) + ' expected=' + JSON.stringify(expected));
    if (!pass) Logger.log('FAIL ' + name + ' got ' + JSON.stringify(got) + ' expected ' + JSON.stringify(expected));
  }
  assert('parse Date', yarnParseG2ToIso_(new Date(2026, 7, 1, 12)), '2026-08-01');
  assert('parse d/M/yyyy', yarnParseG2ToIso_('1/8/2026'), '2026-08-01');
  assert('parse 31/7/2026', yarnParseG2ToIso_('31/7/2026'), '2026-07-31');
  assert('parse yyyy-MM-dd', yarnParseG2ToIso_('2026-08-01'), '2026-08-01');
  assert('blank -> empty', yarnParseG2ToIso_(''), '');
  assert('buildId', yarnBuildId_('2026-08-01', 'DIA'), '2026-08-01-DIA');
  assert('eligible true', yarnIsRowEligible_(['', 0, '']), true);
  assert('eligible false (all blank)', yarnIsRowEligible_(['', '', '']), false);
  assert('eligible false (empty array blank)', yarnIsRowEligible_(['   ', null, undefined]), false);
  assert('normalize blank->0', yarnNormalizeProcessValues_(['', '850', '']), [0, 850, 0]);
  assert('total', yarnComputeTotalProductoTerminado_(200, 303.5, 0), 503.5);
  const norm = yarnNormalizeProcessValues_([850, 0, 0, 408, 1020, 912, 200, 303.5, 0]);
  assert('normalize full', norm, [850, 0, 0, 408, 1020, 912, 200, 303.5, 0]);
  Logger.log(tests.join('\n'));
  return tests.join('\n');
}
