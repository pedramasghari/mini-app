import { BadRequestException, Body, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { ZibalService } from './zibal.service';

const COOKIE = 'miniapp_session';

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

  /** Zibal redirects the browser here after payment. Verification is always performed server-side. */
  @Get('callback') async callback(
    @Query('trackId') trackId: string,
    @Query('orderId') orderId: string | undefined,
    @Req() req: Request,
    @Res() response: Response,
    @Query('success') success?: string,
  ) {
    const result = await this.zibal.callback(trackId, orderId);
    const frontend = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    const url = new URL('/panel/wallet/deposit', frontend);
    url.searchParams.set('payment', result.success ? 'success' : 'failed');
    if (result.payment?.id) url.searchParams.set('paymentId', result.payment.id);
    if (success !== undefined) url.searchParams.set('gatewaySuccess', success);
    return response.redirect(303, url.toString());
  }
}
