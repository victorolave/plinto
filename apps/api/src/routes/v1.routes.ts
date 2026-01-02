import { Routes } from '@nestjs/core'
import { AuthModule } from '../modules/auth/auth.module'
import { UsersModule } from '../modules/users/users.module'
import { TenantsModule } from '../modules/tenants/tenants.module'
import { SessionsModule } from '../modules/sessions/sessions.module'
import { MembershipsModule } from '../modules/memberships/memberships.module'

export const v1Routes: Routes = [
  {
    path: 'v1',
    children: [
      { path: '', module: AuthModule },
      { path: '', module: UsersModule },
      { path: '', module: TenantsModule },
      { path: '', module: SessionsModule },
      { path: '', module: MembershipsModule },
    ],
  },
]
