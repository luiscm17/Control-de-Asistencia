/**
 * Menu.test.gs — Narrow checks for the Settings!K2 checkbox event guard.
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

function yarnRunMenuTests_() {
  yarnAssert_(yarnIsSaveCheckboxEvent_(yarnMenuEvent_('Settings', 2, 11, 'TRUE')),
    'K2 TRUE must be accepted as the mobile save event.');
  yarnAssert_(yarnIsSaveCheckboxEvent_(yarnMenuEvent_('Settings', 2, 11, 'VERDADERO')),
    'K2 VERDADERO must be accepted for the Spanish Sheets locale.');
  yarnAssert_(!yarnIsSaveCheckboxEvent_(yarnMenuEvent_('Settings', 2, 11, 'FALSE')),
    'K2 FALSE must not start another save.');
  yarnAssert_(!yarnIsSaveCheckboxEvent_(yarnMenuEvent_('DB_Descargas', 2, 11, 'TRUE')),
    'Only the Settings K2 checkbox may start a save.');
  return '4 Menu tests passed.';
}
