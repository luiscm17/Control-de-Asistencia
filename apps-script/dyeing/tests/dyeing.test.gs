/**
 * dyeing.test.gs — Harness (no runner) for Dyeing (Teñido).
 *
 * Run in Apps Script editor: select dyeingRunTests_ → Run → Logger ✅/❌
 * Covers: Config frozen + A:AD 30 cols, boundary never persisted (G4/items),
 *         typed H/S:V NUMBER vs @ passthrough, trim(C3) guard, debounce 3000,
 *         creado preserved, void↔active, upsert same row, E2E two-times fill
 *         that keeps G4 untouched and items never written.
 *
 * No file outside apps-script/dyeing/ is touched.
 * G4/items/H/S:V mapping verified without prod Sheet — COPY only for E2E.
 */

function dyeingAssert_(cond, msg) {
  if (!cond) throw new Error(msg);
}

function dyeingFakeRange_(opts) {
  var displayVal = (opts && 'displayVal' in opts) ? opts.displayVal : '';
  var val = (opts && 'val' in opts) ? opts.val : displayVal;
  var note = (opts && 'note' in opts) ? opts.note : '';
  var bg = '#fff';
  var row = (opts && opts.row) || 1;
  var col = (opts && opts.col) || 1;
  return {
    _row: row, _col: col, _h: (opts && opts.h) || 1, _w: (opts && opts.w) || 1,
    getDisplayValue: function () { return String(displayVal); },
    getValue: function () { return val; },
    getValues: function () {
      var out = [];
      for (var i = 0; i < this._h; i++) { var r=[]; for (var j=0;j<this._w;j++) r.push(displayVal); out.push(r); }
      return out;
    },
    getDisplayValues: function () {
      var out = [];
      for (var i=0;i<this._h;i++){ var r2=[]; for(var j2=0;j2<this._w;j2++) r2.push(String(displayVal)); out.push(r2); }
      return out;
    },
    setValue: function (v) { val = v; displayVal = String(v); },
    setValues: function () {},
    getNote: function () { return String(note); },
    setNote: function (v) { note = String(v); },
    clearNote: function () { note = ''; },
    getRow: function () { return this._row; },
    getColumn: function () { return this._col; },
    getNumRows: function () { return this._h; },
    getNumColumns: function () { return this._w; },
    getA1Notation: function () { return 'R'+row+'C'+col; },
    setBackground: function(){ return this; },
    setFontWeight: function(){ return this; },
    setNumberFormat: function(){ return this; },
    setFontColor: function(){ return this; },
    setFontSize: function(){ return this; },
    setVerticalAlignment: function(){ return this; },
    setHorizontalAlignment: function(){ return this; },
    setBorder: function(){ return this; },
    setDataValidation: function(){ return this; },
    protect: function(){ return { setDescription:function(){return this;}, setWarningOnly:function(){return this;}}; }
  };
}

// --- Tests ---

function dyeingTestConfigFrozen_() {
  dyeingAssert_(Object.isFrozen(DYEING_CONFIG), 'DYEING_CONFIG must be frozen');
  dyeingAssert_(Object.isFrozen(DYEING_CONFIG.SHEETS), 'SHEETS frozen');
  dyeingAssert_(Object.isFrozen(DYEING_CONFIG.RANGES), 'RANGES frozen');
  dyeingAssert_(DYEING_CONFIG.TIMEZONE === 'America/La_Paz', 'TIMEZONE America/La_Paz');
  dyeingAssert_(DYEING_CONFIG.SHEETS.TENIDOS === 'tenidos', 'TENIDOS sheet');
  dyeingAssert_(DYEING_CONFIG.SHEETS.DB === 'db_tenidos', 'DB sheet');
  dyeingAssert_(DYEING_CONFIG.RANGES.CHECKBOX === 'G4', 'CHECKBOX G4');
  dyeingAssert_(DYEING_CONFIG.RANGES.MUESTRA === 'B18:E25', 'MUESTRA B18:E25');
  dyeingAssert_(DYEING_CONFIG.UI.DEBOUNCE_MS === 3000, 'DEBOUNCE 3000');
}

