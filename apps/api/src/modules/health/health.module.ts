import { Module } from '@nestjs/common'
import { HealthController } from './interfaces/http/v1/health.controller'

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
