/**
 * Ingest.gs — Installable edit routing for selectors and explicit saves.
 */

function conerasOnEdit(event) {
  if (!event || !event.range) return;
  const range = event.range;
  const form = conerasGetSheet_(event.source, 'CONERA');
  if (!form || range.getSheet().getSheetId() !== form.getSheetId()) return;
  const a1 = range.getA1Notation();
  const rawValue = event.value === undefined ? range.getValue() : event.value;
  if (a1 === CONERAS_CONFIG.RANGES.SAVE_CHECKBOX && conerasIsChecked_(rawValue)) {
    try {
      guardarTurno();
    } finally {
      Utilities.sleep(1000);
      form.getRange(CONERAS_CONFIG.RANGES.SAVE_CHECKBOX).setValue(false);
    }
    return;
  }
  if ([CONERAS_CONFIG.RANGES.FECHA, CONERAS_CONFIG.RANGES.TURNO,
    CONERAS_CONFIG.RANGES.MAQUINA].indexOf(a1) !== -1) conerasHydrate_();
}

function conerasIsChecked_(value) {
  return value === true || String(value || '').toUpperCase() === 'TRUE' ||
    String(value || '').toUpperCase() === 'VERDADERO';
}
