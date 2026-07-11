import { NestFactory } from '@nestjs/core'
import { SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { requestIdMiddleware } from './common/middleware/request-id.middleware'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { ConfigService } from '@nestjs/config'
import { buildOpenApiDocument } from './openapi/openapi'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  const config = app.get(ConfigService)
  app.enableCors({
    origin: config.get('webOrigin') ?? 'http://localhost:3000',
    credentials: true,
  })

  app.use(requestIdMiddleware)
  app.useGlobalFilters(new HttpExceptionFilter())

  // Deliberately unversioned at /api for the MVP (see ADR 0002). To switch on
  // NestJS URI versioning later, when external clients are onboarded, call
  // `app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`
  // before controllers are versioned — this would move routes to /api/v1/...
  // without breaking the unversioned contract in the meantime.
  app.setGlobalPrefix('api')

  // Swagger UI at /api/docs, raw OpenAPI JSON at /api/docs-json. The document
  // is generated from the shared Zod contracts (packages/shared), not from
  // @nestjs/swagger decorators, since this codebase validates with Zod.
  SwaggerModule.setup('api/docs', app, buildOpenApiDocument())

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000)
}

bootstrap()
