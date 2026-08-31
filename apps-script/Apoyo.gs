/**
 * Apoyo.gs — Split from Code.gs
 * Role: Apoyo growing table ingest — per PRD v0.3.3.
 *   Apoyo is a growing eventual table A2:E2 header Fecha | Operador | Sección Destino | Motivo | (Horas)
 *   data A3:E1000 (eventual, not daily). No window, no code validation, silent until complete.
 *   Normal onEdit processes ONLY edited rows that become complete (Fecha valid + Operador + Sección Destino).
 *   Whole-table scan only for Backfill (idempotent).
 * Original: Control de Asistencia — Registro Centralization.
 * Notes: Apps Script concatenates all .gs files; order does not matter.
 */

function parseApoyoDateToIso(val) {
    if (val == null || val === "") return null;
    if (Object.prototype.toString.call(val) === "[object Date]" && !isNaN(val)) {
        // Date object from sheet — any date valid as stored (no window)
        return Utilities.formatDate(val, CONFIG.TIMEZONE, "yyyy-MM-dd");
    }
    const s = String(val).trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const parts = s.split("-");
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
            const dim = new Date(y, m, 0).getDate();
            if (d <= dim) return s;
        }
        return null;
    }
    if (s.indexOf("/") !== -1) {
        return parseE11ToIso(s);
    }
    // Try native Date parse as fallback (any date)
    const d = new Date(s);
    if (!isNaN(d)) return Utilities.formatDate(d, CONFIG.TIMEZONE, "yyyy-MM-dd");
    return null;
}

function isApoyoRange(range) {
  const sheet = range.getSheet();
  if (sheet.getName() !== CONFIG.APOYO_SHEET) return false;
  const r1 = range.getRow();
  const c1 = range.getColumn();
  const r2 = r1 + range.getNumRows() - 1;
  const c2 = c1 + range.getNumColumns() - 1;
  const ar1 = 4; // data starts at row 4, row 3 is header
  // Growing table up to 1000, extend if sheet larger
  let ar2 = 1000;
  try { ar2 = Math.max(ar2, sheet.getMaxRows()); } catch (e) {}
  const ac1 = CONFIG.APOYO_A3_COL_START;
  const ac2 = CONFIG.APOYO_A3_COL_END;
  return !(r2 < ar1 || r1 > ar2 || c2 < ac1 || c1 > ac2);
}

