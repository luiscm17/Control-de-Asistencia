/**
 * Ingest.gs — Input-only snapshots for madejeras (C8:G17) and lotes (A6:F52+H6:O52).
 *
 * Never reads H8:K17 or G/P/Q/R formula ranges except P6:P52 snapshot for
 * total_pesado (read-only numeric =SUM(H:O), never cleared on hydration).
 * All A1 references via YARN_INVENTORY_CONFIG (SSOT). Validation trimmed +
 * case-insensitive vs TURNO/SUP/INV lists; fecha via yarnInventoryDateKey_
 * (native DATE, no TZ). Eligibility: madejeras all 5 strict (C:G) mandatory;
 * lotes 8 mandatory (A-E + H-J) strict, F+K:O optional. titulo "2/18" stays
 * string via getDisplayValues + DB text '@'. Rows beyond 52 ignored.
 */

// --- Shared helpers ---

function yarnInventoryNumber_(value) {
  if (typeof value === 'number') return isFinite(value) ? value : null;
  var text = String(value === null || value === undefined ? '' : value).trim();
  if (!text) return null;
  // Locale may include thousands separator; normalize comma decimal.
  var normalized = text.indexOf(',') >= 0 ? text.replace(/\./g, '').replace(',', '.') : text;
  var num = Number(normalized);
  return isFinite(num) ? num : null;
}

function yarnInventoryIsTurnoMadejeras_(value) {
  return yarnInventoryIsInListCI_(value, YARN_INVENTORY_CONFIG.TURNO_MADEJERAS);
}

function yarnInventoryIsTurnoLotes_(value) {
  return yarnInventoryIsInListCI_(value, YARN_INVENTORY_CONFIG.TURNO_LOTES);
}

function yarnInventoryIsSupervisor_(value) {
  return yarnInventoryIsInListCI_(value, YARN_INVENTORY_CONFIG.SUPERVISOR_VALUES);
}

function yarnInventoryIsInventario_(value) {
  return yarnInventoryIsInListCI_(value, YARN_INVENTORY_CONFIG.INVENTARIO_VALUES);
}

function yarnInventoryIsTipoOrden_(value) {
  return yarnInventoryIsInListCI_(value, YARN_INVENTORY_CONFIG.TIPO_ORDEN_VALUES);
}

function yarnInventoryInvalidSnapshot_(code, reason, range, message) {
  return { valid: false, errorCode: code, reason: reason, range: range, message: message };
}

// Derive maquina/lado from row index 0..9 (C8:G17 10 rows).
function yarnInventoryMadejerasMachineSide_(idx) {
  var machineNum = Math.floor(idx / 2) + 1;
  var lado = (idx % 2 === 0) ? 'A' : 'B';
  return { maquina: 'M\u00e1quina ' + machineNum, lado: lado };
}

// --- Madejeras snapshot ---

