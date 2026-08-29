import {
  BadRequestException,
  Controller,
  HttpException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { ZibalPayment } from './entities/zibal-payment.entity';
import { ZibalService } from './zibal.service';

const COOKIE = 'miniapp_session';
const VERIFY_COOLDOWN_MS = 5_000;

@Controller('zibal')
export class ZibalManualVerifyController {
  constructor(
    private readonly auth: AuthService,
    private readonly dataSource: DataSource,
    private readonly zibal: ZibalService,
  ) {}

  private async userId(req: Request) {
    const token = req.cookies?.[COOKIE] as string | undefined;
    const session = await this.auth.getSession(token ?? '');
    return session.user.id;
  }

  @Post('payments/:paymentId/verify')
  async verify(@Req() req: Request, @Param('paymentId') paymentId: string) {
    const userId = await this.userId(req);
    const now = Date.now();

    const prepared = await this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(ZibalPayment, {
        where: { id: paymentId, userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!payment) throw new BadRequestException('تراکنش پرداخت پیدا نشد.');
      if (payment.status === 'SUCCESS') return { id: payment.id, alreadySuccessful: true };
      if (payment.status === 'EXPIRED') throw new BadRequestException('مهلت بررسی این تراکنش به پایان رسیده است.');
      if (!payment.trackId) throw new BadRequestException('شناسه تراکنش زیبال ثبت نشده است.');

      if (payment.lastVerifyAt) {
        const elapsed = now - payment.lastVerifyAt.getTime();
        if (elapsed < VERIFY_COOLDOWN_MS) {
          const retryAfterSeconds = Math.max(1, Math.ceil((VERIFY_COOLDOWN_MS - elapsed) / 1000));
          throw new HttpException(
            { message: `برای بررسی مجدد این تراکنش ${retryAfterSeconds} ثانیه صبر کنید.`, retryAfterSeconds },
            429,
          );
        }
      }

      payment.lastVerifyAt = new Date(now);
      if (payment.status === 'FAILED') payment.status = 'PENDING';
      await manager.save(payment);
      return { id: payment.id, alreadySuccessful: false };
    });

    if (prepared.alreadySuccessful) {
      const payment = await this.dataSource.getRepository(ZibalPayment).findOne({ where: { id: prepared.id, userId } });
      return this.publicPayment(payment);
    }

    const result = await this.zibal.verifyAndSettle(prepared.id);
    let payment = result.payment;
    const gatewayResult = (result as { gateway?: { result?: number } }).gateway?.result;

    // Zibal may return 202 immediately after the callback while its transaction
    // state is still settling. Do not expose that transient response as a final
    // FAILED state; keep the local payment PENDING and verify again on the next
    // status-page poll. A genuinely failed payment will remain pending until
    // the payment TTL expires or a later verification returns a terminal state.
    if (gatewayResult === 202 && payment?.status === 'FAILED') {
      await this.dataSource.getRepository(ZibalPayment).update(prepared.id, {
        status: 'PENDING',
        failureReason: null,
      });
      payment = await this.dataSource.getRepository(ZibalPayment).findOne({ where: { id: prepared.id, userId } });
    }

    return this.publicPayment(payment);
  }

  private publicPayment(payment: ZibalPayment | null) {
    if (!payment) throw new BadRequestException('تراکنش پرداخت پیدا نشد.');
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
        message: payment.gatewayMessage,
        refNumber: payment.refNumber,
        cardNumber: payment.cardNumber,
        paidAt: payment.paidAt,
      },
    };
  }
}
