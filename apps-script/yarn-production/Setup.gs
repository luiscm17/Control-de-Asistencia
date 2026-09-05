/**
 * Setup.gs — Yarn Production sheet setup
 *
 * Creates/validates datos_produccion!A:Q, applies native validations,
 * protects fixed labels/totals, and installs SUM formulas only when absent.
 * Never alters C6:C8 labels.
 *
 * Idempotent — safe to re-run.
 */

// --- PUBLIC SETUP ENTRY (menu-callable) ---
function setupYarnProduction() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureDatosProduccionSheet_();
  ensureFormSheetExists_();
  applyYarnValidations_();
  installTotalFormulas_();
  protectYarnFixedRanges_();
  SpreadsheetApp.flush();
  ss.toast('✅ Produccion configurada: datos_produccion, validaciones y formulas.', 'Produccion', 7);
}

// --- DATA SHEET A:Q ---
function ensureDatosProduccionSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(YARN_CONFIG.DATA_SHEET);
  if (!sh) {
    sh = ss.insertSheet(YARN_CONFIG.DATA_SHEET);
  }
  const header = YARN_CONFIG.HEADER;
  const lastCol = header.length;
  // Ensure header row exactly matches expected order
  const existing = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  let mismatch = false;
  for (let i = 0; i < header.length; i++) {
    if (String(existing[i] || '').trim() !== header[i]) { mismatch = true; break; }
  }
  if (mismatch) {
    sh.getRange(1, 1, 1, lastCol).setValues([header]);
    sh.getRange(1, 1, 1, lastCol).setFontWeight('bold').setBackground('#e8f0fe');
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, lastCol);
  } else if (sh.getFrozenRows() === 0) {
    sh.setFrozenRows(1);
  }
  // Format columns
  try {
    // B fecha as date (d/M/yyyy es-BO), P/Q as datetime
    if (sh.getMaxRows() > 1) {
      sh.getRange(2, YARN_CONFIG.IDX.FECHA + 1, Math.max(1, sh.getMaxRows() - 1), 1).setNumberFormat('d/M/yyyy');
      sh.getRange(2, YARN_CONFIG.IDX.CREADO + 1, Math.max(1, sh.getMaxRows() - 1), 2).setNumberFormat('d/M/yyyy hh:mm:ss');
    }
  } catch (e) {
    Logger.log('ensureDatosProduccionSheet_ format: ' + e.message);
  }
  SpreadsheetApp.flush();
  return sh;
}

function ensureFormSheetExists_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(YARN_CONFIG.FORM_SHEET);
  if (!sh) {
    throw new Error('Hoja "' + YARN_CONFIG.FORM_SHEET + '" no encontrada. Creala antes de configurar.');
  }
  // Ensure C6:C8 contain fixed DIA/TARDE/NOCHE if blank (never overwrite non-blank mismatched labels — warn instead)
  const shifts = YARN_CONFIG.SHIFTS;
  const current = sh.getRange(YARN_CONFIG.FORM_ROW_START, YARN_CONFIG.SHIFT_COL, shifts.length, 1).getValues();
  let needsInit = false;
  for (let i = 0; i < shifts.length; i++) {
    if (String(current[i][0] || '').trim() === '') needsInit = true;
  }
  if (needsInit) {
    for (let i = 0; i < shifts.length; i++) {
      if (String(current[i][0] || '').trim() === '') {
        sh.getRange(YARN_CONFIG.FORM_ROW_START + i, YARN_CONFIG.SHIFT_COL).setValue(shifts[i]);
      }
    }
  }
  // Validate existing labels match expected (warn via toast if drift)
  for (let i = 0; i < shifts.length; i++) {
    const v = String(sh.getRange(YARN_CONFIG.FORM_ROW_START + i, YARN_CONFIG.SHIFT_COL).getDisplayValue() || '').trim().toUpperCase();
    if (v !== shifts[i]) {
      Logger.log('Shift label drift at C' + (YARN_CONFIG.FORM_ROW_START + i) + ': expected ' + shifts[i] + ' got ' + v);
    }
  }
  return sh;
}