function yarnInventoryReadMadejerasSnapshot_(optSpreadsheet) {
  var ss = optSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  var sheet = yarnInventoryGetSheet_(ss, 'MADEJERAS');
  if (!sheet) return yarnInventoryInvalidSnapshot_(
    YARN_INVENTORY_CONFIG.ERRORS.VALIDATION_FAILED, 'Sheet madejeras is missing.',
    YARN_INVENTORY_CONFIG.SHEETS.MADEJERAS, '\u26a0\ufe0f Hoja madejeras no encontrada');

  var dateVal = yarnInventoryGetRange_(sheet, YARN_INVENTORY_CONFIG.RANGES.MADEJERAS_DATE).getValue();
  var turnoVal = yarnInventoryGetRange_(sheet, YARN_INVENTORY_CONFIG.RANGES.MADEJERAS_TURNO).getValue();
  var supVal = yarnInventoryGetRange_(sheet, YARN_INVENTORY_CONFIG.RANGES.MADEJERAS_SUP).getValue();
  var invVal = yarnInventoryGetRange_(sheet, YARN_INVENTORY_CONFIG.RANGES.MADEJERAS_INV).getValue();

  var fechaKey = yarnInventoryDateKey_(dateVal);
  if (!fechaKey) return yarnInventoryInvalidSnapshot_(
    YARN_INVENTORY_CONFIG.ERRORS.INVALID_FECHA, 'Invalid fecha B3: ' + dateVal,
    YARN_INVENTORY_CONFIG.RANGES.MADEJERAS_DATE, '\u26a0\ufe0f Seleccion\u00e1 fecha v\u00e1lida en B3');

  var turnoNorm = String(turnoVal || '').trim();
  if (!yarnInventoryIsTurnoMadejeras_(turnoNorm)) return yarnInventoryInvalidSnapshot_(
    YARN_INVENTORY_CONFIG.ERRORS.INVALID_TURNO, 'Invalid turno F3: ' + turnoVal,
    YARN_INVENTORY_CONFIG.RANGES.MADEJERAS_TURNO, '\u26a0\ufe0f Valor no v\u00e1lido en Turno: ' + String(turnoVal || '').trim());

  var supNorm = String(supVal || '').trim();
  if (supNorm && !yarnInventoryIsSupervisor_(supNorm)) return yarnInventoryInvalidSnapshot_(
    'invalid_supervisor', 'Invalid supervisor B4: ' + supVal,
    YARN_INVENTORY_CONFIG.RANGES.MADEJERAS_SUP, '\u26a0\ufe0f Valor no v\u00e1lido en Supervisor: ' + String(supVal || '').trim());

  var invNorm = String(invVal || '').trim();
  if (invNorm && !yarnInventoryIsInventario_(invNorm)) return yarnInventoryInvalidSnapshot_(
    'invalid_inventario', 'Invalid inventario F4: ' + invVal,
    YARN_INVENTORY_CONFIG.RANGES.MADEJERAS_INV, '\u26a0\ufe0f Valor no v\u00e1lido en Inventario: ' + String(invVal || '').trim());

  // Input-only C8:G17 — nunca H8:K17
  var inputs = yarnInventoryGetRange_(sheet, YARN_INVENTORY_CONFIG.RANGES.MADEJERAS_INPUTS).getValues();
  var fechaDate = dateVal; // raw Date as-is, no conversion — preserving native dd/MM/yyyy
  var rows = [];
  for (var i = 0; i < inputs.length; i++) {
    var r = inputs[i];
    var ms = yarnInventoryMadejerasMachineSide_(i);
    var tituloBase = r[0];
    var cabos = r[1];
    var peso = r[2];
    var tamano = r[3];
    var velocidad = r[4];

    var tituloNum = yarnInventoryNumber_(tituloBase);
    var cabosNum = yarnInventoryNumber_(cabos);
    var pesoNum = yarnInventoryNumber_(peso);
    var tamanoNum = yarnInventoryNumber_(tamano);
    var velocidadNum = yarnInventoryNumber_(velocidad);
    // Strict: all 5 in C8:G17 mandatory — no optional. Empty/invalid -> skip and later void if existed.
    var eligible = tituloNum !== null && cabosNum !== null && pesoNum !== null && tamanoNum !== null && velocidadNum !== null;

    // Keep raw display values for DB but normalize numbers when eligible
    var sheetRow = 8 + i;
    rows.push({
      idx: i,
      sheetRow: sheetRow,
      maquina: ms.maquina,
      lado: ms.lado,
      titulo_base: eligible ? tituloNum : (String(tituloBase || '').trim() === '' ? '' : tituloNum !== null ? tituloNum : String(tituloBase).trim()),
      cabos: eligible ? cabosNum : (String(cabos || '').trim() === '' ? '' : cabosNum !== null ? cabosNum : String(cabos).trim()),
      peso_deseado: yarnInventoryNumber_(peso) !== null ? yarnInventoryNumber_(peso) : (String(peso || '').trim() === '' ? '' : String(peso).trim()),
      tamano_aspa: yarnInventoryNumber_(tamano) !== null ? yarnInventoryNumber_(tamano) : (String(tamano || '').trim() === '' ? '' : String(tamano).trim()),
      velocidad: yarnInventoryNumber_(velocidad) !== null ? yarnInventoryNumber_(velocidad) : (String(velocidad || '').trim() === '' ? '' : String(velocidad).trim()),
      rango_origen: YARN_INVENTORY_CONFIG.SHEETS.MADEJERAS + '!A' + sheetRow + ':G' + sheetRow,
      eligible: eligible
    });
  }

  var hasEligible = rows.some(function (x) { return x.eligible; });
  // Not an error if zero eligible — caller will handle empty→void vs no-op; but still valid snapshot (EC-03 0..N rows per day is valid). Validation passes.
  return {
    valid: true,
    fechaKey: fechaKey,
    fechaDate: fechaDate,
    turno: turnoNorm,
    supervisor: supNorm,
    inventario: invNorm,
    rows: rows,
    hasEligible: hasEligible,
    displayFecha: fechaKey
  };
}

