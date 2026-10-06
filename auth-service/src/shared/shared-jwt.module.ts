import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import * as fs from 'fs';
import * as path from 'path';

// Keys live at <service-root>/keys by default. Generate them with
// `node src/scripts/generate-keys.js`. Override the location with JWT_KEYS_DIR.
const keysDir = process.env.JWT_KEYS_DIR
  ? path.resolve(process.env.JWT_KEYS_DIR)
  : path.join(process.cwd(), 'keys');

function readKey(name: string): string {
  const file = path.join(keysDir, name);
  if (!fs.existsSync(file)) {
    throw new Error(
      `JWT key not found at ${file}. Run "node src/scripts/generate-keys.js" ` +
        `from the service root, or set JWT_KEYS_DIR to the directory holding ` +
        `private.pem and public.pem.`,
    );
  }
  return fs.readFileSync(file, 'utf8');
}

const privateKey = readKey('private.pem');
const publicKey = readKey('public.pem');

@Global()
@Module({
  imports: [
    JwtModule.register({
      privateKey,
      publicKey,
      signOptions: {
        algorithm: 'RS256',
        // ms-style duration string (e.g. '15m'); typed loosely because it
        // comes from the environment.
        expiresIn: (process.env.JWT_ACCESS_TOKEN_EXPIRY ||
          '15m') as `${number}m`,
      },
      verifyOptions: {
        algorithms: ['RS256'],
      },
    }),
  ],
  exports: [JwtModule],
})
export class SharedJwtModule {}
