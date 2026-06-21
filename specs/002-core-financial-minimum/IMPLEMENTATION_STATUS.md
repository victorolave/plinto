# Estado de Implementación: Minimum Financial Core

**Fecha de revisión**: 2026-06-16
**Estado general**: 🚧 **EN PROGRESO POR VERTICAL SLICES**

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
- [ ] Smoke test manual: crear una transferencia y confirmar que ambos balances se ajustan y el
  total de la moneda no cambia, en `/dashboard`.

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
- [ ] Migración aplicada a la DB remota (`prisma:deploy`). **Caveat**: verificar antes que no haya
  `transactions.transfer_id` huérfano (la FK contra la tabla `transfers` vacía fallaría); como el
  Slice 4 no se smoke-testeó, no debería haber ninguno.
- [ ] Smoke test manual: transferencia cross-currency (COP→USD) en `/dashboard` — ambos balances se
  ajustan en su moneda, sin conversión implícita; y una transferencia same-currency sigue funcionando.
