/**
 * yarnProduction.test.gs — Manual harness for yarn-production pure helpers
 *
 * Pure helpers, not production logic. Run from Apps Script editor:
 *   Select yarnTestHelpers_ > Run  (requires Config.gs loaded for YARN_CONFIG)
 * Hardcoded dates (e.g. '1/8/2026', '2026-08-01') are intentional test fixtures
 * verifying d/M/yyyy → ISO normalization and audit preservation; not hardcode smell.
 * Extracted from Form.gs to keep production file free of test code.
 */

// --- MANUAL HARNESS (run from editor for unit verification) ---
function yarnTestHelpers_() {
  const tests = [];
  function assert(name, got, expected) {
    const pass = JSON.stringify(got) === JSON.stringify(expected);
    tests.push((pass ? '✅ ' : '❌ ') + name + ' | got=' + JSON.stringify(got) + ' expected=' + JSON.stringify(expected));
    if (!pass) Logger.log('FAIL ' + name + ' got ' + JSON.stringify(got) + ' expected ' + JSON.stringify(expected));
  }
  assert('parse Date', yarnParseG2ToIso_(new Date(2026, 7, 1, 12)), '2026-08-01');
  assert('parse d/M/yyyy', yarnParseG2ToIso_('1/8/2026'), '2026-08-01');
  assert('parse 31/7/2026', yarnParseG2ToIso_('31/7/2026'), '2026-07-31');
  assert('parse yyyy-MM-dd', yarnParseG2ToIso_('2026-08-01'), '2026-08-01');
  assert('blank -> empty', yarnParseG2ToIso_(''), '');
  assert('buildId', yarnBuildId_('2026-08-01', 'DIA'), '2026-08-01-DIA');
  assert('eligible true', yarnIsRowEligible_(['', 0, '']), true);
  assert('eligible false (all blank)', yarnIsRowEligible_(['', '', '']), false);
  assert('eligible false (empty array blank)', yarnIsRowEligible_(['   ', null, undefined]), false);
  assert('normalize blank->0', yarnNormalizeProcessValues_(['', '850', '']), [0, 850, 0]);
  assert('total', yarnComputeTotalProductoTerminado_(200, 303.5, 0), 503.5);
  const norm = yarnNormalizeProcessValues_([850, 0, 0, 408, 1020, 912, 200, 303.5, 0]);
  assert('normalize full', norm, [850, 0, 0, 408, 1020, 912, 200, 303.5, 0]);
  const mobileEvent = function (overrides) {
    const data = overrides || {};
    return {
      value: data.value == null ? 'TRUE' : data.value,
      oldValue: data.oldValue == null ? 'FALSE' : data.oldValue,
      range: {
        getNumRows: function () { return data.rows == null ? 1 : data.rows; },
        getNumColumns: function () { return data.cols == null ? 1 : data.cols; },
        getRow: function () { return data.row == null ? YARN_CONFIG.MOBILE_SAVE_ROW : data.row; },
        getColumn: function () { return data.col == null ? YARN_CONFIG.MOBILE_SAVE_COL : data.col; },
        getSheet: function () { return { getName: function () { return data.sheet || YARN_CONFIG.FORM_SHEET; } }; }
      }
    };
  };
  assert('mobile event accepts M4 FALSE->TRUE', yarnIsMobileSaveEvent_(mobileEvent()), true);
  assert('mobile event ignores non-M4 edit', yarnIsMobileSaveEvent_(mobileEvent({ col: 12 })), false);
  assert('mobile event ignores multi-cell edit', yarnIsMobileSaveEvent_(mobileEvent({ cols: 2 })), false);
  assert('mobile event ignores missing metadata', yarnIsMobileSaveEvent_({ range: mobileEvent().range }), false);
  assert('mobile event ignores reset edit', yarnIsMobileSaveEvent_(mobileEvent({ value: 'FALSE', oldValue: 'TRUE' })), false);
  assert('successful save resets checkbox', yarnMobileSaveResult_({ ok: true, reason: 'saved' }), { resetCheckbox: true, reason: 'saved' });
  assert('invalid G2 retains checkbox', yarnMobileSaveResult_({ ok: false, reason: 'invalid_date' }), { resetCheckbox: false, reason: 'invalid_date' });
  assert('no eligible row retains checkbox', yarnMobileSaveResult_({ ok: false, reason: 'no_eligible_rows' }), { resetCheckbox: false, reason: 'no_eligible_rows' });
  assert('failed save retains checkbox', yarnMobileSaveResult_({ ok: false, reason: 'lock_timeout' }), { resetCheckbox: false, reason: 'lock_timeout' });
  assert('concurrent re-entry is debounced', yarnIsMobileSaveDebounced_('yarn-mobile-save:1000', 1000 + YARN_CONFIG.MOBILE_SAVE_DEBOUNCE_MS - 1), true);
  assert('expired mobile marker permits retry', yarnIsMobileSaveDebounced_('yarn-mobile-save:1000', 1000 + YARN_CONFIG.MOBILE_SAVE_DEBOUNCE_MS), false);
  assert('empty TARDE remains ineligible', yarnIsRowEligible_(['', '', '', '', '', '', '', '', '']), false);
  assert('DIA and NOCHE are eligible independently', [
    yarnIsRowEligible_([1, '', '', '', '', '', '', '', '']),
    yarnIsRowEligible_(['', '', '', '', '', '', '', '', 1])
  ], [true, true]);
  const existingTarde = new Array(YARN_CONFIG.HEADER.length).fill('');
  existingTarde[YARN_CONFIG.IDX.REGISTRADO_POR] = 'operator@example.com';
  existingTarde[YARN_CONFIG.IDX.CREADO] = '2026-09-05 08:00:00';
  const updatedTarde = yarnBuildRecordFromFormRow_(
    '2026-09-05', 'TARDE', [0, 0, 0, 0, 0, 0, 3, 4, 5], 'editor@example.com', '2026-09-05 12:00:00', existingTarde
  );
  assert('existing TARDE preserves insert audit', [
    updatedTarde[YARN_CONFIG.IDX.REGISTRADO_POR],
    updatedTarde[YARN_CONFIG.IDX.CREADO],
    updatedTarde[YARN_CONFIG.IDX.EDITADO_POR],
    updatedTarde[YARN_CONFIG.IDX.TOTAL]
  ], ['operator@example.com', '2026-09-05 08:00:00', 'editor@example.com', 12]);
  Logger.log(tests.join('\n'));
  return tests.join('\n');
}
