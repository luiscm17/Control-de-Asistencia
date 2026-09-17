/**
 * Ingest.gs — Typed batch snapshot for the isolated Dyeing (Teñido) project.
 *
 * Reads only C3 + B6:E15 + B18:E25 via DYEING_CONFIG SSOT — never G4/items.
 * Typed invariant: H/S:V (E11/E21:E24) via getValue() as NUMBER native (0.00/General),
 * rest via getDisplayValue() as STRING — E12 "@ 24/1" verbatim, fechas C6/C18 passthrough dd/mm/yyyy.
 * No validation, no coercion — Sheets native type is truth.
 * B:AA (26 cols) now includes C9 C.C. Teñido and C20 Sup. Muestra before Observación.
 * America/La_Paz only for audit (Persistence), never for C6/C18.
 */

function dyeingReadForm_(optSpreadsheet) {
  var ss = optSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  var tenidos = dyeingGetSheet_(ss, 'TENIDOS');
  if (!tenidos) {
    return { ok: false, loteId: '', error: 'missing_tenidos', message: 'Hoja tenidos no encontrada' };
  }

  var loteRaw = String(dyeingGetRange_(tenidos, DYEING_CONFIG.RANGES.PK).getDisplayValue() || '');
  var loteId = loteRaw.trim();

  var tenRange = dyeingGetRange_(tenidos, DYEING_CONFIG.RANGES.TENIDO);
  var mueRange = dyeingGetRange_(tenidos, DYEING_CONFIG.RANGES.MUESTRA);
  var tenDisplay = tenRange.getDisplayValues();
  var tenValues = tenRange.getValues();
  var mueDisplay = mueRange.getDisplayValues();
  var mueValues = mueRange.getValues();

  var c6 = String(tenDisplay[0][1] || '');
  var c7 = String(tenDisplay[1][1] || '');
  var c8 = String(tenDisplay[2][1] || '');
  var c9 = String(tenDisplay[3][1] || '');
  var e6 = String(tenDisplay[0][3] || '');
  var e7 = String(tenDisplay[1][3] || '');
  var e8 = String(tenDisplay[2][3] || '');
  var e9 = String(tenDisplay[3][3] || '');
  var e10 = String(tenDisplay[4][3] || '');
  var e11Raw = tenValues[5] ? tenValues[5][3] : '';
  var e11 = dyeingNormalizeNumberCell_(e11Raw);
  var e12 = String(tenDisplay[6][3] || '');
  var e13 = String(tenDisplay[7][3] || '');
  var e14 = String(tenDisplay[8][3] || '');
  var e15 = String(tenDisplay[9][3] || '');

  var c18 = String(mueDisplay[0][1] || '');
  var c19 = String(mueDisplay[1][1] || '');
  var c20 = String(mueDisplay[2][1] || '');
  var c21 = String(mueDisplay[3][1] || '');
  var e18 = String(mueDisplay[0][3] || '');
  var e19 = String(mueDisplay[1][3] || '');
  var e20 = String(mueDisplay[2][3] || '');
  var e21Raw = mueValues[3] ? mueValues[3][3] : '';
  var e22Raw = mueValues[4] ? mueValues[4][3] : '';
  var e23Raw = mueValues[5] ? mueValues[5][3] : '';
  var e24Raw = mueValues[6] ? mueValues[6][3] : '';
  var e21 = dyeingNormalizeNumberCell_(e21Raw);
  var e22 = dyeingNormalizeNumberCell_(e22Raw);
  var e23 = dyeingNormalizeNumberCell_(e23Raw);
  var e24 = dyeingNormalizeNumberCell_(e24Raw);
  var e25 = String(mueDisplay[7][3] || '');

  // Build B:AA (26 cols) in DB order per DYEING_CONFIG.DB_HEADERS / IDX (A:AF 32)
  // 0:Color(E6) 1:Código(E7) 2:tipo(E8) 3:TituloMg(E12) 4:Material(E9) 5:Linea(E10) 6:Temp(E11 NUMBER)
  // 7:Tina(E13) 8:NroIngreso(E14) 9:Cliente(E15) 10:FechaTenido(C6) 11:Sup.Tenido(C8) 12:TurnoTenido(C7)
  // 13:Secado1(E18) 14:Secado2(E19) 15:Revision(E20) 16:FechaMuestreo(C18)
  // 17:Titulo1(E21 NUMBER) 18:Titulo2(E22 NUMBER) 19:Torsion1(E23 NUMBER) 20:Torsion2(E24 NUMBER)
  // 21:C.C.Muestra(C21) 22:TurnoM(C19) 23:Sup.Muestra(C20 NEW) 24:C.C.Tenido(C9 NEW) 25:Obs(E25)
  var dbBY = [
    e6, e7, e8, e12, e9, e10, e11, e13, e14, e15,
    c6, c8, c7, e18, e19, e20, c18, e21, e22, e23, e24, c21, c19, c20, c9, e25
  ];

  var isEmpty = dyeingIsEmptyBY_(dbBY);

  return {
    ok: true,
    loteId: loteId,
    loteRaw: loteRaw,
    dbBY: dbBY,
    isEmptyBY: isEmpty,
    c9TenidoCC: c9,
    c20MuestraSup: c20,
    _tenDisplay: tenDisplay,
    _tenValues: tenValues,
    _mueDisplay: mueDisplay,
    _mueValues: mueValues
  };
}

