# Coneras Production — Product Requirements Document

| Field | Value |
| ------- | ------- |
| **Version** | 0.1.0 |
| **Date** | 2026-09-07 |
| **Status** | Draft — primera version, sin commits previos |
| **Source** | Workbook `produccion-coneras` — hojas `dashboard` + `conera` |
| **Repo** | `Control-de-Asistencia` (mismo repo, proyecto independiente `apps-script/coneras-production/`) |

> §2 + §5 = 2-min version. §6–§9 = implementation detail.

## 1. Resumen Ejecutivo

Registro de produccion de coneras por turno y maquina — hasta 15 descargas por turno, con `peso_neto` derivado y consulta agregada por `titulo`, `turno`, `maquina`, `supervisor` y `periodo`.

| Need | Impact |
| ------ | -------- |
| Formulario parametrizado por `maquina`/`turno`/`fecha` | Unico punto de entrada, sin hojas por maquina |
| Formulario y DB separados | Datos consultables por periodo, no se pisa al cambiar filtros |
| DB consultable por `titulo`/`turno`/`maquina`/`supervisor`/`periodo` | Reportes sin abrir formularios |
| Agregacion via `QUERY` a DB | Desacoplado de la geometria del formulario |
| Auditoria de ultimo cambio | Trazable quien guardo |

**Solucion:** Hoja `conera` como formulario reutilizable (15 descargas max). Guardado explicito (`Coneras → Guardar Turno` + checkbox/boton) hace upsert idempotente por `(fecha, turno, maquina, descarga_nro)` en `db_coneras` con `LockService`. `dashboard` agrega desde `db_coneras` via `QUERY` directo con 4 filtros + `Fecha` condicional y dos graficas cuya visibilidad depende de `Periodo`.

## 2. Estructura de Hojas

### 2.1 Inventario de hojas (4 hojas)

| Sheet | Proposito | Tipo |
| ------- | ----------- | ------ |
| `dashboard` | Filtros + agregacion + graficas | Dashboard (solo lectura, formulas) |
| `conera` | Formulario unico — entrada diaria | Form (no tabla) |
| `db_coneras` | Descargas por `fecha/turno/maquina` | Tabla |
| `Errors` | Log opcional | Tabla |

### 2.2 Geometria de `conera`

| Rango | Valor / Formula (verbatim, `es-BO`) | Descripcion | Kind |
| ------- | -------------------------------------- | ------------- | ------ |
| `A1:H2` | `Coneras` (merged, banner) | Titulo del formulario | Label |
| `B4` | `Meta Ajustada Manual (Kg)` | Label meta manual | Label |
| `C4` | numero (ej. `120`) | Meta ajustada input | Input |
| `D4` | `Meta Real (con Eficiencia)` | Label meta real | Label |
| `E4` | `=SI(ESNUMERO(C4), C4*dashboard!B7, "")` | Meta real = manual × eficiencia | Formula |
| `F4` | `Turno` | Label | Label |
| `G4` | `Dia` \| `Tarde` \| `Noche` (dropdown) | Turno del parte | Input (dataValidation) |
| `B5` | `Maquina` | Label | Label |
| `C5` | `Autoconer 1` \| `Autoconer 2` \| `Autoconer 3` \| `Conera 3` \| `Conera 4` (dropdown, 5 valores) | Maquina | Input (dataValidation) |
| `D5` | `Fecha` | Label | Label |
| `E5` | `dd/MM/yyyy` (ej. `07/09/2026`) | Fecha del parte | Input (`DATE`, format `dd/MM/yyyy`) |
| `F5` | `Supervisor` | Label | Label |
| `G5` | dropdown supervisores | Supervisor del turno | Input (dataValidation) |
| `A7:H7` | `Nº \| Título \| Operador \| Peso Bruto \| Usos \| Peso Canilla \| Peso Tacho \| Peso Neto` | Cabecera (orden frozen) | Header |
| `A8:A22` | `1 … 15` | `descarga_nro` | Fijo |
| `B8:B22` | `Título` (texto) | Titulo/hilado | Input |
| `C8:C22` | `Operador` (texto) | Operador | Input |
| `D8:D22` | `Peso Bruto` (numero) | Bruto | Input |
| `E8:E22` | `Usos` (numero) | Usos cono | Input |
| `F8:F22` | `Peso Canilla` (numero) | Peso canilla | Input |
| `G8:G22` | `Peso Tacho` (numero) | Peso tacho | Input |
| `H8:H22` | `=SI(ESNUMERO(D8),MAX(0,D8-(E8*F8)-G8),"")` (arrastrada a H22) | Peso neto derivado | Formula |
| `H23` | `=SUMA(H8:H22)` | Total neto del turno | Formula |