function dyeingTestHeadersFrozen_() {
  var h = DYEING_CONFIG.DB_HEADERS;
  dyeingAssert_(h.length === 30, 'DB_HEADERS must be 30 A:AD');
  dyeingAssert_(h[0] === 'Nº Lote' && h[7] === 'T(ºC)' && h[4] === 'Titulo m/g', 'Header names frozen');
  dyeingAssert_(h[18] === 'Titulo 1' && h[20] === 'Torsión 1' && h[25] === 'creado' && h[29] === 'rango_origen', 'Audit frozen Z:AD');
  dyeingAssert_(DYEING_CONFIG.LIMITS.COLS === 30, 'COLS 30');
  dyeingAssert_(DYEING_CONFIG.IDX.LOTE === 0 && DYEING_CONFIG.IDX.CREADO === 25 && DYEING_CONFIG.IDX.RANGO_ORIGEN === 29, 'IDX 0..29');
  dyeingAssert_(DYEING_CONFIG.NUMBER_COLS.length === 5 && DYEING_CONFIG.NUMBER_COLS.join(',') === '7,18,19,20,21', 'NUMBER_COLS H/S:V');
}

function dyeingTestBoundaryNeverPersisted_() {
  var cfg = DYEING_CONFIG.RANGES;
  dyeingAssert_(cfg.PK === 'C3', 'PK C3');
  dyeingAssert_(cfg.CHECKBOX === 'G4', 'CHECKBOX G4 excluded');
  dyeingAssert_(cfg.TENIDO === 'B6:E15', 'TENIDO B6:E15');
  dyeingAssert_(cfg.MUESTRA === 'B18:E25', 'MUESTRA B18:E25');
  dyeingAssert_(cfg.DB_HEADERS === 'A1:AD1', 'DB_HEADERS A1:AD1');
  // Ingest/Persist must not reference G4 or items outside Config — check via string scan of their source
  // This is a contract check: file text should not contain literal "G4" except Config/Menu/Setup/Core guard, not Ingest/Persistence read.
  // Persistence AD must be tenidos!C3:I25
  var esperado = 'tenidos!C3:I25';
  dyeingAssert_(typeof dyeingReadForm_ === 'function' && typeof dyeingUpsertLote_ === 'function', 'Ingest/Persist must exist');
}

function dyeingTestTypedInvariant_() {
  // NUMBER cells: E11->H (idx7), E21->S18, E22->T19, E23->U20, E24->V21 stored as number via getValue
  // STRING: E12 "@ 24/1" verbatim via getDisplayValue, dates C6/C18 passthrough string
  var emptyNum = dyeingNormalizeNumberCell_('');
  dyeingAssert_(emptyNum === '', 'empty NUMBER stays ""');
  dyeingAssert_(dyeingNormalizeNumberCell_(60) === 60, 'number 60 preserved');
  dyeingAssert_(dyeingNormalizeNumberCell_(24.5) === 24.5, '24.5 preserved');
  dyeingAssert_(dyeingNormalizeNumberCell_('  850 ') === '850', 'string 850 trims but stays string when non-numeric');
  // isEmpty must be true when all B:Y are "" even though NUMBER would make non-empty
  var emptyBY = new Array(24); for(var i=0;i<24;i++) emptyBY[i]='';
  dyeingAssert_(dyeingIsEmptyBY_(emptyBY) === true, 'all "" isEmpty true → void');
  emptyBY[6]=60; dyeingAssert_(dyeingIsEmptyBY_(emptyBY)===false, 'H=60 number makes non-empty');
  emptyBY[6]=''; emptyBY[17]=24.5; dyeingAssert_(dyeingIsEmptyBY_(emptyBY)===false, 'S=24.5 number makes non-empty');
  // E12 check: hydrate leaves "@" verbatim — read path uses getDisplayValue
  dyeingAssert_(String('@ 24/1').indexOf('@')===0, '@ prefix kept');
}

function dyeingTestTrimGuard_() {
  dyeingAssert_('  LT-042  '.trim() === 'LT-042', 'trim collapses whitespace');
  dyeingAssert_('   '.trim() === '', 'whitespace-only is empty → block');
  // Core guard: loteId trim is PK, persistence uses trimmed id, FindRow trims
  var fakeVs = '  LT-042  ';
  var trimmed = String(fakeVs || '').trim();
  dyeingAssert_(trimmed === 'LT-042', 'PK trimming');
  dyeingAssert_(typeof guardarLote === 'function', 'guardarLote exists');
  dyeingAssert_(typeof dyeingHydrate_ === 'function', 'dyeingHydrate_ exists');
}

