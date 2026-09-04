# Yarn Production — Product Requirements Document

| Field | Value |
|-------|-------|
| **Version** | 0.1.0 |
| **Date** | 2026-09-04 |
| **Status** | Draft — primera version, sin commits previos |
| **Source** | `docs/yarn-production/PRODUCCION.xlsx` y Google Sheet `1fgkSf8xGSEAbYL3gM29xRizMoqnKqbpB` — hoja `produccion` |
| **Repo** | `Control-de-Asistencia` (mismo repo, proyecto independiente) |
| **Evidence** | `xleak` + verificacion live `playwright-cli` (2026-09-04) |

## 1. Resumen Ejecutivo

Registro diario de produccion por turno en la hoja `produccion`. La hoja funciona como formulario reutilizable y su contenido se persiste en la tabla `produccion`.

**Solucion:** Un unico boton `Guardar` persiste cualquiera de los tres turnos (`DIA`, `TARDE`, `NOCHE`), incluso si fue editado (upsert). La fecha en `G2` (formato `d/M/yyyy`, con validacion nativa en Sheets) controla que datos se muestran: al cambiar de fecha, si existen registros se cargan; si no, el formulario queda limpio listo para registrar. Las filas `TOTAL` y `TOTAL PRODUCTO TERMINADO` son calculadas y no se persisten.

## 2. Estado Actual Verificado (live)

### 2.1 Hoja

| Hoja | Estado |
|------|--------|
| `produccion` | Unica hoja. Titulo en `C4:H4` merged, cabecera en `C5:L5`, datos desde `C6`. Fecha en `G2` con formato `d/M/yyyy` y validacion en Sheets |

### 2.2 Estructura de `produccion`

| Rango (live) | Valor / Formula | Descripcion |
|--------------|-----------------|-------------|
| `G2` | `d/M/yyyy` (ej. `1/8/2026`) | Fecha del parte. Validacion nativa en Sheets |
| `C4:H4` | `Registro de Produccion` (merged) | Titulo |
| `C5:L5` | `TURNO \| FINISOR \| RETORCIDO \| MADEJERAS \| TINTORERIA \| SECADO \| DEVANADO \| EMBOLSADO \| OVILLADO \| MADEJITAS` | Cabecera |
| `C6:L6` | `DIA \| 850 \| 0 \| 0 \| 408 \| 1020 \| 912 \| 200 \| 303.5 \| 0` | Turno DIA |
| `C7:L7` | `TARDE \| 1326 \| 799.33 \| 683.5 \| 1020 \| 1020 \| 14278 \| 324 \| 510.5 \| 0` | Turno TARDE |
| `C8:L8` | `NOCHE \| 1403 \| 1471.4 \| 1492.3 \| 1020 \| 816 \| 671 \| 408 \| 431.2 \| 0` | Turno NOCHE |
| `C9:L9` | `TOTAL \| SUM(D6:D8)` | Total diario por proceso — no se persiste |
| `C10` + `J10` | `TOTAL PRODUCTO TERMINADO \| SUM(J9:L9)` | Total producto terminado — no se persiste |

### 2.3 Regla de Carga

Cada fila `DIA`, `TARDE` y `NOCHE` corresponde a un turno y se completa en su momento. La columna `TURNO` contiene valores fijos (`DIA`, `TARDE`, `NOCHE`) y no requiere validacion adicional.

## 3. Objetivos

**Objetivos v1:**
- Formulario reutilizable con el mismo layout
- Base de datos consultable por `fecha`, `turno` y `proceso`
- Un unico boton `Guardar` para cualquier turno, incluso ediciones (upsert idempotente por `fecha + turno`)
- Navegacion por fecha en `G2`: carga automatica si hay datos, formulario limpio si es fecha nueva
- Campo `editado_por` para trazabilidad
- Validaciones en Sheets (`G2` fecha, rangos numericos)

**Fuera de alcance v1:**
- Dashboards y reportes graficos
- Integraciones externas
- Validacion de negocio avanzada en Apps Script

## 4. Solucion Propuesta

```
Hoja produccion (formulario, G2 fecha) --[Guardar]--> Apps Script (upsert por fecha+turno, LockService) --> Tabla produccion (PK fecha, turno)
        ^-- onEdit G2 -- carga registros existentes o limpia formulario --'
```

- `G2` controla la vista. `onEdit` en `G2` dispara lectura de la tabla para esa fecha: si hay filas, puebla `C6:L8`; si no, limpia `D6:L8`.
- El boton `Guardar` recorre `C6:L8` (las tres filas de turno) y hace upsert por cada fila con datos. Permite guardar un turno nuevo o sobrescribir uno editado con una sola accion.

## 5. Requerimientos Funcionales

