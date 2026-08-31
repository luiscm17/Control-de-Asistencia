/**
 * Menu.gs — Split from Code.gs
 * Role: Menu + manual entry + backfill trigger + dual-trigger setup + toast-only onEdit.
 * Original: Control de Asistencia — Registro Centralization.
 * Notes: Apps Script concatenates all .gs files; order does not matter. Public functions (no trailing _) for menu + HtmlService. Do not change logic.
 */

// --- MENU SETUP (PR 3: 6 items) ---
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Asistencia')
    .addItem('Ver Registro', 'menuVerRegistro')
    .addItem('Re-sincronizar fila', 'menuReSincronizarFila')
    .addSeparator()
    .addItem('Solicitar corrección', 'menuSolicitarCorreccion')
    .addItem('Registro manual', 'menuRegistroManual')
    .addSeparator()
    .addItem('Backfill histórico', 'menuBackfillHistorico')
    .addItem('Autorizar', 'menuAutorizar')
    .addToUi();
}

// Public menu handlers — MUST be public (no underscore) for menu + HtmlService
function menuVerRegistro() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.REGISTRO);
  if (!sh) {
    ss.toast('Registro no encontrado. Ejecutá Autorizar.', 'Asistencia', 5);
    return;
  }
  ss.setActiveSheet(sh);
}

function menuAutorizar() {
  setupInstallable();
}

function menuReSincronizarFila() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getActiveSheet();
  const name = sh.getName();
  if (isIgnorableSheet(name)) {
    ss.toast('Hoja no sincronizable.', 'Asistencia', 5);
    return;
  }
  if (name === CONFIG.APOYO_SHEET) {
    ss.toast('Usá Solicitar corrección para Apoyo.', 'Asistencia', 5);
    return;
  }
  const section = resolveSection(sh);
  if (!section) {
    ss.toast('⚠️ Sección no mapeada en Config!A:B — sin escritura.', 'Asistencia', 7);
    logToErrors(name, sh.getActiveRange() ? sh.getActiveRange().getA1Notation() : '', '', 'section_unmapped_resync');
    return;
  }
  if (!validateHoja2()) {
    ss.toast('⚠️ Hoja2 no accesible — verificá Hoja2!A1:B12 y D1:E7.', 'Asistencia', 7);
    return;
  }
  const activeRow = sh.getActiveRange() ? sh.getActiveRange().getRow() : 0;
  if (activeRow < CONFIG.INPUT_ROW_START || activeRow > CONFIG.INPUT_ROW_END) {
    ss.toast('Seleccioná una fila dentro de E15:AI44 (fila ' + CONFIG.INPUT_ROW_START + '-' + CONFIG.INPUT_ROW_END + ').', 'Asistencia', 5);
    return;
  }
  const operatorName = String(sh.getRange(activeRow, 3).getValue() || '').trim();
  if (!operatorName) {
    ss.toast('Fila sin operador en columna C — no hay PK.', 'Asistencia', 5);
    logToErrors(section, name + '!' + activeRow + ':' + activeRow, '', 'operator_missing_resync');
    return;
  }
  const e11Row = sh.getRange(11, CONFIG.INPUT_COL_START, 1, CONFIG.INPUT_COL_END - CONFIG.INPUT_COL_START + 1).getDisplayValues()[0];
  const rowValues = sh.getRange(activeRow, CONFIG.INPUT_COL_START, 1, CONFIG.INPUT_COL_END - CONFIG.INPUT_COL_START + 1).getValues()[0];
  const candidates = [];
  let countInvalid = 0;
  let countWindowBlocked = 0;
  let countPermBlocked = 0;
  let countBlankE11 = 0;
  const responsible = getResponsibleEmail(section);
  const activeEmail = Session.getActiveUser().getEmail() || 'unknown';

  for (let c = 0; c < rowValues.length; c++) {
    const col = CONFIG.INPUT_COL_START + c;
    const iso = parseE11ToIso(e11Row[c]);
    if (!iso) { countBlankE11++; continue; }
    const raw = rowValues[c];
    const trimmed = String(raw == null ? '' : raw).trim();
    const isEmpty = trimmed === '';
    const normCode = isEmpty ? '' : normalizeCode(trimmed);
    if (!isEmpty && !isCodeValid(normCode)) { countInvalid++; logToErrors(section, name + '!' + sh.getRange(activeRow, col).getA1Notation(), String(raw), 'codigo_invalido_resync'); continue; }
    if (!isInWindow(iso)) { countWindowBlocked++; logToErrors(section, name + '!' + sh.getRange(activeRow, col).getA1Notation(), normCode, 'fuera_ventana_' + iso); continue; }
    if (responsible && activeEmail !== responsible && activeEmail !== 'unknown') { countPermBlocked++; logToErrors(section, name + '!' + sh.getRange(activeRow, col).getA1Notation(), normCode, 'sin_permiso_responsable_' + responsible); continue; }
    if (normCode === '' && !findRegistroRowId(recordId(section, operatorName, iso))) {
      // void with no row → skip (will be counted as void attempt but no write)
      continue;
    }
    const codeLabel = normCode ? (CONFIG.LABELS[normCode] || normCode) : '';
    const srcA1 = name + '!' + sh.getRange(activeRow, col).getA1Notation();
    candidates.push({
      section: section, operatorName: operatorName, isoDate: iso, code: normCode, codeLabel: codeLabel,
      isApoyo: false, nota: '', sourceRange: srcA1, recordId: recordId(section, operatorName, iso)
    });
  }

  if (countInvalid > 0) sh.getParent ? null : null; // keep
  if (candidates.length === 0) {
    if (countInvalid > 0) ss.toast('⚠️ Código no válido. Use A, AT, BM o F. (' + countInvalid + ')', 'Asistencia', 5);
    if (countWindowBlocked > 0 || countPermBlocked > 0) {
      const reason = (countWindowBlocked ? countWindowBlocked + ' fuera de ventana' : '') + (countPermBlocked ? (countWindowBlocked ? ', ' : '') + countPermBlocked + ' sin permiso' : '');
      ss.toast('⛔ Re-sincronizar bloqueado: ' + reason + '.', 'Asistencia', 7);
    }
    if (candidates.length === 0 && countInvalid === 0 && countWindowBlocked === 0 && countPermBlocked === 0) {
      ss.toast('Nada para sincronizar en esta fila (E11 vacío o celdas vacías).', 'Asistencia', 5);
    }
    return;
  }
  const result = commitRegistroBatch(candidates);
  if (result.queued) return;
  const parts = [];
  if (result.ins > 0) parts.push(result.ins + ' ins');
  if (result.upd > 0) parts.push(result.upd + ' upd');
  if (result.voided > 0) parts.push(result.voided + ' void');
  if (countWindowBlocked > 0) parts.push(countWindowBlocked + ' fuera');
  if (countInvalid > 0) parts.push(countInvalid + ' inválido(s)');
  ss.toast('✅ Re-sincronizado fila ' + activeRow + ': ' + parts.join(' / ') + (countBlankE11 ? ' (' + countBlankE11 + ' col E11 vacía ignorada)' : ''), 'Asistencia', 7);
  logToErrors(section, name + '!' + activeRow + ':' + activeRow, '', 'resync_ok_' + parts.join(','));
}