// --- Lotes snapshot ---

function yarnInventoryReadLotesSnapshot_(optSpreadsheet) {
  var ss = optSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  var sheet = yarnInventoryGetSheet_(ss, 'LOTES');
  if (!sheet) return yarnInventoryInvalidSnapshot_(
    YARN_INVENTORY_CONFIG.ERRORS.VALIDATION_FAILED, 'Sheet lotes is missing.',
    YARN_INVENTORY_CONFIG.SHEETS.LOTES, '\u26a0\ufe0f Hoja lotes no encontrada');

  var dateVal = yarnInventoryGetRange_(sheet, YARN_INVENTORY_CONFIG.RANGES.LOTES_DATE).getValue();
  var turnoVal = yarnInventoryGetRange_(sheet, YARN_INVENTORY_CONFIG.RANGES.LOTES_TURNO).getValue();
  var supVal = yarnInventoryGetRange_(sheet, YARN_INVENTORY_CONFIG.RANGES.LOTES_SUP).getValue();
  var invVal = yarnInventoryGetRange_(sheet, YARN_INVENTORY_CONFIG.RANGES.LOTES_INV).getValue();

  var fechaKey = yarnInventoryDateKey_(dateVal);
  if (!fechaKey) return yarnInventoryInvalidSnapshot_(
    YARN_INVENTORY_CONFIG.ERRORS.INVALID_FECHA, 'Invalid fecha C3: ' + dateVal,
    YARN_INVENTORY_CONFIG.RANGES.LOTES_DATE, '\u26a0\ufe0f Seleccion\u00e1 fecha v\u00e1lida en C3');

  var turnoNorm = String(turnoVal || '').trim();
  if (!yarnInventoryIsTurnoLotes_(turnoNorm)) return yarnInventoryInvalidSnapshot_(
    YARN_INVENTORY_CONFIG.ERRORS.INVALID_TURNO, 'Invalid turno E3: ' + turnoVal,
    YARN_INVENTORY_CONFIG.RANGES.LOTES_TURNO, '\u26a0\ufe0f Valor no v\u00e1lido en Turno: ' + String(turnoVal || '').trim());

  var supNorm = String(supVal || '').trim();
  if (supNorm && !yarnInventoryIsSupervisor_(supNorm)) return yarnInventoryInvalidSnapshot_(
    'invalid_supervisor', 'Invalid supervisor G3: ' + supVal,
    YARN_INVENTORY_CONFIG.RANGES.LOTES_SUP, '\u26a0\ufe0f Valor no v\u00e1lido en Supervisor: ' + String(supVal || '').trim());

  var invNorm = String(invVal || '').trim();
  if (invNorm && !yarnInventoryIsInventario_(invNorm)) return yarnInventoryInvalidSnapshot_(
    'invalid_inventario', 'Invalid inventario I3: ' + invVal,
    YARN_INVENTORY_CONFIG.RANGES.LOTES_INV, '\u26a0\ufe0f Valor no v\u00e1lido en Inventario: ' + String(invVal || '').trim());

  // Input-only A6:F52 + H6:O52 — nunca G/P/Q/R formulas (P snapshot only for total_pesado)
  var inputsA = yarnInventoryGetRange_(sheet, YARN_INVENTORY_CONFIG.RANGES.LOTES_INPUTS_A).getValues();
  var inputsADisplay = yarnInventoryGetRange_(sheet, YARN_INVENTORY_CONFIG.RANGES.LOTES_INPUTS_A).getDisplayValues();
  var inputsB = yarnInventoryGetRange_(sheet, YARN_INVENTORY_CONFIG.RANGES.LOTES_INPUTS_B).getValues();
  var totalPesadoValues = yarnInventoryGetRange_(sheet, YARN_INVENTORY_CONFIG.RANGES.LOTES_FORMULAS.TOTAL).getValues();
  var fechaDate = dateVal; // raw Date as-is, no conversion — preserving native dd/MM/yyyy
  var rows = [];
  var maxRows = Math.min(inputsA.length, YARN_INVENTORY_CONFIG.LIMITS.LOTES_PER_DAY);
  // inputsA/B length is 47 (6..52). Beyond 52 is ignored by definition.
  for (var i = 0; i < maxRows; i++) {
    var a = inputsA[i];
    var b = inputsB[i];
    var sheetRow = 6 + i;
    var loteId = String(a[0] || '').trim();
    var tipoOrden = String(a[1] || '').trim();
    var color = String(a[2] || '').trim();
    // titulo "2/18" must stay string — capture as string, no timezone conversion
    var titulo = String(inputsADisplay[i] ? inputsADisplay[i][3] || '' : '').trim();
    if (!titulo) titulo = String(a[3] || '').trim();
    var objetivoRaw = a[4];
    var aumentoRaw = a[5];

    var objetivoNum = yarnInventoryNumber_(objetivoRaw);
    var aumentoNum = yarnInventoryNumber_(aumentoRaw);
    // Pesadas H6:O52 (8 cols) — H,I,J mandatory (pesada_1..3), K:O optional
    var pesadas = [];
    for (var p = 0; p < 8; p++) {
      var v = b[p];
      var n = yarnInventoryNumber_(v);
      pesadas.push(n !== null ? n : (String(v || '').trim() === '' ? '' : String(v).trim()));
    }
    var pesada1Num = yarnInventoryNumber_(b[0]);
    var pesada2Num = yarnInventoryNumber_(b[1]);
    var pesada3Num = yarnInventoryNumber_(b[2]);
    // total_pesado snapshot from P6:P52 =SUM(H:O) — numeric, never cleared on hydration
    var totalPesadoRaw = totalPesadoValues[i] ? totalPesadoValues[i][0] : '';
    var totalPesadoNum = yarnInventoryNumber_(totalPesadoRaw);
    var total_pesado = totalPesadoNum !== null ? totalPesadoNum : (String(totalPesadoRaw || '').trim() === '' ? '' : String(totalPesadoRaw).trim());
    // Strict: 8 mandatory A-E + H-J (lote_id, tipo_orden valid, color, titulo, objetivo_neto, pesada_1..3). F + K:O optional.
    var hasLoteId = loteId !== '';
    var hasTipoOrden = yarnInventoryIsTipoOrden_(tipoOrden);
    var hasColor = color !== '';
    var hasTitulo = titulo !== '';
    var eligible = hasLoteId && hasTipoOrden && hasColor && hasTitulo && objetivoNum !== null && pesada1Num !== null && pesada2Num !== null && pesada3Num !== null;

    rows.push({
      idx: i,
      sheetRow: sheetRow,
      lote_id: loteId,
      tipo_orden: tipoOrden,
      color: color,
      titulo: titulo,
      objetivo_neto: eligible ? objetivoNum : (String(objetivoRaw || '').trim() === '' ? '' : objetivoNum !== null ? objetivoNum : String(objetivoRaw).trim()),
      aumento: aumentoNum !== null ? aumentoNum : (String(aumentoRaw || '').trim() === '' ? '' : String(aumentoRaw).trim()),
      pesada_1: pesadas[0], pesada_2: pesadas[1], pesada_3: pesadas[2], pesada_4: pesadas[3],
      pesada_5: pesadas[4], pesada_6: pesadas[5], pesada_7: pesadas[6], pesada_8: pesadas[7],
      pesadas: pesadas,
      total_pesado: total_pesado,
      rango_origen: YARN_INVENTORY_CONFIG.SHEETS.LOTES + '!A' + sheetRow + ':O' + sheetRow,
      eligible: eligible
    });
  }

  return {
    valid: true,
    fechaKey: fechaKey,
    fechaDate: fechaDate,
    turno: turnoNorm,
    supervisor: supNorm,
    inventario: invNorm,
    rows: rows,
    displayFecha: fechaKey
  };
}
