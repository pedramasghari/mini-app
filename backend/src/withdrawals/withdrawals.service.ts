import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Wallet } from '../wallets/entities/wallet.entity';
import { User } from '../users/entities/user.entity';
import { WalletTransaction } from '../commerce/entities/commerce.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { WithdrawalRequest } from './entities/withdrawal-request.entity';

const CURRENCY = 'IRT';
const WITHDRAW = 'WITHDRAW';
const WITHDRAW_REFUND = 'WITHDRAW_REFUND';
const REFERENCE = 'WITHDRAWAL_REQUEST';

function normalizeDecimal(value: unknown): string {
  const normalized = String(value ?? '').trim();
  if (!/^\d+(\.\d{1,8})?$/.test(normalized))
    throw new BadRequestException('موجودی کیف پول نامعتبر است.');
  return normalized;
}
function normalizeAmount(value: string): string {
  const amount = String(value ?? '')
    .trim()
    .replace(/,/g, '');
  if (!/^\d+(\.\d{1,8})?$/.test(amount) || Number(amount) <= 0)
    throw new BadRequestException('مبلغ برداشت نامعتبر است.');
  return amount;
}
function normalizeCard(value: string): string {
  const card = String(value ?? '').replace(/[\s-]/g, '');
  if (!/^\d{16}$/.test(card))
    throw new BadRequestException('شماره کارت باید ۱۶ رقم باشد.');
  return card;
}