function menuSolicitarCorreccion() {
  promptManualEntry(false);
}

function menuRegistroManual() {
  promptManualEntry(true);
}

function promptManualEntry(isRegistroManual) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  if (!validateHoja2()) {
    ss.toast('⚠️ Hoja2 no accesible — verificá Hoja2!A1:B12 y D1:E7.', 'Asistencia', 7);
    return;
  }
  // Prompt sequence: Fecha, Operador, Sección, Código, Motivo
  const fechaResp = ui.prompt('Corrección manual — Fecha (YYYY-MM-DD o D/M/YYYY)', 'Ej: 2026-03-10 o 10/03/2026. Bypass ventana auditable via_manual.', ui.ButtonSet.OK_CANCEL);
  if (fechaResp.getSelectedButton() !== ui.Button.OK) return;
  const fechaRaw = fechaResp.getResponseText().trim();
  if (!fechaRaw) { ss.toast('Fecha vacía — cancelado.', 'Asistencia', 5); return; }
  let iso = parseApoyoDateToIso(fechaRaw);
  if (!iso) {
    // Try parse as entered D/M/YYYY via E11 parser
    iso = parseE11ToIso(fechaRaw);
  }
  if (!iso) { ss.toast('⚠️ Fecha no válida: ' + fechaRaw, 'Asistencia', 5); logToErrors('', '', fechaRaw, 'fecha_invalida_manual'); return; }

  const opResp = ui.prompt('Operador', 'Nombre exacto como en columna C (ej: Juan Pérez):', ui.ButtonSet.OK_CANCEL);
  if (opResp.getSelectedButton() !== ui.Button.OK) return;
  const operatorName = opResp.getResponseText().trim();
  if (!operatorName) { ss.toast('Operador vacío — cancelado.', 'Asistencia', 5); return; }

  const secResp = ui.prompt('Sección lógica', 'Una de: ' + CONFIG.LOGICAL_SECTIONS.join(', '), ui.ButtonSet.OK_CANCEL);
  if (secResp.getSelectedButton() !== ui.Button.OK) return;
  const section = secResp.getResponseText().trim();
  if (!section) { ss.toast('Sección vacía — cancelado.', 'Asistencia', 5); return; }
  if (CONFIG.LOGICAL_SECTIONS.indexOf(section) === -1) {
    const conf = ui.alert('Sección "' + section + '" no está en lista canónica. ¿Continuar?', ui.ButtonSet.YES_NO);
    if (conf !== ui.Button.YES) return;
  }

  const codeResp = ui.prompt('Código', 'A, AT, BM, F o vacío (void):', ui.ButtonSet.OK_CANCEL);
  if (codeResp.getSelectedButton() !== ui.Button.OK) return;
  const codeRaw = codeResp.getResponseText().trim();
  const normCode = codeRaw === '' ? '' : normalizeCode(codeRaw);
  if (normCode !== '' && !isCodeValid(normCode)) { ss.toast('⚠️ Código no válido. Use A, AT, BM o F.', 'Asistencia', 5); logToErrors(section, '', codeRaw, 'codigo_invalido_manual'); return; }

  const motivoResp = ui.prompt('Motivo / nota (auditoría via_manual)', 'Ej: corrección RRHH, constancia adjunta…', ui.ButtonSet.OK_CANCEL);
  if (motivoResp.getSelectedButton() !== ui.Button.OK) return;
  const motivo = motivoResp.getResponseText().trim();

  const viaManualNote = 'via_manual:' + (motivo || (isRegistroManual ? 'registro_manual' : 'solicitar_correccion')) + ' by ' + (Session.getActiveUser().getEmail() || 'unknown');
  const nota = motivo ? motivo + ' | ' + viaManualNote : viaManualNote;
  const sourceRange = 'manual:' + section + '!' + operatorName + '!' + iso;

  // Bypass window + permission; still validate code/section; audited via nota + edited_by
  const codeLabel = normCode ? (CONFIG.LABELS[normCode] || normCode) : '';
  const candidate = {
    section: section, operatorName: operatorName, isoDate: iso, code: normCode, codeLabel: codeLabel,
    isApoyo: false, nota: nota, sourceRange: sourceRange, recordId: recordId(section, operatorName, iso)
  };
  // Log audit before lock
  logToErrors(section, sourceRange, normCode, 'via_manual_' + iso + '_' + nota);
  const result = commitRegistroBatch([candidate]);
  if (result.queued) return;
  if (normCode === '') {
    ss.toast('🗑️ void via_manual: ' + operatorName + ' — ' + iso, 'Asistencia', 7);
  } else {
    ss.toast('✅ Corrección via_manual: ' + operatorName + ' — ' + iso + ' = ' + normCode + ' (' + nota + ')', 'Asistencia', 7);
  }
  SpreadsheetApp.flush();
}

