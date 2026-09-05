/**
 * Menu.gs — Yarn Production menu + public Guardar wiring
 *
 * Produccion menu: Guardar | Limpiar Formulario | Configurar Produccion (3 items)
 * Public function guardarProduccion is bound to both menu and drawing.
 */

// --- MENU SETUP ---
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Produccion')
    .addItem('Guardar', 'guardarProduccion')
    .addItem('Limpiar Formulario', 'limpiarFormularioProduccion')
    .addSeparator()
    .addItem('Configurar Produccion', 'setupYarnProduction')
    .addToUi();
}

// --- PUBLIC ACTIONS (no trailing underscore — callable from menu/drawing/HtmlService) ---

function limpiarFormularioProduccion() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(YARN_CONFIG.FORM_SHEET);
  if (!sh) {
    ss.toast('Hoja ' + YARN_CONFIG.FORM_SHEET + ' no encontrada.', 'Produccion', 5);
    return;
  }
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert('¿Limpiar solo D6:L8?', 'Se borraran los valores de proceso ingresados (C6:C8 y totales no se tocan).', ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;
  yarnClearProcessInputs_();
  ss.toast('🧹 Formulario limpio (D6:L8).', 'Produccion', 5);
}

/**
 * Single Guardar — upserts each populated fixed shift by (fecha, turno).
 * Reads G2 + C6:L8, validates, acquires lock, writes A:Q, flushes, toasts.
 */
function guardarProduccion() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const formSh = ss.getSheetByName(YARN_CONFIG.FORM_SHEET);
  if (!formSh) {
    ss.toast('Hoja ' + YARN_CONFIG.FORM_SHEET + ' no encontrada.', 'Produccion', 7);
    return;
  }

  // Validate G2
  const g2Val = formSh.getRange(YARN_CONFIG.DATE_CELL_A1).getValue();
  const iso = yarnParseG2ToIso_(g2Val);
  if (iso === '') {
    ss.toast('Seleccione una fecha valida en G2.', 'Produccion', 7);
    return;
  }

  // Batch read C6:L8 (3 rows x 10 cols: C..L)
  const rawGrid = formSh.getRange(YARN_CONFIG.FORM_ROW_START, YARN_CONFIG.SHIFT_COL, 3, YARN_CONFIG.PROCESS_COL_END - YARN_CONFIG.SHIFT_COL + 1).getValues();
  const formRows = [];
  let labelDrift = false;
  for (let r = 0; r < 3; r++) {
    const turnoCell = String(rawGrid[r][0] || '').trim().toUpperCase();
    const expected = YARN_CONFIG.SHIFTS[r];
    if (turnoCell !== expected) {
      labelDrift = true;
      Logger.log('guardarProduccion shift drift row ' + (YARN_CONFIG.FORM_ROW_START + r) + ': expected ' + expected + ' got ' + turnoCell);
    }
    // Use fixed expected label as key regardless of drift (preserve spec — C6:C8 values MUST be persisted as turno key)
    const turno = expected;
    const processRaw = rawGrid[r].slice(1); // D:L (9 values)
    formRows.push({ turno: turno, processValuesRaw: processRaw });
  }
  if (labelDrift) {
    ss.toast('⚠️ Etiqueta de turno difiere de DIA/TARDE/NOCHE — se guardo con turno fijo.', 'Produccion', 7);
  }

  // Eligibility check — at least one row with data
  let anyEligible = false;
  for (let i = 0; i < formRows.length; i++) {
    if (yarnIsRowEligible_(formRows[i].processValuesRaw)) { anyEligible = true; break; }
  }
  if (!anyEligible) {
    ss.toast('Nada para guardar — complete al menos un turno en D6:L8.', 'Produccion', 7);
    return;
  }

  let result;
  try {
    result = yarnUpsertForDate_(iso, formRows);
  } catch (err) {
    if (String(err.message).indexOf('duplicado') !== -1) {
      ss.toast('❌ Error de integridad: ' + err.message, 'Produccion', 7);
    } else {
      ss.toast('❌ Error al guardar: ' + err.message, 'Produccion', 7);
    }
    Logger.log('guardarProduccion error: ' + err.message);
    return;
  }

  if (result.queued) {
    // Lock timeout — no writes, user retries
    return;
  }

  const parts = [];
  if (result.ins > 0) parts.push(result.ins + ' insertado(s)');
  if (result.upd > 0) parts.push(result.upd + ' actualizado(s)');
  const total = result.ins + result.upd;
  if (total === 0) {
    ss.toast('Nada para guardar.', 'Produccion', 5);
  } else {
    ss.toast('✅ ' + total + ' turno(s) guardado(s) — ' + parts.join(', ') + ' — ' + iso, 'Produccion', 7);
  }
  SpreadsheetApp.flush();
}
