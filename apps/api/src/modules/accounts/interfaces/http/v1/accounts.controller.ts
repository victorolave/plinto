import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common'
import { z } from 'zod'
import { RequestContext } from '../../../../../common/types/request-context'
import { AuthGuard } from '../../../../../common/guards/auth.guard'
import { TenantGuard } from '../../../../../common/guards/tenant.guard'
import {
  RequirePermission,
  RoleGuard,
} from '../../../../../common/guards/role.guard'
import { ZodValidationPipe } from '../../../../../common/pipes/zod-validation.pipe'
import {
  CreateAccountSchema,
  UpdateAccountSchema,
} from '../../../../../common/shared-schemas'
import { AccountService } from '../../../application/account.service'

type CreateAccountBody = z.infer<typeof CreateAccountSchema>
type UpdateAccountBody = z.infer<typeof UpdateAccountSchema>

@Controller('accounts')
@UseGuards(AuthGuard, TenantGuard, RoleGuard)
export class AccountsController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  @RequirePermission('account:read')
  async listAccounts(
    @Req() req: RequestContext,
    @Query('includeArchived') includeArchived?: string,
  ) {
    const tenantId = req.tenantId as string
    const accounts = await this.accountService.listAccounts(tenantId, {
      includeArchived: includeArchived === 'true',
    })

    return {
      data: {
        accounts,
      },
    }
  }

  @Post()
  @RequirePermission('account:write')
  @UsePipes(new ZodValidationPipe(CreateAccountSchema))
  async createAccount(
    @Req() req: RequestContext,
    @Body() body: CreateAccountBody,
  ) {
    const account = await this.accountService.createAccount({
      tenantId: req.tenantId as string,
      name: body.name,
      type: body.type,
      currency: body.currency,
    })

    return {
      data: {
        account,
      },
    }
  }

  @Patch(':id')
  @RequirePermission('account:write')
  async updateAccount(
    @Req() req: RequestContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateAccountSchema)) body: UpdateAccountBody,
  ) {
    const account = await this.accountService.updateAccount({
      id,
      tenantId: req.tenantId as string,
      actorUserId: req.user?.id ?? null,
      correlationId: req.requestId ?? 'unknown',
      name: body.name,
      type: body.type,
    })

    return {
      data: {
        account,
      },
    }
  }

  @Post(':id/restore')
  @RequirePermission('account:write')
  async restoreAccount(@Req() req: RequestContext, @Param('id') id: string) {
    const account = await this.accountService.restoreAccount({
      id,
      tenantId: req.tenantId as string,
      actorUserId: req.user?.id ?? null,
      correlationId: req.requestId ?? 'unknown',
    })

    return {
      data: {
        account,
      },
    }
  }

  @Delete(':id')
  @RequirePermission('account:delete')
  async archiveAccount(@Req() req: RequestContext, @Param('id') id: string) {
    const account = await this.accountService.archiveAccount({
      id,
      tenantId: req.tenantId as string,
      actorUserId: req.user?.id ?? null,
      correlationId: req.requestId ?? 'unknown',
    })

    return {
      data: {
        account,
      },
    }
  }
}