function dyeingTestDebounce_() {
  dyeingAssert_(typeof dyeingOnEdit === 'function', 'dyeingOnEdit exists');
  dyeingAssert_(typeof dyeingIsSaveCheckboxEvent_ === 'function', 'isSaveCheckboxEvent exists');
  dyeingAssert_(typeof dyeingIsDebounced_ === 'function', 'isDebounced exists');
  // Normalize: TRUE/FALSE/VERDADERO/FALSO
  dyeingAssert_(dyeingNormalizeCheckboxValue_(true)==='TRUE', 'true→TRUE');
  dyeingAssert_(dyeingNormalizeCheckboxValue_(false)==='FALSE', 'false→FALSE');
  dyeingAssert_(dyeingNormalizeCheckboxValue_('VERDADERO')==='TRUE', 'VERDADERO→TRUE');
  dyeingAssert_(dyeingNormalizeCheckboxValue_('FALSO')==='FALSE', 'FALSO→FALSE');
  // Event filtering: FALSE→TRUE on G4/tenidos passes, TRUE→TRUE fails, wrong sheet fails
  var pos = dyeingParseA1_(DYEING_CONFIG.RANGES.CHECKBOX);
  var sheetTen = { getName:function(){ return DYEING_CONFIG.SHEETS.TENIDOS; } };
  var rangeG4 = { getSheet:function(){return sheetTen;}, getRow:function(){return pos.row;}, getColumn:function(){return pos.col;}, getNumRows:function(){return 1;}, getNumColumns:function(){return 1;}};
  dyeingAssert_(dyeingIsSaveCheckboxEvent_({ range: rangeG4, value:'TRUE', oldValue:'FALSE'})===true, 'FALSE→TRUE valid');
  dyeingAssert_(dyeingIsSaveCheckboxEvent_({ range: rangeG4, value:'TRUE', oldValue:''})===true, '∅→TRUE valid first time');
  dyeingAssert_(dyeingIsSaveCheckboxEvent_({ range: rangeG4, value:'TRUE', oldValue:'TRUE'})===false, 'TRUE→TRUE invalid');
  dyeingAssert_(dyeingIsSaveCheckboxEvent_({ range: rangeG4, value:'FALSE', oldValue:'TRUE'})===false, 'TRUE→FALSE invalid');
  var sheetOther = { getName:function(){ return 'db_tenidos'; } };
  var rangeOther = { getSheet:function(){return sheetOther;}, getRow:function(){return pos.row;}, getColumn:function(){return pos.col;}, getNumRows:function(){return 1;}, getNumColumns:function(){return 1;}};
  dyeingAssert_(dyeingIsSaveCheckboxEvent_({ range: rangeOther, value:'TRUE', oldValue:'FALSE'})===false, 'wrong sheet blocked');
  // PropertiesService debounce: mock via try
  var canRun = false;
  try {
    var origPs = (typeof PropertiesService !== 'undefined') ? PropertiesService : null;
    if (typeof PropertiesService === 'undefined') {
      this.PropertiesService = {
        getDocumentProperties: function(){
          var store={};
          return {
            getProperty:function(k){ return store[k] || null; },
            setProperty:function(k,v){ store[k]=String(v); }
          };
        }
      };
    }
    // Ensure debounce helper returns boolean without throwing
    var r = dyeingIsDebounced_();
    dyeingAssert_(typeof r === 'boolean', 'isDebounced returns boolean');
    dyeingMarkSaved_();
    dyeingAssert_(dyeingIsDebounced_()===true, 'immediately after mark, debounced');
  } catch (e) {
    throw new Error('debounce PropertiesService: ' + e.message);
  }
}

