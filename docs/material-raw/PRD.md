# Materia Prima — Control Camiones → db_materialrow — Product Requirements Document

| Field | Value |
|-------|-------|
| **Version** | 0.1.0 |
| **Date** | 2026-09-20 |
| **Status** | Draft |
| **Source** | Google Sheet `13vr2cJSG3Bukpd1Gk71--gMIme0Fe0n2HP9-mrhVrw0` — hojas `Control Camiones`, `Registro Diario` |
| **Repo** | `Control-de-Asistencia` — rama `material-raw` |

## 1. Resumen Ejecutivo

`Control Camiones` es el formulario del día. Registra fardos en `B7:H37` (31 filas, un día). `H7:H37` calcula `Total Kilos (kg)` por fardo. `Registro Diario` debe mostrar por día la sumatoria de ese total. Hoy `Registro Diario!B10` usa `INDICE('Control Camiones'!H7:H206;1)` — solo trae un fardo — y está acoplado vivo, por lo que al cambiar el día se pierde el histórico. Este PRD define el desacople vía `db_materialrow`.

## 2. Estado Actual

| Hoja | Rango relevante | Formato / Fórmula |
|------|-----------------|-------------------|
| `Control Camiones` | `D4` | Fecha nativa de Sheets, formato `dd/MM/yyyy` (ej. `19/09/2026`) — fecha del día a guardar |
| `Control Camiones` | `A6:H6` | `Día | N° Camión | Tipo Material | N° Partida | N° Bulto | Tipo/Peso Fardo | Cantidad Fardos | Total Kilos (kg)` |
| `Control Camiones` | `B7:H37` | Formulario del día (31 filas). `H7=SI(F7="";0;SI(F7="Fardo 400kg";400;200)*N(G7))` copiada hasta `H37` |
| `Registro Diario` | `A9:C9` | `Día | MP Consumida | Saldo MP` |
| `Registro Diario` | `A10=1`, `B10`, `C10` | `B10` hoy con `INDICE(...;1)` (incorrecto), `C10=SI(B10="";"";$B$7-B10)` |

Foco: solo `Control Camiones` como form (`B7:H37`) y `D4` como fecha del día. `db_materialrow` no existe y debe crearse.

## 3. Requerimientos Funcionales

| ID | Requerimiento | Prioridad |
|----|---------------|-----------|
| FR-001 | `Control Camiones` como formulario reutilizable. `D4` fecha nativa, cabecera `A6:H6`, datos `B7:H37`, `H7:H37` con fórmula `SI(F="";0;...)` | Must |
| FR-002 | Hoja `db_materialrow` con headers §4, orden fijo, fila 1 congelada. Sin fórmulas, solo valores. | Must |
| FR-003 | Checkbox `Guardar` en `Control Camiones` (celda `F4`, `FALSE→TRUE`, como en `yarn-settings`). Al activarse (`installable onEdit`), lee `D4` vía `getValue()` sin validar ni reformatear y persiste cada fila `B7:H37` con `F<>""` en `db_materialrow` con `fecha=D4` + campos + `total_kilos=H` + `actualizado`/`editado_por` auditoría. Tras guardar, resetea `F4=FALSE`. Idempotente por `fecha`. | Must |
| FR-004 | Rehidrate por `Fecha`. Al cambiar `D4` (edit de `D4`), si existe `fecha` en `db_materialrow`, poblar `B7:H37` desde `db_materialrow` filtrando por `fecha=D4`; si no existe, limpiar `B7:G37` dejando el form listo. Soporta navegar a fecha anterior (carga) y a fecha nueva (limpio). | Must |
| FR-005 | `Registro Diario!B10:B40` deja `INDICE` y pasa a leer de `db_materialrow` vía `SUMAR.SI` por fecha nativa. Con `A10=1,2,3` → `=SI.ERROR(SUMAR.SI(db_materialrow!$A$2:$A;FECHA(2026;9;$A10);db_materialrow!$I$2:$I);0)`; si `A10` ya es fecha nativa → `=SI.ERROR(SUMAR.SI(db_materialrow!$A$2:$A;$A10;db_materialrow!$I$2:$I);0)`. Copiar hacia abajo. | Must |
| FR-006 | Fecha de negocio (`D4` y `db_materialrow!A`) nunca se valida ni se convierte en Apps Script; se persiste tal cual `Date` nativo. `America/La_Paz` solo para `actualizado`/`editado_por` de auditoría. | Must |
| FR-007 | Concurrencia con `LockService.getDocumentLock()` (5s, un reintento) en guardado y rehidrate. | Must |
| FR-008 | Menú `Materia Prima → Guardar día | Resincronizar` y `onOpen` que crea el menú y valida `db_materialrow`. `Resincronizar` recarga `B7:H37` desde `db_materialrow` para `D4` actual (mismo comportamiento que rehidrate por `D4`). `db_materialrow` no se expone en menú. | Should |

