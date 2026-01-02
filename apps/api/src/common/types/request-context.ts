import { Request } from 'express'

export type AuthUser = {
  id: string
  idpSub?: string
}

export interface RequestContext extends Request {
  requestId?: string
  user?: AuthUser
  tenantId?: string | null
  sessionId?: string
}
