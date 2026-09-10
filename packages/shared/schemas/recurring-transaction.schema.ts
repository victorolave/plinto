import { z } from 'zod'
import { TransactionTypeSchema } from './transaction.schema'
import { VALIDATION_CODE, validationIssue } from './validation-code'

export const RecurringTransactionFrequencySchema = z.enum(['monthly'])

/**
 * Lifecycle of a recurring rule, modelled as a single enum rather than an
 * `active` flag plus an `archivedAt` timestamp (the Account pattern). A rule
 * has exactly one lifecycle state, so a boolean pair would make the
 * contradictory "active and archived" combination representable, and every
 * job/query would have to remember both predicates. Consumers that decide
 * whether a rule may materialize money check `status === 'active'` — one
 * predicate, no forgotten clause.
 *
 * - `active`   — evaluated by the execution job; posts transactions when due.
 * - `paused`   — kept and editable, but skipped by the job. Reversible.
 * - `archived` — retired from the active surfaces. Restorable, never deleted:
 *                executions reference the rule with ON DELETE RESTRICT, and
 *                deleting it would strand the audit trail required by ADR 0008.
 */
export const RecurringRuleStatusSchema = z.enum(['active', 'paused', 'archived'])

/**
 * Creation accepts only the two live states: a rule that is born archived has
 * no meaning, so the enum is deliberately narrower here than on the entity.
 */
export const CreateRecurringRuleStatusSchema = z.enum(['active', 'paused'])

export const CreateRecurringTransactionRuleSchema = z.object({
  name: z.string().trim().min(1),
  accountId: z.string().trim().min(1),
  type: TransactionTypeSchema,
  amountMinor: z.number().int().positive(),
  frequency: RecurringTransactionFrequencySchema.default('monthly'),
  dayOfMonth: z.number().int().min(1).max(28),
  startDate: z.string().datetime(),
  status: CreateRecurringRuleStatusSchema.default('active'),
})

/**
 * `accountId`, `type`, `currency` and `frequency` are intentionally omitted,
 * for the same reason `UpdateAccountSchema` omits `currency`: past periods are
 * already materialized as transactions carrying the rule's account, type and
 * currency. Editing them would leave the rule describing something its own
 * history contradicts. Retire the rule and create a new one instead.
 *
 * `status` is omitted too — lifecycle moves through the explicit
 * pause/resume/archive/restore endpoints, so an intent as consequential as
 * "stop posting money" is never a side effect of a field edit.
 */
export const UpdateRecurringTransactionRuleSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    amountMinor: z.number().int().positive().optional(),
    dayOfMonth: z.number().int().min(1).max(28).optional(),
    startDate: z.string().datetime().optional(),
  })
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    validationIssue(VALIDATION_CODE.AT_LEAST_ONE_FIELD),
  )

export const RecurringTransactionRuleSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  accountId: z.string(),
  name: z.string(),
  type: TransactionTypeSchema,
  amountMinor: z.number().int(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  frequency: RecurringTransactionFrequencySchema,
  dayOfMonth: z.number().int().min(1).max(28),
  startDate: z.string(),
  status: RecurringRuleStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type RecurringTransactionFrequencyDto = z.infer<typeof RecurringTransactionFrequencySchema>
export type RecurringRuleStatusDto = z.infer<typeof RecurringRuleStatusSchema>
export type CreateRecurringTransactionRuleDto = z.infer<typeof CreateRecurringTransactionRuleSchema>
export type UpdateRecurringTransactionRuleDto = z.infer<typeof UpdateRecurringTransactionRuleSchema>
export type RecurringTransactionRuleDto = z.infer<typeof RecurringTransactionRuleSchema>
