export type Tenant = {
  id: string
  name: string
  baseCurrency: string
  /** True for the example household: invented Colombian sample data, never real data. */
  isDemo: boolean
  createdAt: Date
  updatedAt: Date
}
