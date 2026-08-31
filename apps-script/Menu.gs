/**
 * Menu.gs — Split from Code.gs
 * Role: Menu + manual entry + backfill trigger + dual-trigger setup + toast-only onEdit.
 * Original: Control de Asistencia — Registro Centralization.
 * Notes: Apps Script concatenates all .gs files; order does not matter. Public functions (no trailing _) for menu + HtmlService. Do not change logic.
 */

// --- MENU SETUP (PR 3: 5 items + FR-014 nota) ---
function onOpen() {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu("Asistencia")
        .addItem("Ver Registro", "menuVerRegistro")
        .addItem("Re-sincronizar fila", "menuReSincronizarFila")
        .addItem("Agregar/editar nota a celda activa", "menuAgregarEditarNota")
        .addSeparator()
        .addItem("Registro manual", "menuRegistroManual")
        .addSeparator()
        .addItem("Backfill histórico", "menuBackfillHistorico")
        .addItem("Autorizar", "menuAutorizar")
        .addToUi();
}

// Public menu handlers — MUST be public (no underscore) for menu + HtmlService
function menuVerRegistro() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(CONFIG.REGISTRO);
    if (!sh) {
        ss.toast("Registro no encontrado. Ejecutá Autorizar.", "Asistencia", 5);
        return;
    }
    ss.setActiveSheet(sh);
}

function menuAutorizar() {
    setupInstallable();
}

function menuReSincronizarFila() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getActiveSheet();
    const name = sh.getName();
    if (isIgnorableSheet(name)) {
        ss.toast("Hoja no sincronizable.", "Asistencia", 5);
        return;
    }
    if (name === CONFIG.APOYO_SHEET) {
        ss.toast("Usá Solicitar corrección para Apoyo.", "Asistencia", 5);
        return;
    }
    const section = resolveSection(sh);
    if (!section) {
        ss.toast("⚠️ Sección no mapeada en Config!A:B — sin escritura.", "Asistencia", 7);
        logToErrors(
            name,
            sh.getActiveRange() ? sh.getActiveRange().getA1Notation() : "",
            "",
            "section_unmapped_resync",
        );
        return;
    }
    if (!validateHoja2()) {
        ss.toast("⚠️ Hoja2 no accesible — verificá Hoja2!A1:B12 y D1:E7.", "Asistencia", 7);
        return;
    }
    const activeRow = sh.getActiveRange() ? sh.getActiveRange().getRow() : 0;
    if (activeRow < CONFIG.INPUT_ROW_START || activeRow > CONFIG.INPUT_ROW_END) {
        ss.toast(
            "Seleccioná una fila dentro de E15:AI44 (fila " +
                CONFIG.INPUT_ROW_START +
                "-" +
                CONFIG.INPUT_ROW_END +
                ").",
            "Asistencia",
            5,
        );
        return;
    }
    const operatorName = String(sh.getRange(activeRow, 3).getValue() || "").trim();
    if (!operatorName) {
        ss.toast("Fila sin operador en columna C — no hay PK.", "Asistencia", 5);
        logToErrors(
            section,
            name + "!" + activeRow + ":" + activeRow,
            "",
            "operator_missing_resync",
        );
        return;
    }
    const e11Row = sh
        .getRange(11, CONFIG.INPUT_COL_START, 1, CONFIG.INPUT_COL_END - CONFIG.INPUT_COL_START + 1)
        .getDisplayValues()[0];
    const rowValues = sh
        .getRange(
            activeRow,
            CONFIG.INPUT_COL_START,
            1,
            CONFIG.INPUT_COL_END - CONFIG.INPUT_COL_START + 1,
        )
        .getValues()[0];
    const candidates = [];
    let countInvalid = 0;
    let countWindowBlocked = 0;
    let countBlankE11 = 0;

    for (let c = 0; c < rowValues.length; c++) {
        const col = CONFIG.INPUT_COL_START + c;
        const iso = parseE11ToIso(e11Row[c]);
        if (!iso) {
            countBlankE11++;
            continue;
        }
        const raw = rowValues[c];
        const trimmed = String(raw == null ? "" : raw).trim();
        const isEmpty = trimmed === "";
        const normCode = isEmpty ? "" : normalizeCode(trimmed);
        if (!isEmpty && !isCodeValid(normCode)) {
            countInvalid++;
            logToErrors(
                section,
                name + "!" + sh.getRange(activeRow, col).getA1Notation(),
                String(raw),
                "codigo_invalido_resync",
            );
            continue;
        }
        if (!isInWindow(iso)) {
            countWindowBlocked++;
            logToErrors(
                section,
                name + "!" + sh.getRange(activeRow, col).getA1Notation(),
                normCode,
                "fuera_ventana_" + iso,
            );
            continue;
        }
        if (normCode === "" && !findRegistroRowId(recordId(section, operatorName, iso))) {
            // void with no row → skip (will be counted as void attempt but no write)
            continue;
        }
        const codeLabel = normCode ? CONFIG.LABELS[normCode] || normCode : "";
        const srcA1 = name + "!" + sh.getRange(activeRow, col).getA1Notation();
        candidates.push({
            section: section,
            operatorName: operatorName,
            isoDate: iso,
            code: normCode,
            codeLabel: codeLabel,
            isApoyo: false,
            nota: "",
            sourceRange: srcA1,
            recordId: recordId(section, operatorName, iso),
        });
    }

    if (countInvalid > 0) sh.getParent ? null : null; // keep
    if (candidates.length === 0) {
        if (countInvalid > 0)
            ss.toast(
                "⚠️ Código no válido. Use A, AT, BM o F. (" + countInvalid + ")",
                "Asistencia",
                5,
            );
        if (countWindowBlocked > 0) {
            ss.toast(
                "⛔ Re-sincronizar bloqueado: " + countWindowBlocked + " fuera de ventana.",
                "Asistencia",
                7,
            );
        }
        if (candidates.length === 0 && countInvalid === 0 && countWindowBlocked === 0) {
            ss.toast(
                "Nada para sincronizar en esta fila (E11 vacío o celdas vacías).",
                "Asistencia",
                5,
            );
        }
        return;
    }
    const result = commitRegistroBatch(candidates);
    if (result.queued) return;
    const parts = [];
    if (result.ins > 0) parts.push(result.ins + " ins");
    if (result.upd > 0) parts.push(result.upd + " upd");
    if (result.voided > 0) parts.push(result.voided + " void");
    if (countWindowBlocked > 0) parts.push(countWindowBlocked + " fuera");
    if (countInvalid > 0) parts.push(countInvalid + " inválido(s)");
    ss.toast(
        "✅ Re-sincronizado fila " +
            activeRow +
            ": " +
            parts.join(" / ") +
            (countBlankE11 ? " (" + countBlankE11 + " col E11 vacía ignorada)" : ""),
        "Asistencia",
        7,
    );
    logToErrors(
        section,
        name + "!" + activeRow + ":" + activeRow,
        "",
        "resync_ok_" + parts.join(","),
    );
}