| ID | Requerimiento | Prioridad |
|----|---------------|-----------|
| FR-001 | Hoja `produccion` como formulario reutilizable. Fecha en `G2` (`d/M/yyyy`), cabecera `C5:L5`, turnos `C6:L8`, formulas `C9:L9` y `J10` como referencia. | Must |
| FR-002 | Tabla `produccion` con encabezados §6. Orden fijo. | Must |
| FR-003 | Unico boton `Guardar` que persiste cualquiera de los tres turnos, incluso si fueron editados. Itera `C6:L8`, y por cada fila con al menos un valor numerico hace upsert por `(fecha G2, turno de columna C)`. | Must |
| FR-004 | Upsert idempotente por `(fecha, turno)`. No se persisten filas con `turno = TOTAL`. | Must |
| FR-005 | `G2` con validacion y formato `d/M/yyyy` nativo en Sheets. | Must |
| FR-006 | Al cambiar `G2`: si existen registros para esa fecha en la tabla, cargarlos en `C6:L8`; si no existen, limpiar `D6:L8` dejando el formulario listo para registro. Soporta navegacion a fecha anterior (carga) y a fecha posterior/nueva (limpio). | Must |
| FR-007 | Campos de auditoria: `registrado_por` (insert), `editado_por` y `actualizado` (cada upsert), `creado`. Zona horaria `America/La_Paz`. | Must |
| FR-008 | Campo `total_producto_terminado` por turno = `embolsado + ovillado + madejitas`. | Should |
| FR-009 | Validaciones en Sheets para rangos de procesos numerico `>= 0`. | Must |
| FR-010 | Concurrencia con `LockService.getDocumentLock()` (timeout 5s, un reintento). | Must |
| FR-011 | Menu `Produccion > Guardar | Ver produccion | Limpiar Formulario` y `onOpen`. | Should |

## 6. Modelo de Datos — tabla `produccion`

### 6.1 Columnas (orden fijo, sin `dia_semana`)

| # | Header | Tipo | Ejemplo | Descripcion |
|---|--------|------|---------|-------------|
| A | `id` | STRING | `2026-08-01-DIA` | Clave `fecha-turno` |
| B | `fecha` | DATE | `2026-08-01` | Fecha del parte (desde `G2`, `d/M/yyyy`) |
| C | `turno` | STRING | `DIA` | Valores fijos `DIA`, `TARDE`, `NOCHE` (columna `C6:C8` del formulario, sin enum adicional) |
| D | `finisor` | NUMBER | `850` |  |
| E | `retorcido` | NUMBER | `0` |  |
| F | `madejeras` | NUMBER | `0` |  |
| G | `tintoreria` | NUMBER | `408` |  |
| H | `secado` | NUMBER | `1020` |  |
| I | `devanado` | NUMBER | `912` |  |
| J | `embolsado` | NUMBER | `200` |  |
| K | `ovillado` | NUMBER | `303.5` |  |
| L | `madejitas` | NUMBER | `0` |  |
| M | `total_producto_terminado` | NUMBER | `503.5` | `embolsado + ovillado + madejitas` |
| N | `registrado_por` | STRING | `usuario@factory.bo` | Usuario en la creacion |
| O | `editado_por` | STRING | `usuario@factory.bo` | Ultimo usuario que actualizo |
| P | `creado` | DATETIME | `2026-09-04 10:00:00` | `America/La_Paz` |
| Q | `actualizado` | DATETIME | `2026-09-04 14:30:00` | `America/La_Paz` |

### 6.2 Clave Primaria

`(fecha, turno)` = `id`. `findRow(id) -> update else append`. Correcciones con el mismo boton actualizan el registro existente.

### 6.3 Volumen

3 turnos/dia x 365 = 1.095 registros/ano.

## 7. Reglas de Negocio

| # | Caso | Regla |
|---|------|-------|
| EC-01 | Fila `TOTAL` | No se persiste |
| EC-02 | `TOTAL PRODUCTO TERMINADO` | No se persiste como fila; se calcula en columna `M` |
| EC-03 | `G2` vacia o invalida | No se guarda. Mensaje: `Seleccione una fecha valida en G2.` |
| EC-04 | Cambio de `G2` a fecha con datos | Carga `D6:L8` desde la tabla para esa fecha |
| EC-05 | Cambio de `G2` a fecha sin datos | Limpia `D6:L8`, listo para registro |
| EC-06 | Celda de proceso vacia | Se interpreta como `0` |
| EC-07 | Guardar turno editado | Upsert actualiza registro, modifica `editado_por` y `actualizado` |
| EC-08 | Concurrencia | `LockService` con reintento |

## 8. Flujo

**Guardar (unico boton):**
1. Usuario selecciona fecha en `G2` y completa una o varias filas de turno.
2. Ejecuta `Guardar`.
3. Sistema valida `G2`, adquiere lock, hace upsert por cada turno con datos y confirma (ej. `3 turnos guardados — DIA actualizado, TARDE insertado`).

**Navegacion por fecha:**
1. Usuario cambia `G2` de `1/8/2026` a `31/7/2026`.
2. `onEdit` detecta `G2`, busca en tabla `fecha = 2026-07-31`.
3. Si hay datos, puebla `C6:L8`; si no, limpia el formulario.

## 9. Proximos Pasos

| Paso | Entregable |
|------|------------|
| 1. Aprobacion PRD | Documento actual |
| 2. Crear tabla `produccion` con §6 y validaciones en `G2` | Hoja configurada |
| 3. Apps Script (`Guardar`, `onEdit G2`, `onOpen`, `LockService`) | Script |
| 4. Verificacion en copia | Casos §7 validados |

*Fin PRD v0.1.0 — yarn-production. Primera version.*
