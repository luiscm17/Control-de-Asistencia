/**
 * Persistence.gs — Batch DB state + PK upsert/delete for the isolated Lotes project.
 *
 * Change: lotes — Daily Lot Tracking (lotes-form → db_lots)
 * Source: docs/lotes/PRD.md v0.1.0, openspec/changes/lotes/specs/lotes-lot-recording/spec.md,
 *         openspec/changes/lotes/design.md
 * Isolation: apps-script/lotes/ only — no imports from sibling apps-script/* projects.
 * Built-ins only: SpreadsheetApp, LockService, Session, Utilities, PropertiesService, ScriptApp
 * Timezone: America/La_Paz for audit (creado/actualizado), nunca para D4 passthrough.
 * PK: id = yyyy-MM-dd-posicion (posicion 1 = B8, 30 = B37), No (B8:B37) never persisted.
 *
 * INSTALL: Extensions > Apps Script > paste this project > Save > Reload sheet > setupLotes once
 * VERIFY: Use a COPY of 19lBJHHKsusI6Eqkni-zh8us6ePoEHscEgrIPrFK-zhE — never prod.
 */

function lotesBuildDbState_(dbSheet) {
  var sheet = dbSheet || lotesGetDbSheet_(SpreadsheetApp.getActiveSpreadsheet());
  if (!sheet) return { byId: {}, byRow: [], sheet: null, lastRow: 1 };
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { byId: {}, byRow: [], sheet: sheet, lastRow: lastRow };
  var width = LOTES_CONFIG.LIMITS.COLS;
  // Single batch read of A:K — never per-cell, never per-row loop with getValue()
  var values = sheet.getRange(2, 1, lastRow - 1, width).getValues();
  var byId = {};
  var byRow = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var id = String(row[LOTES_CONFIG.IDX.ID] || '').trim();
    if (!id) continue;
    var rowNum = i + 2;
    var entry = { rowNum: rowNum, data: row.slice(), id: id };
    byId[id] = entry;
    byRow.push(entry);
  }
  return { byId: byId, byRow: byRow, sheet: sheet, lastRow: lastRow };
}

function lotesFindRow_(state, id) {
  var key = String(id || '').trim();
  if (!key) return null;
  var byId = (state && state.byId) || {};
  return byId[key] || null;
}

function lotesBuildRowValues_(snapshotRow, state, posicion, fechaDisplay, fechaKey, now, editor) {
  if (!snapshotRow) throw new Error('snapshotRow required');
  var pos = Number(posicion);
  if (!pos || pos < 1 || pos > LOTES_CONFIG.LIMITS.ROWS) throw new Error('posicion 1..30 required');
  var fechaK = String(fechaKey || '').trim();
  var fechaD = String(fechaDisplay || '').trim();
  if (!fechaK || !fechaD) throw new Error('fechaKey and fechaDisplay required');
  var id = fechaK + '-' + pos;
  // No column persisted — B is fecha display, never posicion number. C:G from form C:G.
  var titulo = String(snapshotRow.titulo || '').trim();
  var tipoMaterial = String(snapshotRow.tipo_material || '');
  var codigoLote = String(snapshotRow.codigo_lote || '');
  var color = String(snapshotRow.color || '');
  var observacion = String(snapshotRow.observacion || '');

  var width = LOTES_CONFIG.LIMITS.COLS;
  var values = new Array(width);
  values[LOTES_CONFIG.IDX.ID] = id;
  values[LOTES_CONFIG.IDX.FECHA] = fechaD;
  values[LOTES_CONFIG.IDX.TITULO] = titulo;
  values[LOTES_CONFIG.IDX.TIPO_MATERIAL] = tipoMaterial;
  values[LOTES_CONFIG.IDX.CODIGO_LOTE] = codigoLote;
  values[LOTES_CONFIG.IDX.COLOR] = color;
  values[LOTES_CONFIG.IDX.OBSERVACION] = observacion;

  var existing = lotesFindRow_(state, id);
  var isNew = !existing;
  var creadoPreserved = false;
  var creado = now;
  var creadoPor = editor;
  if (existing && existing.data) {
    var prevCreado = existing.data[LOTES_CONFIG.IDX.CREADO];
    var prevCreadoPor = existing.data[LOTES_CONFIG.IDX.CREADO_POR];
    if (prevCreado && String(prevCreado).trim() !== '') {
      creado = prevCreado;
      creadoPreserved = true;
    } else if (prevCreado instanceof Date && !isNaN(prevCreado.getTime())) {
      creado = prevCreado;
      creadoPreserved = true;
    }
    if (prevCreadoPor && String(prevCreadoPor).trim() !== '') {
      creadoPor = prevCreadoPor;
    }
  }
  values[LOTES_CONFIG.IDX.CREADO] = creado;
  values[LOTES_CONFIG.IDX.ACTUALIZADO] = now;
  values[LOTES_CONFIG.IDX.CREADO_POR] = creadoPor;
  values[LOTES_CONFIG.IDX.ACTUALIZADO_POR] = editor;

  return {
    values: values,
    isNew: isNew,
    rowNum: existing ? existing.rowNum : 0,
    creadoPreserved: creadoPreserved
  };
}