/**
 * FR-014 — Optional per-cell nota (any code A/AT/BM/F) via modal.
 * Menu: Asistencia → Agregar/editar nota a celda activa
 * Validates active cell ∈ E15:AI44 with valid E11 date, existing Registro row,
 * window (today/today-1 America/La_Paz) + per-section permission before opening modal.
 */
function menuAgregarEditarNota() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getActiveSheet();
    const name = sh ? sh.getName() : "";
    if (!sh) {
        ss.toast("⚠️ No hay hoja activa.", "Asistencia", 5);
        return;
    }
    if (isIgnorableSheet(name)) {
        ss.toast("⚠️ Hoja no válida para nota.", "Asistencia", 5);
        return;
    }
    if (name === CONFIG.APOYO_SHEET) {
        ss.toast("⚠️ Seleccioná una celda con fecha válida en E15:AI44.", "Asistencia", 5);
        return;
    }
    if (!validateHoja2()) {
        ss.toast("⚠️ Hoja2 no accesible — verificá Hoja2!A1:B12 y D1:E7.", "Asistencia", 7);
        return;
    }
    const section = resolveSection(sh);
    if (!section) {
        ss.toast(
            "⚠️ Sección no mapeada en Config!A:B — sin escritura. Mapeá sheetId o nombre.",
            "Asistencia",
            7,
        );
        logToErrors(
            name,
            sh.getActiveRange() ? sh.getActiveRange().getA1Notation() : "",
            "",
            "section_unmapped_nota",
        );
        return;
    }
    const activeRange = sh.getActiveRange();
    if (!activeRange) {
        ss.toast("⚠️ Seleccioná una celda con fecha válida en E15:AI44.", "Asistencia", 5);
        return;
    }
    const activeRow = activeRange.getRow();
    const activeCol = activeRange.getColumn();
    // Require single active cell within INPUT zone
    if (
        activeRow < CONFIG.INPUT_ROW_START ||
        activeRow > CONFIG.INPUT_ROW_END ||
        activeCol < CONFIG.INPUT_COL_START ||
        activeCol > CONFIG.INPUT_COL_END
    ) {
        ss.toast("⚠️ Seleccioná una celda con fecha válida en E15:AI44.", "Asistencia", 5);
        return;
    }
    const e11Row = sh
        .getRange(11, CONFIG.INPUT_COL_START, 1, CONFIG.INPUT_COL_END - CONFIG.INPUT_COL_START + 1)
        .getDisplayValues()[0];
    const e11Disp = e11Row[activeCol - CONFIG.INPUT_COL_START];
    const iso = parseE11ToIso(e11Disp);
    if (!iso) {
        ss.toast("⚠️ Seleccioná una celda con fecha válida en E15:AI44.", "Asistencia", 5);
        return;
    }
    const operatorName = String(sh.getRange(activeRow, 3).getValue() || "").trim();
    if (!operatorName) {
        ss.toast("⚠️ Fila sin operador en columna C — no hay PK.", "Asistencia", 5);
        return;
    }
    const rid = recordId(section, operatorName, iso);
    const rowNum = findRegistroRowId(rid);
    if (!rowNum) {
        ss.toast("⚠️ No hay registro para esta fecha — primero marcá el código.", "Asistencia", 7);
        return;
    }
    if (!isInWindow(iso)) {
        ss.toast("⛔ Solo podés registrar hoy y ayer (America/La_Paz).", "Asistencia", 7);
        logToErrors(
            section,
            name + "!" + sh.getRange(activeRow, activeCol).getA1Notation(),
            "",
            "fuera_ventana_nota_" + iso,
        );
        return;
    }
    // Fetch current nota (col L = index 12)
    const reg = ss.getSheetByName(CONFIG.REGISTRO);
    let currentNota = "";
    let currentCode = "";
    try {
        currentNota = String(reg.getRange(rowNum, 12).getValue() || "");
        currentCode = String(reg.getRange(rowNum, 7).getValue() || "");
    } catch (e) {}
    // Fallback code from active cell if Registro code empty
    const cellCode = String(sh.getRange(activeRow, activeCol).getValue() || "")
        .trim()
        .toUpperCase();
    const displayCode = currentCode || cellCode || "";
    // Persist context for modal callback (fallback if google.script.run args lost)
    // Store active cell coords so saveNota can sync setNote even if caller omits sheetName/row/col
    try {
        const props = PropertiesService.getDocumentProperties();
        props.setProperty(
            "nota_ctx",
            JSON.stringify({ sheetName: name, row: activeRow, col: activeCol }),
        );
    } catch (e) {}

    // Prompt-based (no HtmlService) — avoids script.container.ui auth issues
    const ui2 = SpreadsheetApp.getUi();
    const promptTitle =
        "Agregar/editar nota — " + operatorName + " — " + iso + " (" + (displayCode || "—") + ")";
    const promptMsg =
        "Celda: " +
        name +
        "!" +
        sh.getRange(activeRow, activeCol).getA1Notation() +
        "\nActual: " +
        (currentNota || "(vacía)") +
        "\n\nEscribí la nueva nota (vacío para borrar, Cancelar para salir):";
    const resp2 = ui2.prompt(promptTitle, promptMsg, ui2.ButtonSet.OK_CANCEL);
    if (resp2.getSelectedButton() !== ui2.Button.OK) return;
    const newNotaInput = resp2.getResponseText();
    // Reuse server logic inline via direct call (no google.script.run)
    const saveResult = saveNota(
        section,
        operatorName,
        iso,
        newNotaInput,
        name,
        activeRow,
        activeCol,
    );
    // saveNota already toasts; no extra handling needed
}

