/**
 * Winding.test.gs — Manual RED harness for winding persistence seams.
 *
 * Run windingTestHelpers_ from the Apps Script editor on a spreadsheet COPY.
 * These Phase 1 checks intentionally fail until the Phase 2 and Phase 3 helper
 * contracts are implemented. Each line is logged with ✅ or ❌.
 */

function windingTestHelpers_() {
  const results = [];

  function assert(name, actual, expected) {
    const passed = JSON.stringify(actual) === JSON.stringify(expected);
    results.push((passed ? '✅ ' : '❌ ') + name +
      ' | got=' + JSON.stringify(actual) +
      ' expected=' + JSON.stringify(expected));
  }

  function seam(name, callback, expected) {
    try {
      assert(name, callback(), expected);
    } catch (error) {
      results.push('❌ ' + name + ' | missing or failing seam: ' + error.message);
    }
  }

  seam('native date key uses America/La_Paz', function () {
    return windingNativeDateKey_(new Date(2026, 8, 17, 12, 0, 0));
  }, '2026-09-17');

  seam('identity trims and preserves case', function () {
    return windingNormalizeRecordIdentity_('2026-09-17', ' Noche ', ' lote-A ');
  }, { ok: true, id: '2026-09-17|Noche|lote-A' });

  seam('identity rejects delimiter', function () {
    return windingNormalizeRecordIdentity_('2026-09-17', 'Noche|Extra', 'lote-A');
  }, { ok: false, code: 'invalid_delimiter' });

  seam('eligible row requires color lote and title', function () {
    return windingIsSnapshotRowEligible_([1, 'MORADO', '41-26-30', '2/32']);
  }, true);

  seam('incomplete row is omitted', function () {
    return windingIsSnapshotRowEligible_([1, 'MORADO', '', '2/32']);
  }, false);

  seam('operator blanks and non-numerics become zero', function () {
    return windingNormalizeOperatorValues_(['', 3.5, 'invalid']);
  }, { values: [0, 3.5, 0], invalidIndexes: [2] });

  seam('recovery ranges exclude formula-owned E', function () {
    return windingGetRecoveryRanges_();
  }, ['B12:D23', 'F12:T23']);

  Logger.log(results.join('\n'));
  return results.join('\n');
}
