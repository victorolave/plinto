import { randomUUID } from 'crypto'
import { Response, NextFunction } from 'express'
import { RequestContext } from '../types/request-context'

export function requestIdMiddleware(
  req: RequestContext,
  res: Response,
  next: NextFunction,
) {
  const incoming = req.headers['x-request-id']
  const requestId = Array.isArray(incoming) ? incoming[0] : incoming
  req.requestId = requestId ?? randomUUID()
  res.setHeader('x-request-id', req.requestId)
  next()
}
