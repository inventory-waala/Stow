import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.set('query parser', 'extended');

  // Verify DB is reachable before accepting traffic (bounded, see auth-service).
  const prisma = app.get(PrismaService);
  const dbTimeoutMs = Number(process.env.DB_READY_TIMEOUT_MS) || 10000;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`no response after ${dbTimeoutMs}ms`)),
          dbTimeoutMs,
        ).unref(),
      ),
    ]);
  } catch (err: any) {
    const host = (process.env.DATABASE_URL || '').replace(/\/\/[^@]*@/, '//***@');
    logger.error(`Database is not reachable (${host}): ${err?.message ?? err}`);
    await app.close();
    process.exit(1);
  }

  app.use(helmet());
  app.enableCors({
    origin: (config.get<string>('CORS_ORIGINS') ?? 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = config.get<number>('PORT') ?? 3003;
  await app.listen(port);
  logger.log(`Vendor service HTTP is running on port ${port}`);
}
bootstrap();
