/**
 * Core.gs — Split from Code.gs
 * Role: Core ingest — installable handleEdit + backfill + commitRegistroBatch (LockService, upsert/void).
 * Original: Control de Asistencia — Registro Centralization.
 * Notes: Apps Script concatenates all .gs files; order does not matter. Do not change logic. Keep SpreadsheetApp.flush() where needed.
 */

function handleEdit(e) {
  const ss = e && e.source ? e.source : SpreadsheetApp.getActiveSpreadsheet();
  try {
    if (!e || !e.range) {
      Logger.log('handleEdit: missing event — manual run ignored');
      return;
    }
    const sheet = e.range.getSheet();
    const sheetName = sheet.getName();

    if (isCalendarRange(e.range)) {
      Logger.log('handleEdit: calendar range S7:U7/S9:U9 — zero writes per FR-006');
      return;
    }
    if (!validateHoja2()) {
      ss.toast('⚠️ Hoja2 no accesible — verificá Hoja2!A1:B12 y D1:E7. Sin escritura.', 'Asistencia', 7);
      logToErrors(sheetName, e.range.getA1Notation(), '', 'hoja2_missing');
      return;
    }
    if (isIgnorableSheet(sheetName)) return;

    // Apoyo handler — A3:E3 5-col Fecha/Operador/Seccion/Codigo/Motivo
    if (sheetName === CONFIG.APOYO_SHEET) {
      if (!isApoyoRange(e.range)) return;
      return handleApoyoEdit(e, false);
    }

    if (!rangeIntersectsInput(e.range)) return;

    const section = resolveSection(sheet);
    if (!section) {
      ss.toast('⚠️ Sección no mapeada en Config!A:B — sin escritura. Mapeá sheetId o nombre.', 'Asistencia', 7);
      logToErrors(sheetName, e.range.getA1Notation(), '', 'section_unmapped');
      return;
    }

    const r1 = Math.max(e.range.getRow(), CONFIG.INPUT_ROW_START);
    const r2 = Math.min(e.range.getRow() + e.range.getNumRows() - 1, CONFIG.INPUT_ROW_END);
    const c1 = Math.max(e.range.getColumn(), CONFIG.INPUT_COL_START);
    const c2 = Math.min(e.range.getColumn() + e.range.getNumColumns() - 1, CONFIG.INPUT_COL_END);
    if (r1 > r2 || c1 > c2) return;

    const e11Row = sheet.getRange(11, CONFIG.INPUT_COL_START, 1, CONFIG.INPUT_COL_END - CONFIG.INPUT_COL_START + 1).getDisplayValues()[0];
    const operatorRows = sheet.getRange(CONFIG.INPUT_ROW_START, 3, CONFIG.INPUT_ROW_END - CONFIG.INPUT_ROW_START + 1, 1).getValues();
    const editedValues = sheet.getRange(r1, c1, r2 - r1 + 1, c2 - c1 + 1).getValues();

    const allowed = [];
    let countInvalid = 0;
    let countWindowBlocked = 0;
    let countBlankE11 = 0;

    for (let r = 0; r < editedValues.length; r++) {
      const sheetRow = r1 + r;
      const operatorName = String(operatorRows[sheetRow - CONFIG.INPUT_ROW_START][0] || '').trim();
      if (!operatorName) continue;
      for (let c = 0; c < editedValues[r].length; c++) {
        const sheetCol = c1 + c;
        const colOffset = sheetCol - CONFIG.INPUT_COL_START;
        const e11Disp = e11Row[colOffset];
        const iso = parseE11ToIso(e11Disp);
        if (!iso) { countBlankE11++; continue; }
        const rawVal = editedValues[r][c];
        const trimmed = String(rawVal == null ? '' : rawVal).trim();
        const isEmpty = trimmed === '';
        const normCode = isEmpty ? '' : normalizeCode(trimmed);
        if (!isEmpty && !isCodeValid(normCode)) {
          countInvalid++;
          const srcA1 = sheetName + '!' + sheet.getRange(sheetRow, sheetCol).getA1Notation();
          logToErrors(section, srcA1, String(rawVal), 'codigo_invalido');
          continue;
        }
        if (!isInWindow(iso)) {
          countWindowBlocked++;
          const srcA1 = sheetName + '!' + sheet.getRange(sheetRow, sheetCol).getA1Notation();
          logToErrors(section, srcA1, normCode, 'fuera_ventana_' + iso);
          continue;
        }
        const codeLabel = normCode ? (CONFIG.LABELS[normCode] || normCode) : '';
        const srcA1 = sheetName + '!' + sheet.getRange(sheetRow, sheetCol).getA1Notation();
        const rid = recordId(section, operatorName, iso);
        allowed.push({
          section: section, operatorName: operatorName, isoDate: iso, code: normCode, codeLabel: codeLabel,
          isApoyo: false, nota: '', sourceRange: srcA1, recordId: rid, sheetRow: sheetRow, sheetCol: sheetCol
        });
      }
    }

    if (countInvalid > 0) {
      ss.toast('⚠️ Código no válido. Use A, AT, BM o F. (' + countInvalid + ' celda(s) ignorada(s))', 'Asistencia', 5);
    }

    if (allowed.length === 0) {
      if (countWindowBlocked > 0) {
        ss.toast('⛔ Solo podés registrar hoy y ayer (America/La_Paz). (' + countWindowBlocked + ' fuera de ventana)', 'Asistencia', 7);
      }
      return;
    }

    const result = commitRegistroBatch(allowed);
    if (result.queued) return;

    const ins = result.ins;
    const upd = result.upd;
    const voided = result.voided;
    const totalWindowBlocked = countWindowBlocked;

    if (allowed.length === 1 && ins + upd + voided === 1) {
      const cand = allowed[0];
      if (voided === 1) ss.toast('🗑️ void: ' + cand.operatorName + ' — ' + cand.isoDate, 'Asistencia', 5);
      else ss.toast('✅ Registrado: ' + cand.operatorName + ' — ' + cand.isoDate + ' = ' + cand.code, 'Asistencia', 5);
    } else {
      const parts = [];
      if (ins > 0) parts.push(ins + ' ins');
      if (upd > 0) parts.push(upd + ' upd');
      if (voided > 0) parts.push(voided + ' void');
      if (totalWindowBlocked > 0) parts.push(totalWindowBlocked + ' fuera');
      if (countInvalid > 0) parts.push(countInvalid + ' inválido(s)');
      if (parts.length > 0) ss.toast('✅ Sincronizados: ' + parts.join(' / '), 'Asistencia', 7);
    }
    if (totalWindowBlocked > 0 && allowed.length > 1) Logger.log('handleEdit window blocked: ' + totalWindowBlocked);
  } catch (err) {
    Logger.log('handleEdit error: ' + err.message + ' stack: ' + err.stack);
    try {
      ss.toast('❌ Error en registro: ' + err.message + ' — Usá Re-sincronizar.', 'Asistencia', 7);
      logToErrors(e && e.range ? e.range.getSheet().getName() : '', e && e.range ? e.range.getA1Notation() : '', '', 'exception_' + err.message);
    } catch (e2) {}
  }
}

