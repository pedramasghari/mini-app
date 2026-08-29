import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { ZibalService } from './zibal.service';

const COOKIE = 'miniapp_session';

type CallbackResult = {
  success: boolean;
  payment?: { id?: string; trackId?: string | null; status?: string } | null;
};

@Controller('zibal')
export class ZibalController {
  constructor(
    private readonly auth: AuthService,
    private readonly zibal: ZibalService,
    private readonly config: ConfigService,
  ) {}

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

  /**
   * Zibal callback. This endpoint is public because Zibal calls it directly.
   * The payment is verified on the server before the browser is sent back to
   * the Mini App status page. No Telegram URL is opened here.
   */
  @Get('callback')
  async callback(@Query('trackId') trackId: string | undefined, @Res() res: Response) {
    const result = await this.zibal.callback(trackId) as CallbackResult;
    const frontendUrl = this.config.get<string>('FRONTEND_URL', '').replace(/\/$/, '');
    if (!frontendUrl) throw new BadRequestException('FRONTEND_URL تنظیم نشده است.');

    const paymentId = result.payment?.id;
    const statusUrl = paymentId
      ? `${frontendUrl}/zibal/callback?paymentId=${encodeURIComponent(paymentId)}&trackId=${encodeURIComponent(String(trackId ?? ''))}`
      : `${frontendUrl}/zibal/callback?trackId=${encodeURIComponent(String(trackId ?? ''))}`;
    return res.redirect(303, statusUrl);
  }

  /** Authenticated status endpoint used by the Mini App while the user is on Zibal. */
  @Get('payments/:paymentId/status')
  async paymentStatus(@Req() req: Request, @Param('paymentId') paymentId: string) {
    return this.zibal.getPaymentStatus(await this.userId(req), paymentId);
  }
}
