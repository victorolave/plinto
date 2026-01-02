import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { requestIdMiddleware } from './common/middleware/request-id.middleware'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { ConfigService } from '@nestjs/config'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  const config = app.get(ConfigService)
  app.enableCors({
    origin: config.get('webOrigin') ?? 'http://localhost:3000',
    credentials: true,
  })

  app.use(requestIdMiddleware)
  app.useGlobalFilters(new HttpExceptionFilter())
  app.setGlobalPrefix('api')

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3000)
}

bootstrap()
