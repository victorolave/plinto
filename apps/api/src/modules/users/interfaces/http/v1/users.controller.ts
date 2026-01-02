import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common'
import { RequestContext } from '../../../../../common/types/request-context'
import { AuthGuard } from '../../../../../common/guards/auth.guard'
import { ZodValidationPipe } from '../../../../../common/pipes/zod-validation.pipe'
import { UpdateProfileSchema } from '../../../../../common/shared-schemas'
import { UserRepository } from '../../../infrastructure/user.repository'
import { MembershipRepository } from '../../../../memberships/infrastructure/membership.repository'
import { SessionService } from '../../../../sessions/application/session.service'

@Controller('me')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly sessionService: SessionService,
  ) {}

  @Get()
  async getMe(@Req() req: RequestContext) {
    const userId = req.user?.id ?? ''
    const user = await this.userRepository.findById(userId)
    const memberships = await this.membershipRepository.listByUserId(userId)
    let activeTenantId = await this.sessionService.getActiveTenant(userId)
    if (!activeTenantId) {
      activeTenantId = await this.sessionService.autoSelectIfSingleTenant(userId)
    }

    return {
      data: {
        user,
        memberships,
        activeTenantId,
      },
    }
  }

  @Patch()
  @UsePipes(new ZodValidationPipe(UpdateProfileSchema))
  async updateProfile(
    @Req() req: RequestContext,
    @Body() body: { name: string },
  ) {
    const userId = req.user?.id ?? ''
    const user = await this.userRepository.updateName(userId, body.name)
    return { data: user }
  }
}
