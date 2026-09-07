/**
 * Menu.test.gs — Narrow checks for the Settings!I8 checkbox and F4/F5 hydration guards.
 * Lowercased sheets: settings, db_asignaciones, db_descargas, errors.
 */

function yarnMenuEvent_(sheetName, row, column, value) {
  return {
    value: value,
    range: {
      getSheet: function () { return { getName: function () { return sheetName; } }; },
      getRow: function () { return row; },
      getColumn: function () { return column; },
      getValue: function () { return value; }
    }
  };
}

function yarnFakeSettingsSpreadsheet_(names) {
  var sheets = names.map(function (name) {
    return {
      getName: function () { return name; },
      setName: function (newName) { this._name = newName; this.getName = function () { return newName; }; }
    };
  });
  return {
    getSheetByName: function (name) {
      for (var i = 0; i < sheets.length; i++) {
        if (sheets[i].getName() === name) return sheets[i];
      }
      return null;
    },
    getSheets: function () { return sheets.slice(); }
  };
}

function yarnRunMenuTests_() {
  var cfg = YARN_SETTINGS_CONFIG;
  var settingsName = cfg.SHEETS.SETTINGS;
  yarnAssert_(yarnIsSaveCheckboxEvent_(yarnMenuEvent_(settingsName, 8, 9, 'TRUE')),
    'I8 TRUE must be accepted as the mobile save event.');
  yarnAssert_(yarnIsSaveCheckboxEvent_(yarnMenuEvent_(settingsName, 8, 9, 'VERDADERO')),
    'I8 VERDADERO must be accepted for the Spanish Sheets locale.');
  yarnAssert_(!yarnIsSaveCheckboxEvent_(yarnMenuEvent_(settingsName, 8, 9, 'FALSE')),
    'I8 FALSE must not start another save.');
  yarnAssert_(!yarnIsSaveCheckboxEvent_(yarnMenuEvent_(cfg.SHEETS.WEIGHINGS, 8, 9, 'TRUE')),
    'Only the settings I8 checkbox may start a save.');

  // Strict single-variable: alias settings_form must NOT trigger (no tolerance).
  yarnAssert_(!yarnIsSaveCheckboxEvent_(yarnMenuEvent_('settings_form', 8, 9, 'TRUE')),
    'I8 TRUE on settings_form alias must NOT be accepted after simplification.');
  yarnAssert_(!yarnIsSaveCheckboxEvent_(yarnMenuEvent_('SETTINGS', 8, 9, 'TRUE')),
    'I8 TRUE on SETTINGS uppercase must NOT be accepted (case-sensitive strict).');
  var ck = yarnParseA1_(cfg.RANGES.SAVE_CHECKBOX);
  yarnAssert_(ck.row === 8 && ck.col === 9,
    'Config SAVE_CHECKBOX must parse to I8 (8,9).');
  yarnAssert_(yarnIsSaveCheckboxEvent_(yarnMenuEvent_(settingsName, ck.row, ck.col, 'TRUE')),
    'I8 via Config-parsed coordinates must be accepted.');

  // yarnGetSettingsSheet_ strict: only canonical settings is found.
  var ssAlias = yarnFakeSettingsSpreadsheet_(['settings_form']);
  var foundAlias = yarnGetSettingsSheet_(ssAlias);
  yarnAssert_(!foundAlias,
    'yarnGetSettingsSheet_ must NOT find settings_form alias (strict single variable).');
  var ssCanonical = yarnFakeSettingsSpreadsheet_([settingsName]);
  var foundCanonical = yarnGetSettingsSheet_(ssCanonical);
  yarnAssert_(foundCanonical && foundCanonical.getName() === settingsName,
    'yarnGetSettingsSheet_ must find canonical settings.');
  var ssLower = yarnFakeSettingsSpreadsheet_(['SETTINGS']);
  var foundLower = yarnGetSettingsSheet_(ssLower);
  yarnAssert_(!foundLower,
    'yarnGetSettingsSheet_ must NOT find SETTINGS case-insensitively (strict).');

  // yarnParse helpers spot-check.
  var single = yarnParseA1_('I8');
  yarnAssert_(single.row === 8 && single.col === 9, 'yarnParseA1_ I8 must be 8,9.');
  var range = yarnParseRange_('B33:H42');
  yarnAssert_(range.r1 === 33 && range.c1 === 2 && range.r2 === 42 && range.c2 === 8,
    'yarnParseRange_ B33:H42 must be 33,2 -> 42,8.');

  // Date/turno edit guard — must use Config RANGES
  var datePos = yarnParseA1_(cfg.RANGES.DATE);
  var turnoPos = yarnParseA1_(cfg.RANGES.TURNO);
  yarnAssert_(datePos.row === 4 && datePos.col === 6, 'DATE must parse to F4 (4,6).');
  yarnAssert_(turnoPos.row === 5 && turnoPos.col === 6, 'TURNO must parse to F5 (5,6).');
  yarnAssert_(cfg.TURNO_VALUES.join('|') === 'Día|Tarde|Noche', 'TURNO_VALUES must be canonical.');
  yarnAssert_(yarnIsDateOrTurnoEdit_(yarnMenuEvent_(settingsName, datePos.row, datePos.col, '2026-09-03')),
    'F4 edit must be recognized as date/turno hydration trigger.');
  yarnAssert_(yarnIsDateOrTurnoEdit_(yarnMenuEvent_(settingsName, turnoPos.row, turnoPos.col, 'Día')),
    'F5 edit must be recognized as date/turno hydration trigger.');
  yarnAssert_(!yarnIsDateOrTurnoEdit_(yarnMenuEvent_(settingsName, 33, 2, 'x')),
    'B33 edit must NOT trigger hydration.');
  yarnAssert_(!yarnIsDateOrTurnoEdit_(yarnMenuEvent_('db_asignaciones', datePos.row, datePos.col, 'x')),
    'F4 edit on db_asignaciones must NOT trigger hydration.');

  // Header lengths include turno
  yarnAssert_(cfg.ASSIGNMENT_HEADERS.length === 14, 'Assignment headers must be 14 cols with turno.');
  yarnAssert_(cfg.ASSIGNMENT_HEADERS[2] === 'turno', 'Assignment header index 2 must be turno.');
  yarnAssert_(cfg.WEIGHING_HEADERS.length === 16, 'Weighing headers must be 16 cols with turno.');
  yarnAssert_(cfg.WEIGHING_HEADERS[2] === 'turno', 'Weighing header index 2 must be turno.');
  yarnAssert_(cfg.ERRORS.INVALID_TURNO === 'invalid_turno', 'INVALID_TURNO error must exist.');

  return 'Menu tests passed with turno.';
}
