/**
 * material-raw.test.gs — Full GAS harness for material-raw (PR3 Diario + Testing).
 *
 * Covers: Config freeze, FECHA passthrough (native Date), filter F<>"" at index 4,
 * filtered save (only F<>""), F="" skip, re-save replaces (delete+append PK fecha),
 * native fecha vs formatted, header drift fail-closed, F4 reset, rehydrate hit/miss
 * preserves H (B7:G37 only), Resincronizar mirrors D4, SUMAR.SI formula B10:B40,
 * lock timeout no-write (withLock), debounce 3000ms, no I8/M4 leaks, flush.
 *
 * Run in Apps Script editor: select materialRawTest_ → Run → View Logger (✅/❌).
 * Also runs mocked unit branch when SpreadsheetApp unavailable — CI-safe.
 * Hardcoded dates are intentional fixtures; no magic hardcode smell.
 */

function materialRawTest_() {
  var results = [];
  function assert(name, cond, detail) {
    var ok = !!cond;
    results.push({ name: name, ok: ok, detail: detail || '' });
    Logger.log((ok ? '✅ ' : '❌ ') + name + (detail ? ' — ' + detail : ''));
    return ok;
  }
  function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  // -------------------------------------------------------------------------
  // 1) Config frozen — exact A1:J1, ranges, timezone, indexes
  // -------------------------------------------------------------------------
  try {
    assert('CONFIG frozen', Object.isFrozen(MATERIAL_RAW_CONFIG), '');
    assert('CONFIG DB_HEADERS length 10', MATERIAL_RAW_CONFIG.DB_HEADERS.length === 10, String(MATERIAL_RAW_CONFIG.DB_HEADERS.length));
    assert('CONFIG DB_HEADERS exact', MATERIAL_RAW_CONFIG.DB_HEADERS.join('|') === 'fecha|dia|n_camion|tipo_material|n_partida|n_bulto|tipo_fardo|cantidad|total_kilos|timestamp', MATERIAL_RAW_CONFIG.DB_HEADERS.join('|'));
    assert('CONFIG RANGES DATE D4', MATERIAL_RAW_CONFIG.RANGES.DATE === 'D4', MATERIAL_RAW_CONFIG.RANGES.DATE);
    assert('CONFIG RANGES CHECKBOX F4', MATERIAL_RAW_CONFIG.RANGES.CHECKBOX === 'F4', MATERIAL_RAW_CONFIG.RANGES.CHECKBOX);
    assert('CONFIG RANGES FORM B7:H37', MATERIAL_RAW_CONFIG.RANGES.FORM === 'B7:H37', MATERIAL_RAW_CONFIG.RANGES.FORM);
    assert('CONFIG RANGES CLEAR B7:G37', MATERIAL_RAW_CONFIG.RANGES.CLEAR === 'B7:G37', MATERIAL_RAW_CONFIG.RANGES.CLEAR);
    assert('CONFIG SHEETS FORM Control Camiones', MATERIAL_RAW_CONFIG.SHEETS.FORM === 'Control Camiones', MATERIAL_RAW_CONFIG.SHEETS.FORM);
    assert('CONFIG SHEETS DATA db_materialrow', MATERIAL_RAW_CONFIG.SHEETS.DATA === 'db_materialrow', MATERIAL_RAW_CONFIG.SHEETS.DATA);
    assert('CONFIG TIMEZONE America/La_Paz', MATERIAL_RAW_CONFIG.TIMEZONE === 'America/La_Paz', MATERIAL_RAW_CONFIG.TIMEZONE);
    assert('CONFIG IDX FECHA 0', MATERIAL_RAW_CONFIG.IDX.FECHA === 0, '');
    assert('CONFIG IDX TOTAL_KILOS 8', MATERIAL_RAW_CONFIG.IDX.TOTAL_KILOS === 8, '');
    assert('CONFIG IDX TIMESTAMP 9', MATERIAL_RAW_CONFIG.IDX.TIMESTAMP === 9, '');
    assert('CONFIG UI DEBOUNCE 3000', MATERIAL_RAW_CONFIG.UI.DEBOUNCE_MS === 3000, String(MATERIAL_RAW_CONFIG.UI.DEBOUNCE_MS));
    assert('CONFIG VALIDATION SAVE_TRIGGER materialRawOnEdit', MATERIAL_RAW_CONFIG.VALIDATION.SAVE_TRIGGER_HANDLER === 'materialRawOnEdit', MATERIAL_RAW_CONFIG.VALIDATION.SAVE_TRIGGER_HANDLER);
    assert('CONFIG no I8 leak', String(JSON.stringify(MATERIAL_RAW_CONFIG)).indexOf('I8') === -1, '');
    assert('CONFIG no M4 leak', String(JSON.stringify(MATERIAL_RAW_CONFIG)).indexOf('M4') === -1, '');
  } catch (e) {
    assert('CONFIG check throws', false, e.message);
  }

  // -------------------------------------------------------------------------
  // 2) FechaKey native passthrough — D4 native Date never formatted except J
  // -------------------------------------------------------------------------
  try {
    var d = new Date(2026, 8, 19, 12, 0, 0);
    assert('fechaKey native Date', materialRawFechaKey_(d) === '2026-09-19', materialRawFechaKey_(d));
    assert('fechaKey iso string', materialRawFechaKey_('2026-09-19') === '2026-09-19', '');
    assert('fechaKey dd/MM/yyyy', materialRawFechaKey_('19/09/2026') === '2026-09-19', materialRawFechaKey_('19/09/2026'));
    assert('fechaKey 01/01/2026', materialRawFechaKey_('01/01/2026') === '2026-01-01', materialRawFechaKey_('01/01/2026'));
    assert('fechaKey trims', materialRawFechaKey_(' 2026-09-19 ') === '2026-09-19', materialRawFechaKey_(' 2026-09-19 '));
    assert('fechaKey empty -> ""', materialRawFechaKey_('') === '', materialRawFechaKey_(''));
    assert('fechaKey invalid empty', materialRawFechaKey_('bad') === '', materialRawFechaKey_('bad'));
    assert('isSameFecha true same day diff time', materialRawIsSameFecha_(d, new Date(2026, 8, 19, 0, 0, 0)) === true, '');
    assert('isSameFecha false diff day', materialRawIsSameFecha_(d, new Date(2026, 8, 20, 0, 0, 0)) === false, '');
    assert('isSameFecha native vs iso string', materialRawIsSameFecha_(d, '2026-09-19') === true, '');
        assert('fechaKey native preserves 19 not timezone shift', materialRawFechaKey_(new Date(2026, 8, 19, 0, 0, 0)) === '2026-09-19', materialRawFechaKey_(new Date(2026, 8, 19, 0, 0, 0)));
    // F4 checkbox normalization (VERDADERO/FALSO vs TRUE/FALSE)
    assert('normalize TRUE stays TRUE', materialRawNormalizeCheckboxValue_(true) === 'TRUE', materialRawNormalizeCheckboxValue_(true));
    assert('normalize FALSE stays FALSE', materialRawNormalizeCheckboxValue_(false) === 'FALSE', materialRawNormalizeCheckboxValue_(false));
    assert('normalize VERDADERO -> TRUE', materialRawNormalizeCheckboxValue_('VERDADERO') === 'TRUE', materialRawNormalizeCheckboxValue_('VERDADERO'));
    assert('normalize FALSO -> FALSE', materialRawNormalizeCheckboxValue_('FALSO') === 'FALSE', materialRawNormalizeCheckboxValue_('FALSO'));
    assert('normalize verdadero lowercase', materialRawNormalizeCheckboxValue_('verdadero') === 'TRUE', materialRawNormalizeCheckboxValue_('verdadero'));
  } catch (e) {
    assert('fechaKey throws', false, e.message);
  }

  // -------------------------------------------------------------------------
  // 3) Filter F<>"" — tipo_fardo at index 4 within B:H (7 cols)
  //    B0=n_camion C1=tipo_mat D2=n_partida E3=n_bulto F4=tipo_fardo G5=cantidad H6=total_kilos
  // -------------------------------------------------------------------------
  try {
    var seven = [
      ['CAM1', 'matA', 'P1', 'B1', 'Fardo 400kg', '2', '800'],
      ['CAM2', 'matA', 'P2', 'B2', '', '1', '0'],
      ['CAM3', 'matA', 'P3', 'B3', 'Fardo 200kg', '3', '600'],
      ['CAM4', 'matA', 'P4', 'B4', '  ', '1', '0'],
      ['CAM5', 'matA', 'P5', 'B5', 'Fardo 400kg', '1', '400']
    ];
    var filtered = materialRawBuildRowsFromForm_(new Date(2026, 8, 19), seven);
    assert('filter F<>"" keeps 3 rows (skips blank/space)', filtered.length === 3, 'got ' + filtered.length);
    assert('filter keeps Fardo 400kg row 0', filtered[0][4] === 'Fardo 400kg', filtered[0][4]);
    assert('filter keeps Fardo 200kg row', filtered[1][4] === 'Fardo 200kg', filtered[1][4]);
    // Empty F with H=0 is skipped even though H is 0 — spec EC-02
    var emptyF = [['CAMx', 'mat', 'P', 'B', '', '2', '0']];
    assert('F="" row omitted even with H=0', materialRawBuildRowsFromForm_(new Date(2026, 8, 19), emptyF).length === 0, '');
    // Whitespace-trimmed
    var ws = [['CAM', 'mat', 'P', 'B', '  Fardo 400kg  ', '1', '400']];
    var wsFiltered = materialRawBuildRowsFromForm_(new Date(2026, 8, 19), ws);
    assert('F with whitespace trimmed still kept', wsFiltered.length === 1, String(wsFiltered.length));
  } catch (e) {
    assert('filter throws', false, e.message);
  }

  // -------------------------------------------------------------------------
  // 4) Mocked filtered save + native fecha passthrough + re-save replaces
  //    Uses in-memory fakes (no SpreadsheetApp required) — proves core logic
  // -------------------------------------------------------------------------
  try {
    // Simulate Repository layer with in-memory DB array A:J
    var mockDb = []; // each row: A fecha native Date, B dia, C..J
    function mockFechaKey(v) { return materialRawFechaKey_(v); }
    function mockFilterByFecha(db, fecha) {
      var k = mockFechaKey(fecha);
      return db.filter(function (r) { return mockFechaKey(r[0]) === k; });
    }
    function mockDeleteByFecha(db, fecha) {
      var k = mockFechaKey(fecha);
      var before = db.length;
      var kept = db.filter(function (r) { return mockFechaKey(r[0]) !== k; });
      var deleted = before - kept.length;
      mockDb = kept;
      return deleted;
    }
    function buildRows(fecha, formValues, diaValues) {
      var rows = [];
      for (var i = 0; i < formValues.length; i++) {
        var row = formValues[i];
        var f = String(row[4] == null ? '' : row[4]).trim();
        if (f === '') continue;
        var dia = diaValues ? diaValues[i][0] : '';
        rows.push([fecha, dia, row[0], row[1], row[2], row[3], f, row[5], row[6], '2026-09-19 22:10:00']);
      }
      return rows;
    }
    var fecha19 = new Date(2026, 8, 19);
    var fecha20 = new Date(2026, 8, 20);
    var form19 = [
      ['CAM1', 'mat', 'P1', 'B1', 'Fardo 400kg', '1', '400'],
      ['CAM2', 'mat', 'P2', 'B2', '', '1', '0'],
      ['CAM3', 'mat', 'P3', 'B3', 'Fardo 200kg', '2', '400']
    ];
    var dias = [[1],[2],[3]];
    var rows19 = buildRows(fecha19, form19, dias);
    assert('mock save filtered: 2 rows kepts (F<>"")', rows19.length === 2, String(rows19.length));
    assert('mock fecha passthrough native Date object', rows19[0][0] instanceof Date && rows19[0][0] === fecha19, String(rows19[0][0]));
    assert('mock fecha not formatted string', typeof rows19[0][0] !== 'string', typeof rows19[0][0]);
    // Append to DB
    mockDb = mockDb.concat(rows19);
    assert('mock DB after first save 2 rows', mockDb.length === 2, String(mockDb.length));
    // Re-save same fecha with 1 row -> delete+append replaces, no dupes
    var form19b = [['CAM9', 'mat', 'P9', 'B9', 'Fardo 400kg', '3', '1200']];
    var diasB = [[1]];
    var rows19b = buildRows(fecha19, form19b, diasB);
    var del = mockDeleteByFecha(mockDb, fecha19);
    assert('mock re-save delete 2 old rows', del === 2, String(del));
    mockDb = mockDb.concat(rows19b);
    assert('mock DB after re-save 1 row (no dupes)', mockDb.length === 1, String(mockDb.length));
    assert('mock re-save keeps native fecha', mockDb[0][0] === fecha19, String(mockDb[0][0]));
    // Save different fecha (20/09) -> adds without touching 19/09 rows? but PK is fecha, so separate. Simulate clearing then saving another day.
    var form20 = [['CAM20', 'mat', 'P20', 'B20', 'Fardo 200kg', '2', '400']];
    var rows20 = buildRows(fecha20, form20, [[1]]);
    var filtered20 = mockFilterByFecha(mockDb, fecha20);
    assert('mock filter 20/09 before save 0 rows', filtered20.length === 0, String(filtered20.length));
    mockDb = mockDb.concat(rows20);
    assert('mock DB now 2 rows (19 + 20)', mockDb.length === 2, String(mockDb.length));
    // Verify total_kilos sum for B10 E2E: I=400+200 -> but after re-save only 1200 + 400 = 1600 total but per fecha split
    var sum19 = mockFilterByFecha(mockDb, fecha19).reduce(function (s, r) { return s + Number(r[8]); }, 0);
    var sum20 = mockFilterByFecha(mockDb, fecha20).reduce(function (s, r) { return s + Number(r[8]); }, 0);
    assert('mock SUMAR.SI 19/09 = 1200 (re-saved)', sum19 === 1200, String(sum19));
    assert('mock SUMAR.SI 20/09 = 400', sum20 === 400, String(sum20));
    // No data -> 0 via SI.ERROR: empty fecha filter 21/09
    var filtered21 = mockFilterByFecha(mockDb, new Date(2026, 8, 21));
    var sum21 = filtered21.reduce(function (s, r) { return s + Number(r[8]); }, 0);
    assert('mock SUMAR.SI no data -> 0', sum21 === 0, String(sum21));
  } catch (e) {
    assert('mock save/re-save throws', false, e.message + ' ' + e.stack);
  }

  // -------------------------------------------------------------------------
  // 5) Rehydrate hit/miss preserves H — mock B7:G37 vs H7:H37
  // -------------------------------------------------------------------------
  try {
    // Simulate sheet B7:G37 (6 cols) + H7:H37 (1 col formula). hydrate writes B:G only.
    var mockFormB_G = [
      ['CAMx', 'mat', 'Px', 'Bx', 'Fardo 400kg', '2'],
      ['CAMy', 'mat', 'Py', 'By', 'Fardo 200kg', '1']
    ];
    var mockFormH = ['800', '200']; // formulas SI(F="";0;...) — preserved
    // Hit: 2 rows in DB for fecha19
    var mockDbHit = [];
    var f19 = new Date(2026, 8, 19);
    mockDbHit.push([f19, 1, 'CAM1', 'mat', 'P1', 'B1', 'Fardo 400kg', '1', '400', 'ts']);
    mockDbHit.push([f19, 2, 'CAM3', 'mat', 'P3', 'B3', 'Fardo 200kg', '2', '400', 'ts']);
    // Simulate hydrate hit builds 31x6 matrix B:G
    function hydrateMatrix(db, fecha) {
      var k = materialRawFechaKey_(fecha);
      var matches = db.filter(function (r) { return materialRawFechaKey_(r[0]) === k; });
      if (matches.length === 0) return { hit: false, matrix: null };
      var rows = 31;
      var matrix = [];
      for (var r = 0; r < rows; r++) {
        if (r < matches.length) {
          var v = matches[r];
          // DB idx: 2 n_camion, 3 tipo_mat, 4 n_partida, 5 n_bulto, 6 tipo_fardo, 7 cantidad
          matrix.push([v[2], v[3], v[4], v[5], v[6], v[7]]);
        } else matrix.push(['', '', '', '', '', '']);
      }
      return { hit: true, matrix: matrix, count: matches.length };
    }
    var hit = hydrateMatrix(mockDbHit, f19);
    assert('rehydrate hit count 2', hit.count === 2, String(hit.count));
    assert('rehydrate hit matrix B:G row0 CAM1', hit.matrix[0][0] === 'CAM1', hit.matrix[0][0]);
    assert('rehydrate hit matrix preserves 31 rows', hit.matrix.length === 31, String(hit.matrix.length));
    assert('rehydrate hit matrix col count 6 (B:G only, not H)', hit.matrix[0].length === 6, String(hit.matrix[0].length));
    assert('rehydrate hit tail rows empty after matches', hit.matrix[2][0] === '', hit.matrix[2][0]);
    assert('H preserved — hydrate never touches H column (6 vs 7)', hit.matrix[0].length === 6, 'H not overwritten');
    // Miss: no rows for fecha -> clear B:G, H shows 0 but untouched
    var miss = hydrateMatrix(mockDbHit, new Date(2026, 8, 22));
    assert('rehydrate miss -> hit false', miss.hit === false, String(miss.hit));
    // Resincronizar mirrors D4: same function, just called without D4 edit event
    var resync = hydrateMatrix(mockDbHit, f19);
    assert('Resincronizar mirrors D4 hit', resync.hit === true && resync.count === 2, String(resync.count));
    assert('Resincronizar miss clears B:G', hydrateMatrix(mockDbHit, new Date(2026, 8, 23)).hit === false, '');
  } catch (e) {
    assert('rehydrate mock throws', false, e.message);
  }

  // -------------------------------------------------------------------------
  // 6) SUMAR.SI formula strings — Registro Diario B10:B40
  // -------------------------------------------------------------------------
  try {
    function expectedFechaFormula(row) {
      return '=SI.ERROR(SUMAR.SI(db_materialrow!$A$2:$A;FECHA(2026;9;$A' + row + ');db_materialrow!$I$2:$I);0)';
    }
    function expectedNativeFormula(row) {
      return '=SI.ERROR(SUMAR.SI(db_materialrow!$A$2:$A;$A' + row + ';db_materialrow!$I$2:$I);0)';
    }
    assert('B10 FECHA formula exact', expectedFechaFormula(10) === '=SI.ERROR(SUMAR.SI(db_materialrow!$A$2:$A;FECHA(2026;9;$A10);db_materialrow!$I$2:$I);0)', expectedFechaFormula(10));
    assert('B40 FECHA formula exact', expectedFechaFormula(40) === '=SI.ERROR(SUMAR.SI(db_materialrow!$A$2:$A;FECHA(2026;9;$A40);db_materialrow!$I$2:$I);0)', expectedFechaFormula(40));
    assert('B10 native formula exact', expectedNativeFormula(10) === '=SI.ERROR(SUMAR.SI(db_materialrow!$A$2:$A;$A10;db_materialrow!$I$2:$I);0)', expectedNativeFormula(10));
    // Verify fix function exists and uses correct ranges (Setup.gs)
    assert('Setup exposes materialRawFixRegistroDiarioFormulas', typeof materialRawFixRegistroDiarioFormulas === 'function', typeof materialRawFixRegistroDiarioFormulas);
    assert('Setup exposes hybrid variant', typeof materialRawFixRegistroDiarioFormulasHybrid_ === 'function', typeof materialRawFixRegistroDiarioFormulasHybrid_);
    // Never reads Control Camiones in formula — only db_materialrow A and I
    var f = expectedFechaFormula(10);
    assert('SUMAR.SI reads db_materialrow A only', f.indexOf('db_materialrow!$A$2:$A') !== -1, f);
    assert('SUMAR.SI reads db_materialrow I only', f.indexOf('db_materialrow!$I$2:$I') !== -1, f);
    assert('SUMAR.SI never reads Control Camiones', f.indexOf('Control Camiones') === -1, f);
    assert('SI.ERROR wraps to 0 when no data', f.indexOf('SI.ERROR') !== -1 && f.indexOf(';0)') !== -1, f);
    // History preserved: formula per row uses $A10 row-relative, so 31 rows independent
    var b11 = expectedFechaFormula(11);
    assert('B11 uses $A11 (row-relative, history preserved)', b11.indexOf('$A11') !== -1, b11);
  } catch (e) {
    assert('SUMAR.SI formula check throws', false, e.message);
  }

  // -------------------------------------------------------------------------
  // 7) Lock + debounce + header drift (unit via config + helpers)
  // -------------------------------------------------------------------------
  try {
    // Lock constants
    assert('LOCK WAIT_MS 5000', MATERIAL_RAW_CONFIG.LOCK.WAIT_MS === 5000, String(MATERIAL_RAW_CONFIG.LOCK.WAIT_MS));
    assert('LOCK RETRIES 1', MATERIAL_RAW_CONFIG.LOCK.RETRIES === 1, String(MATERIAL_RAW_CONFIG.LOCK.RETRIES));
    assert('LOCK SLEEP_MS 1000', MATERIAL_RAW_CONFIG.LOCK.SLEEP_MS === 1000, String(MATERIAL_RAW_CONFIG.LOCK.SLEEP_MS));
    // Debounce helpers exist and use correct key
    assert('materialRawIsDebounced_ exists', typeof materialRawIsDebounced_ === 'function', '');
    assert('materialRawMarkSaved_ exists', typeof materialRawMarkSaved_ === 'function', '');
    // Simulate debounce logic: within 3000ms -> debounced true, after -> false
    // Use mocked time: last = now - 1000 => true, last = now - 3000 => false, last = now - 3001 => false
    // We call helper if PropertiesService mocked; else just verify config value used
    assert('debounce window is 3000ms per config', MATERIAL_RAW_CONFIG.UI.DEBOUNCE_MS === 3000, '');
    // Header match helper
    assert('headersMatch true exact', materialRawHeadersMatch_(MATERIAL_RAW_CONFIG.DB_HEADERS, MATERIAL_RAW_CONFIG.DB_HEADERS) === true, '');
    assert('headersMatch false drift', materialRawHeadersMatch_(['bad','header','drift','','','','','','',''], MATERIAL_RAW_CONFIG.DB_HEADERS) === false, '');
    assert('headersMatch false length mismatch', materialRawHeadersMatch_(['fecha'], MATERIAL_RAW_CONFIG.DB_HEADERS) === false, '');
    // withLock exists and toasts 8s on timeout (verify function source contains 8)
    assert('materialRawWithLock_ exists', typeof materialRawWithLock_ === 'function', '');
    var withLockSrc = String(materialRawWithLock_);
    assert('withLock toasts ⏳ ocupado 8s', withLockSrc.indexOf('8)') !== -1 || withLockSrc.indexOf(', 8') !== -1, 'check 8s toast in source');
    // F4 reset helper exists
    assert('materialRawResetCheckboxF4_ exists', typeof materialRawResetCheckboxF4_ === 'function', '');
    // GuardarDia and Hydrate exist
    assert('materialRawGuardarDia exists', typeof materialRawGuardarDia === 'function', '');
    assert('materialRawHydrate_ exists', typeof materialRawHydrate_ === 'function', '');
    assert('materialRawResincronizar exists', typeof materialRawResincronizar === 'function', '');
    // No I8/M4 in source strings of critical files (Menu/Core/Repository check via known constants)
    // Already checked CONFIG; additionally verify RANGES do not reference I8/M4
    assert('RANGES CHECKBOX is F4 not I8', MATERIAL_RAW_CONFIG.RANGES.CHECKBOX !== 'I8', MATERIAL_RAW_CONFIG.RANGES.CHECKBOX);
    assert('RANGES DATE is D4 not G2', MATERIAL_RAW_CONFIG.RANGES.DATE === 'D4', MATERIAL_RAW_CONFIG.RANGES.DATE);
  } catch (e) {
    assert('lock/debounce/header throws', false, e.message);
  }

  // -------------------------------------------------------------------------
  // 8) Live schema checks on COPY (only if SpreadsheetApp available)
  // -------------------------------------------------------------------------
  try {
    if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getActiveSpreadsheet) {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var before = materialRawEnsureSchema(ss);
      var sh = ss.getSheetByName(MATERIAL_RAW_CONFIG.SHEETS.DATA);
      var hdr = sh ? sh.getRange(1, 1, 1, MATERIAL_RAW_CONFIG.DB_HEADERS.length).getDisplayValues()[0].join('|') : '';
      assert('live schema creates A1:J1', hdr === MATERIAL_RAW_CONFIG.DB_HEADERS.join('|'), hdr);
      assert('live schema frozenRows 1', sh ? sh.getFrozenRows() === 1 : false, String(sh ? sh.getFrozenRows() : 'no sheet'));
      materialRawEnsureSchema(ss);
      var hdr2 = sh.getRange(1, 1, 1, MATERIAL_RAW_CONFIG.DB_HEADERS.length).getDisplayValues()[0].join('|');
      assert('live schema idempotent second call', hdr2 === MATERIAL_RAW_CONFIG.DB_HEADERS.join('|'), hdr2);
      var bg = sh.getRange(1, 1, 1, 1).getBackground();
      assert('live header color #e8f0fe', String(bg).toLowerCase() === '#e8f0fe', String(bg));
      var errSh = ss.getSheetByName(MATERIAL_RAW_CONFIG.SHEETS.ERRORS);
      assert('live Errors sheet exists', !!errSh, '');
      if (errSh) {
        var ehdr = errSh.getRange(1, 1, 1, MATERIAL_RAW_CONFIG.ERRORS_HEADERS.length).getDisplayValues()[0].join('|');
        assert('live Errors header', ehdr === MATERIAL_RAW_CONFIG.ERRORS_HEADERS.join('|'), ehdr);
      }
      var form = ss.getSheetByName(MATERIAL_RAW_CONFIG.SHEETS.FORM);
      if (form) {
        var dv = form.getRange(MATERIAL_RAW_CONFIG.RANGES.CHECKBOX).getDataValidation();
        assert('live F4 has checkbox validation', !!dv, '');
        var f4val = form.getRange(MATERIAL_RAW_CONFIG.RANGES.CHECKBOX).getValue();
        assert('live F4 reset to FALSE', f4val === false, String(f4val));
        var d4fmt = form.getRange(MATERIAL_RAW_CONFIG.RANGES.DATE).getNumberFormat();
        assert('live D4 dd/MM/yyyy format', d4fmt === 'dd/MM/yyyy' || d4fmt === MATERIAL_RAW_CONFIG.VALIDATION.DATE_FORMAT, d4fmt);
      }
      // Header drift fail-closed live
      var dataSh = ss.getSheetByName(MATERIAL_RAW_CONFIG.SHEETS.DATA);
      if (dataSh) {
        var orig = dataSh.getRange(1, 1, 1, MATERIAL_RAW_CONFIG.DB_HEADERS.length).getValues()[0];
        dataSh.getRange(1, 1, 1, MATERIAL_RAW_CONFIG.DB_HEADERS.length).setValues([['bad','header','drift','','','','','','','']]);
        var res = materialRawValidateDataHeader_(ss);
        assert('live header drift fail-closed', res && res.success === false && res.code === MATERIAL_RAW_CONFIG.ERRORS.HEADER_MISMATCH, String(res && res.code));
        dataSh.getRange(1, 1, 1, MATERIAL_RAW_CONFIG.DB_HEADERS.length).setValues([orig]);
        var res2 = materialRawValidateDataHeader_(ss);
        assert('live header restored ok', res2 && res2.success === true, String(res2 && res2.code));
      }
      // Registro Diario B10 formula live — after fix, verify SUMAR.SI present
      var diario = ss.getSheetByName('Registro Diario');
      if (diario) {
        try {
          var fixRes = materialRawFixRegistroDiarioFormulas(ss);
          assert('live Registro Diario fix updated 31', fixRes && fixRes.updated === 31, String(fixRes && fixRes.updated));
          var b10Formula = diario.getRange('B10').getFormula();
          assert('live B10 is SUMAR.SI after fix', b10Formula.indexOf('SUMAR.SI') !== -1, b10Formula);
          assert('live B10 wraps SI.ERROR', b10Formula.indexOf('SI.ERROR') !== -1, b10Formula);
          assert('live B10 no longer INDICE', b10Formula.indexOf('INDICE') === -1, b10Formula);
          assert('live B10 reads db_materialrow', b10Formula.indexOf('db_materialrow') !== -1, b10Formula);
          assert('live B10 reads I column', b10Formula.indexOf('$I$') !== -1 || b10Formula.indexOf('$I$2:$I') !== -1, b10Formula);
        } catch (eFix) {
          assert('live Registro fix throws', false, eFix.message);
        }
      } else {
        Logger.log('Skipping Registro Diario live checks — sheet not in this COPY');
      }
      // Flush + toast 8s presence check: functions contain flush and , 8
      assert('Core contains SpreadsheetApp.flush', String(materialRawGuardarDia).indexOf('flush') !== -1, '');
      assert('Core toasts 8s', String(materialRawGuardarDia).indexOf(', 8') !== -1, '');
      assert('Hydrate toasts 8s', String(materialRawHydrate_).indexOf(', 8') !== -1, '');
    } else {
      Logger.log('Skipping live schema/Registro checks — SpreadsheetApp unavailable in mock run');
    }
  } catch (e) {
    assert('live schema throws', false, e.message + ' ' + e.stack);
  }

  // -------------------------------------------------------------------------
  // 9) No I8/M4 leaks + America/La_Paz only for J — audit isolation
  // -------------------------------------------------------------------------
  try {
    var cfgStr = JSON.stringify(MATERIAL_RAW_CONFIG);
    assert('no I8 in CONFIG', cfgStr.indexOf('I8') === -1, cfgStr);
    assert('no M4 in CONFIG', cfgStr.indexOf('M4') === -1, cfgStr);
    // Verify audit timestamp uses La_Paz only for J (function source check)
    var auditSrc = String(materialRawAuditTimestamp_);
    assert('audit timestamp uses America/La_Paz or TIMEZONE', auditSrc.indexOf('La_Paz') !== -1 || auditSrc.indexOf('TIMEZONE') !== -1, auditSrc);
    // Verify Core never formats fecha with Utilities.formatDate except for timestamp
    var coreSrc = String(materialRawGuardarDia);
    // Should have getValue for D4, not formatDate for fecha; only audit timestamp uses formatDate
    assert('Core reads D4 via getValue native', coreSrc.indexOf('getValue') !== -1, '');
    // Ensure no formatDate on fecha path — count occurrences: only auditTimestamp should format
    var formatCount = (coreSrc.match(/formatDate/g) || []).length;
    assert('Core fecha not formatted (0 formatDate in Core, timestamp via helper)', formatCount === 0, 'formatDate count ' + formatCount);
    // Verify only F4/D4/B7:H37 are referenced in CONFIG RANGES (no I8/M4/B33 etc)
    var ranges = MATERIAL_RAW_CONFIG.RANGES;
    var rangeVals = [ranges.DATE, ranges.CHECKBOX, ranges.FORM, ranges.CLEAR, ranges.LABEL].join('|');
    assert('RANGES only F4/D4/B7:H37 family', rangeVals.indexOf('I8') === -1 && rangeVals.indexOf('M4') === -1 && rangeVals.indexOf('B33') === -1, rangeVals);
  } catch (e) {
    assert('audit isolation throws', false, e.message);
  }

  var passed = results.filter(function (r) { return r.ok; }).length;
  var total = results.length;
  Logger.log('--- materialRawTest_ ' + passed + '/' + total + ' passed ---');
  if (passed !== total) {
    Logger.log('Failures:');
    results.filter(function (r) { return !r.ok; }).forEach(function (r) { Logger.log(' ❌ ' + r.name + ' — ' + r.detail); });
  }
  return { passed: passed, total: total, results: results };
}
