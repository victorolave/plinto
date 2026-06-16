# Estado de Implementación: Authentication, Registration, and Tenant Onboarding

**Fecha de revisión**: 2026-06-15
**Estado general**: ⚠️ **FUNCIONAL, VALIDADO CON PENDIENTES CONOCIDOS**

## Resumen Ejecutivo

La feature `001-auth-registration-onboarding` está implementada y el flujo principal de autenticación/onboarding fue validado en desarrollo local, pero el estado anterior de este documento era demasiado optimista: decir “COMPLETO” sin reflejar bugs encontrados, fixes posteriores y pendientes conocidos era mala arquitectura documental.

Este documento ahora separa tres cosas que NO son lo mismo:

1. **Implementado**: el código existe para cubrir el flujo principal.
2. **Validado**: build/lint/tests y smoke checks han pasado en revisiones previas.
3. **Pendiente**: hay decisiones o discrepancias que todavía requieren cierre explícito.

## Estado Validado

| Área | Estado | Evidencia |
| --- | --- | --- |
| Build/lint inicial de la feature | ✅ Corregido | Se arreglaron blockers de compilación, import path, Prisma generate y configuración ESLint. |
| Testing monorepo | ✅ Implementado | Vitest quedó configurado para `packages/shared`, `apps/api` y `apps/web`. |
| BFF auth web | ✅ Corregido | Tests detectaron y se corrigieron bugs de logout y parsing del refresh token. |
| Setup local web + API | ✅ Validado | `pnpm dev` levanta web en `:3000` y API en `:3001`; OIDC BFF redirige correctamente a Auth0. |
| Archivos `.env.example` | ✅ Corregido | Redirect URI y API base path fueron ajustados a los valores reales del entorno local. |

## Flujo Funcional Cubierto

### User Story 1 — First-time sign-in and onboarding

**Estado**: ✅ Implementado

- JIT user provisioning.
- Onboarding obligatorio con nombre y tenant.
- Usuario queda asociado al tenant creado.
- Dashboard accesible después de completar onboarding.

### User Story 2 — Returning user with one tenant

**Estado**: ✅ Implementado

- Auto-selección de tenant único.
- Redirección al dashboard.
- Manejo de sesión expirada mediante refresh/session flow.

### User Story 3 — Returning user with multiple tenants

**Estado**: ✅ Implementado

- Página de selección de tenant.
- Persistencia de último tenant activo.
- Auto-selección del último tenant válido cuando aplica.

## Decisiones Técnicas Implementadas

| Decisión | Estado | Nota |
| --- | --- | --- |
| OIDC vía Web BFF + JWT interno | ✅ Implementado | Next.js maneja OIDC; API valida JWT interno. |
| Tenant activo en sesión | ✅ Implementado | El tenant activo viaja en el contexto de sesión/JWT. |
| Logout local | ✅ Implementado | Logout invalida sesión/cookies locales de Plinto, no el IdP. |
| JIT user provisioning | ✅ Implementado | El usuario se crea en primer login. |
| Audit events | ✅ Implementado | Eventos para creación de tenant/membership con tenant/correlation id. |
| RBAC / guards | ✅ Implementado | RoleGuard, TenantGuard y políticas de autorización están presentes. |

## Pendientes Conocidos

### 1. Permiso para seleccionar tenant activo

**Estado**: ✅ Resuelto el 2026-06-16

`POST /tenants/active` usa ahora el permiso explícito `tenant:select`, permitido para `owner`, `member` y `viewer`, junto con `TenantGuard` para validar membresía activa en el tenant solicitado.

**Por qué importa**: seleccionar contexto no es lo mismo que administrar el tenant. Mezclar esas responsabilidades fuerza permisos más altos de lo necesario y contradice el principio de menor privilegio de ADR 0007.

**Evidencia**:

- `AuthorizationPolicy` define `tenant:select` para todos los roles con membresía.
- `ActiveTenantController.setActiveTenant` requiere `tenant:select`, no `tenant:manage`.
- Tests cubren que `member` y `viewer` pueden seleccionar tenant sin recibir permiso de administración.

### 2. Documentación de contratos

**Estado**: ⚠️ Requiere revisión antes de declarar cierre total

Los endpoints principales existen, pero antes de volver a marcar esta feature como “completa” hay que comparar contrato OpenAPI, DTOs reales y tests de integración/contrato.

### 3. Verificación recurrente

**Estado**: ⚠️ Requerida antes de release

Esta feature ya tuvo casos donde la documentación decía “completo” y el código no compilaba. NO se debe volver a usar “COMPLETO” sin evidencia ejecutada en la misma revisión.

Verificación local ejecutada el 2026-06-15:

- [x] `pnpm lint`
- [x] `pnpm test`
- [x] `pnpm build`
- [ ] Smoke test local del flujo OIDC/onboarding
- [x] Revisión explícita de permisos de `POST /tenants/active`

Notas de verificación:

- `pnpm test` pasa con 61 tests en `shared`, 54 en `api` y 79 en `web`.
- `pnpm build` pasa después de corregir el paquete vacío `@plinto/config` para que su build sea no-op hasta que tenga fuente real.
- El build de Next.js muestra warnings no bloqueantes de Browserslist desactualizado y `url.parse()` deprecado.

## Conclusión

**Estado real**: la implementación está avanzada y funcional, y la discrepancia de permisos de selección de tenant ya fue cerrada. Todavía NO debe documentarse como “completa” hasta ejecutar el smoke test local del flujo OIDC/onboarding y cerrar la revisión de contratos.

Esto no es burocracia. Es ingeniería responsable: si el documento dice “completo”, tiene que poder defenderlo con evidencia actual, no con optimismo.
