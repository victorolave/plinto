import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as jwt from 'jsonwebtoken'

export interface PlintoJwtPayload {
  sub: string // Internal user ID
  idp_sub: string // IdP subject
  tenant_id?: string | null // Optional tenant ID
  session_id: string // Session ID for revocation
}

@Injectable()
export class JwtService {
  private readonly secret: string
  private readonly issuer = 'plinto'
  private readonly audience = 'plinto-api'

  constructor(private readonly configService: ConfigService) {
    this.secret = this.configService.get<string>('jwtSecret') || 'change-me-in-production'
  }

  verify(token: string): PlintoJwtPayload {
    try {
      const decoded = jwt.verify(token, this.secret, {
        issuer: this.issuer,
        audience: this.audience,
      }) as PlintoJwtPayload
      return decoded
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token')
    }
  }
}

