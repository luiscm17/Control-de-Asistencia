# Yarn Settings Apps Script

This isolated Apps Script project saves the `Settings` form into auditable Yarn database sheets. Deploy it only to an authenticated **copy** of the Yarn workbook; never use the production workbook for setup or verification.

## Deploy to a workbook copy

1. Make a copy containing `Settings`, `DB_Asignaciones`, `DB_Descargas`, and `Errors`.
2. In the copy, open **Extensions → Apps Script** and create a standalone project containing this directory's `.gs` files and `appsscript.json`.
3. Run `yarnSetupYarnSettings` once from the editor, then authorize the requested Sheets, UI, trigger, and user-email scopes. This creates or reconciles the DB headers, form validation, `Settings!K2` checkbox, and one installable `yarnSettingsOnEdit` trigger.
4. Reload the workbook. The **Yarn** menu exposes `Guardar Turno`, both DB views, and `Re-sincronizar Settings`.

The installer is idempotent: rerunning it does not add another K2 edit trigger. If the mobile checkbox stops reacting after a copied deployment, run **Yarn → Re-sincronizar Settings** while authorized.

## Save controls

- **Desktop:** choose **Yarn → Guardar Turno**.
- **Desktop and mobile:** tick the native data-validation checkbox at `Settings!K2`. Its adjacent `L2` label is `☑ GUARDAR TURNO`.

The installable handler recognizes only `Settings!K2` becoming `TRUE`, calls public `guardarTurno()`, waits about one second, and resets K2 to `FALSE` whether saving succeeds or fails. There is no drawing button.

## Save contract

`guardarTurno()` validates the complete form before taking a document lock. It retries a 5-second lock acquisition once, loads current DB state, applies one mutation plan, flushes, and shows a success toast containing the date, assignment count, weighing count, and net kilograms.

Input is limited to `Settings!C33:E42` and `Settings!E50:H157`; calculator and summary ranges are never persisted. Dates display as `dd/MM/yyyy`; audit timestamps use `America/La_Paz`.

| Sheet | Primary key | Frozen columns |
|---|---|---|
| `DB_Asignaciones` | `(fecha, retorcedora)` | A:M |
| `DB_Descargas` | `(fecha, retorcedora, descarga_nro, lado)` | A:O |
| `Errors` | Append-only evidence | A:F |

Re-saving updates the matching row while preserving `creado` and refreshing `actualizado`, `editado_por`, and `rango_origen`. Clearing a visible weighing's gross weight then saving removes only that weighing PK. Failures attempt best-effort `Errors` evidence and show a failure toast.

## Re-sync and rollback

Use **Yarn → Re-sincronizar Settings** after a copied workbook changes its form validation, DB headers, or K2 trigger. It restores the frozen headers, date/title validation, checkbox, and the single installable edit trigger without clearing form data.

To roll back a deployment, delete the `yarnSettingsOnEdit` installable trigger, remove the Yarn Apps Script project/menu deployment, and retain DB rows for audit. If a data correction is necessary, use the workbook copy's version history or review and remove only rows created by the affected deployment.
