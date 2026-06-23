# Estado de Implementación: Minimum Financial Core

**Fecha de revisión**: 2026-06-23
**Estado general**: ✅ **MVP COMPLETO — Slices 1–7 implementados, verificados y smoke-tested E2E**

## Slice 1 — Crear y listar cuentas financieras

**Estado**: ✅ Implementado y verificado técnicamente

**Outcome**: un miembro del tenant puede crear cuentas financieras y ver la lista de cuentas del tenant activo.

### Incluye

- Modelo `Account` con `tenant_id`, `name`, `type`, `currency`, `created_at` y `updated_at`.
- Schemas Zod compartidos para cuenta y creación de cuenta.
- API `GET /accounts` y `POST /accounts` protegida por sesión, tenant activo y permisos.
- UI en `/dashboard` para crear y listar cuentas.
- Tests de schemas, permisos del controller y servicio de aplicación.

### Excluye

- Transacciones.
- Balances.
- Transferencias.
- Reportes.

### Verificación técnica

- [x] `pnpm lint`
- [x] `pnpm test`
- [x] `pnpm build`
- [x] Smoke test manual: crear cuenta y verla listada en `/dashboard` (confirmado por el usuario).

### Nota de base de datos

El repo ahora versiona migraciones Prisma con un baseline inicial en
`apps/api/src/infrastructure/database/prisma/migrations/0_init/`, que incluye la tabla
`accounts`. La política completa está en `docs/delivery/prisma-migrations.md`.

Para probar este slice:

- **Base de datos nueva**: `pnpm --filter @plinto/api prisma:deploy` (crea todo desde el historial).
- **Base local existente con las tablas ya creadas**: `pnpm --filter @plinto/api prisma:baseline`
  una sola vez para marcar `0_init` como aplicada, luego `pnpm --filter @plinto/api prisma:status`
  debe reportar que está al día.

A partir de aquí, cualquier cambio de schema (por ejemplo el slice de transacciones) debe
generar su propia migración versionada con `prisma:migrate -- --name <intención>`.

## Slice 2 — Registrar ingresos/gastos y ver balances

**Estado**: ✅ Implementado y verificado técnicamente

**Outcome**: un miembro del tenant puede registrar transacciones de ingreso/gasto contra una
cuenta y ver los balances por cuenta y moneda.

### Incluye

- Modelo `Transaction` (`tenant_id`, `account_id`, `type`, `amount_minor`, `currency`,
  `description`, `occurred_at`, timestamps) + enum `TransactionType` (`income`/`expense`).
- Migración versionada `*_add_transactions` generada offline (solo la tabla `transactions`).
- Schemas Zod compartidos: `TransactionSchema`, `CreateTransactionSchema`, `AccountBalanceSchema`.
- API `POST /transactions`, `GET /transactions` (filtro opcional `?accountId`) y
  `GET /transactions/balances`, protegida por sesión, tenant activo y permisos
  `transaction:write` / `transaction:read`.
- Cálculo de balance por cuenta: Σ ingresos − Σ gastos (aritmética entera en `amount_minor`).
- Evento de auditoría `transaction.income` / `transaction.expense` vía `AuditService`.
- UI en `/dashboard` para registrar transacciones y ver balances e historial.
- Tests de schemas, servicio (derivación de moneda, aislamiento de tenant, auditoría,
  balances) y metadata de permisos del controller.

### Decisiones de diseño

- **Moneda derivada, no recibida**: `CreateTransaction` no acepta `currency`. El servicio
  resuelve la cuenta, valida que pertenece al tenant activo y copia `account.currency`. Esto
  hace estructural (imposible de violar) el invariante de ADR 0004 §6: una transacción nunca
  puede tener una moneda distinta a la de su cuenta.
- **`amount_minor` entero positivo** (ADR 0004 §5): nunca float/decimal. El signo lo aporta
  `type`, no el monto.
- **Aislamiento de tenant**: crear una transacción contra una cuenta de otro tenant devuelve
  `NotFound` (la cuenta no existe para ese tenant). Cubierto por test.

