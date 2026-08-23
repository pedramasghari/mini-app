import { BadGatewayException, BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { Wallet } from '../wallets/entities/wallet.entity';
import { Product, Service, ServiceSmsConfig, SmsCodeOrder, SmsCodeWebhookEvent, WalletTransaction } from './entities/commerce.entity';

type ProviderMoney = number | string | { amount?: string; canonical_amount?: number; currency?: string };
type ProviderOrder = {
  id: number;
  status: string;
  phone_number?: string | null;
  expires_at?: string | null;
  can_resend?: boolean;
  can_cancel?: boolean;
  can_replace?: boolean;
  resend_available_at?: string | null;
  cancel_available_at?: string | null;
  replace_available_at?: string | null;
  otp_code?: string | null;
  otp_message?: string | null;
  sms_revision?: number;
  amount?: ProviderMoney;
  product_id?: number;
  catalog_product_id?: number;
  operator_id?: number | null;
  operator_name?: string | null;
  [key: string]: unknown;
};

type ProviderWebhook = {
  event: string;
  timestamp?: string;
  data?: {
    order_id?: number;
    phone_number?: string | null;
    otp_code?: string | null;
    otp_message?: string | null;
    sms_revision?: number;
    product_id?: number;
    catalog_product_id?: number;
    country?: string;
    platform?: string;
    [key: string]: unknown;
  };
};

class ProviderApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly statusCode: number) { super(message); }
}