/**
 * Server handler for nota modal — called via google.script.run.saveNota.
 * Updates Registro!L (nota), C updated_at, J edited_by, and syncs cell Note via setNote/clearNote.
 * Window (today/today-1 America/La_Paz) re-validated server-side (permissions via Sheets sharing).
 * Distinct toasts/messages: guardada (first time), actualizada (overwrite), borrada (clear).
 * @return {string} message for modal success handler
 */
function saveNota(section, operatorName, iso, newNota, sheetNameOpt, rowOpt, colOpt) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    // Re-validate window (FR-013) — permission via Sheets sharing, no script gate
    if (!isInWindow(iso)) {
        ss.toast("⛔ Solo podés registrar hoy y ayer (America/La_Paz).", "Asistencia", 7);
        logToErrors(section, "", "", "fuera_ventana_nota_save_" + iso);
        throw new Error("Fuera de ventana hoy/ayer (America/La_Paz).");
    }
    const rid = recordId(section, operatorName, iso);
    const trimmed = String(newNota == null ? "" : newNota).trim();

    const lock = LockService.getDocumentLock();
    let locked = false;
    try {
        locked = lock.tryLock(5000);
        if (!locked) {
            Utilities.sleep(1000);
            locked = lock.tryLock(5000);
        }
        if (!locked) {
            ss.toast("⏳ Registro ocupado — reintentá.", "Asistencia", 7);
            throw new Error("Registro ocupado — reintentá.");
        }
        let reg = ss.getSheetByName(CONFIG.REGISTRO);
        if (!reg) reg = ensureRegistroHeader();
        const rowNum = findRegistroRowId(rid);
        if (!rowNum) {
            ss.toast(
                "⚠️ No hay registro para esta fecha — primero marcá el código.",
                "Asistencia",
                7,
            );
            throw new Error("No hay registro para esta fecha — primero marcá el código.");
        }
        // Fetch previous nota + code for toast distinction and setNote
        const prevNotaRaw = reg.getRange(rowNum, 12).getValue();
        const prevNota = String(prevNotaRaw || "");
        const prevNotaTrimmed = prevNota.trim();
        const codeVal = String(reg.getRange(rowNum, 7).getValue() || "").trim();
        const nowStr = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd HH:mm:ss");
        const editedBy = "unknown";

        // Update Registro row: C updated_at (col 3), J edited_by (col 10), L nota (col 12)
        reg.getRange(rowNum, 3).setValue(nowStr);
        reg.getRange(rowNum, 10).setValue(editedBy);
        reg.getRange(rowNum, 12).setValue(trimmed);

        // Sync cell Note via setNote / clearNote
        let targetSheet = null;
        let targetRow = rowOpt;
        let targetCol = colOpt;
        let targetSheetName = sheetNameOpt;
        // Fallback to PropertiesService context if args missing
        if (!targetSheetName || !targetRow || !targetCol) {
            try {
                const props = PropertiesService.getDocumentProperties();
                const ctxRaw = props.getProperty("nota_ctx");
                if (ctxRaw) {
                    const ctx = JSON.parse(ctxRaw);
                    targetSheetName = targetSheetName || ctx.sheetName;
                    targetRow = targetRow || ctx.row;
                    targetCol = targetCol || ctx.col;
                }
            } catch (e) {}
        }
        if (targetSheetName) {
            targetSheet = ss.getSheetByName(targetSheetName);
        }
        // If still no sheet, try resolve section → sheet scan
        if (!targetSheet) {
            const all = ss.getSheets();
            for (let i = 0; i < all.length; i++) {
                if (resolveSection(all[i]) === section) {
                    targetSheet = all[i];
                    break;
                }
            }
        }
        if (targetSheet && targetRow && targetCol) {
            try {
                const cell = targetSheet.getRange(Number(targetRow), Number(targetCol));
                if (trimmed !== "") {
                    const prefix = codeVal ? codeVal + " — " : "";
                    cell.setNote(prefix + trimmed);
                } else {
                    cell.clearNote();
                }
            } catch (e) {
                Logger.log("saveNota_ setNote fail: " + e.message);
            }
        }

        SpreadsheetApp.flush();

        const isPrevEmpty = prevNotaTrimmed === "";
        const isNewEmpty = trimmed === "";
        let toastMsg = "";
        let retMsg = "";
        if (isNewEmpty && !isPrevEmpty) {
            toastMsg = "🗑️ Nota borrada: " + operatorName + " — " + iso;
            retMsg = toastMsg;
            ss.toast(toastMsg, "Asistencia", 5);
            logToErrors(section, rid, codeVal, "nota_borrada_" + iso);
        } else if (!isNewEmpty && isPrevEmpty) {
            toastMsg = "✅ Nota guardada: " + operatorName + " — " + iso;
            retMsg = toastMsg;
            ss.toast(toastMsg, "Asistencia", 5);
            logToErrors(section, rid, codeVal, "nota_guardada_" + iso);
        } else if (!isNewEmpty && !isPrevEmpty) {
            if (trimmed === prevNotaTrimmed) {
                toastMsg = "✅ Nota actualizada: " + operatorName + " — " + iso;
                retMsg = toastMsg + " (sin cambios)";
            } else {
                toastMsg = "✅ Nota actualizada: " + operatorName + " — " + iso;
                retMsg = toastMsg;
            }
            ss.toast(toastMsg, "Asistencia", 5);
            logToErrors(section, rid, codeVal, "nota_actualizada_" + iso);
        } else {
            // both empty — no-op but keep audit
            retMsg = "Nota vacía — sin cambios.";
            ss.toast("Nota vacía — sin cambios.", "Asistencia", 5);
        }
        return retMsg;
    } finally {
        if (locked) {
            try {
                lock.releaseLock();
            } catch (e) {}
        }
    }
}

