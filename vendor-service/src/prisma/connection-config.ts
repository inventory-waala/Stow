import * as fs from 'fs';

export type SslConfig = false | { ca?: string; rejectUnauthorized: boolean };

export interface PgConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: SslConfig;
}

/**
 * Builds node-postgres connection options from DATABASE_URL.
 *
 * Deliberately decomposed into discrete fields rather than handed to the driver
 * as a connection string. DATABASE_URL must stay in libpq form
 * (`sslmode=require`) because the Prisma CLI's Rust engine only understands
 * libpq values -- but the Rust engine reads `require` as "encrypt, don't
 * verify" while node-postgres reads it as "encrypt and verify", and RDS
 * presents a chain Node does not trust by default. pg's parser would override
 * an explicit `ssl` option with whatever it found in the string, so the string
 * is not passed through at all.
 *
 * Set PGSSLROOTCERT to the RDS CA bundle for real certificate verification:
 *   curl -o certs/rds-ca.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
 *
 * No framework imports here on purpose: this is shared with prisma.config.ts,
 * which the Prisma CLI loads outside the Nest runtime.
 */
export function buildConnectionConfig(): PgConnectionConfig {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error('DATABASE_URL is required to connect to the database');
  }

  const url = new URL(raw);
  const sslmode = url.searchParams.get('sslmode') ?? 'prefer';
  const caPath = process.env.PGSSLROOTCERT;

  let ssl: SslConfig;
  if (sslmode === 'disable') {
    ssl = false;
  } else if (caPath) {
    ssl = { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true };
  } else {
    // Encrypted, but the server certificate is not validated.
    ssl = { rejectUnauthorized: false };
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, '') || 'postgres',
    ssl,
  };
}

/** True when TLS is on but the server certificate is not being verified. */
export function isUnverifiedTls(config: PgConnectionConfig): boolean {
  return config.ssl !== false && !config.ssl.ca;
}
