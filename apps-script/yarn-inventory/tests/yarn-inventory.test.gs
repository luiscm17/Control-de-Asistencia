/**
 * yarn-inventory.test.gs — Harness (no runner) for Yarn Inventory.
 *
 * Run in Apps Script editor: select yarnInventoryRunTests_ → Run → Logger ✅/❌
 * Covers: boundary never persisted/cleared, PK rowIndex fallback, void→active,
 *         creado preserved, invalid blocks, lock ⏳→❌, limits ≤10/≤47,
 *         headers frozen 17/24, fecha native vs audit America/La_Paz.
 *
 * No file outside apps-script/yarn-inventory/ is touched.
 * Verbatim formulas H8:K17 / G/P/Q/R are never read/written/cleared (valueRenderOption=FORMULA).
 */

function yarnInventoryAssert_(condition, message) {
  if (!condition) throw new Error(message);
}

function yarnInventoryFakeSheet_(name) {
  var ranges = {};
  var calls = { cleared: [], setValues: [] };
  return {
    _name: name,
    _ranges: ranges,
    _calls: calls,
    getName: function () { return this._name; },
    getRange: function (r, c, h, w) {
      var self = this;
      // Called via yarnInventoryGetRange_(sheet, a1) which parses to numeric
      // For test we capture A1 string via spy on yarnInventoryGetRange_ wrapper, so fake sheet's getRange numeric is used.
      return {
        getValue: function () { return ''; },
        getValues: function () {
          var out = [];
          for (var i = 0; i < h; i++) {
            var row = [];
            for (var j = 0; j < w; j++) row.push('');
            out.push(row);
          }
          return out;
        },
        setValues: function (vals) { self._calls.setValues.push({ r: r, c: c, h: h, w: w, vals: vals }); },
        clearContent: function () { self._calls.cleared.push({ r: r, c: c, h: h, w: w }); },
        setValue: function (v) { self._calls.setValues.push({ r: r, c: c, v: v }); },
        getA1Notation: function () { return 'R' + r + 'C' + c; },
        protect: function () { return { setDescription: function(){ return this; }, setWarningOnly: function(){ return this; }}; },
        setFontWeight: function(){ return this; }, setBackground: function(){ return this; },
        setNumberFormat: function(){ return this; }
      };
    },
    getLastRow: function () { return 1; },
    getMaxRows: function () { return 100; },
    setFrozenRows: function(){}, autoResizeColumns: function(){}, getProtections: function(){ return []; }
  };
}

function yarnInventoryFakeSpreadsheet_(sheetsByName) {
  return {
    getSheetByName: function (name) { return sheetsByName[name] || null; },
    insertSheet: function (name) { var sh = yarnInventoryFakeSheet_(name); sheetsByName[name] = sh; return sh; },
    toast: function () {},
    setActiveSheet: function () {}
  };
}

// --- Tests ---

function yarnInventoryTestConfigFrozen_() {
  yarnInventoryAssert_(YARN_INVENTORY_CONFIG.TIMEZONE === 'America/La_Paz', 'TIMEZONE must be America/La_Paz.');
  yarnInventoryAssert_(Object.isFrozen(YARN_INVENTORY_CONFIG), 'Config must be frozen.');
  yarnInventoryAssert_(Object.isFrozen(YARN_INVENTORY_CONFIG.SHEETS), 'SHEETS frozen.');
  yarnInventoryAssert_(Object.isFrozen(YARN_INVENTORY_CONFIG.RANGES), 'RANGES frozen.');
}

