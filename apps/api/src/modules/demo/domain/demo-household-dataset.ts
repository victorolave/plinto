import { periodOfCutoff, statementObligationName } from '../../credit/domain/credit-line-statement.entity'

/**
 * A deterministic, self-contained "example household" for a Colombian
 * family: realistic public-brand transactions, credit lines, obligations and
 * a debt schedule, built purely in memory from a `now` reference point.
 *
 * Ported from a one-off manual seed script (see the PR description) that
 * produced this exact shape against a real tenant. This module keeps the
 * DATA and the INVARIANT LOGIC that script hand-verified, but:
 *  - every date is relative to `now` (three months back to `now`, same
 *    day-of-month structure the original script used), so the demo always
 *    looks "current";
 *  - credit line limits are round, generic numbers instead of the specific
 *    values a real household happened to have;
 *  - the two income labels are pinned to "Nómina mensual" / "Honorarios
 *    consultoría" regardless of locale — the maintainer's literal wording;
 *  - "titular 1" / "titular 2" (card holders) are likewise pinned, never
 *    translated;
 *  - nothing here is random: the same `now` always produces the same
 *    dataset, byte for byte.
 *
 * Entities reference each other by stable string `key`s, not database ids —
 * id generation is the repository's job (work unit 2), not this pure
 * builder's.
 */

export type DemoLocale = 'es' | 'en'
export type DemoAccountType = 'cash' | 'bank' | 'credit' | 'savings' | 'debt'
export type DemoTxType = 'income' | 'expense'

export interface DemoAccount {
  key: string
  name: string
  type: DemoAccountType
}

export interface DemoCategory {
  key: string
  name: string
  type: DemoTxType
  color: string
}

export interface DemoCreditLine {
  key: string
  name: string
  limitMinor: number
}

export interface DemoCreditLineStatement {
  key: string
  creditLineKey: string
  lineName: string
  period: string
  cutoffDate: Date
  dueDate: Date
  closingBalanceMinor: number
  amountDueMinor: number
  limitMinorSnapshot: number
  /** Key of the ObligationInstance this statement atomically materialises. */
  obligationKey: string
  obligationName: string
}

export interface DemoDebtSchedule {
  key: string
  accountKey: string
  name: string
  principalMinor: number
  installmentMinor: number
  installmentCount: number
  firstDueDate: Date
}

export interface DemoRecurringRule {
  key: string
  accountKey: string
  name: string
  type: DemoTxType
  amountMinor: number
  dayOfMonth: number
  startDate: Date
}

export interface DemoManualObligation {
  key: string
  name: string
  period: string
  dueDate: Date
  expectedAmountMinor: number
}

export interface DemoTransaction {
  key: string
  accountKey: string
  type: DemoTxType
  amountMinor: number
  description: string
  occurredAt: Date
  categoryKey: string | null
  transferKey: string | null
}

export interface DemoTransfer {
  key: string
  sourceAccountKey: string
  destinationAccountKey: string
  amountMinor: number
  occurredAt: Date
  description: string
  debitTxKey: string
  creditTxKey: string
}

export interface DemoObligationPayment {
  key: string
  /** Key of a ManualObligation or a CreditLineStatement's obligationKey. */
  obligationKey: string
  transactionKey: string
}

export interface DemoHouseholdDataset {
  currency: string
  accounts: DemoAccount[]
  categories: DemoCategory[]
  creditLines: DemoCreditLine[]
  creditLineStatements: DemoCreditLineStatement[]
  debtSchedule: DemoDebtSchedule
  recurringRules: DemoRecurringRule[]
  manualObligations: DemoManualObligation[]
  transactions: DemoTransaction[]
  transfers: DemoTransfer[]
  obligationPayments: DemoObligationPayment[]
}

const CURRENCY = 'COP'

/** Literal income labels the maintainer pinned regardless of locale. */
export const DEMO_INCOME_LABELS = {
  payroll: 'Nómina mensual',
  consultingFees: 'Honorarios consultoría',
} as const

/**
 * A date `monthsBack` calendar months before `now`, on UTC day `day` (noon
 * UTC, matching the original script's convention). Clamped to the last day
 * of the target month so `day: 30` never overflows into February.
 */
function monthDate(now: Date, monthsBack: number, day: number): Date {
  const year = now.getUTCFullYear()
  const monthIndex = now.getUTCMonth() - monthsBack
  const daysInTargetMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const clampedDay = Math.min(day, daysInTargetMonth)
  return new Date(Date.UTC(year, monthIndex, clampedDay, 12, 0, 0))
}

// ---------------------------------------------------------------------------
// Locale copy — brand names (Bancolombia, Nequi, D1, Rappi, ...) are never
// translated; only the generic Spanish words around them are.
// ---------------------------------------------------------------------------

interface LocaleCopy {
  accounts: Record<'bancolombia' | 'nequi' | 'davivienda' | 'efectivo' | 'creditoLibreInversion', string>
  expenseCategories: Record<
    | 'arriendo'
    | 'servicios'
    | 'mercado'
    | 'transporte'
    | 'restaurantes'
    | 'salud'
    | 'educacion'
    | 'entretenimiento'
    | 'suscripciones'
    | 'hogar'
    | 'deudas',
    string
  >
  incomeCategories: Record<'salario' | 'honorarios' | 'otrosIngresos', string>
  tx: Record<string, string>
}

