import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminGuard } from './admin.guard';
import { User } from '../users/entities/user.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { Order, Product, Service, SmsCodeOrder } from '../commerce/entities/commerce.entity';
import { NumberOrder } from '../commerce/entities/number-order.entity';
import { SmsCodeService } from '../commerce/smscode.service';
import { NumberOrdersService } from '../commerce/number-orders.service';

const ACTIVE_SMS = ['CREATING', 'PROVIDER_PENDING', 'ACTIVE', 'OTP_RECEIVED'];
type NumberOrderDetail = Awaited<ReturnType<NumberOrdersService['listMyOrders']>>[number];

@Controller('admin/users')
@UseGuards(AdminGuard)
export class AdminUsersController {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Wallet) private readonly wallets: Repository<Wallet>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(SmsCodeOrder) private readonly smsOrders: Repository<SmsCodeOrder>,
    @InjectRepository(NumberOrder) private readonly numberOrderRows: Repository<NumberOrder>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Service) private readonly services: Repository<Service>,
    private readonly smsCode: SmsCodeService,
    private readonly numberOrders: NumberOrdersService,
  ) {}

  @Get()
  async listUsers(@Query('page') pageValue?: string, @Query('limit') limitValue?: string, @Query('search') search?: string) {
    const page = Math.max(1, Number(pageValue ?? 1) || 1);
    const limit = Math.min(50, Math.max(10, Number(limitValue ?? 10) || 10));
    const qb = this.users.createQueryBuilder('u').orderBy('u.createdAt', 'DESC');
    const q = search?.trim();
    if (q) qb.andWhere('(CAST(u."telegramId" AS TEXT) ILIKE :q OR COALESCE(u.username, \'\') ILIKE :q OR COALESCE(u.firstName, \'\') ILIKE :q OR COALESCE(u.lastName, \'\') ILIKE :q)', { q: `%${q}%` });
    const [users, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    const ids = users.map((u) => u.id);
    if (!ids.length) return { items: [], page, limit, total, pages: 0 };
    const [wallets, standardCounts, smsCounts] = await Promise.all([
      this.wallets.find({ where: ids.map((id) => ({ userId: id })) }),
      this.orders.createQueryBuilder('o').select('o.userId', 'userId').addSelect('COUNT(o.id)', 'count').where('o.userId IN (:...ids)', { ids }).groupBy('o.userId').getRawMany<{ userId: string; count: string }>(),
      this.smsOrders.createQueryBuilder('o').select('o.userId', 'userId').addSelect('COUNT(o.id)', 'count').where('o.userId IN (:...ids)', { ids }).groupBy('o.userId').getRawMany<{ userId: string; count: string }>(),
    ]);
    const walletByUser = new Map<string, Wallet>(wallets.map((w): [string, Wallet] => [w.userId, w]));
    const countByUser = new Map<string, number>();
    for (const row of [...standardCounts, ...smsCounts]) countByUser.set(row.userId, (countByUser.get(row.userId) ?? 0) + Number(row.count));
    return { items: users.map((user) => ({ id: user.id, telegramId: user.telegramId, username: user.username, firstName: user.firstName, lastName: user.lastName, photoUrl: user.photoUrl, role: user.role, createdAt: user.createdAt, balance: walletByUser.get(user.id)?.balance ?? '0', currency: walletByUser.get(user.id)?.currency ?? 'IRT', orderCount: countByUser.get(user.id) ?? 0 })), page, limit, total, pages: Math.ceil(total / limit) };
  }

  @Get(':userId/orders')
  async listOrders(@Param('userId') userId: string, @Query('page') pageValue?: string, @Query('limit') limitValue?: string, @Query('status') status?: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) return { found: false, items: [], page: 1, limit: 10, total: 0, pages: 0 };
    const page = Math.max(1, Number(pageValue ?? 1) || 1); const limit = Math.min(50, Math.max(10, Number(limitValue ?? 10) || 10));
    const standard = await this.orders.find({ where: { userId }, order: { createdAt: 'DESC' } });
    const sms = await this.smsOrders.find({ where: { userId }, order: { createdAt: 'DESC' } });
    const productIds = [...new Set([...standard.map((o) => o.productId), ...sms.map((o) => o.productId).filter(Boolean) as string[]])];
    const serviceIds = [...new Set(sms.map((o) => o.serviceId).filter(Boolean) as string[])];
    const [products, services] = await Promise.all([productIds.length ? this.products.find({ where: productIds.map((id) => ({ id })) }) : [], serviceIds.length ? this.services.find({ where: serviceIds.map((id) => ({ id })) }) : []]);
    const productById = new Map<string, Product>(products.map((p): [string, Product] => [p.id, p]));
    const serviceById = new Map<string, Service>(services.map((s): [string, Service] => [s.id, s]));
    let items = [
      ...standard.map((o) => { const product = productById.get(o.productId); return { id: o.id, kind: 'ORDER' as const, status: o.status, amount: o.amount, currency: o.currency, createdAt: o.createdAt, updatedAt: o.updatedAt, product: product ? { id: o.productId, title: product.title } : null }; }),
      ...sms.map((o) => { const product = o.productId ? productById.get(o.productId) : undefined; const service = o.serviceId ? serviceById.get(o.serviceId) : undefined; return { id: o.id, kind: 'SMSCODE' as const, status: o.status, amount: o.chargedAmount, currency: o.currency, createdAt: o.createdAt, updatedAt: o.updatedAt, product: product ? { id: o.productId, title: product.title } : null, service: service ? { id: o.serviceId, title: service.title } : null, phoneNumber: o.phoneNumber, refunded: Boolean(o.refundedAt), providerOrderId: o.providerOrderId }; }),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (status?.trim()) items = items.filter((o) => o.status.toLowerCase() === status.trim().toLowerCase());
    const total = items.length; const start = (page - 1) * limit;
    return { found: true, user: { id: user.id, telegramId: user.telegramId, username: user.username, firstName: user.firstName, lastName: user.lastName, photoUrl: user.photoUrl }, items: items.slice(start, start + limit), page, limit, total, pages: Math.ceil(total / limit), statuses: [...new Set(items.map((o) => o.status))] };
  }

  @Get(':userId/orders/:orderId')
  async orderDetail(@Param('userId') userId: string, @Param('orderId') orderId: string, @Query('kind') kind?: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) return { found: false };

    if (kind === 'NUMBER_ORDER') {
      const row = await this.numberOrderRows.findOne({ where: { id: orderId, userId } });
      if (!row) return { found: false };
      const numberOrder = (await this.numberOrders.listMyOrders(userId)).find((item) => item.id === row.id);
      if (!numberOrder) return { found: false };
      return this.numberOrderDetail(numberOrder, user);
    }

    if (kind === 'SMSCODE') {
      const order = await this.smsOrders.findOne({ where: { id: orderId, userId } });
      if (!order) return { found: false };

      // Prefer the canonical NumberOrder projection used by /number-orders/me.
      const numberOrder = (await this.numberOrders.listMyOrders(userId)).find(
        (item) => item.smsCodeOrderId === order.id,
      );
      if (numberOrder) return this.numberOrderDetail(numberOrder, user);

      let current: unknown = null;
      if (order.providerOrderId && ACTIVE_SMS.includes(order.status)) {
        try { current = await this.smsCode.get(userId, order.id); } catch { current = null; }
      }
      const [product, service] = await Promise.all([
        order.productId ? this.products.findOne({ where: { id: order.productId } }) : null,
        order.serviceId ? this.services.findOne({ where: { id: order.serviceId } }) : null,
      ]);
      return { found: true, kind: 'SMSCODE', user, order, product, service, sms: current ?? { ...order, providerOrderId: order.providerOrderId, phoneNumber: order.phoneNumber, status: order.status, canResend: order.canResend, canCancel: order.canCancel, canReplace: order.canReplace, expiresAt: order.expiresAt, resendAvailableAt: order.resendAvailableAt, cancelAvailableAt: order.cancelAvailableAt, replaceAvailableAt: order.replaceAvailableAt } };
    }

    const order = await this.orders.findOne({ where: { id: orderId, userId } });
    if (!order) return { found: false };
    const product = await this.products.findOne({ where: { id: order.productId } });
    const service = product ? await this.services.findOne({ where: { id: product.serviceId } }) : null;
    return { found: true, kind: 'ORDER', user, order, product, service };
  }

  private numberOrderDetail(numberOrder: NumberOrderDetail, user: User) {
    return {
      found: true,
      kind: 'NUMBER_ORDER',
      user,
      order: numberOrder,
      numberOrder,
      product: numberOrder.product,
      service: null,
      otpCodes: numberOrder.otpCodes,
      transactions: numberOrder.transactions,
    };
  }

  @Post(':userId/orders/:orderId/sms/resend')
  async resend(@Param('userId') userId: string, @Param('orderId') orderId: string) { return this.smsCode.resend(userId, orderId); }

  @Post(':userId/orders/:orderId/sms/cancel')
  async cancel(@Param('userId') userId: string, @Param('orderId') orderId: string) { return this.smsCode.cancel(userId, orderId); }

  @Post(':userId/orders/:orderId/sms/sync')
  async sync(@Param('userId') userId: string, @Param('orderId') orderId: string) { return this.smsCode.get(userId, orderId); }
}
