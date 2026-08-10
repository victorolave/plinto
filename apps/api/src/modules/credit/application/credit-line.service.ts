import { Injectable, NotFoundException } from '@nestjs/common'
import { AuditService } from '../../audit/application/audit.service'
import { CreditLine } from '../domain/credit-line.entity'
import { CreditLineRepository } from '../domain/credit-line.repository'

/**
 * Revolving credit: cards and rotating lines such as ADDI. See PRD-011.
 *
 * This service holds only what does not change between statements — the name,
 * the ceiling, and whether the line is still open. Everything that moves lives
 * on the statements the lender issues, because the lender is the one who
 * decides it.
 */
@Injectable()
export class CreditLineService {
  constructor(
    private readonly creditLineRepository: CreditLineRepository,
    private readonly auditService: AuditService,
  ) {}

  async createLine(params: {
    tenantId: string
    actorUserId: string | null
    correlationId: string
    name: string
    limitMinor: number
    currency: string
  }): Promise<CreditLine> {
    const line = await this.creditLineRepository.create({
      tenantId: params.tenantId,
      name: params.name,
      limitMinor: params.limitMinor,
      currency: params.currency,
    })

    await this.auditService.record({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: 'credit_line.created',
      resourceType: 'credit_line',
      resourceId: line.id,
      correlationId: params.correlationId,
      metadata: { limitMinor: params.limitMinor, currency: params.currency },
    })

    return line
  }

  async listLines(tenantId: string): Promise<CreditLine[]> {
    return this.creditLineRepository.listForTenant(tenantId)
  }

  async getLine(id: string, tenantId: string): Promise<CreditLine> {
    const line = await this.creditLineRepository.findByIdForTenant(id, tenantId)

    if (!line) {
      throw new NotFoundException({
        code: 'CREDIT_LINE_NOT_FOUND',
        message: 'Credit line not found for the active tenant',
      })
    }

    return line
  }

  /**
   * Name and limit only.
   *
   * Raising a ceiling is an ordinary event and must not disturb history: each
   * statement records the limit it was measured against, so past available
   * figures keep meaning what they meant when they were read.
   */
  async updateLine(params: {
    tenantId: string
    actorUserId: string | null
    correlationId: string
    id: string
    name?: string
    limitMinor?: number
  }): Promise<CreditLine> {
    const line = await this.creditLineRepository.update(params.id, params.tenantId, {
      name: params.name,
      limitMinor: params.limitMinor,
    })

    if (!line) {
      throw new NotFoundException({
        code: 'CREDIT_LINE_NOT_FOUND',
        message: 'Credit line not found for the active tenant',
      })
    }

    await this.auditService.record({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: 'credit_line.updated',
      resourceType: 'credit_line',
      resourceId: line.id,
      correlationId: params.correlationId,
      metadata: { name: params.name, limitMinor: params.limitMinor },
    })

    return line
  }

  /**
   * Closed, never deleted. The statements a line issued are real — some of
   * them paid — and removing what issued them would leave a household looking
   * at payments whose reason had vanished. Same call PRD-007 made for a
   * cancelled schedule.
   */
  async closeLine(params: {
    tenantId: string
    actorUserId: string | null
    correlationId: string
    id: string
  }): Promise<CreditLine> {
    const line = await this.creditLineRepository.setStatus(params.id, params.tenantId, 'closed')

    if (!line) {
      throw new NotFoundException({
        code: 'CREDIT_LINE_NOT_FOUND',
        message: 'Credit line not found for the active tenant',
      })
    }

    await this.auditService.record({
      tenantId: params.tenantId,
      actorUserId: params.actorUserId,
      action: 'credit_line.closed',
      resourceType: 'credit_line',
      resourceId: line.id,
      correlationId: params.correlationId,
    })

    return line
  }
}