const COPY: Record<DemoLocale, LocaleCopy> = {
  es: {
    accounts: {
      bancolombia: 'Bancolombia Ahorros',
      nequi: 'Nequi',
      davivienda: 'Davivienda Ahorros',
      efectivo: 'Efectivo',
      creditoLibreInversion: 'Crédito libre inversión Bancolombia',
    },
    expenseCategories: {
      arriendo: 'Arriendo',
      servicios: 'Servicios públicos',
      mercado: 'Mercado',
      transporte: 'Transporte',
      restaurantes: 'Restaurantes',
      salud: 'Salud',
      educacion: 'Educación',
      entretenimiento: 'Entretenimiento',
      suscripciones: 'Suscripciones',
      hogar: 'Hogar',
      deudas: 'Deudas y tarjetas',
    },
    incomeCategories: {
      salario: 'Salario',
      honorarios: 'Honorarios',
      otrosIngresos: 'Otros ingresos',
    },
    tx: {
      arriendo: 'Arriendo',
      administracion: 'Administración conjunto',
      epmServicios: 'EPM servicios',
      internetClaro: 'Internet Claro',
      planCelularTigo: 'Plan celular Tigo',
      netflix: 'Netflix',
      spotify: 'Spotify',
      colegio: 'Colegio',
      mercadoD1: 'Mercado D1',
      mercadoExito: 'Mercado Éxito',
      mercadoAra: 'Mercado Ara',
      mercadoCarulla: 'Mercado Carulla',
      gasolinaTerpel: 'Gasolina Terpel',
      uber: 'Uber',
      metroRecarga: 'Metro de Medellín recarga',
      crepesWaffles: 'Crepes & Waffles',
      frisby: 'Frisby',
      domicilioRappi: 'Domicilio Rappi',
      farmatodo: 'Farmatodo',
      copagoSura: 'Copago EPS Sura',
      cineColombia: 'Cine Colombia',
      cuotaCreditoLibre: 'Cuota crédito libre inversión',
      cuotaMotoAuteco: 'Cuota moto Auteco',
      seguroSoat: 'Seguro vehículo SOAT',
      ventaMarketplace: 'Venta Marketplace',
      homecenter: 'Homecenter',
      pagoNu: 'Pago Nu',
      pagoAddi: 'Pago ADDI',
      transferBancolombiaNequi: 'Transferencia Bancolombia → Nequi',
      transferBancolombiaDavivienda: 'Transferencia Bancolombia → Davivienda',
      epmObligationName: 'EPM servicios (agua, luz, gas)',
      soatObligationName: 'Seguro vehículo SOAT',
      motoObligationName: 'Cuota moto Auteco',
    },
  },
  en: {
    accounts: {
      bancolombia: 'Bancolombia Savings',
      nequi: 'Nequi',
      davivienda: 'Davivienda Savings',
      efectivo: 'Cash',
      creditoLibreInversion: 'Bancolombia Personal Loan',
    },
    expenseCategories: {
      arriendo: 'Rent',
      servicios: 'Utilities',
      mercado: 'Groceries',
      transporte: 'Transport',
      restaurantes: 'Restaurants',
      salud: 'Health',
      educacion: 'Education',
      entretenimiento: 'Entertainment',
      suscripciones: 'Subscriptions',
      hogar: 'Home',
      deudas: 'Debts & cards',
    },
    incomeCategories: {
      salario: 'Salary',
      honorarios: 'Fees',
      otrosIngresos: 'Other income',
    },
    tx: {
      arriendo: 'Rent',
      administracion: 'HOA fee',
      epmServicios: 'EPM utilities',
      internetClaro: 'Claro internet',
      planCelularTigo: 'Tigo mobile plan',
      netflix: 'Netflix',
      spotify: 'Spotify',
      colegio: 'School tuition',
      mercadoD1: 'D1 groceries',
      mercadoExito: 'Éxito groceries',
      mercadoAra: 'Ara groceries',
      mercadoCarulla: 'Carulla groceries',
      gasolinaTerpel: 'Terpel gas',
      uber: 'Uber',
      metroRecarga: 'Medellín metro top-up',
      crepesWaffles: 'Crepes & Waffles',
      frisby: 'Frisby',
      domicilioRappi: 'Rappi delivery',
      farmatodo: 'Farmatodo',
      copagoSura: 'Sura EPS copay',
      cineColombia: 'Cine Colombia',
      cuotaCreditoLibre: 'Personal loan installment',
      cuotaMotoAuteco: 'Auteco motorcycle installment',
      seguroSoat: 'SOAT vehicle insurance',
      ventaMarketplace: 'Marketplace sale',
      homecenter: 'Homecenter',
      pagoNu: 'Nu payment',
      pagoAddi: 'ADDI payment',
      transferBancolombiaNequi: 'Transfer Bancolombia → Nequi',
      transferBancolombiaDavivienda: 'Transfer Bancolombia → Davivienda',
      epmObligationName: 'EPM utilities (water, power, gas)',
      soatObligationName: 'SOAT vehicle insurance',
      motoObligationName: 'Auteco motorcycle installment',
    },
  },
}

const CATEGORY_COLORS: Record<string, string> = {
  arriendo: '#EF4444',
  servicios: '#F59E0B',
  mercado: '#84CC16',
  transporte: '#3B82F6',
  restaurantes: '#EC4899',
  salud: '#14B8A6',
  educacion: '#8B5CF6',
  entretenimiento: '#F97316',
  suscripciones: '#06B6D4',
  hogar: '#A855F7',
  deudas: '#DC2626',
  salario: '#22C55E',
  honorarios: '#10B981',
  otrosIngresos: '#059669',
}

