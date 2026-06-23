import { Injectable, NotFoundException } from '@nestjs/common'
import { CategoryRepository } from '../infrastructure/category.repository'
import { AuditService } from '../../audit/application/audit.service'
import { Category } from '../domain/category.entity'
import { TransactionType } from '../../transactions/domain/transaction.entity'

@Injectable()
export class CategoryService {
  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly auditService: AuditService,
  ) {}

  async createCategory(params: {
    tenantId: string
    actorUserId: string | null
    correlationId: string
    name: string
    type: TransactionType
    color?: string
  }): Promise<Category> {
    const category = await this.categoryRepository.create({
      tenantId: params.tenantId,
      name: params.name,
      type: params.type,
      color: params.color ?? null,
    })

    await this.auditService.record({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: 'category.created',
      resourceType: 'category',
      resourceId: category.id,
      correlationId: params.correlationId,
      metadata: {
        name: category.name,
        type: category.type,
        color: category.color,
      },
    })

    return category
  }

  async listCategories(tenantId: string): Promise<Category[]> {
    return this.categoryRepository.listByTenantId(tenantId)
  }

  async findByIdForTenant(id: string, tenantId: string): Promise<Category> {
    const category = await this.categoryRepository.findByIdForTenant(id, tenantId)

    if (!category) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: 'Category not found for the active tenant',
      })
    }

    return category
  }

  async updateCategory(params: {
    id: string
    tenantId: string
    actorUserId: string | null
    correlationId: string
    name?: string
    color?: string | null
  }): Promise<Category> {
    const existing = await this.categoryRepository.findByIdForTenant(params.id, params.tenantId)

    if (!existing) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: 'Category not found for the active tenant',
      })
    }

    const updated = await this.categoryRepository.updateForTenant(params.id, params.tenantId, {
      name: params.name,
      color: params.color,
    })

    if (!updated) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: 'Category not found for the active tenant',
      })
    }

    await this.auditService.record({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: 'category.updated',
      resourceType: 'category',
      resourceId: updated.id,
      correlationId: params.correlationId,
      metadata: {
        before: { name: existing.name, color: existing.color },
        after: { name: updated.name, color: updated.color },
      },
    })

    return updated
  }

  async deleteCategory(params: {
    id: string
    tenantId: string
    actorUserId: string | null
    correlationId: string
  }): Promise<void> {
    const existing = await this.categoryRepository.findByIdForTenant(params.id, params.tenantId)

    if (!existing) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: 'Category not found for the active tenant',
      })
    }

    await this.categoryRepository.deleteForTenant(params.id, params.tenantId)
    // No audit event on deletion per spec Decision 1
  }
}
