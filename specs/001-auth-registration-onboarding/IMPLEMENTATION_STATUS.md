# Estado de Implementación: Authentication, Registration, and Tenant Onboarding

**Fecha de revisión**: 2026-06-16
**Estado general**: ✅ **COMPLETO PARA EL ALCANCE PRD 001**

## Resumen Ejecutivo

La feature `001-auth-registration-onboarding` está implementada y el flujo principal de autenticación/onboarding fue validado en desarrollo local con evidencia actual. El estado anterior de este documento era demasiado optimista; esta revisión cierra explícitamente los bugs y discrepancias encontrados antes de volver a declarar el alcance como completo.

Este documento ahora separa tres cosas que NO son lo mismo:

1. **Implementado**: el código existe para cubrir el flujo principal.
2. **Validado**: build/lint/tests y smoke checks han pasado en revisiones previas.
3. **Cerrado**: las decisiones o discrepancias conocidas fueron resueltas con evidencia.

## Estado Validado

| Área | Estado | Evidencia |
| --- | --- | --- |
| Build/lint inicial de la feature | ✅ Corregido | Se arreglaron blockers de compilación, import path, Prisma generate y configuración ESLint. |
| Testing monorepo | ✅ Implementado | Vitest quedó configurado para `packages/shared`, `apps/api` y `apps/web`. |
| BFF auth web | ✅ Corregido | Tests detectaron y se corrigieron bugs de logout y parsing del refresh token. |
| Setup local web + API | ✅ Validado | `pnpm dev` levanta web en `:3000` y API en `:3001`; OIDC BFF redirige correctamente a Auth0. |
| Archivos `.env.example` | ✅ Corregido | Redirect URI y API base path fueron ajustados a los valores reales del entorno local. |
| Navegación post-auth | ✅ Corregido | El dashboard vive ahora en `/dashboard`; la selección de tenant y los redirects post-login/onboarding ya no apuntan a `/(dashboard)` ni a la home placeholder. |
| Smoke test OIDC/onboarding | ✅ Validado | El usuario confirmó el 2026-06-16 que login, selección de tenant y navegación a `/dashboard` funcionan después de los fixes. |

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

## Pendientes Cerrados

### 1. Permiso para seleccionar tenant activo

**Estado**: ✅ Resuelto el 2026-06-16

`POST /tenants/active` usa ahora el permiso explícito `tenant:select`, permitido para `owner`, `member` y `viewer`, junto con `TenantGuard` para validar membresía activa en el tenant solicitado.

**Por qué importa**: seleccionar contexto no es lo mismo que administrar el tenant. Mezclar esas responsabilidades fuerza permisos más altos de lo necesario y contradice el principio de menor privilegio de ADR 0007.

**Evidencia**:

- `AuthorizationPolicy` define `tenant:select` para todos los roles con membresía.
- `ActiveTenantController.setActiveTenant` requiere `tenant:select`, no `tenant:manage`.
- Tests cubren que `member` y `viewer` pueden seleccionar tenant sin recibir permiso de administración.

### 2. Documentación de contratos

**Estado**: ✅ Revisado el 2026-06-16

Se compararon endpoints principales, DTOs Zod compartidos y controllers reales. La revisión detectó y corrigió una omisión en OpenAPI: `POST /auth/session` es un endpoint interno protegido por `x-internal-key`, no por la cookie pública `plinto_session`.

**Evidencia**:

- `specs/001-auth-registration-onboarding/contracts/api.yaml` declara ahora `InternalKeyAuth`.
- `POST /auth/session` documenta el header requerido `x-internal-key`.
- Los schemas OpenAPI de `UpdateProfileRequest`, `CreateTenantRequest`, `SelectTenantRequest` y `CreateSessionRequest` están alineados con los schemas Zod compartidos.

### 3. Verificación recurrente

**Estado**: ✅ Ejecutada el 2026-06-16

Esta feature ya tuvo casos donde la documentación decía “completo” y el código no compilaba. NO se debe volver a usar “COMPLETO” sin evidencia ejecutada en la misma revisión.

Verificación local ejecutada entre el 2026-06-15 y el 2026-06-16:

- [x] `pnpm lint`
- [x] `pnpm test`
- [x] `pnpm build`
- [x] Smoke test local del flujo OIDC/onboarding
- [x] Revisión explícita de permisos de `POST /tenants/active`
- [x] Corrección de navegación post-auth hacia `/dashboard`

Notas de verificación:

- `pnpm test` pasa con 61 tests en `shared`, 54 en `api` y 79 en `web`.
- `pnpm build` pasa después de corregir el paquete vacío `@plinto/config` para que su build sea no-op hasta que tenga fuente real.
- El smoke test confirmó que seleccionar tenant redirige correctamente a `/dashboard`.
- El build de Next.js muestra warnings no bloqueantes de Browserslist desactualizado y `url.parse()` deprecado.

## Conclusión

**Estado real**: el alcance de PRD 001 queda completo y validado para continuar con el siguiente vertical slice: creación y listado de cuentas financieras.

Esto no es burocracia. Es ingeniería responsable: si el documento dice “completo”, tiene que poder defenderlo con evidencia actual, no con optimismo.