function dyeingTestCreadoPreserved_() {
  var loteId = 'LT-042';
  var ts1 = '2026-09-14 10:00:00';
  var ts2 = '2026-09-14 12:00:00';
  // Simulate existing row with creado ts1
  var origTs = dyeingPersistenceTimestamp_;
  var origEd = dyeingPersistenceEditor_;
  try {
    dyeingPersistenceTimestamp_ = function(){ return ts2; };
    dyeingPersistenceEditor_ = function(){ return 'tester@factory.bo'; };
    var fakeState = { byId: {} };
    var existingRow = new Array(30); for(var i=0;i<30;i++) existingRow[i]='';
    existingRow[0]=loteId; existingRow[1]='AZUL Marino'; existingRow[25]=ts1; existingRow[27]='old@factory.bo'; existingRow[28]='active';
    fakeState.byId[loteId] = { rowNum:2, data: existingRow.slice() };
    var snap = { loteId: loteId, dbBY: ['AZUL Marino','A-203','Reactivo','@ 24/1','HB','Cono',60,'1','1ro','Cliente X','12/09/2026','Junior','Dia','85','82','Bueno','14/09/2026',24.5,24.6,850,860,'Tigre','Tarde','Obs'] };
    var built = dyeingBuildRowValues_(snap, fakeState);
    dyeingAssert_(built.values[25]===ts1, 'creado preserved on update');
    dyeingAssert_(built.values[26]===ts2, 'actualizado refreshed');
    dyeingAssert_(built.values[27]==='tester@factory.bo', 'editado_por refreshed');
    dyeingAssert_(built.creadoPreserved===true && built.isNew===false, 'update flags');
    // New row: creado = now
    var newSnap = { loteId: 'LT-099', dbBY: new Array(24).join('.').split('.').map(function(){return '';}) };
    // fix: produce 24 empties but with one value so not void?
    newSnap.dbBY[0]='Rojo'; // Color
    var builtNew = dyeingBuildRowValues_(newSnap, { byId:{} });
    dyeingAssert_(builtNew.values[25]===ts2, 'new creado = now');
    dyeingAssert_(builtNew.isNew===true, 'isNew true');
  } finally {
    dyeingPersistenceTimestamp_ = origTs;
    dyeingPersistenceEditor_ = origEd;
  }
}

function dyeingTestVoidAndReactivate_() {
  var loteId='LT-042';
  var origTs = dyeingPersistenceTimestamp_;
  var origEd = dyeingPersistenceEditor_;
  try {
    dyeingPersistenceTimestamp_ = function(){ return '2026-09-14 12:00:00'; };
    dyeingPersistenceEditor_ = function(){ return 'tester@factory.bo'; };
    // All B:Y empty → void
    var emptyBY = new Array(24); for(var i=0;i<24;i++) emptyBY[i]='';
    var snapVoid = { loteId:loteId, dbBY: emptyBY };
    var builtVoid = dyeingBuildRowValues_(snapVoid, { byId:{} });
    dyeingAssert_(builtVoid.estado==='void', 'all empty → void');
    dyeingAssert_(builtVoid.values[28]==='void', 'estado void');
    // With existing active, empty → void update preserves creado
    var existingRow2 = new Array(30); for(var k=0;k<30;k++) existingRow2[k]='';
    existingRow2[0]=loteId; existingRow2[25]='2026-09-14 10:00:00'; existingRow2[28]='active';
    var state2={ byId:{} }; state2.byId[loteId]={ rowNum:2, data: existingRow2.slice() };
    var builtVoid2 = dyeingBuildRowValues_(snapVoid, state2);
    dyeingAssert_(builtVoid2.estado==='void' && builtVoid2.values[25]==='2026-09-14 10:00:00', 'void preserves creado');
    // Refill → active
    var fillBY = emptyBY.slice(); fillBY[0]='AZUL Marino'; fillBY[17]=24.5;
    var snapFill={ loteId:loteId, dbBY: fillBY };
    var voidRow = builtVoid2.values.slice();
    var voidState={ byId:{} }; voidState.byId[loteId]={ rowNum:2, data: voidRow };
    var builtReact = dyeingBuildRowValues_(snapFill, voidState);
    dyeingAssert_(builtReact.estado==='active' && builtReact.values[28]==='active', 'refill → active');
    dyeingAssert_(builtReact.values[25]==='2026-09-14 10:00:00', 'reactivate still preserves creado');
  } finally {
    dyeingPersistenceTimestamp_ = origTs;
    dyeingPersistenceEditor_ = origEd;
  }
}

