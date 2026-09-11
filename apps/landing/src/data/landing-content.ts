// Derived content for the marketing landing page: money formatting, icon
// path data, and the example-household dataset (obligations, accounts,
// the Community/Cloud comparison table, the broken spreadsheet, household
// roles). Ported from the `Component.renderVals()` method of the approved
// Claude Design landing (landing.dc.html, ~line 947) — same values, same
// derivations, just TypeScript instead of the design canvas's JS.
import { getDictionary, type Locale } from '../i18n'
import type { LandingCopy } from '../i18n/dictionary'

/** Money renders the way the app renders it: Intl-style es-CO grouping,
 * no decimals, e.g. `COP(1910000)` -> "$ 1.910.000". */
export const COP = (n: number): string => '$ ' + n.toLocaleString('es-CO')

export interface IconPaths {
  p1: string
  p2: string
  p3: string
  p4: string
}

const ICON = {
  help: [
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20',
    'M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3',
    'M12 17h.01',
    '',
  ],
  cal: ['M4 5h16v15H4z', 'M4 10h16', 'M8 2v5', 'M16 2v5'],
  eyeoff: [
    'M9.9 4.2A10 10 0 0 1 12 4c7 0 10 8 10 8a15 15 0 0 1-1.7 2.7',
    'M6.6 6.6A15 15 0 0 0 2 12s3 8 10 8a10 10 0 0 0 5.4-1.6',
    'M2 2l20 20',
    'M14.1 14.1a3 3 0 1 1-4.2-4.2',
  ],
  wallet: [
    'M20 12V8H6a2 2 0 0 1-2-2 2 2 0 0 1 2-2h12v4',
    'M4 6v12a2 2 0 0 0 2 2h14v-4',
    'M18 12a2 2 0 0 0 0 4h4v-4z',
    '',
  ],
  listp: ['M11 12H3', 'M16 6H3', 'M16 18H3', 'M18 9v6M21 12h-6'],
  checks: ['M18 6L7 17l-5-5', 'M22 10l-7.5 7.5L13 16', '', ''],
  status: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20', 'M9 12l2 2 4-4', '', ''],
  card: ['M3 6h18v12H3z', 'M3 10h18', 'M7 15h3', ''],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    'M22 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  pin: [
    'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z',
    'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
    '',
    '',
  ],
  down: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3', ''],
  db: [
    'M12 8c5 0 9-1.3 9-3s-4-3-9-3-9 1.3-9 3 4 3 9 3z',
    'M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5',
    'M3 12c0 1.7 4 3 9 3s9-1.3 9-3',
    '',
  ],
  file: [
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    'M14 2v6h6',
    'M8 13h8',
    'M8 17h8',
  ],
  ban: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20', 'M4.9 4.9l14.2 14.2', '', ''],
  shield: [
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'M9 12l2 2 4-4',
    '',
    '',
  ],
  unlink: ['M9 17H7A5 5 0 0 1 7 7h2', 'M15 7h2a5 5 0 0 1 1.3 9.8', 'M8 12h4', 'M2 2l20 20'],
} as const satisfies Record<string, readonly [string, string, string, string]>

type IconName = keyof typeof ICON

const ico = (name: IconName): IconPaths => {
  const [p1, p2, p3, p4] = ICON[name]
  return { p1, p2, p3, p4 }
}

// The app's own account-type icons (components/ui/icons.tsx), as path data.
const ACC_ICON = {
  bank: [
    'M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2',
    'M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6',
    'M14.7 13a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0',
  ],
  cash: ['M2 7h20v10H2z', 'M9.5 12a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0', 'M5 10h.01M19 14h.01'],
} as const satisfies Record<string, readonly [string, string, string]>

type AccountType = keyof typeof ACC_ICON

// Badge tone per obligation status — the STATUS_TONE map in
// apps/web/src/features/obligations/components/obligations-panel.tsx.
type ObligationStatusKey = 'pending' | 'partial' | 'paid' | 'overdue'
export type BadgeTone = 'neutral' | 'warning' | 'success' | 'danger'
const TONE: Record<ObligationStatusKey, BadgeTone> = {
  pending: 'neutral',
  partial: 'warning',
  paid: 'success',
  overdue: 'danger',
}

