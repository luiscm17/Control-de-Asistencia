/**
 * Apoyo.gs — Split from Code.gs
 * Role: Apoyo A3:E3 ingest — date parsing, range guard, handleApoyoEdit.
 * Original: Control de Asistencia — Registro Centralization.
 * Notes: Apps Script concatenates all .gs files; order does not matter. Do not change logic.
 */

function parseApoyoDateToIso(val) {
  if (val == null || val === '') return null;
  if (Object.prototype.toString.call(val) === '[object Date]' && !isNaN(val)) {
    // Date object from sheet
    return Utilities.formatDate(val, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  }
  const s = String(val).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const parts = s.split('-');
    const y = parseInt(parts[0], 10); const m = parseInt(parts[1], 10); const d = parseInt(parts[2], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const dim = new Date(y, m, 0).getDate();
      if (d <= dim) return s;
    }
    return null;
  }
  if (s.indexOf('/') !== -1) {
    return parseE11ToIso(s);
  }
  // Try native Date parse as fallback
  const d = new Date(s);
  if (!isNaN(d)) return Utilities.formatDate(d, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  return null;
}

function isApoyoRange(range) {
  const sheet = range.getSheet();
  if (sheet.getName() !== CONFIG.APOYO_SHEET) return false;
  const r1 = range.getRow();
  const c1 = range.getColumn();
  const r2 = r1 + range.getNumRows() - 1;
  const c2 = c1 + range.getNumColumns() - 1;
  const ar1 = CONFIG.APOYO_A3_ROW;
  const ar2 = CONFIG.APOYO_A3_ROW;
  const ac1 = CONFIG.APOYO_A3_COL_START;
  const ac2 = CONFIG.APOYO_A3_COL_END;
  return !(r2 < ar1 || r1 > ar2 || c2 < ac1 || c1 > ac2);
}

function handleApoyoEdit(e, viaManual) {
  const ss = e && e.source ? e.source : SpreadsheetApp.getActiveSpreadsheet();
  const sheet = e && e.range ? e.range.getSheet() : ss.getSheetByName(CONFIG.APOYO_SHEET);
  if (!sheet) return;
  const apoyoRow = sheet.getRange(CONFIG.APOYO_A3_ROW, CONFIG.APOYO_A3_COL_START, 1, CONFIG.APOYO_A3_COL_END).getValues()[0];
  const apoyoDisplay = sheet.getRange(CONFIG.APOYO_A3_ROW, CONFIG.APOYO_A3_COL_START, 1, CONFIG.APOYO_A3_COL_END).getDisplayValues()[0];
  // A3:E3 = Fecha, Operador, Seccion, Codigo, Motivo
  let fechaVal = apoyoRow[0];
  // Prefer display for D/M/YYYY strings; if fechaVal is Date, keep date
  if (!(fechaVal instanceof Date) || isNaN(fechaVal)) {
    const dispFecha = apoyoDisplay[0];
    if (dispFecha && String(dispFecha).trim() !== '') fechaVal = dispFecha;
  }
  const operador = String(apoyoRow[1] || '').trim();
  const seccion = String(apoyoRow[2] || '').trim();
  const codigoRaw = String(apoyoRow[3] || '').trim();
  const motivo = String(apoyoRow[4] || '').trim();

  // Empty row check — if Fecha/Operador/Seccion/Codigo all empty, treat as clear attempt (no-op)
  if (!fechaVal && !operador && !seccion && !codigoRaw && !motivo) {
    // If there is an existing Apoyo row for prior date? Can't determine without fecha — ignore
    return;
  }

  const iso = parseApoyoDateToIso(fechaVal);
  if (!iso) {
    ss.toast('⚠️ Fecha Apoyo no válida: ' + String(fechaVal) + '. Use YYYY-MM-DD o D/M/YYYY.', 'Asistencia', 5);
    logToErrors(seccion || CONFIG.APOYO_SHEET, CONFIG.APOYO_RANGE, String(fechaVal), 'fecha_invalida_apoyo');
    return;
  }
  if (!operador) {
    ss.toast('⚠️ Apoyo: Operador vacío en B3.', 'Asistencia', 5);
    logToErrors(seccion || CONFIG.APOYO_SHEET, CONFIG.APOYO_RANGE, '', 'operador_vacio_apoyo');
    return;
  }
  if (!seccion) {
    ss.toast('⚠️ Apoyo: Sección vacía en C3.', 'Asistencia', 5);
    logToErrors(CONFIG.APOYO_SHEET, CONFIG.APOYO_RANGE, '', 'seccion_vacia_apoyo');
    return;
  }
  if (CONFIG.LOGICAL_SECTIONS.indexOf(seccion) === -1 && !resolveSection({ getSheetId: function() { return seccion; }, getName: function() { return seccion; } })) {
    // Warn but allow — section might be canonical; still log
    Logger.log('handleApoyoEdit: section not in canonical list: ' + seccion);
  }
  const normCode = codigoRaw === '' ? '' : normalizeCode(codigoRaw);
  if (normCode !== '' && !isCodeValid(normCode)) {
    ss.toast('⚠️ Código no válido en Apoyo!D3. Use A, AT, BM o F.', 'Asistencia', 5);
    logToErrors(seccion, CONFIG.APOYO_RANGE, String(codigoRaw), 'codigo_invalido_apoyo');
    return;
  }

  const activeEmail = Session.getActiveUser().getEmail() || 'unknown';
  const responsible = getResponsibleEmail(seccion);
  const bypass = viaManual === true;
  if (!bypass) {
    if (!isInWindow(iso)) {
      ss.toast('⛔ Solo podés registrar hoy y ayer (America/La_Paz). Apoyo fecha ' + iso + ' fuera de ventana — usá Solicitar corrección.', 'Asistencia', 7);
      logToErrors(seccion, CONFIG.APOYO_RANGE, normCode, 'fuera_ventana_apoyo_' + iso);
      return;
    }
    if (responsible && activeEmail !== responsible && activeEmail !== 'unknown') {
      ss.toast('⛔ No tenés permiso para sección ' + seccion + '.', 'Asistencia', 7);
      logToErrors(seccion, CONFIG.APOYO_RANGE, normCode, 'sin_permiso_responsable_apoyo_' + responsible);
      return;
    }
  } else {
    logToErrors(seccion, CONFIG.APOYO_RANGE, normCode, 'via_manual_apoyo_' + iso);
  }

  const codeLabel = normCode ? (CONFIG.LABELS[normCode] || normCode) : '';
  const nota = motivo + (bypass ? (motivo ? ' | ' : '') + 'via_manual:Apoyo by ' + activeEmail : '');
  const srcA1 = CONFIG.APOYO_SHEET + '!A3:E3';
  const rid = recordId(seccion, operador, iso);
  const candidate = {
    section: seccion, operatorName: operador, isoDate: iso, code: normCode, codeLabel: codeLabel,
    isApoyo: true, nota: motivo + (bypass ? (motivo ? ' | via_manual' : 'via_manual') : motivo ? motivo : ''),
    // Store full motivo in L, via_manual flag via nota suffix; keep explicit via_manual audit in Errors
    sourceRange: srcA1, recordId: rid
  };
  // Ensure nota reflects motivo + via_manual marker
  candidate.nota = motivo;
  if (bypass) candidate.nota = motivo ? motivo + ' | via_manual' : 'via_manual';
  // For via_manual, also prefix nota with via_manual for audit visibility in Registro
  if (bypass && candidate.nota.indexOf('via_manual') === -1) candidate.nota = (motivo ? motivo + ' | ' : '') + 'via_manual';

  // Void handling: if code empty and row exists → void
  const result = commitRegistroBatch([candidate]);
  if (result.queued) return;
  if (normCode === '') {
    if (result.voided > 0) ss.toast('🗑️ void Apoyo: ' + operador + ' — ' + iso, 'Asistencia', 5);
    else ss.toast('Apoyo vacío — sin fila previa.', 'Asistencia', 5);
  } else {
    if (result.ins > 0) ss.toast('✅ Apoyo registrado: ' + operador + ' — ' + iso + ' = ' + normCode + ' (' + seccion + ')', 'Asistencia', 7);
    else if (result.upd > 0) ss.toast('✅ Apoyo actualizado: ' + operador + ' — ' + iso + ' = ' + normCode, 'Asistencia', 7);
    else ss.toast('✅ Apoyo sincronizado: ' + operador + ' — ' + iso, 'Asistencia', 5);
  }
  // Audit via_manual explicitly in Errors when bypass
  if (bypass) logToErrors(seccion, srcA1, normCode, 'apoyo_via_manual_ok_' + iso);
}
