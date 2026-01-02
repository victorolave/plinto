import { z } from 'zod'

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional().nullable(),
  createdAt: z.string(),
})

export type UserDto = z.infer<typeof UserSchema>
