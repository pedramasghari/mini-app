import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AdminGuard } from './admin.guard';
import { User } from '../users/entities/user.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { Repository } from 'typeorm';
import { Order, OrderInput, PaymentRequest, Product, Service, SmsCodeOrder, WalletTransaction } from '../commerce/entities/commerce.entity';
import { SmsCodeService } from '../commerce/smscode.service';

@Controller('admin/finance')
@UseGuards(AdminGuard)
export class AdminFinanceController {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Wallet) private readonly wallets: Repository<Wallet>,
    @InjectRepository(WalletTransaction) private readonly transactions: Repository<WalletTransaction>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderInput) private readonly inputs: Repository<OrderInput>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Service) private readonly services: Repository<Service>,
    @InjectRepository(SmsCodeOrder) private readonly smsOrders: Repository<SmsCodeOrder>,
    @InjectRepository(PaymentRequest) private readonly payments: Repository<PaymentRequest>,
    private readonly smsCode: SmsCodeService,
  ) {}

  @Get('overview')
  async overview() {
    const wallet = await this.wallets.createQueryBuilder('w')
      .select('COALESCE(SUM(w.balance), 0)', 'balance')
      .addSelect('COUNT(w.id)', 'walletCount')
      .where('w.currency = :currency', { currency: 'IRT' })
      .getRawOne<{ balance: string; walletCount: string }>();

    const received = await this.transactions.createQueryBuilder('t')
      .select('COALESCE(SUM(CASE WHEN t.amount::numeric > 0 THEN t.amount::numeric ELSE 0 END), 0)', 'total')
      .where('t.currency = :currency', { currency: 'IRT' })
      .getRawOne<{ total: string }>();

    const withdrawals = await this.transactions.createQueryBuilder('t')
      .select('COALESCE(SUM(ABS(t.amount::numeric)), 0)', 'total')
      .where('t.currency = :currency', { currency: 'IRT' })
      .andWhere("LOWER(t.type) LIKE '%withdraw%'")
      .getRawOne<{ total: string }>();

    const serviceRevenue = await this.orders.createQueryBuilder('o')
      .select('COALESCE(SUM(o.amount::numeric), 0)', 'total')
      .where("o.status NOT IN ('CANCELLED', 'REFUNDED', 'FAILED')")
      .andWhere('o.currency = :currency', { currency: 'IRT' })
      .getRawOne<{ total: string }>();

    const smsRevenue = await this.smsOrders.createQueryBuilder('o')
      .select('COALESCE(SUM(o.chargedAmount::numeric), 0)', 'total')
      .where("o.status NOT IN ('REFUNDED', 'FAILED')")
      .andWhere('o.currency = :currency', { currency: 'IRT' })
      .getRawOne<{ total: string }>();

    let smscode: { balance: string | null; currency: string | null; available: boolean; error?: string };
    try {
      const provider = await this.smsCode.getBalance();
      smscode = { balance: provider.balance, currency: provider.currency, available: true };
    } catch (error) {
      smscode = { balance: null, currency: null, available: false, error: error instanceof Error ? error.message : 'SMSCode balance unavailable' };
    }

    return {
      smscode,
      usersBalance: wallet?.balance ?? '0',
      walletCount: Number(wallet?.walletCount ?? 0),
      totalReceived: received?.total ?? '0',
      totalWithdrawals: withdrawals?.total ?? '0',
      serviceRevenue: {
        standardOrders: serviceRevenue?.total ?? '0',
        smsCodeOrders: smsRevenue?.total ?? '0',
        total: (Number(serviceRevenue?.total ?? 0) + Number(smsRevenue?.total ?? 0)).toFixed(8),
      },
    };
  }

  @Get('transactions')
  async listTransactions(
    @Query('page') pageValue?: string,
    @Query('limit') limitValue?: string,
    @Query('telegramId') telegramId?: string,
    @Query('status') status?: string,
  ) {
    const page = Math.max(1, Number(pageValue ?? 1) || 1);
    const limit = Math.min(50, Math.max(10, Number(limitValue ?? 10) || 10));
    const qb = this.transactions.createQueryBuilder('t')
      .leftJoin(User, 'u', 'u.id = t.userId')
      .addSelect(['u.id', 'u.telegramId', 'u.username', 'u.firstName', 'u.lastName'])
      .orderBy('t.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (telegramId?.trim()) qb.andWhere('CAST(u.telegramId AS TEXT) LIKE :telegramId', { telegramId: `%${telegramId.trim()}%` });
    if (status?.trim()) qb.andWhere('LOWER(t.type) = LOWER(:status)', { status: status.trim() });

    const [items, total] = await qb.getManyAndCount();
    const userIds = [...new Set(items.map((item) => item.userId))];
    const users = userIds.length ? await this.users.findBy({ id: userIds as never }) : [];
    const usersById = new Map(users.map((user) => [user.id, user]));

    return {
      items: items.map((item) => {
        const user = usersById.get(item.userId);
        return {
          ...item,
          user: user ? { id: user.id, telegramId: user.telegramId, username: user.username, firstName: user.firstName, lastName: user.lastName, photoUrl: user.photoUrl } : null,
          canTrack: Boolean(item.referenceId),
        };
      }),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  @Get('transactions/statuses')
  async statuses() {
    const rows = await this.transactions.createQueryBuilder('t')
      .select('t.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('t.type')
      .orderBy('count', 'DESC')
      .getRawMany<{ type: string; count: string }>();
    return rows.map((row) => ({ type: row.type, count: Number(row.count) }));
  }

  @Get('orders/:id')
  async orderDetail(@Param('id') id: string, @Query('kind') kind?: string) {
    if (kind === 'SMSCODE') {
      return this.smsOrderDetail(id);
    }

    const order = await this.orders.findOne({ where: { id } });
    if (!order) {
      const sms = await this.smsOrders.findOne({ where: { id } });
      if (!sms) return { found: false };
      return this.smsOrderDetail(id);
    }

    const [product, user, inputs, progress] = await Promise.all([
      this.products.findOne({ where: { id: order.productId } }),
      this.users.findOne({ where: { id: order.userId } }),
      this.inputs.find({ where: { orderId: id }, order: { createdAt: 'ASC' } }),
      this.services.findOne({ where: { id: order.productId } }),
    ]);
    const service = product ? await this.services.findOne({ where: { id: product.serviceId } }) : null;
    return {
      found: true,
      kind: 'ORDER',
      order,
      product,
      service,
      user,
      inputs,
      progress: progress ?? null,
    };
  }

  private async smsOrderDetail(id: string) {
    const order = await this.smsOrders.findOne({ where: { id } });
    if (!order) return { found: false };
    const [user, product, service] = await Promise.all([
      this.users.findOne({ where: { id: order.userId } }),
      order.productId ? this.products.findOne({ where: { id: order.productId } }) : null,
      order.serviceId ? this.services.findOne({ where: { id: order.serviceId } }) : null,
    ]);
    return { found: true, kind: 'SMSCODE', order, product, service, user };
  }
}
