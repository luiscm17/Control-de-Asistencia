/**
 * Winding.test.gs — Manual RED harness for winding persistence seams.
 *
 * Run windingTestHelpers_ from the Apps Script editor on a spreadsheet COPY.
 * The remaining Phase 3 checks intentionally fail until Menu.gs implements
 * their workflow contracts. Each line is logged with ✅ or ❌.
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

  seam('snapshot rejects missing shift keys', function () {
    return windingValidateSnapshotKeys_(null, 'Noche');
  }, { ok: false, code: 'missing_key' });

  seam('DB index rejects duplicate IDs', function () {
    return windingBuildRecordIndex_([
      ['2026-09-17|Noche|lote-A'],
      ['2026-09-17|Noche|lote-A']
    ]);
  }, { ok: false, code: 'duplicate_id' });

  seam('lock timeout produces no mutations', function () {
    return windingLockTimeoutResult_();
  }, { success: false, code: 'lock_timeout', inserted: 0, updated: 0 });

  seam('upsert plan updates an existing ID idempotently', function () {
    const id = '2026-09-17|Noche|lote-A';
    const existing = Array(WINDING_CONFIG.DB_HEADERS.length).fill('');
    existing[WINDING_CONFIG.IDX.ID] = id;
    const record = { id: id, fecha: new Date(2026, 8, 17, 12), turno: 'Noche',
      item: '1', supervisor: 'Ana', color: 'MORADO', lote: 'lote-A', titulo: '2/32',
      metaKg: '10', operators: Array(15).fill(0) };
    const indexed = windingBuildRecordIndex_([existing]);
    const plan = windingBuildUpsertPlan_([record], indexed.index,
      '2026-09-17 12:00:00', 'editor@example.com');
    return { updates: plan.updates.length, appends: plan.appends.length, row: plan.updates[0].rowNumber };
  }, { updates: 1, appends: 0, row: 2 });

  seam('upsert plan never deletes absent records', function () {
    const historicalId = '2026-09-17|Noche|historical';
    const indexed = windingBuildRecordIndex_([[historicalId]]);
    const plan = windingBuildUpsertPlan_([], indexed.index,
      '2026-09-17 12:00:00', 'editor@example.com');
    return { updates: plan.updates.length, appends: plan.appends.length, deletes: plan.deletes.length };
  }, { updates: 0, appends: 0, deletes: 0 });

  seam('checkbox routing accepts FALSE to TRUE only', function () {
    return windingIsSaveCheckboxEvent_({ value: 'TRUE', oldValue: 'FALSE' });
  }, true);

  seam('checkbox routing ignores TRUE without FALSE predecessor', function () {
    return windingIsSaveCheckboxEvent_({ value: 'TRUE', oldValue: undefined });
  }, false);

  seam('guarded recovery permits a fully empty persisted zone', function () {
    return windingCanAutoRecover_(Array(12).fill(Array(19).fill('')));
  }, true);

  seam('guarded recovery blocks populated persisted zones', function () {
    return windingCanAutoRecover_([['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'x']]);
  }, false);

  seam('recovery writes never include formula-owned E', function () {
    return windingGetRecoveryRanges_();
  }, ['B12:D23', 'F12:T23']);

  seam('recovery restores the deterministic supervisor', function () {
    return windingRecoverySupervisor_([{ supervisor: 'Ana' }, { supervisor: 'Bea' }]);
  }, 'Ana');

  seam('corrective delete requires the exact confirmed ID', function () {
    return windingIsConfirmedDelete_("2026-09-17|Noche|lote-A", "2026-09-17|Noche|lote-A");
  }, true);

  seam('corrective delete rejects a different confirmation', function () {
    return windingIsConfirmedDelete_("2026-09-17|Noche|lote-A", "2026-09-17|Noche|lote-B");
  }, false);

  Logger.log(results.join('\n'));
  return results.join('\n');
}