/** Round, generic credit line ceilings — never the specific figures a real household happens to have. */
const CREDIT_LINE_DEFS: Array<{ key: string; name: string; limitMinor: number }> = [
  { key: 'addi', name: 'ADDI', limitMinor: 2_000_000 },
  { key: 'flamingo', name: 'Flamingo', limitMinor: 3_000_000 },
  { key: 'sistecredito', name: 'Sistecredito (titular 1)', limitMinor: 3_000_000 },
  { key: 'nu', name: 'Nu', limitMinor: 4_000_000 },
  { key: 'rappiCredit', name: 'Rappi', limitMinor: 1_000_000 },
  { key: 'somos', name: 'Somos', limitMinor: 2_000_000 },
  { key: 'agaval', name: 'Agaval', limitMinor: 1_000_000 },
  { key: 'tuya', name: 'Tuya (titular 2)', limitMinor: 1_000_000 },
  { key: 'credimarcas', name: 'Credimarcas', limitMinor: 1_000_000 },
  { key: 'bancoBogotaT1', name: 'Banco de Bogotá (titular 1)', limitMinor: 1_000_000 },
  { key: 'daviviendaCreditT2', name: 'Davivienda (titular 2)', limitMinor: 3_000_000 },
  { key: 'bancoBogotaT2', name: 'Banco de Bogotá (titular 2)', limitMinor: 1_000_000 },
  { key: 'suPayT1', name: 'Su + Pay (titular 1)', limitMinor: 1_000_000 },
  { key: 'suPayT2', name: 'Su + Pay (titular 2)', limitMinor: 1_000_000 },
  { key: 'jamarT1', name: 'Jamar (titular 1)', limitMinor: 1_000_000 },
  { key: 'jamarT2', name: 'Jamar (titular 2)', limitMinor: 1_000_000 },
]

/** Statement cycles: `cutoffMonthsBack`/`dueMonthsBack` are relative to `now`. */
const STATEMENT_DEFS: Array<{
  key: string
  lineKey: string
  cutoffMonthsBack: number
  cutoffDay: number
  dueMonthsBack: number
  dueDay: number
  closingBalanceMinor: number
  amountDueMinor: number
}> = [
  { key: 'nuSep', lineKey: 'nu', cutoffMonthsBack: 1, cutoffDay: 28, dueMonthsBack: 0, dueDay: 15, closingBalanceMinor: 1_850_000, amountDueMinor: 320_000 },
  { key: 'addiSep', lineKey: 'addi', cutoffMonthsBack: 1, cutoffDay: 25, dueMonthsBack: 0, dueDay: 10, closingBalanceMinor: 620_000, amountDueMinor: 210_000 },
  { key: 'flamingoSep', lineKey: 'flamingo', cutoffMonthsBack: 1, cutoffDay: 30, dueMonthsBack: 0, dueDay: 20, closingBalanceMinor: 1_100_000, amountDueMinor: 275_000 },
  { key: 'rappiSep', lineKey: 'rappiCredit', cutoffMonthsBack: 1, cutoffDay: 27, dueMonthsBack: 0, dueDay: 12, closingBalanceMinor: 310_000, amountDueMinor: 95_000 },
  { key: 'sistecreditoSep', lineKey: 'sistecredito', cutoffMonthsBack: 1, cutoffDay: 26, dueMonthsBack: 0, dueDay: 18, closingBalanceMinor: 1_400_000, amountDueMinor: 350_000 },
  { key: 'nuAug', lineKey: 'nu', cutoffMonthsBack: 2, cutoffDay: 28, dueMonthsBack: 1, dueDay: 15, closingBalanceMinor: 1_650_000, amountDueMinor: 450_000 },
  { key: 'addiAug', lineKey: 'addi', cutoffMonthsBack: 2, cutoffDay: 25, dueMonthsBack: 1, dueDay: 10, closingBalanceMinor: 540_000, amountDueMinor: 180_000 },
]

const RECURRING_RULE_DEFS: Array<{
  key: string
  txKey: keyof LocaleCopy['tx'] | 'payroll'
  type: DemoTxType
  amountMinor: number
  dayOfMonth: number
  accountKey: string
}> = [
  { key: 'arriendoRule', txKey: 'arriendo', type: 'expense', amountMinor: 2_300_000, dayOfMonth: 5, accountKey: 'bancolombia' },
  { key: 'administracionRule', txKey: 'administracion', type: 'expense', amountMinor: 320_000, dayOfMonth: 10, accountKey: 'bancolombia' },
  { key: 'internetRule', txKey: 'internetClaro', type: 'expense', amountMinor: 119_900, dayOfMonth: 15, accountKey: 'bancolombia' },
  { key: 'planCelularRule', txKey: 'planCelularTigo', type: 'expense', amountMinor: 65_000, dayOfMonth: 20, accountKey: 'nequi' },
  { key: 'netflixRule', txKey: 'netflix', type: 'expense', amountMinor: 44_900, dayOfMonth: 8, accountKey: 'nequi' },
  { key: 'spotifyRule', txKey: 'spotify', type: 'expense', amountMinor: 26_900, dayOfMonth: 8, accountKey: 'nequi' },
  { key: 'payrollRule', txKey: 'payroll', type: 'income', amountMinor: 7_800_000, dayOfMonth: 30, accountKey: 'bancolombia' },
  { key: 'colegioRule', txKey: 'colegio', type: 'expense', amountMinor: 850_000, dayOfMonth: 3, accountKey: 'davivienda' },
]