@Injectable()
export class WithdrawalsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(WithdrawalRequest)
    private readonly withdrawals: Repository<WithdrawalRequest>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    userId: string,
    input: { cardNumber: string; cardHolderName: string; amount: string },
  ) {
    const cardNumber = normalizeCard(input.cardNumber);
    const cardHolderName = String(input.cardHolderName ?? '').trim();
    if (cardHolderName.length < 3 || cardHolderName.length > 160)
      throw new BadRequestException('نام صاحب کارت نامعتبر است.');
    const amount = normalizeAmount(input.amount);
    const result = await this.dataSource.transaction(async (manager) => {
      const walletRepo = manager.getRepository(Wallet);
      const wallet = await walletRepo
        .createQueryBuilder('w')
        .where('w.userId = :userId', { userId })
        .andWhere('w.currency = :currency', { currency: CURRENCY })
        .setLock('pessimistic_write')
        .getOne();
      if (!wallet) throw new NotFoundException('کیف پول پیدا نشد.');
      const balanceBefore = normalizeDecimal(wallet.balance);
      const updated = await manager.query(
        `UPDATE wallets SET balance = balance - CAST($1 AS numeric), "updatedAt" = NOW() WHERE id = $2 AND balance >= CAST($1 AS numeric)`,
        [amount, wallet.id],
      );
      if (updated === undefined)
        throw new BadRequestException('خطا در به‌روزرسانی موجودی کیف پول.');
      const afterWallet = await walletRepo.findOne({
        where: { id: wallet.id },
      });
      if (!afterWallet)
        throw new NotFoundException('کیف پول پس از برداشت پیدا نشد.');
      const balanceAfter = normalizeDecimal(afterWallet.balance);
      if (
        Number(balanceAfter) < 0 ||
        Number(balanceAfter) > Number(balanceBefore)
      )
        throw new BadRequestException(
          'موجودی کیف پول پس از برداشت نامعتبر است.',
        );
      if (Number(balanceBefore) < Number(amount))
        throw new BadRequestException('موجودی کیف پول کافی نیست.');
      const saved = await manager
        .getRepository(WithdrawalRequest)
        .save(
          manager
            .getRepository(WithdrawalRequest)
            .create({
              userId,
              cardNumber,
              cardHolderName,
              amount,
              currency: CURRENCY,
              status: 'PENDING',
            }),
        );
      await manager
        .getRepository(WalletTransaction)
        .save(
          manager
            .getRepository(WalletTransaction)
            .create({
              userId,
              walletId: wallet.id,
              type: WITHDRAW,
              amount: `-${amount}`,
              balanceBefore,
              balanceAfter,
              currency: CURRENCY,
              referenceType: REFERENCE,
              referenceId: saved.id,
              description: 'درخواست برداشت وجه',
            }),
        );
      return saved;
    });
    try {
      await this.notifications.create(userId, {
        type: 'WITHDRAWAL_PENDING',
        title: 'درخواست برداشت ثبت شد',
        message: `درخواست برداشت ${result.amount} ${result.currency} ثبت شد و در انتظار واریز است.`,
        data: {
          withdrawalId: result.id,
          amount: result.amount,
          status: result.status,
        },
      });
    } catch {}
    return result;
  }

  async listMine(userId: string, page = 1, limit = 10) {
    page = Math.max(1, page);
    limit = Math.min(50, Math.max(1, limit));
    const [items, total] = await this.withdrawals.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, page, limit, total, pages: Math.ceil(total / limit) };
  }

  /** Combined deposit + withdrawal requests. Pagination and sorting are performed by PostgreSQL. */
  async listWalletRequests(
    userId: string,
    page = 1,
    limit = 10,
    type = 'ALL',
    status?: string,
  ) {
    page = Math.max(1, Number(page) || 1);
    limit = Math.min(50, Math.max(1, Number(limit) || 10));
    const normalizedType = String(type || 'ALL').toUpperCase();
    if (!['ALL', 'WITHDRAWAL', 'DEPOSIT'].includes(normalizedType))
      throw new BadRequestException('نوع درخواست نامعتبر است.');
    const normalizedStatus = status ? String(status).trim().toUpperCase() : '';
    const allowedStatus =
      normalizedStatus &&
      ['PENDING', 'COMPLETED', 'CANCELLED', 'APPROVED', 'REJECTED'].includes(
        normalizedStatus,
      )
        ? normalizedStatus
        : '';
    if (status && !allowedStatus)
      throw new BadRequestException('وضعیت درخواست نامعتبر است.');

    const params: unknown[] = [userId];
    const conditions = ['"userId" = $1'];
    if (normalizedType === 'WITHDRAWAL') conditions.push(`kind = 'WITHDRAWAL'`);
    if (normalizedType === 'DEPOSIT') conditions.push(`kind = 'DEPOSIT'`);
    if (allowedStatus) {
      params.push(allowedStatus);
      conditions.push(`status = $${params.length}`);
    }
    const where = conditions.join(' AND ');
    const union = `
      SELECT id, "userId", 'WITHDRAWAL' AS kind, amount, currency, status, "createdAt", "completedAt", "cancelledAt", NULL::timestamptz AS "rejectedAt", "receiptPath", "cardNumber", "cardHolderName", NULL::text AS "adminReason"
      FROM withdrawal_requests
      UNION ALL
      SELECT id, "userId", 'DEPOSIT' AS kind, amount, currency, status, "createdAt", NULL::timestamptz AS "completedAt", NULL::timestamptz AS "cancelledAt", NULL::timestamptz AS "rejectedAt", "receiptPath", NULL::text AS "cardNumber", NULL::text AS "cardHolderName", "adminReason"
      FROM payment_requests
    `;
    const offset = (page - 1) * limit;
    const dataParams = [...params, limit, offset];
    const rows = await this.dataSource.query(
      `SELECT id, kind, amount, currency, status, "createdAt", "completedAt", "cancelledAt", "rejectedAt", "receiptPath", "cardNumber", "cardHolderName", "adminReason" FROM (${union}) requests WHERE ${where} ORDER BY CASE WHEN status = 'PENDING' THEN 0 ELSE 1 END, "createdAt" DESC LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams,
    );
    const count = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM (${union}) requests WHERE ${where}`,
      params,
    );
    const total = Number(count[0]?.total ?? 0);
    return { items: rows, page, limit, total, pages: Math.ceil(total / limit) };
  }

  async cancel(userId: string, id: string) {
    const result = await this.dataSource.transaction(async (manager) => {
      const walletRepo = manager.getRepository(Wallet);
      const request = await manager
        .getRepository(WithdrawalRequest)
        .createQueryBuilder('r')
        .where('r.id = :id AND r.userId = :userId', { id, userId })
        .setLock('pessimistic_write')
        .getOne();
      if (!request) throw new NotFoundException('درخواست برداشت پیدا نشد.');
      if (request.status !== 'PENDING')
        throw new BadRequestException('فقط درخواست در حال انجام قابل لغو است.');
      const wallet = await walletRepo
        .createQueryBuilder('w')
        .where('w.userId = :userId AND w.currency = :currency', {
          userId,
          currency: request.currency,
        })
        .setLock('pessimistic_write')
        .getOne();
      if (!wallet) throw new NotFoundException('کیف پول پیدا نشد.');
      const balanceBefore = normalizeDecimal(wallet.balance);
      await manager.query(
        `UPDATE wallets SET balance = balance + CAST($1 AS numeric), "updatedAt" = NOW() WHERE id = $2`,
        [request.amount, wallet.id],
      );
      const afterWallet = await walletRepo.findOne({
        where: { id: wallet.id },
      });
      if (!afterWallet)
        throw new NotFoundException('کیف پول پس از بازگشت پیدا نشد.');
      const balanceAfter = normalizeDecimal(afterWallet.balance);
      request.status = 'CANCELLED';
      request.cancelledAt = new Date();
      await manager.getRepository(WithdrawalRequest).save(request);
      await manager
        .getRepository(WalletTransaction)
        .save(
          manager
            .getRepository(WalletTransaction)
            .create({
              userId,
              walletId: wallet.id,
              type: WITHDRAW_REFUND,
              amount: request.amount,
              balanceBefore,
              balanceAfter,
              currency: request.currency,
              referenceType: REFERENCE,
              referenceId: request.id,
              description: 'بازگشت مبلغ درخواست برداشت لغوشده',
            }),
        );
      return request;
    });
    try {
      await this.notifications.create(userId, {
        type: 'WITHDRAWAL_CANCELLED',
        title: 'درخواست برداشت لغو شد',
        message: `مبلغ ${result.amount} ${result.currency} به کیف پول شما بازگردانده شد.`,
        data: {
          withdrawalId: result.id,
          amount: result.amount,
          status: result.status,
        },
      });
    } catch {}
    return result;
  }

  async adminList(page = 1, limit = 10, status?: string) {
    page = Math.max(1, page);
    limit = Math.min(50, Math.max(1, limit));
    const qb = this.withdrawals
      .createQueryBuilder('r')
      .orderBy('r.createdAt', 'DESC');
    if (status?.trim())
      qb.where('r.status = :status', { status: status.trim().toUpperCase() });
    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    const userIds = [...new Set(items.map((item) => item.userId))];
    const users = userIds.length
      ? await this.users.find({ where: userIds.map((id) => ({ id })) })
      : [];
    const byId = new Map(users.map((user) => [user.id, user]));
    return {
      items: items.map((item) => {
        const user = byId.get(item.userId);
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
        };
      }),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  async adminComplete(id: string, adminUserId: string, receiptPath: string) {
    if (!receiptPath) throw new BadRequestException('تصویر واریزی الزامی است.');
    const result = await this.dataSource.transaction(async (manager) => {
      const request = await manager
        .getRepository(WithdrawalRequest)
        .createQueryBuilder('r')
        .where('r.id = :id', { id })
        .setLock('pessimistic_write')
        .getOne();
      if (!request) throw new NotFoundException('درخواست برداشت پیدا نشد.');
      if (request.status !== 'PENDING')
        throw new BadRequestException(
          'این درخواست دیگر در وضعیت در حال انجام نیست.',
        );
      request.status = 'COMPLETED';
      request.receiptPath = receiptPath;
      request.completedAt = new Date();
      request.completedBy = adminUserId;
      return manager.getRepository(WithdrawalRequest).save(request);
    });
    try {
      await this.notifications.create(result.userId, {
        type: 'WITHDRAWAL_COMPLETED',
        title: 'برداشت شما انجام شد',
        message: `درخواست برداشت ${result.amount} ${result.currency} واریز شد.`,
        data: {
          withdrawalId: result.id,
          amount: result.amount,
          status: result.status,
        },
      });
    } catch {}
    return result;
  }
}
