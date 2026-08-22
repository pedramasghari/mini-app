import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { CommerceService } from './commerce.service';
import { PaymentMethod } from './entities/commerce.entity';

type InlineKeyboardMarkup = { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> };

@Injectable()
export class AdminBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdminBotService.name);
  private offset = 0;
  private timer?: NodeJS.Timeout;
  private readonly states = new Map<number, { action: string; values: string[]; paymentId?: string }>();
  private readonly notified = new Set<string>();

  constructor(
    private config: ConfigService,
    private commerce: CommerceService,
    private notifications: NotificationsService,
    @InjectRepository(PaymentMethod) private methods: Repository<PaymentMethod>,
    @InjectRepository(User) private users: Repository<User>,
  ) {}

  onModuleInit() { if (this.config.get('ADMIN_BOT_TOKEN')) this.poll(); }
  onModuleDestroy() { if (this.timer) clearTimeout(this.timer); }
  private admins() { return String(this.config.get('ADMIN_TELEGRAM_IDS') ?? '').split(',').map(v => v.trim()).filter(Boolean); }
  private allowed(id: number) { return this.admins().includes(String(id)); }
  private api(method: string, body: Record<string, unknown>) {
    const token = this.config.get<string>('ADMIN_BOT_TOKEN');
    return fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json() as Promise<any>);
  }

  private async poll() {
    try {
      const token = this.config.get<string>('ADMIN_BOT_TOKEN'); if (!token) return;
      const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?timeout=20&offset=${this.offset}`);
      const json = await response.json() as any;
      for (const update of json.result ?? []) { this.offset = update.update_id + 1; await this.handle(update); }
      await this.notifyNewPayments();
    } catch (error) { this.logger.warn(`خطا در ارتباط ربات ادمین: ${String(error)}`); }
    this.timer = setTimeout(() => this.poll(), 1000);
  }

  private async notifyNewPayments() {
    const rows = await this.commerce.pendingPayments();
    for (const p of rows) {
      if (this.notified.has(p.id)) continue;
      this.notified.add(p.id);
      const user = await this.users.findOne({ where: { id: p.userId } });
      const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'بدون نام';
      const username = user?.username ? `@${user.username}` : 'بدون نام کاربری';
      const text = [
        '💰 درخواست شارژ کیف پول',
        '',
        `شناسه درخواست: ${p.id}`,
        `👤 نام کاربر: ${userName}`,
        `🆔 نام کاربری: ${username}`,
        `📱 شناسه تلگرام: ${user?.telegramId ?? 'نامشخص'}`,
        `💵 مبلغ: ${p.amount} ${p.currency}`,
        `🕐 وضعیت: در انتظار بررسی`,
        '',
        'لطفاً فیش واریزی را بررسی و درخواست را تأیید یا رد کنید.',
      ].join('\n');
      const keyboard: InlineKeyboardMarkup = { inline_keyboard: [[{ text: '✅ تأیید شارژ', callback_data: `approve:${p.id}` }, { text: '❌ رد درخواست', callback_data: `reject:${p.id}` }]] };
      for (const admin of this.admins()) {
        const chatId = Number(admin); if (!Number.isSafeInteger(chatId)) continue;
        await this.send(chatId, text, keyboard);
        if (p.receiptPath) await this.sendReceipt(chatId, p.receiptPath, `🧾 فیش واریزی درخواست ${p.id}`);
      }
    }
  }

  private async handle(update: any) {
    if (update.callback_query) return this.callback(update.callback_query);
    const message = update.message; if (!message?.from || !this.allowed(message.from.id)) return;
    const text = String(message.text ?? '').trim(); const state = this.states.get(message.from.id);
    if (state) return this.stateMessage(message.chat.id, message.from.id, text, state);
    if (text === '/start' || text === '/help') return this.send(message.chat.id, '🤖 پنل مدیریت\n\n/payments — درخواست‌های در انتظار\n/cards — کارت‌های فعال\n/addcard — افزودن کارت');
    if (text === '/payments') return this.sendPending(message.chat.id);
    if (text === '/cards') return this.sendCards(message.chat.id);
    if (text === '/addcard') { this.states.set(message.from.id, { action: 'addcard', values: [] }); return this.send(message.chat.id, 'شماره کارت را ارسال کنید:'); }
  }

  private async stateMessage(chatId: number, adminId: number, text: string, state: { action: string; values: string[]; paymentId?: string }) {
    if (state.action === 'reject') {
      this.states.delete(adminId);
      try {
        const result = await this.commerce.rejectPayment(state.paymentId!, text);
        await this.notifyCustomer(result.userId, '❌ شارژ تأیید نشد', result.adminReason ?? 'درخواست شارژ شما تأیید نشد.');
        return this.send(chatId, '❌ درخواست شارژ رد شد و نتیجه برای کاربر ارسال شد.');
      } catch (error) { return this.send(chatId, `❌ رد درخواست انجام نشد: ${error instanceof Error ? error.message : 'درخواست قبلاً پردازش شده است'}`); }
    }
    if (state.action === 'addcard') {
      state.values.push(text);
      if (state.values.length === 1) return this.send(chatId, 'نام صاحب کارت را ارسال کنید:');
      if (state.values.length === 2) return this.send(chatId, 'نام بانک را ارسال کنید (یا -):');
      this.states.delete(adminId);
      const [cardNumber, holderName, bank] = state.values;
      await this.methods.save(this.methods.create({ type: 'CARD_TRANSFER', title: `${bank === '-' ? '' : bank + ' '}کارت`, cardNumber, holderName, bankName: bank === '-' ? null : bank, active: true }));
      return this.send(chatId, `✅ کارت با موفقیت اضافه شد.\n${cardNumber.slice(0, 4)} **** **** ${cardNumber.slice(-4)}`);
    }
  }

  private async callback(query: any) {
    const adminId = query.from?.id; if (!adminId || !this.allowed(adminId)) return;
    await this.api('answerCallbackQuery', { callback_query_id: query.id });
    const data = String(query.data ?? '');
    try {
      if (data.startsWith('approve:')) {
        const id = data.slice(8);
        const payment = await this.commerce.approvePayment(id, 'تأیید توسط ادمین');
        await this.notifyCustomer(payment.userId, '✅ شارژ حساب با موفقیت انجام شد', `مبلغ ${payment.amount} ${payment.currency} به کیف پول شما اضافه شد.`);
        return this.send(query.message.chat.id, `✅ درخواست ${id} با موفقیت تأیید شد و کیف پول کاربر شارژ شد.`);
      }
      if (data.startsWith('reject:')) {
        const id = data.slice(7);
        this.states.set(adminId, { action: 'reject', values: [], paymentId: id });
        return this.send(query.message.chat.id, '✍️ لطفاً دلیل رد درخواست را ارسال کنید:');
      }
    } catch (error) { return this.send(query.message.chat.id, `❌ پردازش درخواست انجام نشد: ${error instanceof Error ? error.message : 'درخواست قبلاً پردازش شده است'}`); }
  }

  private async notifyCustomer(userId: string, title: string, text: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) return;
    if (this.notifications.isOnline(userId)) return;
    const chatId = Number(user.telegramId); if (!Number.isSafeInteger(chatId)) return;
    await this.send(chatId, `${title}\n\n${text}`);
  }

  private async sendPending(chatId: number) {
    const rows = await this.commerce.pendingPayments();
    if (!rows.length) return this.send(chatId, 'در حال حاضر درخواست شارژ در انتظاری وجود ندارد.');
    for (const p of rows) {
      const user = await this.users.findOne({ where: { id: p.userId } });
      const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'بدون نام';
      await this.send(chatId, `💰 درخواست شارژ\n\nشناسه: ${p.id}\n👤 کاربر: ${userName}\n🆔 ${user?.username ? '@' + user.username : user?.telegramId}\n💵 مبلغ: ${p.amount} ${p.currency}\n📌 وضعیت: ${p.status}`, { inline_keyboard: [[{ text: '✅ تأیید شارژ', callback_data: `approve:${p.id}` }, { text: '❌ رد درخواست', callback_data: `reject:${p.id}` }]] });
      if (p.receiptPath) await this.sendReceipt(chatId, p.receiptPath, `🧾 فیش واریزی ${p.id}`);
    }
  }

  private async sendCards(chatId: number) {
    const cards = await this.methods.find({ where: { active: true }, order: { createdAt: 'DESC' } });
    if (!cards.length) return this.send(chatId, 'هیچ کارت فعالی ثبت نشده است.');
    return this.send(chatId, cards.map(c => `• ${c.bankName ?? 'بانک'} — ${c.cardNumber.slice(0, 4)} **** **** ${c.cardNumber.slice(-4)} — ${c.holderName}`).join('\n'));
  }

  private async send(chatId: number, text: string, reply_markup?: InlineKeyboardMarkup) { return this.api('sendMessage', { chat_id: chatId, text, ...(reply_markup ? { reply_markup } : {}) }); }

  private async sendReceipt(chatId: number, path: string, caption: string) {
    const token = this.config.get<string>('ADMIN_BOT_TOKEN');
    if (!token) return;
    const bytes = await readFile(path);
    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('caption', caption);
    const extension = extname(path).toLowerCase();
    const field = ['.jpg', '.jpeg', '.png', '.webp'].includes(extension) ? 'photo' : 'document';
    form.append(field, new Blob([bytes]), path.split(/[\\/]/).pop() ?? 'receipt');
    await fetch(`https://api.telegram.org/bot${token}/${field === 'photo' ? 'sendPhoto' : 'sendDocument'}`, { method: 'POST', body: form });
  }
}
