import 'reflect-metadata'
import { Reflector } from '@nestjs/core'
import { describe, expect, it, vi } from 'vitest'
import { PERMISSION_KEY } from '../../../../../../common/guards/role.guard'
import { ExportController } from '../export.controller'
import type { HouseholdExportService } from '../../../../application/household-export.service'
import type { RequestContext } from '../../../../../../common/types/request-context'

function buildResponse() {
  return {
    setHeader: vi.fn(),
    send: vi.fn(),
  }
}

describe('ExportController', () => {
  it('requires tenant:export to download the household bundle', () => {
    const reflector = new Reflector()

    const permission = reflector.get(
      PERMISSION_KEY,
      ExportController.prototype.exportHousehold,
    )

    expect(permission).toBe('tenant:export')
  })

  it('requires tenant:export to download the transactions CSV', () => {
    const reflector = new Reflector()

    const permission = reflector.get(
      PERMISSION_KEY,
      ExportController.prototype.exportTransactionsCsv,
    )

    expect(permission).toBe('tenant:export')
  })

  describe('exportHousehold', () => {
    it('sets the JSON attachment headers and sends the body, for the guard-resolved tenant', async () => {
      const service = {
        exportHousehold: vi.fn().mockResolvedValue({
          json: '{"format":"plinto-household-export"}',
          filename: 'plinto-casa-olave-2026-09-02.json',
        }),
      }
      const controller = new ExportController(service as unknown as HouseholdExportService)
      const res = buildResponse()

      await controller.exportHousehold(
        { tenantId: 'tenant-1', user: { id: 'user-1' }, requestId: 'req-1' } as RequestContext,
        res as never,
      )

      expect(service.exportHousehold).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        correlationId: 'req-1',
      })
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json; charset=utf-8',
      )
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="plinto-casa-olave-2026-09-02.json"',
      )
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')
      expect(res.send).toHaveBeenCalledWith('{"format":"plinto-household-export"}')
    })

    it('lets a service failure propagate without touching the response', async () => {
      const service = {
        exportHousehold: vi.fn().mockRejectedValue(new Error('boom')),
      }
      const controller = new ExportController(service as unknown as HouseholdExportService)
      const res = buildResponse()

      await expect(
        controller.exportHousehold(
          { tenantId: 'tenant-1', user: { id: 'user-1' }, requestId: 'req-1' } as RequestContext,
          res as never,
        ),
      ).rejects.toThrow('boom')

      expect(res.setHeader).not.toHaveBeenCalled()
      expect(res.send).not.toHaveBeenCalled()
    })
  })

  describe('exportTransactionsCsv', () => {
    it('sets the CSV attachment headers and sends the body', async () => {
      const service = {
        exportTransactionsCsv: vi.fn().mockResolvedValue({
          csv: '\uFEFFoccurred_at\r\n',
          filename: 'plinto-casa-olave-transactions-2026-09-02.csv',
        }),
      }
      const controller = new ExportController(service as unknown as HouseholdExportService)
      const res = buildResponse()

      await controller.exportTransactionsCsv(
        { tenantId: 'tenant-1', user: { id: 'user-1' }, requestId: 'req-1' } as RequestContext,
        res as never,
      )

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8')
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="plinto-casa-olave-transactions-2026-09-02.csv"',
      )
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')
      expect(res.send).toHaveBeenCalledWith('\uFEFFoccurred_at\r\n')
    })

    it('lets a service failure propagate without touching the response', async () => {
      const service = {
        exportTransactionsCsv: vi.fn().mockRejectedValue(new Error('boom')),
      }
      const controller = new ExportController(service as unknown as HouseholdExportService)
      const res = buildResponse()

      await expect(
        controller.exportTransactionsCsv(
          { tenantId: 'tenant-1', user: { id: 'user-1' }, requestId: 'req-1' } as RequestContext,
          res as never,
        ),
      ).rejects.toThrow('boom')

      expect(res.setHeader).not.toHaveBeenCalled()
      expect(res.send).not.toHaveBeenCalled()
    })
  })
})
