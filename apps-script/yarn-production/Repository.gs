/**
 * Repository.gs — Yarn Production batched A:Q access + locked upsert
 *
 * Batch reads A:Q; indexes by yyyy-MM-dd-TURNO id; integrity error on duplicates.
 * Upsert with LockService.getDocumentLock() tryLock(5000) + one retry.
 */

// --- BATCHED LOOKUP / INDEX ---

function yarnRepositoryLookupByDate_(isoDate) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(YARN_CONFIG.DATA_SHEET);
  const out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, YARN_CONFIG.HEADER.length).getValues();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
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

/**
 * Build full id-> {rowNum, data} index. Throws on duplicate id.
 */
function yarnBuildIdIndex_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(YARN_CONFIG.DATA_SHEET);
  const index = {};
  if (!sh || sh.getLastRow() < 2) return { sh: sh, index: index, rows: [] };
  const lastRow = sh.getLastRow();
  const rows = sh.getRange(2, 1, lastRow - 1, YARN_CONFIG.HEADER.length).getValues();
  for (let i = 0; i < rows.length; i++) {
    const id = String(rows[i][YARN_CONFIG.IDX.ID] || '').trim();
    if (id === '') continue;
    if (index[id]) {
      const msg = 'Integridad: id duplicado ' + id + ' en filas ' + index[id].rowNum + ' y ' + (i + 2);
      Logger.log(msg);
      throw new Error(msg);
    }
    index[id] = { rowNum: i + 2, data: rows[i] };
  }
  return { sh: sh, index: index, rows: rows };
}

function yarnGetEditorEmail_() {
  try {
    const a = Session.getActiveUser().getEmail();
    if (a) return a;
  } catch (e) {}
  try {
    const eff = Session.getEffectiveUser().getEmail();
    if (eff) return eff;
  } catch (e) {}
  return 'unknown';
}

// --- LOCKED UPSERT ---

/**
 * Upsert eligible form rows for isoDate.
 * @param {string} isoDate yyyy-MM-dd
 * @param {Array} formRows [{turno, processValuesRaw:[]}] length 3
 * @return {{ins:number, upd:number, queued:boolean, error:string}}
 */
function yarnUpsertForDate_(isoDate, formRows) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // Filter eligible rows: at least one process value non-blank.
  // Blank cells normalize to 0 on store (EC-06).
  const eligible = [];
  for (let i = 0; i < formRows.length; i++) {
    const fr = formRows[i];
    const turno = String(fr.turno || '').trim().toUpperCase();
    if (!yarnIsValidTurno_(turno)) continue;
    if (!yarnIsRowEligible_(fr.processValuesRaw)) continue;
    const normalized = yarnNormalizeProcessValues_(fr.processValuesRaw);
    eligible.push({ turno: turno, normalized: normalized });
  }

  if (eligible.length === 0) {
    return { ins: 0, upd: 0, queued: false, error: '' };
  }

  // Lock: tryLock(5000), sleep once, retry tryLock(5000), fail without writes if unavailable.
  const lock = LockService.getDocumentLock();
  let locked = false;
  try {
    locked = lock.tryLock(5000);
    if (!locked) {
      Utilities.sleep(1000);
      locked = lock.tryLock(5000);
    }
    if (!locked) {
      Logger.log('yarnUpsertForDate_: lock timeout for ' + isoDate);
      ss.toast('⏳ Registro ocupado — reintenta Guardar.', 'Produccion', 7);
      return { ins: 0, upd: 0, queued: true, error: 'lock_timeout' };
    }

    // Ensure data sheet exists
    let dataSh = ss.getSheetByName(YARN_CONFIG.DATA_SHEET);
    if (!dataSh) dataSh = ensureDatosProduccionSheet_();

    const built = yarnBuildIdIndex_();
    const idx = built.index;
    const sh = built.sh;

    const nowStr = Utilities.formatDate(new Date(), YARN_CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    const editor = yarnGetEditorEmail_();

    let ins = 0;
    let upd = 0;
    const toAppend = [];

    for (let k = 0; k < eligible.length; k++) {
      const e = eligible[k];
      const id = yarnBuildId_(isoDate, e.turno);
      const existing = idx[id];
      if (existing) {
        // Update in place — preserve registrado_por/creado
        const newRow = existing.data.slice();
        const builtRow = yarnBuildRecordFromFormRow_(isoDate, e.turno, e.normalized, editor, nowStr, existing.data);
        // Copy mutable fields (fecha may be refreshed to native Date)
        for (let c = 0; c < YARN_CONFIG.HEADER.length; c++) {
          newRow[c] = builtRow[c];
        }
        // Ensure registrado/creado preserved (yarnBuildRecordFromFormRow_ already does)
        sh.getRange(existing.rowNum, 1, 1, YARN_CONFIG.HEADER.length).setValues([newRow]);
        existing.data = newRow;
        upd++;
      } else {
        // Check duplicate within toAppend (should not happen — one per turno)
        let dupIdx = -1;
        for (let t = 0; t < toAppend.length; t++) {
          if (toAppend[t][YARN_CONFIG.IDX.ID] === id) { dupIdx = t; break; }
        }
        const newRow = yarnBuildRecordFromFormRow_(isoDate, e.turno, e.normalized, editor, nowStr, null);
        if (dupIdx !== -1) {
          toAppend[dupIdx] = newRow;
        } else {
          toAppend.push(newRow);
        }
      }
    }

    if (toAppend.length > 0) {
      const curLast = sh.getLastRow();
      sh.getRange(curLast + 1, 1, toAppend.length, YARN_CONFIG.HEADER.length).setValues(toAppend);
      ins = toAppend.length;
      // Also register in index for future calls within same lock (not needed after flush)
    }

    SpreadsheetApp.flush();
    return { ins: ins, upd: upd, queued: false, error: '' };

  } catch (err) {
    Logger.log('yarnUpsertForDate_ error: ' + err.message + ' stack: ' + err.stack);
    throw err;
  } finally {
    if (locked) {
      try { lock.releaseLock(); } catch (e) {}
    }
  }
}

/**
 * Convenience for tests: simulate lock failure path without holding lock.
 * Not used in production.
 */
function yarnUpsertForDateWithForcedLockFail_(isoDate, formRows) {
  // For harness only — mirrors failure toast
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast('⏳ Registro ocupado — reintenta Guardar. (simulado)', 'Produccion', 7);
  return { ins: 0, upd: 0, queued: true, error: 'lock_timeout_forced' };
}
