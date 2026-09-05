/**
 * Form.gs — Yarn Production form helpers + G2 navigation
 *
 * Pure helpers: date key normalization (America/La_Paz), eligibility,
 * zero-filling, totals, audit merging. Simple onEdit for G2 only.
 * The installable mobile handler is limited to M4 FALSE -> TRUE saves.
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
    // Convert via Sheets epoch: use noon UTC to avoid America/La_Paz midnight shift (UTC-4)
    const d = new Date(Math.round((value - 25569) * 86400 * 1000 + 43200000));
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

// --- MOBILE SAVE EVENT FILTERING ---
function yarnNormalizeCheckboxValue_(v) {
  if (v === true) return 'TRUE';
  if (v === false) return 'FALSE';
  const s = String(v == null ? '' : v).trim().toUpperCase();
  if (s === 'VERDADERO') return 'TRUE';
  if (s === 'FALSO') return 'FALSE';
  return s;
}
function yarnIsMobileSaveEvent_(e) {
  if (!e || !e.range) return false;
  const valNorm = yarnNormalizeCheckboxValue_(e.value);
  const oldNorm = yarnNormalizeCheckboxValue_(e.oldValue);
  const rawOld = String(e.oldValue == null ? '' : e.oldValue).trim();
  // Allow blank oldValue (first time checkbox was empty before setup)
  const oldIsFalse = oldNorm === 'FALSE' || rawOld === '';
  if (valNorm !== 'TRUE' || !oldIsFalse) return false;
  const range = e.range;
  if (range.getNumRows() !== 1 || range.getNumColumns() !== 1) return false;
  const sh = range.getSheet();
  return sh.getName() === YARN_CONFIG.FORM_SHEET &&
    range.getRow() === YARN_CONFIG.MOBILE_SAVE_ROW &&
    range.getColumn() === YARN_CONFIG.MOBILE_SAVE_COL;
}

function yarnMobileSaveResult_(result) {
  const saved = result && result.ok === true;
  return { resetCheckbox: saved, reason: saved ? 'saved' : String((result && result.reason) || 'save_failed') };
}

function yarnIsMobileSaveDebounced_(marker, now) {
  const match = /^yarn-mobile-save:(\d+)$/.exec(String(marker || ''));
  return Boolean(match) && now - Number(match[1]) < YARN_CONFIG.MOBILE_SAVE_DEBOUNCE_MS;
}

function yarnTryStartMobileSave_(range) {
  const lock = LockService.getDocumentLock();
  let locked = false;
  try {
    locked = lock.tryLock(1000);
    if (!locked) return false;
    const now = new Date().getTime();
    if (yarnIsMobileSaveDebounced_(range.getNote(), now)) return false;
    range.setNote('yarn-mobile-save:' + now);
    return true;
  } finally {
    if (locked) lock.releaseLock();
  }
}

function yarnFinishMobileSave_(range) {
  range.clearNote();
}

/**
 * Installable edit trigger for the native mobile checkbox only.
 * It deliberately does not replace the simple G2 onEdit handler below.
 */
function yarnMobileOnEdit(e) {
  if (!e || !e.range) return;
  const range = e.range;
  // Fast M4 cell guard so any stray TRUE always gets reset and next shift can save
  try {
    if (range.getNumRows() !== 1 || range.getNumColumns() !== 1) return;
    const sh = range.getSheet();
    if (sh.getName() !== YARN_CONFIG.FORM_SHEET ||
      range.getRow() !== YARN_CONFIG.MOBILE_SAVE_ROW ||
      range.getColumn() !== YARN_CONFIG.MOBILE_SAVE_COL) return;
  } catch (err) { return; }
  if (!yarnIsMobileSaveEvent_(e)) {
    // Non save transition (e.g. TRUE->FALSE uncheck) - if cell stuck TRUE, force FALSE
    try {
      const cur = range.getValue();
      if (yarnNormalizeCheckboxValue_(cur) === 'TRUE') {
        range.setValue(false);
        try { range.clearNote(); } catch (e2) {}
      }
    } catch (e2) {}
    return;
  }
  if (!yarnTryStartMobileSave_(range)) {
    // Debounced or lock contention - still reset so next shift can retry
    try { range.setValue(false); } catch (e2) {
      try { SpreadsheetApp.getActiveSpreadsheet().getSheetByName(YARN_CONFIG.FORM_SHEET).getRange(YARN_CONFIG.MOBILE_SAVE_CELL_A1).setValue(false); } catch (e3) {}
    }
    try { yarnFinishMobileSave_(range); } catch (e2) {}
    return;
  }
  try {
    Logger.log('M4 edit: sheet='+e.range.getSheet().getName()+' row='+e.range.getRow()+' col='+e.range.getColumn()+' value='+e.value+' old='+e.oldValue);
    const outcome = yarnMobileSaveResult_(guardarProduccion());
    Logger.log('M4 outcome: '+JSON.stringify(outcome));
    if (!outcome.resetCheckbox) {
      const ss = (e && e.source) ? e.source : SpreadsheetApp.getActiveSpreadsheet();
      try { ss.toast('⚠️ Revisá los datos e intentá de nuevo.', 'Produccion', 5); } catch (e2) {}
    }
  } catch (err) {
    Logger.log('yarnMobileOnEdit error: ' + err.message + ' stack: ' + err.stack);
    const ss = (e && e.source) ? e.source : SpreadsheetApp.getActiveSpreadsheet();
    try { ss.toast('❌ Error al guardar: ' + err.message, 'Produccion', 7); } catch (e2) {}
  } finally {
    try { range.setValue(false); } catch (e2) {
      try { SpreadsheetApp.getActiveSpreadsheet().getSheetByName(YARN_CONFIG.FORM_SHEET).getRange(YARN_CONFIG.MOBILE_SAVE_CELL_A1).setValue(false); } catch (e3) {}
    }
    try { yarnFinishMobileSave_(range); } catch (e2) {}
  }
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
      // Blank/invalid — do nothing per spec, but ensure checkbox is FALSE for next save
      try {
        const cb = sh.getRange(YARN_CONFIG.MOBILE_SAVE_CELL_A1);
        if (cb.getValue() === true) cb.setValue(false);
      } catch(e) {}
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
    // Ensure checkbox is FALSE for new day/loaded data so next shift can save
    try {
      const cb2 = sh.getRange(YARN_CONFIG.MOBILE_SAVE_CELL_A1);
      if (cb2.getValue() === true) cb2.setValue(false);
    } catch(e) {}
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