### Excluye

- Edición/borrado de transacciones (la edición queda cubierta por Slice 3; el borrado sigue fuera).
- Transferencias y FX (Slices 4–5).
- Categorías y reportes (Slice 7).

### Verificación técnica

- [x] `pnpm lint`
- [x] `pnpm test` (238 tests)
- [x] `pnpm build`
- [x] Review adversarial en contexto fresco (must-fix aplicados: aserción de auditoría en el
  camino de error, filtro `accountId` a nivel DB, código muerto y guard de monto en la UI).
- [x] Smoke test manual: registrar ingreso/gasto y ver el balance actualizado en `/dashboard` (confirmado por el usuario).

### Deuda técnica diferida (MVP, registrada en el review)

- `getBalances` agrega en memoria; antes de escala migrar a `prisma.transaction.groupBy`.
- Sin paginación en el listado de transacciones; agregar cursor antes de producción.
- UX cuando el tenant no tiene cuentas: deshabilitar el formulario y guiar a crear una cuenta.

## Slice 3 — Editar transacciones con audit trail

**Estado**: ✅ Implementado y verificado técnicamente

**Outcome**: un miembro del tenant puede corregir una transacción existente mientras Plinto
preserva trazabilidad mediante auditoría con valores antes/después.

### Incluye

- Schema compartido `UpdateTransactionSchema` para correcciones parciales.
- API `PATCH /transactions/{id}` protegida por sesión, tenant activo y permiso
  `transaction:write`.
- Revalidación de aislamiento de tenant: la transacción y la cuenta destino deben pertenecer
  al tenant activo; si no, se devuelve `NotFound`.
- Moneda derivada nuevamente desde la cuenta cuando se mueve una transacción entre cuentas.
- Evento de auditoría `transaction.updated` con metadata `before`/`after`.
- UI en `/dashboard` para editar una transacción desde el historial.
- Actualización del contrato OpenAPI del core financiero.

### Decisiones de diseño

- **No hay borrado en Slice 3**: la política de deletion queda fuera del slice, como indica
  `docs/delivery/vertical-slices.md`.
- **Corrección parcial, no reemplazo ciego**: el payload exige al menos un campo y permite
  limpiar `description` con `null`.
- **Audit trail explícito**: el evento guarda snapshot antes/después de campos financieros
  relevantes (`accountId`, `type`, `amountMinor`, `currency`, `description`, `occurredAt`).

### Excluye

- Borrado de transacciones.
- Bulk edits.
- Transferencias.
- Paginación del historial.

### Verificación técnica

- [x] `pnpm lint`
- [x] `pnpm test` (250 tests)
- [x] `pnpm build`
- [x] Smoke backend reversible: corrección temporal de `amountMinor`, balance actualizado y
  restaurado, y dos eventos `transaction.updated` con metadata `before`/`after`.
- [x] Smoke HTTP reversible contra API local: `GET /api/transactions`,
  `GET /api/transactions/balances` y `PATCH /api/transactions/:id` con sesión temporal,
  balance restaurado y audit trail verificado; sesión temporal revocada.
- [x] Smoke test manual: editar una transacción y confirmar balance/historial actualizado en
  `/dashboard` (confirmado por el usuario).
- [x] Review adversarial en contexto fresco (must-fix aplicado: `updateForTenant` envuelve
  `updateMany` + re-lectura en `prisma.$transaction` para que el snapshot `after` del audit no
  pueda corromperse por un PATCH concurrente).

### Deuda técnica diferida (MVP, registrada en el review)

- La UI solo captura fecha (`type="date"`), por lo que `occurredAt` siempre queda en medianoche
  UTC. Editar por UI una transacción creada vía API con hora real truncaría el time-of-day;
  agregar input de hora (o preservar `occurredAt` cuando el usuario no lo cambia) antes de exponer
  creación con hora.

## Slice 4 — Transferir entre cuentas de la misma moneda

