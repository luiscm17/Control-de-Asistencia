/**
 * Persistence.gs — Map A->row upsert, typed H/S:V NUMBER 0.00, void/active, audit La_Paz.
 *
 * PK: A = trim(C3) -> "Nº Lote". Full B:AA overwrite (two-times fill via Re-sincronizar).
 * Audit: AB creado preserved, AC actualizado + AD editado_por refreshed, AE estado void/active,
 * AF rango_origen = "tenidos!C3:I25". No Lock here (Core PR3), idempotent via preserve AB.
 * H/S:V stored as NUMBER (getValue), rest STRING via getDisplayValue — no coercion.
 * Width 32: A:AF.
 */

function dyeingBuildDbState_(dbSheet) {
  var sheet = dbSheet || dyeingGetSheet_(SpreadsheetApp.getActiveSpreadsheet(), 'DB');
  if (!sheet) return { byId: {}, byRow: [], sheet: null, lastRow: 1 };
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { byId: {}, byRow: [], sheet: sheet, lastRow: lastRow };
  var width = DYEING_CONFIG.LIMITS.COLS;
  var values = sheet.getRange(2, 1, lastRow - 1, width).getValues();
  var byId = {};
  var byRow = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var id = String(row[DYEING_CONFIG.IDX.LOTE] || '').trim();
    if (!id) continue;
    var rowNum = i + 2;
    var entry = { rowNum: rowNum, data: row.slice(), id: id };
    byId[id] = entry;
    byRow.push(entry);
  }
  return { byId: byId, byRow: byRow, sheet: sheet, lastRow: lastRow };
}

function dyeingFindRow_(state, loteId) {
  var id = String(loteId || '').trim();
  if (!id) return null;
  var byId = (state && state.byId) || {};
  return byId[id] || null;
}

function dyeingPersistenceTimestamp_() {
  if (typeof dyeingAuditTimestamp_ === 'function') return dyeingAuditTimestamp_(new Date());
  try { return Utilities.formatDate(new Date(), DYEING_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss'); } catch (e) { return new Date().toISOString().slice(0, 19).replace('T', ' '); }
}

function dyeingPersistenceEditor_() {
  if (typeof dyeingEditorEmail_ === 'function') return dyeingEditorEmail_();
  try {
    var a = Session.getActiveUser().getEmail();
    if (a && String(a).trim()) return String(a).trim();
    var ef = Session.getEffectiveUser().getEmail();
    return ef && String(ef).trim() ? String(ef).trim() : 'unknown';
  } catch (e) { return 'unknown'; }
}

function dyeingBuildRowValues_(snapshot, state) {
  var loteId = String(snapshot.loteId || '').trim();
  if (!loteId) throw new Error('loteId required');
  var dbBY = snapshot.dbBY || [];
  if (dbBY.length !== 26) throw new Error('dbBY must be 26 cols B:AA');

  var width = DYEING_CONFIG.LIMITS.COLS;
  var values = new Array(width);
  values[DYEING_CONFIG.IDX.LOTE] = loteId;

  for (var i = 0; i < 26; i++) {
    values[1 + i] = dbBY[i];
  }

  var existing = dyeingFindRow_(state, loteId);
  var isEmpty = dyeingIsEmptyBY_(dbBY);
  var estado = isEmpty ? 'void' : 'active';

  var now = dyeingPersistenceTimestamp_();
  var editor = dyeingPersistenceEditor_();
  var creado = now;
  if (existing && existing.data) {
    var prevCreado = existing.data[DYEING_CONFIG.IDX.CREADO];
    if (prevCreado && String(prevCreado).trim() !== '') {
      creado = prevCreado;
    } else if (prevCreado instanceof Date && !isNaN(prevCreado.getTime())) {
      creado = prevCreado;
    }
  }

  values[DYEING_CONFIG.IDX.CREADO] = creado;
  values[DYEING_CONFIG.IDX.ACTUALIZADO] = now;
  values[DYEING_CONFIG.IDX.EDITADO_POR] = editor;
  values[DYEING_CONFIG.IDX.ESTADO] = estado;
  values[DYEING_CONFIG.IDX.RANGO_ORIGEN] = 'tenidos!C3:I25';

  return {
    values: values,
    isNew: !existing,
    rowNum: existing ? existing.rowNum : 0,
    estado: estado,
    creadoPreserved: !!existing
  };
}

function dyeingUpsertLote_(optSpreadsheet, snapshot) {
  var ss = optSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  try { dyeingEnsureSchema(ss); } catch (e) {}

  var dbSheet = dyeingGetSheet_(ss, 'DB');
  if (!dbSheet) throw new Error('db_tenidos no disponible tras ensureSchema');

  var snap = snapshot;
  if (!snap || !snap.loteId) {
    throw new Error('snapshot.loteId requerido');
  }
  var state = dyeingBuildDbState_(dbSheet);
  var built = dyeingBuildRowValues_(snap, state);
  var values = built.values;
  var rowNum = built.rowNum;

  if (rowNum > 1) {
    dbSheet.getRange(rowNum, 1, 1, values.length).setValues([values]);
  } else {
    var targetRow = dbSheet.getLastRow() + 1;
    if (targetRow < 2) targetRow = 2;
    dbSheet.getRange(targetRow, 1, 1, values.length).setValues([values]);
    rowNum = targetRow;
  }

  try {
    dbSheet.getRange(rowNum, 8, 1, 1).setNumberFormat('0.00');
    dbSheet.getRange(rowNum, 19, 1, 4).setNumberFormat('0.00');
    dbSheet.getRange(rowNum, 5, 1, 1).setNumberFormat('@');
    dbSheet.getRange(rowNum, DYEING_CONFIG.IDX.CREADO + 1, 1, 2).setNumberFormat('yyyy-MM-dd HH:mm:ss');
  } catch (e) {}

  return {
    ok: true,
    rowNum: rowNum,
    isNew: built.isNew,
    estado: built.estado,
    loteId: String(snap.loteId).trim()
  };
}

function dyeingFindDbRowForHydrate_(optSpreadsheet, loteId) {
  var ss = optSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  var dbSheet = dyeingGetSheet_(ss, 'DB');
  if (!dbSheet) return null;
  var state = dyeingBuildDbState_(dbSheet);
  var entry = dyeingFindRow_(state, loteId);
  return entry ? entry.data.slice() : null;
}