> Solo `B8:G22` (+ `C4`, `G4`, `C5`, `E5`, `G5`) es input persistible. `H8:H22`, `H23` y `E4` son formulas nativas (`SI`/`ESNUMERO`/`MAX`/`SUMA`); el Script nunca las pisa — solo lee su `displayValue` de `H` y escribe en `B8:G22`. `peso_neto` se **captura** desde `H8:H22` (valor de formula) y se persiste como valor en `L`; si `H=""` no se crea fila. `dashboard!B7` es factor de eficiencia (ej. `0.95`). Formulas se escriben verbatim con `valueRenderOption=FORMULA`.

### 2.3 Geometria de `dashboard`

| Rango | Valor / Comportamiento | Descripcion |
| ------- | ------------------------ | ------------- |
| Filtros cabecera | `Periodo` \| `Turno` \| `Maquina` \| `Supervisor` \| `Fecha` | Controles de filtrado |
| `Periodo` | `Fecha` \| `Semana` \| `Mes` (dropdown) | Granularidad temporal |
| `Turno` | `Todos` \| `Dia` \| `Tarde` \| `Noche` (dropdown) | Filtro columna `turno` |
| `Maquina` | `Todos` \| 5 maquinas (dropdown) | Filtro columna `maquina` |
| `Supervisor` | `Todos` \| lista supervisores (dropdown) | Filtro columna `supervisor` |
| `Fecha` picker | `dd/MM/yyyy` — habilitado solo si `Periodo=Fecha`; ignorado si `Semana`/`Mes` | Fecha puntual |
| `E7` spill | `=QUERY(db_coneras!A:P, "select F, sum(L) where ... group by F label ...")` | Agregacion primaria: `titulo, sum(peso_neto)` — respeta filtros activos |
| Grafica principal | `Peso Neto por Titulo` (barras) | Siempre visible, vinculada a `E7` spill |
| Grafica secundaria | `Evolucion diaria` (linea por fecha) | Visible solo si `Periodo=Semana` o `Mes`; oculta si `Periodo=Fecha` |

> `dashboard` filtra automatico via formulas nativas (`QUERY`/`FILTER`); sin boton ni Apps Script en lectura. `Semana` = ultimos 7 dias (`hoy-6` a `hoy`); `Mes` = mes en curso (`01` al ultimo dia del mes actual) — ambos ignoran `Fecha` picker.

## 3. Goals / Non-Goals

**Goals v1:**

- Unica hoja `conera` para las 5 maquinas y 3 turnos; sin hojas por maquina.
- Guardado explicito (checkbox `I8` + menu) con upsert batch idempotente por `(fecha, turno, maquina, descarga_nro)` y `LockService` (1 lock por guardado, no por fila).
- `peso_neto` capturado desde `H8:H22` (valor de formula nativa) y persistido como valor en `L`; Script no recalcula.
- `db_coneras` consultable por `fecha`, `turno`, `maquina`, `titulo`, `supervisor`, `periodo`; `supervisor` es columna, no parte de PK.
- `dashboard` via `QUERY` directo a `db_coneras` (no `SUMAR.SI` a hojas), con `E7` spill + grafica principal siempre + secundaria condicional.
- Delete guard con `SpreadsheetApp.getUi().alert` nativo antes de borrar fila existente.
- Filas variables `0..15` por turno — `peso_bruto` vacio = no fila; limpiar y guardar borra.