// --- BACKFILL IDEMPOTENT (PR 3) ---

function doBackfill(bypassWindow) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!validateHoja2()) {
    ss.toast('⚠️ Hoja2 no accesible — backfill cancelado.', 'Asistencia', 7);
    logToErrors('', '', '', 'hoja2_missing_backfill');
    return 'Hoja2 no accesible — cancelado';
  }
  const startTime = new Date().getTime();
  const MAX_MS = 5.5 * 60 * 1000; // 5.5 min guard before 6 min quota
  let totalIns = 0, totalUpd = 0, totalVoided = 0, totalSkippedBlank = 0, totalSkippedWindow = 0, totalInvalid = 0, totalEmptyCells = 0;
  let sheetsScanned = 0;

  const allSheets = ss.getSheets();
  const lock = LockService.getDocumentLock();

  for (let s = 0; s < allSheets.length; s++) {
    if (new Date().getTime() - startTime > MAX_MS) {
      ss.toast('⏳ Backfill pausado por tiempo (~5.5 min). Re-ejecutá Backfill para continuar. (' + totalIns + ' ins/' + totalUpd + ' upd)', 'Asistencia', 7);
      logToErrors('', '', '', 'backfill_chunk_pause_' + sheetsScanned + '_' + totalIns + 'ins');
      break;
    }
    const sh = allSheets[s];
    const name = sh.getName();
    if (isIgnorableSheet(name) || name === CONFIG.APOYO_SHEET) continue;
    const section = resolveSection(sh);
    if (!section) continue; // unmapped → skip silently (warn in Errors)
    sheetsScanned++;

    // Batch reads: E11 row, operator names C15:C44, input zone E15:AI44
    const e11Row = sh.getRange(11, CONFIG.INPUT_COL_START, 1, CONFIG.INPUT_COL_END - CONFIG.INPUT_COL_START + 1).getDisplayValues()[0];
    const operatorRows = sh.getRange(CONFIG.INPUT_ROW_START, 3, CONFIG.INPUT_ROW_END - CONFIG.INPUT_ROW_START + 1, 1).getValues();
    const inputValues = sh.getRange(CONFIG.INPUT_ROW_START, CONFIG.INPUT_COL_START, CONFIG.INPUT_ROW_END - CONFIG.INPUT_ROW_START + 1, CONFIG.INPUT_COL_END - CONFIG.INPUT_COL_START + 1).getValues();

    const candidates = [];
    for (let r = 0; r < inputValues.length; r++) {
      const operatorName = String(operatorRows[r][0] || '').trim();
      if (!operatorName) continue;
      for (let c = 0; c < inputValues[r].length; c++) {
        const e11Disp = e11Row[c];
        const iso = parseE11ToIso(e11Disp);
        if (!iso) { totalSkippedBlank++; continue; }
        const raw = inputValues[r][c];
        const trimmed = String(raw == null ? '' : raw).trim();
        if (trimmed === '') { totalEmptyCells++; continue; }
        const normCode = normalizeCode(trimmed);
        if (!isCodeValid(normCode)) { totalInvalid++; logToErrors(section, name + '!' + sh.getRange(CONFIG.INPUT_ROW_START + r, CONFIG.INPUT_COL_START + c).getA1Notation(), String(raw), 'codigo_invalido_backfill'); continue; }
        if (!bypassWindow && !isInWindow(iso)) { totalSkippedWindow++; continue; }
        const codeLabel = CONFIG.LABELS[normCode] || normCode;
        const srcA1 = name + '!' + sh.getRange(CONFIG.INPUT_ROW_START + r, CONFIG.INPUT_COL_START + c).getA1Notation();
        candidates.push({
          section: section, operatorName: operatorName, isoDate: iso, code: normCode, codeLabel: codeLabel,
          isApoyo: false, nota: bypassWindow ? 'via_manual:backfill ' + iso : '', sourceRange: srcA1, recordId: recordId(section, operatorName, iso)
        });
      }
    }

    if (candidates.length === 0) continue;

    // Chunk candidates to avoid >6 min lock: commit in batches of 200
    const CHUNK = 200;
    for (let i = 0; i < candidates.length; i += CHUNK) {
      if (new Date().getTime() - startTime > MAX_MS) break;
      const chunk = candidates.slice(i, i + CHUNK);
      const res = commitRegistroBatch(chunk);
      if (res.queued) {
        ss.toast('⏳ Backfill lock ocupado — reintentá.', 'Asistencia', 7);
        logToErrors(section, name, '', 'lock_timeout_backfill');
        Utilities.sleep(1200);
        const retry = commitRegistroBatch(chunk);
        totalIns += retry.ins; totalUpd += retry.upd; totalVoided += retry.voided;
      } else {
        totalIns += res.ins; totalUpd += res.upd; totalVoided += res.voided;
      }
    }
  }

  const summary = sheetsScanned + ' secciones, ' + totalIns + ' ins / ' + totalUpd + ' upd' + (totalVoided ? ' / ' + totalVoided + ' void' : '') + (bypassWindow ? ' (bypass ventana)' : ' (ventana hoy/ayer)') + (totalSkippedWindow ? ', ' + totalSkippedWindow + ' fuera ventana' : '') + (totalInvalid ? ', ' + totalInvalid + ' inválido(s)' : '');
  ss.toast('✅ Backfill listo: ' + summary, 'Asistencia', 7);
  logToErrors('', '', '', 'backfill_ok_' + summary);
  SpreadsheetApp.flush();
  return summary;
}