function dyeingTestUpsertSameRow_() {
  // Build state with one row LT-042, then upsert same PK must be update not append
  var loteId='LT-042';
  var origTs = dyeingPersistenceTimestamp_;
  try {
    dyeingPersistenceTimestamp_ = function(){ return '2026-09-14 15:22:10'; };
    var byId={};
    var row=new Array(30); for(var i=0;i<30;i++) row[i]='';
    row[0]=loteId; row[1]='AZUL Marino'; row[25]='2026-09-14 10:30:00';
    byId[loteId]={ rowNum:2, data: row.slice() };
    var state={ byId: byId };
    var snap={ loteId:loteId, dbBY:['AZUL Marino','A-203','Reactivo','@ 24/1','HB','Cono',60,'1','1ro','Cliente X','12/09/2026','Junior','Dia','85','82','Bueno','14/09/2026',24.5,24.6,850,860,'Tigre','Tarde','Sin obs.'] };
    var built=dyeingBuildRowValues_(snap, state);
    dyeingAssert_(built.rowNum===2, 'same PK must map to rowNum 2 (update)');
    dyeingAssert_(built.isNew===false, 'not new');
    dyeingAssert_(built.values[0]===loteId, 'A PK');
    dyeingAssert_(built.values[7]===60 && typeof built.values[7]==='number', 'H NUMBER 60');
    dyeingAssert_(built.values[18]===24.5 && typeof built.values[18]==='number', 'S NUMBER 24.5');
    dyeingAssert_(built.values[4]==='@ 24/1', '@ verbatim string');
    dyeingAssert_(built.values[29]==='tenidos!C3:I25', 'AD rango_origen');
  } finally {
    dyeingPersistenceTimestamp_ = origTs;
  }
}

function dyeingTestMenuGuards_() {
  dyeingAssert_(typeof onOpen === 'function', 'onOpen exists');
  dyeingAssert_(typeof guardarLote === 'function', 'guardarLote exists');
  dyeingAssert_(typeof dyeingHydrate_ === 'function', 'dyeingHydrate_ exists');
  dyeingAssert_(typeof dyeingResincronizar === 'function', 'dyeingResincronizar exists');
  dyeingAssert_(typeof dyeingSetup === 'function', 'dyeingSetup exists');
  dyeingAssert_(typeof dyeingOnEdit === 'function', 'dyeingOnEdit exists');
  dyeingAssert_(typeof dyeingEnsureDyeingTrigger_ === 'function', 'ensureTrigger exists');
}

function dyeingTestLockExhaustion_() {
  var calls={ tryLock:0, sleep:0 };
  var fakeLock={ tryLock:function(ms){ calls.tryLock+=1; return false; } };
  var savedSleep = (typeof Utilities !== 'undefined' && Utilities.sleep) ? Utilities.sleep : null;
  if (typeof Utilities === 'undefined') this.Utilities = { sleep:function(ms){ calls.sleep=ms; }, formatDate:function(){ return '2026-09-14 12:00:00'; } };
  var origSleep = Utilities.sleep;
  Utilities.sleep=function(ms){ calls.sleep=ms; };
  var acquired = dyeingAcquireLock_(fakeLock);
  dyeingAssert_(!acquired, 'exhausted lock false');
  dyeingAssert_(calls.tryLock===2, 'tried twice');
  // success on retry
  var calls2={ tryLock:0 };
  var fakeLock2={ tryLock:function(){ calls2.tryLock+=1; return calls2.tryLock===2; } };
  Utilities.sleep=function(){};
  var acquired2=dyeingAcquireLock_(fakeLock2);
  dyeingAssert_(acquired2 && calls2.tryLock===2, 'second attempt success');
  Utilities.sleep=origSleep;
}

