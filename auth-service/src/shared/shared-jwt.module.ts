import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import * as fs from 'fs';
import * as path from 'path';

const privateKey = fs.readFileSync(
  path.join(process.cwd(), 'src', 'keys', 'private.pem'),
  'utf8',
);
const publicKey = fs.readFileSync(
  path.join(process.cwd(), 'src', 'keys', 'public.pem'),
  'utf8',
);

@Global()
@Module({
  imports: [
    JwtModule.register({
      privateKey,
      publicKey,
      signOptions: {
        algorithm: 'RS256',
        expiresIn: '15m',
      },
    }),
  ],
  exports: [JwtModule],
})
export class SharedJwtModule {}
