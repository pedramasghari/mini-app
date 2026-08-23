import { BadGatewayException, BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { SmsCodeOrder } from './entities/commerce.entity';

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
  [key: string]: unknown;
};

@Injectable()
export class SmsCodeService {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly catalogProductId: number;
  private readonly maxPrice: string | undefined;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(SmsCodeOrder)
    private readonly orders: Repository<SmsCodeOrder>,
  ) {
    const version = this.config.get<string>('SMSCODE_API_VERSION', 'v2');
    this.baseUrl = `https://api.smscode.gg/${version}`;
    this.token = this.config.get<string>('SMSCODE_API_TOKEN', '');
    this.catalogProductId = Number(this.config.get<string>('SMSCODE_APPLE_CATALOG_PRODUCT_ID', '0'));
    this.maxPrice = this.config.get<string>('SMSCODE_APPLE_MAX_PRICE_USD') || undefined;
  }

  private assertConfigured() {
    if (!this.token || !this.catalogProductId) {
      throw new ServiceUnavailableException('SMSCode is not configured');
    }
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    this.assertConfigured();
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
    const body = await response.json().catch(() => null) as { success?: boolean; data?: T; error?: { message?: string; code?: string } } | null;
    if (!response.ok || !body?.success) {
      const message = body?.error?.message || 'SMSCode request failed';
      if (response.status >= 500) throw new BadGatewayException(message);
      throw new BadRequestException(message);
    }
    return body.data as T;
  }

  private toSnapshot(row: SmsCodeOrder, provider: ProviderOrder) {
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
    };
  }

  private async sync(row: SmsCodeOrder, provider?: ProviderOrder) {
    const current = provider ?? await this.request<ProviderOrder>(`/orders/${row.providerOrderId}`);
    row.status = current.status;
    row.phoneNumber = current.phone_number ?? row.phoneNumber;
    row.expiresAt = current.expires_at ? new Date(current.expires_at) : null;
    row.resendAvailableAt = current.resend_available_at ? new Date(current.resend_available_at) : null;
    row.cancelAvailableAt = current.cancel_available_at ? new Date(current.cancel_available_at) : null;
    row.replaceAvailableAt = current.replace_available_at ? new Date(current.replace_available_at) : null;
    row.canResend = Boolean(current.can_resend);
    row.canCancel = Boolean(current.can_cancel);
    row.canReplace = Boolean(current.can_replace);
    row.providerSnapshot = current;
    await this.orders.save(row);
    return this.toSnapshot(row, current);
  }

  async create(userId: string, productId?: string) {
    this.assertConfigured();
    const payload: Record<string, unknown> = { catalog_product_id: this.catalogProductId, quantity: 1 };
    if (this.maxPrice) payload.max_price = this.maxPrice;
    const data = await this.request<{ orders: ProviderOrder[] }>('/orders/create', {
      method: 'POST',
      headers: { 'Idempotency-Key': randomUUID() },
      body: JSON.stringify(payload),
    });
    const provider = data.orders?.[0];
    if (!provider) throw new BadGatewayException('SMSCode did not return an order');
    const row = this.orders.create({
      userId,
      productId: productId ?? null,
      providerOrderId: String(provider.id),
      status: provider.status,
      phoneNumber: provider.phone_number ?? null,
      expiresAt: provider.expires_at ? new Date(provider.expires_at) : null,
      resendAvailableAt: provider.resend_available_at ? new Date(provider.resend_available_at) : null,
      cancelAvailableAt: provider.cancel_available_at ? new Date(provider.cancel_available_at) : null,
      replaceAvailableAt: provider.replace_available_at ? new Date(provider.replace_available_at) : null,
      canResend: Boolean(provider.can_resend),
      canCancel: Boolean(provider.can_cancel),
      canReplace: Boolean(provider.can_replace),
      providerSnapshot: provider,
    });
    await this.orders.save(row);
    return this.toSnapshot(row, provider);
  }

  async get(userId: string, localId: string) {
    const row = await this.orders.findOne({ where: { id: localId, userId } });
    if (!row) throw new NotFoundException('SMS order not found');
    return this.sync(row);
  }

  async cancel(userId: string, localId: string) {
    const row = await this.orders.findOne({ where: { id: localId, userId } });
    if (!row) throw new NotFoundException('SMS order not found');
    const current = await this.request<ProviderOrder>(`/orders/${row.providerOrderId}`);
    if (!current.can_cancel) throw new BadRequestException('Cancellation is not available yet');
    await this.request(`/orders/cancel`, { method: 'POST', body: JSON.stringify({ id: Number(row.providerOrderId) }) });
    return this.sync(row);
  }

  async resend(userId: string, localId: string) {
    const row = await this.orders.findOne({ where: { id: localId, userId } });
    if (!row) throw new NotFoundException('SMS order not found');
    const current = await this.request<ProviderOrder>(`/orders/${row.providerOrderId}`);
    if (!current.can_resend) throw new BadRequestException('Resend is not available yet');
    await this.request(`/orders/resend`, { method: 'POST', body: JSON.stringify({ id: Number(row.providerOrderId) }) });
    return this.sync(row);
  }
}