const MANUAL_OBLIGATION_DEFS: Array<{
  key: string
  nameKey: 'epmObligationName' | 'soatObligationName' | 'motoObligationName'
  monthsBack: number
  day: number
  amountMinor: number
}> = [
  { key: 'epmJul', nameKey: 'epmObligationName', monthsBack: 2, day: 12, amountMinor: 362_000 },
  { key: 'epmAug', nameKey: 'epmObligationName', monthsBack: 1, day: 12, amountMinor: 401_000 },
  { key: 'epmSep', nameKey: 'epmObligationName', monthsBack: 0, day: 12, amountMinor: 385_000 },
  { key: 'soatJul', nameKey: 'soatObligationName', monthsBack: 2, day: 25, amountMinor: 620_000 },
  { key: 'soatAug', nameKey: 'soatObligationName', monthsBack: 1, day: 25, amountMinor: 620_000 },
  { key: 'soatSep', nameKey: 'soatObligationName', monthsBack: 0, day: 25, amountMinor: 620_000 },
  { key: 'motoJul', nameKey: 'motoObligationName', monthsBack: 2, day: 8, amountMinor: 410_000 },
  { key: 'motoAug', nameKey: 'motoObligationName', monthsBack: 1, day: 8, amountMinor: 410_000 },
  { key: 'motoSep', nameKey: 'motoObligationName', monthsBack: 0, day: 8, amountMinor: 410_000 },
]

interface TxDef {
  key?: string
  accountKey: string
  type: DemoTxType
  amountMinor: number
  txKey: keyof LocaleCopy['tx'] | 'payroll' | 'consultingFees'
  monthsBack: number
  day: number
  categoryKey: string | null
}

