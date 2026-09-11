/**
 * Repository.gs — Batched DB access for Yarn Inventory (2 tables).
 *
 * Batch reads db_madejeras A:Q (17) + db_lotes A:X (24) via numeric
 * getRange(2,1,last-1,w) with Config widths. fecha is native DATE
 * (kept as Date object), never formatted via timezone.
 *
 * Guard helpers use Config SHEETS / LIMITS / IDX. No literal A1 outside Config.
 */

/**
 * Ensure both DB sheets exist with frozen headers.
 * Delegate to yarnInventoryEnsureSchema (creates Errors too).
 */
function yarnInventoryEnsureDbSheets_(optSpreadsheet) {
  var ss = optSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  yarnInventoryEnsureSchema(ss);
}

/**
 * Load state for both DBs — single batch per table.
 * @param {Spreadsheet} optSpreadsheet
 * @return {{madejeras:Object, lotes:Object, madejerasById:Object, lotesById:Object}}
 */
function yarnInventoryLoadState_(optSpreadsheet) {
  var ss = optSpreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  var madejerasState = yarnInventoryLoadTableState_(ss, 'DB_MADEJERAS',
    YARN_INVENTORY_CONFIG.LIMITS.DB_MADEJERAS_COLUMNS, YARN_INVENTORY_CONFIG.IDX_MADEJERAS.ID);
  var lotesState = yarnInventoryLoadTableState_(ss, 'DB_LOTES',
    YARN_INVENTORY_CONFIG.LIMITS.DB_LOTES_COLUMNS, YARN_INVENTORY_CONFIG.IDX_LOTES.ID);
  return {
    madejeras: madejerasState,
    lotes: lotesState,
    madejerasById: madejerasState.byId,
    lotesById: lotesState.byId
  };
}

/**
 * Shared loader for one table.
 */
function yarnInventoryLoadTableState_(ss, sheetKey, width, idCol) {
  var sheet = yarnInventoryGetSheet_(ss, sheetKey);
  if (!sheet || sheet.getLastRow() < 2) {
    return { sh: sheet, sheet: sheet, rows: [], byId: {}, index: {} };
  }
  var lastRow = sheet.getLastRow();
  var rows = sheet.getRange(2, 1, lastRow - 1, width).getValues();
  var byId = yarnInventoryBuildIndex_(rows, idCol);
  return { sh: sheet, sheet: sheet, rows: rows, byId: byId, index: byId };
}

/**
 * Build id -> {rowNum, data} index. rowNum is 1-based sheet row (2..).
 * Duplicate id keeps first and logs (DB should be PK-unique).
 */
function yarnInventoryBuildIndex_(rows, idCol) {
  var byId = {};
  for (var i = 0; i < rows.length; i++) {
    var id = String(rows[i][idCol] || '').trim();
    if (!id) continue;
    if (byId[id]) {
      Logger.log('yarnInventoryBuildIndex_: duplicate id ' + id + ' rows ' + byId[id].rowNum + ' and ' + (i + 2));
      continue;
    }
    byId[id] = { rowNum: i + 2, data: rows[i] };
  }
  return byId;
}

/**
 * Helper: Date object at noon from yyyy-MM-dd key (no timezone shift).
 * Mirrors conerasDateFromKey_ but uses inventory helpers.
 */
function yarnInventoryDateFromKey_(key) {
  var raw = String(key || '').trim();
  var m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date(NaN);
  var y = Number(m[1]); var mo = Number(m[2]); var da = Number(m[3]);
  return new Date(y, mo - 1, da, 12, 0, 0);
}
