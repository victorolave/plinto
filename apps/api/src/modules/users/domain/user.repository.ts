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

  abstract create(data: {
    idpSub: string
    email: string
    name?: string | null
  }): Promise<User>

  abstract updateName(id: string, name: string): Promise<User>
}
