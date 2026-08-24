import { Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { WalletTransaction } from './entities/commerce.entity';
import { NumberOrder } from './entities/number-order.entity';
import { NumberOrdersService } from './number-orders.service';
import { SmsCodeService } from './smscode.service';

const COOKIE = 'miniapp_session';

@Controller('number-orders')
export class NumberOrdersController {
  constructor(
    private readonly auth: AuthService,
    private readonly orders: NumberOrdersService,
    private readonly smsCode: SmsCodeService,
    @InjectRepository(NumberOrder)
    private readonly numberOrders: Repository<NumberOrder>,
    @InjectRepository(WalletTransaction)
    private readonly transactions: Repository<WalletTransaction>,
  ) {}

  private async userId(req: Request) {
    const token = req.cookies?.[COOKIE] as string | undefined;
    const session = await this.auth.getSession(token ?? '');
    return session.user.id;
  }

  @Get('me')
  async mine(@Req() req: Request) {
    return this.orders.listMyOrders(await this.userId(req));
  }

  @Get('active')
  async active(@Req() req: Request) {
    return this.orders.listActive(await this.userId(req));
  }

  /**
   * Canonical cancel endpoint for every SmsOrderCard.
   * The SMSCode order is cancelled first; the resulting refund transaction
   * is then attached to the user-facing NumberOrder.
   */
  @Post('by-sms/:smsOrderId/cancel')
  async cancelBySms(@Req() req: Request, @Param('smsOrderId') smsOrderId: string) {
    const userId = await this.userId(req);
    const numberOrder = await this.numberOrders.findOne({
      where: { userId, smsCodeOrderId: smsOrderId },
    });

    if (!numberOrder) {
      throw new Error('سفارش شماره پیدا نشد.');
    }

    const cancelled = await this.smsCode.cancel(userId, smsOrderId);

    // SmsCodeService creates the refund against SMSCODE_ORDER. Re-link all
    // transactions belonging to this SMS order to the durable NumberOrder.
    const linked = await this.transactions.find({
      where: {
        userId,
        referenceType: 'SMSCODE_ORDER',
        referenceId: smsOrderId,
      },
    });

    for (const transaction of linked) {
      transaction.referenceType = 'NUMBER_ORDER';
      transaction.referenceId = numberOrder.id;
      await this.transactions.save(transaction);
    }

    await this.orders.ensureForSmsOrder(userId, smsOrderId);

    return {
      ...cancelled,
      orderNumber: numberOrder.orderNumber,
      numberOrderId: numberOrder.id,
      transactions: linked,
    };
  }
}