function lotesUpsertDeleteBatch_(ss, snapshot, state) {
  var spreadsheet = ss || SpreadsheetApp.getActiveSpreadsheet();
  var dbSheet = (state && state.sheet) || lotesGetDbSheet_(spreadsheet);
  if (!dbSheet) throw new Error('db_lots no disponible tras ensureSchema');
  if (!snapshot || !snapshot.rows || !snapshot.fechaKey || !snapshot.fechaDisplay) {
    throw new Error('snapshot with fechaKey/fechaDisplay/rows required');
  }
  var fechaKey = String(snapshot.fechaKey).trim();
  var fechaDisplay = String(snapshot.fechaDisplay).trim();
  var now = lotesAuditTimestamp_();
  var editor = lotesEditorEmail_();

  var rows = snapshot.rows;
  if (!rows || rows.length !== LOTES_CONFIG.LIMITS.ROWS) {
    throw new Error('rows must be ' + LOTES_CONFIG.LIMITS.ROWS + ' posiciones');
  }

  var created = 0;
  var updated = 0;
  var toDelete = [];

  // Iterate posicion 1..30 — titulo=C.trim() is the gate. No is never read as DB field.
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var posicion = Number(r.posicion || (i + 1));
    var id = fechaKey + '-' + posicion;
    var titulo = String(r.titulo || '').trim();
    var existing = lotesFindRow_(state, id);
    if (titulo !== '') {
      var built = lotesBuildRowValues_(r, state, posicion, fechaDisplay, fechaKey, now, editor);
      var values = built.values;
      if (built.rowNum > 1) {
        dbSheet.getRange(built.rowNum, 1, 1, values.length).setValues([values]);
        updated++;
      } else {
        var targetRow = dbSheet.getLastRow() + 1;
        if (targetRow < 2) targetRow = 2;
        dbSheet.getRange(targetRow, 1, 1, values.length).setValues([values]);
        // Extend state so later posiciones in same batch see the new row if needed (not strictly needed for lotes)
        var newEntry = { rowNum: targetRow, data: values.slice(), id: id };
        if (state && state.byId) state.byId[id] = newEntry;
        if (state && state.byRow) state.byRow.push(newEntry);
        created++;
      }
      // Apply number formats for B dd/MM/yyyy and H:I yyyy-MM-dd HH:mm:ss on written row
      try {
        var rowNumForFmt = built.rowNum > 1 ? built.rowNum : (dbSheet.getLastRow());
        // B is col 2 formatted as dd/MM/yyyy
        dbSheet.getRange(rowNumForFmt, 2, 1, 1).setNumberFormat('dd/MM/yyyy');
        dbSheet.getRange(rowNumForFmt, LOTES_CONFIG.IDX.CREADO + 1, 1, 2).setNumberFormat('yyyy-MM-dd HH:mm:ss');
      } catch (fmtIgnore) {}
    } else if (existing) {
      // titulo empty && id exists → queue for physical delete (intentional clear, EC-02)
      toDelete.push(existing.rowNum);
    } else {
      // empty && no row → skip, no write
    }
  }

  // Bottom-up deletes to avoid index shift — critical for correctness when deleting multiple posiciones
  var deleted = 0;
  if (toDelete.length > 0) {
    toDelete.sort(function (a, b) { return b - a; });
    for (var d = 0; d < toDelete.length; d++) {
      try {
        dbSheet.deleteRow(toDelete[d]);
        deleted++;
      } catch (eDel) {
        // Log but continue — another concurrent delete may have shifted; record evidence
        try { Logger.log('lotesUpsertDeleteBatch_ deleteRow ' + toDelete[d] + ': ' + eDel.message); } catch (ignore) {}
      }
    }
  }

  var totalN = created + updated;
  return { created: created, updated: updated, deleted: deleted, totalN: totalN };
}