**Estado**: ✅ Implementado y verificado técnicamente

**Outcome**: un miembro del tenant puede mover dinero entre dos cuentas de la misma moneda sin
cambiar el balance total de esa moneda.

### Decisión de ejecución (tensión de docs resuelta)

`docs/delivery/vertical-slices.md` define el Slice 4 como creación atómica **síncrona** de las dos
patas, mientras que ADR 0006 + PRD 003 prescriben ejecución vía background jobs idempotentes. Hoy
no existe infraestructura de jobs en el repo. Se decidió implementar **síncrono ahora** (atómico
dentro del request con `prisma.$transaction`), tomando `vertical-slices.md` como fuente de verdad de
delivery y consistente con los Slices 1–3. La migración a jobs async/idempotentes queda diferida a
cuando llegue la infra de jobs (Slice 6 recurring la requerirá).

### Incluye

- Columna nullable `transfer_id` en `transactions` (+ índice) vía migración versionada
  `*_add_transfer_id_to_transactions` autorada offline.
- Modelo: una transferencia = un `expense` en la cuenta origen + un `income` en la destino,
  ambos compartiendo `transferId`. No se agregó un valor `transfer` al enum (no rompe
  `TransactionTypeSchema`); el cálculo de balance existente (Σ ingresos − Σ gastos) ya da net cero.
- Schema compartido `CreateTransferSchema` (origen, destino, monto; rechaza origen == destino).
- API `POST /transactions/transfers` protegida por sesión, tenant activo y permiso
  `transaction:write` (reutilizado; no se introdujo `transfer:write`).
- Creación atómica de las dos patas en `prisma.$transaction` (`createTransferPair`).
- Moneda derivada de las cuentas; rechazo con `TRANSFER_CURRENCY_MISMATCH` si difieren (FX es Slice 5).
- Dos eventos de auditoría `transaction.transfer` (débito/crédito) con metadata
  `{ transferId, direction, fromAccountId, toAccountId, amountMinor, currency }`.
- UI en `/dashboard`: formulario de transferencia (deshabilitado con < 2 cuentas).
- Tests de schema, servicio (dos movimientos exactos, aislamiento de tenant, mismatch de moneda,
  self-transfer, auditoría) y metadata de permisos del controller.

### Decisiones de diseño

- **Aislamiento de tenant**: origen y destino se resuelven con `findByIdForTenant`; una cuenta de
  otro tenant devuelve `NotFound` y no se escribe nada.
- **Misma moneda estructural**: la moneda nunca se recibe del cliente; se deriva de las cuentas y se
  exige que coincidan antes de cualquier escritura.
- **`transferId` server-side**: generado con `crypto.randomUUID()`, no aceptado del cliente.

### Excluye

- Transferencias con FX / monedas distintas (Slice 5).
- Idempotencia / ejecución vía jobs (diferido, ver abajo).
- Borrado o reverso de transferencias.
- Documentación del contrato OpenAPI del endpoint de transferencia: se documenta en el Slice 5,
  cuando el endpoint toma su forma final con los campos FX (evita churn de documentar dos veces).

### Verificación técnica

- [x] `pnpm lint`
- [x] `pnpm test`
- [x] `pnpm build`
- [x] Review adversarial en contexto fresco (should-fix aplicados: `path` en el refine de
  `CreateTransferSchema`, default de cuenta destino distinta y guard de < 2 cuentas en la UI).
- [x] Smoke test manual E2E (2026-06-23): transferencia COP→COP confirmada en `/dashboard` —
  origen baja X, destino sube X, total de la moneda invariante, exactamente 2 movimientos ligados.

### Deuda técnica diferida (MVP, registrada en el review)

- **Sin idempotencia**: si la escritura atómica commitea pero falla la emisión de auditoría, el
  request devuelve 500 con la plata ya movida; un retry del cliente duplicaría la transferencia.
  Mismo perfil de riesgo que `createTransaction`. Resolver con idempotency key + ejecución vía jobs
  (ADR 0006) cuando llegue la infra de jobs.
