import { Module } from '@nestjs/common'
import { MembershipsModule } from '../memberships/memberships.module'
import { SessionsModule } from '../sessions/sessions.module'
import { AuditModule } from '../audit/audit.module'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RoleGuard } from '../../common/guards/role.guard'
import { CategoryRepository } from './infrastructure/category.repository'
import { CategoryService } from './application/category.service'
import { CategoriesController } from './interfaces/http/v1/categories.controller'

@Module({
  imports: [MembershipsModule, SessionsModule, AuditModule],
  controllers: [CategoriesController],
  providers: [
    CategoryRepository,
    CategoryService,
    AuthGuard,
    TenantGuard,
    RoleGuard,
  ],
  exports: [CategoryService, CategoryRepository],
})
export class CategoriesModule {}
