import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { AdminBotRuntimeService } from '../admin-bot/runtime/admin-bot.runtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SupportConversation } from './entities/support-conversation.entity';
import { SupportMessage, SupportSenderRole } from './entities/support-message.entity';

export type SupportAttachmentInput = { type: 'IMAGE' | 'VIDEO'; url: string; name?: string | null; size?: number | null };

@Injectable()
export class SupportChatService {
  constructor(
    @InjectRepository(SupportConversation) private readonly conversations: Repository<SupportConversation>,
    @InjectRepository(SupportMessage) private readonly messages: Repository<SupportMessage>,
    private readonly users: UsersService,
    private readonly telegram: AdminBotRuntimeService,
    private readonly notifications: NotificationsService,
  ) {}

  private async conversationForUser(userId: string) {
    let conversation = await this.conversations.findOne({ where: { userId } });
    if (!conversation) {
      conversation = await this.conversations.save(this.conversations.create({ userId }));
    }
    return conversation;
  }

  async getMine(userId: string) {
    const conversation = await this.conversationForUser(userId);
    await this.messages.update({ conversationId: conversation.id, senderRole: 'ADMIN', readAt: null }, { readAt: new Date(), status: 'READ' });
    conversation.adminUnreadCount = 0;
    await this.conversations.save(conversation);
    return { conversation, messages: await this.messages.find({ where: { conversationId: conversation.id }, order: { createdAt: 'ASC' }, take: 200 }) };
  }

  async listForAdmins() {
    const conversations = await this.conversations.find({ order: { lastMessageAt: 'DESC', updatedAt: 'DESC' } });
    const userIds = conversations.map((item) => item.userId);
    const users = userIds.length ? await this.usersRepositoryByIds(userIds) : [];
    const usersById = new Map(users.map((user) => [user.id, user]));
    return conversations.map((conversation) => ({ ...conversation, user: usersById.get(conversation.userId) ?? null }));
  }

  private async usersRepositoryByIds(ids: string[]) {
    const result: Awaited<ReturnType<UsersService['findById']>>[] = [];
    for (const id of ids) {
      const user = await this.users.findById(id);
      if (user) result.push(user);
    }
    return result;
  }

  async getForAdmin(conversationId: string) {
    const conversation = await this.conversations.findOne({ where: { id: conversationId } });
    if (!conversation) throw new NotFoundException('گفتگوی پشتیبانی پیدا نشد.');
    await this.messages.update({ conversationId, senderRole: 'USER', readAt: null }, { readAt: new Date(), status: 'READ' });
    conversation.userUnreadCount = 0;
    await this.conversations.save(conversation);
    return { conversation, user: await this.users.findById(conversation.userId), messages: await this.messages.find({ where: { conversationId }, order: { createdAt: 'ASC' }, take: 200 }) };
  }

  async send(userId: string, role: SupportSenderRole, input: { conversationId?: string; body?: string; replyToMessageId?: string | null; attachments?: SupportAttachmentInput[] }) {
    const conversation = input.conversationId
      ? await this.conversations.findOne({ where: { id: input.conversationId } })
      : await this.conversationForUser(userId);
    if (!conversation) throw new NotFoundException('گفتگوی پشتیبانی پیدا نشد.');
    if (role === 'USER' && conversation.userId !== userId) throw new NotFoundException('گفتگوی پشتیبانی پیدا نشد.');

    const body = (input.body ?? '').trim();
    const attachments = input.attachments ?? [];
    if (!body && !attachments.length) throw new Error('پیام نمی‌تواند خالی باشد.');

    const message = await this.messages.save(this.messages.create({
      conversationId: conversation.id,
      senderId: userId,
      senderRole: role,
      body,
      replyToMessageId: input.replyToMessageId ?? null,
      attachments,
      status: 'SENT',
    }));

    conversation.lastMessageAt = message.createdAt;
    conversation.lastMessagePreview = body || (attachments[0]?.type === 'IMAGE' ? '📷 تصویر' : '🎬 ویدیو');
    if (role === 'USER') conversation.userUnreadCount += 1;
    else conversation.adminUnreadCount += 1;
    await this.conversations.save(conversation);

    await this.notifyOtherSide(conversation, message, role);
    return message;
  }

  private async notifyOtherSide(conversation: SupportConversation, message: SupportMessage, senderRole: SupportSenderRole) {
    const text = message.body || (message.attachments[0]?.type === 'IMAGE' ? '📷 تصویر جدید' : '🎬 ویدیوی جدید');
    if (senderRole === 'USER') {
      const admins = await this.usersRepositoryByIds(await this.adminIds());
      await Promise.all(admins.map((admin) => this.notifyUser(admin.id, 'پیام جدید پشتیبانی', text, conversation.id, message.id)));
      return;
    }
    await this.notifyUser(conversation.userId, 'پیام جدید از پشتیبانی', text, conversation.id, message.id);
  }

  private async adminIds() {
    // The UsersService intentionally exposes small primitives; admin ids are resolved from the known admin-bot recipients.
    // The admin guard/session still authorizes all admin endpoints. For notifications we use the configured admin ids.
    const configured = process.env.ADMIN_TELEGRAM_IDS?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
    const ids: string[] = [];
    for (const telegramId of configured) {
      const user = await this.users.findByTelegramId(telegramId);
      if (user) ids.push(user.id);
    }
    return ids;
  }

  private async notifyUser(userId: string, title: string, message: string, conversationId: string, messageId: string) {
    const online = this.notifications.isOnline(userId);
    const notification = await this.notifications.create(userId, { type: 'SUPPORT_MESSAGE', title, message, data: { conversationId, messageId } });
    if (!online) {
      const user = await this.users.findById(userId).catch(() => null);
      if (user?.telegramId) {
        await this.telegram.sendToTelegram(user.telegramId, `💬 ${title}\n${message}\n\nبرای مشاهده گفتگو وارد مینی‌اپ شوید.`).catch(() => undefined);
      }
    }
    return notification;
  }
}