- Auditoría best-effort: las dos llamadas a `auditService.record` son secuenciales fuera de la
  transacción DB; si la primera falla, la segunda no corre.

## Slice 5 — Transferir entre monedas distintas con FX explícito

**Estado**: ✅ Implementado y verificado técnicamente

**Outcome**: un miembro del tenant puede transferir entre cuentas de monedas distintas (ej. COP → USD)
con un tipo de cambio explícito y movimientos resultantes claros, sin conversión implícita.

### Decisión de modelado (evolución del Slice 4)

Se introdujo una tabla `transfers` normalizada que guarda el registro de la transferencia + la
metadata FX una sola vez; `transactions.transfer_id` pasó a ser **FK** a `transfers.id`. El camino
misma-moneda del Slice 4 se **unificó** sobre esta tabla (cada transferencia —misma o distinta
moneda— crea una fila `Transfer`, con `fx_rate` null en el caso simple).

### Incluye

- Tabla `transfers` (migración versionada `*_add_transfers_table` autorada offline, con FKs a
  `tenants` y a `accounts` ×2 + índices; generada con `prisma migrate diff` para evitar drift).
- `Transfer` lleva `source/destination` account+amount+currency, `fx_rate` (`DECIMAL(20,8)`,
  nullable), `fee_minor`, `rate_source`.
- `createTransfer` (repo) crea la fila `Transfer` + las dos `Transaction` (montos y monedas por pata)
  en un único `prisma.$transaction`.
- Sin conversión implícita: el cliente ingresa monto origen, monto destino y `fxRate` explícitos; el
  servidor no calcula montos (PRD-003 §76-78). `rate_source` fijo `'manual'`.
- Guards: same-currency rechaza `fxRate`/monto-destino-distinto/`feeMinor` (`TRANSFER_FX_NOT_ALLOWED`);
  cross-currency exige `fxRate` + `destinationAmountMinor` (`TRANSFER_FX_REQUIRED`).
- API `POST /transactions/transfers` (generalizada) con permiso `transaction:write`; contrato OpenAPI
  documentado en su forma final.
- UI: el form muestra campos FX (monto destino + rate + fee) sólo cuando las monedas difieren, con
  hint no bloqueante del rate implícito; limpia el estado FX al volver a same-currency.
- Tests de schema, servicio (sin recálculo implícito, ambos guards, aislamiento de tenant, fila
  `Transfer` + dos patas) y controller.

### Excluye

- Proveedores de FX automáticos / rates históricos (fuera de PRD-003).
- Idempotencia / ejecución vía jobs (diferido, igual que Slice 4).
- Borrado o reverso de transferencias.

### Verificación técnica

- [x] `pnpm lint`
- [x] `pnpm test` (280 tests)
- [x] `pnpm build`
- [x] Review adversarial en contexto fresco (must-fix aplicados: 3 FKs faltantes en `transfers` +
  migración regenerada canónicamente con `migrate diff`; envelope de respuesta aplanado; should-fix:
  cota del regex de `fxRate` a la precisión de la columna, rechazo de `feeMinor` en same-currency,
  limpieza de estado FX stale en la UI, aserción de `Decimal` robusta en tests).
- [x] Migración aplicada a la DB remota (`prisma:deploy`, 2026-06-23). No hubo `transactions.transfer_id`
  huérfano; la FK contra `transfers` se aplicó limpia.
- [x] Smoke test manual E2E (2026-06-23): transferencia cross-currency COP→USD en `/dashboard` con monto
  origen, monto destino y `fxRate` explícitos, sin conversión implícita; same-currency sigue funcionando.

## Slice 6 — Transacciones recurrentes mensuales

**Estado**: ✅ Implementado y verificado técnicamente

**Outcome**: un miembro del tenant puede definir una regla de recurrencia mensual que genera
transacciones automáticamente en el día del mes indicado a partir de una fecha de inicio.

### Incluye

