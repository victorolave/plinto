import { Module } from '@nestjs/common'
import { MembershipRepository } from './infrastructure/membership.repository'

@Module({
  providers: [MembershipRepository],
  exports: [MembershipRepository],
})
export class MembershipsModule {}
