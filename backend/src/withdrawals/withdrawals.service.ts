import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Wallet } from '../wallets/entities/wallet.entity';
import { WalletTransaction } from '../commerce/entities/commerce.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { WithdrawalRequest } from './entities/withdrawal-request.entity';

const CURRENCY = 'IRT';
const WITHDRAW = 'WITHDRAW';
const WITHDRAW_REFUND = 'WITHDRAW_REFUND';
const REFERENCE = 'WITHDRAWAL_REQUEST';

function normalizeAmount(value: string): string {
  const amount = String(value ?? '').trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,8})?$/.test(amount) || Number(amount) <= 0) {
    throw new BadRequestException('مبلغ برداشت نامعتبر است.');
  }
  return amount;
}

function normalizeCard(value: string): string {
  const card = String(value ?? '').replace(/[\s-]/g, '');
  if (!/^\d{16}$/.test(card)) throw new BadRequestException('شماره کارت باید ۱۶ رقم باشد.');
  return card;
}

@Injectable()
export class WithdrawalsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(WithdrawalRequest) private readonly withdrawals: Repository<WithdrawalRequest>,
    private readonly notifications: NotificationsService,
  ) {}

  async create(userId: string, input: { cardNumber: string; cardHolderName: string; amount: string }) {
    const cardNumber = normalizeCard(input.cardNumber);
    const cardHolderName = String(input.cardHolderName ?? '').trim();
    if (cardHolderName.length < 3 || cardHolderName.length > 160) throw new BadRequestException('نام صاحب کارت نامعتبر است.');
    const amount = normalizeAmount(input.amount);

    const result = await this.dataSource.transaction(async (manager) => {
      const wallet = await manager.getRepository(Wallet).createQueryBuilder('w')
        .where('w.userId = :userId', { userId })
        .andWhere('w.currency = :currency', { currency: CURRENCY })
        .setLock('pessimistic_write')
        .getOne();
      if (!wallet) throw new NotFoundException('کیف پول پیدا نشد.');

      const updated = await manager.query(
        `UPDATE wallets SET balance = balance - $1, "updatedAt" = NOW() WHERE id = $2 AND balance >= $1 RETURNING balance`,
        [amount, wallet.id],
      );
      if (!updated.length) throw new BadRequestException('موجودی کیف پول کافی نیست.');
      const balanceAfter = String(updated[0].balance);
      const balanceBefore = String(wallet.balance);

      const request = manager.getRepository(WithdrawalRequest).create({
        userId, cardNumber, cardHolderName, amount, currency: CURRENCY, status: 'PENDING',
      });
      const saved = await manager.getRepository(WithdrawalRequest).save(request);

      await manager.getRepository(WalletTransaction).save(manager.getRepository(WalletTransaction).create({
        userId, walletId: wallet.id, type: WITHDRAW, amount: `-${amount}`,
        balanceBefore, balanceAfter, currency: CURRENCY,
        referenceType: REFERENCE, referenceId: saved.id,
        description: 'درخواست برداشت وجه',
      }));

      return saved;
    });

    await this.notifications.create(userId, {
      type: 'WITHDRAWAL_PENDING',
      title: 'درخواست برداشت ثبت شد',
      message: `درخواست برداشت ${result.amount} ${result.currency} ثبت شد و در انتظار واریز است.`,
      data: { withdrawalId: result.id, amount: result.amount, status: result.status },
    });
    return result;
  }

  async listMine(userId: string, page = 1, limit = 10) {
    page = Math.max(1, page); limit = Math.min(50, Math.max(1, limit));
    const [items, total] = await this.withdrawals.findAndCount({
      where: { userId }, order: { createdAt: 'DESC' }, skip: (page - 1) * limit, take: limit,
    });
    return { items, page, limit, total, pages: Math.ceil(total / limit) };
  }

  async cancel(userId: string, id: string) {
    const result = await this.dataSource.transaction(async (manager) => {
      const request = await manager.getRepository(WithdrawalRequest).createQueryBuilder('r')
        .where('r.id = :id AND r.userId = :userId', { id, userId })
        .setLock('pessimistic_write').getOne();
      if (!request) throw new NotFoundException('درخواست برداشت پیدا نشد.');
      if (request.status !== 'PENDING') throw new BadRequestException('فقط درخواست در حال انجام قابل لغو است.');

      const wallet = await manager.getRepository(Wallet).createQueryBuilder('w')
        .where('w.userId = :userId AND w.currency = :currency', { userId, currency: request.currency })
        .setLock('pessimistic_write').getOne();
      if (!wallet) throw new NotFoundException('کیف پول پیدا نشد.');

      const balanceBefore = String(wallet.balance);
      const updated = await manager.query(
        `UPDATE wallets SET balance = balance + $1, "updatedAt" = NOW() WHERE id = $2 RETURNING balance`,
        [request.amount, wallet.id],
      );
      const balanceAfter = String(updated[0].balance);
      request.status = 'CANCELLED';
      request.cancelledAt = new Date();
      await manager.getRepository(WithdrawalRequest).save(request);

      await manager.getRepository(WalletTransaction).save(manager.getRepository(WalletTransaction).create({
        userId, walletId: wallet.id, type: WITHDRAW_REFUND, amount: request.amount,
        balanceBefore, balanceAfter, currency: request.currency,
        referenceType: REFERENCE, referenceId: request.id,
        description: 'بازگشت مبلغ درخواست برداشت لغوشده',
      }));
      return { request, balanceAfter };
    });

    await this.notifications.create(userId, {
      type: 'WITHDRAWAL_CANCELLED',
      title: 'درخواست برداشت لغو شد',
      message: `مبلغ ${result.request.amount} ${result.request.currency} به کیف پول شما بازگردانده شد.`,
      data: { withdrawalId: result.request.id, amount: result.request.amount, status: result.request.status },
    });
    return result.request;
  }

  async adminList(page = 1, limit = 10, status?: string) {
    page = Math.max(1, page); limit = Math.min(50, Math.max(1, limit));
    const qb = this.withdrawals.createQueryBuilder('r').orderBy('r.createdAt', 'DESC');
    if (status?.trim()) qb.where('r.status = :status', { status: status.trim().toUpperCase() });
    const [items, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    const userIds = [...new Set(items.map((item) => item.userId))];
    const users = userIds.length ? await managerSafeUsers(this.dataSource, userIds) : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    return { items: items.map((item) => ({ ...item, user: byId.get(item.userId) ?? null })), page, limit, total, pages: Math.ceil(total / limit) };
  }

  async adminComplete(id: string, adminUserId: string, receiptPath: string) {
    if (!receiptPath) throw new BadRequestException('تصویر واریزی الزامی است.');
    const result = await this.dataSource.transaction(async (manager) => {
      const request = await manager.getRepository(WithdrawalRequest).createQueryBuilder('r')
        .where('r.id = :id', { id }).setLock('pessimistic_write').getOne();
      if (!request) throw new NotFoundException('درخواست برداشت پیدا نشد.');
      if (request.status !== 'PENDING') throw new BadRequestException('این درخواست دیگر در وضعیت در حال انجام نیست.');
      request.status = 'COMPLETED';
      request.receiptPath = receiptPath;
      request.completedAt = new Date();
      request.completedBy = adminUserId;
      return manager.getRepository(WithdrawalRequest).save(request);
    });
    await this.notifications.create(result.userId, {
      type: 'WITHDRAWAL_COMPLETED',
      title: 'برداشت شما انجام شد',
      message: `درخواست برداشت ${result.amount} ${result.currency} واریز شد.`,
      data: { withdrawalId: result.id, amount: result.amount, status: result.status },
    });
    return result;
  }
}

async function managerSafeUsers(dataSource: DataSource, ids: string[]) {
  const rows = await dataSource.getRepository('users').createQueryBuilder('u')
    .select(['u.id', 'u.telegramId', 'u.username', 'u.firstName', 'u.lastName', 'u.photoUrl'])
    .where('u.id IN (:...ids)', { ids }).getMany();
  return rows as Array<{ id: string; telegramId: string; username?: string | null; firstName?: string | null; lastName?: string | null; photoUrl?: string | null }>;
}
