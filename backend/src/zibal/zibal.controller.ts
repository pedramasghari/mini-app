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
   * Zibal sends the browser back here after the gateway flow.
   * The browser is always moved to the frontend status page using the
   * internal payment UUID. The status page then calls the authenticated
   * backend status endpoint, which performs Verify against Zibal while the
   * payment is still PENDING.
   *
   * Zibal callback fields (success/status) are intentionally not trusted as
   * final payment confirmation; the backend Verify response is authoritative.
   */
  @Get('callback')
  async callback(@Query('trackId') trackId: string | undefined, @Res() res: Response) {
    if (!trackId?.trim()) {
      throw new BadRequestException('شناسه تراکنش زیبال دریافت نشد.');
    }

    const result = await this.zibal.callback(trackId.trim()) as CallbackResult;
    const paymentId = result.payment?.id?.trim();

    if (!paymentId) {
      throw new BadRequestException('شناسه تراکنش پس از callback زیبال پیدا نشد.');
    }

    const frontendUrl = (process.env.FRONTEND_URL?.trim() || 'http://localhost:3000').replace(/\/+$/, '');
    const statusUrl = `${frontendUrl}/zibal/status?ticketId=${encodeURIComponent(paymentId)}`;

    return res.redirect(303, statusUrl);
  }

  @Get('payments/:paymentId/status')
  async paymentStatus(@Req() req: Request, @Param('paymentId') paymentId: string) {
    return this.zibal.getPaymentStatus(await this.userId(req), paymentId);
  }
}
