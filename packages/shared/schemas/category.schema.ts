import { z } from 'zod'
import { TransactionTypeSchema } from './transaction.schema'
import { VALIDATION_CODE, validationIssue } from './validation-code'

export const CategoryTypeSchema = TransactionTypeSchema

export const CategorySchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  type: CategoryTypeSchema,
  color: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const CreateCategorySchema = z.object({
  name: z.string().trim().min(1),
  type: CategoryTypeSchema,
  color: z.string().trim().min(1).optional(),
})

export const UpdateCategorySchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    color: z.string().trim().min(1).nullable().optional(),
  })
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    validationIssue(VALIDATION_CODE.AT_LEAST_ONE_FIELD),
  )

export const ExpenseByCategoryItemSchema = z.object({
  categoryId: z.string(),
  categoryName: z.string(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  totalMinor: z.number().int(),
})

export const ExpenseByCategoryReportSchema = z.object({
  from: z.string(),
  to: z.string(),
  items: z.array(ExpenseByCategoryItemSchema),
})

export type CategoryTypeDto = z.infer<typeof CategoryTypeSchema>
export type CategoryDto = z.infer<typeof CategorySchema>
export type CreateCategoryDto = z.infer<typeof CreateCategorySchema>
export type UpdateCategoryDto = z.infer<typeof UpdateCategorySchema>
export type ExpenseByCategoryItemDto = z.infer<typeof ExpenseByCategoryItemSchema>
export type ExpenseByCategoryReportDto = z.infer<typeof ExpenseByCategoryReportSchema>
