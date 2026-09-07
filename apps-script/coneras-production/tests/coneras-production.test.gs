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

function conerasTestHelpers_() {
  const tests = [
    conerasTestFrozenConfiguration_,
    conerasTestDateAndIdHelpers_,
    conerasTestFormulaProtectionContract_,
    conerasTestHeadersMatcher_
  ];
  tests.forEach(function (test) { test(); });
  Logger.log('✅ ' + tests.length + ' Coneras foundation tests passed.');
  return tests.length + ' Coneras foundation tests passed.';
}
