import { CreditLine, CreditLineStatus } from './credit-line.entity'

/**
 * Port: the credit-line persistence contract the application layer depends on.
 * Adapters live in the infrastructure layer and implement this abstract class,
 * which doubles as the DI token.
 */
export abstract class CreditLineRepository {
  abstract create(data: {
    tenantId: string
    name: string
    limitMinor: number
    currency: string
  }): Promise<CreditLine>

  abstract findByIdForTenant(id: string, tenantId: string): Promise<CreditLine | null>

  abstract listForTenant(tenantId: string): Promise<CreditLine[]>

  abstract update(
    id: string,
    tenantId: string,
    data: { name?: string; limitMinor?: number },
  ): Promise<CreditLine | null>

  abstract setStatus(
    id: string,
    tenantId: string,
    status: CreditLineStatus,
  ): Promise<CreditLine | null>
}