/** Non-transfer transactions, one block per calendar month (2 = oldest, 0 = current/sparse). */
const TRANSACTION_DEFS: TxDef[] = [
  // --- month -2 (oldest) ---
  { accountKey: 'bancolombia', type: 'income', amountMinor: 7_800_000, txKey: 'payroll', monthsBack: 2, day: 30, categoryKey: 'salario' },
  { accountKey: 'nequi', type: 'income', amountMinor: 1_200_000, txKey: 'consultingFees', monthsBack: 2, day: 15, categoryKey: 'honorarios' },
  { accountKey: 'bancolombia', type: 'expense', amountMinor: 2_300_000, txKey: 'arriendo', monthsBack: 2, day: 5, categoryKey: 'arriendo' },
  { accountKey: 'bancolombia', type: 'expense', amountMinor: 320_000, txKey: 'administracion', monthsBack: 2, day: 10, categoryKey: 'hogar' },
  { key: 'epmJul', accountKey: 'bancolombia', type: 'expense', amountMinor: 362_000, txKey: 'epmServicios', monthsBack: 2, day: 11, categoryKey: 'servicios' },
  { accountKey: 'bancolombia', type: 'expense', amountMinor: 119_900, txKey: 'internetClaro', monthsBack: 2, day: 15, categoryKey: 'servicios' },
  { accountKey: 'nequi', type: 'expense', amountMinor: 65_000, txKey: 'planCelularTigo', monthsBack: 2, day: 20, categoryKey: 'servicios' },
  { accountKey: 'nequi', type: 'expense', amountMinor: 44_900, txKey: 'netflix', monthsBack: 2, day: 8, categoryKey: 'suscripciones' },
  { accountKey: 'nequi', type: 'expense', amountMinor: 26_900, txKey: 'spotify', monthsBack: 2, day: 8, categoryKey: 'suscripciones' },
  { accountKey: 'davivienda', type: 'expense', amountMinor: 850_000, txKey: 'colegio', monthsBack: 2, day: 3, categoryKey: 'educacion' },
  { accountKey: 'efectivo', type: 'expense', amountMinor: 210_000, txKey: 'mercadoD1', monthsBack: 2, day: 2, categoryKey: 'mercado' },
  { accountKey: 'nequi', type: 'expense', amountMinor: 350_000, txKey: 'mercadoExito', monthsBack: 2, day: 9, categoryKey: 'mercado' },
  { accountKey: 'efectivo', type: 'expense', amountMinor: 195_000, txKey: 'mercadoAra', monthsBack: 2, day: 16, categoryKey: 'mercado' },
  { accountKey: 'nequi', type: 'expense', amountMinor: 300_000, txKey: 'mercadoCarulla', monthsBack: 2, day: 23, categoryKey: 'mercado' },
  { accountKey: 'nequi', type: 'expense', amountMinor: 180_000, txKey: 'gasolinaTerpel', monthsBack: 2, day: 7, categoryKey: 'transporte' },
  { accountKey: 'nequi', type: 'expense', amountMinor: 22_000, txKey: 'uber', monthsBack: 2, day: 3, categoryKey: 'transporte' },
  { accountKey: 'nequi', type: 'expense', amountMinor: 28_000, txKey: 'uber', monthsBack: 2, day: 12, categoryKey: 'transporte' },
  { accountKey: 'nequi', type: 'expense', amountMinor: 19_000, txKey: 'uber', monthsBack: 2, day: 25, categoryKey: 'transporte' },
  { accountKey: 'efectivo', type: 'expense', amountMinor: 40_000, txKey: 'metroRecarga', monthsBack: 2, day: 1, categoryKey: 'transporte' },
  { accountKey: 'nequi', type: 'expense', amountMinor: 96_000, txKey: 'crepesWaffles', monthsBack: 2, day: 14, categoryKey: 'restaurantes' },
  { accountKey: 'nequi', type: 'expense', amountMinor: 42_000, txKey: 'frisby', monthsBack: 2, day: 21, categoryKey: 'restaurantes' },
  { accountKey: 'nequi', type: 'expense', amountMinor: 58_000, txKey: 'domicilioRappi', monthsBack: 2, day: 28, categoryKey: 'restaurantes' },
  { accountKey: 'efectivo', type: 'expense', amountMinor: 68_000, txKey: 'farmatodo', monthsBack: 2, day: 10, categoryKey: 'salud' },
  { accountKey: 'efectivo', type: 'expense', amountMinor: 22_000, txKey: 'copagoSura', monthsBack: 2, day: 6, categoryKey: 'salud' },
  { accountKey: 'nequi', type: 'expense', amountMinor: 54_000, txKey: 'cineColombia', monthsBack: 2, day: 19, categoryKey: 'entretenimiento' },
  { accountKey: 'bancolombia', type: 'expense', amountMinor: 452_000, txKey: 'cuotaCreditoLibre', monthsBack: 2, day: 5, categoryKey: 'deudas' },
  { key: 'motoJul', accountKey: 'bancolombia', type: 'expense', amountMinor: 410_000, txKey: 'cuotaMotoAuteco', monthsBack: 2, day: 8, categoryKey: 'deudas' },
  { key: 'soatJul', accountKey: 'bancolombia', type: 'expense', amountMinor: 620_000, txKey: 'seguroSoat', monthsBack: 2, day: 25, categoryKey: 'deudas' },

  // --- month -1 ---
  { accountKey: 'bancolombia', type: 'income', amountMinor: 7_800_000, txKey: 'payroll', monthsBack: 1, day: 30, categoryKey: 'salario' },
  { accountKey: 'nequi', type: 'income', amountMinor: 1_200_000, txKey: 'consultingFees', monthsBack: 1, day: 15, categoryKey: 'honorarios' },
  { accountKey: 'nequi', type: 'income', amountMinor: 180_000, txKey: 'ventaMarketplace', monthsBack: 1, day: 20, categoryKey: 'otrosIngresos' },
  { accountKey: 'bancolombia', type: 'expense', amountMinor: 2_300_000, txKey: 'arriendo', monthsBack: 1, day: 5, categoryKey: 'arriendo' },
  { accountKey: 'bancolombia', type: 'expense', amountMinor: 335_000, txKey: 'administracion', monthsBack: 1, day: 9, categoryKey: 'hogar' },
  { key: 'epmAug', accountKey: 'bancolombia', type: 'expense', amountMinor: 401_000, txKey: 'epmServicios', monthsBack: 1, day: 13, categoryKey: 'servicios' },
  { accountKey: 'bancolombia', type: 'expense', amountMinor: 119_900, txKey: 'internetClaro', monthsBack: 1, day: 15, categoryKey: 'servicios' },
  { accountKey: 'nequi', type: 'expense', amountMinor: 65_000, txKey: 'planCelularTigo', monthsBack: 1, day: 20, categoryKey: 'servicios' },
  { accountKey: 'nequi', type: 'expense', amountMinor: 44_900, txKey: 'netflix', monthsBack: 1, day: 8, categoryKey: 'suscripciones' },
  { accountKey: 'nequi', type: 'expense', amountMinor: 26_900, txKey: 'spotify', monthsBack: 1, day: 8, categoryKey: 'suscripciones' },
  { accountKey: 'davivienda', type: 'expense', amountMinor: 850_000, txKey: 'colegio', monthsBack: 1, day: 3, categoryKey: 'educacion' },
  { accountKey: 'efectivo', type: 'expense', amountMinor: 230_000, txKey: 'mercadoD1', monthsBack: 1, day: 2, categoryKey: 'mercado' },
  { accountKey: 'nequi', type: 'expense', amountMinor: 320_000, txKey: 'mercadoExito', monthsBack: 1, day: 9, categoryKey: 'mercado' },
  { accountKey: 'efectivo', type: 'expense', amountMinor: 180_000, txKey: 'mercadoAra', monthsBack: 1, day: 16, categoryKey: 'mercado' },
  { accountKey: 'nequi', type: 'expense', amountMinor: 420_000, txKey: 'mercadoCarulla', monthsBack: 1, day: 23, categoryKey: 'mercado' },
  { accountKey: 'nequi', type: 'expense', amountMinor: 190_000, txKey: 'gasolinaTerpel', monthsBack: 1, day: 8, categoryKey: 'transporte' },
  { accountKey: 'nequi', type: 'expense', amountMinor: 25_000, txKey: 'uber', monthsBack: 1, day: 4, categoryKey: 'transporte' },
  { accountKey: 'nequi', type: 'expense', amountMinor: 31_000, txKey: 'uber', monthsBack: 1, day: 14, categoryKey: 'transporte' },
  { accountKey: 'nequi', type: 'expense', amountMinor: 20_000, txKey: 'uber', monthsBack: 1, day: 27, categoryKey: 'transporte' },
  { accountKey: 'efectivo', type: 'expense', amountMinor: 40_000, txKey: 'metroRecarga', monthsBack: 1, day: 1, categoryKey: 'transporte' },
  { accountKey: 'nequi', type: 'expense', amountMinor: 98_000, txKey: 'crepesWaffles', monthsBack: 1, day: 16, categoryKey: 'restaurantes' },
  { accountKey: 'nequi', type: 'expense', amountMinor: 40_000, txKey: 'frisby', monthsBack: 1, day: 19, categoryKey: 'restaurantes' },
  { accountKey: 'nequi', type: 'expense', amountMinor: 60_000, txKey: 'domicilioRappi', monthsBack: 1, day: 24, categoryKey: 'restaurantes' },
  { accountKey: 'efectivo', type: 'expense', amountMinor: 70_000, txKey: 'farmatodo', monthsBack: 1, day: 18, categoryKey: 'salud' },
  { accountKey: 'efectivo', type: 'expense', amountMinor: 22_000, txKey: 'copagoSura', monthsBack: 1, day: 22, categoryKey: 'salud' },
  { accountKey: 'nequi', type: 'expense', amountMinor: 54_000, txKey: 'cineColombia', monthsBack: 1, day: 23, categoryKey: 'entretenimiento' },
  { accountKey: 'bancolombia', type: 'expense', amountMinor: 210_000, txKey: 'homecenter', monthsBack: 1, day: 15, categoryKey: 'hogar' },
  { accountKey: 'bancolombia', type: 'expense', amountMinor: 452_000, txKey: 'cuotaCreditoLibre', monthsBack: 1, day: 5, categoryKey: 'deudas' },
  { key: 'pagoNu', accountKey: 'bancolombia', type: 'expense', amountMinor: 450_000, txKey: 'pagoNu', monthsBack: 1, day: 20, categoryKey: 'deudas' },
  { key: 'pagoAddi', accountKey: 'bancolombia', type: 'expense', amountMinor: 180_000, txKey: 'pagoAddi', monthsBack: 1, day: 22, categoryKey: 'deudas' },
  { key: 'motoAug', accountKey: 'bancolombia', type: 'expense', amountMinor: 410_000, txKey: 'cuotaMotoAuteco', monthsBack: 1, day: 8, categoryKey: 'deudas' },

  // --- month 0 (current, sparse — filtered to on/before `now`'s day-of-month) ---
  { accountKey: 'efectivo', type: 'expense', amountMinor: 220_000, txKey: 'mercadoD1', monthsBack: 0, day: 1, categoryKey: 'mercado' },
  { accountKey: 'nequi', type: 'expense', amountMinor: 24_000, txKey: 'uber', monthsBack: 0, day: 2, categoryKey: 'transporte' },
]

