/**
 * Persistence.gs — PK plans, soft-delete (void↔active), audit, and locked saves.
 *
 * PKs: db_madejeras yyyy-MM-dd-turno-maquina-lado (A/B); db_lotes
 *      fecha-turno-lote_id or fecha-turno-row6..52 fallback last-wins.
 * Audit: fecha native DATE raw passthrough (getValue()/setValues() as-is, no new Date/noon/UTC);
 *        creado preserved; actualizado/editado_por via America/La_Paz only.
 * Lock: single LockService.tryLock(5000)+1 retry per save; Todo sequential.
 * Input-only DB cols 17/25 (total_pesado snapshot of P6:P52 =SUM(H:O), never cleared on hydration);
 * 2 DBs; no formula columns stored except total_pesado numeric snapshot.
 */

// --- Lock helper ---

function yarnInventoryAcquireLock_(lock) {
  if (lock.tryLock(5000)) return true;
  Utilities.sleep(1000);
  return lock.tryLock(5000);
}

// --- IDs ---

function yarnInventoryMadejerasId_(fechaKey, turno, maquina, lado) {
  return String(fechaKey).trim() + '-' + String(turno).trim() + '-' + String(maquina).trim() + '-' + String(lado).trim();
}

function yarnInventoryLotesId_(fechaKey, turno, loteId, rowNum) {
  var base = String(fechaKey).trim() + '-' + String(turno).trim() + '-';
  var trimmed = String(loteId || '').trim();
  if (trimmed) return base + trimmed;
  return base + 'row' + String(rowNum);
}

// --- Build Madejeras plan ---

function yarnInventoryBuildMadejerasPlan_(snapshot, state) {
  var fechaKey = snapshot.fechaKey;
  var fechaDate = snapshot.fechaDate;
  var turno = snapshot.turno;
  var supervisor = snapshot.supervisor;
  var inventario = snapshot.inventario;
  var byId = (state && state.madejerasById) || (state && state.byId) || {};
  var warnings = [];
  var timestamp = yarnInventoryAuditTimestamp_();
  var editor = yarnInventoryEditorEmail_();

  // Snapshot last-wins map for duplicate maquina-lado (should not happen, but guard)
  var snapshotById = {};
  var order = [];
  for (var i = 0; i < snapshot.rows.length; i++) {
    var r = snapshot.rows[i];
    if (!r.eligible) continue;
    var id = yarnInventoryMadejerasId_(fechaKey, turno, r.maquina, r.lado);
    if (snapshotById[id]) {
      warnings.push('\u26a0\ufe0f Madejera duplicada: ' + id + ' \u2014 \u00faltimo valor guardado');
    } else {
      order.push(id);
    }
    snapshotById[id] = r;
  }

  var plans = [];
  // Upserts for eligible rows
  for (var k = 0; k < order.length; k++) {
    var id2 = order[k];
    var row = snapshotById[id2];
    var existing = byId[id2];
    var existingData = existing ? existing.data : null;
    var creado = existingData ? existingData[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.CREADO] : '';
    if (!creado) creado = timestamp;
    var values = new Array(YARN_INVENTORY_CONFIG.LIMITS.DB_MADEJERAS_COLUMNS);
    values[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.ID] = id2;
    values[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.FECHA] = fechaDate;
    values[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.TURNO] = turno;
    values[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.SUPERVISOR] = supervisor;
    values[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.INVENTARIO] = inventario;
    values[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.MAQUINA] = row.maquina;
    values[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.LADO] = row.lado;
    values[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.TITULO_BASE] = row.titulo_base;
    values[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.CABOS] = row.cabos;
    values[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.PESO_DESEADO] = row.peso_deseado;
    values[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.TAMANO_ASPA] = row.tamano_aspa;
    values[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.VELOCIDAD] = row.velocidad;
    values[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.CREADO] = creado;
    values[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.ACTUALIZADO] = timestamp;
    values[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.EDITADO_POR] = editor;
    values[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.RANGO_ORIGEN] = row.rango_origen;
    values[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.ESTADO] = 'active';
    plans.push({ id: id2, rowNum: existing ? existing.rowNum : 0, values: values });
  }

  // Voids: existing PKs for same fecha+turno not in snapshotById -> soft-delete
  for (var idKey in byId) {
    if (!Object.prototype.hasOwnProperty.call(byId, idKey)) continue;
    if (snapshotById[idKey]) continue;
    var entry = byId[idKey];
    var data = entry.data;
    var rowFechaKey = yarnInventoryDateKey_(data[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.FECHA]);
    if (rowFechaKey !== fechaKey) continue;
    var rowTurno = String(data[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.TURNO] || '').trim();
    if (rowTurno.toLowerCase() !== String(turno).trim().toLowerCase()) continue;
    var estado = String(data[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.ESTADO] || '').toLowerCase();
    if (estado === 'void') continue;
    var voidValues = data.slice();
    voidValues[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.ACTUALIZADO] = timestamp;
    voidValues[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.EDITADO_POR] = editor;
    voidValues[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.ESTADO] = 'void';
    plans.push({ id: idKey, rowNum: entry.rowNum, values: voidValues, isVoid: true });
  }

  return { plans: plans, warnings: warnings };
}

