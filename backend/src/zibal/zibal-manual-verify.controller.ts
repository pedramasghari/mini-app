import {
  BadRequestException,
  Controller,
  Param,
  Post,
  Req,
  TooManyRequestsException,
} from '@nestjs/common';
import type { Request } from 'express';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { ZibalPayment } from './entities/zibal-payment.entity';
import { ZibalService } from './zibal.service';

const COOKIE = 'miniapp_session';
const VERIFY_COOLDOWN_MS = 60_000;

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
      if (payment.status === 'SUCCESS') {
        return { id: payment.id, alreadySuccessful: true };
      }
      if (payment.status === 'EXPIRED') {
        throw new BadRequestException('مهلت بررسی این تراکنش به پایان رسیده است.');
      }
      if (!payment.trackId) {
        throw new BadRequestException('شناسه تراکنش زیبال ثبت نشده است.');
      }

      if (payment.lastVerifyAt) {
        const elapsed = now - payment.lastVerifyAt.getTime();
        if (elapsed < VERIFY_COOLDOWN_MS) {
          const retryAfterSeconds = Math.max(1, Math.ceil((VERIFY_COOLDOWN_MS - elapsed) / 1000));
          throw new TooManyRequestsException({
            message: `برای بررسی مجدد این تراکنش ${retryAfterSeconds} ثانیه صبر کنید.`,
            retryAfterSeconds,
          });
        }
      }

      // A failed gateway result is allowed to be checked again. It is moved
      // back to PENDING atomically while the verification timestamp is set.
      // The actual credit operation is still protected by the transaction and
      // row lock inside ZibalService.settleSuccessfulPayment().
      payment.lastVerifyAt = new Date(now);
      if (payment.status === 'FAILED') payment.status = 'PENDING';
      await manager.save(payment);
      return { id: payment.id, alreadySuccessful: false };
    });

    if (prepared.alreadySuccessful) {
      return { success: true, alreadyProcessed: true };
    }

    const result = await this.zibal.verifyAndSettle(prepared.id);
    return {
      success: result.success,
      alreadyProcessed: result.alreadyProcessed,
      payment: result.payment,
    };
  }
}
