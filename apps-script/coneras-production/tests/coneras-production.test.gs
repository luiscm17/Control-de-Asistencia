/**
 * coneras-production.test.gs — Run conerasTestHelpers_ in the Apps Script editor.
 */

function conerasAssert_(condition, message) {
  if (!condition) throw new Error(message);
}

function conerasTestFrozenConfiguration_() {
  conerasAssert_(CONERAS_CONFIG.TIMEZONE === 'America/La_Paz', 'Timezone must be America/La_Paz.');
  conerasAssert_(CONERAS_CONFIG.DB_HEADERS.length === CONERAS_CONFIG.LIMITS.DB_COLUMNS,
    'db_coneras must keep its sixteen frozen columns.');
  conerasAssert_(CONERAS_CONFIG.DB_HEADERS.join('|') ===
    'id|fecha|turno|maquina|descarga_nro|titulo|operador|peso_bruto|usos|peso_canilla|peso_tacho|peso_neto|supervisor|creado|actualizado|editado_por',
  'db_coneras header order changed.');
}

function conerasTestDateAndIdHelpers_() {
  conerasAssert_(conerasNormalizeFecha_(new Date('2026-09-07T18:00:00Z')) === '2026-09-07',
    'Date normalization must use the configured La Paz date.');
  conerasAssert_(conerasNormalizeFecha_('31/09/2026') === '', 'Invalid calendar dates must be rejected.');
  conerasAssert_(conerasBuildId_('2026-09-07', 'Dia', 'Autoconer 1', 3) ===
    '2026-09-07-DIA-AUTOCONER_1-03', 'ID must preserve the frozen PK format.');
}

function conerasTestFormulaProtectionContract_() {
  const formulas = conerasFormulaCells_();
  const ranges = formulas.map(function (item) { return item.range; }).join('|');
  conerasAssert_(ranges === [CONERAS_CONFIG.RANGES.META_REAL,
    CONERAS_CONFIG.RANGES.TOTAL_NET_WEIGHT, CONERAS_CONFIG.RANGES.NET_WEIGHT_FIRST].join('|'),
  'Formula verification must cover the configured formula cells.');
  conerasAssert_(CONERAS_CONFIG.RANGES.FORM_INPUTS === 'B8:G22',
    'Only B8:G22 is the row-input write boundary.');
  conerasAssert_(CONERAS_CONFIG.FORMULAS.NET_WEIGHT_FIRST ===
    '=SI(ESNUMERO(D8),MAX(0,D8-(E8*F8)-G8),"")', 'Net-weight formula must remain verbatim.');
}

function conerasTestHeadersMatcher_() {
  conerasAssert_(conerasHeadersMatch_(CONERAS_CONFIG.DB_HEADERS.slice(), CONERAS_CONFIG.DB_HEADERS),
    'Frozen headers must match their configured order.');
  conerasAssert_(!conerasHeadersMatch_(['fecha'], CONERAS_CONFIG.DB_HEADERS),
    'Incomplete headers must be rejected.');
}

function conerasTestPersistencePlan_() {
  const id = conerasBuildId_('2026-09-07', 'Dia', 'Autoconer 1', 1);
  const existing = [id, new Date(2026, 8, 7), 'Dia', 'Autoconer 1', 1, '24', 'Ana',
    42.5, 12, 0.85, 1.2, 31.1, 'Carlos', 'created', 'old update', 'old@factory.bo'];
  const replacement = [id, new Date(2026, 8, 7), 'Dia', 'Autoconer 1', 1, '24', 'Ana',
    45, 12, 0.85, 1.2, 33.6, 'Diana', 'new created', 'new update', 'new@factory.bo'];
  const plan = conerasBuildPersistencePlanFromRows_([existing], {
    fecha: '2026-09-07', turno: 'Dia', maquina: 'Autoconer 1',
    rows: [{ id: id, values: replacement }], emptyNumbers: [2]
  });
  conerasAssert_(plan.upserts.length === 1 && plan.upserts[0].rowIndex === 2,
    'Existing PK must be updated in place.');
  conerasAssert_(plan.upserts[0].values[13] === 'created', 'Existing creado must be preserved.');
  conerasAssert_(plan.deletes.length === 0, 'Only existing cleared PKs are deletion candidates.');
}

function conerasTestBatchAndInputRules_() {
  conerasAssert_(conerasNumber_('1.234,50') === 1234.5,
    'Displayed es-BO numeric weight must be parsed.');
  conerasAssert_(conerasNumber_('') === null && conerasNumber_('not a number') === null,
    'Blank or invalid bruto must be skipped.');
  conerasAssert_(conerasDateFromKey_('2026-09-07') instanceof Date,
    'Normalized date must produce a Sheets DATE value.');
  conerasAssert_(conerasIsChecked_('VERDADERO') && conerasIsChecked_(true),
    'Checkbox routing must accept localized and boolean true values.');
  conerasAssert_(!conerasIsChecked_('FALSE'), 'Unchecked checkbox must not save.');
}

