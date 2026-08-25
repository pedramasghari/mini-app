import { Controller, Get, NotFoundException, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { Product, ServiceSmsConfig, WalletTransaction } from './entities/commerce.entity';
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
    @InjectRepository(ServiceSmsConfig) private readonly smsConfigs: Repository<ServiceSmsConfig>,
    @InjectRepository(WalletTransaction) private readonly transactions: Repository<WalletTransaction>,
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
    const userId = await this.userId(req);
    const active = await this.orders.listActive(userId);
    if (!active.length) return active;

    const rows = await this.numberOrders.find({
      where: { userId, id: In(active.map((item) => item.id)) },
    });
    const serviceIds = [...new Set(rows.map((row) => row.serviceId).filter((id): id is string => Boolean(id)))];
    const configs = serviceIds.length
      ? await this.smsConfigs.find({ where: { serviceId: In(serviceIds) } })
      : [];
    const configByService = new Map(configs.map((config) => [config.serviceId, config] as const));

    return active.map((item) => {
      const row = rows.find((candidate) => candidate.id === item.id);
      const config = row?.serviceId ? configByService.get(row.serviceId) : undefined;
      return {
        ...item,
        countryCode: config?.countryCode ?? null,
        countryName: config?.countryName ?? null,
      };
    });
  }



  /** Backward-compatible endpoint: accepts either SmsCodeOrder id or NumberOrder id. */
  @Post('by-sms/:smsOrderId/cancel')
  async cancelBySms(@Req() req: Request, @Param('smsOrderId') smsOrderId: string) {
    const userId = await this.userId(req);

    let numberOrder: NumberOrder;
    const byNumberOrderId = await this.numberOrders.findOne({ where: { id: smsOrderId, userId } });
    if (byNumberOrderId) {
      numberOrder = byNumberOrderId;
    } else {
      const resolved = await this.orders.ensureForSmsOrder(userId, smsOrderId);
      if (!resolved) throw new NotFoundException('سفارش شماره پیدا نشد.');
      numberOrder = resolved;
    }

    return this.cancelResolvedOrder(userId, numberOrder);
  }

  private async cancelResolvedOrder(userId: string, numberOrder: NumberOrder) {
    const smsOrderId = numberOrder.smsCodeOrderId;
    const cancelled = await this.smsCode.cancel(userId, smsOrderId);

    const linked = await this.transactions.find({
      where: [
        { userId, referenceType: 'SMSCODE_ORDER', referenceId: smsOrderId },
        { userId, referenceType: 'SMSCODE_ORDER_REFUND', referenceId: smsOrderId },
        { userId, referenceType: 'NUMBER_ORDER', referenceId: numberOrder.id },
      ],
      order: { createdAt: 'ASC' },
    });

    const finalOrder = await this.orders.ensureForSmsOrder(userId, smsOrderId);
    return {
      ...cancelled,
      orderNumber: numberOrder.orderNumber,
      numberOrderId: numberOrder.id,
      phoneNumber: numberOrder.phoneNumber,
      transactions: linked,
      numberOrder: finalOrder,
    };
  }
}
