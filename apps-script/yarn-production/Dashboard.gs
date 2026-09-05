/**
 * Dashboard.gs — Native read-only yarn production dashboard setup
 */

function ensureDashboardSheet_() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName(DASHBOARD_SHEET);
    if (!sh) sh = ss.insertSheet(DASHBOARD_SHEET);

    sh.setFrozenRows(1);
    sh.setRowHeight(1, 28);
    sh.getRange("A1:F1").setValues([["Turno", "", "Sección", "", "Período", ""]]);
    sh.getRange("A1").setFontWeight("bold");
    sh.getRange("C1").setFontWeight("bold");
    sh.getRange("E1").setFontWeight("bold");
    applyDashboardValidations_(sh);
    buildDashboardCardFormulas_(sh);
    buildAuxiliaryQuery_(sh);
    applyDashboardFocusFormat_(sh);
    ensureDashboardCharts_(sh);
    return sh;
}

function applyDashboardValidations_(sh) {
    const shiftRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(["Todos"].concat(YARN_CONFIG.SHIFTS), true)
        .setAllowInvalid(false)
        .build();
    const focusRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(["Todas"].concat(YARN_CONFIG.PROCESS_FIELDS), true)
        .setAllowInvalid(false)
        .build();
    const periodRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(DASHBOARD_PERIOD_OPTIONS, true)
        .setAllowInvalid(false)
        .build();
    sh.getRange(DASHBOARD_FILTER_RANGES.SHIFT).setDataValidation(shiftRule);
    sh.getRange(DASHBOARD_FILTER_RANGES.FOCUS).setDataValidation(focusRule);
    sh.getRange(DASHBOARD_FILTER_RANGES.PERIOD).setDataValidation(periodRule);
}

function buildDashboardCardFormulas_(sh) {
    const fields = YARN_CONFIG.PROCESS_FIELDS.concat(["total_producto_terminado"]);
    const labels = fields.map(function (field) {
        return field.replace(/_/g, " ");
    });
    const formulas = fields.map(function (field) {
        const column = DASHBOARD_CARD_RANGE[field];
        return (
            "=IFERROR(SUM(FILTER(datos_produccion!$" +
            column +
            "$2:$" +
            column +
            ',datos_produccion!$A$2:$A<>""' +
            ',IF($F$1="Histórico",ROW(datos_produccion!$B$2:$B)>0,IF($F$1="Mes actual",(MONTH(datos_produccion!$B$2:$B)=MONTH(TODAY()))*(YEAR(datos_produccion!$B$2:$B)=YEAR(TODAY())),IF($F$1="Últimos 7 días",datos_produccion!$B$2:$B>=TODAY()-7,ROW(datos_produccion!$B$2:$B)>0)))' +
            ',IF(OR($B$1="",$B$1="Todos"),ROW(datos_produccion!$C$2:$C)>0,datos_produccion!$C$2:$C=$B$1))),0)'
        );
    });

    sh.getRange(3, 4, 1, labels.length).setValues([labels]);
    sh.getRange(3, 4, 1, labels.length).setFontWeight("bold").setHorizontalAlignment("center");
    sh.getRange(4, 4, 1, formulas.length).setFormulas([formulas]);
    sh.getRange(4, 4, 1, formulas.length).setNumberFormat(DASHBOARD_FORMAT);
}

function buildAuxiliaryQuery_(sh) {
    sh.getRange("A10:C10").setValues([["fecha", "daily", "cumulative"]]).setFontWeight("bold");
    // Simple daily + cumulative without period filter to avoid parse errors - G2 uses this
    sh.getRange("A11").setFormula('=IFERROR(QUERY(datos_produccion!A:Q,"select B,sum(M) where B is not null group by B order by B asc label B \'\',sum(M) \'\'",0),"")');
    sh.getRange("C11").setFormula('=IFERROR(ARRAYFORMULA(IF(B11:B="","",SUMIF(ROW(B11:B),"<="&ROW(B11:B),B11:B))),"")');
    sh.getRange("A11:A200").setNumberFormat("d/M/yyyy");
    sh.getRange("B11:C200").setNumberFormat(DASHBOARD_FORMAT);
    buildDashboardShiftChartData_(sh);
}

function buildDashboardShiftChartData_(sh) {
    // Simple pivot for G3 - Total por turno (compares per day between shifts)
    // Period filter is via cards, G3 shows full history pivot (no parse errors)
    sh.getRange("N10:Q10").setValues([["fecha", "DIA", "TARDE", "NOCHE"]]);
    sh.getRange("N11").setFormula('=IFERROR(QUERY(datos_produccion!A:Q,"select B,sum(M) where B is not null group by B pivot C",0),"")');
    sh.getRange("N11:Q200").setNumberFormat(DASHBOARD_FORMAT);
}


function applyDashboardFocusFormat_(sh) {
    const cardRange = sh.getRange("D3:L4");
    const rules = sh.getConditionalFormatRules().filter(function (rule) {
        return rule.getRanges().every(function (range) {
            return range.getA1Notation() !== "D3:L4";
        });
    });
    rules.push(
        SpreadsheetApp.newConditionalFormatRule()
            .whenFormulaSatisfied('=AND($D$1=D$3,$D$1<>"Todas")')
            .setBackground("#fff2cc")
            .setRanges([cardRange])
            .build(),
    );
    sh.setConditionalFormatRules(rules);
}

function ensureDashboardCharts_(sh) {
    sh.getCharts().forEach(function (chart) {
        sh.removeChart(chart);
    });
    const sectionChart = sh
        .newChart()
        .setChartType(Charts.ChartType.BAR)
        .addRange(sh.getRange("D3:L4"))
        .setTransposeRowsAndColumns(true)
        .setNumHeaders(1)
        .setOption("legend", { position: "none" })
        .setOption("title", "Total por sección")
        .setPosition(1, 7, 0, 0)
        .build();
    const cumulativeChart = sh
        .newChart()
        .setChartType(Charts.ChartType.LINE)
        .addRange(sh.getRange("A10:C200"))
        .setNumHeaders(1)
        .setOption("title", "Producción acumulada")
        .setPosition(18, 7, 0, 0)
        .build();
    const shiftChart = sh
        .newChart()
        .setChartType(Charts.ChartType.BAR)
        .addRange(sh.getRange("N10:Q200"))
        .setNumHeaders(1)
        .setOption("isStacked", true)
        .setOption("title", "Total por turno")
        .setPosition(35, 7, 0, 0)
        .build();
    sh.insertChart(sectionChart);
    sh.insertChart(cumulativeChart);
    sh.insertChart(shiftChart);
}
