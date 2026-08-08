import { z } from 'zod'

/** Calendar period a set of obligations belongs to, e.g. `2026-07`. */
export const ObligationPeriodSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Period must be formatted as YYYY-MM')

/**
 * Where the instance came from. `debt_schedule` arrived with PRD-007; the
 * matching foreign key is validated by a CHECK constraint in the database, so
 * an instance can never claim an origin it does not actually reference.
 */
export const ObligationSourceTypeSchema = z.enum([
  'recurring_rule',
  'manual',
  'debt_schedule',
])

/**
 * Derived, never stored. `pending`/`partial`/`paid` come from the sum of the
 * linked payments against the expected amount, and `overdue` from the due date
 * — so the reported state cannot drift out of sync with the payments, and no
 * job is needed to age instances into `overdue`.
 */
export const ObligationStatusSchema = z.enum(['pending', 'partial', 'paid', 'overdue'])

export const ObligationPaymentSchema = z.object({
  id: z.string(),
  transactionId: z.string(),
  amountMinor: z.number().int(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  occurredAt: z.string(),
  createdAt: z.string(),
})

export const ObligationInstanceSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  sourceType: ObligationSourceTypeSchema,
  /** Set if and only if `sourceType` is `debt_schedule`. */
  debtScheduleId: z.string().nullable().optional(),
  recurringRuleId: z.string().nullable(),
  period: ObligationPeriodSchema,
  dueDate: z.string(),
  name: z.string(),
  expectedAmountMinor: z.number().int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  status: ObligationStatusSchema,
  paidAmountMinor: z.number().int(),
  outstandingAmountMinor: z.number().int(),
  payments: z.array(ObligationPaymentSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
})

/**
 * A one-off obligation with no template behind it — a tax filing, a school
 * enrolment. `sourceType` is not accepted: an obligation created through this
 * endpoint is `manual` by construction.
 */
export const CreateObligationSchema = z
  .object({
    name: z.string().trim().min(1),
    period: ObligationPeriodSchema,
    dueDate: z.string().datetime(),
    expectedAmountMinor: z.number().int().positive(),
    currency: z.string().trim().regex(/^[A-Z]{3}$/),
  })
  // An obligation whose due date falls outside its own period would be
  // invisible in the month that reports it and unaccounted for in the month it
  // is actually due.
  .refine((value) => value.dueDate.slice(0, 7) === value.period, {
    message: 'dueDate must fall inside period',
    path: ['dueDate'],
  })

/** Links an existing transaction to an obligation as (part of) its payment. */
export const ReconcileObligationSchema = z.object({
  transactionId: z.string().trim().min(1),
})

/**
 * Materializes the instances of one or more periods. `horizonMonths` covers
 * the spreadsheet's forward projection: 3 means this period plus the next two.
 */
export const GenerateObligationsSchema = z.object({
  period: ObligationPeriodSchema.optional(),
  horizonMonths: z.number().int().min(1).max(12).default(1),
  jobId: z.string().min(1).optional(),
})

export const GenerateObligationsResultSchema = z.object({
  created: z.number().int(),
  skipped: z.number().int(),
  periods: z.array(ObligationPeriodSchema),
})

/**
 * One row per currency, never a single scalar: a household can hold
 * obligations in more than one currency, and summing across them would be
 * arithmetic on incomparable units. Mirrors how expense reports and account
 * balances are already grouped.
 */
export const ObligationCurrencyTotalSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  expectedMinor: z.number().int(),
  paidMinor: z.number().int(),
  outstandingMinor: z.number().int(),
})

export const ObligationPeriodSummarySchema = z.object({
  period: ObligationPeriodSchema,
  totals: z.array(ObligationCurrencyTotalSchema),
})

export type ObligationPeriodDto = z.infer<typeof ObligationPeriodSchema>
export type ObligationSourceTypeDto = z.infer<typeof ObligationSourceTypeSchema>
export type ObligationStatusDto = z.infer<typeof ObligationStatusSchema>
export type ObligationPaymentDto = z.infer<typeof ObligationPaymentSchema>
export type ObligationInstanceDto = z.infer<typeof ObligationInstanceSchema>
export type CreateObligationDto = z.infer<typeof CreateObligationSchema>
export type ReconcileObligationDto = z.infer<typeof ReconcileObligationSchema>
export type GenerateObligationsDto = z.infer<typeof GenerateObligationsSchema>
export type GenerateObligationsResultDto = z.infer<typeof GenerateObligationsResultSchema>
export type ObligationCurrencyTotalDto = z.infer<typeof ObligationCurrencyTotalSchema>
export type ObligationPeriodSummaryDto = z.infer<typeof ObligationPeriodSummarySchema>