// --- Build Lotes plan ---

function yarnInventoryBuildLotesPlan_(snapshot, state) {
  var fechaKey = snapshot.fechaKey;
  var fechaDate = snapshot.fechaDate;
  var turno = snapshot.turno;
  var supervisor = snapshot.supervisor;
  var inventario = snapshot.inventario;
  var byId = (state && state.lotesById) || (state && state.byId) || {};
  var warnings = [];
  var timestamp = yarnInventoryAuditTimestamp_();
  var editor = yarnInventoryEditorEmail_();

  // Last-wins map normalized lowercase for duplicate detection, keep last snapshot row
  var snapshotByNorm = {};
  var normToId = {};
  var orderIds = [];
  for (var i = 0; i < snapshot.rows.length; i++) {
    var r = snapshot.rows[i];
    if (!r.eligible) continue;
    var id = yarnInventoryLotesId_(fechaKey, turno, r.lote_id, r.sheetRow);
    var norm = String(id).trim().toLowerCase();
    if (snapshotByNorm[norm]) {
      warnings.push('\u26a0\ufe0f Lote duplicado: ' + String(r.lote_id || ('row' + r.sheetRow)) + ' \u2014 \u00faltimo valor guardado');
      // replace mapping but keep order position (remove old position, push to end)
      var oldId = normToId[norm];
      var idx = orderIds.indexOf(oldId);
      if (idx !== -1) orderIds.splice(idx, 1);
    }
    snapshotByNorm[norm] = r;
    normToId[norm] = id;
    if (orderIds.indexOf(id) === -1) orderIds.push(id);
    // Need to keep id for correct fallback when lote_id empty: last row wins for same fallback id should not happen because rowNum differs, so ids differ row6 vs row7.
    // However duplicate empty never collides because fallback uses rowNum. So duplicate only applies to non-empty lote_id.
  }

  var plans = [];
  // Build id->row map for iteration using norm keys but final id is original case id
  for (var n = 0; n < orderIds.length; n++) {
    var finalId = orderIds[n];
    var normKey = String(finalId).trim().toLowerCase();
    var rowL = snapshotByNorm[normKey];
    if (!rowL) continue;
    // Recompute finalId to ensure case matches current snapshot's lote_id (if case changed, PK should reflect first's case? Use trimmed original)
    // Use finalId as stored (already from snapshot)
    var existing = byId[finalId];
    // For lote_id duplicates with different case, existing lookup may fail due to case. Try case-insensitive lookup among byId keys.
    if (!existing) {
      for (var bId in byId) {
        if (!Object.prototype.hasOwnProperty.call(byId, bId)) continue;
        if (String(bId).trim().toLowerCase() === normKey) { existing = byId[bId]; finalId = bId; break; }
      }
    }
    var existingData = existing ? existing.data : null;
    var creado = existingData ? existingData[YARN_INVENTORY_CONFIG.IDX_LOTES.CREADO] : '';
    if (!creado) creado = timestamp;
    var values = new Array(YARN_INVENTORY_CONFIG.LIMITS.DB_LOTES_COLUMNS);
    values[YARN_INVENTORY_CONFIG.IDX_LOTES.ID] = finalId;
    values[YARN_INVENTORY_CONFIG.IDX_LOTES.FECHA] = fechaDate;
    values[YARN_INVENTORY_CONFIG.IDX_LOTES.TURNO] = turno;
    values[YARN_INVENTORY_CONFIG.IDX_LOTES.SUPERVISOR] = supervisor;
    values[YARN_INVENTORY_CONFIG.IDX_LOTES.INVENTARIO] = inventario;
    values[YARN_INVENTORY_CONFIG.IDX_LOTES.LOTE_ID] = rowL.lote_id;
    values[YARN_INVENTORY_CONFIG.IDX_LOTES.TIPO_ORDEN] = rowL.tipo_orden;
    values[YARN_INVENTORY_CONFIG.IDX_LOTES.COLOR] = rowL.color;
    values[YARN_INVENTORY_CONFIG.IDX_LOTES.TITULO] = rowL.titulo;
    values[YARN_INVENTORY_CONFIG.IDX_LOTES.OBJETIVO_NETO] = rowL.objetivo_neto;
    values[YARN_INVENTORY_CONFIG.IDX_LOTES.AUMENTO] = rowL.aumento;
    values[YARN_INVENTORY_CONFIG.IDX_LOTES.PESADA_1] = rowL.pesada_1;
    values[YARN_INVENTORY_CONFIG.IDX_LOTES.PESADA_2] = rowL.pesada_2;
    values[YARN_INVENTORY_CONFIG.IDX_LOTES.PESADA_3] = rowL.pesada_3;
    values[YARN_INVENTORY_CONFIG.IDX_LOTES.PESADA_4] = rowL.pesada_4;
    values[YARN_INVENTORY_CONFIG.IDX_LOTES.PESADA_5] = rowL.pesada_5;
    values[YARN_INVENTORY_CONFIG.IDX_LOTES.PESADA_6] = rowL.pesada_6;
    values[YARN_INVENTORY_CONFIG.IDX_LOTES.PESADA_7] = rowL.pesada_7;
    values[YARN_INVENTORY_CONFIG.IDX_LOTES.PESADA_8] = rowL.pesada_8;
    values[YARN_INVENTORY_CONFIG.IDX_LOTES.TOTAL_PESADO] = rowL.total_pesado;
    values[YARN_INVENTORY_CONFIG.IDX_LOTES.CREADO] = creado;
    values[YARN_INVENTORY_CONFIG.IDX_LOTES.ACTUALIZADO] = timestamp;
    values[YARN_INVENTORY_CONFIG.IDX_LOTES.EDITADO_POR] = editor;
    values[YARN_INVENTORY_CONFIG.IDX_LOTES.RANGO_ORIGEN] = rowL.rango_origen;
    values[YARN_INVENTORY_CONFIG.IDX_LOTES.ESTADO] = 'active';
    plans.push({ id: finalId, rowNum: existing ? existing.rowNum : 0, values: values });
  }

  // Voids: existing rows for same fecha+turno not present in snapshot (and not fallback row duplicates)
  // Need set of inserted norm keys
  var insertedNorms = {};
  for (var q = 0; q < orderIds.length; q++) {
    insertedNorms[String(orderIds[q]).trim().toLowerCase()] = true;
  }
  for (var idKey2 in byId) {
    if (!Object.prototype.hasOwnProperty.call(byId, idKey2)) continue;
    var normExisting = String(idKey2).trim().toLowerCase();
    if (insertedNorms[normExisting]) continue;
    var entry2 = byId[idKey2];
    var data2 = entry2.data;
    var rowFechaKey2 = yarnInventoryDateKey_(data2[YARN_INVENTORY_CONFIG.IDX_LOTES.FECHA]);
    if (rowFechaKey2 !== fechaKey) continue;
    var rowTurno2 = String(data2[YARN_INVENTORY_CONFIG.IDX_LOTES.TURNO] || '').trim();
    if (rowTurno2.toLowerCase() !== String(turno).trim().toLowerCase()) continue;
    var estado2 = String(data2[YARN_INVENTORY_CONFIG.IDX_LOTES.ESTADO] || '').toLowerCase();
    if (estado2 === 'void') continue;
    var voidValues2 = data2.slice();
    voidValues2[YARN_INVENTORY_CONFIG.IDX_LOTES.ACTUALIZADO] = timestamp;
    voidValues2[YARN_INVENTORY_CONFIG.IDX_LOTES.EDITADO_POR] = editor;
    voidValues2[YARN_INVENTORY_CONFIG.IDX_LOTES.ESTADO] = 'void';
    plans.push({ id: idKey2, rowNum: entry2.rowNum, values: voidValues2, isVoid: true });
  }

  return { plans: plans, warnings: warnings };
}