- Modelo `RecurringTransactionRule` (`tenant_id`, `account_id`, `name`, `type`, `amount_minor`,
  `currency`, `frequency = 'monthly'`, `day_of_month`, `start_date`, `active`, timestamps).
- Migración versionada `*_add_recurring_transactions` autorada offline.
- Schemas Zod compartidos: `RecurringTransactionRuleSchema`, `CreateRecurringTransactionRuleSchema`.
- API `GET /recurring-transactions` y `POST /recurring-transactions`, protegida por sesión,
  tenant activo y permiso `transaction:write`.
- Job de ejecución (`RecurringExecutionService`): filtra reglas activas del tenant y genera la
  transacción del período corriente si no existe (`idempotency_key` basado en `ruleId+period`).
- Evento de auditoría `transaction.income` / `transaction.expense` con `source: 'job'`.
- UI en `/dashboard`: sección de reglas recurrentes; marcador visual «Automatic · recurring»
  en el historial de transacciones para distinguirlas de las manuales.
- Tests de schema, repositorio (idempotencia, aislamiento de tenant), servicio de ejecución,
  controller (permissions) y servicio de transacciones (helpers de proveniencia).

### Excluye

- Schedulers (cron/triggers) — el job se invoca manualmente o vía infraestructura externa.
- Cancelación/edición de reglas recurrentes.
- Frecuencias distintas de mensual.

### Verificación técnica

- [x] `pnpm lint`
- [x] `pnpm test`
- [x] `pnpm build`
- [x] Smoke test manual E2E (2026-06-23): regla creada; `RecurringExecutionService.executeDue`
  invocado vía script one-off (NestFactory context) contra la DB real → run1 `created:1`, run2
  `created:0/skipped:1` (idempotencia probada). Transacción generada con `source='job'`,
  `recurringPeriod='2026-06'`, `idempotencyKey='recurring:{ruleId}:{YYYY-MM}'` y `occurredAt` en el
  `dayOfMonth`. Nota: no hay UI/endpoint para disparar la ejecución (método de servicio inyectable).

## Slice 7 — Categorías y reporte de gastos por categoría

**Estado**: ✅ Implementado y verificado técnicamente

**Outcome**: un miembro del tenant puede crear categorías (income/expense), asignarlas a
transacciones y consultar un reporte de gastos agrupado por categoría y moneda (nunca mezcladas).

### Incluye

- Modelo `Category` (`id`, `tenant_id`, `name`, `type TransactionType`, `color?`, timestamps,
  FK `categories_tenant_id_fkey RESTRICT`, `@@index([tenantId])`).
- Columna nullable `category_id` en `transactions` (FK `ON DELETE SET NULL`, `@@index([tenantId, categoryId])`).
- Migración versionada `20260622100000_add_categories/migration.sql` autorada offline.
- Schemas Zod compartidos: `CategorySchema`, `CreateCategorySchema`, `UpdateCategorySchema` (con refine),
  `ExpenseByCategoryItemSchema`, `ExpenseByCategoryReportSchema`.
- Extensión de `TransactionSchema`, `CreateTransactionSchema`, `UpdateTransactionSchema` con
  `categoryId` nullish/nullable.
- Permisos `category:read` y `category:write` en `authorization-policy.ts`:
  owner/member reciben ambos; viewer recibe solo `category:read`.
- API `CategoriesModule`: `GET /categories`, `GET /categories/:id` (category:read),
  `POST /categories`, `PATCH /categories/:id`, `DELETE /categories/:id` (category:write).
- API `ReportsModule`: `GET /reports/expenses-by-category?from=&to=` (report:read).
  Agrupa con `prisma.transaction.groupBy` por `(categoryId, currency)`; segunda query para nombres.
  Excluye no-categorizados (`categoryId: {not: null}`) e income.
- `TransactionService` extendido: valida `categoryId` contra tenant y tipo en create/update;
  `categoryId=null` limpia la asignación; no emite evento adicional de auditoría.