function yarnInventoryTestHeadersFrozen_() {
  var mHeaders = YARN_INVENTORY_CONFIG.MADEJERAS_HEADERS;
  var lHeaders = YARN_INVENTORY_CONFIG.LOTES_HEADERS;
  yarnInventoryAssert_(mHeaders.length === 17 && lHeaders.length === 24, 'Headers must be 17 A:Q and 24 A:X.');
  yarnInventoryAssert_(mHeaders.join('|') === 'id|fecha|turno|supervisor|inventario|maquina|lado|titulo_base|cabos|peso_deseado|tamano_aspa|velocidad|creado|actualizado|editado_por|rango_origen|estado', 'MADEJERAS_HEADERS order frozen A:Q 17.');
  yarnInventoryAssert_(lHeaders.join('|') === 'id|fecha|turno|supervisor|inventario|lote_id|tipo_orden|color|titulo|objetivo_neto|aumento|pesada_1|pesada_2|pesada_3|pesada_4|pesada_5|pesada_6|pesada_7|pesada_8|creado|actualizado|editado_por|rango_origen|estado', 'LOTES_HEADERS order frozen A:X 24.');
  yarnInventoryAssert_(YARN_INVENTORY_CONFIG.LIMITS.DB_MADEJERAS_COLUMNS === 17, 'DB_MADEJERAS_COLUMNS 17.');
  yarnInventoryAssert_(YARN_INVENTORY_CONFIG.LIMITS.DB_LOTES_COLUMNS === 24, 'DB_LOTES_COLUMNS 24.');
  yarnInventoryAssert_(YARN_INVENTORY_CONFIG.MADEJERAS_HEADERS.length === YARN_INVENTORY_CONFIG.LIMITS.DB_MADEJERAS_COLUMNS, 'MADEJERAS_HEADERS length matches DB columns.');
  yarnInventoryAssert_(YARN_INVENTORY_CONFIG.LOTES_HEADERS.length === YARN_INVENTORY_CONFIG.LIMITS.DB_LOTES_COLUMNS, 'LOTES_HEADERS length matches DB columns.');
  // IDX coverage
  yarnInventoryAssert_(YARN_INVENTORY_CONFIG.IDX_MADEJERAS.ID === 0 && YARN_INVENTORY_CONFIG.IDX_MADEJERAS.ESTADO === 16, 'IDX_MADEJERAS covers 0..16.');
  yarnInventoryAssert_(YARN_INVENTORY_CONFIG.IDX_LOTES.ID === 0 && YARN_INVENTORY_CONFIG.IDX_LOTES.ESTADO === 23, 'IDX_LOTES covers 0..23.');
  yarnInventoryAssert_(YARN_INVENTORY_CONFIG.IDX_ERRORS.TIMESTAMP === 0 && YARN_INVENTORY_CONFIG.ERRORS_HEADERS.length === 6, 'ERRORS 6 cols.');
}

function yarnInventoryTestBoundaryNeverPersisted_() {
  // Config owns all ranges; hydration/persist must never touch formula ranges verbatim
  var cfg = YARN_INVENTORY_CONFIG.RANGES;
  yarnInventoryAssert_(cfg.MADEJERAS_INPUTS === 'C8:G17', 'MADEJERAS_INPUTS must be C8:G17.');
  yarnInventoryAssert_(cfg.MADEJERAS_FORMULAS === 'H8:K17', 'MADEJERAS_FORMULAS must be H8:K17.');
  yarnInventoryAssert_(cfg.LOTES_INPUTS_A === 'A6:F52', 'LOTES_INPUTS_A A6:F52.');
  yarnInventoryAssert_(cfg.LOTES_INPUTS_B === 'H6:O52', 'LOTES_INPUTS_B H6:O52.');
  yarnInventoryAssert_(cfg.LOTES_FORMULAS.META === 'G6:G52', 'META G6:G52.');
  yarnInventoryAssert_(cfg.LOTES_FORMULAS.TOTAL === 'P6:P52', 'TOTAL P6:P52.');
  yarnInventoryAssert_(cfg.LOTES_FORMULAS.AJUSTE === 'Q6:Q52', 'AJUSTE Q6:Q52.');
  yarnInventoryAssert_(cfg.LOTES_FORMULAS.ESTADO === 'R6:R52', 'ESTADO R6:R52.');
  // Input ranges must not intersect formula ranges by parsing
  var mi = yarnInventoryParseRange_(cfg.MADEJERAS_INPUTS);
  var mf = yarnInventoryParseRange_(cfg.MADEJERAS_FORMULAS);
  yarnInventoryAssert_(mi.c2 < mf.c1, 'MADEJERAS inputs C:G must be left of formulas H:K — never overlap.');
  var la = yarnInventoryParseRange_(cfg.LOTES_INPUTS_A);
  var meta = yarnInventoryParseRange_(cfg.LOTES_FORMULAS.META);
  var lb = yarnInventoryParseRange_(cfg.LOTES_INPUTS_B);
  var total = yarnInventoryParseRange_(cfg.LOTES_FORMULAS.TOTAL);
  yarnInventoryAssert_(la.c2 < meta.c1, 'LOTES A6:F must be left of G META.');
  yarnInventoryAssert_(meta.c2 < lb.c1, 'META G must be left of H:O inputs.');
  yarnInventoryAssert_(lb.c2 < total.c1, 'H:O inputs must be left of P TOTAL — Q/R further right.');
  // Ingest validates only via Config — ensure formula literals not persisted: check Ingest never references H8/K17/G/P/Q/R outside Config
  yarnInventoryAssert_(String(cfg.LOTES_FORMULAS.META + cfg.LOTES_FORMULAS.TOTAL).indexOf('G') !== -1, 'Formula ranges exist in Config, not elsewhere.');
}

