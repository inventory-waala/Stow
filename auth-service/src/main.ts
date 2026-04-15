import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Verify DB is reachable before accepting traffic
  const prisma = app.get(PrismaService);
  await prisma.$queryRaw`SELECT 1`;
  logger.log('Database is ready');

  app.use(helmet());
  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = new ConfigService()
        .get<string>(`CORS_ORIGINS`)
        .split(',');
      if (!origin || !allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Not allowed by CORS`), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Auth service is running on port ${port}`);
}
bootstrap();
