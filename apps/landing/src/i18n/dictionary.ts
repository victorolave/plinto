// Landing-only i18n dictionary. This is intentionally small: it covers the
// layout chrome (page metadata, nav) that this skeleton ships with. Section
// content (hero, features, pricing, etc.) is added by whoever builds the
// actual sections, following the same shape.

export const locales = ['es', 'en'] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'es'

/**
 * Copy for the marketing landing page (hero through footer), ported from
 * the approved Claude Design landing (landing.dc.html — the design canvas's
 * `COPY` object, ~line 769). Keys keep the design's own flat names
 * (`hero_title`, `prob_1`, `d1_t`, `c7`, `o5`…) on purpose, so each string
 * can be traced back to the source design instead of drifting under a
 * differently-shaped dictionary.
 *
 * Deviations from the design (Cloud does not exist as a product yet,
 * decided by the project owner — see apps/landing commit history):
 *   - `cta_cloud`, `per_month`, `per_year` and `price_note` are dropped.
 *     No prices, no "try Cloud" call to action, anywhere on the page.
 *   - `cloud_soon` is new: the "Coming soon" badge on the Cloud column of
 *     the comparison table.
 *   - `free_note` (already in the design, only used there in an artboard
 *     this port does not use) is repurposed as the Community pricing
 *     column's note, so the Community column still reads "Gratis ·
 *     AGPL-3.0 · docker compose up".
 * `f_amount_v` is intentionally absent: the design computes it as
 * `COP(620000)`, not a translated string, so it is built in
 * src/data/landing-content.ts instead.
 */
export interface LandingCopy {
  // Nav
  nav_how: string
  nav_plans: string
  nav_data: string
  cta_install: string
  // Hero
  hero_eyebrow: string
  hero_title: string
  hero_sub: string
  hero_note: string
  // App-shell chrome, as the design's own COPY duplicates it (literal
  // strings, not a reference to the `mockups` dictionary below)
  nav_overview: string
  nav_accounts: string
  nav_tx: string
  nav_obligations: string
  nav_debts: string
  nav_credit: string
  nav_categories: string
  nav_settings: string
  nav_help: string
  bn_home: string
  bn_more: string
  hh_initial: string
  hh_name: string
  hh_label: string
  user_initials: string
  user_name: string
  user_email: string
  ob_title: string
  ob_sub: string
  ob_oneoff: string
  period: string
  sum_total: string
  sum_paid: string
  sum_out: string
  due_on: string
  settled: string
  s_pending: string
  s_partial: string
  s_paid: string
  s_overdue: string
  acc_sub: string
  acc_count: string
  acc_avail: string
  acc_balance: string
  type_bank: string
  type_cash: string
  dr_desc: string
  f_name: string
  f_name_v: string
  f_amount: string
  f_currency: string
  f_due: string
  f_due_v: string
  f_due_hint: string
  f_cancel: string
  f_submit: string
  members_title: string
  members_sub: string
  members_invite: string
  // 01 · La idea
  band_eyebrow: string
  band_title: string
  band_body: string
  // 02 · El problema
  prob_eyebrow: string
  prob_title: string
  prob_1: string
  prob_2: string
  prob_3: string
  photo_1: string
  photo_2: string
  sheet_file: string
  sheet_edited: string
  // 03 · Cómo funciona
  how_eyebrow: string
  how_title: string
  step1_title: string
  step1_body: string
  step2_title: string
  step2_body: string
  step3_title: string
  step3_body: string
  // 04 · Lo distinto
  diff_eyebrow: string
  diff_title: string
  d1_t: string
  d1_b: string
  d2_t: string
  d2_b: string
  d3_t: string
  d3_b: string
  d4_t: string
  d4_b: string
  roles_eyebrow: string
  roles_title: string
  r1: string
  r1d: string
  r2: string
  r2d: string
  r3: string
  r3d: string
  // 05 · Community y Cloud
  plans_eyebrow: string
  plans_title: string
  plans_phrase: string
  free: string
  free_note: string
  cloud_soon: string
  yes: string
  no: string
  self: string
  c1: string
  c2: string
  c3: string
  c4: string
  c5: string
  c6: string
  c7: string
  c8: string
  c9: string
  c10: string
  c11: string
  // 06 · Tus datos
  data_eyebrow: string
  data_title: string
  f1: string
  f2: string
  f3: string
  f4: string
  f5: string
  f6: string
  // 07 · Código abierto
  oss_eyebrow: string
  oss_title: string
  oss_body: string
  oss_link1: string
  oss_link2: string
  oss_link3: string
  // Footer
  foot_docs: string
  foot_lang: string
  foot_license: string
  foot_tm: string
  // Example household dataset (names, not translated content)
  o1: string
  o2: string
  o3: string
  o4: string
  o5: string
  o6: string
  o7: string
  o8: string
  a1: string
  a2: string
  a3: string
  a4: string
  m1: string
  m2: string
  m3: string
  sh1: string
  sh2: string
  sh3: string
  sh4: string
  sh5: string
  sh6: string
  sh_paid: string
  sh_q: string
  sh_min: string
  sh_who: string
}

