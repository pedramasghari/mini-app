import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
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
   * Zibal calls this URL from the user's external browser after payment.
   * The server verifies/settles the payment first, then sends the browser
   * back to Telegram using the Mini App direct-link startapp parameter.
   *
   * The Mini App reads start_param and opens /zibal/status in its own origin.
   * This makes the flow independent of whether Telegram reuses the previous
   * WebView tab or creates a new one.
   */
  @Get('callback')
  async callback(@Query('trackId') trackId: string | undefined, @Res() res: Response) {
    const result = await this.zibal.callback(trackId) as CallbackResult;
    const paymentId = result.payment?.id;

    if (!paymentId) {
      throw new BadRequestException('شناسه تراکنش پس از callback زیبال پیدا نشد.');
    }

    const miniAppUrl = this.zibal.miniAppPaymentUrl(paymentId);
    return res.redirect(303, miniAppUrl);
  }

  /** Authenticated status endpoint used by the Mini App after returning from Zibal. */
  @Get('payments/:paymentId/status')
  async paymentStatus(@Req() req: Request, @Param('paymentId') paymentId: string) {
    return this.zibal.getPaymentStatus(await this.userId(req), paymentId);
  }
}
