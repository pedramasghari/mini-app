import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminGuard } from './admin.guard';
import { User } from '../users/entities/user.entity';
import { Order, Product, Service, SmsCodeOrder } from '../commerce/entities/commerce.entity';
import { SmsCodeService } from '../commerce/smscode.service';

const ACTIVE_SMS = ['CREATING', 'PROVIDER_PENDING', 'ACTIVE', 'OTP_RECEIVED'];

@Controller('admin/orders')
@UseGuards(AdminGuard)
export class AdminOrdersController {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(SmsCodeOrder) private readonly smsOrders: Repository<SmsCodeOrder>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Service) private readonly services: Repository<Service>,
    private readonly smsCode: SmsCodeService,
  ) {}

  @Get()
  async list(
    @Query('page') pageValue?: string,
    @Query('limit') limitValue?: string,
    @Query('status') status?: string,
  ) {
    const page = Math.max(1, Number(pageValue ?? 1) || 1);
    const limit = Math.min(50, Math.max(10, Number(limitValue ?? 10) || 10));
    const [standard, sms] = await Promise.all([
      this.orders.find({ order: { createdAt: 'DESC' } }),
      this.smsOrders.find({ order: { createdAt: 'DESC' } }),
    ]);
    const productIds = [...new Set([...standard.map(o => o.productId), ...sms.map(o => o.productId).filter(Boolean) as string[]])];
    const serviceIds = [...new Set(sms.map(o => o.serviceId).filter(Boolean) as string[])];
    const [products, services] = await Promise.all([
      productIds.length ? this.products.find({ where: productIds.map(id => ({ id })) }) : [],
      serviceIds.length ? this.services.find({ where: serviceIds.map(id => ({ id })) }) : [],
    ]);
    const productById = new Map<string, Product>(products.map((p): [string, Product] => [p.id, p]));
    const serviceById = new Map<string, Service>(services.map((s): [string, Service] => [s.id, s]));
    let items = [
      ...standard.map(o => { const product = productById.get(o.productId); return { id: o.id, userId: o.userId, kind: 'ORDER' as const, status: o.status, amount: o.amount, currency: o.currency, createdAt: o.createdAt, updatedAt: o.updatedAt, product: product ? { id: product.id, title: product.title } : null }; }),
      ...sms.map(o => { const product = o.productId ? productById.get(o.productId) : undefined; const service = o.serviceId ? serviceById.get(o.serviceId) : undefined; return { id: o.id, userId: o.userId, kind: 'SMSCODE' as const, status: o.status, amount: o.chargedAmount, currency: o.currency, createdAt: o.createdAt, updatedAt: o.updatedAt, product: product ? { id: product.id, title: product.title } : null, service: service ? { id: service.id, title: service.title } : null, phoneNumber: o.phoneNumber, providerOrderId: o.providerOrderId, refunded: Boolean(o.refundedAt) }; }),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const availableStatuses = [...new Set(items.map(o => o.status))];
    if (status?.trim()) items = items.filter(o => o.status.toLowerCase() === status.trim().toLowerCase());
    const total = items.length;
    const pageItems = items.slice((page - 1) * limit, page * limit);
    const userIds = [...new Set(pageItems.map(o => o.userId))];
    const users = userIds.length ? await this.users.find({ where: userIds.map(id => ({ id })) }) : [];
    const userById = new Map<string, User>(users.map((u): [string, User] => [u.id, u]));
    return {
      items: pageItems.map(o => ({ ...o, user: (() => { const u = userById.get(o.userId); return u ? { id: u.id, telegramId: u.telegramId, username: u.username, firstName: u.firstName, lastName: u.lastName, photoUrl: u.photoUrl } : null; })() })),
      page, limit, total, pages: Math.ceil(total / limit), statuses: availableStatuses,
    };
  }

  @Get(':orderId')
  async detail(@Param('orderId') orderId: string, @Query('kind') kind?: string) {
    if (kind === 'SMSCODE') {
      const order = await this.smsOrders.findOne({ where: { id: orderId } });
      if (!order) return { found: false };
      const [user, product, service] = await Promise.all([
        this.users.findOne({ where: { id: order.userId } }),
        order.productId ? this.products.findOne({ where: { id: order.productId } }) : null,
        order.serviceId ? this.services.findOne({ where: { id: order.serviceId } }) : null,
      ]);
      let sms: unknown = null;
      if (order.providerOrderId && ACTIVE_SMS.includes(order.status)) {
        try { sms = await this.smsCode.get(order.userId, order.id); } catch { sms = null; }
      }
      return { found: true, kind: 'SMSCODE', order, product, service, user, sms: sms ?? order };
    }
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) return { found: false };
    const [user, product] = await Promise.all([this.users.findOne({ where: { id: order.userId } }), this.products.findOne({ where: { id: order.productId } })]);
    const service = product ? await this.services.findOne({ where: { id: product.serviceId } }) : null;
    return { found: true, kind: 'ORDER', order, product, service, user };
  }
}
