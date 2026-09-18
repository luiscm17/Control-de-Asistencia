/**
 * Snapshot.gs — Batch form capture and validation for winding persistence.
 *
 * Formula-owned column E is read only through displayed values. It is never a
 * write target and is retained only as an auditable title snapshot.
 */

function windingCaptureSnapshot_(spreadsheet) {
  const ss = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  const form = windingRequireFormSheet_(ss);
  const date = form.getRange(WINDING_CONFIG.FORM.DATE).getValue();
  const turno = form.getRange(WINDING_CONFIG.FORM.TURNO).getDisplayValue();
  const supervisor = form.getRange(WINDING_CONFIG.FORM.SUPERVISOR).getDisplayValue();
  const keys = windingValidateSnapshotKeys_(date, turno);
  if (!keys.ok) return { ok: false, code: keys.code, records: [], errors: [] };

  const values = form.getRange(WINDING_CONFIG.FORM.DATA_RANGE).getValues();
  const displayed = form.getRange(WINDING_CONFIG.FORM.DATA_RANGE).getDisplayValues();
  const records = [];
  const errors = [];

  values.forEach(function (row, rowIndex) {
    if (!windingIsSnapshotRowEligible_(row)) return;

    const identity = windingNormalizeRecordIdentity_(keys.fechaKey, keys.turno, row[2]);
    if (!identity.ok) {
      errors.push({ context: 'snapshot.identity', detail: identity.code + ' at row ' +
        (WINDING_CONFIG.FORM.FIRST_ITEM_ROW + rowIndex) });
      return;
    }

    const operators = windingNormalizeOperatorValues_(row.slice(
      WINDING_CONFIG.FORM.FIRST_OPERATOR_COLUMN - 1,
      WINDING_CONFIG.FORM.LAST_OPERATOR_COLUMN));
    operators.invalidIndexes.forEach(function (operatorIndex) {
      errors.push({ context: 'snapshot.operator', detail: 'non_numeric at ' +
        windingColumnLabel_(WINDING_CONFIG.FORM.FIRST_OPERATOR_COLUMN + operatorIndex) +
        (WINDING_CONFIG.FORM.FIRST_ITEM_ROW + rowIndex) });
    });

    records.push({
      id: identity.id,
      fecha: date,
      turno: keys.turno,
      item: displayed[rowIndex][0],
      supervisor: String(supervisor || '').trim(),
      color: String(displayed[rowIndex][1] || '').trim(),
      lote: String(row[2] || '').trim(),
      titulo: String(displayed[rowIndex][3] || '').trim(),
      metaKg: displayed[rowIndex][4],
      operators: operators.values
    });
  });

  return { ok: true, code: 'ok', fechaKey: keys.fechaKey, turno: keys.turno,
    records: records, errors: errors };
}

function windingValidateSnapshotKeys_(date, turno) {
  const fechaKey = windingNativeDateKey_(date);
  const normalizedTurno = String(turno || '').trim();
  if (!fechaKey || !normalizedTurno) return { ok: false, code: 'missing_key' };
  if (normalizedTurno.indexOf('|') !== -1) return { ok: false, code: 'invalid_delimiter' };
  return { ok: true, fechaKey: fechaKey, turno: normalizedTurno };
}

function windingNativeDateKey_(date) {
  const isDate = date && Object.prototype.toString.call(date) === '[object Date]' && !isNaN(date.getTime());
  if (!isDate) return '';
  if (typeof Utilities !== 'undefined' && Utilities.formatDate) {
    return Utilities.formatDate(date, WINDING_CONFIG.TIMEZONE, 'yyyy-MM-dd');
  }
  return date.getFullYear() + '-' + windingPad2_(date.getMonth() + 1) + '-' + windingPad2_(date.getDate());
}

function windingNormalizeRecordIdentity_(fechaKey, turno, lote) {
  const normalizedTurno = String(turno || '').trim();
  const normalizedLote = String(lote || '').trim();
  if (!fechaKey || !normalizedTurno || !normalizedLote) return { ok: false, code: 'missing_key' };
  if (normalizedTurno.indexOf('|') !== -1 || normalizedLote.indexOf('|') !== -1) {
    return { ok: false, code: 'invalid_delimiter' };
  }
  return { ok: true, id: fechaKey + '|' + normalizedTurno + '|' + normalizedLote };
}

function windingIsSnapshotRowEligible_(row) {
  return Boolean(row && String(row[1] || '').trim() && String(row[2] || '').trim() &&
    String(row[3] || '').trim());
}

function windingNormalizeOperatorValues_(values) {
  const invalidIndexes = [];
  const normalized = values.map(function (value, index) {
    if (value === '' || value === null || value === undefined) return 0;
    if (typeof value === 'number' && isFinite(value)) return value;
    const numeric = Number(value);
    if (String(value).trim() !== '' && isFinite(numeric)) return numeric;
    invalidIndexes.push(index);
    return 0;
  });
  return { values: normalized, invalidIndexes: invalidIndexes };
}

function windingGetRecoveryRanges_() {
  return [WINDING_CONFIG.FORM.INPUT_LEFT, WINDING_CONFIG.FORM.INPUT_RIGHT];
}

function windingColumnLabel_(column) {
  let label = '';
  let value = column;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}

function windingPad2_(value) {
  return value < 10 ? '0' + value : String(value);
}
