import {
  Body,
  Controller,
  Get,
  Post,
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
import { CreateAccountSchema } from '../../../../../common/shared-schemas'
import { AccountService } from '../../../application/account.service'

type CreateAccountBody = z.infer<typeof CreateAccountSchema>

@Controller('accounts')
@UseGuards(AuthGuard, TenantGuard, RoleGuard)
export class AccountsController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  @RequirePermission('account:read')
  async listAccounts(@Req() req: RequestContext) {
    const tenantId = req.tenantId as string
    const accounts = await this.accountService.listAccounts(tenantId)

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
}
