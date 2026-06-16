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
- [ ] Smoke test manual: crear cuenta y verla listada en `/dashboard`.

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