function menuRegistroManual() {
    promptManualEntry(true);
}

function promptManualEntry(isRegistroManual) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ui = SpreadsheetApp.getUi();
    if (!validateHoja2()) {
        ss.toast("⚠️ Hoja2 no accesible — verificá Hoja2!A1:B12 y D1:E7.", "Asistencia", 7);
        return;
    }
    // Prompt sequence: Fecha, Operador, Sección, Código, Motivo
    const fechaResp = ui.prompt(
        "Corrección manual — Fecha (YYYY-MM-DD o D/M/YYYY)",
        "Ej: 2026-03-10 o 10/03/2026. Bypass ventana auditable via_manual.",
        ui.ButtonSet.OK_CANCEL,
    );
    if (fechaResp.getSelectedButton() !== ui.Button.OK) return;
    const fechaRaw = fechaResp.getResponseText().trim();
    if (!fechaRaw) {
        ss.toast("Fecha vacía — cancelado.", "Asistencia", 5);
        return;
    }
    let iso = parseApoyoDateToIso(fechaRaw);
    if (!iso) {
        // Try parse as entered D/M/YYYY via E11 parser
        iso = parseE11ToIso(fechaRaw);
    }
    if (!iso) {
        ss.toast("⚠️ Fecha no válida: " + fechaRaw, "Asistencia", 5);
        logToErrors("", "", fechaRaw, "fecha_invalida_manual");
        return;
    }

    const opResp = ui.prompt(
        "Operador",
        "Nombre exacto como en columna C (ej: Juan Pérez):",
        ui.ButtonSet.OK_CANCEL,
    );
    if (opResp.getSelectedButton() !== ui.Button.OK) return;
    const operatorName = opResp.getResponseText().trim();
    if (!operatorName) {
        ss.toast("Operador vacío — cancelado.", "Asistencia", 5);
        return;
    }

    const secResp = ui.prompt(
        "Sección lógica",
        "Una de: " + CONFIG.LOGICAL_SECTIONS.join(", "),
        ui.ButtonSet.OK_CANCEL,
    );
    if (secResp.getSelectedButton() !== ui.Button.OK) return;
    const section = secResp.getResponseText().trim();
    if (!section) {
        ss.toast("Sección vacía — cancelado.", "Asistencia", 5);
        return;
    }
    if (CONFIG.LOGICAL_SECTIONS.indexOf(section) === -1) {
        const conf = ui.alert(
            'Sección "' + section + '" no está en lista canónica. ¿Continuar?',
            ui.ButtonSet.YES_NO,
        );
        if (conf !== ui.Button.YES) return;
    }

    const codeResp = ui.prompt("Código", "A, AT, BM, F o vacío (void):", ui.ButtonSet.OK_CANCEL);
    if (codeResp.getSelectedButton() !== ui.Button.OK) return;
    const codeRaw = codeResp.getResponseText().trim();
    const normCode = codeRaw === "" ? "" : normalizeCode(codeRaw);
    if (normCode !== "" && !isCodeValid(normCode)) {
        ss.toast("⚠️ Código no válido. Use A, AT, BM o F.", "Asistencia", 5);
        logToErrors(section, "", codeRaw, "codigo_invalido_manual");
        return;
    }

    const motivoResp = ui.prompt(
        "Motivo / nota (auditoría via_manual)",
        "Ej: corrección RRHH, constancia adjunta…",
        ui.ButtonSet.OK_CANCEL,
    );
    if (motivoResp.getSelectedButton() !== ui.Button.OK) return;
    const motivo = motivoResp.getResponseText().trim();

    const viaManualNote =
        "via_manual:" +
        (motivo || (isRegistroManual ? "registro_manual" : "solicitar_correccion")) +
        " by unknown";
    const nota = motivo ? motivo + " | " + viaManualNote : viaManualNote;
    const sourceRange = "manual:" + section + "!" + operatorName + "!" + iso;

    // Bypass window + permission; still validate code/section; audited via nota + edited_by
    const codeLabel = normCode ? CONFIG.LABELS[normCode] || normCode : "";
    const candidate = {
        section: section,
        operatorName: operatorName,
        isoDate: iso,
        code: normCode,
        codeLabel: codeLabel,
        isApoyo: false,
        nota: nota,
        sourceRange: sourceRange,
        recordId: recordId(section, operatorName, iso),
    };
    // Log audit before lock
    logToErrors(section, sourceRange, normCode, "via_manual_" + iso + "_" + nota);
    const result = commitRegistroBatch([candidate]);
    if (result.queued) return;
    if (normCode === "") {
        ss.toast("🗑️ void via_manual: " + operatorName + " — " + iso, "Asistencia", 7);
    } else {
        ss.toast(
            "✅ Corrección via_manual: " +
                operatorName +
                " — " +
                iso +
                " = " +
                normCode +
                " (" +
                nota +
                ")",
            "Asistencia",
            7,
        );
    }
    SpreadsheetApp.flush();
}