function menuBackfillHistorico() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert(
    'Backfill histórico',
    'Escanea 6 secciones E15:AI44 donde E11 válido y celda no vacía, reusa upsert idempotente.\n\n¿Incluir fechas fuera de ventana (requiere RRHH)?\n• Sí = histórico completo (bypass ventana, auditado)\n• No = solo hoy/ayer (respeta ventana)',
    ui.ButtonSet.YES_NO_CANCEL
  );
  if (resp === ui.Button.CANCEL || resp === ui.Button.CLOSE) return;
  const bypassWindow = (resp === ui.Button.YES);
  // Confirm bypass
  if (bypassWindow) {
    const conf2 = ui.alert('Confirmar bypass ventana', 'Backfill histórico completo bypassa ventana hoy/ayer. Se auditará con via_manual en nota. ¿Continuar?', ui.ButtonSet.YES_NO);
    if (conf2 !== ui.Button.YES) return;
  }
  showProgress('Backfill ' + (bypassWindow ? 'completo' : 'ventana hoy/ayer') + '...', bypassWindow ? 'doBackfillCompleto' : 'doBackfillVentana');
}

function doBackfillVentana() {
  return doBackfill(false);
}

function doBackfillCompleto() {
  return doBackfill(true);
}

function showProgress(message, serverFn) {
  const html = HtmlService.createHtmlOutput(
    '<style>body{font-family:"Google Sans",Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;margin:0;padding:20px;box-sizing:border-box}.spinner{width:36px;height:36px;border:4px solid #e0e0e0;border-top:4px solid #1a73e8;border-radius:50%;animation:spin .8s linear infinite;margin-bottom:16px}@keyframes spin{to{transform:rotate(360deg)}}.message{font-size:14px;color:#333;text-align:center}.done{color:#1e8e3e;font-weight:500}.error{color:#d93025;font-weight:500}</style>' +
    '<div class="spinner" id="spinner"></div><div class="message" id="msg">' + message + '</div>' +
    '<script>google.script.run.withSuccessHandler(function(r){document.getElementById("spinner").style.display="none";var m=document.getElementById("msg");m.className="message done";m.innerText="Listo! "+(r||"");setTimeout(function(){google.script.host.close();},1800);}).withFailureHandler(function(err){document.getElementById("spinner").style.display="none";var m=document.getElementById("msg");m.className="message error";m.innerText="Error: "+err.message;setTimeout(function(){google.script.host.close();},4000);}).' + serverFn + '();</script>'
  ).setWidth(360).setHeight(160);
  SpreadsheetApp.getUi().showModalDialog(html, 'Asistencia — Backfill');
}