interface TransferDef {
  sourceAccountKey: string
  destinationAccountKey: string
  amountMinor: number
  monthsBack: number
  day: number
  txKey: 'transferBancolombiaNequi' | 'transferBancolombiaDavivienda'
}

const TRANSFER_DEFS: TransferDef[] = [
  { sourceAccountKey: 'bancolombia', destinationAccountKey: 'nequi', amountMinor: 600_000, monthsBack: 2, day: 2, txKey: 'transferBancolombiaNequi' },
  { sourceAccountKey: 'bancolombia', destinationAccountKey: 'davivienda', amountMinor: 900_000, monthsBack: 2, day: 4, txKey: 'transferBancolombiaDavivienda' },
  { sourceAccountKey: 'bancolombia', destinationAccountKey: 'nequi', amountMinor: 600_000, monthsBack: 1, day: 2, txKey: 'transferBancolombiaNequi' },
  { sourceAccountKey: 'bancolombia', destinationAccountKey: 'davivienda', amountMinor: 900_000, monthsBack: 1, day: 4, txKey: 'transferBancolombiaDavivienda' },
  { sourceAccountKey: 'bancolombia', destinationAccountKey: 'nequi', amountMinor: 600_000, monthsBack: 0, day: 2, txKey: 'transferBancolombiaNequi' },
]

function txLabel(copy: LocaleCopy, txKey: TxDef['txKey']): string {
  if (txKey === 'payroll') return DEMO_INCOME_LABELS.payroll
  if (txKey === 'consultingFees') return DEMO_INCOME_LABELS.consultingFees
  return copy.tx[txKey]
}

/**
 * Builds the full example household dataset for `now`, deterministically.
 *
 * `now` is the only source of "current time" — no `Date.now()`, no
 * `Math.random()` anywhere in this module, so calling this twice with an
 * identical `now` always produces a deep-equal result.
 */
