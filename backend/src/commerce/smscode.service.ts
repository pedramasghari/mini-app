import { BadGatewayException, BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { Wallet } from '../wallets/entities/wallet.entity';
import { Product, Service, ServiceSmsConfig, SmsCodeOrder, SmsCodeWebhookEvent, WalletTransaction } from './entities/commerce.entity';

type ProviderMoney = number | string | { amount?: string; canonical_amount?: number; currency?: string };
type ProviderOrder = { id: number; status: string; phone_number?: string | null; expires_at?: string | null; can_resend?: boolean; can_cancel?: boolean; can_replace?: boolean; resend_available_at?: string | null; cancel_available_at?: string | null; replace_available_at?: string | null; otp_code?: string | null; otp_message?: string | null; sms_revision?: number; amount?: ProviderMoney; product_id?: number; catalog_product_id?: number; operator_id?: number | null; operator_name?: string | null; [key: string]: unknown };
type ProviderWebhook = { event: string; timestamp?: string; data?: { order_id?: number; phone_number?: string | null; otp_code?: string | null; otp_message?: string | null; sms_revision?: number; product_id?: number; catalog_product_id?: number; country?: string; platform?: string; [key: string]: unknown } };

class ProviderApiError extends Error { constructor(public readonly code: string, message: string, public readonly statusCode: number) { super(message); } }

@Injectable()
export class SmsCodeService implements OnModuleInit {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly webhookUrl: string;
  private webhookSecret: string;
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
    this.webhookSecret = config.get<string>('SMSCODE_WEBHOOK_SECRET', '');
    this.reconcileTimer = setInterval(() => void this.reconcilePending(), 15_000);
    this.reconcileTimer.unref?.();
  }

  async onModuleInit() {
    if (!this.token) return;
    if (this.webhookUrl) {
      try {
        const configured = await this.request<{ webhook_url: string; webhook_secret?: string }>('/webhook', { method: 'PATCH', body: JSON.stringify({ webhook_url: this.webhookUrl }) });
        if (configured.webhook_secret) this.webhookSecret = configured.webhook_secret;
        if (!this.webhookSecret) console.warn('[SMSCode] Webhook secret is not configured. Set SMSCODE_WEBHOOK_SECRET to the secret shown by SMSCode.');
      } catch (error) { console.error('[SMSCode] webhook configuration failed:', error instanceof Error ? error.message : error); }
    }
    await this.ensureAppleUkConfig();
  }

  async getBalance() {
    const data = await this.request<{ balance: string | number; currency: string }>('/balance');
    return { balance: String(data.balance), currency: data.currency };
  }

  private async ensureAppleUkConfig() {
    const service = await this.services.findOne({ where: { slug: 'apple-id' } });
    if (!service || await this.configs.findOne({ where: { serviceId: service.id, enabled: true } })) return;
    try {
      const countries = await this.catalogCountries() as Array<{ id: number; code: string; name: string; active: boolean }>;
      const uk = countries.find(country => country.active && ['GB', 'UK'].includes(country.code.toUpperCase()));
      if (!uk) return;
      const platforms = await this.catalogServices(uk.id) as Array<{ id: number; code: string; name: string; active: boolean }>;
      const apple = platforms.find(platform => platform.active && platform.code.toLowerCase() === 'apple') ?? platforms.find(platform => platform.active && platform.name.toLowerCase().includes('apple'));
      if (!apple) return;
      const result = await this.catalogProducts({ countryId: uk.id, platformId: apple.id, sort: 'price_asc', page: 1, limit: 100 });
      const list = Array.isArray(result) ? result as Array<Record<string, unknown>> : ((result as { data?: Array<Record<string, unknown>> }).data ?? []);
      const available = list.filter(item => item.active !== false && Number(item.available ?? 0) > 0);
      const cheapest = available.sort((a, b) => Number(a.price ?? Number.MAX_SAFE_INTEGER) - Number(b.price ?? Number.MAX_SAFE_INTEGER))[0];
      if (!cheapest) return;
      const row = this.configs.create({ serviceId: service.id, enabled: true, countryId: uk.id, countryCode: uk.code, countryName: uk.name, platformId: apple.id, platformCode: apple.code, platformName: apple.name, catalogProductId: Number(cheapest.catalog_product_id), operatorId: null, minProviderPrice: null, maxProviderPrice: null, policy: 'cheapest', preferredProvider: null });
      await this.configs.save(row);
      console.log(`[SMSCode] Apple routing initialized: ${uk.code} / ${apple.code} / catalog ${row.catalogProductId}`);
    } catch (error) { console.error('[SMSCode] Apple UK auto-config failed:', error instanceof Error ? error.message : error); }
  }

  private assertConfigured() { if (!this.token) throw new ServiceUnavailableException('SMSCode هنوز در سرور پیکربندی نشده است.'); }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    this.assertConfigured();
    let response: Response;
    try { response = await fetch(`${this.baseUrl}${path}`, { ...init, signal: AbortSignal.timeout(15_000), headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } }); }
    catch (error) { throw new ProviderApiError('NETWORK_ERROR', error instanceof Error ? error.message : 'SMSCode network error', 0); }
    const body = await response.json().catch(() => null) as { success?: boolean; data?: T; error?: { message?: string; code?: string } } | null;
    if (!response.ok || !body?.success) throw new ProviderApiError(body?.error?.code ?? `HTTP_${response.status}`, body?.error?.message ?? 'SMSCode request failed', response.status);
    return body.data as T;
  }

  private providerAmount(value: ProviderMoney | undefined) { if (typeof value === 'number') return String(value); if (typeof value === 'string') return value; if (value?.canonical_amount !== undefined) return String(value.canonical_amount); return value?.amount ?? null; }
  private async loadConfig(serviceId: string) { const config = await this.configs.findOne({ where: { serviceId } }); if (!config?.enabled) throw new ServiceUnavailableException('خرید شماره برای این سرویس فعلاً فعال نیست.'); if (!config.catalogProductId) throw new ServiceUnavailableException('تنظیمات محصول SMSCode این سرویس کامل نشده است.'); return config; }
  private snapshot(row: SmsCodeOrder, provider: ProviderOrder) { return { id: row.id, providerOrderId: provider.id, status: provider.status, phoneNumber: provider.phone_number ?? row.phoneNumber, expiresAt: provider.expires_at ?? row.expiresAt?.toISOString() ?? null, canResend: Boolean(provider.can_resend), canCancel: Boolean(provider.can_cancel), canReplace: Boolean(provider.can_replace), resendAvailableAt: provider.resend_available_at ?? null, cancelAvailableAt: provider.cancel_available_at ?? null, replaceAvailableAt: provider.replace_available_at ?? null, otpCode: provider.otp_code ?? null, otpMessage: provider.otp_message ?? null, smsRevision: provider.sms_revision ?? row.smsRevision, chargedAmount: row.chargedAmount, currency: row.currency, refunded: Boolean(row.refundedAt) }; }

  private async applyProviderState(row: SmsCodeOrder, provider: ProviderOrder) {
    row.providerOrderId = String(provider.id); row.status = provider.status; row.phoneNumber = provider.phone_number ?? row.phoneNumber; row.expiresAt = provider.expires_at ? new Date(provider.expires_at) : null; row.resendAvailableAt = provider.resend_available_at ? new Date(provider.resend_available_at) : null; row.cancelAvailableAt = provider.cancel_available_at ? new Date(provider.cancel_available_at) : null; row.replaceAvailableAt = provider.replace_available_at ? new Date(provider.replace_available_at) : null; row.canResend = Boolean(provider.can_resend); row.canCancel = Boolean(provider.can_cancel); row.canReplace = Boolean(provider.can_replace); row.smsRevision = Math.max(row.smsRevision, Number(provider.sms_revision ?? 0)); row.providerAmount = this.providerAmount(provider.amount); row.providerSnapshot = provider; await this.orders.save(row); if (provider.status === 'CANCELED' || provider.status === 'EXPIRED') await this.refundIfNeeded(row, provider.status === 'EXPIRED' ? 'PROVIDER_EXPIRED' : 'PROVIDER_CANCELED'); return this.snapshot(row, provider);
  }

  private async reserveLocalOrder(userId: string, serviceId: string, product: Product) {
    const idempotencyKey = randomUUID();
    try { return await this.dataSource.transaction(async manager => {
      const wallet = await manager.findOne(Wallet, { where: { userId }, lock: { mode: 'pessimistic_write' } });
      if (!wallet) throw new NotFoundException('کیف پول پیدا نشد.');
      if (wallet.currency !== product.currency) throw new BadRequestException(`واحد پول کیف پول (${wallet.currency}) با قیمت سرویس (${product.currency}) یکسان نیست.`);
      const price = Number(product.price), balance = Number(wallet.balance);
      if (!Number.isFinite(price) || price <= 0) throw new BadRequestException('قیمت محصول معتبر نیست.');
      if (balance < price) throw new BadRequestException('موجودی کیف پول کافی نیست.');
      wallet.balance = (balance - price).toFixed(8);
      const order = manager.create(SmsCodeOrder, { userId, serviceId, productId: product.id, providerOrderId: null, status: 'CREATING', idempotencyKey, chargedAmount: product.price, currency: product.currency, providerAmount: null, phoneNumber: null, expiresAt: null, resendAvailableAt: null, cancelAvailableAt: null, replaceAvailableAt: null, canResend: false, canCancel: false, canReplace: false, smsRevision: 0, refundedAt: null, refundedAmount: null, refundReason: null, providerSnapshot: {} });
      const saved = await manager.save(order); await manager.save(wallet); await manager.save(WalletTransaction, manager.create(WalletTransaction, { userId, walletId: wallet.id, type: 'SMSCODE_ORDER_DEBIT', amount: `-${price.toFixed(8)}`, balanceBefore: balance.toFixed(8), balanceAfter: wallet.balance, currency: wallet.currency, referenceType: 'SMSCODE_ORDER', referenceId: saved.id, description: `رزرو شماره برای ${product.title}` })); return saved;
    }); } catch (error) {
      if (error instanceof QueryFailedError && (error as QueryFailedError & { driverError?: { code?: string } }).driverError?.code === '23505') throw new ConflictException('برای این کاربر یک سفارش شماره فعال وجود دارد. ابتدا همان سفارش را مدیریت کنید.');
      throw error;
    }
  }

  async create(userId: string, productId: string) {
    if (!productId) throw new BadRequestException('productId الزامی است.');
    const product = await this.products.findOne({ where: { id: productId, active: true } }); if (!product) throw new NotFoundException('محصول پیدا نشد.');
    const service = await this.services.findOne({ where: { id: product.serviceId, active: true } }); if (!service) throw new NotFoundException('سرویس پیدا نشد.');
    const config = await this.loadConfig(service.id);