export interface ObligationRow {
  name: string
  meta: string
  amount: string
  status: string
  tone: BadgeTone
  recurring: boolean
}

export interface AccountCard {
  name: string
  type: string
  amount: string
  p1: string
  p2: string
  p3: string
}

export interface CompareRow {
  f: string
  cBg: string
  cBd: string
  cText: string
  lBg: string
  lBd: string
  lText: string
}

export interface SheetRow {
  n: number
  a: string
  b: string
  c: string
  cColor: string
  d: string
}

export interface RoleRow {
  ini: string
  name: string
  role: string
  desc: string
  tone: 'info' | 'neutral'
}

export interface LabeledIcon extends IconPaths {
  n: string
  text: string
}

export interface DiffCard extends IconPaths {
  n: string
  title: string
  body: string
}

export interface LandingContent {
  t: LandingCopy
  obligations: ObligationRow[]
  obligationsShort: ObligationRow[]
  obligationsBehind: ObligationRow[]
  timeline: ObligationRow[]
  timelineShort: ObligationRow[]
  sum: { total: string; paid: string; out: string }
  accounts: AccountCard[]
  accountsShort: AccountCard[]
  accTotal: { total: string }
  compare: CompareRow[]
  sheet: SheetRow[]
  roles: RoleRow[]
  probs: LabeledIcon[]
  i1: IconPaths
  i2: IconPaths
  i3: IconPaths
  diffs: DiffCard[]
  dataFacts: LabeledIcon[]
  fAmountV: string
}

