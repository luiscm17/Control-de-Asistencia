# Lotes — Product Requirements Document

| Field | Value |
|-------|-------|
| **Version** | 0.1.0 |
| **Date** | 2026-09-22 |
| **Status** | Draft |
| **Source** | Google Sheet `19lBJHHKsusI6Eqkni-zh8us6ePoEHscEgrIPrFK-zhE` — hoja `lotes-form` (gid `1098679039`) |
| **Repo** | `Control-de-Asistencia` — proyecto aislado `apps-script/lotes/` |

## 1. Resumen Ejecutivo

Seguimiento diario de lotes por fecha en la hoja `lotes-form`. La hoja funciona como formulario reutilizable y su contenido se persiste en la tabla `db_lots`.

**Solucion:** Un checkbox en `F4` (`FALSE→TRUE`) dispara `guardarLotes()` con upsert idempotente por `fecha` + posicion de fila. La fecha en `D4` con formato `dd/MM/yyyy` nativo de Sheets (sin validacion ni transformacion en Script, `getValue()` directo) controla la vista: al cambiar `D4` o ejecutar `Resincronizar`, si existen registros para esa fecha se cargan en `B8:G37`; si no, el formulario queda limpio. `America/La_Paz` solo para auditoria (`actualizado`, `creado_por`).

## 2. Estado Actual Verificado (live `playwright-cli` + `export?format=csv`)

### 2.1 Hoja

| Hoja | Estado |
|------|--------|
| `lotes-form` | Unica hoja de interes. Titulo `C2=Seguimiento de lotes`, fecha `D4` formato `dd/MM/yyyy`, cabecera `B7:G7`, datos `B8:G37` (30 filas). Checkbox destino `F4`. |
| `db_lots` | Tabla destino a crear (no existe aun). |
| `items` | Catalogo existente `A=color, B=titulo, C=tipo-material` — no se persiste, solo referencia. |

### 2.2 Estructura de `lotes-form`

| Rango (live) | Valor | Descripcion |
|--------------|-------|-------------|
| `C2` | `Seguimiento de lotes` | Titulo |
| `C4` | `Fecha` | Label |
| `D4` | `21/09/2026` — tipo `DATE` con formato `dd/MM/yyyy` nativo Sheets | Fecha del parte. Sin validacion/transformacion en Script — `getValue()` directo |
| `F4` | `FALSE` (checkbox) | Trigger de guardado. `FALSE→TRUE` ejecuta guardado y al finalizar se resetea a `FALSE` |
| `B7:G7` | `No | Titulo | Tipo Material | Codigo Lote | Color | Observacion` | Cabecera fija |
| `B8:G37` | `B=No (1..30) | C=Titulo | D=Tipo Material | E=Codigo Lote | F=Color | G=Observacion` | Zona editable (ej. `R8: 1 | 2/24 | HB | | MOSTASA |`) — `No` es solo correlativo visual, no se persiste en `db_lots` |

> `D4` tiene formato `dd/MM/yyyy` nativo de Sheets. No se valida ni transforma en Apps Script. `F4` es checkbox insertado via `Insertar > Casilla de verificacion`.

## 3. Objetivos

**Objetivos v1:**
- Formulario reutilizable con el mismo layout (`B8:G37`)
- Tabla `db_lots` consultable por `fecha` (`dd/MM/yyyy`)
- Checkbox `F4` persiste todas las filas con contenido (upsert idempotente por `fecha` + posicion de fila)
- Navegacion por fecha en `D4`: carga automatica si hay datos, formulario limpio si es fecha nueva
- Auditoria `actualizado` + `creado_por` en `America/La_Paz`
- Sin validaciones de negocio en Script sobre `D4`

**Fuera de alcance v1:**
- Dashboards, graficos
- Integraciones externas
- Validacion avanzada de `items` en Script

## 4. Solucion Propuesta

```
lotes-form (formulario, D4 dd/MM/yyyy, F4 checkbox) --[F4 TRUE / Menu Guardar]--> Apps Script (upsert por fecha+posicion, LockService) --> db_lots (PK id = fecha-posicion)
         ^-- onEdit D4 / Menu Resincronizar -- carga registros existentes o limpia B8:G37 --'
```

- `D4` controla la vista. `onEdit` en `D4` o `Lotes > Resincronizar` lee `db_lots` para esa fecha (`dd/MM/yyyy`): si hay filas, puebla `B8:G37`; si no, limpia `C8:G37`.
- `F4 TRUE` (o Menu `Guardar`) recorre `B8:G37` y hace upsert por cada fila con al menos `Titulo` no vacio. Al finalizar resetea `F4=FALSE`. Re-guardar la misma fecha actualiza en sitio. `No` no se guarda.

## 5. Requerimientos Funcionales

