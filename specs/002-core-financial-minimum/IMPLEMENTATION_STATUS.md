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

El repo todavía no versiona migraciones Prisma bajo `apps/api/src/infrastructure/database`. Para probar este slice contra una base local existente, sincronizar el schema antes del smoke test:

```bash
pnpm --filter @plinto/api prisma:generate
pnpm --filter @plinto/api prisma:migrate -- --name add_accounts
```

Si se adopta una política formal de migraciones, este documento debe actualizarse para referenciar el archivo de migración versionado.
