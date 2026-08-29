import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { ZibalPayment } from './entities/zibal-payment.entity';
import { ZibalService } from './zibal.service';

const COOKIE = 'miniapp_session';

@Controller('zibal')
export class ZibalController {
  constructor(
    private readonly auth: AuthService,
    private readonly zibal: ZibalService,
    @InjectRepository(ZibalPayment) private readonly payments: Repository<ZibalPayment>,
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
   * Do NOT verify here: the user must land on /zibal/status first and that
   * authenticated status request performs Verify against Zibal. This avoids
   * a race where an immediate callback Verify can receive result=202 while
   * Zibal is still finalizing the transaction, causing a false FAILED state.
   *
   * Zibal callback fields are not treated as final payment confirmation.
   * The Verify response from Zibal is authoritative.
   */
  @Get('callback')
  async callback(@Query('trackId') trackId: string | undefined, @Res() res: Response) {
    const normalizedTrackId = String(trackId ?? '').trim();
    if (!normalizedTrackId) {
      throw new BadRequestException('شناسه تراکنش زیبال دریافت نشد.');
    }

    const payment = await this.payments.findOne({ where: { trackId: normalizedTrackId } });
    if (!payment) throw new NotFoundException('تراکنش زیبال پیدا نشد.');

    const frontendUrl = (process.env.FRONTEND_URL?.trim() || 'http://localhost:3000').replace(/\/+$/, '');
    const statusUrl = `${frontendUrl}/zibal/status?ticketId=${encodeURIComponent(payment.id)}`;

    return res.redirect(303, statusUrl);
  }

  @Get('payments/:paymentId/status')
  async paymentStatus(@Req() req: Request, @Param('paymentId') paymentId: string) {
    return this.zibal.getPaymentStatus(await this.userId(req), paymentId);
  }
}