**Non-Goals v1:**

- Reemplazar balanza/hardware de pesaje; integracion payroll/RRHH.
- Dashboards externos (Looker/Data Studio) o export PDF.
- Persistencia automatica por celda (`onEdit` por `D8:H22`); import masivo multi-turno.
- `SUMAR.SI`/`SUMAR.SI.CONJUNTO` agregando sobre `conera`; `QUERY` es el path.

## 4. Propuesta

```
conera (1 sheet, parametrizada) ──explicit Save (checkbox I8 + menu, 1 batch)──▶ Apps Script (validar, capturar H→L, LockService 5s+retry) ──▶ db_coneras (A:P, PK fecha+turno+maquina+descarga_nro)
   C5 maquina ─┬─▶ 5 valores                                       B8:G22 (15 descargas, H es formula)                 ──▶ dashboard (QUERY directo, sin Script)
   G4 turno ───┤  G5 supervisor                                     E5 fecha                                           ──▶ Errors (log opcional)
   E4 metaReal ┘  C4 metaManual                                     H8:H22 peso_neto formula → captura valor en DB
```

| Principio | Razon |
| ----------- | ------- |
| 1 `conera`, N turnos via `fecha+turno+maquina` | Parametrizacion en C5/G4, sin hojas por maquina |
| `conera` es form, `db_coneras` es DB | View != storage; `conera` nunca se consulta como DB |
| Denormalizar `fecha/turno/maquina/titulo/supervisor` por fila | Sin JOIN nativo en Sheets; cada fila filtrable standalone |
| Guardado explicito batch (no `onEdit` por celda) | 1 upsert por guardado, no 15; evita parciales y sobrecarga |
| Capturar `peso_neto` desde `H` | Formula nativa es fuente; Script solo persiste displayValue |
| `QUERY` directo en `dashboard` | Formulas nativas agregan; Script no recalcula dashboard |
| `supervisor` fuera de PK | Mismo turno/maquina puede cambiar supervisor sin duplicar PK |

## 5. Requisitos Funcionales

### 5.1 Formulario `conera` & Guardado

