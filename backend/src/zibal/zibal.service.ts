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
const INQUIRY_URL = 'https://gateway.zibal.ir/v1/inquiry';
const START_URL = 'https://gateway.zibal.ir/start/';
const MIN_PROVIDER_RIAL = 1001n;
const PAYMENT_TTL_MS = 20 * 60 * 1000;
const RECONCILE_LOCK_KEY = 748291;
const ZIBAL_RESULT_TRANSACTION_FAILED = 202;
const VERIFY_RETRY_DELAY_MS = 1500;
const VERIFY_RETRY_COUNT = 2;

const ZIBAL_STATUS = {
  PENDING: -1,
  INTERNAL_ERROR: -2,
  PAID_CONFIRMED: 1,
  PAID_UNCONFIRMED: 2,
  CANCELED: 3,
  INVALID_CARD: 4,
  INSUFFICIENT_BALANCE: 5,
  WRONG_PASSWORD: 6,
  TOO_MANY_REQUESTS: 7,
  DAILY_PAYMENT_LIMIT: 8,
  DAILY_PAYMENT_AMOUNT_LIMIT: 9,
  INVALID_ISSUER: 10,
  SWITCH_ERROR: 11,
  CARD_UNAVAILABLE: 12,
  REFUNDED: 15,
  REFUNDING: 16,
  REVERSED: 18,
  INVALID_MERCHANT: 21,
} as const;

type ZibalResponse = {
  result?: number;
  message?: string;
  trackId?: number | string;
  status?: number;
  amount?: number | string;
  paidAt?: string;
  refNumber?: string;
  cardNumber?: string;
  [key: string]: unknown;
};

type PublicPaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';

