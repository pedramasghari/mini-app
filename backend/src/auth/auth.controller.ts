import { Body, Controller, Post, Get, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';

const COOKIE_NAME = 'miniapp_session';
const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 30 * 24 * 60 * 60 * 1000 };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('telegram')
  async telegramLogin(@Body('initData') initData: string, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.authenticate(initData);
    response.cookie(COOKIE_NAME, result.token, cookieOptions);
    const { token: _token, ...safe } = result;
    return safe;
  }

  @Get('me')
  async me(@Req() request: Request) {
    const token = request.cookies?.[COOKIE_NAME];
    if (!token) throw new UnauthorizedException('Authentication required');
    return this.authService.getSession(token);
  }

  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.authService.logout(request.cookies?.[COOKIE_NAME]);
    response.clearCookie(COOKIE_NAME, { path: '/' });
    return { success: true };
  }
}
