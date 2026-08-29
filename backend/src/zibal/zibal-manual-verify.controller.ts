import { BadRequestException, Controller, HttpException, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { ZibalPayment } from './entities/zibal-payment.entity';
import { ZibalService } from './zibal.service';

const COOKIE = 'miniapp_session';
const VERIFY_COOLDOWN_MS = 5_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Controller('zibal')
export class ZibalManualVerifyController {
  constructor(private readonly auth: AuthService, private readonly dataSource: DataSource, private readonly zibal: ZibalService) {}

  private async userId(req: Request) {
    const token = req.cookies?.[COOKIE] as string | undefined;
    const session = await this.auth.getSession(token ?? '');
    return session.user.id;
  }

  @Post('payments/:paymentId/verify')
  async verify(@Req() req: Request, @Param('paymentId') paymentId: string) {
    const userId = await this.userId(req);
    const now = Date.now();
    const identifier = String(paymentId ?? '').trim();
    if (!identifier) throw new BadRequestException('شناسه پرداخت الزامی است.');

    const prepared = await this.dataSource.transaction(async (manager) => {
      const payment = UUID_RE.test(identifier)
        ? await manager.findOne(ZibalPayment, { where: { id: identifier, userId }, lock: { mode: 'pessimistic_write' } })
        : await manager.findOne(ZibalPayment, { where: { trackId: identifier, userId }, lock: { mode: 'pessimistic_write' } });

      if (!payment) throw new BadRequestException('تراکنش پرداخت پیدا نشد.');
      if (payment.status === 'SUCCESS' || payment.status === 'FAILED' || payment.status === 'EXPIRED') return { id: payment.id, alreadyProcessed: true };
      if (!payment.trackId) throw new BadRequestException('شناسه تراکنش زیبال ثبت نشده است.');

      if (payment.lastVerifyAt) {
        const elapsed = now - payment.lastVerifyAt.getTime();
        if (elapsed < VERIFY_COOLDOWN_MS) {
          const retryAfterSeconds = Math.max(1, Math.ceil((VERIFY_COOLDOWN_MS - elapsed) / 1000));
          throw new HttpException({ message: `برای بررسی مجدد این تراکنش ${retryAfterSeconds} ثانیه صبر کنید.`, retryAfterSeconds }, 429);
        }
      }

      payment.lastVerifyAt = new Date(now);
      await manager.save(payment);
      return { id: payment.id, alreadyProcessed: false };
    });

    const payment = await this.dataSource.getRepository(ZibalPayment).findOne({ where: { id: prepared.id, userId } });
    if (!payment) throw new BadRequestException('تراکنش پرداخت پیدا نشد.');
    if (prepared.alreadyProcessed) return this.publicPayment(payment);

    const result = await this.zibal.verifyAndSettle(prepared.id);
    return this.publicPayment(result.payment);
  }

  private publicPayment(payment: ZibalPayment | null) {
    if (!payment) throw new BadRequestException('تراکنش پرداخت پیدا نشد.');
    const snapshot = (payment.gatewaySnapshot ?? {}) as Record<string, unknown>;
    return {
      id: payment.id,
      ticketId: payment.id,
      trackId: payment.trackId,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      expiresAt: payment.expiresAt,
      gateway: {
        result: payment.gatewayResult,
        status: typeof snapshot.status === 'number' ? snapshot.status : null,
        message: payment.gatewayMessage,
        refNumber: payment.refNumber,
        cardNumber: payment.cardNumber,
        paidAt: payment.paidAt,
      },
    };
  }
}