function dyeingNormalizeNumberCell_(value) {
  if (value === '' || value === null || value === undefined) return '';
  if (typeof value === 'number') {
    if (!isFinite(value)) return '';
    return value;
  }
  var s = String(value).trim();
  if (s === '') return '';
  return s;
}

function dyeingIsEmptyBY_(byArray) {
  if (!byArray || !byArray.length) return true;
  for (var i = 0; i < byArray.length; i++) {
    var v = byArray[i];
    if (typeof v === 'number') return false;
    if (String(v || '').trim() !== '') return false;
  }
  return true;
}

function dyeingWriteForm_(optSpreadsheet, rowData) {
  var ss = optSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  var tenidos = dyeingGetSheet_(ss, 'TENIDOS');
  if (!tenidos) throw new Error('Hoja tenidos no encontrada');

  var by;
  if (Array.isArray(rowData) && rowData.length === DYEING_CONFIG.LIMITS.COLS) {
    by = rowData.slice(1, 27);
  } else if (Array.isArray(rowData) && rowData.length === 26) {
    by = rowData;
  } else if (rowData && Array.isArray(rowData.dbBY)) {
    by = rowData.dbBY;
  } else if (rowData && Array.isArray(rowData.values) && rowData.values.length === 32) {
    by = rowData.values.slice(1, 27);
  } else {
    throw new Error('dyeingWriteForm_ expects A:AF[32] or dbBY[26] or {dbBY}');
  }

  var tenMat = dyeingEmptyMatrix_(10, 4);
  var mueMat = dyeingEmptyMatrix_(8, 4);

  tenMat[0][1] = by[10];
  tenMat[1][1] = by[12];
  tenMat[2][1] = by[11];
  tenMat[3][1] = by[24];
  tenMat[0][3] = by[0];
  tenMat[1][3] = by[1];
  tenMat[2][3] = by[2];
  tenMat[3][3] = by[4];
  tenMat[4][3] = by[5];
  tenMat[5][3] = by[6];
  tenMat[6][3] = by[3];
  tenMat[7][3] = by[7];
  tenMat[8][3] = by[8];
  tenMat[9][3] = by[9];

  mueMat[0][1] = by[16];
  mueMat[1][1] = by[22];
  mueMat[2][1] = by[23];
  mueMat[3][1] = by[21];
  mueMat[0][3] = by[13];
  mueMat[1][3] = by[14];
  mueMat[2][3] = by[15];
  mueMat[3][3] = by[17];
  mueMat[4][3] = by[18];
  mueMat[5][3] = by[19];
  mueMat[6][3] = by[20];
  mueMat[7][3] = by[25];

  // Preserve labels B6:B9, D6:D16, B18:B21, D18:D21 -> write only inputs C6:C9/E6:E15 and C18:C21/E18:E25
  tenidos.getRange('C6:C9').setValues([[tenMat[0][1]], [tenMat[1][1]], [tenMat[2][1]], [tenMat[3][1]]]);
  tenidos.getRange('E6:E15').setValues([[tenMat[0][3]], [tenMat[1][3]], [tenMat[2][3]], [tenMat[3][3]], [tenMat[4][3]], [tenMat[5][3]], [tenMat[6][3]], [tenMat[7][3]], [tenMat[8][3]], [tenMat[9][3]]]);
  tenidos.getRange('C18:C21').setValues([[mueMat[0][1]], [mueMat[1][1]], [mueMat[2][1]], [mueMat[3][1]]]);
  tenidos.getRange('E18:E25').setValues([[mueMat[0][3]], [mueMat[1][3]], [mueMat[2][3]], [mueMat[3][3]], [mueMat[4][3]], [mueMat[5][3]], [mueMat[6][3]], [mueMat[7][3]]]);

  if (Array.isArray(rowData) && rowData.length === 32 && rowData[0]) {
    dyeingGetRange_(tenidos, DYEING_CONFIG.RANGES.PK).setValue(String(rowData[0]));
  } else if (rowData && rowData.loteId) {
    dyeingGetRange_(tenidos, DYEING_CONFIG.RANGES.PK).setValue(String(rowData.loteId));
  }

  try {
    var g4 = dyeingGetRange_(tenidos, DYEING_CONFIG.RANGES.CHECKBOX);
    if (g4.getValue() !== false) g4.setValue(false);
  } catch (e) {}

  return { ok: true };
}

function dyeingEmptyMatrix_(rows, cols) {
  var m = [];
  for (var r = 0; r < rows; r++) {
    var row = [];
    for (var c = 0; c < cols; c++) row.push('');
    m.push(row);
  }
  return m;
}