- Web `categories.ts`: `listCategories`, `getCategory`, `createCategory`, `updateCategory`,
  `deleteCategory`, `getExpenseReport(from, to)` vía `apiFetch`.
- Web `category-select.tsx`: dropdown extraído con helper puro `filterCategoriesByType`, props
  `{type, value, onChange, categories}`. Mantiene `TransactionsPanel` en ≤595 líneas.
- Web `categories-panel.tsx`: lista CRUD + formulario crear/editar (nombre, tipo, color opcional).
- Web `expense-report-panel.tsx`: inputs de fecha, fetch on submit, filas por moneda separadas
  (`groupReportItemsByCurrency`, `formatMinorAmount`). NUNCA combina monedas (ADR 0004).
- `transactions-panel.tsx`: integra `<CategorySelect>` en form crear/editar; `categoryId` state;
  helpers exportados `buildTransactionCreateInput` / `buildTransactionUpdateInput` con soporte
  `categoryId?: string` / `categoryId?: string | null`.
- `dashboard/page.tsx`: renderiza `<CategoriesPanel>` + `<ExpenseReportPanel>` junto a los paneles
  existentes.
- Auditoría: `category.created` y `category.updated`; sin evento en DELETE (por diseño).
- Entrega: PR único con `size:exception`.

### Decisiones de diseño

- **Enforced en app service (no en DB)**: la validación tipo-categoría ↔ tipo-transacción se
  hace en `TransactionService` (igual que la derivación de moneda), no con CHECK constraint.
- **groupBy + segunda query para nombres**: `prisma.groupBy` no soporta include/relations;
  segunda query `category.findMany` en JS para mapear nombres.
- **No-categorizados excluidos del reporte**: `categoryId: {not: null}` en la query, por diseño.
- **Dirección de dependencia una sola vía**: TransactionsModule → CategoriesModule, sin ciclo.
- **Tests web en node env (sin jsdom)**: la convención del proyecto es testear helpers puros
  exportados de los componentes, no el DOM renderizado.

### Excluye

- Reportes PRD-005(b) ingreso-vs-gasto y PRD-005(c) evolución mensual.
- Presupuestos, categorías jerárquicas, export CSV/PDF.
- Caché de reporte o conversión FX en reportes.
- Auditoría de cambios de categoría en transacciones o lecturas de reporte.
- Unicidad de nombre de categoría (constraint de DB).

### Verificación técnica (Checks de Aceptación — 18/18)

- [x] AC #1: Category CRUD create → 201 con id, tenantId, name, type, color, timestamps
- [x] AC #2: Audit on create → `category.created` emitido (cubierto en `category.service.test.ts`)
- [x] AC #3: Audit on update → `category.updated` emitido (cubierto en `category.service.test.ts`)
- [x] AC #4: No audit on delete → sin evento en DELETE (cubierto en `category.service.test.ts`)
- [x] AC #5: Color optional → null cuando ausente; trimmed cuando presente (cubierto en `category.schema.test.ts`)
- [x] AC #6: Tenant isolation categories → 404 CATEGORY_NOT_FOUND para otro tenant (cubierto en `category.repository.test.ts`)
- [x] AC #7: Permission viewer cannot write → 403 en POST/PATCH/DELETE (cubierto en `categories.controller.test.ts`)
- [x] AC #8: Permission viewer can read → 200 en GET (cubierto en `categories.controller.test.ts`)
- [x] AC #9: DELETE → SET NULL → transacciones conservadas con categoryId=null (cubierto en `category.repository.test.ts`)
- [x] AC #10: Type mismatch → 422 CATEGORY_TYPE_MISMATCH (cubierto en `transaction.service.test.ts`)
- [x] AC #11: Cross-tenant category → 404 CATEGORY_NOT_FOUND (cubierto en `transaction.service.test.ts`)
- [x] AC #12: categoryId=null clears → categoryId null tras update (cubierto en `transaction.service.test.ts`)
- [x] AC #13: Report multi-currency separation → USD y COP en filas separadas (cubierto en `report.service.test.ts`)
- [x] AC #14: Report income excluded → income ausente del reporte (cubierto en `report.service.test.ts`)
- [x] AC #15: Report uncategorized excluded → null categoryId ausente (cubierto en `report.service.test.ts`)
- [x] AC #16: Report period filter → occurredAt fuera de rango excluido (cubierto en `report.service.test.ts`)
- [x] AC #17: Report permission enforcement → 403 sin report:read (cubierto en `reports.controller.test.ts`)
- [x] AC #18: Report amounts as integer minor units → totalMinor entero (cubierto en `report.service.test.ts` + `category.schema.test.ts`)