| ID | Requerimiento | Prioridad |
| ---- | --------------- | ----------- |
| **FR-001** | Hoja unica `conera` es el unico punto de entrada. Banner `A1:H2`, `B4:E4` (meta), `G4` turno (`Dia/Tarde/Noche`), `C5` maquina (5 valores), `E5` fecha `dd/MM/yyyy` (Sheets `DATE` + `dataValidation` `isValidDate`), `G5` supervisor (dropdown). Cambiar `E5`/`G4`/`C5` dispara hidratacion automatica desde `db_coneras` (`where fecha=E5 and turno=G4 and maquina=C5`, filtrando primero por `fecha`): si hay filas, puebla `B8:G22` + `G5`; si no hay, limpia `B8:G22` quedando `H8:H22`/`H23` recalculando en vacio, listo para nuevo registro. El Script nunca pisa `H8:H22`, `H23` ni `E4` (formulas). | Must |
| **FR-002** | Zona persistible `B8:G22` (15 filas). `A8:A22` = `descarga_nro` 1..15 fijo. `H8:H22` formula verbatim `=SI(ESNUMERO(D8),MAX(0,D8-(E8*F8)-G8),"")`; `H23=SUMA(H8:H22)`; `E4=SI(ESNUMERO(C4),C4*dashboard!B7,"")`. El Script nunca escribe en `H8:H22`, `H23` ni `E4` — solo en `B8:G22` y filtros. `H` se recalcula solo por Sheets. | Must |
| **FR-003** | Guardado explicito via `Coneras → Guardar Turno` o checkbox nativo (`conera!I8` → `J8` label `☑ GUARDAR TURNO`, `FALSE→TRUE` dispara instalable `conerasOnEdit` → `guardarTurno()` → resetea `I8=FALSE` en ~1s, patron movil de `yarn-settings` `I8` / `yarn-production` `M4` debounce). Validar antes de escribir: `E5` fecha valida; `G4` turno ∈ {Dia,Tarde,Noche}; `C5` maquina ∈ 5 valores. `E5` vacia/invalida → toast `⚠️ Seleccioná fecha válida en E5` y no escribe. `G4`/`C5` invalido → toast y no escribe. | Must |
| **FR-004** | Guardado es **upsert batch explicito**, no append ni auto-guardado por fila: al disparar `Guardar` (checkbox `I8` o menu) se procesan las `0..15` filas con `Bruto` valido en un unico batch con 1 `LockService`; PK `(fecha, turno, maquina, descarga_nro)` → `id`. Re-guardar mismo `fecha+turno+maquina` actualiza en sitio, no duplica. `creado` se preserva; `actualizado` + `editado_por` se refrescan. | Must |
| **FR-005** | `peso_neto` se **captura** desde `H8:H22` (valor display de formula nativa `=SI(ESNUMERO(D8),MAX(0,D8-(E8*F8)-G8),"")`), no se recalcula en Script. Se valida que `H` sea numerico y se persiste tal cual (2 decimales) en `L`; si `H=""` (por `Bruto` vacio) no se crea fila. `H23` no se persiste. | Must |
| **FR-006** | Filas variables `0..15`: `peso_bruto` vacio/no numerico → **no se crea fila en DB**. `0..15` filas/dia por `fecha+turno+maquina` es normal. Si `D8` tenia valor y se limpia a vacio y existe PK en `db_coneras` → **delete guard** (FR-010) antes de borrar. Limpiar `D8:D22` y guardar borra esas PKs de DB. | Must |
| **FR-007** | Campos de auditoria por fila: `creado` (insert), `actualizado` + `editado_por` (cada upsert), zona horaria `America/La_Paz`. `supervisor` (`G5`) se denormaliza por fila en `M` pero no forma parte de PK. | Must |
| **FR-008** | Menu `Coneras → Guardar Turno | Ver db_coneras | Re-sincronizar` + `onOpen` que crea menu y checkbox `I8` (dataValidation `FALSE/TRUE`).`Ver db_coneras` activa `db_coneras`;`Re-sincronizar` re-hidrata `conera` desde `db_coneras` para `E5+G4+C5` actuales (fallback manual; la hidratacion principal es automatica por FR-001, optimizada para movil). | Must |
| **FR-009** | Concurrencia con `LockService.getDocumentLock()` (timeout 5s, un reintento). En fallo, log a `Errors` y toast `❌ Error — usá Re-sincronizar`. | Must |
| **FR-010** | Delete guard: si al guardar una descarga existente pasa de `peso_bruto` con valor a vacio, mostrar `SpreadsheetApp.getUi().alert` nativo con `Continuar`/`Cancelar`. `Continuar` → borrar PK de `db_coneras`; `Cancelar` → no borrar, dejar fila en DB. Batch: un unico alert que lista `Nº` afectados si hay varias. | Must |

### 5.2 Dashboard