function menuBackfillHistorico() {
    const ui = SpreadsheetApp.getUi();
    const resp = ui.alert(
        "Backfill histórico",
        "Escanea 6 secciones E15:AI44 donde E11 válido y celda no vacía, reusa upsert idempotente.\n\n¿Incluir fechas fuera de ventana (requiere RRHH)?\n• Sí = histórico completo (bypass ventana, auditado)\n• No = solo hoy/ayer (respeta ventana)",
        ui.ButtonSet.YES_NO_CANCEL,
    );
    if (resp === ui.Button.CANCEL || resp === ui.Button.CLOSE) return;
    const bypassWindow = resp === ui.Button.YES;
    // Confirm bypass
    if (bypassWindow) {
        const conf2 = ui.alert(
            "Confirmar bypass ventana",
            "Backfill histórico completo bypassa ventana hoy/ayer. Se auditará con via_manual en nota. ¿Continuar?",
            ui.ButtonSet.YES_NO,
        );
        if (conf2 !== ui.Button.YES) return;
    }
    showProgress(
        "Backfill " + (bypassWindow ? "completo" : "ventana hoy/ayer") + "...",
        bypassWindow ? "doBackfillCompleto" : "doBackfillVentana",
    );
}

function doBackfillVentana() {
    return doBackfill(false);
}

