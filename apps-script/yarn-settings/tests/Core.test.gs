/**
 * Core.test.gs — Orchestration checks for the Yarn Settings save flow.
 * Run yarnRunCoreTests_ manually in Apps Script or through the local VM harness.
 */

function yarnCoreValidSnapshot_() {
  return Object.freeze({
    valid: true,
    date: Object.freeze({ year: 2026, month: 9, day: 3 }),
    assignments: Object.freeze([Object.freeze({ machine: 'Retorcedora 1' })]),
    weighings: Object.freeze([Object.freeze({ grossWeight: 60 })]),
    errors: Object.freeze([])
  });
}

function yarnCoreInvalidSnapshot_() {
  return Object.freeze({
    valid: false,
    date: null,
    assignments: Object.freeze([]),
    weighings: Object.freeze([]),
    errors: Object.freeze([Object.freeze({ code: 'invalid_date', range: 'Settings!F4' })])
  });
}

function yarnCoreWithSeams_(seams, callback) {
  const previous = YARN_SETTINGS_SEAMS;
  YARN_SETTINGS_SEAMS = seams;
  try {
    return callback();
  } finally {
    YARN_SETTINGS_SEAMS = previous;
  }
}

function yarnTestCoreRetriesLockOnce_() {
  const calls = { tryLock: 0, apply: 0, release: 0, sleeps: 0 };
  const lock = {
    tryLock: function () { calls.tryLock += 1; return calls.tryLock === 2; },
    releaseLock: function () { calls.release += 1; }
  };
  const result = yarnCoreWithSeams_({
    readSnapshot: yarnCoreValidSnapshot_,
    getLock: function () { return lock; },
    sleep: function () { calls.sleeps += 1; },
    loadState: function () { return {}; },
    buildPlan: function () { return { assignmentCount: 1, weighingCount: 1, netKilograms: 42.5 }; },
    applyPlan: function () { calls.apply += 1; return {}; },
    flush: function () {},
    toast: function () {},
    logError: function () {}
  }, guardarTurno);

  yarnAssert_(result.success, 'The second lock attempt must save successfully.');
  yarnAssert_(calls.tryLock === 2 && calls.sleeps === 1,
    'A contended save must wait once and retry exactly once.');
  yarnAssert_(calls.apply === 1 && calls.release === 1,
    'A successful save must apply one plan and release the lock.');
}

function yarnTestCoreValidatesBeforeLockOrWrites_() {
  const calls = { lock: 0, apply: 0, log: 0 };
  const result = yarnCoreWithSeams_({
    readSnapshot: yarnCoreInvalidSnapshot_,
    getLock: function () { calls.lock += 1; throw new Error('must not lock invalid input'); },
    applyPlan: function () { calls.apply += 1; },
    toast: function () {},
    logError: function () { calls.log += 1; }
  }, guardarTurno);

  yarnAssert_(!result.success && result.code === 'invalid_date',
    'Invalid metadata must return its validation code.');
  yarnAssert_(calls.lock === 0 && calls.apply === 0,
    'Invalid metadata must produce zero lock attempts and zero DB writes.');
  yarnAssert_(calls.log === 1, 'Invalid metadata must create failure evidence.');
}

function yarnTestCoreReportsInjectedWriteRollback_() {
  const calls = { release: 0, log: 0, flush: 0 };
  const lock = { tryLock: function () { return true; }, releaseLock: function () { calls.release += 1; } };
  const result = yarnCoreWithSeams_({
    readSnapshot: yarnCoreValidSnapshot_,
    getLock: function () { return lock; },
    loadState: function () { return {}; },
    buildPlan: function () { return { assignmentCount: 1, weighingCount: 1, netKilograms: 42.5 }; },
    applyPlan: function () { throw new Error('injected write failure after compensation'); },
    flush: function () { calls.flush += 1; },
    toast: function () {},
    logError: function () { calls.log += 1; }
  }, guardarTurno);

  yarnAssert_(!result.success && result.code === 'save_failed',
    'An injected persistence failure must become a failed save result.');
  yarnAssert_(calls.release === 1 && calls.log === 1 && calls.flush === 0,
    'A failed plan must release its lock, log evidence, and not flush success state.');
}

function yarnRunCoreTests_() {
  const tests = [
    yarnTestCoreRetriesLockOnce_,
    yarnTestCoreValidatesBeforeLockOrWrites_,
    yarnTestCoreReportsInjectedWriteRollback_
  ];
  tests.forEach(function (test) { test(); });
  return tests.length + ' Core tests passed.';
}