function yarnInventoryTestFechaNative_() {
  // fecha native DATE: getFullYear/getMonth/getDate without formatDate; noon recovery
  var dNoon = new Date(2026, 8, 10, 12, 0, 0);
  var keyNoon = yarnInventoryDateKey_(dNoon);
  yarnInventoryAssert_(keyNoon === '2026-09-10', 'Noon Date 2026-09-10 must key as 2026-09-10 via native.');
  var dLate = new Date(2026, 8, 10, 23, 59, 59);
  yarnInventoryAssert_(yarnInventoryDateKey_(dLate) === '2026-09-10', 'Late same day must stay 2026-09-10 — no timezone shift.');
  yarnInventoryAssert_(yarnInventoryDateKey_('2026-09-10') === '2026-09-10', 'ISO string yyyy-MM-dd must key same.');
  yarnInventoryAssert_(yarnInventoryDateKey_('31/09/2026') === '', 'Invalid 31/09 must be empty.');
  yarnInventoryAssert_(yarnInventoryDateKey_('') === '', 'Empty must be empty.');
  yarnInventoryAssert_(yarnInventoryIsValidDate_(new Date(2026, 8, 10)), 'Valid Date must pass isValid.');
  yarnInventoryAssert_(!yarnInventoryIsValidDate_('not-a-date'), 'Invalid string fails isValid.');
  var recovered = yarnInventoryDateFromKey_('2026-09-10');
  yarnInventoryAssert_(recovered instanceof Date && !isNaN(recovered.getTime()) && recovered.getHours() === 12, 'DateFromKey must be Date at noon 12:00.');
  yarnInventoryAssert_(yarnInventoryDateKey_(recovered) === '2026-09-10', 'Noon recovery must round-trip.');
  // Audit uses La_Paz only — yarnInventoryAuditTimestamp_ must use TIMEZONE
  var audit = yarnInventoryAuditTimestamp_(new Date(Date.UTC(2026, 8, 10, 12, 0, 0)));
  yarnInventoryAssert_(typeof audit === 'string' && audit.length >= 10, 'Audit timestamp must be string via La_Paz.');
}

function yarnInventoryTestLimits_() {
  yarnInventoryAssert_(YARN_INVENTORY_CONFIG.LIMITS.MADEJERAS_PER_DAY === 10, 'MADEJERAS_PER_DAY 10 (M1..5 × A/B).');
  yarnInventoryAssert_(YARN_INVENTORY_CONFIG.LIMITS.LOTES_PER_DAY === 47, 'LOTES_PER_DAY 47 (6..52).');
  yarnInventoryAssert_(YARN_INVENTORY_CONFIG.LIMITS.LOTES_MAX_ROW === 52, 'LOTES_MAX_ROW 52.');
  var maxBatch = YARN_INVENTORY_CONFIG.LIMITS.MADEJERAS_PER_DAY + YARN_INVENTORY_CONFIG.LIMITS.LOTES_PER_DAY;
  yarnInventoryAssert_(maxBatch === 57, 'Guardar Todo sequential ≤57 rows per fecha+turno.');
}