function conerasTestDeleteGuardPlan_() {
  const id = conerasBuildId_('2026-09-07', 'Dia', 'Autoconer 1', 3);
  const row = [id, new Date(2026, 8, 7), 'Dia', 'Autoconer 1', 3, '', '', 42.5,
    '', '', '', 42.5, '', 'created', 'updated', 'editor'];
  const plan = conerasBuildPersistencePlanFromRows_([row], {
    fecha: '2026-09-07', turno: 'Dia', maquina: 'Autoconer 1', rows: [], emptyNumbers: [3]
  });
  conerasAssert_(plan.deletes.length === 1 && plan.deletes[0].id === id,
    'A cleared existing bruto must be the only delete-guard candidate.');
  conerasAssert_(conerasDeleteConfirmed_('continue', 'continue'),
    'Continue must authorize only listed delete candidates.');
  conerasAssert_(!conerasDeleteConfirmed_('cancel', 'continue'),
    'Cancel must preserve every delete candidate.');
}

function conerasTestSnapshotValidationAndBatchSizes_() {
  const emptyInputs = Array.from({ length: 15 }, function () { return ['', '', '', '', '', '']; });
  const emptyNets = Array.from({ length: 15 }, function () { return ['']; });
  const invalid = conerasReadSnapshot_(conerasTestForm_('', 'Dia', 'Autoconer 1', '', emptyInputs, emptyNets));
  conerasAssert_(!invalid.valid && invalid.errorCode === CONERAS_CONFIG.ERRORS.INVALID_FECHA,
    'Invalid selectors must reject the snapshot before persistence.');

  const zero = conerasReadSnapshot_(conerasTestForm_(new Date(2026, 8, 7), 'Dia',
    'Autoconer 1', 'Carlos', emptyInputs, emptyNets));
  conerasAssert_(zero.valid && zero.rows.length === 0, 'A zero-row batch must be valid.');

  const oneInputs = emptyInputs.map(function (row) { return row.slice(); });
  const oneNets = emptyNets.map(function (row) { return row.slice(); });
  oneInputs[0] = ['24', 'Ana', 42.5, 12, 0.85, 1.2];
  oneNets[0] = ['31,10'];
  const one = conerasReadSnapshot_(conerasTestForm_(new Date(2026, 8, 7), 'Dia',
    'Autoconer 1', 'Carlos', oneInputs, oneNets));
  conerasAssert_(one.rows.length === 1 && one.rows[0].values[11] === 31.1,
    'One eligible row must capture H as a rounded numeric net weight.');

  const fifteenInputs = Array.from({ length: 15 }, function (_, index) {
    return ['24', 'Ana', index + 10, 1, 1, 1];
  });
  const fifteenNets = Array.from({ length: 15 }, function (_, index) { return [String(index + 8)]; });
  const fifteen = conerasReadSnapshot_(conerasTestForm_(new Date(2026, 8, 7), 'Dia',
    'Autoconer 1', 'Carlos', fifteenInputs, fifteenNets));
  conerasAssert_(fifteen.rows.length === 15 && fifteen.rows[14].values[4] === 15,
    'A complete fifteen-row batch must retain descarga numbers.');
}

function conerasTestForm_(fecha, turno, maquina, supervisor, inputs, nets) {
  const valuesByRange = {};
  valuesByRange[CONERAS_CONFIG.RANGES.FECHA] = fecha;
  valuesByRange[CONERAS_CONFIG.RANGES.TURNO] = turno;
  valuesByRange[CONERAS_CONFIG.RANGES.MAQUINA] = maquina;
  valuesByRange[CONERAS_CONFIG.RANGES.SUPERVISOR] = supervisor;
  return {
    getRangeList: function (ranges) {
      return { getRanges: function () {
        return ranges.map(function (range) { return { getValue: function () { return valuesByRange[range]; } }; });
      } };
    },
    getRange: function (range) {
      if (range === CONERAS_CONFIG.RANGES.FORM_INPUTS) return { getValues: function () { return inputs; } };
      if (range === CONERAS_CONFIG.RANGES.NET_WEIGHT_FORMULAS) {
        return { getDisplayValues: function () { return nets; } };
      }
      return { getValue: function () { return valuesByRange[range]; } };
    }
  };
}

function conerasTestHelpers_() {
  const tests = [
    conerasTestFrozenConfiguration_,
    conerasTestDateAndIdHelpers_,
    conerasTestFormulaProtectionContract_,
    conerasTestHeadersMatcher_,
    conerasTestPersistencePlan_,
    conerasTestBatchAndInputRules_,
    conerasTestDeleteGuardPlan_,
    conerasTestSnapshotValidationAndBatchSizes_
  ];
  tests.forEach(function (test) { test(); });
  Logger.log('✅ ' + tests.length + ' Coneras tests passed.');
  return tests.length + ' Coneras tests passed.';
}
