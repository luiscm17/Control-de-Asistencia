/**
 * Persistence.gs — Locked, map-based persistence helpers for Coneras unloads.
 */

function conerasBuildPersistencePlan_(dbSheet, snapshot) {
  const lastRow = dbSheet.getLastRow();
  const body = lastRow > 1 ? dbSheet.getRange(2, 1, lastRow - 1,
    CONERAS_CONFIG.LIMITS.DB_COLUMNS).getValues() : [];
  return conerasBuildPersistencePlanFromRows_(body, snapshot);
}

function conerasBuildPersistencePlanFromRows_(body, snapshot) {
  const indexById = new Map();
  body.forEach(function (row, index) {
    if (row[0]) indexById.set(String(row[0]), index + 2);
  });

  const upserts = snapshot.rows.map(function (row) {
    const existingRow = indexById.get(row.id);
    const values = row.values.slice();
    if (existingRow) values[13] = body[existingRow - 2][13];
    return { id: row.id, rowIndex: existingRow || 0, values: values };
  });
  const upsertIds = new Set(upserts.map(function (entry) { return entry.id; }));
  const deletes = snapshot.emptyNumbers.map(function (number) {
    const id = conerasBuildId_(snapshot.fecha, snapshot.turno, snapshot.maquina, number);
    const rowIndex = indexById.get(id);
    if (!rowIndex || upsertIds.has(id)) return null;
    const existing = body[rowIndex - 2];
    return { id: id, rowIndex: rowIndex, descargaNro: number, pesoNeto: existing[11] };
  }).filter(function (entry) { return entry !== null; });

  return { upserts: upserts, deletes: deletes };
}

function conerasApplyPersistencePlan_(dbSheet, plan) {
  const existing = plan.upserts.filter(function (entry) { return entry.rowIndex; })
    .sort(function (left, right) { return left.rowIndex - right.rowIndex; });
  const inserts = plan.upserts.filter(function (entry) { return !entry.rowIndex; });

  conerasWriteContiguousRows_(dbSheet, existing);
  plan.deletes.slice().sort(function (left, right) { return right.rowIndex - left.rowIndex; })
    .forEach(function (entry) { dbSheet.deleteRow(entry.rowIndex); });
  if (inserts.length) {
    dbSheet.getRange(dbSheet.getLastRow() + 1, 1, inserts.length,
      CONERAS_CONFIG.LIMITS.DB_COLUMNS).setValues(inserts.map(function (entry) {
      return entry.values;
    }));
  }
}

function conerasWriteContiguousRows_(sheet, entries) {
  let group = [];
  entries.forEach(function (entry, index) {
    const next = entries[index + 1];
    group.push(entry);
    if (!next || next.rowIndex !== entry.rowIndex + 1) {
      sheet.getRange(group[0].rowIndex, 1, group.length,
        CONERAS_CONFIG.LIMITS.DB_COLUMNS).setValues(group.map(function (item) {
        return item.values;
      }));
      group = [];
    }
  });
}