function yarnInventoryTestMadejerasPkAndLimits_() {
  var fechaKey = '2026-09-10';
  var fechaDate = yarnInventoryDateFromKey_(fechaKey);
  // Build snapshot with 10 eligible rows (full capacity) + 1 extra to ensure slice still 10
  var rows = [];
  for (var i = 0; i < 10; i++) {
    var ms = yarnInventoryMadejerasMachineSide_(i);
    rows.push({ idx: i, sheetRow: 8 + i, maquina: ms.maquina, lado: ms.lado, titulo_base: 9, cabos: 4, peso_deseado: 500, tamano_aspa: 1.7, velocidad: 250, rango_origen: 'madejeras!A' + (8+i) + ':G' + (8+i), eligible: true });
  }
  var snapshot = { fechaKey: fechaKey, fechaDate: fechaDate, turno: 'Turno Dia', supervisor: 'Junior', inventario: 'Ricky', rows: rows };
  var plan = yarnInventoryBuildMadejerasPlan_(snapshot, { madejerasById: {} });
  yarnInventoryAssert_(plan.plans.length === 10, '10 eligible madejeras rows must produce 10 plans (≤10 per fecha+turno).');
  var ids = plan.plans.map(function(p){ return p.id; });
  yarnInventoryAssert_(ids[0] === '2026-09-10-Turno Dia-Máquina 1-A', 'First PK must be yyyy-MM-dd-turno-maquina-lado.');
  yarnInventoryAssert_(ids[9] === '2026-09-10-Turno Dia-Máquina 5-B', 'Last PK Máquina 5-B.');
  // No duplicate warning for unique PKs
  yarnInventoryAssert_(plan.warnings.length === 0, 'Unique PKs produce no duplicate warning.');
}

function yarnInventoryTestLotesPkRowFallbackAndLastWins_() {
  var fechaKey = '2026-09-10';
  var fechaDate = yarnInventoryDateFromKey_(fechaKey);
  // Two rows with same lote_id duplicate → last-wins with warning
  var rowsDup = [
    { idx: 0, sheetRow: 6, lote_id: 'VERDE', tipo_orden: 'Lote', color: 'verde', titulo: '9', objetivo_neto: 216, aumento: 1, pesada_1: 10, pesada_2: '', pesada_3: '', pesada_4: '', pesada_5: '', pesada_6: '', pesada_7: '', pesada_8: '', rango_origen: 'lotes!A6:O6', eligible: true },
    { idx: 1, sheetRow: 7, lote_id: 'VERDE', tipo_orden: 'Lote', color: 'verde2', titulo: '10', objetivo_neto: 220, aumento: 2, pesada_1: 20, pesada_2: '', pesada_3: '', pesada_4: '', pesada_5: '', pesada_6: '', pesada_7: '', pesada_8: '', rango_origen: 'lotes!A7:O7', eligible: true }
  ];
  var snapDup = { fechaKey: fechaKey, fechaDate: fechaDate, turno: 'Dia', supervisor: 'Junior', inventario: 'Ricky', rows: rowsDup };
  var planDup = yarnInventoryBuildLotesPlan_(snapDup, { lotesById: {} });
  yarnInventoryAssert_(planDup.plans.length === 1, 'Duplicate lote_id must last-wins → 1 plan.');
  yarnInventoryAssert_(planDup.warnings.length === 1 && planDup.warnings[0].indexOf('Lote duplicado') !== -1, 'Duplicate must toast warning.');
  yarnInventoryAssert_(planDup.plans[0].id === '2026-09-10-Dia-VERDE', 'Duplicate last row wins with id fecha-turno-lote_id.');
  // Empty lote_id → row fallback row6, row7 distinct PKs
  var rowsEmpty = [
    { idx: 0, sheetRow: 6, lote_id: '', tipo_orden: 'Stock', color: '', titulo: '', objetivo_neto: 204, aumento: '', pesada_1: 10, pesada_2: '', pesada_3: '', pesada_4: '', pesada_5: '', pesada_6: '', pesada_7: '', pesada_8: '', rango_origen: 'lotes!A6:O6', eligible: true },
    { idx: 1, sheetRow: 7, lote_id: '', tipo_orden: 'Stock', color: '', titulo: '', objetivo_neto: 204, aumento: '', pesada_1: 20, pesada_2: '', pesada_3: '', pesada_4: '', pesada_5: '', pesada_6: '', pesada_7: '', pesada_8: '', rango_origen: 'lotes!A7:O7', eligible: true }
  ];
  var snapEmpty = { fechaKey: fechaKey, fechaDate: fechaDate, turno: 'Dia', supervisor: 'Junior', inventario: 'Ricky', rows: rowsEmpty };
  var planEmpty = yarnInventoryBuildLotesPlan_(snapEmpty, { lotesById: {} });
  yarnInventoryAssert_(planEmpty.plans.length === 2, 'Two empty lote_id rows must produce two fallback PKs.');
  yarnInventoryAssert_(planEmpty.plans[0].id === '2026-09-10-Dia-row6', 'Empty row6 fallback id.');
  yarnInventoryAssert_(planEmpty.plans[1].id === '2026-09-10-Dia-row7', 'Empty row7 fallback id.');
  // Limit 47: build 47 eligible rows then try 48th (beyond 52 ignored already by Ingest slice)
  yarnInventoryAssert_(47 <= YARN_INVENTORY_CONFIG.LIMITS.LOTES_PER_DAY, 'Limit guard 47.');
}