@Injectable()
export class SmsCodeService implements OnModuleInit {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly webhookUrl: string;
  private webhookSecret = '';
  private readonly reconcileTimer: NodeJS.Timeout;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(SmsCodeOrder) private readonly orders: Repository<SmsCodeOrder>,
    @InjectRepository(SmsCodeWebhookEvent) private readonly webhookEvents: Repository<SmsCodeWebhookEvent>,
    @InjectRepository(ServiceSmsConfig) private readonly configs: Repository<ServiceSmsConfig>,
    @InjectRepository(Service) private readonly services: Repository<Service>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Wallet) private readonly wallets: Repository<Wallet>,
    @InjectRepository(WalletTransaction) private readonly transactions: Repository<WalletTransaction>,
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {
    const version = config.get<string>('SMSCODE_API_VERSION', 'v1');
    this.baseUrl = `https://api.smscode.gg/${version}`;
    this.token = config.get<string>('SMSCODE_API_TOKEN', '');
    this.webhookUrl = config.get<string>('SMSCODE_WEBHOOK_URL', '');
    this.reconcileTimer = setInterval(() => void this.reconcilePending(), 15_000);
    this.reconcileTimer.unref?.();
  }

  async onModuleInit() {
    if (!this.token || !this.webhookUrl) return;
    try {
      const configured = await this.request<{ webhook_url: string; webhook_secret?: string }>('/webhook', { method: 'PATCH', body: JSON.stringify({ webhook_url: this.webhookUrl }) });
      this.webhookSecret = configured.webhook_secret ?? '';
    } catch (error) {
      console.error('[SMSCode] webhook configuration failed:', error instanceof Error ? error.message : error);
    }
  }

  private assertConfigured() {
    if (!this.token) throw new ServiceUnavailableException('SMSCode هنوز در سرور پیکربندی نشده است.');
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    this.assertConfigured();
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: AbortSignal.timeout(15_000),
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
      });
    } catch (error) {
      throw new ProviderApiError('NETWORK_ERROR', error instanceof Error ? error.message : 'SMSCode network error', 0);
    }
    const body = await response.json().catch(() => null) as { success?: boolean; data?: T; error?: { message?: string; code?: string } } | null;
    if (!response.ok || !body?.success) {
      throw new ProviderApiError(body?.error?.code ?? `HTTP_${response.status}`, body?.error?.message ?? 'SMSCode request failed', response.status);
    }
    return body.data as T;
  }

  private providerAmount(value: ProviderMoney | undefined) {
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return value;
    if (value?.canonical_amount !== undefined) return String(value.canonical_amount);
    return value?.amount ?? null;
  }

  private async loadConfig(serviceId: string) {
    const config = await this.configs.findOne({ where: { serviceId } });
    if (!config?.enabled) throw new ServiceUnavailableException('خرید شماره برای این سرویس فعلاً فعال نیست.');
    if (!config.catalogProductId) throw new ServiceUnavailableException('تنظیمات محصول SMSCode این سرویس کامل نشده است.');
    return config;
  }

  private snapshot(row: SmsCodeOrder, provider: ProviderOrder) {
    return {
      id: row.id,
      providerOrderId: provider.id,
      status: provider.status,
      phoneNumber: provider.phone_number ?? row.phoneNumber,
      expiresAt: provider.expires_at ?? row.expiresAt?.toISOString() ?? null,
      canResend: Boolean(provider.can_resend),
      canCancel: Boolean(provider.can_cancel),
      canReplace: Boolean(provider.can_replace),
      resendAvailableAt: provider.resend_available_at ?? null,
      cancelAvailableAt: provider.cancel_available_at ?? null,
      replaceAvailableAt: provider.replace_available_at ?? null,
      otpCode: provider.otp_code ?? null,
      otpMessage: provider.otp_message ?? null,
      smsRevision: provider.sms_revision ?? row.smsRevision,
      chargedAmount: row.chargedAmount,
      currency: row.currency,
      refunded: Boolean(row.refundedAt),
    };
  }

  private async applyProviderState(row: SmsCodeOrder, provider: ProviderOrder) {
    row.providerOrderId = String(provider.id);
    row.status = provider.status;
    row.phoneNumber = provider.phone_number ?? row.phoneNumber;
    row.expiresAt = provider.expires_at ? new Date(provider.expires_at) : null;
    row.resendAvailableAt = provider.resend_available_at ? new Date(provider.resend_available_at) : null;
    row.cancelAvailableAt = provider.cancel_available_at ? new Date(provider.cancel_available_at) : null;
    row.replaceAvailableAt = provider.replace_available_at ? new Date(provider.replace_available_at) : null;
    row.canResend = Boolean(provider.can_resend);
    row.canCancel = Boolean(provider.can_cancel);
    row.canReplace = Boolean(provider.can_replace);
    row.smsRevision = Math.max(row.smsRevision, Number(provider.sms_revision ?? 0));
    row.providerAmount = this.providerAmount(provider.amount);
    row.providerSnapshot = provider;
    await this.orders.save(row);
    if (provider.status === 'CANCELED' || provider.status === 'EXPIRED') await this.refundIfNeeded(row, provider.status === 'EXPIRED' ? 'PROVIDER_EXPIRED' : 'PROVIDER_CANCELED');
    return this.snapshot(row, provider);
  }

  private async reserveLocalOrder(userId: string, serviceId: string, product: Product) {
    const idempotencyKey = randomUUID();
    try {
      return await this.dataSource.transaction(async manager => {
        const wallet = await manager.findOne(Wallet, { where: { userId }, lock: { mode: 'pessimistic_write' } });
        if (!wallet) throw new NotFoundException('کیف پول پیدا نشد.');
        if (wallet.currency !== product.currency) throw new BadRequestException(`واحد پول کیف پول (${wallet.currency}) با قیمت سرویس (${product.currency}) یکسان نیست.`);
        const price = Number(product.price);
        const balance = Number(wallet.balance);
        if (!Number.isFinite(price) || price <= 0) throw new BadRequestException('قیمت محصول معتبر نیست.');
        if (balance < price) throw new BadRequestException('موجودی کیف پول کافی نیست.');
        wallet.balance = (balance - price).toFixed(8);
        const order = manager.create(SmsCodeOrder, {
          userId,
          serviceId,
          productId: product.id,
          providerOrderId: null,
          status: 'CREATING',
          idempotencyKey,
          chargedAmount: product.price,
          currency: product.currency,
          providerAmount: null,
          phoneNumber: null,
          expiresAt: null,
          resendAvailableAt: null,
          cancelAvailableAt: null,
          replaceAvailableAt: null,
          canResend: false,
          canCancel: false,
          canReplace: false,
          smsRevision: 0,
          refundedAt: null,
          refundedAmount: null,
          refundReason: null,
          providerSnapshot: {},
        });
        const saved = await manager.save(order);
        await manager.save(wallet);
        await manager.save(WalletTransaction, manager.create(WalletTransaction, {
          userId,
          walletId: wallet.id,
          type: 'SMSCODE_ORDER_DEBIT',
          amount: `-${price.toFixed(8)}`,
          balanceBefore: balance.toFixed(8),
          balanceAfter: wallet.balance,
          currency: wallet.currency,
          referenceType: 'SMSCODE_ORDER',
          referenceId: saved.id,
          description: `رزرو شماره برای ${product.title}`,
        }));
        return saved;
      });
    } catch (error) {
      if (error instanceof QueryFailedError && (error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code === '23505') {
        throw new ConflictException('برای این کاربر یک سفارش شماره فعال وجود دارد. ابتدا همان سفارش را مدیریت کنید.');
      }
      throw error;
    }
  }

  async create(userId: string, productId: string) {
    if (!productId) throw new BadRequestException('productId الزامی است.');
    const product = await this.products.findOne({ where: { id: productId, active: true } });
    if (!product) throw new NotFoundException('محصول پیدا نشد.');
    const service = await this.services.findOne({ where: { id: product.serviceId, active: true } });
    if (!service) throw new NotFoundException('سرویس پیدا نشد.');
    const config = await this.loadConfig(service.id);

    const existing = await this.orders.findOne({ where: { userId }, order: { createdAt: 'DESC' } });
    if (existing && ['CREATING', 'PROVIDER_PENDING', 'ACTIVE', 'OTP_RECEIVED'].includes(existing.status)) return this.sync(existing);

    const row = await this.reserveLocalOrder(userId, service.id, product);
    const payload: Record<string, unknown> = { catalog_product_id: config.catalogProductId, quantity: 1 };
    if (config.operatorId !== null) payload.operator_id = config.operatorId;
    if (config.minProviderPrice !== null) payload.min_price = config.minProviderPrice;
    if (config.maxProviderPrice !== null) payload.max_price = config.maxProviderPrice;
    if (config.policy) payload.policy = config.policy;
    if (config.preferredProvider) payload.prefer_provider = config.preferredProvider;

    try {
      const data = await this.createProviderWithSameKey(payload, row.idempotencyKey);
      const provider = data.orders?.[0];
      if (!provider) throw new ProviderApiError('EMPTY_RESPONSE', 'SMSCode سفارش را برنگرداند.', 502);
      await this.applyProviderState(row, provider);
      await this.notifications.create(userId, { type: 'SMS_ORDER_CREATED', title: 'شماره با موفقیت دریافت شد', message: `شماره ${provider.phone_number ?? ''} برای شما فعال شد.`, data: { orderId: row.id, providerOrderId: provider.id, status: provider.status } });
      return this.snapshot(row, provider);
    } catch (error) {
      if (error instanceof ProviderApiError && this.isDefinitiveNoSideEffect(error.code, error.statusCode)) {
        await this.refundIfNeeded(row, `PROVIDER_${error.code}`);
        throw new BadGatewayException(this.publicProviderError(error));
      }
      row.status = 'PROVIDER_PENDING';
      row.providerSnapshot = { error: error instanceof Error ? error.message : String(error), pendingSince: new Date().toISOString(), payload };
      await this.orders.save(row);
      throw new ServiceUnavailableException('پاسخ سرویس شماره‌گذاری قطعی دریافت نشد؛ سفارش در حال بررسی است و برای جلوگیری از کسر دوباره، دوباره خرید انجام نخواهد شد.');
    }
  }

  private async createProviderWithSameKey(payload: Record<string, unknown>, key: string) {
    let last: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try { return await this.request<{ orders: ProviderOrder[] }>('/orders/create', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(payload) }); }
      catch (error) {
        last = error;
        if (!(error instanceof ProviderApiError) || error.statusCode === 0 || error.statusCode >= 500 || error.code === 'REQUEST_IN_PROGRESS') {
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
          continue;
        }
        throw error;
      }
    }
    throw last instanceof Error ? last : new ProviderApiError('NETWORK_ERROR', 'SMSCode request timed out.', 0);
  }

  private isDefinitiveNoSideEffect(code: string, status: number) {
    return ['INSUFFICIENT_BALANCE', 'NO_OFFER_AVAILABLE', 'VALIDATION_ERROR', 'FORBIDDEN', 'UNAUTHORIZED'].includes(code) || (status >= 400 && status < 500 && !['REQUEST_IN_PROGRESS', 'CONFLICT'].includes(code));
  }

  private publicProviderError(error: ProviderApiError) {
    if (error.code === 'NO_OFFER_AVAILABLE') return 'در حال حاضر شماره‌ای با فیلتر کشور و قیمت انتخاب‌شده موجود نیست.';
    if (error.code === 'INSUFFICIENT_BALANCE') return 'موجودی سرویس شماره‌گذاری کافی نیست. لطفاً بعداً دوباره تلاش کنید.';
    return error.message;
  }

  async get(userId: string, localId: string) {
    const row = await this.orders.findOne({ where: { id: localId, userId } });
    if (!row) throw new NotFoundException('سفارش شماره پیدا نشد.');
    return this.sync(row);
  }

  private async sync(row: SmsCodeOrder) {
    if (!row.providerOrderId) return { id: row.id, status: row.status, phoneNumber: row.phoneNumber, expiresAt: null, canResend: false, canCancel: false, canReplace: false, refunded: Boolean(row.refundedAt), chargedAmount: row.chargedAmount, currency: row.currency };
    try {
      const provider = await this.request<ProviderOrder>(`/orders/${row.providerOrderId}`);
      return this.applyProviderState(row, provider);
    } catch (error) {
      if (error instanceof ProviderApiError && error.statusCode === 404) {
        return this.snapshot(row, row.providerSnapshot as ProviderOrder);
      }
      throw error;
    }
  }

  async cancel(userId: string, localId: string) {
    const row = await this.getOwned(userId, localId);
    if (!row.providerOrderId) throw new BadRequestException('سفارش هنوز شماره‌ای از سرویس دریافت نکرده است.');
    const current = await this.request<ProviderOrder>(`/orders/${row.providerOrderId}`);
    if (!current.can_cancel) throw new BadRequestException('لغو هنوز از طرف سرویس شماره‌گذاری مجاز نیست.');
    await this.request('/orders/cancel', { method: 'POST', body: JSON.stringify({ id: Number(row.providerOrderId) }) });
    return this.sync(row);
  }

  async resend(userId: string, localId: string) {
    const row = await this.getOwned(userId, localId);
    if (!row.providerOrderId) throw new BadRequestException('سفارش هنوز فعال نشده است.');
    const current = await this.request<ProviderOrder>(`/orders/${row.providerOrderId}`);
    if (!current.can_resend) throw new BadRequestException('ارسال مجدد هنوز مجاز نیست.');
    await this.request('/orders/resend', { method: 'POST', body: JSON.stringify({ id: Number(row.providerOrderId) }) });
    return this.sync(row);
  }

  private async getOwned(userId: string, localId: string) {
    const row = await this.orders.findOne({ where: { id: localId, userId } });
    if (!row) throw new NotFoundException('سفارش شماره پیدا نشد.');
    return row;
  }

  async refundIfNeeded(row: SmsCodeOrder, reason: string) {
    if (row.refundedAt) return;
    await this.dataSource.transaction(async manager => {
      const locked = await manager.findOne(SmsCodeOrder, { where: { id: row.id }, lock: { mode: 'pessimistic_write' } });
      if (!locked || locked.refundedAt) return;
      const wallet = await manager.findOne(Wallet, { where: { userId: locked.userId }, lock: { mode: 'pessimistic_write' } });
      if (!wallet) throw new NotFoundException('کیف پول برای بازگشت وجه پیدا نشد.');
      const before = Number(wallet.balance);
      const amount = Number(locked.chargedAmount);
      if (wallet.currency !== locked.currency) throw new BadRequestException('واحد پول کیف پول با سفارش یکسان نیست.');
      wallet.balance = (before + amount).toFixed(8);
      locked.refundedAt = new Date();
      locked.refundedAmount = locked.chargedAmount;
      locked.refundReason = reason;
      await manager.save(wallet);
      await manager.save(locked);
      await manager.save(WalletTransaction, manager.create(WalletTransaction, {
        userId: locked.userId,
        walletId: wallet.id,
        type: 'SMSCODE_ORDER_REFUND',
        amount: amount.toFixed(8),
        balanceBefore: before.toFixed(8),
        balanceAfter: wallet.balance,
        currency: wallet.currency,
        referenceType: 'SMSCODE_ORDER_REFUND',
        referenceId: locked.id,
        description: `بازگشت وجه سفارش شماره: ${reason}`,
      }));
    });
    await this.notifications.create(row.userId, { type: 'SMS_ORDER_REFUNDED', title: 'وجه سفارش برگشت داده شد', message: `مبلغ ${row.chargedAmount} ${row.currency} بابت لغو/انقضای شماره به کیف پول شما برگشت داده شد.`, data: { orderId: row.id, amount: row.chargedAmount, currency: row.currency, reason } });
  }

  async handleWebhook(rawBody: Buffer, signature: string | undefined, payload: ProviderWebhook) {
    if (!this.webhookSecret) {
      const current = await this.request<{ webhook_url: string; webhook_secret?: string }>('/webhook');
      this.webhookSecret = current.webhook_secret ?? '';
    }
    if (!this.webhookSecret || !signature) throw new BadRequestException('Webhook signature is missing.');
    const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    const received = signature.replace(/^sha256=/i, '').trim();
    const expectedBuffer = Buffer.from(expected, 'hex');
    const receivedBuffer = Buffer.from(received, 'hex');
    if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) throw new BadRequestException('Webhook signature is invalid.');

    const event = payload.event;
    const providerOrderId = Number(payload.data?.order_id);
    if (!event || !Number.isInteger(providerOrderId)) throw new BadRequestException('Webhook payload is invalid.');
    const revision = Number(payload.data?.sms_revision ?? 0);
    const eventKey = `${event}:${providerOrderId}:${event === 'order.otp_received' ? revision : 0}`;

    try {
      await this.webhookEvents.insert(this.webhookEvents.create({ eventKey, event, providerOrderId: String(providerOrderId), payload: payload as unknown as Record<string, unknown>, processedAt: null, processingError: null }));
    } catch (error) {
      if (error instanceof QueryFailedError && (error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code === '23505') return { ok: true, duplicate: true };
      throw error;
    }

    const row = await this.orders.findOne({ where: { providerOrderId: String(providerOrderId) } });
    if (!row) return { ok: true, ignored: true };

    if (event === 'order.otp_received') {
      if (revision >= row.smsRevision) {
        row.status = 'OTP_RECEIVED';
        row.phoneNumber = payload.data?.phone_number ?? row.phoneNumber;
        row.smsRevision = revision;
        row.providerSnapshot = { ...(row.providerSnapshot ?? {}), webhook: payload.data };
        await this.orders.save(row);
        await this.notifications.create(row.userId, { type: 'SMS_ORDER_OTP_RECEIVED', title: 'کد تأیید دریافت شد', message: payload.data?.otp_code ? `کد تأیید شما: ${payload.data.otp_code}` : 'پیامک تأیید دریافت شد؛ کد شناسایی‌شده‌ای در پیام وجود نداشت.', data: { orderId: row.id, providerOrderId, phoneNumber: row.phoneNumber, otpCode: payload.data?.otp_code ?? null, otpMessage: payload.data?.otp_message ?? null, smsRevision: revision } });
      }
    } else if (event === 'order.completed') {
      if (!['CANCELED', 'EXPIRED'].includes(row.status)) row.status = 'COMPLETED';
      await this.orders.save(row);
      await this.notifications.create(row.userId, { type: 'SMS_ORDER_COMPLETED', title: 'سفارش شماره تکمیل شد', message: 'سفارش شماره شما با موفقیت تکمیل شد.', data: { orderId: row.id, providerOrderId } });
    } else if (event === 'order.expired' || event === 'order.canceled') {
      row.status = event === 'order.expired' ? 'EXPIRED' : 'CANCELED';
      await this.orders.save(row);
      await this.refundIfNeeded(row, event === 'order.expired' ? 'PROVIDER_EXPIRED' : 'PROVIDER_CANCELED');
      await this.notifications.create(row.userId, { type: event === 'order.expired' ? 'SMS_ORDER_EXPIRED' : 'SMS_ORDER_CANCELED', title: event === 'order.expired' ? 'سفارش منقضی شد' : 'سفارش لغو شد', message: 'مبلغ سفارش طبق وضعیت سرویس شماره‌گذاری به کیف پول شما بازگردانده شد.', data: { orderId: row.id, providerOrderId, refunded: true } });
    }

    await this.webhookEvents.update({ eventKey }, { processedAt: new Date() });
    return { ok: true };
  }

  async catalogCountries() { return this.request<unknown[]>('/catalog/countries'); }
  async catalogServices(countryId?: number) { return this.request<unknown[]>(`/catalog/services${countryId ? `?country_id=${countryId}` : ''}`); }
  async catalogOperators(countryId: number, platformId: number) { return this.request<unknown[]>(`/catalog/operators?country_id=${countryId}&platform_id=${platformId}`); }
  async catalogProducts(params: { countryId?: number; platformId?: number; operatorId?: number; sort?: string; page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params.countryId) query.set('country_id', String(params.countryId));
    if (params.platformId) query.set('platform_id', String(params.platformId));
    if (params.operatorId !== undefined) query.set('operator_id', String(params.operatorId));
    query.set('sort', params.sort ?? 'price_asc');
    query.set('page', String(params.page ?? 1));
    query.set('limit', String(Math.min(params.limit ?? 100, 1000)));
    return this.request<unknown>(`/catalog/products?${query.toString()}`);
  }

  async getServiceConfig(serviceId: string) {
    await this.services.findOneOrFail({ where: { id: serviceId } });
    return this.configs.findOne({ where: { serviceId } });
  }

  async saveServiceConfig(serviceId: string, input: Partial<ServiceSmsConfig>) {
    const service = await this.services.findOne({ where: { id: serviceId } });
    if (!service) throw new NotFoundException('سرویس پیدا نشد.');
    if (input.minProviderPrice !== undefined && input.minProviderPrice !== null && Number(input.minProviderPrice) < 0) throw new BadRequestException('حداقل قیمت معتبر نیست.');
    if (input.maxProviderPrice !== undefined && input.maxProviderPrice !== null && Number(input.maxProviderPrice) < 0) throw new BadRequestException('حداکثر قیمت معتبر نیست.');
    if (input.minProviderPrice != null && input.maxProviderPrice != null && Number(input.minProviderPrice) > Number(input.maxProviderPrice)) throw new BadRequestException('حداقل قیمت نمی‌تواند بیشتر از حداکثر قیمت باشد.');
    let row = await this.configs.findOne({ where: { serviceId } });
    if (!row) row = this.configs.create({ serviceId });
    Object.assign(row, input);
    return this.configs.save(row);
  }

  async configureWebhook(url?: string) {
    const target = url ?? this.webhookUrl;
    if (!target) throw new BadRequestException('SMSCODE_WEBHOOK_URL تنظیم نشده است.');
    if (!/^https:\/\//i.test(target)) throw new BadRequestException('آدرس Webhook باید HTTPS باشد.');
    const data = await this.request<{ webhook_url: string; webhook_secret?: string }>('/webhook', { method: 'PATCH', body: JSON.stringify({ webhook_url: target }) });
    this.webhookSecret = data.webhook_secret ?? this.webhookSecret;
    return { webhookUrl: data.webhook_url, configured: true, secretConfigured: Boolean(this.webhookSecret) };
  }

  async webhookStatus() { return this.request<{ webhook_url: string; webhook_secret?: string }>('/webhook'); }

  private async reconcilePending() {
    if (!this.token) return;
    const pending = await this.orders.find({ where: { status: 'PROVIDER_PENDING' }, order: { createdAt: 'ASC' }, take: 10 });
    for (const row of pending) {
      if (Date.now() - row.createdAt.getTime() > 10 * 60_000) continue;
      const payload = (row.providerSnapshot?.payload ?? {}) as Record<string, unknown>;
      try {
        const data = await this.createProviderWithSameKey(payload, row.idempotencyKey);
        const provider = data.orders?.[0];
        if (provider) await this.applyProviderState(row, provider);
      } catch (error) {
        if (error instanceof ProviderApiError && this.isDefinitiveNoSideEffect(error.code, error.statusCode)) await this.refundIfNeeded(row, `RECONCILE_${error.code}`);
      }
    }
  }
}