export interface Dictionary {
  meta: {
    title: string
    description: string
  }
  nav: {
    home: string
  }
  hero: {
    tagline: string
  }
  landing: LandingCopy
  /**
   * UI chrome strings for the app mockups (AppShell, MockTransactions,
   * MockObligations, MockPhone). Ported verbatim from apps/web/messages/{es,en}.json
   * — the real product catalogue — so the mockups never say something the
   * real app doesn't. Transaction descriptions, account names and obligation
   * names are NOT here: those are household data, not UI copy, and stay
   * identical across locales exactly as apps/web leaves free-text user data
   * untranslated.
   */
  mockups: {
    nav: {
      overview: string
      accounts: string
      transactions: string
      obligations: string
      debts: string
      credit: string
      categories: string
      settings: string
      help: string
      home: string
      more: string
    }
    shell: {
      addTransaction: string
      householdName: string
      exampleEmail: string
      logOut: string
      title: Record<string, string>
      subtitle: Record<string, string>
    }
    common: {
      edit: string
    }
    transactions: {
      accountBalances: string
      allAccounts: string
      searchPlaceholder: string
      income: string
      expense: string
      automatic: string
      filterAll: string
      filterIncome: string
      filterExpense: string
    }
    pagination: {
      range: string
    }
    obligations: {
      previousMonth: string
      nextMonth: string
      total: string
      paid: string
      outstanding: string
      dueOn: string
      settled: string
      oneOff: string
      statusPending: string
      statusPartial: string
      statusPaid: string
      statusOverdue: string
    }
    dashboard: {
      monthBalances: string
      available: string
      recentActivity: string
      accounts: string
      manage: string
      seeAll: string
      allMembers: string
    }
    accountType: {
      bank: string
      cash: string
      debt: string
    }
  }
}

