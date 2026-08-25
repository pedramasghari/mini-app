import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Wallet } from '../wallets/entities/wallet.entity';
import { WalletTransaction } from '../commerce/entities/commerce.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { ZibalPayment } from './entities/zibal-payment.entity';

const REQUEST_URL = 'https://gateway.zibal.ir/v1/request';
const VERIFY_URL = 'https://gateway.zibal.ir/v1/verify';
const START_URL = 'https://gateway.zibal.ir/start/';
const MIN_PROVIDER_RIAL = 1001n;

type ZibalResponse = {
  result?: number;
  message?: string;
  trackId?: number | string;
  status?: number;
  amount?: number | string;
  paidAt?: string;
  refNumber?: string;
  cardNumber?: string;
};

@Injectable()
export class ZibalService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ZibalService.name);
  private timer?: NodeJS.Timeout;
  private reconciling = false;

  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(ZibalPayment) private readonly payments: Repository<ZibalPayment>,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    if (this.config.get<string>('ZIBAL_ENABLED', 'true') === 'false') return;
    this.timer = setInterval(() => void this.reconcilePending(), 60_000);
    void this.reconcilePending();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private merchant() {
    const merchant = this.config.get<string>('ZIBAL_MERCHANT');
    if (!merchant) throw new Error('ZIBAL_MERCHANT is not configured.');
    return merchant;
  }

  private callbackUrl() {
    const value = this.config.get<string>('ZIBAL_CALLBACK_URL');
    if (!value) throw new Error('ZIBAL_CALLBACK_URL is not configured.');
    return value;
  }

  private minDeposit() { return BigInt(this.config.get<string>('ZIBAL_MIN_DEPOSIT_IRT', '1000')); }
  private maxDeposit() { return BigInt(this.config.get<string>('ZIBAL_MAX_DEPOSIT_IRT', '50000000')); }

  configForClient() {
    return {
      enabled: this.config.get<string>('ZIBAL_ENABLED', 'true') !== 'false',
      minAmount: this.minDeposit().toString(),
      maxAmount: this.maxDeposit().toString(),
      currency: 'IRT',
    };
  }

  private parseAmount(value: string) {
    const normalized = String(value ?? '').trim().replace(/,/g, '');
    if (!/^\d+$/.test(normalized)) throw new BadRequestException('مبلغ شارژ باید عدد صحیح باشد.');
    const amount = BigInt(normalized);
    const min = this.minDeposit();
    const max = this.maxDeposit();
    if (amount < min) throw new BadRequestException(`حداقل مبلغ شارژ ${min.toLocaleString('fa-IR')} تومان است.`);
    if (amount > max) throw new BadRequestException(`حداکثر مبلغ شارژ ${max.toLocaleString('fa-IR')} تومان است.`);
    if (amount * 10n <= MIN_PROVIDER_RIAL) throw new BadRequestException('مبلغ برای درگاه زیبال کمتر از حد مجاز است.');
    return amount;
  }

  private async post<T extends ZibalResponse>(url: string, body: Record<string, unknown>): Promise<T> {
    const timeout = Number(this.config.get<string>('ZIBAL_TIMEOUT_MS', '15000')) || 15000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const text = await response.text();
      let data: T;
      try { data = JSON.parse(text) as T; } catch { throw new Error(`Zibal returned invalid JSON (${response.status}).`); }
      if (!response.ok) throw new Error(`Zibal HTTP ${response.status}: ${data.message ?? 'request failed'}`);
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  async createPayment(userId: string, amountValue: string) {
    const amount = this.parseAmount(amountValue);
    const payment = await this.payments.save(this.payments.create({
      userId,
      orderId: randomUUID(),
      amount: amount.toString(),
      gatewayAmount: (amount * 10n).toString(),
      currency: 'IRT',
      status: 'PENDING',
    }));

    try {
      const result = await this.post<ZibalResponse>(REQUEST_URL, {
        merchant: this.merchant(),
        amount: Number(payment.gatewayAmount),
        callbackUrl: this.callbackUrl(),
        description: `Wallet deposit ${payment.id}`,
      });
      if (result.result !== 100 || result.trackId === undefined) {
        payment.status = 'FAILED';
        payment.gatewayResult = result.result == null ? null : String(result.result);
        payment.gatewayMessage = result.message ?? null;
        payment.failureReason = result.message ?? 'درخواست پرداخت از زیبال پذیرفته نشد.';
        await this.payments.save(payment);
        throw new BadRequestException(payment.failureReason);
      }
      payment.trackId = String(result.trackId);
      payment.gatewayResult = String(result.result);
      payment.gatewayMessage = result.message ?? null;
      await this.payments.save(payment);
      return { id: payment.id, trackId: payment.trackId, paymentUrl: `${START_URL}${payment.trackId}`, amount: payment.amount, currency: payment.currency };
    } catch (error) {
      if (payment.status === 'PENDING' && !payment.trackId) {
        payment.failureReason = error instanceof Error ? error.message : 'خطا در اتصال به زیبال';
        await this.payments.save(payment).catch(() => undefined);
      }
      throw error;
    }
  }

  async callback(trackIdValue?: string, orderId?: string) {
    const trackId = String(trackIdValue ?? '').trim();
    if (!trackId) throw new BadRequestException('trackId الزامی است.');
    const payment = await this.payments.findOne({ where: { trackId } });
    if (!payment && orderId) {
      const byOrder = await this.payments.findOne({ where: { orderId } });
      if (byOrder?.trackId === trackId) return this.verifyAndSettle(byOrder.id);
    }
    if (!payment) throw new NotFoundException('تراکنش زیبال پیدا نشد.');
    return this.verifyAndSettle(payment.id);
  }

  async verifyAndSettle(paymentId: string) {
    const payment = await this.payments.findOne({ where: { id: paymentId } });
    if (!payment?.trackId) throw new NotFoundException('تراکنش پرداخت پیدا نشد.');
    if (payment.status === 'SUCCESS') return { success: true, alreadyProcessed: true, payment };

    const result = await this.post<ZibalResponse>(VERIFY_URL, { merchant: this.merchant(), trackId: Number(payment.trackId) });
    const isSuccess = (result.result === 100 || result.result === 201) && result.status === 1;
    if (!isSuccess) {
      const stillPending = result.status === -1;
      await this.payments.update(payment.id, {
        status: stillPending ? 'PENDING' : 'FAILED',
        gatewayResult: result.result == null ? null : String(result.result),
        gatewayMessage: result.message ?? null,
        gatewaySnapshot: { ...result },
        failureReason: stillPending ? null : (result.message ?? 'پرداخت موفق نبود.'),
      });
      return { success: false, alreadyProcessed: false, payment: await this.payments.findOne({ where: { id: payment.id } }), gateway: result };
    }

    return this.settleSuccessfulPayment(payment.id, result);
  }

  private async settleSuccessfulPayment(paymentId: string, result: ZibalResponse) {
    const settled = await this.dataSource.transaction(async manager => {
      const locked = await manager.findOne(ZibalPayment, { where: { id: paymentId }, lock: { mode: 'pessimistic_write' } });
      if (!locked) throw new NotFoundException('تراکنش پرداخت پیدا نشد.');
      if (locked.status === 'SUCCESS') return { payment: locked, credited: false };
      if (!locked.trackId) throw new BadRequestException('شناسه تراکنش زیبال ثبت نشده است.');

      const verifiedAmount = result.amount == null ? null : BigInt(String(result.amount));
      if (verifiedAmount !== null && verifiedAmount !== BigInt(locked.gatewayAmount)) {
        locked.status = 'FAILED';
        locked.failureReason = 'مبلغ تراکنش زیبال با مبلغ سفارش یکسان نیست.';
        locked.gatewaySnapshot = { ...result };
        await manager.save(locked);
        throw new BadRequestException(locked.failureReason);
      }

      const wallet = await manager.findOne(Wallet, { where: { userId: locked.userId, currency: locked.currency }, lock: { mode: 'pessimistic_write' } });
      if (!wallet) throw new NotFoundException('کیف پول پیدا نشد.');
      const before = wallet.balance;
      await manager.query('UPDATE wallets SET balance = balance + $1, "updatedAt" = NOW() WHERE id = $2', [locked.amount, wallet.id]);
      const afterRow = await manager.findOneByOrFail(Wallet, { id: wallet.id });

      await manager.save(WalletTransaction, manager.create(WalletTransaction, {
        userId: locked.userId,
        walletId: wallet.id,
        type: 'DEPOSIT',
        amount: locked.amount,
        balanceBefore: before,
        balanceAfter: afterRow.balance,
        currency: locked.currency,
        referenceType: 'ZIBAL_PAYMENT',
        referenceId: locked.id,
        description: 'شارژ کیف پول از طریق زیبال',
      }));

      locked.status = 'SUCCESS';
      locked.gatewayResult = String(result.result ?? '100');
      locked.gatewayMessage = result.message ?? null;
      locked.refNumber = result.refNumber ?? null;
      locked.cardNumber = result.cardNumber ?? null;
      locked.paidAt = result.paidAt ? new Date(result.paidAt) : new Date();
      locked.gatewaySnapshot = { ...result };
      locked.failureReason = null;
      await manager.save(locked);
      return { payment: locked, credited: true };
    });

    if (settled.credited) {
      await this.notifications.create(settled.payment.userId, {
        type: 'DEPOSIT_SUCCESS',
        title: 'شارژ کیف پول موفق بود',
        message: `مبلغ ${settled.payment.amount} ${settled.payment.currency} با موفقیت به کیف پول شما اضافه شد.`,
        data: { paymentId: settled.payment.id, amount: settled.payment.amount, reference: settled.payment.refNumber },
      }).catch((error) => this.logger.warn(`deposit notification failed: ${String(error)}`));
    }
    return { success: true, alreadyProcessed: !settled.credited, payment: settled.payment };
  }

  async reconcilePending() {
    if (this.reconciling) return;
    this.reconciling = true;
    try {
      const rows = await this.payments.find({ where: { status: 'PENDING' }, order: { createdAt: 'ASC' }, take: 50 });
      for (const payment of rows) {
        if (!payment.trackId) continue;
        try { await this.verifyAndSettle(payment.id); }
        catch (error) { this.logger.warn(`Zibal reconciliation failed for ${payment.id}: ${String(error)}`); }
      }
    } finally {
      this.reconciling = false;
    }
  }
}