function doBackfillCompleto() {
    return doBackfill(true);
}

function showProgress(message, serverFn) {
    const html = HtmlService.createHtmlOutput(
        '<style>body{font-family:"Google Sans",Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;margin:0;padding:20px;box-sizing:border-box}.spinner{width:36px;height:36px;border:4px solid #e0e0e0;border-top:4px solid #1a73e8;border-radius:50%;animation:spin .8s linear infinite;margin-bottom:16px}@keyframes spin{to{transform:rotate(360deg)}}.message{font-size:14px;color:#333;text-align:center}.done{color:#1e8e3e;font-weight:500}.error{color:#d93025;font-weight:500}</style>' +
            '<div class="spinner" id="spinner"></div><div class="message" id="msg">' +
            message +
            "</div>" +
            '<script>google.script.run.withSuccessHandler(function(r){document.getElementById("spinner").style.display="none";var m=document.getElementById("msg");m.className="message done";m.innerText="Listo! "+(r||"");setTimeout(function(){google.script.host.close();},1800);}).withFailureHandler(function(err){document.getElementById("spinner").style.display="none";var m=document.getElementById("msg");m.className="message error";m.innerText="Error: "+err.message;setTimeout(function(){google.script.host.close();},4000);}).' +
            serverFn +
            "();</script>",
    )
        .setWidth(360)
        .setHeight(160);
    SpreadsheetApp.getUi().showModalDialog(html, "Asistencia — Backfill");
}

function setupInstallable() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!validateHoja2()) {
        ss.toast(
            "⚠️ Hoja2 no accesible — verificá Hoja2!A1:B12 y D1:E7 antes de autorizar.",
            "Asistencia",
            7,
        );
        Logger.log("setupInstallable blocked: Hoja2 invalid");
        return;
    }
    ensureRegistroHeader();
    ensureConfigSheet();
    ensureErrorsSheet();
    const existing = ScriptApp.getProjectTriggers().filter(function (t) {
        return t.getHandlerFunction() === "handleEdit";
    });
    if (existing.length > 0) {
        ss.toast(
            "🔒 Autorización ya activa (" + existing.length + " trigger(s)).",
            "Asistencia",
            5,
        );
        return;
    }
    ScriptApp.newTrigger("handleEdit").forSpreadsheet(ss).onEdit().create();
    ss.toast("🔒 Autorización concedida — handleEdit instalado como owner.", "Asistencia", 5);
    logToErrors("", "", "", "autorizar_ok_installable_created");
}

// --- CALENDAR CHANGE — FR-006/EC-14 — confirm + reload from Registro (simple trigger only) ---

