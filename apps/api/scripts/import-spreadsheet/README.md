# Carga puntual de la planilla familiar

Carga única de `CUENTAS POR PAGAR (1).xlsx` — la planilla que Plinto existe para
reemplazar — al hogar **Olaves** (`fbeacd27-…`). **No es el importador de
PRD-010**: no hay UI, no hay endpoint, no corre solo. Es un script que se corrió
una vez, se verificó contra los números de la planilla y se puede deshacer.

Queda versionado porque el trabajo difícil no fue escribir filas: fue descubrir
cómo miente la planilla. Eso vale para PRD-010 cuando llegue.

## Correrlo

```bash
# 1. Excel -> JSON normalizado
python3 scripts/import-spreadsheet/extract.py "/ruta/CUENTAS POR PAGAR (1).xlsx" > data.json

# 2. Dry run: imprime todo y reconcilia contra los totales de la hoja
npx ts-node -O '{"module":"commonjs"}' scripts/import-spreadsheet/load.ts data.json

# 3. Escribir (borra y recrea el tenant, deja manifest.json)
npx ts-node -O '{"module":"commonjs"}' scripts/import-spreadsheet/load.ts data.json --apply

# 4. Deshacer, por ids del manifiesto
npx ts-node -O '{"module":"commonjs"}' scripts/import-spreadsheet/revert.ts
```

`manifest.json` está versionado a propósito: es el registro de los 2.789 ids que
la corrida real creó, y sin él no hay cómo deshacerla. `revert.ts` borra
exactamente esos ids y no "todo lo del hogar", así que lo que se haya creado en
Plinto después de la carga sobrevive.

`DATABASE_URL` sale de `apps/api/.env`. `extract.py` usa solo la stdlib: esta
máquina no tiene openpyxl ni libreoffice, y agregar una dependencia para leer un
archivo una vez no se justificaba.

## Cómo miente la planilla

Cuatro cosas, todas verificadas, ninguna obvia. Son la razón de que el parser
tenga la forma que tiene.

**Los meses van en horizontal.** Un mes es un bloque de columnas (B/C, E/F, H/I)
cuyo encabezado lo nombra. Nada se puede leer fila por fila: un bloque se
localiza por su celda `CUENTAS POR PAGAR <MES>` y se camina hacia abajo hasta su
propio `TOTAL`.

**`FALTANTES` da 0 por construcción, no porque esté pagado.** Pero la fórmula sí
sabe la verdad: enumera celda por celda lo que se pagó. Y `TOTAL PAGADOS` no
alcanza — julio 2026 esconde tres grupos más de pagos en celdas borrador de la
columna D que solo `FALTANTES` referencia. Por eso la autoridad acá es la
fórmula de `FALTANTES`, expandida recursivamente hasta las hojas, con un
conjunto de parada para no atravesar las líneas que son ellas mismas fórmulas.

**Las etiquetas de las sub-tablas `CREDITOS <MES>` están corridas un mes.** Enero
2026 no lee la tabla titulada "CREDITOS ENERO": lee `L146`, que es la titulada
"CREDITOS DICIEMBRE". El vínculo se resuelve **siempre** por la referencia de
celda de la fórmula, nunca por el título.

**Cada mes toma prestada la celda del mes siguiente.** El `TOTAL` de enero es
`SUM(C4:C28)+F3`, y `F3` es el arriendo de FEBRERO — mismo valor, así que el
número sale bien y el error queda invisible. Los pagos hacen lo mismo, así que
una hoja del árbol de `FALTANTES` puede caer fuera del bloque; se reconcilia por
monto contra las líneas que quedaron sin pagar.

## Defectos de la hoja que el script NO copia

`KNOWN_SHEET_DEFECTS` en `plan.ts` los lista. Hoy hay uno:

- **2025-09**: su `TOTAL` es `SUM(I70:I95)+C102`, y `C102` es el arriendo de
  OCTUBRE (2.300.000) en vez del de septiembre (2.200.000). Las líneas del mes
  suman 19.810.860; la hoja declara 19.910.860. **Se carga la suma real.**

Está en una lista y no detrás de un `--force` para que una discrepancia NUEVA
siga frenando la carga.

## Decisiones de mapeo

| Excel | Plinto |
|---|---|
| Línea de bloque mensual | `ObligationInstance` |
| Concepto presente todos los meses | `RecurringTransactionRule` + obligación con el monto REAL del mes |
| Celda que `FALTANTES` cuenta como pagada | `Transaction` + `ObligationPayment` |
| Fila de sub-tabla `CREDITOS` | obligación por prestamista + cuenta `debt` |
| Columna `Prestamo` de esa fila | `Transfer` cuenta-deuda → banco |
| Fila de hoja `INGRESOS`, columna `INGRESO` | `Transaction` (income) |
| Fila marcada por `TRANSFERENCIAS ENTRE CUENTAS PROPIAS` | `Transfer` entre cuentas propias |

- **Un préstamo no es un ingreso.** Llega como transferencia desde la cuenta de
  pasivo del prestamista, que es lo que lo mantiene fuera del ingreso del hogar
  estructuralmente y no por convención. Es la distinción que la planilla sostiene
  a mano en una columna aparte.
- **La columna `PRESTAMOS` de las hojas de ingreso se descarta a propósito**: son
  los mismos préstamos que las tablas `CREDITOS` ya produjeron, vistos del otro
  lado. Cargarla contaría cada préstamo dos veces.
- **Una cuenta `debt` por marca de prestamista, no por marca-y-persona.** La hoja
  escribe "RAPICREDIT VIC" y "RAPICREDIT SAN" para el mismo prestamista; quién
  pidió queda en el nombre de la obligación, donde es una etiqueta, en vez de
  partir el pasivo en dos mitades de una relación.
- **`Caja hogar (histórico)` paga todos los egresos.** La planilla nunca registró
  qué cuenta pagó qué, así que cualquier atribución sería inventada. Concentrarla
  en una cuenta deja esa ficción a la vista y mantiene Bancolombia, Nequi y
  Cuenta Sandra interpretables contra el ingreso que sí les entró.
- **ADDI queda como línea mensual agregada.** La capa de `DebtSchedule` real (44
  compras, 126 cuotas) está fuera de alcance por decisión del usuario.
- **Rango: 2025-01 → 2026-08.** Sep–dic 2026 en la hoja es proyección copiada
  (`TOTAL PAGADOS` vacío, `CREDITOS ONLINE` apuntando a celdas inexistentes).

## Verificación

El dry run comprueba dos cosas por mes: que lo esperado sume el `TOTAL` de la
hoja, y que lo que queda sin pagar sea el `FALTANTES` que la hoja declara.
**20 de 20 meses cuadran en ambas**, salvo el defecto documentado de 2025-09.

Contra la base, después de cargar:

| | Plinto | Planilla | |
|---|---|---|---|
| Enero 2026, total a pagar | 23.375.030 | `C29` | ✓ |
| Sin pagar 2026-06 / 07 / 08 | 405.000 / 7.472.470 / 22.753.567 | `FALTANTES` | ✓ |
| Ingreso Sandra 2025 S1 | 20.471.694 | `C87` | ✓ |
| Ingreso Victor 2026 S2 | 14.538.141 | `F151` | ✓ |
| Ingreso Victor 2026 S1 | 78.545.915 | `F67` = 82.868.336 | delta 4.322.421 |

Ese delta es exactamente `F71`, la celda "TRANSFERENCIAS ENTRE CUENTAS PROPIAS".
La hoja es inconsistente entre semestres: `F151` resta sus transferencias
internas, `F67` no. Plinto las excluye en ambos.