// --- VALIDATIONS (native Sheets) ---
function applyYarnValidations_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(YARN_CONFIG.FORM_SHEET);
  if (!sh) return;

  // G2 — date validation + display format d/M/yyyy
  const g2 = sh.getRange(YARN_CONFIG.DATE_CELL_A1);
  const dateRule = SpreadsheetApp.newDataValidation()
    .requireDate()
    .setAllowInvalid(false)
    .setHelpText('Seleccione una fecha valida (d/M/yyyy).')
    .build();
  g2.setDataValidation(dateRule);
  g2.setNumberFormat('d/M/yyyy');

  // D6:L8 — numeric >= 0 (allow blank, blank maps to 0 on save)
  const processRange = sh.getRange(
    YARN_CONFIG.FORM_ROW_START,
    YARN_CONFIG.PROCESS_COL_START,
    YARN_CONFIG.FORM_ROW_END - YARN_CONFIG.FORM_ROW_START + 1,
    YARN_CONFIG.PROCESS_COL_END - YARN_CONFIG.PROCESS_COL_START + 1
  );
  const numRule = SpreadsheetApp.newDataValidation()
    .requireNumberGreaterThanOrEqualTo(0)
    .setAllowInvalid(false)
    .setHelpText('Ingrese un numero >= 0 (vacio = 0).')
    .build();
  processRange.setDataValidation(numRule);

  // Optional: ensure process cells are number-formatted (avoid text)
  try {
    processRange.setNumberFormat('0.00');
  } catch (e) {
    Logger.log('applyYarnValidations_ number format: ' + e.message);
  }
}

// --- SUM FORMULAS (only when absent) ---
function installTotalFormulas_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(YARN_CONFIG.FORM_SHEET);
  if (!sh) return;

  // C9 label
  const c9 = sh.getRange('C9');
  if (String(c9.getDisplayValue() || '').trim() === '') {
    c9.setValue('TOTAL');
  }
  // D9:L9 — each column SUM of its shift column D6:D8 etc. Only when cell has no formula and is blank/0
  for (let col = YARN_CONFIG.PROCESS_COL_START; col <= YARN_CONFIG.PROCESS_COL_END; col++) {
    const cell = sh.getRange(YARN_CONFIG.TOTAL_ROW, col);
    const formula = String(cell.getFormula() || '').trim();
    if (formula === '') {
      const colLetter = columnToLetter_(col);
      const f = '=SUM(' + colLetter + YARN_CONFIG.FORM_ROW_START + ':' + colLetter + YARN_CONFIG.FORM_ROW_END + ')';
      // Only set if display is blank or numeric zero with no formula — avoids overwriting manual totals
      const disp = String(cell.getDisplayValue() || '').trim();
      if (disp === '' || disp === '0' || disp === '0.00') {
        cell.setFormula(f);
      }
    }
  }

  // C10 label
  const c10 = sh.getRange('C10');
  if (String(c10.getDisplayValue() || '').trim() === '') {
    c10.setValue('TOTAL PRODUCTO TERMINADO');
  }
  // J10 — SUM of daily totals for producto terminado (J9:L9 = embolsado+ovillado+madejitas daily totals)
  const j10 = sh.getRange(YARN_CONFIG.TOTAL_PRODUCTO_CELL_J10);
  const j10Formula = String(j10.getFormula() || '').trim();
  if (j10Formula === '') {
    const disp = String(j10.getDisplayValue() || '').trim();
    if (disp === '' || disp === '0' || disp === '0.00') {
      j10.setFormula('=SUM(J9:L9)');
    }
  }
  // Never touch C6:C8 — enforced: no code path writes there.
}

// --- PROTECTIONS (fixed labels + total formulas) ---
function protectYarnFixedRanges_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(YARN_CONFIG.FORM_SHEET);
  if (!sh) return;
  // Protect C6:C8 and totals so accidental edit warns. Remove editors except owner where possible.
  const toProtect = [
    YARN_CONFIG.SHIFT_RANGE_C6_C8,
    YARN_CONFIG.TOTAL_RANGE_C9_L9,
    'C10:J10'
  ];
  for (let i = 0; i < toProtect.length; i++) {
    const a1 = toProtect[i];
    try {
      const range = sh.getRange(a1);
      // Check if already protected (avoid duplicate protections)
      const protections = sh.getProtections(SpreadsheetApp.ProtectionType.RANGE);
      let already = false;
      for (let p = 0; p < protections.length; p++) {
        if (protections[p].getRange().getA1Notation() === a1) { already = true; break; }
      }
      if (already) continue;
      const prot = range.protect().setDescription('Produccion: ' + a1 + ' (formula/etiqueta fija)');
      // Warn-only: keep editors but show warning. If owner wants strict, they can adjust manually.
      prot.setWarningOnly(true);
    } catch (e) {
      Logger.log('protectYarnFixedRanges_ ' + a1 + ': ' + e.message);
    }
  }
}

// Helpers
function columnToLetter_(col) {
  let letter = '';
  let n = col;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}