function commitRegistroBatch(candidates) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lock = LockService.getDocumentLock();
  let locked = false;
  try {
    locked = lock.tryLock(5000);
    if (!locked) {
      Utilities.sleep(1000);
      locked = lock.tryLock(5000);
    }
    if (!locked) {
      try {
        const props = PropertiesService.getDocumentProperties();
        const key = 'registro_queue_' + new Date().getTime() + '_' + Utilities.getUuid().slice(0, 8);
        const payload = JSON.stringify(candidates.map(function (c) {
          return { recordId: c.recordId, range: c.sourceRange, code: c.code, date: c.isoDate };
        }));
        props.setProperty(key, payload);
      } catch (e) {
        Logger.log('queue save fail: ' + e.message);
      }
      ss.toast('⏳ Registro ocupado, reintentando… Si persiste, usá Re-sincronizar.', 'Asistencia', 7);
      logToErrors(candidates[0].section, candidates[0].sourceRange, candidates[0].code, 'lock_timeout');
      return { ins: 0, upd: 0, voided: 0, queued: true };
    }

    let reg = ss.getSheetByName(CONFIG.REGISTRO);
    if (!reg) reg = ensureRegistroHeader();
    const lastRow = reg.getLastRow();
    const idToRow = {};
    let existingRows = [];
    if (lastRow > 1) {
      existingRows = reg.getRange(2, 1, lastRow - 1, CONFIG.HEADER.length).getValues();
      for (let i = 0; i < existingRows.length; i++) {
        const rid = String(existingRows[i][0] || '').trim();
        if (rid) idToRow[rid] = { idx: i, rowNum: i + 2, data: existingRows[i] };
      }
    }

    const nowStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
    const editedBy = 'unknown';
    let ins = 0;
    let upd = 0;
    let voided = 0;
    const toAppend = [];

    for (let k = 0; k < candidates.length; k++) {
      const cand = candidates[k];
      const rid = cand.recordId;
      const existing = idToRow[rid];

      if (cand.code === '') {
        if (existing) {
          const curStatus = String(existing.data[12] || '').trim();
          if (curStatus !== 'void') {
            const rowNum = existing.rowNum;
            const newRow = existing.data.slice();
            newRow[2] = nowStr;
            newRow[6] = '';
            newRow[7] = '';
            newRow[9] = editedBy;
            newRow[10] = cand.sourceRange;
            newRow[11] = cand.nota || existing.data[11] || '';
            newRow[12] = 'void';
            reg.getRange(rowNum, 1, 1, CONFIG.HEADER.length).setValues([newRow]);
            existing.data = newRow;
            voided++;
          }
        }
      } else {
        if (existing) {
          const rowNum = existing.rowNum;
          const newRow = existing.data.slice();
          newRow[2] = nowStr;
          newRow[3] = cand.section;
          newRow[4] = cand.operatorName;
          newRow[5] = cand.isoDate;
          newRow[6] = cand.code;
          newRow[7] = cand.codeLabel;
          newRow[8] = cand.isApoyo;
          newRow[9] = editedBy;
          newRow[10] = cand.sourceRange;
          newRow[11] = cand.nota != null ? cand.nota : existing.data[11];
          newRow[12] = 'active';
          reg.getRange(rowNum, 1, 1, CONFIG.HEADER.length).setValues([newRow]);
          existing.data = newRow;
          upd++;
        } else {
          let dupIdx = -1;
          for (let t = 0; t < toAppend.length; t++) {
            if (toAppend[t][0] === rid) { dupIdx = t; break; }
          }
          if (dupIdx !== -1) {
            const row = toAppend[dupIdx];
            row[2] = nowStr;
            row[6] = cand.code;
            row[7] = cand.codeLabel;
            row[9] = editedBy;
            row[10] = cand.sourceRange;
            row[11] = cand.nota != null ? cand.nota : row[11];
            row[8] = cand.isApoyo;
            row[12] = 'active';
          } else {
            const newRow = [
              rid,
              nowStr,
              nowStr,
              cand.section,
              cand.operatorName,
              cand.isoDate,
              cand.code,
              cand.codeLabel,
              cand.isApoyo,
              editedBy,
              cand.sourceRange,
              cand.nota || '',
              'active'
            ];
            toAppend.push(newRow);
          }
        }
      }
    }

    if (toAppend.length > 0) {
      const curLast = reg.getLastRow();
      reg.getRange(curLast + 1, 1, toAppend.length, CONFIG.HEADER.length).setValues(toAppend);
      ins = toAppend.length;
    }

    SpreadsheetApp.flush();
    return { ins: ins, upd: upd, voided: voided, queued: false };
  } finally {
    if (locked) {
      try { lock.releaseLock(); } catch (e) {}
    }
  }
}
