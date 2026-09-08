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
  // Business date (E5) is a pure calendar date — timezone-agnostic, not America/La_Paz.
  // Dashboard B filter B = 'yyyy-MM-dd' must match db_coneras!B (plain string yyyy-MM-dd).
  // Only audit fields (creado/actualizado) use America/La_Paz.
  conerasAssert_(conerasNormalizeFecha_(new Date(2026, 8, 7)) === '2026-09-07',
    'Local midnight Date must normalize to iso via getFullYear/getMonth/getDate.');
  conerasAssert_(conerasNormalizeFecha_(new Date(2026, 8, 7, 18, 0, 0)) === '2026-09-07',
    'Date with time on same calendar day must stay same yyyy-MM-dd (timezone-agnostic).');
  conerasAssert_(conerasNormalizeFecha_('07/09/2026') === '2026-09-07',
    'String 07/09/2026 must normalize to iso.');
  conerasAssert_(conerasNormalizeFecha_('31/09/2026') === '', 'Invalid calendar dates must be rejected.');
  conerasAssert_(conerasNormalizeFecha_('2026-09-07') === '2026-09-07',
    'String yyyy-MM-dd must normalize to iso (stored B as plain string).');
  conerasAssert_(conerasBuildId_('2026-09-07', 'Dia', 'Autoconer 1', 3) ===
    '2026-09-07-DIA-AUTOCONER_1-03', 'ID must preserve the frozen PK format.');
  var d = conerasDateFromKey_('2026-09-07');
  conerasAssert_(typeof d === 'string' && d === '2026-09-07',
    'conerasDateFromKey must return plain string yyyy-MM-dd (no Date/timezone) so Sheets displays date-only without 21:00 shift and string QUERY matches.');
  conerasAssert_(conerasNormalizeFecha_(d) === '2026-09-07',
    'String yyyy-MM-dd from conerasDateFromKey must round-trip through conerasNormalizeFecha without shift.');
  conerasAssert_(conerasNormalizeFecha_(conerasDateFromKey_('2026-09-07')) === '2026-09-07',
    'Dashboard B filter date must match stored db_coneras!B string.');
}

function conerasTestFormulaProtectionContract_() {
  const formulas = conerasFormulaCells_();
  conerasAssert_(formulas.length === 0,
    'All native formulas (H8, H23, E4) must be Sheet-owned — conerasFormulaCells_ must be empty.');
  const ranges = formulas.map(function (item) { return item.range; }).join('|');
  conerasAssert_(ranges === '',
    'Formula verification must not cover Sheet-owned cells via conerasFormulaCells_.');
  conerasAssert_(formulas.every(function (item) {
    return item.range !== CONERAS_CONFIG.RANGES.NET_WEIGHT_FIRST &&
      item.range !== CONERAS_CONFIG.RANGES.META_REAL &&
      item.range !== CONERAS_CONFIG.RANGES.TOTAL_NET_WEIGHT;
  }), 'H8, E4 and H23 must remain Sheet-owned rather than Script-configured.');
  conerasAssert_(conerasHasNetWeightFormula_('=SI(ESNUMERO(D8),MAX(0,D8-(E8*F8)-G8),"")') &&
    conerasHasNetWeightFormula_('=SI(ESNUMERO($D$8),MAX(0,$D$8-($E$8*$F$8)-$G$8),"")') &&
    conerasHasNetWeightFormula_('= SI ( ESNUMERO ( D8 ) , MAX ( 0 , D8 - ( E8 * F8 ) - G8 ) , "" )') &&
    conerasHasNetWeightFormula_('=SI(ESNUMERO(D8);MAX(0;D8-(E8*F8)-G8);"")') &&
    conerasHasNetWeightFormula_('=IF(ISNUMBER(D8),MAX(0,D8-(E8*F8)-G8),"")') &&
    !conerasHasNetWeightFormula_('') && !conerasHasNetWeightFormula_('120') &&
    !conerasHasNetWeightFormula_('=SUMA(H8:H22)') &&
    !conerasHasNetWeightFormula_('=SI(ESNUMERO(D8),D8,"")'),
    'H8 validation must accept any SI/ESNUMERO/MAX formula referencing D8/E8/F8/G8 with whitespace/$/; tolerance.');
  conerasAssert_(conerasHasFormula_('=$C$4*dashboard!$B$7') &&
    !conerasHasFormula_('') && !conerasHasFormula_('120'),
    'E4 validation must accept any present native formula without matching its text.');
  conerasAssert_(conerasHasTotalFormula_('=SUMA(H8:H22)') &&
    conerasHasTotalFormula_('=SUMA( H8:H22 )') &&
    conerasHasTotalFormula_('=SUM(H8:H22)') &&
    conerasHasTotalFormula_('=SUMA($H$8:$H$22)') &&
    !conerasHasTotalFormula_('') && !conerasHasTotalFormula_('120') &&
    !conerasHasTotalFormula_('=SUMA(A1:A2)'),
    'H23 validation must accept any SUMA/SUM formula covering H8:H22 without exact text match.');
  conerasAssert_(CONERAS_CONFIG.RANGES.FORM_INPUTS === 'B8:G22',
    'Only B8:G22 is the row-input write boundary.');
  conerasAssert_(conerasHasNetWeightFormula_(CONERAS_CONFIG.FORMULAS.NET_WEIGHT_FIRST),
    'Canonical NET_WEIGHT_FIRST must still satisfy lenient H8 semantics.');
}