export function buildDemoHouseholdDataset(now: Date, locale: DemoLocale = 'es'): DemoHouseholdDataset {
  const copy = COPY[locale]
  const nowDay = now.getUTCDate()

  const accounts: DemoAccount[] = [
    { key: 'bancolombia', name: copy.accounts.bancolombia, type: 'bank' },
    { key: 'nequi', name: copy.accounts.nequi, type: 'bank' },
    { key: 'davivienda', name: copy.accounts.davivienda, type: 'bank' },
    { key: 'efectivo', name: copy.accounts.efectivo, type: 'cash' },
    { key: 'creditoLibreInversion', name: copy.accounts.creditoLibreInversion, type: 'debt' },
  ]

  const categories: DemoCategory[] = [
    ...(Object.keys(copy.expenseCategories) as Array<keyof LocaleCopy['expenseCategories']>).map((key) => ({
      key,
      name: copy.expenseCategories[key],
      type: 'expense' as const,
      color: CATEGORY_COLORS[key],
    })),
    ...(Object.keys(copy.incomeCategories) as Array<keyof LocaleCopy['incomeCategories']>).map((key) => ({
      key,
      name: copy.incomeCategories[key],
      type: 'income' as const,
      color: CATEGORY_COLORS[key],
    })),
  ]

  const creditLines: DemoCreditLine[] = CREDIT_LINE_DEFS.map((def) => ({
    key: def.key,
    name: def.name,
    limitMinor: def.limitMinor,
  }))
  const creditLineByKey = new Map(creditLines.map((line) => [line.key, line]))

  const creditLineStatements: DemoCreditLineStatement[] = STATEMENT_DEFS.map((def) => {
    const line = creditLineByKey.get(def.lineKey)
    if (!line) throw new Error(`Unknown credit line key "${def.lineKey}" in statement "${def.key}"`)

    const cutoffDate = monthDate(now, def.cutoffMonthsBack, def.cutoffDay)
    const dueDate = monthDate(now, def.dueMonthsBack, def.dueDay)

    return {
      key: def.key,
      creditLineKey: def.lineKey,
      lineName: line.name,
      period: periodOfCutoff(cutoffDate),
      cutoffDate,
      dueDate,
      closingBalanceMinor: def.closingBalanceMinor,
      amountDueMinor: def.amountDueMinor,
      limitMinorSnapshot: line.limitMinor,
      obligationKey: `${def.key}Obligation`,
      obligationName: statementObligationName(line.name, cutoffDate),
    }
  })

  const debtSchedule: DemoDebtSchedule = {
    key: 'creditoLibreInversionSchedule',
    accountKey: 'creditoLibreInversion',
    name: copy.accounts.creditoLibreInversion,
    principalMinor: 12_000_000,
    installmentMinor: 452_000,
    installmentCount: 36,
    firstDueDate: monthDate(now, 6, 5),
  }

  const recurringRules: DemoRecurringRule[] = RECURRING_RULE_DEFS.map((def) => ({
    key: def.key,
    accountKey: def.accountKey,
    name: txLabel(copy, def.txKey),
    type: def.type,
    amountMinor: def.amountMinor,
    dayOfMonth: def.dayOfMonth,
    startDate: monthDate(now, 2, 1),
  }))

  const manualObligations: DemoManualObligation[] = MANUAL_OBLIGATION_DEFS.map((def) => {
    const dueDate = monthDate(now, def.monthsBack, def.day)
    return {
      key: def.key,
      name: copy.tx[def.nameKey],
      period: periodOfCutoff(dueDate),
      dueDate,
      expectedAmountMinor: def.amountMinor,
    }
  })
  const manualObligationByKey = new Map(manualObligations.map((m) => [m.key, m]))

  const transactions: DemoTransaction[] = []
  const transactionByKey = new Map<string, DemoTransaction>()

  for (const def of TRANSACTION_DEFS) {
    if (def.monthsBack === 0 && def.day > nowDay) continue // "sparse": nothing dated after today

    const tx: DemoTransaction = {
      key: def.key ?? `tx-${transactions.length}`,
      accountKey: def.accountKey,
      type: def.type,
      amountMinor: def.amountMinor,
      description: txLabel(copy, def.txKey),
      occurredAt: monthDate(now, def.monthsBack, def.day),
      categoryKey: def.categoryKey,
      transferKey: null,
    }
    transactions.push(tx)
    if (def.key) transactionByKey.set(def.key, tx)
  }

  const transfers: DemoTransfer[] = []
  for (const def of TRANSFER_DEFS) {
    if (def.monthsBack === 0 && def.day > nowDay) continue

    const occurredAt = monthDate(now, def.monthsBack, def.day)
    const description = copy.tx[def.txKey]
    const transferKey = `transfer-${transfers.length}`

    const debitTx: DemoTransaction = {
      key: `${transferKey}-debit`,
      accountKey: def.sourceAccountKey,
      type: 'expense',
      amountMinor: def.amountMinor,
      description,
      occurredAt,
      categoryKey: null,
      transferKey,
    }
    const creditTx: DemoTransaction = {
      key: `${transferKey}-credit`,
      accountKey: def.destinationAccountKey,
      type: 'income',
      amountMinor: def.amountMinor,
      description,
      occurredAt,
      categoryKey: null,
      transferKey,
    }
    transactions.push(debitTx, creditTx)

    transfers.push({
      key: transferKey,
      sourceAccountKey: def.sourceAccountKey,
      destinationAccountKey: def.destinationAccountKey,
      amountMinor: def.amountMinor,
      occurredAt,
      description,
      debitTxKey: debitTx.key,
      creditTxKey: creditTx.key,
    })
  }

  // SOAT-August is intentionally left unpaid, same deliberate deviation the
  // original seed script documented: there is no transaction to reconcile it
  // against inside the sampled window.
  const nuAugStatement = creditLineStatements.find((s) => s.key === 'nuAug')
  const addiAugStatement = creditLineStatements.find((s) => s.key === 'addiAug')

  const obligationPaymentDefs: Array<{ obligationKey?: string; transactionKey?: string }> = [
    { obligationKey: manualObligationByKey.get('epmJul')?.key, transactionKey: transactionByKey.get('epmJul')?.key },
    { obligationKey: manualObligationByKey.get('epmAug')?.key, transactionKey: transactionByKey.get('epmAug')?.key },
    { obligationKey: manualObligationByKey.get('motoJul')?.key, transactionKey: transactionByKey.get('motoJul')?.key },
    { obligationKey: manualObligationByKey.get('motoAug')?.key, transactionKey: transactionByKey.get('motoAug')?.key },
    { obligationKey: manualObligationByKey.get('soatJul')?.key, transactionKey: transactionByKey.get('soatJul')?.key },
    { obligationKey: nuAugStatement?.obligationKey, transactionKey: transactionByKey.get('pagoNu')?.key },
    { obligationKey: addiAugStatement?.obligationKey, transactionKey: transactionByKey.get('pagoAddi')?.key },
  ]

  const obligationPayments: DemoObligationPayment[] = obligationPaymentDefs
    .filter((def): def is { obligationKey: string; transactionKey: string } =>
      Boolean(def.obligationKey && def.transactionKey),
    )
    .map((def, index) => ({
      key: `payment-${index}`,
      obligationKey: def.obligationKey,
      transactionKey: def.transactionKey,
    }))

  return {
    currency: CURRENCY,
    accounts,
    categories,
    creditLines,
    creditLineStatements,
    debtSchedule,
    recurringRules,
    manualObligations,
    transactions,
    transfers,
    obligationPayments,
  }
}

