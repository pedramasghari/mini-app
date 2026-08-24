import {
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
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
type ActiveNumberOrder = {
  id: string;
  smsOrderId: string;
  orderNumber: string;
  status: NumberOrderStatus;
  productId: string;
  phoneNumber: string | null;
  expiresAt: string | null;
  otpCode: string | null;
  otpMessage: string | null;
  smsRevision: number;
  canResend: boolean;
  canCancel: boolean;
  canReplace: boolean;
  resendAvailableAt: string | null;
  cancelAvailableAt: string | null;
  replaceAvailableAt: string | null;
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
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private orderNumber() {
    const time = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `NO-${time}-${random}`;
  }

  private async getOtpHistory(row: SmsCodeOrder, snapshot: SmsSnapshot) {
    const events = await this.webhookEvents.find({ where: { smsCodeOrderId: row.id }, order: { createdAt: 'ASC' } });
    const result: NumberOrderOtp[] = [];
    const seen = new Set<string>();
    for (const event of events) {
      const payload = (event.payload ?? {}) as Record<string, unknown>;
      const data = (payload.data ?? payload) as Record<string, unknown>;
      const code = String(data.code ?? data.otp ?? data.verification_code ?? '').trim();
      if (!code || seen.has(code)) continue;
      seen.add(code);
      result.push({ code, message: typeof data.message === 'string' ? data.message : null, revision: result.length + 1, receivedAt: event.createdAt as unknown as string });
    }
    if (snapshot.otpCode && !seen.has(snapshot.otpCode)) {
      result.push({ code: snapshot.otpCode, message: snapshot.otpMessage ?? null, revision: result.length + 1, receivedAt: new Date().toISOString() });
    }
    return result;
  }

  private deriveStatus(row: SmsCodeOrder, snapshot: SmsSnapshot, otpCodes: NumberOrderOtp[]): NumberOrderStatus {
    if (['CANCELED', 'CANCELLED'].includes(snapshot.status)) return 'CANCEL';
    if (snapshot.status === 'EXPIRED') return otpCodes.length ? 'SUCCESS' : 'EXPIRED';
    if (otpCodes.length || snapshot.otpCode) return 'VERIFY';
    if (['COMPLETED', 'SUCCESS'].includes(snapshot.status)) return 'SUCCESS';
    if (row.status === 'EXPIRED') return otpCodes.length ? 'SUCCESS' : 'EXPIRED';
    return 'IN_PROCESS';
  }

  async createOrUpdate(row: SmsCodeOrder, snapshot: SmsSnapshot): Promise<NumberOrder | null> {
    const product = await this.products.findOne({ where: { id: row.productId ?? '' } });
    if (!product || !row.serviceId || !row.productId) throw new NotFoundException('محصول سفارش شماره پیدا نشد.');

    let order = await this.numberOrders.findOne({ where: { smsCodeOrderId: row.id } });
    if (!order && (!row.providerOrderId || !snapshot.phoneNumber)) return null;

    const otpCodes = await this.getOtpHistory(row, snapshot);
    const status = this.deriveStatus(row, snapshot, otpCodes);
    if (!order) {
      order = this.numberOrders.create({
        orderNumber: this.orderNumber(), userId: row.userId, smsCodeOrderId: row.id,
        serviceId: row.serviceId, productId: row.productId, status,
        phoneNumber: snapshot.phoneNumber, amount: row.chargedAmount, currency: row.currency, metadata: {},
      });
    }
    order.status = status;
    order.phoneNumber = snapshot.phoneNumber ?? order.phoneNumber;
    order.metadata = {
      ...(order.metadata ?? {}), otpCodes, providerOrderId: row.providerOrderId,
      expiresAt: snapshot.expiresAt, lastOtpCode: snapshot.otpCode ?? otpCodes.at(-1)?.code ?? null,
      lastOtpMessage: snapshot.otpMessage ?? otpCodes.at(-1)?.message ?? null,
      smsRevision: snapshot.smsRevision ?? row.smsRevision,
    };
    return this.numberOrders.save(order);
  }

  private async syncRow(row: SmsCodeOrder) {
    try {
      return this.createOrUpdate(row, (await this.smsCode.get(row.userId, row.id)) as SmsSnapshot);
    } catch {
      return null;
    }
  }

  private async syncOpenOrders() {
    const rows = await this.smsOrders.find({
      where: { status: In(['CREATING', 'PROVIDER_PENDING', 'ACTIVE', 'OTP_RECEIVED', 'COMPLETED']) },
      order: { createdAt: 'ASC' }, take: 50,
    });
    for (const row of rows) await this.syncRow(row);
  }

  async ensureForSmsOrder(userId: string, smsOrderId: string) {
    const row = await this.smsOrders.findOne({ where: { id: smsOrderId, userId } });
    if (!row) throw new NotFoundException('سفارش شماره پیدا نشد.');
    return this.createOrUpdate(row, (await this.smsCode.get(userId, smsOrderId)) as SmsSnapshot);
  }

  /** Resolve the provider order by the actual phone number owned by this user. */
  async ensureForPhone(userId: string, phoneNumber: string) {
    const normalized = phoneNumber.trim();
    if (!normalized) throw new NotFoundException('شماره تلفن نامعتبر است.');

    const numberOrder = await this.numberOrders.findOne({
      where: { userId, phoneNumber: normalized, status: In(['IN_PROCESS', 'VERIFY']) },
      order: { createdAt: 'DESC' },
    });
    if (numberOrder) return numberOrder;

    const row = await this.smsOrders.findOne({
      where: { userId, phoneNumber: normalized },
      order: { createdAt: 'DESC' },
    });
    if (!row) throw new NotFoundException('سفارش شماره برای این شماره پیدا نشد.');

    const order = await this.createOrUpdate(row, (await this.smsCode.get(userId, row.id)) as SmsSnapshot);
    if (!order) throw new NotFoundException('سفارش شماره برای این شماره پیدا نشد.');
    return order;
  }

  async listMyOrders(userId: string) {
    const rows = await this.numberOrders.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 100 });
    const result: Array<NumberOrder & { product: { id: string; title: string; icon: string; currency: string } | null; otpCodes: NumberOrderOtp[]; transactions: WalletTransaction[] }> = [];
    for (const order of rows) {
      const product = await this.products.findOne({ where: { id: order.productId } });
      const transactions = await this.transactions.find({
        where: [
          { userId, referenceType: 'SMSCODE_ORDER', referenceId: order.smsCodeOrderId },
          { userId, referenceType: 'SMSCODE_ORDER_REFUND', referenceId: order.smsCodeOrderId },
          { userId, referenceType: 'NUMBER_ORDER', referenceId: order.id },
        ],
        order: { createdAt: 'DESC' },
      });
      for (const transaction of transactions) {
        if (transaction.referenceType !== 'NUMBER_ORDER' || transaction.referenceId !== order.id) {
          transaction.referenceType = 'NUMBER_ORDER'; transaction.referenceId = order.id;
          await this.transactions.save(transaction);
        }
      }
      result.push({ ...order, product: product ? { id: product.id, title: product.title, icon: product.icon, currency: product.currency } : null, otpCodes: order.metadata?.otpCodes ?? [], transactions });
    }
    return result;
  }

  async listActive(userId: string): Promise<ActiveNumberOrder[]> {
    const rows = await this.numberOrders.find({ where: { userId, status: In(['IN_PROCESS', 'VERIFY']) }, order: { createdAt: 'DESC' }, take: 20 });
    const result: ActiveNumberOrder[] = [];
    for (const order of rows) {
      const smsRow = await this.smsOrders.findOne({ where: { id: order.smsCodeOrderId, userId } });
      if (!smsRow) continue;
      const sms = (await this.smsCode.get(userId, order.smsCodeOrderId)) as SmsSnapshot;
      const current = await this.createOrUpdate(smsRow, sms);
      if (!current || !['IN_PROCESS', 'VERIFY'].includes(current.status)) continue;
      result.push({
        id: current.id, smsOrderId: order.smsCodeOrderId, orderNumber: current.orderNumber,
        status: current.status, productId: current.productId, phoneNumber: current.phoneNumber,
        expiresAt: current.metadata?.expiresAt ?? null, otpCode: current.metadata?.lastOtpCode ?? sms.otpCode ?? null,
        otpMessage: current.metadata?.lastOtpMessage ?? sms.otpMessage ?? null,
        smsRevision: current.metadata?.smsRevision ?? sms.smsRevision ?? 0,
        canResend: sms.canResend, canCancel: sms.canCancel, canReplace: sms.canReplace,
        resendAvailableAt: sms.resendAvailableAt ?? null, cancelAvailableAt: sms.cancelAvailableAt ?? null,
        replaceAvailableAt: sms.replaceAvailableAt ?? null, chargedAmount: current.amount, currency: current.currency,
        refunded: sms.refunded,
      });
    }
    return result;
  }
}
