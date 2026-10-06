import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthUser } from '../auth-user';

/**
 * Verifies the Bearer token against auth-service's public key and requires a
 * tenant context: every inventory row is tenant-scoped, so a token without
 * tenant_id (user has no workspace yet) cannot do anything here.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);
    if (!token) throw new UnauthorizedException();

    let payload: AuthUser;
    try {
      payload = await this.jwtService.verifyAsync<AuthUser>(token);
    } catch {
      throw new UnauthorizedException();
    }
    if (!payload.tenant_id) {
      throw new ForbiddenException('No active workspace on this token');
    }
    request['user'] = payload;
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