function handleApoyoEdit(e, viaManual) {
    const ss = e && e.source ? e.source : SpreadsheetApp.getActiveSpreadsheet();
    const sheet = e && e.range ? e.range.getSheet() : ss.getSheetByName(CONFIG.APOYO_SHEET);
    if (!sheet) return;

    // Hoja2 still critical — validate before any write
    if (!validateHoja2()) {
        ss.toast(
            "⚠️ Hoja2 no accesible — verificá Hoja2!A1:B12 y D1:E7. Sin escritura.",
            "Asistencia",
            7,
        );
        logToErrors(
            CONFIG.APOYO_SHEET,
            e && e.range ? e.range.getA1Notation() : CONFIG.APOYO_RANGE,
            "",
            "hoja2_missing",
        );
        return;
    }

    if (!e || !e.range) return;

  // Intersection with growing table A4:E1000 (cols 1-5, rows 4..max) — row 3 is header
  const rEdited1 = e.range.getRow();
  const rEdited2 = rEdited1 + e.range.getNumRows() - 1;
  const cEdited1 = e.range.getColumn();
  const cEdited2 = cEdited1 + e.range.getNumColumns() - 1;
  const ac1 = CONFIG.APOYO_A3_COL_START;
  const ac2 = CONFIG.APOYO_A3_COL_END;
  const ar1 = 4;
  let ar2 = 1000;
  try { ar2 = Math.max(ar2, sheet.getMaxRows()); } catch (err) {}
  const r1 = Math.max(rEdited1, ar1);
  const r2 = Math.min(rEdited2, ar2);
  const c1 = Math.max(cEdited1, ac1);
  const c2 = Math.min(cEdited2, ac2);
  if (r1 > r2 || c1 > c2) return;

    const numRows = r2 - r1 + 1;
    const numCols = ac2 - ac1 + 1;
    // Read full rows A:E for completeness evaluation (Motivo in col D, Horas in col E unused)
    const values = sheet.getRange(r1, ac1, numRows, numCols).getValues();
    const displayValues = sheet.getRange(r1, ac1, numRows, numCols).getDisplayValues();

    const candidates = [];
    let incompleteCount = 0;

    for (let i = 0; i < values.length; i++) {
        const rowIdx = r1 + i;
        const row = values[i];
        const dispRow = displayValues[i];

        // Col mapping: Apoyo original A=Operador, B=Sección, C=Fecha, D=Motivo, E=Horas — keep as is, row 3 is header
        let fechaVal = row[2];
        if (!(fechaVal instanceof Date) || isNaN(fechaVal)) {
            const dispFecha = dispRow[2];
            if (dispFecha && String(dispFecha).trim() !== "") fechaVal = dispFecha;
            else fechaVal = row[2];
        }
        const operador = String(row[0] || "").trim();
        const seccion = String(row[1] || "").trim();
        const motivo = String(row[3] || "").trim();

        // Determine if row is entirely empty (silent no-op)
        let fechaHasValue = false;
        if (fechaVal instanceof Date && !isNaN(fechaVal)) fechaHasValue = true;
        else if (String(fechaVal || "").trim() !== "") fechaHasValue = true;
        else if (String(dispRow[0] || "").trim() !== "") fechaHasValue = true;

        const isEmptyRow =
            !fechaHasValue &&
            !operador &&
            !seccion &&
            !motivo &&
            String(row[4] || "").trim() === "";
        if (isEmptyRow) {
            // Clearing a row: no Registro write/void for Apoyo (explicit void via menu/backfill only)
            continue;
        }

        // Completeness: Fecha valid ISO + Operador non-empty + Sección Destino non-empty
        const iso = parseApoyoDateToIso(fechaVal);
        if (!iso) {
            incompleteCount++;
            logToErrors(CONFIG.APOYO_SHEET, 'A' + rowIdx + ':E' + rowIdx, String(fechaVal), 'apoyo_fecha_invalida_' + rowIdx);
            continue;
        }
        if (!operador) {
            incompleteCount++;
            logToErrors(CONFIG.APOYO_SHEET, 'A' + rowIdx + ':E' + rowIdx, '', 'apoyo_operador_vacio_' + rowIdx);
            continue;
        }
        if (!seccion) {
            incompleteCount++;
            logToErrors(CONFIG.APOYO_SHEET, 'A' + rowIdx + ':E' + rowIdx, '', 'apoyo_seccion_vacia_' + rowIdx);
            continue;
        }

        // No section validation here — Sheets handles it, any non-empty section is allowed

        const rid = recordId(seccion, operador, iso);
        const srcA1 =
            CONFIG.APOYO_SHEET + "!" + sheet.getRange(rowIdx, ac1, 1, numCols).getA1Notation();
        // Default code A (Asistencia) for Apoyo — explicit AT can be handled via Motivo if needed
        candidates.push({
            section: seccion,
            operatorName: operador,
            isoDate: iso,
            code: "A",
            codeLabel: "Asistencia",
            isApoyo: true,
            nota: motivo,
            sourceRange: srcA1,
            recordId: rid,
        });
    }

  if (candidates.length === 0) {
    Logger.log('handleApoyoEdit: no candidates, incompleteCount=' + incompleteCount + ' editedRows=' + numRows + ' r1=' + r1 + ' r2=' + r2);
    if (incompleteCount > 0) {
      ss.toast('Apoyo incompleto: faltan Fecha válida, Operador o Sección en fila(s) ' + r1 + '-' + r2 + '. Ver Errors para detalle.', 'Asistencia', 7);
      logToErrors(CONFIG.APOYO_SHEET, 'A' + r1 + ':E' + r2, '', 'apoyo_incompleto_' + r1 + '-' + r2);
    }
    return;
  }

    const result = commitRegistroBatch(candidates);
    if (result.queued) return;

    if (candidates.length === 1) {
        const c = candidates[0];
        if (result.ins > 0)
            ss.toast(
                "✅ Apoyo registrado: " + c.operatorName + " — " + c.isoDate + " → " + c.section,
                "Asistencia",
                7,
            );
        else if (result.upd > 0)
            ss.toast(
                "✅ Apoyo actualizado: " + c.operatorName + " — " + c.isoDate + " → " + c.section,
                "Asistencia",
                7,
            );
        else
            ss.toast(
                "✅ Apoyo sincronizado: " + c.operatorName + " — " + c.isoDate,
                "Asistencia",
                5,
            );
    } else {
        if (incompleteCount > 0) {
            ss.toast(
                "✅ Apoyo: " +
                    candidates.length +
                    " registrado(s) (" +
                    result.ins +
                    " ins / " +
                    result.upd +
                    " upd), " +
                    incompleteCount +
                    " pendiente(s) (incompleto)",
                "Asistencia",
                7,
            );
        } else {
            ss.toast(
                "✅ Apoyos sincronizados: " + result.ins + " ins / " + result.upd + " upd",
                "Asistencia",
                7,
            );
        }
    }
}
