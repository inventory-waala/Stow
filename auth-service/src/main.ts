import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Locates the shared proto file at <monorepo-root>/libs/proto/auth.proto.
 * The compiled entrypoint lives at <service-root>/dist/src/main.js, but under
 * ts-node/jest __dirname is <service-root>/src — so probe rather than assume a
 * fixed number of levels.
 */
function resolveProtoPath(): string {
  const candidates = [
    join(__dirname, '../../../libs/proto/auth.proto'), // dist/src -> monorepo root
    join(__dirname, '../../libs/proto/auth.proto'), // src -> monorepo root
    join(process.cwd(), '../libs/proto/auth.proto'), // cwd = service root
  ];

  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(
      `Could not locate libs/proto/auth.proto. Looked in:\n  ${candidates.join('\n  ')}`,
    );
  }
  return found;
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Verify DB is reachable before accepting traffic.
  // Bounded: an unreachable host (wrong VPC, closed security group, VPN down)
  // makes the driver hang on TCP connect, which would otherwise look like a
  // silent startup with no error and no listening port.
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
    // Driver-adapter errors often carry the useful detail on `cause`/`code`
    // rather than `message`, which can be empty.
    const detail =
      [err?.message, err?.code, err?.cause?.message, err?.cause?.code]
        .filter(Boolean)
        .join(' | ') || String(err) || 'no detail from driver';
    logger.error(
      `Cannot reach the database: ${detail}
` +
        `  DATABASE_URL -> ${host}
` +
        `  The service will not start until this resolves.`,
    );
    process.exit(1);
  }
  logger.log('Database is ready');

  // ── HTTP middleware — must be registered before the app starts listening ────
  app.use(helmet());

  const allowedOrigins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // No Origin header: same-origin, curl, or server-to-server. Allow.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
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

  // ── gRPC microservice ──────────────────────────────────────────────────────
  const grpcUrl = config.get<string>('GRPC_URL') ?? '0.0.0.0:50051';
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      url: grpcUrl,
      package: 'auth',
      protoPath: resolveProtoPath(),
    },
  });

  await app.startAllMicroservices();
  logger.log(`gRPC server is running on ${grpcUrl}`);

  const port = config.get<number>('PORT') ?? 3001;
  await app.listen(port);
  logger.log(`Auth service HTTP is running on port ${port}`);
}
bootstrap();
