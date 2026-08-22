import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { SessionAuthGuard } from './guards/session-auth.guard';

const SESSION_COOKIE = 'miniapp_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('telegram')
  async telegramLogin(
    @Body('initData') initData: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.authenticate(initData);
    const isProduction = this.configService.get('NODE_ENV') === 'production';

    response.cookie(SESSION_COOKIE, result.sessionToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: SESSION_TTL_SECONDS * 1000,
      path: '/',
    });

    return {
      user: result.user,
      wallet: result.wallet,
      expiresAt: result.expiresAt,
    };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  async me(@Req() request: Request) {
    const user = request.user!;
    const wallet = await this.authService.getWalletForUser(user.id);

    return { user, wallet };
  }

  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = request.cookies?.[SESSION_COOKIE];
    await this.authService.logout(token);

    const isProduction = this.configService.get('NODE_ENV') === 'production';
    response.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
    });

    return { success: true };
  }
}