function handleCalendarChange(e) {
    const ss = e && e.source ? e.source : SpreadsheetApp.getActiveSpreadsheet();
    try {
        const sheet = e.range.getSheet();
        const name = sheet.getName();
        if (isIgnorableSheet(name) || name === CONFIG.APOYO_SHEET) return;
        if (!validateHoja2()) {
            ss.toast("⚠️ Hoja2 no accesible — verificá Hoja2!A1:B12 y D1:E7.", "Asistencia", 7);
            return;
        }
        const section = resolveSection(sheet);
        if (!section) {
            ss.toast(
                "⚠️ Sección no mapeada en Config!A:B — sin escritura. Mapeá sheetId o nombre.",
                "Asistencia",
                7,
            );
            logToErrors(name, e.range.getA1Notation(), "", "section_unmapped_calendar");
            return;
        }
        const ym = getYearMonth(sheet);
        const yearNum = parseInt(String(ym.y).trim(), 10);
        const monthName = String(ym.m).trim();
        if (!yearNum || isNaN(yearNum) || !monthName) {
            Logger.log("handleCalendarChange: invalid year/month y=" + ym.y + " m=" + ym.m);
            return;
        }
        let monthNum = null;
        try {
            const v9Val = String(
                sheet.getRange("V9").getDisplayValue() || sheet.getRange("V9").getValue(),
            ).trim();
            const n = parseInt(v9Val, 10);
            if (n >= 1 && n <= 12) monthNum = n;
        } catch (err) {}
        if (!monthNum) {
            try {
                const hoja2 = ss.getSheetByName("Hoja2");
                if (hoja2) {
                    const months = hoja2.getRange("A1:B12").getValues();
                    for (let i = 0; i < months.length; i++) {
                        if (String(months[i][0]).trim().toLowerCase() === monthName.toLowerCase()) {
                            monthNum = parseInt(String(months[i][1]).trim(), 10);
                            break;
                        }
                    }
                }
            } catch (err2) {}
        }
        if (!monthNum || isNaN(monthNum)) {
            ss.toast("⚠️ Mes no válido: " + monthName, "Asistencia", 5);
            return;
        }
        const displayMonthYear = monthName + " " + yearNum;
        const ui = SpreadsheetApp.getUi();
        const resp = ui.alert(
            "¿Cambiaste a " +
                displayMonthYear +
                ", recargar desde Registro? Esto limpiará E15:AI44 y cargará los registros de ese mes desde Registro.",
            ui.ButtonSet.YES_NO,
        );
        if (resp !== ui.Button.YES) {
            return;
        }
        const rows = CONFIG.INPUT_ROW_END - CONFIG.INPUT_ROW_START + 1;
        const cols = CONFIG.INPUT_COL_END - CONFIG.INPUT_COL_START + 1;
        // Ensure calendar formulas (E11:AI11) have recalculated after S7/S9 edit
        SpreadsheetApp.flush();
        Utilities.sleep(400);
        const inputRange = sheet.getRange(
            CONFIG.INPUT_ROW_START,
            CONFIG.INPUT_COL_START,
            rows,
            cols,
        );
        inputRange.clearContent();
        inputRange.clearNote();
        SpreadsheetApp.flush();

        const reg = ss.getSheetByName(CONFIG.REGISTRO);
        if (!reg || reg.getLastRow() < 2) {
            ss.toast(
                "✅ " + section + " limpiado — no hay registros para " + displayMonthYear,
                "Asistencia",
                7,
            );
            logToErrors(
                section,
                name + "!E15:AI44",
                "",
                "calendar_reload_empty_" + yearNum + "-" + monthNum,
            );
            return;
        }
        const regVals = reg.getRange(2, 1, reg.getLastRow() - 1, CONFIG.HEADER.length).getValues();
        const operatorRows = sheet.getRange(CONFIG.INPUT_ROW_START, 3, rows, 1).getValues();
        const opNameToRows = {};
        for (let i = 0; i < operatorRows.length; i++) {
            const op = String(operatorRows[i][0] || "").trim();
            if (!op) continue;
            if (!opNameToRows[op]) opNameToRows[op] = [];
            opNameToRows[op].push(CONFIG.INPUT_ROW_START + i);
        }
        const e11Row = sheet.getRange(11, CONFIG.INPUT_COL_START, 1, cols).getDisplayValues()[0];
        const isoToCol = {};
        for (let c = 0; c < e11Row.length; c++) {
            const iso = parseE11ToIso(e11Row[c]);
            if (iso) isoToCol[iso] = CONFIG.INPUT_COL_START + c;
        }
        const grid = [];
        for (let r = 0; r < rows; r++) {
            grid[r] = [];
            for (let c = 0; c < cols; c++) grid[r][c] = "";
        }
        const notesPending = [];
        let matched = 0;
        for (let i = 0; i < regVals.length; i++) {
            const row = regVals[i];
            const rSection = String(row[3] || "").trim();
            if (rSection !== section) continue;
            let rDateRaw = row[5];
            let rDateStr = "";
            if (rDateRaw instanceof Date && !isNaN(rDateRaw)) {
                rDateStr = Utilities.formatDate(rDateRaw, CONFIG.TIMEZONE, "yyyy-MM-dd");
            } else {
                rDateStr = String(rDateRaw || "").trim();
                // Normalize D/M/YYYY or ISO to ISO
                if (rDateStr.indexOf("/") !== -1) {
                    const normalized = parseE11ToIso(rDateStr) || parseApoyoDateToIso(rDateStr);
                    if (normalized) rDateStr = normalized;
                }
            }
            if (!rDateStr) continue;
            const status = String(row[12] || "").trim();
            if (status === "void") continue;
            const parts = rDateStr.split("-");
            if (parts.length !== 3) continue;
            const rYear = parseInt(parts[0], 10);
            const rMonth = parseInt(parts[1], 10);
            if (rYear !== yearNum || rMonth !== monthNum) continue;
            const opName = String(row[4] || "").trim();
            const code = String(row[6] || "").trim();
            const nota = String(row[11] || "").trim();
            if (!opName || !code) continue;
            const targetRows = opNameToRows[opName];
            if (!targetRows || targetRows.length === 0) continue;
            const targetCol = isoToCol[rDateStr];
            if (!targetCol) continue;
            const tRow = targetRows[0];
            const rIdx = tRow - CONFIG.INPUT_ROW_START;
            const cIdx = targetCol - CONFIG.INPUT_COL_START;
            grid[rIdx][cIdx] = code;
            if (nota) notesPending.push({ row: tRow, col: targetCol, nota: code + " — " + nota });
            matched++;
        }
        if (matched > 0) {
            sheet
                .getRange(CONFIG.INPUT_ROW_START, CONFIG.INPUT_COL_START, rows, cols)
                .setValues(grid);
            for (let n = 0; n < notesPending.length; n++) {
                try {
                    sheet
                        .getRange(notesPending[n].row, notesPending[n].col)
                        .setNote(notesPending[n].nota);
                } catch (err3) {
                    Logger.log("handleCalendarChange setNote fail: " + err3.message);
                }
            }
            SpreadsheetApp.flush();
            ss.toast(
                "✅ " + section + " recargado: " + matched + " registros de " + displayMonthYear,
                "Asistencia",
                7,
            );
            logToErrors(
                section,
                name + "!E15:AI44",
                "",
                "calendar_reload_ok_" + displayMonthYear + "_" + matched,
            );
        } else {
            ss.toast(
                "✅ " + section + " limpiado — no hay registros para " + displayMonthYear,
                "Asistencia",
                7,
            );
            logToErrors(
                section,
                name + "!E15:AI44",
                "",
                "calendar_reload_empty_" + displayMonthYear,
            );
        }
    } catch (err) {
        Logger.log("handleCalendarChange error: " + err.message + " stack: " + err.stack);
        try {
            const ss2 = e && e.source ? e.source : SpreadsheetApp.getActiveSpreadsheet();
            ss2.toast("❌ Error al recargar: " + err.message, "Asistencia", 7);
        } catch (e2) {}
    }
}

