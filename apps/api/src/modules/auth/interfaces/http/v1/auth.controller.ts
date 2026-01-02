import {
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  UsePipes,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RequestContext } from '../../../../../common/types/request-context'
import { ZodValidationPipe } from '../../../../../common/pipes/zod-validation.pipe'
import { CreateSessionSchema } from '../../../../../common/shared-schemas'
import { AuthService } from '../../../application/auth.service'
import { AuthGuard } from '../../../../../common/guards/auth.guard'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('session')
  @UsePipes(new ZodValidationPipe(CreateSessionSchema))
  async createSession(@Req() req: RequestContext, @Body() body: any) {
    const internalKeyHeader = req.headers['x-internal-key']
    const internalKey = Array.isArray(internalKeyHeader)
      ? internalKeyHeader[0]
      : internalKeyHeader
    const expectedKey = this.configService.get<string>('internalApiKey')

    if (!internalKey || internalKey !== expectedKey) {
      throw new UnauthorizedException('Invalid internal key')
    }

    const result = await this.authService.createSession({
      idpSub: body.idpSub,
      email: body.email,
      name: body.name,
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: req.ip ?? null,
    })

    return {
      data: {
        sessionId: result.session.id,
        expiresAt: result.session.expiresAt,
        user: result.user,
        memberships: result.memberships,
        activeTenantId: result.activeTenantId,
        needsOnboarding: result.needsOnboarding,
      },
    }
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  async logout(@Req() req: RequestContext) {
    if (!req.sessionId) {
      throw new UnauthorizedException('Session not found')
    }
    await this.authService.revokeSession(req.sessionId)
    return { data: { success: true } }
  }
}