function conerasTestHeadersMatcher_() {
  conerasAssert_(conerasHeadersMatch_(CONERAS_CONFIG.DB_HEADERS.slice(), CONERAS_CONFIG.DB_HEADERS),
    'Frozen headers must match their configured order.');
  conerasAssert_(!conerasHeadersMatch_(['fecha'], CONERAS_CONFIG.DB_HEADERS),
    'Incomplete headers must be rejected.');
}

function conerasTestPersistencePlan_() {
  const id = conerasBuildId_('2026-09-07', 'Dia', 'Autoconer 1', 1);
  const existing = [id, '2026-09-07', 'Dia', 'Autoconer 1', 1, '24', 'Ana',
    42.5, 12, 0.85, 1.2, 31.1, 'Carlos', 'created', 'old update', 'old@factory.bo'];
  const replacement = [id, '2026-09-07', 'Dia', 'Autoconer 1', 1, '24', 'Ana',
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
  var dd = conerasDateFromKey_('2026-09-07');
  conerasAssert_(typeof dd === 'string' && dd === '2026-09-07',
    'Normalized date must be plain string yyyy-MM-dd (date-only, no time/timezone).');
  conerasAssert_(conerasNormalizeFecha_('2026-09-07') === '2026-09-07' &&
    conerasNormalizeFecha_(new Date(2026, 8, 7)) === '2026-09-07' &&
    conerasNormalizeFecha_(new Date(2026, 8, 7, 12, 0, 0)) === '2026-09-07',
    'Business fecha strings and local Dates must preserve yyyy-MM-dd via timezone-agnostic handling.');
  conerasAssert_(conerasAuditTimestamp_() !== conerasNormalizeFecha_(new Date()),
    'Audit timestamp (yyyy-MM-dd HH:mm:ss America/La_Paz) must remain distinct from business fecha (yyyy-MM-dd timezone-agnostic).');
  conerasAssert_(conerasIsChecked_('VERDADERO') && conerasIsChecked_(true),
    'Checkbox routing must accept localized and boolean true values.');
  conerasAssert_(!conerasIsChecked_('FALSE'), 'Unchecked checkbox must not save.');
}

function conerasTestDeleteGuardPlan_() {
  const id = conerasBuildId_('2026-09-07', 'Dia', 'Autoconer 1', 3);
  const row = [id, '2026-09-07', 'Dia', 'Autoconer 1', 3, '', '', 42.5,
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

function conerasTestDashboardQueries_() {
  const perTitle = conerasBuildDashboardTotalsFormula_('E7');
  const perTitle8 = conerasBuildDashboardTotalsFormula_('E8');
  const daily = conerasBuildDashboardQuery_(
    CONERAS_CONFIG.FORMULAS.DASHBOARD_DAILY_SELECT,
    CONERAS_CONFIG.FORMULAS.DASHBOARD_DAILY_GROUP_BY,
    true);
  conerasAssert_(CONERAS_CONFIG.RANGES.DASHBOARD_TOTALS === 'F7',
    'DASHBOARD_TOTALS must be F7 — E7:E16 are titulo inputs (Escribe el Título), not a spill.');
  conerasAssert_(CONERAS_CONFIG.RANGES.DASHBOARD_TITLES === 'E7:E16',
    'DASHBOARD_TITLES must preserve the titulo input range.');
  conerasAssert_(CONERAS_CONFIG.RANGES.DASHBOARD_TOTALS_RANGE === 'F7:F16',
    'DASHBOARD_TOTALS_RANGE must be the per-row totals range.');
  conerasAssert_(CONERAS_CONFIG.RANGES.DASHBOARD_TOTALS_CHART_RANGE === 'E7:F',
    'Chart range must remain E7:F — titles are inputs, totals are formulas.');
  conerasAssert_(CONERAS_CONFIG.RANGES.DASHBOARD_DAILY === 'K7',
    'DASHBOARD_DAILY must remain K7 for the secondary evolution query.');
  conerasAssert_(perTitle.indexOf('SI(E7="","",') !== -1,
    'Per-title totals must guard blank titulo with SI(E7="").');
  conerasAssert_(perTitle.indexOf('SUSTITUIR(TEXTO(E7,"@")') !== -1,
    'Per-title must escape titulo via SUSTITUIR(TEXTO(E7,"@"),... ) for numeric titles like 13/40.');
  conerasAssert_(perTitle.indexOf('select sum(L) where B is not null') !== -1,
    'Per-title must query db_coneras with select sum(L) filtered by titulo.');
  conerasAssert_(perTitle.indexOf(' and F = \'"&') !== -1,
    'Per-title must filter where F equals the row titulo.');
  conerasAssert_(perTitle.indexOf('SI($B5="Fecha",SI(ESNUMERO($B6)') !== -1 &&
    perTitle.indexOf('" and B is null"') !== -1,
    'Per-title Fecha must require a valid picker and otherwise produce empty via B is null.');
  conerasAssert_(perTitle.indexOf('HOY()-6') !== -1 && perTitle.indexOf('FIN.MES(HOY(),0)') !== -1,
    'Per-title Semana and Mes must use rolling 7-day and calendar-month ranges.');
  conerasAssert_(perTitle.indexOf('SI($B4="Todos","","') !== -1 &&
    perTitle.indexOf('SI($B9="Todos","","') !== -1 && perTitle.indexOf('SI($B7="Todos","","') !== -1,
    'Per-title Todos must omit optional filter predicates for Turno B4, Maquina B9, Supervisor B7.');
  conerasAssert_(perTitle.indexOf("label sum(L) ''") !== -1,
    'Per-title must use label sum(L) \'\' for single-value spill.');
  conerasAssert_(perTitle.indexOf('QUERY(db_coneras!A:P,"') !== -1 && perTitle.indexOf(',0)') !== -1 && perTitle.indexOf('SI.ERROR') !== -1,
    'Per-title must use QUERY with headers 0 wrapped in SI.ERROR.');
  conerasAssert_(perTitle.indexOf('E7') !== -1 && perTitle8.indexOf('E8') !== -1 && perTitle8.indexOf('E7') === -1,
    'Per-title must reference its own titulo row — E7 formula must not mention E8 and vice versa.');
  conerasAssert_(perTitle.indexOf('SUMAR.SI') === -1 && perTitle.indexOf('SUMIF') === -1,
    'Per-title must query db_coneras, not SUMAR.SI over conera/AUTOCONER sheets (unified conera).');
  conerasAssert_(daily.indexOf('select B, sum(L) where B is not null') !== -1 &&
    daily.indexOf('group by B') !== -1,
    'Daily must group QUERY results by fecha.');
  conerasAssert_(daily.indexOf('SI($B5="Fecha"," and B is null",') !== -1,
    'The daily chart source must be empty for Fecha and active for Semana or Mes.');
  conerasAssert_(daily.indexOf('SI.ERROR(QUERY(db_coneras!A:P,"') !== -1 && daily.indexOf('",1),"")') !== -1,
    'Daily QUERY must be wrapped with SI.ERROR for empty-db handling (blank not #N/A).');
  conerasAssert_(daily.indexOf('QUERY(db_coneras!A:P,"') !== -1 && daily.indexOf(',1)') !== -1,
    'Daily QUERY must use comma locale: QUERY(...,1) with comma.');
  conerasAssert_(daily.indexOf(';') === -1 && perTitle.indexOf(';') === -1,
    'Dashboard formulas must use commas, not semicolons (hybrid es-BO sheet expects commas as per H8).');
  conerasAssert_(daily.indexOf('TEXTO(HOY()-6,"yyyy-MM-dd")') !== -1 &&
    daily.indexOf('FECHA(AÑO(HOY()),MES(HOY()),1)') !== -1 && daily.indexOf('FIN.MES(HOY(),0)') !== -1,
    'Daily must use comma locale for TEXTO/FECHA/FIN.MES/HOY (not semicolon).');
  conerasAssert_(perTitle.indexOf('TEXTO($B6,"yyyy-MM-dd")') !== -1,
    'Per-title must use comma locale for TEXTO($B6) (Fecha picker).');
  conerasAssert_(perTitle.indexOf('QUERY(db_coneras!A:P,"') !== -1 && perTitle.indexOf(',0),0)') !== -1,
    'Per-title must use comma locale: QUERY(...,0) wrapped in SI.ERROR(...,0).');
  conerasAssert_(CONERAS_CONFIG.RANGES.DASHBOARD_FECHA === 'B6' && CONERAS_CONFIG.RANGES.DASHBOARD_SUPERVISOR === 'B7' &&
    CONERAS_CONFIG.RANGES.DASHBOARD_EFFICIENCY === 'B8' && CONERAS_CONFIG.RANGES.DASHBOARD_MAQUINA === 'B9',
    'Dashboard RANGES must be B4 Turno, B5 Periodo, B6 Fecha, B7 Supervisor, B8 Efficiency, B9 Maquina.');
  conerasAssert_(perTitle.indexOf(" and B = '") !== -1 && perTitle.indexOf(" and B = date '") === -1,
    'Per-title must compare B as string ( and B = \'...\' ), not date literal ( and B = date \'...\').');
  conerasAssert_(perTitle.indexOf(" and B >= '") !== -1 && perTitle.indexOf(" and B >= date '") === -1,
    'Per-title Semana/Mes must use string range B >= \'...\' without date keyword.');
  conerasAssert_(daily.indexOf(" and B >= '") !== -1 && daily.indexOf(" and B >= date '") === -1,
    'Daily must use string range B >= \'...\' without date keyword.');
  conerasAssert_(perTitle.indexOf(" and B <= '") !== -1 && daily.indexOf(" and B <= '") !== -1,
    'Both per-title and daily must use B <= \'...\' string comparison.');
}

function conerasTestDashboardSetupDoesNotOverwriteTitles_() {
  const written = [];
  const dashboard = {
    getRange: function (a1) {
      return {
        setValue: function () { return this; },
        setDataValidation: function () { return this; },
        setNumberFormat: function () { return this; },
        setFormula: function (formula) {
          written.push({ range: a1, formula: formula });
          if (a1.charAt(0) === 'E' && Number(a1.slice(1)) >= 7 && Number(a1.slice(1)) <= 16) {
            throw new Error('Must not overwrite titulo input ' + a1 + ' — E7:E16 are inputs.');
          }
          return this;
        },
        getValue: function () { return ''; },
        getA1Notation: function () { return a1; }
      };
    },
    getCharts: function () { return []; },
    newChart: function () {
      return {
        setChartType: function(){ return this; },
        addRange: function(){ return this; },
        setPosition: function(){ return this; },
        setOption: function(){ return this; },
        build: function(){ return {}; }
      };
    },
    insertChart: function () {},
    removeChart: function () {}
  };
  const originalSpreadsheetApp = typeof SpreadsheetApp !== 'undefined' ? SpreadsheetApp : null;
  const originalCharts = typeof Charts !== 'undefined' ? Charts : null;
  if (typeof SpreadsheetApp === 'undefined') {
    this.SpreadsheetApp = {
      newDataValidation: function(){ return { requireValueInList:function(){return this;}, requireDate:function(){return this;}, setAllowInvalid:function(){return this;}, setHelpText:function(){return this;}, build:function(){return {};}};},
      BorderStyle: { SOLID: 'SOLID' },
      ProtectionType: { RANGE: 'RANGE' }
    };
  }
  if (typeof Charts === 'undefined') {
    this.Charts = { ChartType: { BAR: 'BAR', LINE: 'LINE' } };
  }
  // Provide minimal SpreadsheetApp.getActiveSpreadsheet stub if needed by conerasEnsureDashboardCharts_
  // conerasConfigureDashboard_ only uses dashboard arg plus CONERAS_CONFIG + builders.
  conerasConfigureDashboard_(dashboard);
  const hasF7 = written.some(function (entry) { return entry.range === 'F7'; });
  const hasF16 = written.some(function (entry) { return entry.range === 'F16'; });
  const hasK7 = written.some(function (entry) { return entry.range === 'K7'; });
  const hasE = written.some(function (entry) { return entry.range.charAt(0) === 'E' && Number(entry.range.slice(1)) >= 7 && Number(entry.range.slice(1)) <= 16; });
  conerasAssert_(hasF7, 'Setup must set formula at F7 (first totals row).');
  conerasAssert_(hasF16, 'Setup must set formulas through F16 (last totals row).');
  conerasAssert_(hasK7, 'Setup must still set daily QUERY at K7.');
  conerasAssert_(!hasE, 'Setup must never setFormula on E7:E16 (titles are inputs).');
  const f7Formula = written.filter(function (e){ return e.range==='F7'; })[0].formula;
  conerasAssert_(f7Formula.indexOf('E7') !== -1 && f7Formula.indexOf('db_coneras') !== -1,
    'F7 formula must reference E7 and query db_coneras.');
  const k7Formula = written.filter(function (e){ return e.range==='K7'; })[0].formula;
  conerasAssert_(k7Formula.indexOf('SI.ERROR(QUERY(db_coneras!A:P,"') !== -1,
    'K7 daily must be wrapped with SI.ERROR for empty handling.');
  conerasAssert_(k7Formula.indexOf(';') === -1,
    'K7 and F7 formulas must use comma locale, not semicolons.');
  conerasAssert_(f7Formula.indexOf('SI.ERROR(QUERY(db_coneras!A:P,"') !== -1 && f7Formula.indexOf(',0),0)') !== -1,
    'F7 per-row must use SI.ERROR(QUERY(...,0),0) with comma locale.');
  // restore not needed in test harness
  if (originalSpreadsheetApp && typeof SpreadsheetApp !== 'undefined') {}
  if (originalCharts && typeof Charts !== 'undefined') {}
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
    conerasTestSnapshotValidationAndBatchSizes_,
    conerasTestDashboardQueries_,
    conerasTestDashboardSetupDoesNotOverwriteTitles_
  ];
  tests.forEach(function (test) { test(); });
  Logger.log('✅ ' + tests.length + ' Coneras tests passed.');
  return tests.length + ' Coneras tests passed.';
}