| ID | Requerimiento | Prioridad |
| ---- | --------------- | ----------- |
| **FR-011** | Hoja `dashboard` con 5 controles: `Periodo` (Fecha\|Semana\|Mes), `Turno` (Todos\|Dia\|Tarde\|Noche), `Maquina` (Todos\|5 maquinas), `Supervisor` (Todos\|...), `Fecha` picker (`dd/MM/yyyy`). `Fecha` habilitado solo si `Periodo=Fecha`; deshabilitado/ignorado si `Semana`/`Mes`. `Todos` = no filtrar esa columna (where omitido). | Must |
| **FR-012** | Agregacion `E7` spill via `QUERY` directo sobre `db_coneras!A:P`: `select titulo, sum(peso_neto) where ... group by titulo label sum(peso_neto) 'Peso Neto'`. `where` combina filtros activos: `fecha` segun `Periodo` (ver FR-013), `turno=C`, `maquina=D`, `supervisor=M`. Sin `FILTER`/`SUMAR.SI` a `conera`. | Must |
| **FR-013** | Semantica temporal: `Periodo=Fecha` → `fecha = Fecha picker` (dia puntual, requiere `Fecha` valida; si vacia → vacio/0 filas). `Periodo=Semana` → `fecha ∈ [hoy-6, hoy]` (ultimos 7 dias). `Periodo=Mes` → `fecha ∈ [01/mm/yyyy, finDeMes]` del mes en curso. `Semana`/`Mes` ignoran `Fecha` picker por completo. Todas las fechas interpretadas en `America/La_Paz` (`TODAY()` del spreadsheet). | Must |
| **FR-014** | Grafica principal `Peso Neto por Titulo` (barras) vinculada a `E7` spill — **siempre visible**, se actualiza automatico al cambiar cualquier filtro. | Must |
| **FR-015** | Grafica secundaria `Evolucion diaria` (linea: `fecha` X, `sum(peso_neto)` Y, opcional serie por `titulo`) — **visible solo si `Periodo=Semana` o `Mes`**; oculta/colapsada si `Periodo=Fecha`. Se alimenta de `QUERY` diario `select fecha, sum(peso_neto) group by fecha`. | Must |
| **FR-016** | `dashboard` filtra automatico via formulas; sin boton ni Apps Script en lectura. No hay path de escritura desde `dashboard` a `db_coneras`. | Must |
| **FR-017** | `Meta Real` (`E4`) en `conera` deriva de `dashboard!B7` (factor eficiencia) — `E4=SI(ESNUMERO(C4),C4*dashboard!B7,"")`. `dashboard!B7` es parametro global editable. | Should |

## 6. Requisitos No Funcionales

| ID | Categoria | Requerimiento | Notas |
| ---- | ----------- | --------------- | ------- |
| NFR-01 | Performance | Guardado unico <2s; turno completo (15 descargas) <5s | Batch `getValues`/`setValues`, un `LockService` por save |
| NFR-02 | Quotas | Sin llamadas externas | `90 min/dia`, `20k` fetches — solo `SpreadsheetApp`/`LockService`/`Session`/`Utilities` |
| NFR-03 | Reliability | `LockService.getDocumentLock()` por guardado (5s, retry 1) | Queue fallido via `Re-sincronizar` |
| NFR-04 | Locale | Formulas en español verbatim; `valueRenderOption=FORMULA` | `SI`/`ESNUMERO`/`MAX`/`SUMA`/`QUERY` con `FALSO` donde aplique |
| NFR-05 | Timezone | `America/La_Paz` (UTC-4) para timestamps y `Semana`/`Mes` | `Utilities.formatDate(..., "America/La_Paz", "yyyy-MM-dd HH:mm:ss")` |
| NFR-06 | Maintainability | Sin npm/pip; `apps-script/coneras-production/` via `clasp`; tooling bajo `tools/` | Solo built-ins de Apps Script V8 |
| NFR-07 | Observability | `Logger` + toast; hoja `Errors` | Log validaciones y lock failures |
| NFR-08 | Data integrity | Headers `db_coneras` protegidos/congelados; orden frozen | Nunca reordenar columnas; `conera!H8:H22` protegidas solo formula |

## 7. Modelo de Datos — `db_coneras`

> Orden frozen. `conera` es solo UX. `db_coneras` es target de upsert con auditoria de ultimo cambio. Tipos son tipos de Sheets. Timezone `America/La_Paz` para todos los timestamps. `supervisor` es columna, no parte de PK.

### 7.1 `db_coneras` — Descargas por `fecha/turno/maquina` (≤15 filas por combinacion)