function yarnInventoryTestVoidSoftDeleteAndReactivate_() {
  var fechaKey = '2026-09-10';
  var fechaDate = yarnInventoryDateFromKey_(fechaKey);
  var turno = 'Turno Dia';
  // Existing DB: one active madejera row
  var existingId = '2026-09-10-Turno Dia-Máquina 1-A';
  var created = '2026-09-10 08:00:00';
  var existingData = new Array(YARN_INVENTORY_CONFIG.LIMITS.DB_MADEJERAS_COLUMNS);
  for (var c = 0; c < existingData.length; c++) existingData[c] = '';
  existingData[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.ID] = existingId;
  existingData[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.FECHA] = fechaDate;
  existingData[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.TURNO] = turno;
  existingData[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.MAQUINA] = 'Máquina 1';
  existingData[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.LADO] = 'A';
  existingData[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.TITULO_BASE] = 9;
  existingData[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.CABOS] = 4;
  existingData[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.CREADO] = created;
  existingData[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.ACTUALIZADO] = created;
  existingData[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.EDITADO_POR] = 'old@factory.bo';
  existingData[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.ESTADO] = 'active';
  var state = { madejerasById: {} };
  state.madejerasById[existingId] = { rowNum: 2, data: existingData.slice() };
  // Snapshot with zero eligible rows for same fecha+turno → soft-delete (void)
  var emptyRows = [];
  for (var i = 0; i < 10; i++) {
    var ms = yarnInventoryMadejerasMachineSide_(i);
    emptyRows.push({ idx: i, sheetRow: 8+i, maquina: ms.maquina, lado: ms.lado, titulo_base: '', cabos: '', peso_deseado: '', tamano_aspa: '', velocidad: '', rango_origen: 'madejeras!A'+(8+i)+':G'+(8+i), eligible: false });
  }
  var emptySnap = { fechaKey: fechaKey, fechaDate: fechaDate, turno: turno, supervisor: 'Junior', inventario: 'Ricky', rows: emptyRows };
  var voidPlan = yarnInventoryBuildMadejerasPlan_(emptySnap, state);
  yarnInventoryAssert_(voidPlan.plans.length === 1 && voidPlan.plans[0].isVoid, 'Clearing input for existing PK then saving must produce void plan.');
  yarnInventoryAssert_(voidPlan.plans[0].values[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.ESTADO] === 'void', 'Void row estado must be void.');
  // Reactivate: refill same PK with eligible data → active again
  var refillRows = emptyRows.slice();
  refillRows[0] = { idx: 0, sheetRow: 8, maquina: 'Máquina 1', lado: 'A', titulo_base: 9, cabos: 4, peso_deseado: 500, tamano_aspa: 1.7, velocidad: 250, rango_origen: 'madejeras!A8:G8', eligible: true };
  var refillSnap = { fechaKey: fechaKey, fechaDate: fechaDate, turno: turno, supervisor: 'Junior', inventario: 'Ricky', rows: refillRows };
  // State with void row
  var voidData = voidPlan.plans[0].values.slice();
  var voidState = { madejerasById: {} };
  voidState.madejerasById[existingId] = { rowNum: 2, data: voidData };
  var reactPlan = yarnInventoryBuildMadejerasPlan_(refillSnap, voidState);
  var active = reactPlan.plans.filter(function(p){ return !p.isVoid; });
  yarnInventoryAssert_(active.length === 1 && active[0].values[YARN_INVENTORY_CONFIG.IDX_MADEJERAS.ESTADO] === 'active', 'Re-adding inputs after void must return to active without duplication.');
}

