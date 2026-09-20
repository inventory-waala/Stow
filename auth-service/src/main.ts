import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Verify DB is reachable before accepting traffic
  const prisma = app.get(PrismaService);
  await prisma.$queryRaw`SELECT 1`;
  logger.log('Database is ready');

  // ── gRPC microservice (port 50051) ──────────────────────────────────────────
  // Proto is a shared library at <monorepo-root>/libs/proto/auth.proto.
  // At runtime the compiled output sits at dist/main.js, so __dirname is
  // <service-root>/dist — we climb four levels to reach the monorepo root.
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      url: '0.0.0.0:50051',
      package: 'auth',
      protoPath: join(__dirname, '../../../../libs/proto/auth.proto'),
    },
  });

  await app.startAllMicroservices();
  logger.log('gRPC server is running on port 50051');

  // ── HTTP server (port 3001) — starts AFTER gRPC is ready ───────────────────
  app.use(helmet());
  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = new ConfigService()
        .get<string>(`CORS_ORIGINS`)
        .split(',');
      if (!origin || allowedOrigins.includes(origin)) {
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
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  logger.log(`Auth service HTTP is running on port ${port}`);
}
bootstrap();