| # | Col | Header | Tipo | Ejemplo | Descripcion |
| --- | ----- | -------- | ------ | --------- | ------------- |
| A | `id` | STRING | `2026-09-07-DIA-AUTOCONER_1-03` | `fecha-turno-maquina-descarga_nro` (normalizado: maquina sin espacios, zero-pad 2) |
| B | `fecha` | DATE | `2026-09-07` | Desde `conera!E5` (`dd/MM/yyyy`) |
| C | `turno` | ENUM | `Dia` | `conera!G4` — `Dia`, `Tarde`, `Noche` |
| D | `maquina` | ENUM | `Autoconer 1` | `conera!C5` — 5 valores |
| E | `descarga_nro` | NUMBER | `3` | `conera!A8:A22` 1..15 |
| F | `titulo` | STRING | `24` | `conera!B8:B22` |
| G | `operador` | STRING | `Juan Pérez` | `conera!C8:C22` |
| H | `peso_bruto` | NUMBER | `42.50` | `conera!D8:D22` |
| I | `usos` | NUMBER | `12` | `conera!E8:E22` |
| J | `peso_canilla` | NUMBER | `0.85` | `conera!F8:F22` (`Peso Canilla`) |
| K | `peso_tacho` | NUMBER | `1.20` | `conera!G8:G22` (`Peso Tacho`) |
| L | `peso_neto` | NUMBER | `31.10` | Capturado desde `H8:H22` (valor de formula nativa), 2 decimales |
| M | `supervisor` | STRING | `Carlos Ruiz` | `conera!G5` — denormalizado por fila, **no PK** |
| N | `creado` | DATETIME | `2026-09-07 08:10:00` | Primer insert (`America/La_Paz`) |
| O | `actualizado` | DATETIME | `2026-09-07 08:15:22` | Ultimo cambio (`America/La_Paz`) |
| P | `editado_por` | STRING | `user@factory.bo` | `Session.getActiveUser().getEmail()` o `unknown` — ultimo editor |

> PK `(fecha, turno, maquina, descarga_nro)` → `id`; `findRow(id) → update else append`. `peso_neto` se almacena como valor al guardar. `creado` nunca se sobrescribe; `actualizado`/`editado_por` se refrescan en cada upsert.

### 7.2 PK & Indices

| Constraint | Definicion |
| ------------ | ------------ |
| PK `db_coneras` | `(fecha, turno, maquina, descarga_nro)` ≡ `id` |
| Secondary views | Filtrar por `fecha`, `turno`, `maquina`, `titulo`, `supervisor` via `QUERY` en `dashboard` |
| Dedup | Lookup por `id`; si existe update `titulo/operador/pesos/peso_neto/supervisor/actualizado/editado_por`, reactiva; si no existe append |

### 7.3 Volumen

`db_coneras` 15 descargas × 3 turnos × 365 dias = **16.425 filas/ano** por maquina; 5 maquinas → ~82k filas/ano worst-case (real menor por filas vacias). Dentro de 10M celdas (16 cols × 82k ≈ 1.3M celdas/ano).

## 8. Edge Cases & Business Rules

| # | Edge Case | Regla |
| --- | ----------- | ------- |
| EC-01 | `E5` vacia / invalida | Bloquea guardado, toast `⚠️ Seleccioná fecha válida en E5`, no escribe |
| EC-02 | `G4`/`C5` invalido (no en dropdown) | Bloquea guardado, toast `⚠️ Turno/Máquina no válido`, no escribe |
| EC-03 | `peso_bruto` vacio / no numerico | **Skip fila — no se crea DB row**; 0..15 filas por turno es normal. `H` queda `""` via `SI(ESNUMERO(...))` |
| EC-04 | `peso_bruto` existente limpiado a vacio y guardado | **Delete guard** — `Ui.alert` nativo `Continuar/Cancelar` antes de borrar PK (FR-010). `Cancelar` preserva fila DB |
| EC-05 | `peso_neto` negativo | `MAX(0, ...)` en formula nativa — nunca negativo; Script solo captura `H`, valida numerico |
| EC-06 | `titulo`/`operador` vacio con `peso_bruto` numerico | Fila valida — se persiste con `titulo`/`operador` vacios; `dashboard` agrupa `titulo` vacio como `(sin título)` |
| EC-07 | `E5` con hora (datetime) | Normalizar a fecha sin hora (`yyyy-MM-dd`) antes de PK |
| EC-08 | Re-guardar mismo `fecha+turno+maquina` | Upsert — `creado` preservado, `actualizado`/`editado_por`/`supervisor` refrescados; filas faltantes manejadas por EC-03/EC-04 |
| EC-09 | `Periodo=Fecha` sin `Fecha` picker | `dashboard` muestra 0 filas / spill vacio; no error |
| EC-10 | `Periodo=Semana/Mes` con `Fecha` picker seteado | `Fecha` ignorado por completo (FR-013) |
| EC-11 | `Turno`/`Maquina`/`Supervisor = Todos` | No filtra esa columna — `where` omite ese predicado |
| EC-12 | `dashboard!B7` eficiencia vacio/no numerico | `E4` queda `""` via `SI(ESNUMERO(C4),...)`; no bloquea guardado |
| EC-13 | Concurrencia | `LockService.getDocumentLock()` por guardado (5s, retry 1) |
| EC-14 | Timezone | `America/La_Paz` para `creado`/`actualizado` y calculo de `Semana`/`Mes` (`TODAY()` del spreadsheet) |

