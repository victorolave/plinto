import { z } from 'zod'

/**
 * Body for `POST /tenants/demo`. `locale` picks the language of the example
 * household's copy (account/category names, transaction descriptions); it
 * never changes the underlying brands or figures.
 */
export const CreateDemoHouseholdSchema = z.object({
  locale: z.enum(['es', 'en']).optional(),
})

export type CreateDemoHouseholdDto = z.infer<typeof CreateDemoHouseholdSchema>
