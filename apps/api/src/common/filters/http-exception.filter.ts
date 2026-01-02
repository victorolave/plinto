import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { Request, Response } from 'express'

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR

    const fallbackMessage =
      exception instanceof HttpException ? exception.message : 'Unexpected error'

    const responseBody =
      exception instanceof HttpException ? exception.getResponse() : null

    const normalized =
      typeof responseBody === 'object' && responseBody !== null
        ? (responseBody as { code?: string; message?: string; details?: unknown })
        : null

    response.status(status).json({
      error: {
        code: normalized?.code ?? HttpStatus[status] ?? 'ERROR',
        message: normalized?.message ?? fallbackMessage,
        details: normalized?.details ?? undefined,
        traceId: request.headers['x-request-id'] ?? undefined,
      },
    })
  }
}