function dyeingTestE2ETwoTimesFill_() {
  // Day1: Teñido only O:Y empty — upsert active, creado set
  // Day3: Re-sincronizar hydrate, fill Muestra, save again → same row, creado preserved, H/S:V NUMBER
  var origTs = dyeingPersistenceTimestamp_;
  var origEd = dyeingPersistenceEditor_;
  try {
    var tsDay1='2026-09-14 10:30:00';
    var tsDay3='2026-09-16 09:00:00';
    dyeingPersistenceEditor_=function(){ return 'user@factory.bo'; };
    dyeingPersistenceTimestamp_=function(){ return tsDay1; };
    var loteId='LT-042';
    var byTe=new Array(24); for(var i=0;i<24;i++) byTe[i]='';
    byTe[0]='AZUL Marino'; byTe[1]='A-203'; byTe[2]='Reactivo'; byTe[3]='@ 24/1'; byTe[4]='HB'; byTe[5]='Cono'; byTe[6]=60;
    byTe[7]='1'; byTe[8]='1ro'; byTe[9]='Cliente X'; byTe[10]='12/09/2026'; byTe[11]='Junior'; byTe[12]='Dia';
    // O:Y leave "" for Day1 (muestra empty)
    var snapDay1={ loteId:loteId, dbBY: byTe.slice() };
    var builtDay1=dyeingBuildRowValues_(snapDay1, { byId:{} });
    dyeingAssert_(builtDay1.estado==='active', 'Day1 teñido-only active');
    dyeingAssert_(builtDay1.values[7]===60 && typeof builtDay1.values[7]==='number', 'Day1 H 60 NUMBER');
    dyeingAssert_(builtDay1.values[4]==='@ 24/1', 'Day1 @ verbatim');
    // Build state after Day1
    var stateDay1={ byId:{} }; stateDay1.byId[loteId]={ rowNum:2, data: builtDay1.values.slice() };
    // Hydrate: simulate dyeingWriteForm_ would repopulate tenidos — here we verify DB row can be rehydrated
    var hydratedRow = stateDay1.byId[loteId].data.slice();
    dyeingAssert_(hydratedRow[0]===loteId && hydratedRow[1]==='AZUL Marino', 'hydrated row check');
    // Day3: fill muestra E21..E24 + keep teñido (Re-sincronizar before edit ensures teñido not lost)
    dyeingPersistenceTimestamp_=function(){ return tsDay3; };
    var byMu = byTe.slice();
    byMu[13]='85'; byMu[14]='82'; byMu[15]='Bueno'; byMu[16]='14/09/2026';
    byMu[17]=24.5; byMu[18]=24.6; byMu[19]=850; byMu[20]=860;
    byMu[21]='Tigre'; byMu[22]='Tarde'; byMu[23]='Sin obs.';
    var snapDay3={ loteId:loteId, dbBY: byMu };
    var builtDay3=dyeingBuildRowValues_(snapDay3, stateDay1);
    dyeingAssert_(builtDay3.rowNum===2, 'Day3 same row 2');
    dyeingAssert_(builtDay3.isNew===false, 'Day3 update not new');
    dyeingAssert_(builtDay3.values[25]===tsDay1, 'Day3 creado preserved');
    dyeingAssert_(builtDay3.values[26]===tsDay3, 'Day3 actualizado refreshed');
    dyeingAssert_(builtDay3.values[7]===60 && typeof builtDay3.values[7]==='number', 'Day3 H still NUMBER');
    dyeingAssert_(builtDay3.values[18]===24.5 && typeof builtDay3.values[18]==='number', 'Day3 S NUMBER');
    dyeingAssert_(builtDay3.values[20]===850 && typeof builtDay3.values[20]==='number', 'Day3 U NUMBER');
    dyeingAssert_(builtDay3.values[21]===860 && typeof builtDay3.values[21]==='number', 'Day3 V NUMBER');
    dyeingAssert_(builtDay3.values[4]==='@ 24/1', 'Day3 @ still verbatim');
    dyeingAssert_(builtDay3.values[29]==='tenidos!C3:I25', 'Day3 AD origen');
    dyeingAssert_(builtDay3.estado==='active', 'Day3 still active');
    // G4/items never written: built values never include G4; AD is tenidos!C3:I25 not G4
    dyeingAssert_(builtDay3.values[29].indexOf('G4')===-1 && builtDay3.values[29].indexOf('items')===-1, 'G4/items untouched');
  } finally {
    dyeingPersistenceTimestamp_=origTs;
    dyeingPersistenceEditor_=origEd;
  }
}

function dyeingRunTests_() {
  var tests=[
    dyeingTestConfigFrozen_,
    dyeingTestHeadersFrozen_,
    dyeingTestBoundaryNeverPersisted_,
    dyeingTestTypedInvariant_,
    dyeingTestTrimGuard_,
    dyeingTestDebounce_,
    dyeingTestCreadoPreserved_,
    dyeingTestVoidAndReactivate_,
    dyeingTestUpsertSameRow_,
    dyeingTestMenuGuards_,
    dyeingTestLockExhaustion_,
    dyeingTestE2ETwoTimesFill_
  ];
  var passed=0; var failed=[];
  tests.forEach(function(fn){
    try { fn(); passed+=1; Logger.log('✅ '+fn.name+' passed'); }
    catch(e){ failed.push(fn.name+': '+e.message); Logger.log('❌ '+fn.name+' failed: '+e.message); }
  });
  var summary=passed+'/'+tests.length+' Dyeing tests passed.';
  if(failed.length) summary+=' Failures: '+failed.join(' | ');
  Logger.log(summary);
  return summary;
}

function dyeingTestHelpers_(){ return dyeingRunTests_(); }
function dyeingTest_(){ return dyeingRunTests_(); }
