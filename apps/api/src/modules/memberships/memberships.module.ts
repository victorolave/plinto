import { Module } from '@nestjs/common'
import { MembershipRepository } from './domain/membership.repository'
import { PrismaMembershipRepository } from './infrastructure/prisma-membership.repository'

@Module({
  providers: [{ provide: MembershipRepository, useClass: PrismaMembershipRepository }],
  exports: [MembershipRepository],
})
export class MembershipsModule {}
