/**
 * Core.gs — Validation, hydration, and serialized Coneras save orchestration.
 */

function guardarTurno() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const form = conerasRequireSheet_(ss, 'CONERA');
  const snapshot = conerasReadSnapshot_(form);
  if (!snapshot.valid) {
    conerasLogError_(snapshot.errorCode, snapshot.reason, snapshot.range, ss);
    ss.toast(snapshot.message, 'Coneras', 5);
    return { saved: false, reason: snapshot.errorCode };
  }

  const lock = LockService.getDocumentLock();
  if (!conerasAcquireDocumentLock_(lock)) {
    conerasLogError_(CONERAS_CONFIG.ERRORS.LOCK_TIMEOUT, 'Document lock exhausted after one retry.',
      CONERAS_CONFIG.RANGES.SAVE_CHECKBOX, ss);
    ss.toast(conerasToastForError_(CONERAS_CONFIG.ERRORS.LOCK_TIMEOUT), 'Coneras', 5);
    return { saved: false, reason: CONERAS_CONFIG.ERRORS.LOCK_TIMEOUT };
  }

  try {
    const dbSheet = conerasRequireSheet_(ss, 'DB');
    const plan = conerasBuildPersistencePlan_(dbSheet, snapshot);
    if (plan.deletes.length && !conerasConfirmDeletes_(plan.deletes)) {
      ss.toast('↩️ Sin cambios en descargas ' + plan.deletes.map(function (entry) {
        return entry.descargaNro;
      }).join(', '), 'Coneras', 5);
      return { saved: false, reason: 'delete_cancelled' };
    }
    conerasApplyPersistencePlan_(dbSheet, plan);
    SpreadsheetApp.flush();
    const total = snapshot.rows.reduce(function (sum, row) { return sum + row.values[11]; }, 0);
    ss.toast('✅ Guardado: ' + snapshot.displayFecha + ' ' + snapshot.turno + ' ' +
      snapshot.maquina + ' — ' + snapshot.rows.length + ' descargas (' + total.toFixed(2) +
      ' kg) por ' + snapshot.editor, 'Coneras', 5);
    return { saved: true, count: snapshot.rows.length, deleted: plan.deletes.length };
  } finally {
    lock.releaseLock();
  }
}

function conerasReadSnapshot_(form) {
  const metadata = form.getRangeList([
    CONERAS_CONFIG.RANGES.FECHA,
    CONERAS_CONFIG.RANGES.TURNO,
    CONERAS_CONFIG.RANGES.MAQUINA,
    CONERAS_CONFIG.RANGES.SUPERVISOR
  ]).getRanges().map(function (range) { return range.getValue(); });
  const fecha = conerasNormalizeFecha_(metadata[0]);
  if (!fecha) return conerasInvalidSnapshot_(CONERAS_CONFIG.ERRORS.INVALID_FECHA,
    'Fecha is empty or invalid.', CONERAS_CONFIG.RANGES.FECHA, '⚠️ Seleccioná fecha válida en E5');
  if (CONERAS_CONFIG.TURNO_VALUES.indexOf(metadata[1]) === -1) {
    return conerasInvalidSnapshot_(CONERAS_CONFIG.ERRORS.INVALID_TURNO, 'Turno is invalid.',
      CONERAS_CONFIG.RANGES.TURNO, '⚠️ Turno no válido');
  }
  if (CONERAS_CONFIG.MAQUINA_VALUES.indexOf(metadata[2]) === -1) {
    return conerasInvalidSnapshot_(CONERAS_CONFIG.ERRORS.INVALID_MAQUINA, 'Maquina is invalid.',
      CONERAS_CONFIG.RANGES.MAQUINA, '⚠️ Máquina no válida');
  }

  const inputs = form.getRange(CONERAS_CONFIG.RANGES.FORM_INPUTS).getValues();
  const netDisplays = form.getRange(CONERAS_CONFIG.RANGES.NET_WEIGHT_FORMULAS).getDisplayValues();
  const rows = [];
  const emptyNumbers = [];
  // Normalize supervisor to uppercase for case-insensitive recovery; also normalize turno/maquina trimming.
  const turnoNorm = String(metadata[1] || '').trim();
  const maquinaNorm = String(metadata[2] || '').trim();
  const supervisorNorm = String(metadata[3] || '').trim().toUpperCase();
  inputs.forEach(function (input, index) {
    const bruto = conerasNumber_(input[2]);
    const descargaNro = index + 1;
    if (bruto === null) {
      if (input[2] === '' || input[2] === null) emptyNumbers.push(descargaNro);
      return;
    }
    const pesoNeto = conerasNumber_(netDisplays[index][0]);
    if (pesoNeto === null) return;
    const timestamp = conerasAuditTimestamp_();
    const id = conerasBuildId_(fecha, turnoNorm, maquinaNorm, descargaNro);
    rows.push({
      id: id,
      values: [id, conerasDateFromKey_(fecha), turnoNorm, maquinaNorm, descargaNro,
        input[0], input[1], bruto, conerasNumberOrBlank_(input[3]), conerasNumberOrBlank_(input[4]),
        conerasNumberOrBlank_(input[5]), Math.round(pesoNeto * 100) / 100, supervisorNorm, timestamp,
        timestamp, conerasEditorEmail_()]
    });
  });
  var displayFecha = Utilities.formatDate(conerasDateFromKey_(fecha), CONERAS_CONFIG.TIMEZONE, 'dd/MM/yyyy');
  return {
    valid: true, fecha: fecha, turno: turnoNorm, maquina: maquinaNorm, supervisor: supervisorNorm,
    supervisorNorm: supervisorNorm,
    displayFecha: displayFecha,
    rows: rows, emptyNumbers: emptyNumbers, editor: conerasEditorEmail_()
  };
}

