import { Controller, Get, NotFoundException, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { Product, WalletTransaction } from './entities/commerce.entity';
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
    @InjectRepository(NumberOrder) private readonly numberOrders: Repository<NumberOrder>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(WalletTransaction) private readonly transactions: Repository<WalletTransaction>,
  ) {}

  private async userId(req: Request) {
    const token = req.cookies?.[COOKIE] as string | undefined;
    const session = await this.auth.getSession(token ?? '');
    return session.user.id;
  }

  @Get('me')
  async mine(@Req() req: Request) {
    const userId = await this.userId(req);
    const orders = await this.numberOrders.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 100 });
    const result = [] as Array<NumberOrder & {
      product: { id: string; title: string; icon: string; currency: string } | null;
      otpCodes: NonNullable<NumberOrder['metadata']>['otpCodes'];
      transactions: WalletTransaction[];
    }>;

    for (const order of orders) {
      const product = await this.products.findOne({ where: { id: order.productId } });
      const legacy = await this.transactions.find({
        where: [
          { userId, referenceType: 'SMSCODE_ORDER', referenceId: order.smsCodeOrderId },
          { userId, referenceType: 'SMSCODE_ORDER_REFUND', referenceId: order.smsCodeOrderId },
        ],
        order: { createdAt: 'DESC' },
      });
      const current = await this.transactions.find({ where: { userId, referenceType: 'NUMBER_ORDER', referenceId: order.id }, order: { createdAt: 'DESC' } });

      for (const transaction of legacy) {
        transaction.referenceType = 'NUMBER_ORDER';
        transaction.referenceId = order.id;
        await this.transactions.save(transaction);
      }

      const transactions = [...current, ...legacy]
        .filter((transaction, index, all) => all.findIndex(item => item.id === transaction.id) === index)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      result.push({
        ...order,
        product: product ? { id: product.id, title: product.title, icon: product.icon, currency: product.currency } : null,
        otpCodes: order.metadata?.otpCodes ?? [],
        transactions,
      });
    }
    return result;
  }

  @Get('active')
  async active(@Req() req: Request) {
    return this.orders.listActive(await this.userId(req));
  }

  /** Canonical cancellation endpoint used by every SmsOrderCard. */
  @Post('by-sms/:smsOrderId/cancel')
  async cancelBySms(@Req() req: Request, @Param('smsOrderId') smsOrderId: string) {
    const userId = await this.userId(req);

    // Materialize NumberOrder BEFORE SmsCodeService creates the refund.
    // This lets refundIfNeeded attach the refund directly to NumberOrder.
    const numberOrder = await this.orders.ensureForSmsOrder(userId, smsOrderId);
    if (!numberOrder) throw new NotFoundException('سفارش شماره پیدا نشد.');

    const cancelled = await this.smsCode.cancel(userId, smsOrderId);

    // Include both old purchase/refund references and the canonical NumberOrder reference.
    const linked = await this.transactions.find({
      where: [
        { userId, referenceType: 'SMSCODE_ORDER', referenceId: smsOrderId },
        { userId, referenceType: 'SMSCODE_ORDER_REFUND', referenceId: smsOrderId },
        { userId, referenceType: 'NUMBER_ORDER', referenceId: numberOrder.id },
      ],
      order: { createdAt: 'ASC' },
    });

    for (const transaction of linked) {
      if (transaction.referenceType !== 'NUMBER_ORDER' || transaction.referenceId !== numberOrder.id) {
        transaction.referenceType = 'NUMBER_ORDER';
        transaction.referenceId = numberOrder.id;
        await this.transactions.save(transaction);
      }
    }

    const finalOrder = await this.orders.ensureForSmsOrder(userId, smsOrderId);
    return {
      ...cancelled,
      orderNumber: numberOrder.orderNumber,
      numberOrderId: numberOrder.id,
      transactions: linked,
      numberOrder: finalOrder,
    };
  }
}
