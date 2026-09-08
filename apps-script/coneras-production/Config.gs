/**
 * Config.gs — Frozen configuration for the isolated Coneras Apps Script project.
 */

const CONERAS_CONFIG = Object.freeze({
  TIMEZONE: 'America/La_Paz',
  SHEETS: Object.freeze({
    CONERA: 'conera',
    DASHBOARD: 'dashboard',
    DB: 'db_coneras',
    ERRORS: 'Errors'
  }),
  RANGES: Object.freeze({
    BANNER: 'A1:H2',
    META_MANUAL: 'C4',
    META_REAL: 'E4',
    TURNO: 'G4',
    MAQUINA: 'C5',
    FECHA: 'E5',
    SUPERVISOR: 'G5',
    FORM_INPUTS: 'B8:G22',
    DESCARGA_NUMBERS: 'A8:A22',
    NET_WEIGHT_FIRST: 'H8',
    NET_WEIGHT_FORMULAS: 'H8:H22',
    TOTAL_NET_WEIGHT: 'H23',
    SAVE_CHECKBOX: 'I8',
    SAVE_LABEL: 'J8',
    DB_HEADERS: 'A1:P1',
    ERRORS_HEADERS: 'A1:F1',
    DASHBOARD_EFFICIENCY: 'B8',
    DASHBOARD_PERIODO: 'B5',
    DASHBOARD_TURNO: 'B4',
    DASHBOARD_MAQUINA: 'B9',
    DASHBOARD_SUPERVISOR: 'B7',
    DASHBOARD_FECHA: 'B6',
    DASHBOARD_TITLES: 'E7:E16',
    DASHBOARD_TOTALS: 'F7',
    DASHBOARD_TOTALS_RANGE: 'F7:F16',
    DASHBOARD_DAILY: 'K7',
    DASHBOARD_TOTALS_CHART_RANGE: 'E7:F',
    DASHBOARD_DAILY_CHART_RANGE: 'K7:L'
  }),
  LIMITS: Object.freeze({
    DESCARGAS: 15,
    DB_COLUMNS: 16,
    ERROR_COLUMNS: 6
  }),
  TURNO_VALUES: Object.freeze(['Dia', 'Tarde', 'Noche']),
  MAQUINA_VALUES: Object.freeze([
    'Autoconer 1', 'Autoconer 2', 'Autoconer 3', 'Conera 3', 'Conera 4'
  ]),
  DASHBOARD: Object.freeze({
    PERIODO_VALUES: ['Fecha', 'Semana', 'Mes']
  }),
  DB_HEADERS: Object.freeze([
    'id', 'fecha', 'turno', 'maquina', 'descarga_nro', 'titulo', 'operador',
    'peso_bruto', 'usos', 'peso_canilla', 'peso_tacho', 'peso_neto',
    'supervisor', 'creado', 'actualizado', 'editado_por'
  ]),
  ERRORS_HEADERS: Object.freeze([
    'timestamp', 'scope', 'range', 'code', 'reason', 'user'
  ]),
  ERRORS: Object.freeze({
    INVALID_FECHA: 'invalid_fecha',
    INVALID_TURNO: 'invalid_turno',
    INVALID_MAQUINA: 'invalid_maquina',
    EMPTY_FORM: 'empty_form',
    LOCK_TIMEOUT: 'lock_timeout',
    SETUP_INVALID_FORMULA: 'setup_invalid_formula'
  }),
  FORMULAS: Object.freeze({
    NET_WEIGHT_FIRST: '=SI(ESNUMERO(D8),MAX(0,D8-(E8*F8)-G8),"")',
    DASHBOARD_TOTALS_SELECT: 'select sum(L)',
    DASHBOARD_DAILY_SELECT: 'select B, sum(L)',
    DASHBOARD_DAILY_GROUP_BY: 'B'
  }),
  UI: Object.freeze({
    SAVE_LABEL: '☑ GUARDAR TURNO',
    DB_HEADER_COLOR: '#e8f0fe',
    ERRORS_HEADER_COLOR: '#fce8e6',
    HEADER_PROTECTION: 'Coneras frozen header — do not reorder'
  })
});

function conerasGetSheet_(spreadsheet, key) {
  const ss = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(CONERAS_CONFIG.SHEETS[key]);
}

function conerasRequireSheet_(spreadsheet, key) {
  const sheet = conerasGetSheet_(spreadsheet, key);
  if (!sheet) throw new Error('Required sheet is missing: ' + CONERAS_CONFIG.SHEETS[key]);
  return sheet;
}

function conerasNormalizeFecha_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    // Business date (E5) is a pure calendar date — timezone-agnostic.
    // Extract local calendar parts without Utilities.formatDate / America/La_Paz.
    // Audit timestamps (creado/actualizado) alone use America/La_Paz.
    var y = value.getFullYear();
    var m = value.getMonth() + 1;
    var d = value.getDate();
    return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  const raw = String(value || '').trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
    return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  }

  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return '';
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

function conerasBuildId_(fecha, turno, maquina, descargaNro) {
  const number = Number(descargaNro);
  if (!fecha || !turno || !maquina || !Number.isInteger(number) || number < 1 ||
      number > CONERAS_CONFIG.LIMITS.DESCARGAS) return '';
  const machineId = String(maquina).trim().toUpperCase().replace(/\s+/g, '_');
  return [fecha, String(turno).trim().toUpperCase(), machineId,
    String(number).padStart(2, '0')].join('-');
}

