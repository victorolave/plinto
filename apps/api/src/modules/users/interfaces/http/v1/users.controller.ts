import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common'
import { RequestContext } from '../../../../../common/types/request-context'
import { AuthGuard } from '../../../../../common/guards/auth.guard'
import { ZodValidationPipe } from '../../../../../common/pipes/zod-validation.pipe'
import { UpdateProfileSchema } from '../../../../../common/shared-schemas'
import { UserProfileService } from '../../../application/user-profile.service'
import { MembershipRepository } from '../../../../memberships/domain/membership.repository'
import { SessionService } from '../../../../sessions/application/session.service'

@Controller('me')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(
    private readonly userProfileService: UserProfileService,
    private readonly membershipRepository: MembershipRepository,
    private readonly sessionService: SessionService,
  ) {}

  @Get()
  async getMe(@Req() req: RequestContext) {
    const userId = req.user?.id ?? ''
    const user = await this.userProfileService.getProfile(userId)
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
    const user = await this.userProfileService.updateProfile({
      userId,
      name: body.name,
      correlationId: req.requestId ?? 'unknown',
    })
    return { data: user }
  }

  @Post('onboarding-tour/seen')
  async markOnboardingTourSeen(@Req() req: RequestContext) {
    const userId = req.user?.id ?? ''
    const user = await this.userProfileService.markOnboardingTourSeen({
      userId,
      correlationId: req.requestId ?? 'unknown',
    })
    return { data: user }
  }
}