## 4. Modelo de Datos — `db_materialrow`

### 4.1 Columnas (orden fijo, `A:K`)

| # | Header | Tipo | Ejemplo | Descripción |
|---|--------|------|---------|-------------|
| A | `fecha` | DATE (nativa, `dd/MM/yyyy`) | `19/09/2026` | Fecha del día — copiada tal cual de `Control Camiones!D4` vía `getValue()` |
| B | `dia` | NUMBER | `1` | `Control Camiones!A7` |
| C | `n_camion` | STRING | `CAM-301` | `B7` |
| D | `tipo_material` | STRING | `...` | `C7` |
| E | `n_partida` | STRING | `PART-9910` | `D7` |
| F | `n_bulto` | STRING | `BUL-701` | `E7` |
| G | `tipo_fardo` | STRING | `Fardo 400kg` | `F7` |
| H | `cantidad` | NUMBER | `1` | `G7` |
| I | `total_kilos` | NUMBER | `400` | `H7` |
| J | `actualizado` | DATETIME | `2026-09-19 22:10:00` | Auditoría — `America/La_Paz` |
| K | `editado_por` | STRING | `user@mail` | Auditoría — `Session.getActiveUser().getEmail()` |

PK lógica: `fecha` (un día = un guardado). Re-guardar la misma `fecha` reemplaza las filas de esa fecha (delete + append).

## 5. Reglas de Negocio

| # | Caso | Regla |
|---|------|-------|
| EC-01 | `D4` vacía | No se guarda. Mensaje `Seleccione una fecha válida en D4.` — sin parsear ni reformatear |
| EC-02 | Fila sin `tipo_fardo` (`F=""`) | Se ignora, aunque `H` sea 0. Solo `B7:H37` |
| EC-03 | `D4` fecha nativa | `const fecha = sheet.getRange("D4").getValue();` — ya es `Date`. Persistir tal cual en `db_materialrow!A`. No `Utilities.formatDate` para negocio. |
| EC-04 | Auditoría | `J/K` usan `America/La_Paz` (`actualizado` con `Utilities.formatDate(new Date(), "America/La_Paz", "yyyy-MM-dd HH:mm:ss")` y `editado_por` con `Session.getActiveUser().getEmail()`). Nunca para `fecha`. |
| EC-05 | Guardar fecha ya existente | Borra filas previas de esa `fecha` en `db_materialrow` y hace append de las nuevas (rehidrate idempotente) |
| EC-06 | Rehidrate sin datos | Limpia `B7:G37` (deja `H7:H37` con fórmula) — form listo para registro |
| EC-07 | Concurrencia | `LockService` con reintento, toast `⏳ ocupado` visible 8s |
| EC-08 | Toast | Toda notificación `toast` debe permanecer visible 8s (`SpreadsheetApp.getActive().toast(msg, title, 8)`) para poder leerse |
