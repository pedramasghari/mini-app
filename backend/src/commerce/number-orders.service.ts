import { Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Product, SmsCodeOrder, SmsCodeWebhookEvent, WalletTransaction } from './entities/commerce.entity';
import { NumberOrder, NumberOrderOtp, NumberOrderStatus } from './entities/number-order.entity';
import { SmsCodeService } from './smscode.service';

type SmsSnapshot = {
  id: string;
  providerOrderId: number | string | null;
  status: string;
  phoneNumber: string | null;
  expiresAt: string | null;
  canResend: boolean;
  canCancel: boolean;
  canReplace: boolean;
  resendAvailableAt?: string | null;
  cancelAvailableAt?: string | null;
  replaceAvailableAt?: string | null;
  otpCode?: string | null;
  otpMessage?: string | null;
  smsRevision?: number;
  chargedAmount: string;
  currency: string;
  refunded: boolean;
};

@Injectable()
export class NumberOrdersService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(NumberOrder) private readonly numberOrders: Repository<NumberOrder>,
    @InjectRepository(SmsCodeOrder) private readonly smsOrders: Repository<SmsCodeOrder>,
    @InjectRepository(SmsCodeWebhookEvent) private readonly webhookEvents: Repository<SmsCodeWebhookEvent>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(WalletTransaction) private readonly transactions: Repository<WalletTransaction>,
    private readonly smsCode: SmsCodeService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.syncOpenOrders(), 5_000);
    this.timer.unref?.();
    void this.syncOpenOrders();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private orderNumber() {
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(2, 14);
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `NO${stamp}${random}`;
  }

  private async getOtpHistory(row: SmsCodeOrder, snapshot?: SmsSnapshot): Promise<NumberOrderOtp[]> {
    if (!row.providerOrderId) return [];
    const events = await this.webhookEvents.find({ where: { providerOrderId: String(row.providerOrderId) }, order: { createdAt: 'ASC' } });
    const result: NumberOrderOtp[] = [];
    const seen = new Set<string>();
    const add = (code: unknown, message: unknown, revision: unknown, receivedAt: Date | string) => {
      const normalizedCode = typeof code === 'string' && code.trim() ? code.trim() : null;
      const normalizedMessage = typeof message === 'string' && message.trim() ? message.trim() : null;
      if (!normalizedCode && !normalizedMessage) return;
      const rev = Number(revision ?? 0);
      const key = `${rev}:${normalizedCode ?? ''}:${normalizedMessage ?? ''}`;
      if (seen.has(key)) return;
      seen.add(key);
      result.push({ code: normalizedCode, message: normalizedMessage, revision: Number.isFinite(rev) ? rev : 0, receivedAt: new Date(receivedAt).toISOString() });
    };
    for (const event of events) {
      const payload = event.payload as { data?: { otp_code?: unknown; otp_message?: unknown; sms_revision?: unknown } } | null;
      if (event.event === 'order.otp_received' || payload?.data?.otp_code || payload?.data?.otp_message) add(payload?.data?.otp_code, payload?.data?.otp_message, payload?.data?.sms_revision, event.createdAt);
    }
    if (snapshot?.otpCode || snapshot?.otpMessage) add(snapshot.otpCode, snapshot.otpMessage, snapshot.smsRevision, new Date());
    const providerWebhook = row.providerSnapshot?.webhook as { otp_code?: unknown; otp_message?: unknown; sms_revision?: unknown } | undefined;
    if (providerWebhook?.otp_code || providerWebhook?.otp_message) add(providerWebhook.otp_code, providerWebhook.otp_message, providerWebhook.sms_revision, new Date());
    return result.sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime());
  }

  private deriveStatus(row: SmsCodeOrder, snapshot: SmsSnapshot, otpCodes: NumberOrderOtp[]): NumberOrderStatus {
    const providerStatus = String(snapshot.status ?? row.status).toUpperCase();
    if (providerStatus === 'CANCELED' || providerStatus === 'CANCELLED') return 'CANCEL';
    const hasCode = otpCodes.length > 0;
    const expired = Boolean(snapshot.expiresAt && new Date(snapshot.expiresAt).getTime() <= Date.now());
    if (hasCode && (providerStatus === 'COMPLETED' || expired)) return 'SUCCESS';
    if (providerStatus === 'EXPIRED') return 'EXPIRED';
    if (hasCode || providerStatus === 'OTP_RECEIVED') return 'VERIFY';
    return 'IN_PROCESS';
  }

  private async createOrUpdate(row: SmsCodeOrder, snapshot: SmsSnapshot): Promise<NumberOrder | null> {
    const product = await this.products.findOne({ where: { id: row.productId ?? '' } });
    if (!product || !row.serviceId || !row.productId) throw new NotFoundException('محصول سفارش شماره پیدا نشد.');

    let order = await this.numberOrders.findOne({ where: { smsCodeOrderId: row.id } });
    // سفارش کاربر فقط وقتی ساخته می‌شود که Provider واقعاً شماره را تخصیص داده باشد.
    if (!order && (!row.providerOrderId || !snapshot.phoneNumber)) return null;

    const otpCodes = await this.getOtpHistory(row, snapshot);
    const status = this.deriveStatus(row, snapshot, otpCodes);

    if (!order) {
      order = this.numberOrders.create({
        orderNumber: this.orderNumber(),
        userId: row.userId,
        smsCodeOrderId: row.id,
        serviceId: row.serviceId,
        productId: row.productId,
        status,
        phoneNumber: snapshot.phoneNumber,
        amount: row.chargedAmount,
        currency: row.currency,
        metadata: {},
      });
    }

    order.status = status;
    order.phoneNumber = snapshot.phoneNumber ?? order.phoneNumber;
    order.metadata = {
      ...(order.metadata ?? {}),
      otpCodes,
      providerOrderId: row.providerOrderId,
      expiresAt: snapshot.expiresAt,
      lastOtpCode: snapshot.otpCode ?? otpCodes.at(-1)?.code ?? null,
      lastOtpMessage: snapshot.otpMessage ?? otpCodes.at(-1)?.message ?? null,
      smsRevision: snapshot.smsRevision ?? row.smsRevision,
    };
    return this.numberOrders.save(order);
  }

  private async syncRow(row: SmsCodeOrder) {
    try {
      const snapshot = await this.smsCode.get(row.userId, row.id) as SmsSnapshot;
      return this.createOrUpdate(row, snapshot);
    } catch {
      return null;
    }
  }

  private async syncOpenOrders() {
    const rows = await this.smsOrders.find({ where: { status: In(['CREATING', 'PROVIDER_PENDING', 'ACTIVE', 'OTP_RECEIVED', 'COMPLETED']) }, order: { createdAt: 'ASC' }, take: 50 });
    for (const row of rows) await this.syncRow(row);
  }

  async ensureForSmsOrder(userId: string, smsOrderId: string) {
    const row = await this.smsOrders.findOne({ where: { id: smsOrderId, userId } });
    if (!row) throw new NotFoundException('سفارش شماره پیدا نشد.');
    const snapshot = await this.smsCode.get(userId, smsOrderId) as SmsSnapshot;
    return this.createOrUpdate(row, snapshot);
  }

  async listMyOrders(userId: string) {
    let rows = await this.numberOrders.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 100 });
    for (const order of rows) {
      if (['IN_PROCESS', 'VERIFY'].includes(order.status)) {
        const smsRow = await this.smsOrders.findOne({ where: { id: order.smsCodeOrderId, userId } });
        if (smsRow) await this.syncRow(smsRow);
      }
    }
    rows = await this.numberOrders.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 100 });

    const result = [];
    for (const order of rows) {
      const product = await this.products.findOne({ where: { id: order.productId } });
      const transactions = await this.transactions.find({ where: { userId, referenceType: 'SMSCODE_ORDER', referenceId: order.smsCodeOrderId }, order: { createdAt: 'DESC' } });
      result.push({
        ...order,
        product: product ? { id: product.id, title: product.title, icon: product.icon, currency: product.currency } : null,
        otpCodes: order.metadata?.otpCodes ?? [],
        transactions,
      });
    }
    return result;
  }

  async listActive(userId: string) {
    const rows = await this.numberOrders.find({ where: { userId, status: In(['IN_PROCESS', 'VERIFY']) }, order: { createdAt: 'DESC' }, take: 20 });
    const result = [];
    for (const order of rows) {
      const smsRow = await this.smsOrders.findOne({ where: { id: order.smsCodeOrderId, userId } });
      if (!smsRow) continue;
      const sms = await this.smsCode.get(userId, order.smsCodeOrderId) as SmsSnapshot;
      const current = await this.createOrUpdate(smsRow, sms);
      if (!current || !['IN_PROCESS', 'VERIFY'].includes(current.status)) continue;
      result.push({
        id: smsRow.id,
        orderNumber: current.orderNumber,
        status: current.status,
        productId: current.productId,
        phoneNumber: current.phoneNumber,
        expiresAt: current.metadata?.expiresAt ?? null,
        otpCode: current.metadata?.lastOtpCode ?? sms.otpCode ?? null,
        otpMessage: current.metadata?.lastOtpMessage ?? sms.otpMessage ?? null,
        smsRevision: current.metadata?.smsRevision ?? sms.smsRevision ?? 0,
        canResend: sms.canResend,
        canCancel: sms.canCancel,
        canReplace: sms.canReplace,
        resendAvailableAt: sms.resendAvailableAt ?? null,
        cancelAvailableAt: sms.cancelAvailableAt ?? null,
        replaceAvailableAt: sms.replaceAvailableAt ?? null,
        chargedAmount: current.amount,
        currency: current.currency,
        refunded: sms.refunded,
      });
    }
    return result;
  }
}