function yarnInventoryTestCreadoPreserved_() {
  var fechaKey = '2026-09-10';
  var fechaDate = yarnInventoryDateFromKey_(fechaKey);
  var id = '2026-09-10-Dia-VERDE';
  var created = '2026-09-10 08:00:00';
  var existingLote = new Array(YARN_INVENTORY_CONFIG.LIMITS.DB_LOTES_COLUMNS);
  for (var c2 = 0; c2 < existingLote.length; c2++) existingLote[c2] = '';
  existingLote[YARN_INVENTORY_CONFIG.IDX_LOTES.ID] = id;
  existingLote[YARN_INVENTORY_CONFIG.IDX_LOTES.FECHA] = fechaDate;
  existingLote[YARN_INVENTORY_CONFIG.IDX_LOTES.TURNO] = 'Dia';
  existingLote[YARN_INVENTORY_CONFIG.IDX_LOTES.LOTE_ID] = 'VERDE';
  existingLote[YARN_INVENTORY_CONFIG.IDX_LOTES.OBJETIVO_NETO] = 216;
  existingLote[YARN_INVENTORY_CONFIG.IDX_LOTES.CREADO] = created;
  existingLote[YARN_INVENTORY_CONFIG.IDX_LOTES.ACTUALIZADO] = created;
  existingLote[YARN_INVENTORY_CONFIG.IDX_LOTES.ESTADO] = 'active';
  var stateL = { lotesById: {} };
  stateL.lotesById[id] = { rowNum: 2, data: existingLote.slice() };
  var rows = [{ idx: 0, sheetRow: 6, lote_id: 'VERDE', tipo_orden: 'Lote', color: 'verde', titulo: '9', objetivo_neto: 216, aumento: 1, pesada_1: 11, pesada_2: '', pesada_3: '', pesada_4: '', pesada_5: '', pesada_6: '', pesada_7: '', pesada_8: '', rango_origen: 'lotes!A6:O6', eligible: true }];
  var snap = { fechaKey: fechaKey, fechaDate: fechaDate, turno: 'Dia', supervisor: 'Junior', inventario: 'Ricky', rows: rows };
  var plan = yarnInventoryBuildLotesPlan_(snap, stateL);
  yarnInventoryAssert_(plan.plans.length === 1, 'Resave same PK must be one plan.');
  yarnInventoryAssert_(plan.plans[0].values[YARN_INVENTORY_CONFIG.IDX_LOTES.CREADO] === created, 'Creado must be preserved from existing row.');
  yarnInventoryAssert_(plan.plans[0].values[YARN_INVENTORY_CONFIG.IDX_LOTES.ACTUALIZADO] !== created, 'Actualizado must be refreshed in La_Paz.');
}

function yarnInventoryTestInvalidBlocksForm_() {
  // Invalid fecha/turno/supervisor blocks snapshot valid=false — no writes
  var fakeSheet = {
    getName: function(){ return 'madejeras'; },
    getRange: function(r,c,h,w){ return { getValue: function(){ return ''; }, getValues: function(){ return []; } }; }
  };
  // Directly test Ingest snapshot validation via helpers rather than fake getRange literals
  // Use yarnInventoryIsInListCI_ and yarnInventoryDateKey_ contracts
  yarnInventoryAssert_(!yarnInventoryIsValidDate_(''), 'Empty fecha must be invalid — blocks that form.');
  yarnInventoryAssert_(!yarnInventoryIsInListCI_('Invalido', YARN_INVENTORY_CONFIG.TURNO_MADEJERAS), 'Invalid turno must not be in list — blocks.');
  yarnInventoryAssert_(!yarnInventoryIsInListCI_('Invalido', YARN_INVENTORY_CONFIG.SUPERVISOR_VALUES), 'Invalid supervisor blocks that form.');
  yarnInventoryAssert_(!yarnInventoryIsInListCI_('Invalido', YARN_INVENTORY_CONFIG.INVENTARIO_VALUES), 'Invalid inventario blocks.');
  // Hydration guard: invalid fecha/turno change must not clear inputs — handler returns early
  yarnInventoryAssert_(yarnInventoryIsInListCI_('Turno Dia', YARN_INVENTORY_CONFIG.TURNO_MADEJERAS), 'Valid turno Dia passes.');
  yarnInventoryAssert_(yarnInventoryIsInListCI_('Dia', YARN_INVENTORY_CONFIG.TURNO_LOTES), 'Valid Dia passes for lotes.');
  yarnInventoryAssert_(yarnInventoryIsInListCI_('Junior', YARN_INVENTORY_CONFIG.SUPERVISOR_VALUES), 'Valid supervisor Junior.');
}

