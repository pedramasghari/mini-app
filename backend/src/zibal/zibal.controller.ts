import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { ZibalService } from './zibal.service';

const COOKIE = 'miniapp_session';
type RedirectStatus = 'success' | 'failed' | 'pending';

@Controller('zibal')
export class ZibalController {
  constructor(private readonly auth: AuthService, private readonly zibal: ZibalService) {}

  private async userId(req: Request) {
    const token = req.cookies?.[COOKIE] as string | undefined;
    const session = await this.auth.getSession(token ?? '');
    return session.user.id;
  }

  @Get('config') config() {
    return this.zibal.configForClient();
  }

  @Post('payments') async create(@Req() req: Request, @Body('amount') amount?: string) {
    if (!amount) throw new BadRequestException('مبلغ شارژ الزامی است.');
    return this.zibal.createPayment(await this.userId(req), amount);
  }

  /** Authenticated status endpoint used by the Mini App while the user is on Zibal. */
  @Get('payments/:paymentId/status')
  async paymentStatus(@Req() req: Request, @Param('paymentId') paymentId: string) {
    return this.zibal.getPaymentStatus(await this.userId(req), paymentId);
  }
}
