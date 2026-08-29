import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { SmsCodeOrder } from './entities/commerce.entity';

type ProviderOrder = {
  id: number;
  status: string;
  phone_number?: string | null;
  expires_at?: string | null;
  otp_code?: string | null;
  otp_message?: string | null;
  sms_revision?: number;
  [key: string]: unknown;
};

@Injectable()
export class SmsCodeFinishService {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(SmsCodeOrder)
    private readonly orders: Repository<SmsCodeOrder>,
    private readonly notifications: NotificationsService,
  ) {
    const version = config.get<string>('SMSCODE_API_VERSION', 'v2');
    this.baseUrl = `https://api.smscode.gg/${version}`;
    this.token = config.get<string>('SMSCODE_API_TOKEN', '');
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.token) throw new BadRequestException('SMSCode تنظیم نشده است.');
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });

    const body = (await response.json().catch(() => null)) as {
      success?: boolean;
      data?: T;
      error?: { message?: string; code?: string };
    } | null;

    if (!response.ok || !body?.success) {
      throw new BadRequestException(
        body?.error?.message ?? 'تکمیل سفارش در SMSCode ناموفق بود.',
      );
    }
    return body.data as T;
  }

  async finish(userId: string, localId: string) {
    const row = await this.orders.findOne({ where: { id: localId, userId } });
    if (!row) throw new NotFoundException('سفارش شماره پیدا نشد.');
    if (!row.providerOrderId)
      throw new BadRequestException('سفارش هنوز در SMSCode ایجاد نشده است.');

    const current = await this.request<ProviderOrder>(
      `/orders/${row.providerOrderId}`,
    );

    if (['COMPLETED', 'SUCCESS'].includes(current.status)) {
      row.status = 'COMPLETED';
      row.providerSnapshot = current;
      row.otpCode = current.otp_code ?? row.otpCode;
      row.otpMessage = current.otp_message ?? row.otpMessage;
      await this.orders.save(row);
      return {
        id: row.id,
        providerOrderId: current.id,
        status: 'COMPLETED',
        phoneNumber: current.phone_number ?? row.phoneNumber,
        expiresAt: current.expires_at ?? row.expiresAt?.toISOString() ?? null,
        otpCode: current.otp_code ?? row.otpCode ?? null,
        otpMessage: current.otp_message ?? row.otpMessage ?? null,
        smsRevision: current.sms_revision ?? row.smsRevision,
        refunded: Boolean(row.refundedAt),
      };
    }

    if (!['OTP_RECEIVED', 'ACTIVE'].includes(current.status))
      throw new BadRequestException(
        'فقط سفارش دارای کد دریافت‌شده قابل ثبت به عنوان موفق است.',
      );

    const result = await this.request<{ order_id: number; status: string }>(
      '/orders/finish',
      {
        method: 'POST',
        body: JSON.stringify({ id: Number(row.providerOrderId) }),
      },
    );

    const provider = await this.request<ProviderOrder>(
      `/orders/${row.providerOrderId}`,
    );

    row.status = 'COMPLETED';
    row.phoneNumber = provider.phone_number ?? row.phoneNumber;
    row.expiresAt = provider.expires_at ? new Date(provider.expires_at) : row.expiresAt;
    row.otpCode = provider.otp_code ?? row.otpCode;
    row.otpMessage = provider.otp_message ?? row.otpMessage;
    row.smsRevision = Math.max(row.smsRevision, Number(provider.sms_revision ?? 0));
    row.canResend = false;
    row.canCancel = false;
    row.canReplace = false;
    row.providerSnapshot = provider;
    await this.orders.save(row);

    await this.notifications.create(row.userId, {
      type: 'SMS_ORDER_COMPLETED',
      title: 'سفارش شماره با موفقیت ثبت شد',
      message: 'کد دریافت شد و سفارش با موفقیت تکمیل شد.',
      data: { orderId: row.id, providerOrderId: result.order_id },
    });

    return {
      id: row.id,
      providerOrderId: provider.id,
      status: 'COMPLETED',
      phoneNumber: provider.phone_number ?? row.phoneNumber,
      expiresAt: provider.expires_at ?? row.expiresAt?.toISOString() ?? null,
      otpCode: provider.otp_code ?? row.otpCode ?? null,
      otpMessage: provider.otp_message ?? row.otpMessage ?? null,
      smsRevision: provider.sms_revision ?? row.smsRevision,
      refunded: Boolean(row.refundedAt),
    };
  }
}