// --- Apply helpers (batch, no scattered A1) ---

function yarnInventoryApplyMadejerasPlan_(ss, planObj) {
  var byIdState = yarnInventoryLoadState_(ss).madejeras;
  // Actually we want the sheet from plan's state, but to support plan passed with ss only, reload.
  // If planObj contains plans, apply directly using current sheet from SS.
  var sheet = yarnInventoryGetSheet_(ss, 'DB_MADEJERAS');
  if (!sheet) {
    yarnInventoryEnsureDbSheets_(ss);
    sheet = yarnInventoryGetSheet_(ss, 'DB_MADEJERAS');
  }
  return yarnInventoryApplyPlans_(sheet, planObj.plans, YARN_INVENTORY_CONFIG.LIMITS.DB_MADEJERAS_COLUMNS);
}

function yarnInventoryApplyLotesPlan_(ss, planObj) {
  var sheet = yarnInventoryGetSheet_(ss, 'DB_LOTES');
  if (!sheet) {
    yarnInventoryEnsureDbSheets_(ss);
    sheet = yarnInventoryGetSheet_(ss, 'DB_LOTES');
  }
  return yarnInventoryApplyPlans_(sheet, planObj.plans, YARN_INVENTORY_CONFIG.LIMITS.DB_LOTES_COLUMNS);
}

