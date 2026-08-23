import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';

const COOKIE_NAME = 'miniapp_session';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.cookies?.[COOKIE_NAME];
    if (!token) throw new UnauthorizedException('Authentication required');

    const session = await this.auth.getSession(token);
    if (!session.isAdmin) {
      throw new UnauthorizedException('Admin access required');
    }

    (request as Request & { adminSession?: typeof session }).adminSession = session;
    return true;
  }
}