// ---------------------------------------------------------------------------
// Invariant validation — mirrors the CHECK constraints and service-level
// invariants read from the schema/services, replicated here so a violation
// is caught before anything is ever written.
// ---------------------------------------------------------------------------

/** Thrown by {@link validateDemoHouseholdDataset} when the dataset violates an invariant. */
export class DemoHouseholdDatasetError extends Error {}

export function validateDemoHouseholdDataset(dataset: DemoHouseholdDataset): void {
  const errors: string[] = []
  const accountByKey = new Map(dataset.accounts.map((a) => [a.key, a]))
  const categoryByKey = new Map(dataset.categories.map((c) => [c.key, c]))

  // credit_lines_limit_not_negative
  for (const line of dataset.creditLines) {
    if (line.limitMinor < 0) errors.push(`Credit line "${line.name}": limitMinor must be >= 0`)
  }

  // Credit line statement CHECKs
  for (const s of dataset.creditLineStatements) {
    if (s.closingBalanceMinor < 0 || s.amountDueMinor < 0) {
      errors.push(`Statement "${s.lineName}" (${s.key}): amounts must be >= 0`)
    }
    if (s.amountDueMinor > s.closingBalanceMinor) {
      errors.push(`Statement "${s.lineName}" (${s.key}): amountDue must not exceed closingBalance`)
    }
    if (s.dueDate.getTime() < s.cutoffDate.getTime()) {
      errors.push(`Statement "${s.lineName}" (${s.key}): dueDate must not be before cutoffDate`)
    }
  }

  // Debt schedule account must be a liability account type (debt/credit)
  const debtAccount = accountByKey.get(dataset.debtSchedule.accountKey)
  if (!debtAccount || !['debt', 'credit'].includes(debtAccount.type)) {
    errors.push('Debt schedule: account is not a liability account type (debt/credit)')
  }

  // Transaction category type must match transaction type; account must exist
  for (const tx of dataset.transactions) {
    if (!accountByKey.get(tx.accountKey)) {
      errors.push(`Transaction "${tx.description}" (${tx.key}): unknown account "${tx.accountKey}"`)
    }
    if (tx.categoryKey) {
      const category = categoryByKey.get(tx.categoryKey)
      if (!category) {
        errors.push(`Transaction "${tx.description}" (${tx.key}): unknown category "${tx.categoryKey}"`)
      } else if (category.type !== tx.type) {
        errors.push(
          `Transaction "${tx.description}" (${tx.key}): category "${category.name}" type (${category.type}) does not match transaction type (${tx.type})`,
        )
      }
    }
  }

  // Transfers: source and destination must differ
  for (const t of dataset.transfers) {
    if (t.sourceAccountKey === t.destinationAccountKey) {
      errors.push(`Transfer "${t.description}" (${t.key}): source and destination accounts must differ`)
    }
  }

  // Obligation payments: transaction must be an expense, and one transaction
  // may settle at most one obligation
  const txByKey = new Map(dataset.transactions.map((t) => [t.key, t]))
  const seenTxForPayment = new Set<string>()
  for (const p of dataset.obligationPayments) {
    const tx = txByKey.get(p.transactionKey)
    if (!tx) {
      errors.push(`Obligation payment "${p.key}": unknown transaction "${p.transactionKey}"`)
      continue
    }
    if (tx.type !== 'expense') {
      errors.push(`Obligation payment "${p.key}": transaction "${tx.description}" is not an expense`)
    }
    if (seenTxForPayment.has(p.transactionKey)) {
      errors.push(`Obligation payment "${p.key}": transaction "${tx.description}" settles more than one obligation`)
    }
    seenTxForPayment.add(p.transactionKey)
  }

  // The current period must have at least one pending (unpaid) obligation,
  // so a freshly created demo household is never an empty dashboard.
  const paidObligationKeys = new Set(dataset.obligationPayments.map((p) => p.obligationKey))

  const allObligationKeys: string[] = [
    ...dataset.manualObligations.map((m) => m.key),
    ...dataset.creditLineStatements.map((s) => s.obligationKey),
  ]
  const hasPendingObligation = allObligationKeys.some((key) => !paidObligationKeys.has(key))
  if (!hasPendingObligation) {
    errors.push('Dataset has no pending obligation at all — every obligation instance is paid')
  }

  // The two literal income labels the maintainer pinned, regardless of locale.
  const incomeDescriptions = new Set(
    dataset.transactions.filter((t) => t.type === 'income' && !t.transferKey).map((t) => t.description),
  )
  if (!incomeDescriptions.has(DEMO_INCOME_LABELS.payroll)) {
    errors.push(`Missing income label "${DEMO_INCOME_LABELS.payroll}"`)
  }
  if (!incomeDescriptions.has(DEMO_INCOME_LABELS.consultingFees)) {
    errors.push(`Missing income label "${DEMO_INCOME_LABELS.consultingFees}"`)
  }

  if (errors.length > 0) {
    throw new DemoHouseholdDatasetError(
      `Demo household dataset failed validation:\n${errors.map((e) => `  - ${e}`).join('\n')}`,
    )
  }
}
