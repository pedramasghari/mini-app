import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { AdminGuard } from './admin.guard';
import { User } from '../users/entities/user.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { Repository } from 'typeorm';
import {
  ActivationProgress,
  Order,
  OrderInput,
  Product,
  Service,
  SmsCodeOrder,
  WalletTransaction,
} from '../commerce/entities/commerce.entity';
import { SmsCodeService } from 'src/commerce/smscode.service';

@Controller('admin/finance')
@UseGuards(AdminGuard)
export class AdminFinanceController {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Wallet) private readonly wallets: Repository<Wallet>,
    @InjectRepository(WalletTransaction)
    private readonly transactions: Repository<WalletTransaction>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderInput)
    private readonly inputs: Repository<OrderInput>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Service) private readonly services: Repository<Service>,
    @InjectRepository(SmsCodeOrder)
    private readonly smsOrders: Repository<SmsCodeOrder>,
    @InjectRepository(ActivationProgress)
    private readonly progress: Repository<ActivationProgress>,
    private readonly config: ConfigService,
    private readonly smsCodeService: SmsCodeService,
  ) {}

  @Get('overview')
  async overview() {
    const wallet = await this.wallets
      .createQueryBuilder('w')
      .select('COALESCE(SUM(w.balance::numeric), 0)', 'balance')
      .addSelect('COUNT(w.id)', 'walletCount')
      .where('w.currency = :currency', { currency: 'IRT' })
      .getRawOne<{ balance: string; walletCount: string }>();
    const received = await this.transactions
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.amount::numeric), 0)', 'total')
      .where('t.currency = :currency', { currency: 'IRT' })
      .andWhere('t.type = :type', { type: 'DEPOSIT' })
      .getRawOne<{ total: string }>();
    const withdrawals = await this.transactions
      .createQueryBuilder('t')
      .select('COALESCE(SUM(ABS(t.amount::numeric)), 0)', 'total')
      .where('t.currency = :currency', { currency: 'IRT' })
      .andWhere("LOWER(t.type) LIKE '%withdraw%'")
      .getRawOne<{ total: string }>();
    const serviceRevenue = await this.orders
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.amount::numeric), 0)', 'total')
      .where("o.status NOT IN ('CANCELLED', 'REFUNDED', 'FAILED')")
      .andWhere('o.currency = :currency', { currency: 'IRT' })
      .getRawOne<{ total: string }>();
    const smsRevenue = await this.smsOrders
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o."chargedAmount"::numeric), 0)', 'total')
      .where('o."refundedAt" IS NULL')
      .andWhere("o.status NOT IN ('FAILED', 'REFUNDED')")
      .andWhere('o.currency = :currency', { currency: 'IRT' })
      .getRawOne<{ total: string }>();
    return {
      smscode: await this.providerBalance(),
      usersBalance: wallet?.balance ?? '0',
      walletCount: Number(wallet?.walletCount ?? 0),
      totalReceived: received?.total ?? '0',
      totalWithdrawals: withdrawals?.total ?? '0',
      serviceRevenue: {
        standardOrders: serviceRevenue?.total ?? '0',
        smsCodeOrders: smsRevenue?.total ?? '0',
        total: (
          Number(serviceRevenue?.total ?? 0) + Number(smsRevenue?.total ?? 0)
        ).toFixed(8),
      },
    };
  }

  private async providerBalance() {
    const smscode = await this.smsCodeService.getBalance();
    return {
      balance: smscode.balance,
      currency: smscode.currency,
      available: true,
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
    const qb = this.transactions
      .createQueryBuilder('t')
      .leftJoin(User, 'u', 'u.id = t.userId')
      .orderBy('t.createdAt', 'DESC');
    if (telegramId?.trim())
      qb.andWhere('CAST(u."telegramId" AS TEXT) LIKE :telegramId', {
        telegramId: `%${telegramId.trim()}%`,
      });
    if (status?.trim()) {
      switch (status.trim().toUpperCase()) {
        case 'SERVICE_PURCHASE':
          qb.andWhere("t.type = 'SMSCODE_ORDER'").andWhere(
            `NOT EXISTS (SELECT 1 FROM wallet_transactions r WHERE r."referenceType" = t."referenceType" AND r."referenceId" = t."referenceId" AND r.type = 'SMSCODE_ORDER_REFUND')`,
          );
          break;
        case 'SERVICE_REFUND':
          qb.andWhere("t.type = 'SMSCODE_ORDER_REFUND'");
          break;
        case 'DEPOSIT':
          qb.andWhere("t.type = 'DEPOSIT'");
          break;
        case 'WITHDRAW':
          qb.andWhere("LOWER(t.type) LIKE '%withdraw%'");
          break;
        default:
          qb.andWhere('LOWER(t.type) = LOWER(:status)', {
            status: status.trim(),
          });
      }
    }
    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    const userIds = [...new Set(items.map((item) => item.userId))];
    const users = userIds.length
      ? await this.users.find({ where: userIds.map((id) => ({ id })) })
      : [];
    const usersById = new Map(users.map((user) => [user.id, user]));
    return {
      items: items.map((item) => {
        const user = usersById.get(item.userId);
        return {
          ...item,
          user: user
            ? {
                id: user.id,
                telegramId: user.telegramId,
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                photoUrl: user.photoUrl,
              }
            : null,
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
    const [purchaseTotal, refundTotal, depositTotal, withdrawTotal] =
      await Promise.all([
        this.transactions
          .createQueryBuilder('t')
          .where("t.type = 'SMSCODE_ORDER'")
          .andWhere(
            `NOT EXISTS (SELECT 1 FROM wallet_transactions r WHERE r."referenceType" = t."referenceType" AND r."referenceId" = t."referenceId" AND r.type = 'SMSCODE_ORDER_REFUND')`,
          )
          .getCount(),
        this.transactions
          .createQueryBuilder('t')
          .where("t.type = 'SMSCODE_ORDER_REFUND'")
          .getCount(),
        this.transactions
          .createQueryBuilder('t')
          .where("t.type = 'DEPOSIT'")
          .getCount(),
        this.transactions
          .createQueryBuilder('t')
          .where("LOWER(t.type) LIKE '%withdraw%'")
          .getCount(),
      ]);
    return [
      { type: 'SERVICE_PURCHASE', count: purchaseTotal },
      { type: 'SERVICE_REFUND', count: refundTotal },
      { type: 'DEPOSIT', count: depositTotal },
      { type: 'WITHDRAW', count: withdrawTotal },
    ];
  }

  @Get('orders/:id')
  async orderDetail(@Param('id') id: string, @Query('kind') kind?: string) {
    if (kind === 'SMSCODE') return this.smsOrderDetail(id);
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
      this.progress.findOne({ where: { orderId: id } }),
    ]);
    const service = product
      ? await this.services.findOne({ where: { id: product.serviceId } })
      : null;
    return {
      found: true,
      kind: 'ORDER',
      order,
      product,
      service,
      user,
      inputs,
      progress,
    };
  }
  private async smsOrderDetail(id: string) {
    const order = await this.smsOrders.findOne({ where: { id } });
    if (!order) return { found: false };
    const [user, product, service] = await Promise.all([
      this.users.findOne({ where: { id: order.userId } }),
      order.productId
        ? this.products.findOne({ where: { id: order.productId } })
        : null,
      order.serviceId
        ? this.services.findOne({ where: { id: order.serviceId } })
        : null,
    ]);
    return { found: true, kind: 'SMSCODE', order, product, service, user };
  }
}