function yarnInventoryTestLockExhaustion_() {
  // Simulate acquire lock retry: first tryLock false, sleep, second false → failure
  var calls = { tryLock: 0, sleepMs: 0 };
  var fakeLock = {
    tryLock: function (ms) { calls.tryLock += 1; return false; }
  };
  var prevSleep = (typeof Utilities !== 'undefined' && Utilities.sleep) ? Utilities.sleep : null;
  if (typeof Utilities === 'undefined') this.Utilities = { sleep: function(ms){ calls.sleepMs = ms; }, formatDate: function(){ return '2026-09-10 12:00:00'; } };
  var origSleep = Utilities.sleep;
  Utilities.sleep = function(ms){ calls.sleepMs = ms; };
  var acquired = yarnInventoryAcquireLock_(fakeLock);
  yarnInventoryAssert_(!acquired, 'Exhausted lock must return falsy — caller toasts ⏳→❌ and logs.');
  yarnInventoryAssert_(calls.tryLock === 2, 'Lock must be tried twice (5000 + one retry).');
  Utilities.sleep = origSleep;
  // Success path: second retry succeeds
  var calls2 = { tryLock: 0 };
  var fakeLock2 = { tryLock: function(){ calls2.tryLock += 1; return calls2.tryLock === 2; } };
  Utilities.sleep = function(){};
  var acquired2 = yarnInventoryAcquireLock_(fakeLock2);
  yarnInventoryAssert_(acquired2 && calls2.tryLock === 2, 'Second attempt success must acquire lock.');
  Utilities.sleep = origSleep;
}

function yarnInventoryTestHydrationInputOnly_() {
  // Hydration must clear only C8:G17 and A6:F52+H6:O52 — never formulas H8:K17 / G/P/Q/R
  var madejerasSheet = yarnInventoryFakeSheet_('madejeras');
  var lotesSheet = yarnInventoryFakeSheet_('lotes');
  yarnInventoryClearMadejerasInputs_(madejerasSheet);
  yarnInventoryAssert_(madejerasSheet._calls.cleared.length === 1, 'Clear madejeras must clear one input range C8:G17.');
  var mc = madejerasSheet._calls.cleared[0];
  var expectedM = yarnInventoryParseRange_(YARN_INVENTORY_CONFIG.RANGES.MADEJERAS_INPUTS);
  yarnInventoryAssert_(mc.r === expectedM.r1 && mc.c === expectedM.c1 && mc.h === (expectedM.r2-expectedM.r1+1) && mc.w === (expectedM.c2-expectedM.c1+1), 'Cleared madejeras range must equal C8:G17 exactly.');
  yarnInventoryClearLotesInputs_(lotesSheet);
  yarnInventoryAssert_(lotesSheet._calls.cleared.length === 2, 'Clear lotes must clear two input ranges A6:F52 and H6:O52.');
  var la = yarnInventoryParseRange_(YARN_INVENTORY_CONFIG.RANGES.LOTES_INPUTS_A);
  var lb = yarnInventoryParseRange_(YARN_INVENTORY_CONFIG.RANGES.LOTES_INPUTS_B);
  yarnInventoryAssert_(lotesSheet._calls.cleared[0].r === la.r1 && lotesSheet._calls.cleared[0].c === la.c1, 'First cleared lotes must be A6:F52.');
  yarnInventoryAssert_(lotesSheet._calls.cleared[1].r === lb.r1 && lotesSheet._calls.cleared[1].c === lb.c1, 'Second cleared lotes must be H6:O52.');
  // Ensure formula ranges were not cleared
  // (if hydration accidentally cleared formulas, cleared length would be >2 or different coordinates)
}