// --- DUAL TRIGGER: simple onEdit (toast-only, never writes) + installable handleEdit ---

function onEdit(e) {
    try {
        if (!e || !e.range) return;
        const sheet = e.range.getSheet();
        const name = sheet.getName();
        if (isIgnorableSheet(name)) return;
        if (isCalendarRange(e.range)) {
            handleCalendarChange(e);
            return;
        }
        if (name === CONFIG.APOYO_SHEET) {
            if (!isApoyoRange(e.range)) return;
            if (!validateHoja2()) {
                e.source.toast("⚠️ Hoja2 no accesible — sin validación.", "Asistencia", 5);
                return;
            }
            // Apoyo is growing table A3:E — no code validation (default A)
            return;
        }
        if (!rangeIntersectsInput(e.range)) return;
        if (!validateHoja2()) {
            e.source.toast(
                "⚠️ Hoja2 no accesible — sin validación de calendario.",
                "Asistencia",
                5,
            );
            return;
        }
        const section = resolveSection(sheet);
        if (!section) return;
        const r1 = Math.max(e.range.getRow(), CONFIG.INPUT_ROW_START);
        const r2 = Math.min(e.range.getRow() + e.range.getNumRows() - 1, CONFIG.INPUT_ROW_END);
        const c1 = Math.max(e.range.getColumn(), CONFIG.INPUT_COL_START);
        const c2 = Math.min(
            e.range.getColumn() + e.range.getNumColumns() - 1,
            CONFIG.INPUT_COL_END,
        );
        if (r1 > r2 || c1 > c2) return;
        const e11Row = sheet
            .getRange(
                11,
                CONFIG.INPUT_COL_START,
                1,
                CONFIG.INPUT_COL_END - CONFIG.INPUT_COL_START + 1,
            )
            .getDisplayValues()[0];
        const values = sheet.getRange(r1, c1, r2 - r1 + 1, c2 - c1 + 1).getValues();
        let invalid = 0;
        for (let r = 0; r < values.length; r++) {
            for (let c = 0; c < values[r].length; c++) {
                const colIdx = c1 + c;
                const e11Disp = e11Row[colIdx - CONFIG.INPUT_COL_START];
                const iso = parseE11ToIso(e11Disp);
                if (!iso) continue;
                const raw = values[r][c];
                const code = String(raw == null ? "" : raw).trim();
                if (code === "") continue;
                if (!isCodeValid(code)) invalid++;
            }
        }
        if (invalid > 0) {
            e.source.toast("⚠️ Código no válido. Use A, AT, BM o F.", "Asistencia", 5);
        }
    } catch (err) {
        Logger.log("onEdit toast-only error: " + err.message);
    }
}