// Real strings, ported verbatim from apps/web/messages/{es,en}.json
// (key: app.description) so the landing's headline promise never drifts
// from the product's own.
export const dictionaries: Record<Locale, Dictionary> = {
  es: {
    meta: {
      title: 'Plinto',
      description: 'Todo lo que gasta tu familia, en un solo lugar tranquilo.',
    },
    nav: {
      home: 'Inicio',
    },
    hero: {
      tagline: 'Todo lo que gasta tu familia, en un solo lugar tranquilo.',
    },
    landing: {
      nav_how: 'Cómo funciona',
      nav_plans: 'Community y Cloud',
      nav_data: 'Tus datos',
      cta_install: 'Instalarlo gratis',
      hero_eyebrow: 'Gestor de finanzas del hogar · código abierto',
      hero_title: 'Plinto te dice qué debes, qué tienes y qué viene.',
      hero_sub:
        'Reemplaza la planilla con la que tu casa controla lo que hay que pagar cada mes.',
      hero_note: 'Hecho para Colombia',
      nav_overview: 'Panel',
      nav_accounts: 'Cuentas',
      nav_tx: 'Movimientos',
      nav_obligations: 'Obligaciones',
      nav_debts: 'Deudas',
      nav_credit: 'Crédito',
      nav_categories: 'Categorías',
      nav_settings: 'Ajustes',
      nav_help: 'Ayuda',
      bn_home: 'Inicio',
      bn_more: 'Más',
      hh_initial: 'F',
      hh_name: 'Familia Ruiz',
      hh_label: 'Hogar',
      user_initials: 'MR',
      user_name: 'Marta Ruiz',
      user_email: 'marta@ejemplo.co',
      ob_title: 'Obligaciones',
      ob_sub: 'Lo que debe el hogar este mes',
      ob_oneoff: 'Obligación puntual',
      period: 'septiembre 2026',
      sum_total: 'Total',
      sum_paid: 'Pagado',
      sum_out: 'Pendiente',
      due_on: 'Vence el {date}',
      settled: 'abonado',
      s_pending: 'Pendiente',
      s_partial: 'Parcial',
      s_paid: 'Pagada',
      s_overdue: 'Vencida',
      acc_sub: 'Saldos por moneda',
      acc_count: '4 cuentas',
      acc_avail: 'Disponible en COP',
      acc_balance: 'Saldo',
      type_bank: 'Banco',
      type_cash: 'Efectivo',
      dr_desc: 'Se registra en septiembre 2026',
      f_name: 'Nombre',
      f_name_v: 'Seguro vehículo SOAT',
      f_amount: 'Monto',
      f_currency: 'Moneda',
      f_due: 'Fecha de vencimiento',
      f_due_v: '2026-09-25',
      f_due_hint: 'Debe caer dentro de septiembre 2026',
      f_cancel: 'Cancelar',
      f_submit: 'Registrar obligación',
      members_title: 'Miembros',
      members_sub: 'Familia Ruiz · 3 personas',
      members_invite: 'Invitar',
      band_eyebrow: 'La idea',
      band_title: 'Plinto no es otro anotador de gastos.',
      band_body:
        'Es la forma de gestionar las finanzas de tu casa: qué debes, qué tienes y qué viene. Cada obligación del mes sabe si está pendiente, pagada o vencida porque lo calcula a partir de tus pagos reales. Nunca a mano.',
      prob_eyebrow: 'El problema',
      prob_title: 'La planilla familiar se rompe el 15.',
      prob_1: 'No sabes qué ya pagaste y qué no.',
      prob_2: 'La tarjeta te sorprende con el corte.',
      prob_3: 'Nadie más en la casa puede verla.',
      photo_1: 'Foto: la mesa de la cocina, recibos y la planilla impresa',
      photo_2: 'Foto: una casa real, luz de día, sin poses',
      sheet_file: 'gastos_casa_2026_v3_FINAL.xlsx',
      sheet_edited: 'Última edición: hace 3 meses',
      how_eyebrow: 'Cómo funciona',
      how_title: 'Tres pasos. Sin fórmulas.',
      step1_title: 'Dile a Plinto dónde está tu dinero.',
      step1_body:
        'Cuentas, billeteras y efectivo, cada una con su saldo. Los préstamos con cuotas también son cuentas, de tipo deuda.',
      step2_title: 'Anota lo que debes este mes.',
      step2_body:
        'Arriendo, servicios, cuotas y tarjetas. Cada obligación con su monto y su fecha. Las que se repiten, una sola vez como regla recurrente.',
      step3_title: 'Plinto te dice qué está pendiente, qué pagaste y qué viene.',
      step3_body:
        'El estado sale de los pagos reales. Vinculas el pago del arriendo y la obligación queda pagada sola.',
      diff_eyebrow: 'Lo distinto',
      diff_title: 'Lo que hace distinto a Plinto',
      d1_t: 'Obligaciones con estado derivado',
      d1_b:
        'Pendiente, parcial, pagada o vencida se calcula a partir de los pagos reales. No marcas casillas.',
      d2_t: 'Tarjetas y créditos rotativos',
      d2_b:
        'Cupo, corte y fecha de pago. El pago mínimo aparece como obligación del mes sin que lo copies.',
      d3_t: 'Hogar compartido con roles',
      d3_b: 'Propietario, miembro y observador. Todos ven la misma casa; cada uno hace lo que le corresponde.',
      d4_t: 'En español neutro, pensado para Colombia',
      d4_b:
        'Pesos, cuotas fijas, tarjetas con corte, varias cuentas y billeteras. Sin traducciones raras.',
      roles_eyebrow: 'Hogar compartido',
      roles_title: 'Una casa, tres roles',
      r1: 'Propietario',
      r1d: 'Administra cuentas, miembros y la suscripción.',
      r2: 'Miembro',
      r2d: 'Registra pagos y obligaciones.',
      r3: 'Observador',
      r3d: 'Ve todo, no cambia nada.',
      plans_eyebrow: 'Community y Cloud',
      plans_title: 'El mismo Plinto, de dos maneras.',
      plans_phrase:
        'Puedes instalarlo tú mismo para siempre. Si no quieres administrar servidores, usa Plinto Cloud.',
      free: 'Gratis',
      free_note: 'AGPL-3.0 · docker compose up',
      cloud_soon: 'Próximamente',
      yes: 'Incluido',
      no: '—',
      self: 'Lo administras tú',
      c1: 'Código abierto (AGPL-3.0)',
      c2: 'Cuentas y billeteras',
      c3: 'Obligaciones del mes con estado',
      c4: 'Tarjetas y créditos rotativos',
      c5: 'Hogar compartido con roles',
      c6: 'Exportación completa en JSON y CSV',
      c7: 'Hosting',
      c8: 'Actualizaciones',
      c9: 'Copias de seguridad automáticas',
      c10: 'Automatizaciones',
      c11: 'Soporte',
      data_eyebrow: 'Tus datos',
      data_title: 'Aunque Plinto desaparezca mañana, tus datos son tuyos.',
      f1: 'Exportación completa en JSON y CSV desde la app',
      f2: 'Copias de seguridad documentadas',
      f3: 'Licencia AGPL-3.0',
      f4: 'Sin publicidad',
      f5: 'Sin venta de datos',
      f6: 'Sin afiliados financieros',
      oss_eyebrow: 'Código abierto',
      oss_title: 'Código abierto, en desarrollo activo.',
      oss_body:
        'Plinto lo usa a diario su autor para llevar las cuentas de su casa. Está en desarrollo activo: hay cosas por pulir y otras por construir. Si quieres contribuir, el repositorio está abierto.',
      oss_link1: 'Ver el código en GitHub',
      oss_link2: 'Leer la licencia',
      oss_link3: 'Cómo contribuir',
      foot_docs: 'Documentación',
      // The other language, named in itself: a reader who needs English
      // recognises 'English' even when the page around it is Spanish.
      foot_lang: 'English',
      foot_license: 'Licencia',
      foot_tm: 'Plinto es marca registrada de su autor. El código es libre bajo AGPL-3.0.',
      o1: 'Colegio',
      o2: 'Arriendo',
      o3: 'Cuota moto Auteco',
      o4: 'Administración conjunto',
      o5: 'EPM servicios (agua, luz, gas)',
      o6: 'Internet Claro',
      o7: 'Plan celular Tigo',
      o8: 'Seguro vehículo SOAT',
      a1: 'Bancolombia Ahorros',
      a2: 'Nequi',
      a3: 'Davivienda Ahorros',
      a4: 'Efectivo',
      m1: 'Marta Ruiz',
      m2: 'Andrés Ruiz',
      m3: 'Elena Ruiz',
      sh1: 'Arriendo',
      sh2: 'EPM',
      sh3: 'Tarjeta',
      sh4: 'Claro',
      sh5: 'Moto',
      sh6: 'Colegio',
      sh_paid: 'pagado',
      sh_q: '¿pagado?',
      sh_min: 'mínimo??',
      sh_who: 'preguntar',
    },
    mockups: {
      nav: {
        overview: 'Panel',
        accounts: 'Cuentas',
        transactions: 'Movimientos',
        obligations: 'Obligaciones',
        debts: 'Deudas',
        credit: 'Crédito',
        categories: 'Categorías',
        settings: 'Ajustes',
        help: 'Ayuda',
        home: 'Inicio',
        more: 'Más',
      },
      shell: {
        addTransaction: 'Agregar movimiento',
        householdName: 'Hogar de ejemplo',
        exampleEmail: 'hogar@example.com',
        logOut: 'Cerrar sesión',
        title: {
          overview: 'Panel',
          transactions: 'Movimientos',
          obligations: 'Obligaciones',
        },
        subtitle: {
          overview: 'Tu hogar de un vistazo',
          transactions: 'Ingresos, gastos y transferencias',
          obligations: 'Lo que debe el hogar este mes',
        },
      },
      common: {
        edit: 'Editar',
      },
      transactions: {
        accountBalances: 'Saldos de las cuentas',
        allAccounts: 'Todas las cuentas',
        searchPlaceholder: 'Busca por descripción o cuenta',
        income: 'Ingreso',
        expense: 'Gasto',
        automatic: 'Automático',
        filterAll: 'Todos',
        filterIncome: 'Ingresos',
        filterExpense: 'Gastos',
      },
      pagination: {
        range: '{start}-{end} de {total}',
      },
      obligations: {
        previousMonth: 'Mes anterior',
        nextMonth: 'Mes siguiente',
        total: 'Total',
        paid: 'Pagado',
        outstanding: 'Pendiente',
        dueOn: 'Vence el {date}',
        settled: 'abonado',
        oneOff: 'Obligación puntual',
        statusPending: 'Pendiente',
        statusPartial: 'Parcial',
        statusPaid: 'Pagada',
        statusOverdue: 'Vencida',
      },
      dashboard: {
        monthBalances: '{month} · saldos',
        available: 'Disponible ({currency})',
        recentActivity: 'Actividad reciente',
        accounts: 'Cuentas',
        manage: 'Gestionar',
        seeAll: 'Ver todo',
        allMembers: 'Todos los miembros',
      },
      accountType: {
        bank: 'Banco',
        cash: 'Efectivo',
        debt: 'Deuda',
      },
    },
  },
  en: {
    meta: {
      title: 'Plinto',
      description: 'Everything your family spends, in one calm place.',
    },
    nav: {
      home: 'Home',
    },
    hero: {
      tagline: 'Everything your family spends, in one calm place.',
    },
    landing: {
      nav_how: 'How it works',
      nav_plans: 'Community & Cloud',
      nav_data: 'Your data',
      cta_install: 'Install it for free',
      hero_eyebrow: 'Household finance manager · open source',
      hero_title: 'Plinto tells you what you owe, what you have and what is coming.',
      hero_sub:
        'Replace the spreadsheet your household uses to track what has to be paid each month.',
      hero_note: 'Built for Colombia',
      nav_overview: 'Overview',
      nav_accounts: 'Accounts',
      nav_tx: 'Transactions',
      nav_obligations: 'Obligations',
      nav_debts: 'Debts',
      nav_credit: 'Credit',
      nav_categories: 'Categories',
      nav_settings: 'Settings',
      nav_help: 'Help',
      bn_home: 'Home',
      bn_more: 'More',
      hh_initial: 'R',
      hh_name: 'Ruiz family',
      hh_label: 'Household',
      user_initials: 'MR',
      user_name: 'Marta Ruiz',
      user_email: 'marta@example.co',
      ob_title: 'Obligations',
      ob_sub: 'What the household owes this month',
      ob_oneoff: 'One-off obligation',
      period: 'September 2026',
      sum_total: 'Total',
      sum_paid: 'Paid',
      sum_out: 'Outstanding',
      due_on: 'Due on {date}',
      settled: 'settled',
      s_pending: 'Pending',
      s_partial: 'Partial',
      s_paid: 'Paid',
      s_overdue: 'Overdue',
      acc_sub: 'Balances by currency',
      acc_count: '4 accounts',
      acc_avail: 'Available in COP',
      acc_balance: 'Balance',
      type_bank: 'Bank',
      type_cash: 'Cash',
      dr_desc: 'Recorded in September 2026',
      f_name: 'Name',
      f_name_v: 'SOAT vehicle insurance',
      f_amount: 'Amount',
      f_currency: 'Currency',
      f_due: 'Due date',
      f_due_v: '2026-09-25',
      f_due_hint: 'Must fall within September 2026',
      f_cancel: 'Cancel',
      f_submit: 'Record obligation',
      members_title: 'Members',
      members_sub: 'Ruiz family · 3 people',
      members_invite: 'Invite',
      band_eyebrow: 'The idea',
      band_title: 'Plinto is not another expense tracker.',
      band_body:
        'It is how you run your household finances: what you owe, what you have and what is coming. Every obligation of the month knows whether it is pending, paid or overdue because it is derived from your real payments. Never by hand.',
      prob_eyebrow: 'The problem',
      prob_title: 'The family spreadsheet breaks on the 15th.',
      prob_1: 'You do not know what you already paid.',
      prob_2: 'The card surprises you with its cut-off.',
      prob_3: 'Nobody else at home can see it.',
      photo_1: 'Photo: the kitchen table, bills and the printed spreadsheet',
      photo_2: 'Photo: a real home, daylight, no posing',
      sheet_file: 'home_expenses_2026_v3_FINAL.xlsx',
      sheet_edited: 'Last edited: 3 months ago',
      how_eyebrow: 'How it works',
      how_title: 'Three steps. No formulas.',
      step1_title: 'Tell Plinto where your money is.',
      step1_body:
        'Accounts, wallets and cash, each with its balance. Loans with installments are accounts too, of the debt type.',
      step2_title: 'Write down what you owe this month.',
      step2_body:
        'Rent, utilities, installments and cards. Each obligation with its amount and its date. Recurring ones, only once as a recurring rule.',
      step3_title: 'Plinto tells you what is pending, what you paid and what is coming.',
      step3_body:
        'Status comes from real payments. Link the rent payment and the obligation is marked paid on its own.',
      diff_eyebrow: 'What is different',
      diff_title: 'What makes Plinto different',
      d1_t: 'Obligations with derived status',
      d1_b:
        'Pending, partial, paid or overdue is computed from real payments. No checkboxes.',
      d2_t: 'Cards and revolving credit',
      d2_b:
        'Limit, cut-off and due date. The minimum payment shows up as an obligation of the month without copying it.',
      d3_t: 'Shared household with roles',
      d3_b: 'Owner, member and observer. Everyone sees the same home; each does their part.',
      d4_t: 'In neutral Spanish, built for Colombia',
      d4_b:
        'Pesos, fixed installments, cards with cut-off, several accounts and wallets. No odd translations.',
      roles_eyebrow: 'Shared household',
      roles_title: 'One home, three roles',
      r1: 'Owner',
      r1d: 'Manages accounts, members and the subscription.',
      r2: 'Member',
      r2d: 'Records payments and obligations.',
      r3: 'Observer',
      r3d: 'Sees everything, changes nothing.',
      plans_eyebrow: 'Community & Cloud',
      plans_title: 'The same Plinto, two ways.',
      plans_phrase:
        'You can install it yourself, forever. If you do not want to run servers, use Plinto Cloud.',
      free: 'Free',
      free_note: 'AGPL-3.0 · docker compose up',
      cloud_soon: 'Coming soon',
      yes: 'Included',
      no: '—',
      self: 'You run it',
      c1: 'Open source (AGPL-3.0)',
      c2: 'Accounts and wallets',
      c3: 'Monthly obligations with status',
      c4: 'Cards and revolving credit',
      c5: 'Shared household with roles',
      c6: 'Full export to JSON and CSV',
      c7: 'Hosting',
      c8: 'Updates',
      c9: 'Automatic backups',
      c10: 'Automations',
      c11: 'Support',
      data_eyebrow: 'Your data',
      data_title: 'Even if Plinto disappears tomorrow, your data is yours.',
      f1: 'Full export to JSON and CSV from the app',
      f2: 'Documented backups',
      f3: 'AGPL-3.0 license',
      f4: 'No ads',
      f5: 'No data selling',
      f6: 'No financial affiliates',
      oss_eyebrow: 'Open source',
      oss_title: 'Open source, in active development.',
      oss_body:
        'Its author uses Plinto every day to run the household accounts. It is in active development: some things need polish and others are yet to be built. If you want to contribute, the repository is open.',
      oss_link1: 'See the code on GitHub',
      oss_link2: 'Read the license',
      oss_link3: 'How to contribute',
      foot_docs: 'Documentation',
      foot_lang: 'Español',
      foot_license: 'License',
      foot_tm: 'Plinto is a registered trademark of its author. The code is free under AGPL-3.0.',
      o1: 'School',
      o2: 'Rent',
      o3: 'Auteco motorcycle installment',
      o4: 'Building fees',
      o5: 'EPM utilities (water, power, gas)',
      o6: 'Claro internet',
      o7: 'Tigo mobile plan',
      o8: 'SOAT vehicle insurance',
      a1: 'Bancolombia Savings',
      a2: 'Nequi',
      a3: 'Davivienda Savings',
      a4: 'Cash',
      m1: 'Marta Ruiz',
      m2: 'Andrés Ruiz',
      m3: 'Elena Ruiz',
      sh1: 'Rent',
      sh2: 'EPM',
      sh3: 'Card',
      sh4: 'Claro',
      sh5: 'Bike',
      sh6: 'School',
      sh_paid: 'paid',
      sh_q: 'paid?',
      sh_min: 'minimum??',
      sh_who: 'ask',
    },
    mockups: {
      nav: {
        overview: 'Dashboard',
        accounts: 'Accounts',
        transactions: 'Transactions',
        obligations: 'Obligations',
        debts: 'Debts',
        credit: 'Credit',
        categories: 'Categories',
        settings: 'Settings',
        help: 'Help',
        home: 'Home',
        more: 'More',
      },
      shell: {
        addTransaction: 'Add transaction',
        householdName: 'Example household',
        exampleEmail: 'household@example.com',
        logOut: 'Log out',
        title: {
          overview: 'Dashboard',
          transactions: 'Transactions',
          obligations: 'Obligations',
        },
        subtitle: {
          overview: 'Your household at a glance',
          transactions: 'Income, expenses and transfers',
          obligations: 'What the household owes this month',
        },
      },
      common: {
        edit: 'Edit',
      },
      transactions: {
        accountBalances: 'Account balances',
        allAccounts: 'All accounts',
        searchPlaceholder: 'Search by description or account',
        income: 'Income',
        expense: 'Expense',
        automatic: 'Automatic',
        filterAll: 'All',
        filterIncome: 'Income',
        filterExpense: 'Expenses',
      },
      pagination: {
        range: '{start}-{end} of {total}',
      },
      obligations: {
        previousMonth: 'Previous month',
        nextMonth: 'Next month',
        total: 'Total',
        paid: 'Paid',
        outstanding: 'Outstanding',
        dueOn: 'Due {date}',
        settled: 'settled',
        oneOff: 'One-off obligation',
        statusPending: 'Pending',
        statusPartial: 'Partial',
        statusPaid: 'Paid',
        statusOverdue: 'Overdue',
      },
      dashboard: {
        monthBalances: '{month} · balances',
        available: 'Available ({currency})',
        recentActivity: 'Recent activity',
        accounts: 'Accounts',
        manage: 'Manage',
        seeAll: 'See all',
        allMembers: 'All members',
      },
      accountType: {
        bank: 'Bank',
        cash: 'Cash',
        debt: 'Debt',
      },
    },
  },
}