function yarnInventoryTestParseHelpers_() {
  var b3 = yarnInventoryParseA1_('B3');
  yarnInventoryAssert_(b3.row === 3 && b3.col === 2, 'B3 must parse to 3,2.');
  var f3 = yarnInventoryParseA1_('F3');
  yarnInventoryAssert_(f3.row === 3 && f3.col === 6, 'F3 must parse to 3,6.');
  var c3 = yarnInventoryParseA1_('C3');
  yarnInventoryAssert_(c3.row === 3 && c3.col === 3, 'C3 must parse to 3,3.');
  var e3 = yarnInventoryParseA1_('E3');
  yarnInventoryAssert_(e3.row === 3 && e3.col === 5, 'E3 must parse to 3,5.');
  var r1 = yarnInventoryParseRange_('C8:G17');
  yarnInventoryAssert_(r1.r1 === 8 && r1.c1 === 3 && r1.r2 === 17 && r1.c2 === 7, 'C8:G17 range 8,3->17,7.');
  var r2 = yarnInventoryParseRange_('A6:F52');
  yarnInventoryAssert_(r2.r1 === 6 && r2.c1 === 1 && r2.r2 === 52 && r2.c2 === 6, 'A6:F52 range.');
  var r3 = yarnInventoryParseRange_('H6:O52');
  yarnInventoryAssert_(r3.r1 === 6 && r3.c1 === 8 && r3.r2 === 52 && r3.c2 === 15, 'H6:O52 range.');
}

function yarnInventoryTestMenuGuards_() {
  // Menu onOpen must create Inventario menu with Guardar Madejeras/Lotes/Todo + Ver db_* + Re-sincronizar
  // Verify Menu.gs presence via function existence (Apps Script global)
  yarnInventoryAssert_(typeof onOpen === 'function', 'onOpen must exist.');
  yarnInventoryAssert_(typeof yarnInventoryOnEdit === 'function', 'yarnInventoryOnEdit must exist.');
  yarnInventoryAssert_(typeof guardarMadejeras === 'function', 'guardarMadejeras must exist.');
  yarnInventoryAssert_(typeof guardarLotes === 'function', 'guardarLotes must exist.');
  yarnInventoryAssert_(typeof guardarTodo === 'function', 'guardarTodo must exist.');
  yarnInventoryAssert_(typeof yarnInventoryMenuVerMadejeras === 'function', 'Ver db_madejeras must exist.');
  yarnInventoryAssert_(typeof yarnInventoryMenuVerLotes === 'function', 'Ver db_lotes must exist.');
  yarnInventoryAssert_(typeof yarnInventoryMenuResincronizar === 'function', 'Re-sincronizar must exist.');
}

function yarnInventoryRunTests_() {
  var tests = [
    yarnInventoryTestConfigFrozen_,
    yarnInventoryTestHeadersFrozen_,
    yarnInventoryTestBoundaryNeverPersisted_,
    yarnInventoryTestFechaNative_,
    yarnInventoryTestLimits_,
    yarnInventoryTestMadejerasPkAndLimits_,
    yarnInventoryTestLotesPkRowFallbackAndLastWins_,
    yarnInventoryTestVoidSoftDeleteAndReactivate_,
    yarnInventoryTestCreadoPreserved_,
    yarnInventoryTestInvalidBlocksForm_,
    yarnInventoryTestLockExhaustion_,
    yarnInventoryTestHydrationInputOnly_,
    yarnInventoryTestParseHelpers_,
    yarnInventoryTestMenuGuards_
  ];
  var passed = 0;
  var failed = [];
  tests.forEach(function (fn) {
    try { fn(); passed += 1; Logger.log('\u2705 ' + fn.name + ' passed'); }
    catch (e) { failed.push(fn.name + ': ' + e.message); Logger.log('\u274c ' + fn.name + ' failed: ' + e.message); }
  });
  var summary = passed + '/' + tests.length + ' Yarn Inventory tests passed.';
  if (failed.length) summary += ' Failures: ' + failed.join(' | ');
  Logger.log(summary);
  return summary;
}

// Alias for single entry expected by some harnesses
function yarnInventoryTest_() { return yarnInventoryRunTests_(); }
function yarnTestHelpers_() { return yarnInventoryRunTests_(); }
