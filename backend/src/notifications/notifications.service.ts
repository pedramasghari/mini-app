import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Subject } from 'rxjs';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { UsersService } from '../users/users.service';
import { AdminBotRuntimeService } from '../admin-bot/runtime/admin-bot.runtime.service';

export type RealtimeEvent = {
  type: string;
  notification?: Notification;
  wallet?: { balance: string; currency: string };
  payment?: { id: string; status: string; amount: string; reason?: string | null };
};

@Injectable()
export class NotificationsService {
  private readonly streams = new Map<string, Set<Subject<RealtimeEvent>>>();

  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    private readonly users: UsersService,
    private readonly telegram: AdminBotRuntimeService,
  ) {}

  connect(userId: string) {
    const subject = new Subject<RealtimeEvent>();
    const set = this.streams.get(userId) ?? new Set<Subject<RealtimeEvent>>();
    set.add(subject);
    this.streams.set(userId, set);
    return { subject, close: () => this.disconnect(userId, subject) };
  }

  private disconnect(userId: string, subject: Subject<RealtimeEvent>) {
    subject.complete();
    const set = this.streams.get(userId);
    if (!set) return;
    set.delete(subject);
    if (!set.size) this.streams.delete(userId);
  }

  isOnline(userId: string) {
    return (this.streams.get(userId)?.size ?? 0) > 0;
  }

  emit(userId: string, event: RealtimeEvent) {
    for (const stream of this.streams.get(userId) ?? []) stream.next(event);
  }

  private isChargeNotification(type: string) {
    return /^(PAYMENT|DEPOSIT|WALLET_(CREDIT|DEPOSIT))/i.test(type);
  }

  private async sendTelegramChargeNotification(
    userId: string,
    notification: Notification,
  ) {
    if (!this.isChargeNotification(notification.type)) return;

    const user = await this.users.findById(userId).catch(() => null);
    const telegramId = user?.telegramId ?? null;

    const text = [
      '🔔 اعلان شارژ',
      notification.title,
      notification.message,
    ]
      .filter(Boolean)
      .join('\n');

    if (telegramId) {
      await this.telegram.sendToTelegram(telegramId, text);
    }

    const adminText = [
      '💰 اعلان مالی',
      `کاربر: ${user?.firstName ?? '-'} ${user?.lastName ?? ''}`.trim(),
      `Telegram ID: ${telegramId ?? userId}`,
      notification.title,
      notification.message,
    ]
      .filter(Boolean)
      .join('\n');

    await this.telegram.sendToAdmins(adminText);
  }

  async create(
    userId: string,
    input: { type: string; title: string; message: string; data?: Record<string, unknown> },
  ): Promise<{ notification: Notification; online: boolean }>;
  async create(
    userId: string,
    title: string,
    message: string,
  ): Promise<{ notification: Notification; online: boolean }>;
  async create(
    userId: string,
    inputOrTitle:
      | { type: string; title: string; message: string; data?: Record<string, unknown> }
      | string,
    legacyMessage?: string,
  ) {
    const input =
      typeof inputOrTitle === 'string'
        ? { type: 'SYSTEM', title: inputOrTitle, message: legacyMessage ?? '' }
        : inputOrTitle;

    const notification = await this.notifications.save(
      this.notifications.create({
        userId,
        type: input.type,
        title: input.title,
        message: input.message,
        data: input.data ?? {},
        read: false,
      }),
    );

    this.emit(userId, { type: 'notification', notification });
    void this.sendTelegramChargeNotification(userId, notification).catch(() => undefined);

    return { notification, online: this.isOnline(userId) };
  }

  async list(userId: string) {
    return this.notifications.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async unreadCount(userId: string) {
    return this.notifications.count({ where: { userId, read: false } });
  }

  async markRead(userId: string, id: string) {
    await this.notifications.update({ id, userId }, { read: true });
    return { success: true };
  }
}
