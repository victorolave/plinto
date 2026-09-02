export type User = {
  id: string
  idpSub: string
  email: string
  name?: string | null
  onboardingTourSeenAt: Date | null
  createdAt: Date
  updatedAt: Date
}