| ID | Requerimiento | Prioridad |
|----|---------------|-----------|
| FR-001 | Hoja `lotes-form` como unico formulario. `D4` tipo `DATE` formato `dd/MM/yyyy`, `B7:G7` cabecera fija, `B8:G37` 30 filas editables, `F4` checkbox. | Must |
| FR-002 | Tabla `db_lots` con encabezados §6. Orden fijo. `fecha` con formato `dd/MM/yyyy`. Columna `No` del form no se persiste. | Must |
| FR-003 | Trigger de guardado: checkbox `F4 FALSE→TRUE` ejecuta `guardarLotes()`. Al finalizar (exito o error) resetea `F4=FALSE` sin disparar nuevo guardado. Menu `Lotes > Guardar` ejecuta la misma funcion. | Must |
| FR-004 | `D4` se lee con `getValue()` directo, sin validacion ni transformacion. Formato `dd/MM/yyyy` ya viene de Sheets. Si `D4` vacia al guardar → toast `Seleccione una fecha en D4.` y no escribe. | Must |
| FR-005 | Upsert idempotente por `id = fecha-posicion` (posicion 1..30 = fila `B8:B37`). Itera `B8:G37`; si `C` (Titulo) vacio → fila ignorada (no se persiste). Si fila existe en DB y ahora `C` vacio → **borra** esa fila de `db_lots`. `creado` se preserva en update, `actualizado` se refresca. `No` no se almacena. | Must |
| FR-006 | Rehidrate por fecha: `onEdit` en `D4` o `Lotes > Resincronizar` busca `fecha = D4` (`dd/MM/yyyy`) en `db_lots`. Si encuentra filas → escribe `C:G` en `B8:G37` correspondientes por posicion; filas sin registro quedan vacias. Si no encuentra → limpia `C8:G37` (deja `B8:B37` con `1..30`). | Must |
| FR-007 | Auditoria `America/La_Paz` solo para `actualizado` (timestamp `yyyy-MM-dd HH:mm:ss`) y `creado_por`/`actualizado_por` (email `Session.getActiveUser().getEmail()` o `unknown`). Usa `Utilities.formatDate(new Date(),"America/La_Paz","yyyy-MM-dd HH:mm:ss")`. | Must |
| FR-008 | Concurrencia con `LockService.getDocumentLock()` (timeout 5s, un reintento). | Must |
| FR-009 | Menu `Lotes > Guardar | Resincronizar` y `onOpen` que lo crea. Solo dos entradas. | Must |

## 6. Modelo de Datos — tabla `db_lots`

### 6.1 Columnas (orden fijo) — `No` no se persiste

| # | Header | Tipo | Ejemplo | Descripcion |
|---|--------|------|---------|-------------|
| A | `id` | STRING | `2026-09-21-1` | Clave `fecha-posicion` (`yyyy-MM-dd` + `-` + posicion 1..30, posicion = fila `B8:B37`) |
| B | `fecha` | DATE | `21/09/2026` | Fecha del parte (desde `D4`, formato `dd/MM/yyyy`) |
| C | `titulo` | STRING | `2/24` | `C8:C37` |
| D | `tipo_material` | STRING | `HB` | `D8:D37` |
| E | `codigo_lote` | STRING | `L-001` | `E8:E37` |
| F | `color` | STRING | `MOSTASA` | `F8:F37` |
| G | `observacion` | STRING | `` | `G8:G37` |
| H | `creado` | DATETIME | `2026-09-22 08:00:00` | Primera insercion (`America/La_Paz`) |
| I | `actualizado` | DATETIME | `2026-09-22 10:15:00` | Ultima modificacion (`America/La_Paz`) |
| J | `creado_por` | STRING | `usuario@factory.bo` | `Session.getActiveUser().getEmail()` en creacion |
| K | `actualizado_por` | STRING | `usuario@factory.bo` | Ultimo usuario que actualizo |

### 6.2 Clave Primaria

`id = fecha-posicion` (posicion 1..30 implicita por `B8:B37`). `findRow(id) -> update else append`. Re-guardar la misma fecha actualiza registros existentes y borra los que quedaron vacios. `No` es solo visual en el form.

### 6.3 Volumen

30 filas/dia * 365 = 10.950 registros/ano.

## 7. Reglas de Negocio

| # | Caso | Regla |
|---|------|-------|
| EC-01 | `D4` vacia al guardar | No se guarda. Toast `Seleccione una fecha en D4.` |
| EC-02 | Fila con `Titulo` vacio | No se persiste. Si existia para ese `id` (`fecha-posicion`) → se borra de `db_lots` |
| EC-03 | Cambio de `D4` a fecha con datos | Carga `C8:G37` desde `db_lots` para esa fecha (`dd/MM/yyyy`) |
| EC-04 | Cambio de `D4` a fecha sin datos | Limpia `C8:G37`, deja `B8:B37` con `1..30` |
| EC-05 | Checkbox `F4` | Solo `FALSE→TRUE` dispara guardado. Se resetea a `FALSE` con guard para no re-disparar `onEdit` |
| EC-06 | Guardar lote editado | Upsert actualiza `actualizado` / `actualizado_por` |
| EC-07 | Auditoria | Solo `actualizado` y `creado_por`/`actualizado_por` usan `America/La_Paz` |
| EC-08 | Concurrencia | `LockService` con reintento; si falla → toast `Ocupado, reintente con Resincronizar` |

## 8. Flujo

**Guardar (checkbox o menu):**
1. Usuario selecciona fecha en `D4` (`dd/MM/yyyy`) y completa filas en `B8:G37`.
2. Marca `F4=TRUE` o ejecuta `Lotes > Guardar`.
3. Sistema lee `D4` con `getValue()`, adquiere lock, hace upsert por cada fila con `Titulo`, resetea `F4=FALSE` y confirma `✅ Guardado: 21/09/2026 — 5 lotes`.

**Navegacion por fecha:**
1. Usuario cambia `D4` de `21/09/2026` a `20/09/2026` o ejecuta `Lotes > Resincronizar`.
2. `onEdit` detecta `D4` (o menu), busca en `db_lots` `fecha = D4` (`dd/MM/yyyy`).
3. Si hay datos, puebla `B8:G37`; si no, limpia `C8:G37`.

*Fin PRD v0.1.0 — lotes.*
