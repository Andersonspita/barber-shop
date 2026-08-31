import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  app.use(helmet());

  /**
   * CORS restrito. Deixar aberto significava que qualquer site conseguia fazer
   * requisições autenticadas em nome de quem estivesse logado. Em produção o
   * frontend é servido pelo mesmo nginx, então a lista costuma ficar vazia.
   */
  const allowedOrigins = (process.env.CORS_ORIGINS ?? process.env.APP_URL ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // `whitelist` descarta campo não declarado no DTO; `forbidNonWhitelisted`
      // recusa a requisição em vez de ignorar em silêncio.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const port = process.env.PORT ?? 3333;
  await app.listen(port);

  logger.log(`API ouvindo na porta ${port}`);
  if (allowedOrigins.length === 0) {
    logger.warn(
      'CORS_ORIGINS não definido: requisições de outras origens serão recusadas.',
    );
  }
}

void bootstrap();
