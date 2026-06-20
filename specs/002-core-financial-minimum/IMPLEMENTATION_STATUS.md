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