function conerasHeadersMatch_(actual, expected) {
  return actual.length === expected.length && actual.every(function (value, index) {
    return value === expected[index];
  });
}

function conerasFormulaCells_() {
  // All native formulas (H8, H23, E4) are Sheet-owned — verified leniently in Setup, never overwritten by script.
  return Object.freeze([]);
}

function conerasBuildDashboardQuery_(selectClause, groupBy, emptyForFecha) {
  const ranges = CONERAS_CONFIG.RANGES;
  const temporalPredicate = emptyForFecha
    ? 'IF($' + ranges.DASHBOARD_PERIODO + '="Fecha"," and B is null",'
    : 'IF($' + ranges.DASHBOARD_PERIODO + '="Fecha",IF(ISNUMBER($' + ranges.DASHBOARD_FECHA + ')," and B = \'"&TEXT($' + ranges.DASHBOARD_FECHA + ',"yyyy-MM-dd")&"\'"," and B is null"),';
  const rollingPeriod = 'IF($' + ranges.DASHBOARD_PERIODO + '="Semana"," and B >= \'"&TEXT(TODAY()-6,"yyyy-MM-dd")&"\' and B <= \'"&TEXT(TODAY(),"yyyy-MM-dd")&"\'"," and B >= \'"&TEXT(DATE(YEAR(TODAY()),MONTH(TODAY()),1),"yyyy-MM-dd")&"\' and B <= \'"&TEXT(EOMONTH(TODAY(),0),"yyyy-MM-dd")&"\'"))';
  const filters = [
    'IF($' + ranges.DASHBOARD_TURNO + '="Todos",""," and C = \'"&SUBSTITUTE($' + ranges.DASHBOARD_TURNO + ',"\'","\'\'")&"\'")',
    'IF($' + ranges.DASHBOARD_MAQUINA + '="Todos",""," and D = \'"&SUBSTITUTE($' + ranges.DASHBOARD_MAQUINA + ',"\'","\'\'")&"\'")',
    'IF($' + ranges.DASHBOARD_SUPERVISOR + '="Todos",""," and M = \'"&SUBSTITUTE($' + ranges.DASHBOARD_SUPERVISOR + ',"\'","\'\'")&"\'")'
  ].join('&');
  const label = groupBy === 'F'
    ? " label F 'Título', sum(L) 'Peso Neto'"
    : " label B 'Fecha', sum(L) 'Peso Neto'";
  return '=IFERROR(QUERY(db_coneras!A:P,"' + selectClause + ' where B is not null"&' +
    temporalPredicate + rollingPeriod + '&' + filters + '&" group by ' + groupBy + label + '",1),"")';
}

function conerasBuildDashboardTotalsFormula_(tituloCell) {
  const ranges = CONERAS_CONFIG.RANGES;
  const cell = tituloCell || ranges.DASHBOARD_TITLES.split(':')[0];
  const temporal = 'IF($' + ranges.DASHBOARD_PERIODO + '="Fecha",IF(ISNUMBER($' + ranges.DASHBOARD_FECHA + ')," and B = \'"&TEXT($' + ranges.DASHBOARD_FECHA + ',"yyyy-MM-dd")&"\'"," and B is null"),IF($' + ranges.DASHBOARD_PERIODO + '="Semana"," and B >= \'"&TEXT(TODAY()-6,"yyyy-MM-dd")&"\' and B <= \'"&TEXT(TODAY(),"yyyy-MM-dd")&"\'"," and B >= \'"&TEXT(DATE(YEAR(TODAY()),MONTH(TODAY()),1),"yyyy-MM-dd")&"\' and B <= \'"&TEXT(EOMONTH(TODAY(),0),"yyyy-MM-dd")&"\'"))';
  const filters = [
    'IF($' + ranges.DASHBOARD_TURNO + '="Todos",""," and C = \'"&SUBSTITUTE($' + ranges.DASHBOARD_TURNO + ',"\'","\'\'")&"\'")',
    'IF($' + ranges.DASHBOARD_MAQUINA + '="Todos",""," and D = \'"&SUBSTITUTE($' + ranges.DASHBOARD_MAQUINA + ',"\'","\'\'")&"\'")',
    'IF($' + ranges.DASHBOARD_SUPERVISOR + '="Todos",""," and M = \'"&SUBSTITUTE($' + ranges.DASHBOARD_SUPERVISOR + ',"\'","\'\'")&"\'")'
  ].join('&');
  const tituloEscaped = 'SUBSTITUTE(TEXT(' + cell + ',"@"),"\'","\'\'")';
  const tituloPredicate = 'IF(ISNUMBER(' + cell + ')," and F = "&' + cell + '&" "," and F = \'"&' + tituloEscaped + '&"\'")';
  return '=IF(' + cell + '="","",IFERROR(QUERY(db_coneras!A:P,"' + CONERAS_CONFIG.FORMULAS.DASHBOARD_TOTALS_SELECT + ' where B is not null"&' + tituloPredicate + '&' + temporal + '&' + filters + '&" label sum(L) \'\'",0),0))';
}