### Archivos de test

- `packages/shared/schemas/__tests__/category.schema.test.ts` — 21 tests
- `packages/shared/schemas/__tests__/transaction.schema.test.ts` — extensión categoryId (6 tests nuevos, 43 total)
- `apps/api/src/modules/categories/__tests__/category.repository.test.ts` — 7 tests
- `apps/api/src/modules/categories/__tests__/category.service.test.ts` — 8 tests
- `apps/api/src/modules/categories/__tests__/categories.controller.test.ts` — 9 tests
- `apps/api/src/modules/reports/__tests__/report.service.test.ts` — 8 tests
- `apps/api/src/modules/reports/__tests__/reports.controller.test.ts` — 6 tests
- `apps/api/src/modules/transactions/application/__tests__/transaction.service.test.ts` — 7 tests nuevos (32 total)
- `apps/web/src/features/categories/services/__tests__/categories.test.ts` — 9 tests
- `apps/web/src/features/categories/components/__tests__/category-select.test.ts` — 4 tests
- `apps/web/src/features/categories/components/__tests__/expense-report-panel.test.ts` — 4 tests
- `apps/web/src/features/transactions/components/__tests__/transactions-panel-category.test.ts` — 5 tests

### Gates

- [x] `pnpm lint` — ZERO errores (turbo: 4/4 packages)
- [x] `pnpm test` — 411 tests, 43 archivos — TODOS PASAN
  - shared: 140 tests, 11 archivos
  - api: 166 tests, 20 archivos
  - web: 105 tests, 12 archivos
- [x] `pnpm build` — 4/4 paquetes compilados exitosamente, ZERO errores

### Smoke test manual: COMPLETADO (2026-06-23)

Validado end-to-end contra la DB activa. Los flujos por UI los confirmó un QA de navegador; los
negativos por código de error exacto (pasos 3 y 6) están cubiertos por la suite automatizada porque
la UI los previene (no reproducibles desde el navegador).

1. [x] Crear una categoría de gasto (ej. "Alimentación", type=expense) → AC #1 ✓
2. [x] Asignar esa categoría a una transacción de gasto (alta y edición) → AC #10: guardar con categoryId ✓
3. [x] Asignar categoría de ingreso a transacción de gasto → 422 CATEGORY_TYPE_MISMATCH — la UI lo
   previene (auto-resetea la categoría al cambiar tipo); el 422 está cubierto por tests
   (`transaction.service.test.ts:684,775,864`) ✓
4. [x] `GET /reports/expenses-by-category?from=...&to=...` con gastos en USD y COP → filas separadas
   por moneda, ingresos y sin-categoría excluidos, boundary `to` inclusivo del día ✓ (AC #13)
5. [x] Eliminar la categoría → las transacciones siguen existiendo con categoryId=null ✓ (AC #9)
6. [x] Rol viewer: read 200 / write 403 — cubierto por `authorization-policy.test.ts` (no había
   usuario viewer seedeado para validar por UI) ✓ (AC #7, #8)

**Deuda menor detectada en el smoke**: desfase de fecha display vs. almacenada (la UI con `type="date"`
guarda `occurredAt` a medianoche UTC, mostrando 1 día menos en zonas oeste). Es la deuda técnica ya
registrada en el Slice 3; no afecta balances ni el reporte (que usa la fecha almacenada). Trackeado para
un slice de pulido.