@Injectable()
export class ZibalService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ZibalService.name);
  private reconciling = false;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(ZibalPayment) private readonly payments: Repository<ZibalPayment>,
    private readonly notifications: NotificationsService,
  ) {}

  private merchant() {
    const merchant = this.config.get<string>('ZIBAL_MERCHANT');
    if (!merchant) throw new BadRequestException('تنظیمات درگاه زیبال کامل نیست.');
    return merchant;
  }

  private callbackUrl() {
    const value = this.config.get<string>('ZIBAL_CALLBACK_URL');
    if (!value) throw new BadRequestException('آدرس callback زیبال تنظیم نشده است.');
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

  private async post<T>(url: string, body: Record<string, unknown>): Promise<T> {
    const timeout = Number(this.config.get<string>('ZIBAL_TIMEOUT_MS', '15000')) || 15000;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
      const text = await response.text();
      let data: unknown;
      try { data = JSON.parse(text); this.logger.log(`Zibal Response: ${JSON.stringify(data)}`); } catch { throw new BadRequestException('پاسخ نامعتبر از زیبال دریافت شد.'); }
      if (!response.ok) throw new BadRequestException((data as { message?: string })?.message ?? 'خطا در ارتباط با زیبال.');
      return data as T;
    } finally { clearTimeout(timeoutHandle); }
  }

  async createPayment(userId: string, amountValue: string) {
    const amount = this.parseAmount(amountValue);
    const existing = await this.payments.findOne({ where: { userId, status: 'PENDING' }, order: { createdAt: 'DESC' } });
    if (existing && existing.expiresAt && existing.expiresAt.getTime() > Date.now()) return { id: existing.id, ticketId: existing.id, trackId: existing.trackId, paymentUrl: existing.trackId ? `${START_URL}${existing.trackId}` : null, amount: existing.amount, currency: existing.currency, expiresAt: existing.expiresAt };
    if (existing) await this.expirePayment(existing.id);
    const payment = await this.payments.save(this.payments.create({ userId, orderId: randomUUID(), amount: amount.toString(), gatewayAmount: (amount * 10n).toString(), currency: 'IRT', status: 'PENDING', expiresAt: new Date(Date.now() + PAYMENT_TTL_MS) }));
    try {
      const result = await this.post<ZibalResponse>(REQUEST_URL, { merchant: this.merchant(), amount: Number(payment.gatewayAmount), callbackUrl: this.callbackUrl(), orderId: payment.orderId, description: `Wallet deposit ${payment.id}` });
      if (result.result !== 100 || result.trackId === undefined) {
        payment.status = 'FAILED'; payment.gatewayResult = result.result == null ? null : String(result.result); payment.gatewayMessage = result.message ?? null; payment.failureReason = result.message ?? 'درخواست پرداخت از زیبال پذیرفته نشد.'; payment.gatewaySnapshot = { ...result } as any; await this.payments.save(payment); throw new BadRequestException(payment.failureReason);
      }
      payment.trackId = String(result.trackId); payment.gatewayResult = String(result.result); payment.gatewayMessage = result.message ?? null; payment.gatewaySnapshot = { ...result } as any; await this.payments.save(payment);
      return { id: payment.id, ticketId: payment.id, trackId: payment.trackId, paymentUrl: `${START_URL}${payment.trackId}`, amount: payment.amount, currency: payment.currency, expiresAt: payment.expiresAt };
    } catch (error) {
      if (payment.status === 'PENDING' && !payment.trackId) { payment.status = 'FAILED'; payment.failureReason = error instanceof Error ? error.message : 'خطا در اتصال به زیبال'; await this.payments.save(payment).catch(() => undefined); }
      throw error;
    }
  }

  async request(userId: string, amount: string) { return this.createPayment(userId, amount); }

  async callback(trackIdValue?: string) {
    const trackId = String(trackIdValue ?? '').trim();
    if (!trackId) throw new BadRequestException('trackId الزامی است.');
    const payment = await this.payments.findOne({ where: { trackId } });
    if (!payment) throw new NotFoundException('تراکنش زیبال پیدا نشد.');
    return this.verifyAndSettle(payment.id);
  }

  async getPaymentStatus(userId: string, paymentId: string) {
    const identifier = String(paymentId ?? '').trim();
    if (!identifier) throw new BadRequestException('شناسه پرداخت الزامی است.');
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
    const payment = isUuid ? await this.payments.findOne({ where: { id: identifier, userId } }) : await this.payments.findOne({ where: { trackId: identifier, userId } });
    if (!payment) throw new NotFoundException('تراکنش پرداخت پیدا نشد.');
    if (payment.status === 'PENDING') {
      if (payment.expiresAt && payment.expiresAt.getTime() <= Date.now()) await this.expirePayment(payment.id);
      else if (payment.trackId) await this.verifyAndSettle(payment.id);
    }
    const latest = await this.payments.findOne({ where: { id: payment.id, userId } });
    if (!latest) throw new NotFoundException('تراکنش پرداخت پیدا نشد.');
    const snapshot = (latest.gatewaySnapshot ?? {}) as Record<string, unknown>;
    return { id: latest.id, ticketId: latest.id, trackId: latest.trackId, status: this.publicStatus(latest.status), amount: latest.amount, currency: latest.currency, expiresAt: latest.expiresAt, gateway: { result: latest.gatewayResult, status: typeof snapshot.status === 'number' ? snapshot.status : null, message: latest.gatewayMessage, refNumber: latest.refNumber, cardNumber: latest.cardNumber, paidAt: latest.paidAt } };
  }

  async getStatus(userId: string, paymentId: string) { return this.getPaymentStatus(userId, paymentId); }

  private publicStatus(value?: string): PublicPaymentStatus {
    if (value === 'SUCCESS') return 'SUCCESS';
    if (value === 'FAILED') return 'FAILED';
    if (value === 'EXPIRED') return 'EXPIRED';
    return 'PENDING';
  }

  private async expirePayment(paymentId: string) {
    await this.payments.createQueryBuilder().update(ZibalPayment).set({ status: 'EXPIRED', failureReason: 'مهلت ۲۰ دقیقه‌ای پرداخت به پایان رسید.' }).where('id = :id', { id: paymentId }).andWhere('status = :status', { status: 'PENDING' }).execute();
  }

  private async verifyWithRetry(trackId: string): Promise<ZibalResponse> {
    let result = await this.post<ZibalResponse>(VERIFY_URL, { merchant: this.merchant(), trackId: Number(trackId) });
    for (let attempt = 0; attempt < VERIFY_RETRY_COUNT && result.result === ZIBAL_RESULT_TRANSACTION_FAILED; attempt++) {
      await new Promise(resolve => setTimeout(resolve, VERIFY_RETRY_DELAY_MS));
      result = await this.post<ZibalResponse>(VERIFY_URL, { merchant: this.merchant(), trackId: Number(trackId) });
    }
    return result;
  }

  private async inquiry(trackId: string): Promise<ZibalResponse> {
    return this.post<ZibalResponse>(INQUIRY_URL, {
      merchant: this.merchant(),
      trackId: Number(trackId),
    });
  }

  private isInquiryTerminalFailure(status?: number) {
    return [
      ZIBAL_STATUS.INTERNAL_ERROR,
      ZIBAL_STATUS.CANCELED,
      ZIBAL_STATUS.INVALID_CARD,
      ZIBAL_STATUS.INSUFFICIENT_BALANCE,
      ZIBAL_STATUS.WRONG_PASSWORD,
      ZIBAL_STATUS.TOO_MANY_REQUESTS,
      ZIBAL_STATUS.DAILY_PAYMENT_LIMIT,
      ZIBAL_STATUS.DAILY_PAYMENT_AMOUNT_LIMIT,
      ZIBAL_STATUS.INVALID_ISSUER,
      ZIBAL_STATUS.SWITCH_ERROR,
      ZIBAL_STATUS.CARD_UNAVAILABLE,
      ZIBAL_STATUS.REFUNDED,
      ZIBAL_STATUS.REFUNDING,
      ZIBAL_STATUS.REVERSED,
      ZIBAL_STATUS.INVALID_MERCHANT,
    ].includes(status as any);
  }

  private async handle202Inquiry(paymentId: string, trackId: string) {
    const inquiryResult = await this.inquiry(trackId);
    const inquiryStatus = inquiryResult.status;

    this.logger.warn(`Zibal verify returned 202 for ${paymentId}; inquiry status=${String(inquiryStatus)}`);

    await this.payments.update(paymentId, {
      gatewayResult: inquiryResult.result == null ? String(ZIBAL_RESULT_TRANSACTION_FAILED) : String(inquiryResult.result),
      gatewayMessage: inquiryResult.message ?? null,
      gatewaySnapshot: { ...inquiryResult, inquiryStatus } as any,
    });

    // 1 = paid and confirmed. Only this state can credit the wallet.
    if (inquiryStatus === ZIBAL_STATUS.PAID_CONFIRMED) {
      return this.settleSuccessfulPayment(paymentId, inquiryResult);
    }

    // -1 = waiting for payment, 2 = paid but not confirmed yet.
    // Keep the local payment pending so reconciliation can inquire again.
    if (inquiryStatus === ZIBAL_STATUS.PENDING || inquiryStatus === ZIBAL_STATUS.PAID_UNCONFIRMED) {
      await this.payments.update(paymentId, {
        status: 'PENDING',
        failureReason: null,
        gatewaySnapshot: { ...inquiryResult, inquiryStatus } as any,
      });
      return {
        success: false,
        alreadyProcessed: false,
        payment: await this.payments.findOne({ where: { id: paymentId } }),
        gateway: inquiryResult,
      };
    }

    const failureReason = inquiryResult.message ?? `وضعیت تراکنش زیبال: ${String(inquiryStatus ?? 'نامشخص')}`;
    await this.payments.update(paymentId, {
      status: 'FAILED',
      failureReason,
      gatewaySnapshot: { ...inquiryResult, inquiryStatus } as any,
    });

    return {
      success: false,
      alreadyProcessed: false,
      payment: await this.payments.findOne({ where: { id: paymentId } }),
      gateway: inquiryResult,
    };
  }

  async verifyAndSettle(paymentId: string) {
    const payment = await this.payments.findOne({ where: { id: paymentId } });
    if (!payment?.trackId) throw new NotFoundException('تراکنش پرداخت پیدا نشد.');
    if (payment.status === 'SUCCESS') return { success: true, alreadyProcessed: true, payment };
    if (payment.status === 'EXPIRED' || payment.status === 'FAILED') return { success: false, alreadyProcessed: true, payment };
    if (payment.expiresAt && payment.expiresAt.getTime() <= Date.now()) { await this.expirePayment(payment.id); return { success: false, alreadyProcessed: true, payment: await this.payments.findOne({ where: { id: payment.id } }) }; }

    const result = await this.verifyWithRetry(payment.trackId);

    // 202 from verify is not enough to mark the payment failed. Ask Zibal
    // for the authoritative transaction state using the inquiry endpoint.
    if (result.result === ZIBAL_RESULT_TRANSACTION_FAILED) {
      return this.handle202Inquiry(payment.id, payment.trackId);
    }

    const isSuccess = (result.result === 100 || result.result === 201) && result.status === 1;

    if (!isSuccess) {
      const stillPending = result.status === -1;
      const failureReason = result.message ?? 'پرداخت موفق نبود.';
      await this.payments.update(payment.id, { status: stillPending ? 'PENDING' : 'FAILED', gatewayResult: result.result == null ? null : String(result.result), gatewayMessage: result.message ?? null, gatewaySnapshot: { ...result } as any, failureReason: stillPending ? null : failureReason });
      return { success: false, alreadyProcessed: false, payment: await this.payments.findOne({ where: { id: payment.id } }), gateway: result };
    }
    return this.settleSuccessfulPayment(payment.id, result);
  }

  private async settleSuccessfulPayment(paymentId: string, result: ZibalResponse) {
    const settled = await this.dataSource.transaction(async manager => {
      const locked = await manager.findOne(ZibalPayment, { where: { id: paymentId }, lock: { mode: 'pessimistic_write' } });
      if (!locked) throw new NotFoundException('تراکنش پرداخت پیدا نشد.');
      if (locked.status === 'SUCCESS' || locked.status === 'EXPIRED' || locked.status === 'FAILED') return { payment: locked, credited: false, wallet: null };
      if (!locked.trackId) throw new BadRequestException('شناسه تراکنش زیبال ثبت نشده است.');
      if (result.amount == null || !/^\d+$/.test(String(result.amount))) { locked.status = 'FAILED'; locked.failureReason = 'مبلغ تاییدشده توسط زیبال دریافت نشد.'; locked.gatewaySnapshot = { ...result } as any; await manager.save(locked); throw new BadRequestException(locked.failureReason); }
      if (BigInt(String(result.amount)) !== BigInt(locked.gatewayAmount)) { locked.status = 'FAILED'; locked.failureReason = 'مبلغ تراکنش زیبال با مبلغ سفارش یکسان نیست.'; locked.gatewaySnapshot = { ...result } as any; await manager.save(locked); throw new BadRequestException(locked.failureReason); }
      const wallet = await manager.findOne(Wallet, { where: { userId: locked.userId, currency: locked.currency }, lock: { mode: 'pessimistic_write' } });
      if (!wallet) throw new NotFoundException('کیف پول پیدا نشد.');
      const before = String(wallet.balance);
      const updateResult = await manager.createQueryBuilder().update(Wallet).set({ balance: () => '\"balance\" + CAST(:amount AS numeric)' }).setParameters({ amount: locked.amount }).where('id = :walletId', { walletId: wallet.id }).execute();
      if (updateResult.affected !== 1) throw new BadRequestException('خطا در به‌روزرسانی موجودی کیف پول.');
      const afterWallet = await manager.findOne(Wallet, { where: { id: wallet.id }, lock: { mode: 'pessimistic_read' } });
      if (!afterWallet) throw new NotFoundException('کیف پول پس از شارژ پیدا نشد.');
      const after = String(afterWallet.balance);
      await manager.save(WalletTransaction, manager.create(WalletTransaction, { userId: locked.userId, walletId: wallet.id, type: 'DEPOSIT', amount: locked.amount, balanceBefore: before, balanceAfter: after, currency: locked.currency, referenceType: 'ZIBAL_PAYMENT', referenceId: locked.id, description: 'شارژ کیف پول از طریق زیبال' }));
      locked.status = 'SUCCESS'; locked.gatewayResult = String(result.result ?? '100'); locked.gatewayMessage = result.message ?? null; locked.refNumber = result.refNumber ?? null; locked.cardNumber = result.cardNumber ?? null; locked.paidAt = result.paidAt ? new Date(result.paidAt) : new Date(); locked.gatewaySnapshot = { ...result } as any; locked.failureReason = null; await manager.save(locked);
      return { payment: locked, credited: true, wallet: { balance: after, currency: afterWallet.currency } };
    });
    if (settled.credited) await this.notifications.create(settled.payment.userId, { type: 'WALLET_DEPOSIT', title: 'شارژ کیف پول', message: `مبلغ ${settled.payment.amount} تومان با موفقیت به کیف پول شما اضافه شد.` }).catch(error => this.logger.warn(`Zibal notification failed: ${error instanceof Error ? error.message : String(error)}`));
    return { success: settled.credited || settled.payment.status === 'SUCCESS', alreadyProcessed: !settled.credited, payment: settled.payment, wallet: settled.wallet };
  }

  async reconcilePending() {
    if (this.reconciling) return;
    this.reconciling = true;
    try {
      const acquired = await this.dataSource.query('SELECT pg_try_advisory_lock($1) AS locked', [RECONCILE_LOCK_KEY]);
      if (!acquired?.[0]?.locked) return;
      try {
        const payments = await this.payments.createQueryBuilder('p').where('p.status = :status', { status: 'PENDING' }).andWhere('(p.\"expiresAt\" IS NULL OR p.\"expiresAt\" > NOW())').orderBy('p.createdAt', 'ASC').take(50).getMany();
        for (const payment of payments) {
          if (!payment.trackId) continue;
          try { await this.verifyAndSettle(payment.id); }
          catch (error) { this.logger.warn(`Zibal reconcile failed for ${payment.id}: ${error instanceof Error ? error.message : String(error)}`); }
        }
      } finally { await this.dataSource.query('SELECT pg_advisory_unlock($1)', [RECONCILE_LOCK_KEY]); }
    } finally { this.reconciling = false; }
  }

  onModuleInit() {
    if (this.config.get<string>('ZIBAL_ENABLED', 'true') !== 'false') { this.timer = setInterval(() => void this.reconcilePending(), 30_000); void this.reconcilePending(); }
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
}