function conerasHydrate_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const form = conerasRequireSheet_(ss, 'CONERA');
  const fecha = conerasNormalizeFecha_(form.getRange(CONERAS_CONFIG.RANGES.FECHA).getValue());
  const turno = form.getRange(CONERAS_CONFIG.RANGES.TURNO).getValue();
  const maquina = form.getRange(CONERAS_CONFIG.RANGES.MAQUINA).getValue();
  if (!fecha || CONERAS_CONFIG.TURNO_VALUES.indexOf(turno) === -1 ||
      CONERAS_CONFIG.MAQUINA_VALUES.indexOf(maquina) === -1) return false;

  const db = conerasRequireSheet_(ss, 'DB');
  const lastRow = db.getLastRow();
  const matches = lastRow > 1 ? db.getRange(2, 1, lastRow - 1,
    CONERAS_CONFIG.LIMITS.DB_COLUMNS).getValues().filter(function (row) {
    return conerasNormalizeFecha_(row[1]) === fecha;
  }).filter(function (row) {
    return String(row[2]).toUpperCase() === String(turno).toUpperCase() &&
      String(row[3]).toUpperCase() === String(maquina).toUpperCase();
  }) : [];
  const values = Array.from({ length: CONERAS_CONFIG.LIMITS.DESCARGAS }, function () {
    return ['', '', '', '', '', ''];
  });
  matches.forEach(function (row) {
    const number = Number(row[4]);
    if (number >= 1 && number <= CONERAS_CONFIG.LIMITS.DESCARGAS) values[number - 1] = row.slice(5, 11);
  });
  form.getRange(CONERAS_CONFIG.RANGES.FORM_INPUTS).setValues(values);
  if (matches.length) form.getRange(CONERAS_CONFIG.RANGES.SUPERVISOR).setValue(matches[0][12]);
  ss.toast(matches.length ? '↻ Sincronizado: ' + matches.length + ' descargas' :
    '— Sin registros, listo para cargar', 'Coneras', 5);
  return matches.length;
}

function conerasAcquireDocumentLock_(lock) {
  if (lock.tryLock(5000)) return true;
  Utilities.sleep(1000);
  return lock.tryLock(5000);
}

function conerasConfirmDeletes_(deletes) {
  const message = 'Descargas ' + deletes.map(function (entry) {
    return entry.descargaNro + ' (' + entry.pesoNeto + ' kg)';
  }).join(', ') + ' — ¿Continuar?';
  const ui = SpreadsheetApp.getUi();
  return conerasDeleteConfirmed_(ui.alert('¿Borrar descargas?', message, ui.ButtonSet.YES_NO), ui.Button.YES);
}

function conerasDeleteConfirmed_(response, continueButton) {
  return response === continueButton;
}

function conerasInvalidSnapshot_(errorCode, reason, range, message) {
  return { valid: false, errorCode: errorCode, reason: reason, range: range, message: message };
}

function conerasNumber_(value) {
  if (typeof value === 'number') return isFinite(value) ? value : null;
  const text = String(value === null || value === undefined ? '' : value).trim();
  if (!text) return null;
  const normalized = text.indexOf(',') >= 0 ? text.replace(/\./g, '').replace(',', '.') : text;
  const number = Number(normalized);
  return isFinite(number) ? number : null;
}

function conerasNumberOrBlank_(value) {
  const number = conerasNumber_(value);
  return number === null ? '' : number;
}

function conerasDateFromKey_(key) {
  const raw = String(key || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date(NaN);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // Noon avoids 21:00 shift when sheet interprets midnight in America/La_Paz — keeps display as date-only dd/MM/yyyy.
  return new Date(year, month - 1, day, 12, 0, 0);
}
