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

  /**
   * Zibal callback is only a notification containing trackId.
   * Never trust success/status/orderId/amount values supplied by the browser.
   * The backend verifies the payment directly against Zibal before settling it.
   *
   * The redirect here is only a compatibility/fallback path. The Mini App does
   * not depend on this redirect to learn the payment result.
   */
  @Get('callback')
  async callback(@Query('trackId') trackId: string, @Res() response: Response) {
    let status: RedirectStatus = 'pending';
    let paymentId: string | undefined;

    try {
      if (!trackId) throw new BadRequestException('trackId الزامی است.');
      const result = await this.zibal.callback(trackId);
      paymentId = result.payment?.id;
      status = result.success ? 'success' : (result.payment?.status === 'PENDING' ? 'pending' : 'failed');
    } catch {
      status = 'pending';
    }

    const frontend = process.env.MINI_APP_URL || process.env.FRONTEND_URL;
    if (!frontend) return response.status(500).send('Mini App URL is not configured.');

    const url = new URL('/panel/wallet/deposit', frontend);
    url.searchParams.set('payment', status);
    if (paymentId) url.searchParams.set('paymentId', paymentId);
    return response.redirect(303, url.toString());
  }
}
