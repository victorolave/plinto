import { Injectable, NotFoundException } from '@nestjs/common'
import { AccountRepository } from '../domain/account.repository'
import { AuditService } from '../../audit/application/audit.service'
import { Account, AccountType } from '../domain/account.entity'

const ACCOUNT_NOT_FOUND = {
  code: 'ACCOUNT_NOT_FOUND',
  message: 'Account not found for the active tenant',
} as const

@Injectable()
export class AccountService {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly auditService: AuditService,
  ) {}

  async createAccount(params: {
    tenantId: string
    name: string
    type: AccountType
    currency: string
  }): Promise<Account> {
    return this.accountRepository.create({
      tenantId: params.tenantId,
      name: params.name,
      type: params.type,
      currency: params.currency,
    })
  }

  async listAccounts(
    tenantId: string,
    options: { includeArchived?: boolean } = {},
  ): Promise<Account[]> {
    return this.accountRepository.listByTenantId(tenantId, options)
  }

  async updateAccount(params: {
    id: string
    tenantId: string
    actorUserId: string | null
    correlationId: string
    name?: string
    type?: AccountType
  }): Promise<Account> {
    const existing = await this.accountRepository.findByIdForTenant(
      params.id,
      params.tenantId,
    )

    if (!existing) {
      throw new NotFoundException(ACCOUNT_NOT_FOUND)
    }

    const updated = await this.accountRepository.updateForTenant(
      params.id,
      params.tenantId,
      { name: params.name, type: params.type },
    )

    if (!updated) {
      throw new NotFoundException(ACCOUNT_NOT_FOUND)
    }

    await this.auditService.record({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: 'account.updated',
      resourceType: 'account',
      resourceId: updated.id,
      correlationId: params.correlationId,
      metadata: {
        before: { name: existing.name, type: existing.type },
        after: { name: updated.name, type: updated.type },
      },
    })

    return updated
  }

  async archiveAccount(params: {
    id: string
    tenantId: string
    actorUserId: string | null
    correlationId: string
  }): Promise<Account> {
    const existing = await this.accountRepository.findByIdForTenant(
      params.id,
      params.tenantId,
    )

    if (!existing) {
      throw new NotFoundException(ACCOUNT_NOT_FOUND)
    }

    // Already archived → idempotent success, nothing to record.
    if (existing.archivedAt) {
      return existing
    }

    const archived = await this.accountRepository.archiveForTenant(
      params.id,
      params.tenantId,
      new Date(),
    )

    if (!archived) {
      throw new NotFoundException(ACCOUNT_NOT_FOUND)
    }

    await this.auditService.record({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: 'account.archived',
      resourceType: 'account',
      resourceId: archived.id,
      correlationId: params.correlationId,
      metadata: { name: archived.name },
    })

    return archived
  }

  async restoreAccount(params: {
    id: string
    tenantId: string
    actorUserId: string | null
    correlationId: string
  }): Promise<Account> {
    const existing = await this.accountRepository.findByIdForTenant(
      params.id,
      params.tenantId,
    )

    if (!existing) {
      throw new NotFoundException(ACCOUNT_NOT_FOUND)
    }

    // Already active → idempotent success, nothing to record.
    if (!existing.archivedAt) {
      return existing
    }

    const restored = await this.accountRepository.restoreForTenant(
      params.id,
      params.tenantId,
    )

    if (!restored) {
      throw new NotFoundException(ACCOUNT_NOT_FOUND)
    }

    await this.auditService.record({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: 'account.restored',
      resourceType: 'account',
      resourceId: restored.id,
      correlationId: params.correlationId,
      metadata: { name: restored.name },
    })

    return restored
  }
}