/**
 * Generic apply: updates contiguous rows in one batch, appends inserts together.
 * Expects plan entries with rowNum (0 insert else update/void).
 */
function yarnInventoryApplyPlans_(sheet, plans, width) {
  if (!plans || plans.length === 0) return { updated: 0, inserted: 0 };
  var updates = plans.filter(function (p) { return p.rowNum; }).sort(function (a, b) { return a.rowNum - b.rowNum; });
  var inserts = plans.filter(function (p) { return !p.rowNum; });

  // Write contiguous groups
  var group = [];
  for (var i = 0; i < updates.length; i++) {
    var entry = updates[i];
    group.push(entry);
    var next = updates[i + 1];
    if (!next || next.rowNum !== entry.rowNum + 1) {
      sheet.getRange(group[0].rowNum, 1, group.length, width).setValues(group.map(function (g) { return g.values; }));
      group = [];
    }
  }

  var inserted = 0;
  if (inserts.length) {
    var start = sheet.getLastRow() + 1;
    sheet.getRange(start, 1, inserts.length, width).setValues(inserts.map(function (e) { return e.values; }));
    inserted = inserts.length;
  }
  return { updated: updates.length, inserted: inserted };
}

// --- Guardar entry points (menu-only, explicit save) ---

function guardarMadejeras() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lock = LockService.getDocumentLock();
  if (!yarnInventoryAcquireLock_(lock)) {
    yarnInventoryLogError_(YARN_INVENTORY_CONFIG.ERRORS.LOCK_TIMEOUT, 'Document lock exhausted after one retry.', 'madejeras', ss);
    ss.toast('\u23f3 Registro ocupado \u2014 reintentando\u2026', 'Inventario', 3);
    Utilities.sleep(300);
    ss.toast('\u274c Error \u2014 use Re-sincronizar', 'Inventario', 5);
    return { saved: false, reason: YARN_INVENTORY_CONFIG.ERRORS.LOCK_TIMEOUT };
  }
  try {
    yarnInventoryEnsureDbSheets_(ss);
    var snapshot = yarnInventoryReadMadejerasSnapshot_(ss);
    if (!snapshot.valid) {
      yarnInventoryLogError_(snapshot.errorCode, snapshot.reason, snapshot.range, ss);
      ss.toast(snapshot.message, 'Inventario', 5);
      return { saved: false, reason: snapshot.errorCode };
    }
    var state = yarnInventoryLoadState_(ss);
    var plan = yarnInventoryBuildMadejerasPlan_(snapshot, state);
    // Toast duplicate warnings regardless of plan size
    for (var w = 0; w < plan.warnings.length; w++) ss.toast(plan.warnings[w], 'Inventario', 5);
    if (plan.plans.length === 0) {
      ss.toast('\u26a0\ufe0f Complet\u00e1 al menos una fila con datos', 'Inventario', 5);
      return { saved: false, reason: 'empty_form' };
    }
    yarnInventoryApplyMadejerasPlan_(ss, plan);
    SpreadsheetApp.flush();
    var editor = yarnInventoryEditorEmail_();
    var activeCount = plan.plans.filter(function (p) { return String(p.values[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.ESTADO]).toLowerCase() === 'active'; }).length;
    var voidCount = plan.plans.length - activeCount;
    var msg = '\u2705 Guardado: ' + snapshot.fechaKey + ' ' + snapshot.turno + ' \u2014 ' + activeCount + ' madejeras' + (voidCount ? ' (' + voidCount + ' void)' : '') + ' por ' + editor;
    ss.toast(msg, 'Inventario', 5);
    return { saved: true, count: plan.plans.length, active: activeCount, voids: voidCount };
  } catch (e) {
    yarnInventoryLogError_('execution_failure', e && e.message ? e.message : String(e), 'madejeras', ss);
    ss.toast('\u274c Error \u2014 use Re-sincronizar', 'Inventario', 5);
    throw e;
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

function guardarLotes() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lock = LockService.getDocumentLock();
  if (!yarnInventoryAcquireLock_(lock)) {
    yarnInventoryLogError_(YARN_INVENTORY_CONFIG.ERRORS.LOCK_TIMEOUT, 'Document lock exhausted after one retry.', 'lotes', ss);
    ss.toast('\u23f3 Registro ocupado \u2014 reintentando\u2026', 'Inventario', 3);
    Utilities.sleep(300);
    ss.toast('\u274c Error \u2014 use Re-sincronizar', 'Inventario', 5);
    return { saved: false, reason: YARN_INVENTORY_CONFIG.ERRORS.LOCK_TIMEOUT };
  }
  try {
    yarnInventoryEnsureDbSheets_(ss);
    var snapshot = yarnInventoryReadLotesSnapshot_(ss);
    if (!snapshot.valid) {
      yarnInventoryLogError_(snapshot.errorCode, snapshot.reason, snapshot.range, ss);
      ss.toast(snapshot.message, 'Inventario', 5);
      return { saved: false, reason: snapshot.errorCode };
    }
    var state = yarnInventoryLoadState_(ss);
    var plan = yarnInventoryBuildLotesPlan_(snapshot, state);
    for (var w2 = 0; w2 < plan.warnings.length; w2++) ss.toast(plan.warnings[w2], 'Inventario', 5);
    if (plan.plans.length === 0) {
      ss.toast('\u26a0\ufe0f Complet\u00e1 al menos una fila con datos', 'Inventario', 5);
      return { saved: false, reason: 'empty_form' };
    }
    yarnInventoryApplyLotesPlan_(ss, plan);
    SpreadsheetApp.flush();
    var editor2 = yarnInventoryEditorEmail_();
    var activeCount2 = plan.plans.filter(function (p) { return String(p.values[YARN_INVENTORY_CONFIG.IDX_LOTES.ESTADO]).toLowerCase() === 'active'; }).length;
    var voidCount2 = plan.plans.length - activeCount2;
    var msg2 = '\u2705 Guardado: ' + snapshot.fechaKey + ' ' + snapshot.turno + ' \u2014 ' + activeCount2 + ' lotes' + (voidCount2 ? ' (' + voidCount2 + ' void)' : '') + ' por ' + editor2;
    ss.toast(msg2, 'Inventario', 5);
    return { saved: true, count: plan.plans.length, active: activeCount2, voids: voidCount2 };
  } catch (e2) {
    yarnInventoryLogError_('execution_failure', e2 && e2.message ? e2.message : String(e2), 'lotes', ss);
    ss.toast('\u274c Error \u2014 use Re-sincronizar', 'Inventario', 5);
    throw e2;
  } finally {
    try { lock.releaseLock(); } catch (ignore2) {}
  }
}