## 9. UX / Flujos

### 9.1 Happy Path — Guardar turno

```
Elige conera!E5=07/09/2026, G4=Dia, C5=Autoconer 1, G5=Carlos Ruiz
 → completa B8:G12 (ej. 5 descargas), deja H8:H12 auto (formulas), H23 suma
 → Coneras → Guardar Turno (o checkbox I8)
  → valida E5/G4/C5, captura peso_neto desde H (displayValue, 2 dec) sin recalcular
  → Lock (1 batch) → upsert db_coneras (5 rows) con editado_por
  → toast "✅ Guardado: 07/09/2026 Dia Autoconer 1 — 5 descargas (142.30 kg) por user@factory.bo"
```

### 9.2 Editar / Hidratar (automatico + re-sincronizar)

```
Usuario cambia conera!E5=07/09/2026, G4=Dia, C5=Autoconer 1 (dropdowns nativos, movil)
 → onEdit filtra db_coneras where fecha=E5 AND turno=G4 AND maquina=C5 (primero fecha)
 → si hay filas → puebla B8:G22 (titulo/operador/pesos) + G5 supervisor; H8:H22/H23 recalculan solas (formulas no pisadas)
 → si no hay filas → limpia B8:G22, H queda en ""/0, listo para nuevo registro del dia
 → toast "↻ Sincronizado: 5 descargas" o "— sin registros, listo para cargar"
 → edita D9 (peso_bruto), toca checkbox I8 o Coneras → Guardar Turno → upsert actualiza esa descarga_nro, actualizado/editado_por refrescados
Si el usuario prefiere, Coneras → Re-sincronizar hace lo mismo manual (fallback).
```

> Hidratacion principal es automatica por `E5`/`G4`/`C5` (optimizada para movil); `Re-sincronizar` queda como fallback. El Script nunca escribe en `H8:H22`, `H23` ni `E4`.

### 9.3 Dashboard — Filtrar

```
Usuario en dashboard cambia Periodo=Semana
 → Fecha picker ignorado; QUERY filtra fecha ∈ [hoy-6, hoy]
 → E7 spill recalcula (titulo, sum peso_neto), grafica principal refresca
 → grafica secundaria Evolucion diaria se hace visible (7 puntos)
Usuario cambia Maquina=Autoconer 1, Turno=Dia
 → where agrega maquina='Autoconer 1' AND turno='Dia'
 → E7 y ambas graficas filtran sin boton
Usuario cambia Periodo=Fecha, Fecha=07/09/2026
 → filtra fecha = 2026-09-07; grafica secundaria se oculta
```

### 9.4 Delete con advertencia

