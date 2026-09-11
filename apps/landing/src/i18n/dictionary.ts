// Landing-only i18n dictionary. This is intentionally small: it covers the
// layout chrome (page metadata, nav) that this skeleton ships with. Section
// content (hero, features, pricing, etc.) is added by whoever builds the
// actual sections, following the same shape.

export const locales = ['es', 'en'] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'es'

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