function setupInstallable() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!validateHoja2()) {
    ss.toast('⚠️ Hoja2 no accesible — verificá Hoja2!A1:B12 y D1:E7 antes de autorizar.', 'Asistencia', 7);
    Logger.log('setupInstallable blocked: Hoja2 invalid');
    return;
  }
  ensureRegistroHeader();
  ensureConfigSheet();
  ensureErrorsSheet();
  const existing = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === 'handleEdit';
  });
  if (existing.length > 0) {
    ss.toast('🔒 Autorización ya activa (' + existing.length + ' trigger(s)).', 'Asistencia', 5);
    return;
  }
  ScriptApp.newTrigger('handleEdit')
    .forSpreadsheet(ss)
    .onEdit()
    .create();
  ss.toast('🔒 Autorización concedida — handleEdit instalado como owner.', 'Asistencia', 5);
  logToErrors('', '', '', 'autorizar_ok_installable_created');
}

// --- DUAL TRIGGER: simple onEdit (toast-only, never writes) + installable handleEdit ---

function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const sheet = e.range.getSheet();
    const name = sheet.getName();
    if (isIgnorableSheet(name)) return;
    if (isCalendarRange(e.range)) return;
    if (name === CONFIG.APOYO_SHEET) {
      if (!isApoyoRange(e.range)) return;
      if (!validateHoja2()) {
        e.source.toast('⚠️ Hoja2 no accesible — sin validación.', 'Asistencia', 5);
        return;
      }
      // Lightweight Apoyo code validation toast
      const apoyoVals = sheet.getRange(CONFIG.APOYO_A3_ROW, CONFIG.APOYO_A3_COL_START, 1, CONFIG.APOYO_A3_COL_END).getValues()[0];
      const apoyoCode = String(apoyoVals[3] || '').trim();
      if (apoyoCode !== '' && !isCodeValid(apoyoCode)) {
        e.source.toast('⚠️ Código no válido en Apoyo. Use A, AT, BM o F.', 'Asistencia', 5);
      }
      return;
    }
    if (!rangeIntersectsInput(e.range)) return;
    if (!validateHoja2()) {
      e.source.toast('⚠️ Hoja2 no accesible — sin validación de calendario.', 'Asistencia', 5);
      return;
    }
    const section = resolveSection(sheet);
    if (!section) return;
    const r1 = Math.max(e.range.getRow(), CONFIG.INPUT_ROW_START);
    const r2 = Math.min(e.range.getRow() + e.range.getNumRows() - 1, CONFIG.INPUT_ROW_END);
    const c1 = Math.max(e.range.getColumn(), CONFIG.INPUT_COL_START);
    const c2 = Math.min(e.range.getColumn() + e.range.getNumColumns() - 1, CONFIG.INPUT_COL_END);
    if (r1 > r2 || c1 > c2) return;
    const e11Row = sheet.getRange(11, CONFIG.INPUT_COL_START, 1, CONFIG.INPUT_COL_END - CONFIG.INPUT_COL_START + 1).getDisplayValues()[0];
    const values = sheet.getRange(r1, c1, r2 - r1 + 1, c2 - c1 + 1).getValues();
    let invalid = 0;
    for (let r = 0; r < values.length; r++) {
      for (let c = 0; c < values[r].length; c++) {
        const colIdx = c1 + c;
        const e11Disp = e11Row[colIdx - CONFIG.INPUT_COL_START];
        const iso = parseE11ToIso(e11Disp);
        if (!iso) continue;
        const raw = values[r][c];
        const code = String(raw == null ? '' : raw).trim();
        if (code === '') continue;
        if (!isCodeValid(code)) invalid++;
      }
    }
    if (invalid > 0) {
      e.source.toast('⚠️ Código no válido. Use A, AT, BM o F.', 'Asistencia', 5);
    }
  } catch (err) {
    Logger.log('onEdit toast-only error: ' + err.message);
  }
}