export function getLandingContent(locale: Locale): LandingContent {
  const t = getDictionary(locale).landing

  // One obligation row, exactly as obligations-panel.tsx renders it: name
  // (+ Repeat icon when it comes from a recurring rule), "Vence el
  // YYYY-MM-DD" (+ "· abonado $ x" when partially paid), amount, badge.
  const ob = (
    name: string,
    due: string,
    key: ObligationStatusKey,
    amountMinor: number,
    recurring: boolean,
    settledMinor?: number,
  ): ObligationRow => ({
    name,
    meta:
      t.due_on.replace('{date}', due) +
      (settledMinor ? ' · ' + t.settled + ' ' + COP(settledMinor) : ''),
    amount: COP(amountMinor),
    status: t[`s_${key}` as const],
    tone: TONE[key],
    recurring,
  })

  const obligations: ObligationRow[] = [
    ob(t.o1, '2026-09-03', 'paid', 850000, true),
    ob(t.o2, '2026-09-05', 'paid', 2300000, true),
    ob(t.o3, '2026-09-08', 'overdue', 410000, false),
    ob(t.o4, '2026-09-10', 'paid', 320000, true),
    ob(t.o5, '2026-09-12', 'partial', 386400, false, 200000),
    ob(t.o6, '2026-09-15', 'paid', 119900, true),
    ob(t.o7, '2026-09-20', 'pending', 65000, true),
    ob(t.o8, '2026-09-25', 'pending', 620000, false),
  ]

  // Totals as ObligationSummary computes them: total / paid / outstanding.
  const total = 850000 + 2300000 + 410000 + 320000 + 386400 + 119900 + 65000 + 620000
  const paid = 850000 + 2300000 + 320000 + 119900 + 200000
  const sum = { total: COP(total), paid: COP(paid), out: COP(total - paid) }

  const acc = (name: string, type: AccountType, amountMinor: number): AccountCard => {
    const [p1, p2, p3] = ACC_ICON[type]
    return { name, type: t[`type_${type}` as const], amount: COP(amountMinor), p1, p2, p3 }
  }
  const accounts: AccountCard[] = [
    acc(t.a1, 'bank', 4312500),
    acc(t.a2, 'bank', 186200),
    acc(t.a3, 'bank', 1480000),
    acc(t.a4, 'cash', 214500),
  ]
  const accTotal = { total: COP(4312500 + 186200 + 1480000 + 214500) }

  const yes = {
    cBg: 'var(--surface-ink)',
    cBd: 'var(--surface-ink)',
    cText: t.yes,
    lBg: 'var(--surface-ink)',
    lBd: 'var(--surface-ink)',
    lText: t.yes,
  }
  const cloudOnly = {
    cBg: 'transparent',
    cBd: 'var(--border-default)',
    cText: t.self,
    lBg: 'var(--red-500)',
    lBd: 'var(--red-500)',
    lText: t.yes,
  }
  const compare: CompareRow[] = [
    { f: t.c1, ...yes },
    { f: t.c2, ...yes },
    { f: t.c3, ...yes },
    { f: t.c4, ...yes },
    { f: t.c5, ...yes },
    { f: t.c6, ...yes },
    { f: t.c7, ...cloudOnly },
    { f: t.c8, ...cloudOnly },
    { f: t.c9, ...cloudOnly },
    { f: t.c10, ...cloudOnly },
    { f: t.c11, ...cloudOnly },
  ]

  const muted = 'var(--text-muted)'
  const accent = 'var(--text-accent)'
  const sheet: SheetRow[] = [
    { n: 1, a: t.sh1, b: '2.300.000', c: t.sh_paid, cColor: muted, d: '' },
    { n: 2, a: t.sh2, b: '386.400', c: t.sh_paid, cColor: muted, d: '' },
    { n: 3, a: t.sh3, b: '???', c: t.sh_min, cColor: accent, d: '#REF!' },
    { n: 4, a: t.sh4, b: '119.900', c: t.sh_q, cColor: accent, d: '' },
    { n: 5, a: t.sh5, b: '410.000', c: '', cColor: muted, d: '' },
    { n: 6, a: t.sh6, b: '850.000', c: t.sh_who, cColor: muted, d: '' },
  ]

  const roles: RoleRow[] = [
    { ini: 'MR', name: t.m1, role: t.r1, desc: t.r1d, tone: 'info' },
    { ini: 'AR', name: t.m2, role: t.r2, desc: t.r2d, tone: 'neutral' },
    { ini: 'ER', name: t.m3, role: t.r3, desc: t.r3d, tone: 'neutral' },
  ]

  const probs: LabeledIcon[] = [
    { n: '1', text: t.prob_1, ...ico('help') },
    { n: '2', text: t.prob_2, ...ico('cal') },
    { n: '3', text: t.prob_3, ...ico('eyeoff') },
  ]

  const diffs: DiffCard[] = [
    { n: '4.1', title: t.d1_t, body: t.d1_b, ...ico('status') },
    { n: '4.2', title: t.d2_t, body: t.d2_b, ...ico('card') },
    { n: '4.3', title: t.d3_t, body: t.d3_b, ...ico('users') },
    { n: '4.4', title: t.d4_t, body: t.d4_b, ...ico('pin') },
  ]

  const dataFactIcons: IconName[] = ['down', 'db', 'file', 'ban', 'shield', 'unlink']
  const dataFactTexts = [t.f1, t.f2, t.f3, t.f4, t.f5, t.f6]
  const dataFacts: LabeledIcon[] = dataFactTexts.map((text, i) => ({
    n: '6.' + (i + 1),
    text,
    ...ico(dataFactIcons[i]),
  }))

  return {
    t,
    obligations,
    obligationsShort: obligations.slice(1, 5),
    obligationsBehind: obligations.slice(0, 4),
    timeline: obligations.slice(2),
    timelineShort: obligations.slice(2, 5),
    sum,
    accounts,
    accountsShort: accounts.slice(0, 2),
    accTotal,
    compare,
    sheet,
    roles,
    probs,
    i1: ico('wallet'),
    i2: ico('listp'),
    i3: ico('checks'),
    diffs,
    dataFacts,
    // f_amount_v in the design: COP(620000), not a translated string.
    fAmountV: COP(620000),
  }
}