```
Usuario limpia D10 (peso_bruto de descarga 3) que existe en db_coneras
 → Coneras → Guardar Turno
  → detecta PK 2026-09-07-DIA-AUTOCONER_1-03 existe y D10 ahora vacio
  → Ui.alert("¿Borrar descarga 3 (42.50 kg)? Esta acción elimina la fila de db_coneras.") [Continuar] [Cancelar]
  → Continuar → delete PK → toast "🗑️ Descarga 3 borrada"
  → Cancelar  → no borra → toast "↩️ Sin cambios en descarga 3"
Si 3 descargas pasan a vacias a la vez → un unico alert lista "Descargas 3, 7, 9 — ¿Continuar?"
```

### 9.5 Manejo de errores

| Escenario | UX |
| ----------- | ---- |
| `E5`/`G4`/`C5` invalido | Toast `⚠️ ... no válido`, no escribe |
| `peso_bruto` no numerico | Fila ignorada (EC-03); resto del turno se guarda |
| Lock timeout | `⏳ ocupado, reintentando…` → retry → `❌ Error — usá Re-sincronizar` + log `Errors` |
| `db_coneras` no existe | Crear header `A:P` frozen/protegido, luego proceder |
| Cancelar delete guard | No borra; toast `↩️ Sin cambios` |

### 9.6 Menu

```
Coneras → Guardar Turno | Ver db_coneras | Re-sincronizar
```

## 10. Fuera de Alcance (v1)

| Item | Por que se difiere |
| ------ | -------------------- |
| Hojas adicionales por maquina | `conera` parametrizado cubre todas las maquinas |
| `SUMAR.SI`/`SUMAR.SI.CONJUNTO` agregando sobre `conera` | Desacoplado — `dashboard` usa `QUERY` directo a `db_coneras` |
| `onEdit` por celda en `B8:H22` | Guardado es explicito (FR-003); evita parciales |
| Email/WhatsApp alerts | Infra |
| Web form / mobile dedicado | Sheets UX alcanza |
| Undo UI | Version history + audit `editado_por` alcanza |
| Multi-turno batch import | Persistencia es por `fecha+turno+maquina` (FR-004) |

## Appendix A — Constraints Compliance

| Constraint | Compliance |
| ------------ | ------------ |
| Sin npm/pip | Solo built-ins (`SpreadsheetApp`, `LockService`, `Session`, `Utilities`) |
| Tooling bajo project dir | `clasp` bajo `tools/` si se usa, nunca `/tmp` |
| Formulas español | Mantener `SI`/`ESNUMERO`/`MAX`/`SUMA`/`QUERY` verbatim via `valueRenderOption=FORMULA` |
| Timezone | `America/La_Paz` en todos lados |

## Appendix B — Glosario

| Termino | Significado |
| --------- | ------------- |
| `conera` | Hoja unica de entrada — form parametrizado por `fecha+turno+maquina`, no DB (reemplaza 5 hojas) |
| `db_coneras` | Tabla de descargas por `fecha/turno/maquina/descarga_nro` — tabla con auditoria de ultimo editor |
| `dashboard` | Hoja de agregacion via `QUERY` directo a `db_coneras`; filtros `Periodo/Turno/Maquina/Supervisor/Fecha` |
| `descarga_nro` | Indice 1..15 de `A8:A22` — parte de PK |
| `peso_neto` | `MAX(0, peso_bruto - (usos × peso_canilla + peso_tacho))` — valor, no formula en DB |
| `Errors` | Hoja de log opcional |
| `Todos` | Valor de filtro que omite ese predicado en `where` |

## Appendix C — Formulas Clave (verbatim `es-BO`)

| Celda | Formula |
| ------- | --------- |
| `conera!H8` | `=SI(ESNUMERO(D8),MAX(0,D8-(E8*F8)-G8),"")` |
| `conera!H23` | `=SUMA(H8:H22)` |
| `conera!E4` | `=SI(ESNUMERO(C4),C4*dashboard!B7,"")` |
| `dashboard!E7` | `=QUERY(db_coneras!A:P,"select F, sum(L) where B is not null and ... group by F label sum(L) 'Peso Neto'",1)` |

*Fin PRD v0.1.0 — coneras-production.*
