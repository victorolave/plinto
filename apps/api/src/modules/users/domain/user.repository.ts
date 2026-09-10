import { User } from './user.entity'

/**
 * Port: the user persistence contract the application layer depends on.
 * Adapters (e.g. PrismaUserRepository) live in the infrastructure layer and
 * implement this abstract class, which doubles as the DI token — so the ORM
 * can be swapped by binding a different adapter without touching business
 * logic.
 */
export abstract class UserRepository {
  abstract findById(id: string): Promise<User | null>

  abstract findByIdpSub(idpSub: string): Promise<User | null>

  /**
   * Looks a user up by the address an invitation was sent to. Matching is
   * case-insensitive: the identity provider decides the casing of the email it
   * hands us, and the person who typed the invitation does not know it.
   */
  abstract findByEmail(email: string): Promise<User | null>

  abstract create(data: {
    idpSub: string
    email: string
    name?: string | null
  }): Promise<User>

  abstract updateName(id: string, name: string): Promise<User>

  /**
   * Stamps `onboardingTourSeenAt` with now. Callers are responsible for the
   * idempotency check (only call this when the field is still null) — this
   * adapter unconditionally overwrites it.
   */
  abstract markOnboardingTourSeen(id: string): Promise<User>
}
