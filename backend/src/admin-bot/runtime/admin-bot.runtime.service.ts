import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommerceService } from '../../commerce/commerce.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { PaymentMethod, PaymentRequest, Order, Service, ServiceFaq, ServiceMedia } from '../../commerce/entities/commerce.entity';
import { User } from '../../users/entities/user.entity';
import { AdminBotConversationService } from '../conversations/admin-bot.conversation.service';
import { AdminBotKeyboard } from '../keyboard/admin-bot.keyboard';
import type { BotKeyboard, TelegramUpdate } from '../admin-bot.types';

@Injectable()
export class AdminBotRuntimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdminBotRuntimeService.name);
  private timer?: NodeJS.Timeout;
  private offset = 0;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly commerce: CommerceService,
    private readonly notifications: NotificationsService,
    private readonly conversations: AdminBotConversationService,
    @InjectRepository(Service) private readonly services: Repository<Service>,
    @InjectRepository(PaymentRequest) private readonly payments: Repository<PaymentRequest>,
    @InjectRepository(PaymentMethod) private readonly methods: Repository<PaymentMethod>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async onModuleInit() {
    const token = this.token();
    if (!token) {
      this.logger.warn('ADMIN_BOT_TOKEN تنظیم نشده است؛ ربات اجرا نشد.');
      return;
    }
    if (!this.adminIds().length) this.logger.warn('ADMIN_TELEGRAM_IDS تنظیم نشده است؛ همه کاربران فقط Mini App را می‌بینند.');
    await this.prepareTelegram();
    this.running = true;
    void this.poll();
  }

  onModuleDestroy() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
  }

  private token() { return String(this.config.get('ADMIN_BOT_TOKEN') ?? '').trim(); }
  private appUrl() { return String(this.config.get('MINI_APP_URL') ?? '').trim(); }
  private adminIds() { return String(this.config.get('ADMIN_TELEGRAM_IDS') ?? this.config.get('ADMIN_TELEGRAM_ID') ?? '').split(',').map(v => v.trim()).filter(Boolean); }
  private isAdmin(id: number) { return this.adminIds().includes(String(id)); }

  private async prepareTelegram() {
    // Polling and webhook cannot be used together. Remove any previous webhook first.
    await this.api('deleteWebhook', { drop_pending_updates: false });
    const me = await this.api('getMe', {});
    if (!me?.ok) throw new Error(`Telegram getMe failed: ${JSON.stringify(me)}`);
    this.logger.log(`Telegram bot connected: @${me.result?.username ?? 'unknown'}`);
  }

  private async poll() {
    if (!this.running) return;
    try {
      const result = await this.api('getUpdates', { timeout: 25, offset: this.offset, allowed_updates: ['message', 'callback_query'] });
      if (!result?.ok) throw new Error(JSON.stringify(result));
      for (const update of (result.result ?? []) as TelegramUpdate[]) {
        this.offset = update.update_id + 1;
        await this.handle(update);
      }
    } catch (error) {
      this.logger.error(`خطای polling ربات: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (this.running) this.timer = setTimeout(() => void this.poll(), 700);
    }
  }

  private async api(method: string, body: Record<string, unknown>) {
    const response = await fetch(`https://api.telegram.org/bot${this.token()}/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    return response.json() as Promise<any>;
  }

  private async send(chatId: number, text: string, replyMarkup?: BotKeyboard) {
    return this.api('sendMessage', { chat_id: chatId, text, reply_markup: replyMarkup });
  }

  private async handle(update: TelegramUpdate) {
    if (update.callback_query) return this.handleCallback(update.callback_query);
    const message = update.message;
    if (!message?.from || !message.chat?.id) return;
    const id = Number(message.from.id);
    const text = String(message.text ?? '').trim();

    if (text === '/start' || text === '/menu' || text === '/admin') {
      this.conversations.clear(id);
      return this.showMain(message.chat.id, id);
    }

    if (!this.isAdmin(id)) {
      return this.send(message.chat.id, '👋 خوش آمدید\n\nبرای استفاده از خدمات، فقط مینی‌اپ را باز کنید.', AdminBotKeyboard.user(this.appUrl()));
    }

    if (text === '/cancel') {
      this.conversations.clear(id);
      return this.showMain(message.chat.id, id);
    }

    const state = this.conversations.get(id);
    if (state) return this.handleConversation(message.chat.id, id, text, state);
    return this.showMain(message.chat.id, id);
  }

  private async showMain(chatId: number, id: number) {
    if (!this.isAdmin(id)) return this.send(chatId, '👋 برای استفاده از خدمات، مینی‌اپ را باز کنید.', AdminBotKeyboard.user(this.appUrl()));
    return this.send(chatId, '🤖 پنل مدیریت\n\nاز منوی زیر عملیات موردنظر را انتخاب کنید.', AdminBotKeyboard.main(this.appUrl()));
  }

  private async handleCallback(query: any) {
    const id = Number(query.from?.id);
    await this.api('answerCallbackQuery', { callback_query_id: query.id, text: this.isAdmin(id) ? undefined : 'دسترسی مجاز نیست.', show_alert: !this.isAdmin(id) });
    if (!this.isAdmin(id)) return;
    const chatId = Number(query.message?.chat?.id);
    const data = String(query.data ?? '');

    try {
      if (data === 'admin:main') return this.showMain(chatId, id);
      if (data === 'admin:services') return this.showServices(chatId);
      if (data === 'admin:finance') return this.showFinance(chatId);
      if (data === 'admin:orders') return this.showOrders(chatId);
      if (data === 'admin:users') return this.showUsers(chatId);
      if (data === 'service:create') return this.startServiceCreate(chatId, id);
      if (data === 'service:list') return this.listServices(chatId);
      if (data === 'service:edit:list') return this.listServices(chatId, 'edit');
      if (data === 'service:delete:list') return this.listServices(chatId, 'delete');
      if (data.startsWith('service:edit:')) return this.editServiceMenu(chatId, data.slice('service:edit:'.length));
      if (data.startsWith('service:toggle:')) return this.toggleService(chatId, data.slice('service:toggle:'.length));
      if (data.startsWith('service:delete:confirm:')) return this.confirmDelete(chatId, data.slice('service:delete:confirm:'.length));
      if (data.startsWith('service:delete:yes:')) return this.deleteService(chatId, data.slice('service:delete:yes:'.length));
      if (data.startsWith('service:field:')) return this.startServiceField(chatId, id, data);
      if (data === 'finance:pending') return this.listPendingPayments(chatId);
      if (data === 'finance:methods') return this.listPaymentMethods(chatId);
      if (data.startsWith('payment:approve:')) return this.approvePayment(chatId, data.slice('payment:approve:'.length));
      if (data.startsWith('payment:reject:')) return this.startRejectPayment(chatId, id, data.slice('payment:reject:'.length));
      if (data.startsWith('payment:receipt:')) return this.sendReceipt(chatId, data.slice('payment:receipt:'.length));
      if (data.startsWith('order:list:')) return this.listOrders(chatId, Number(data.slice('order:list:'.length)) || 1);
      if (data === 'users:list') return this.listUsers(chatId, 1);
      if (data.startsWith('users:list:')) return this.listUsers(chatId, Number(data.slice('users:list:'.length)) || 1);
    } catch (error) {
      return this.send(chatId, `❌ عملیات انجام نشد.\n${error instanceof Error ? error.message : 'خطای نامشخص'}`, AdminBotKeyboard.back());
    }
  }

  private async showServices(chatId: number) {
    return this.send(chatId, '🛍 مدیریت سرویس‌ها\n\nسرویس‌ها، محتوای آموزشی، قوانین و FAQ را مدیریت کنید.', AdminBotKeyboard.services());
  }

  private async showFinance(chatId: number) {
    return this.send(chatId, '💰 مدیریت مالی\n\nدرخواست‌های شارژ و روش‌های پرداخت را مدیریت کنید.', { inline_keyboard: [
      [{ text: '⏳ درخواست‌های در انتظار', callback_data: 'finance:pending' }],
      [{ text: '💳 روش‌های پرداخت', callback_data: 'finance:methods' }],
      [{ text: '⬅️ منوی اصلی', callback_data: 'admin:main' }],
    ] });
  }

  private async showOrders(chatId: number) {
    return this.send(chatId, '📦 مدیریت سفارشات\n\nآخرین سفارش‌ها:', { inline_keyboard: [
      [{ text: '📋 مشاهده سفارش‌ها', callback_data: 'order:list:1' }],
      [{ text: '⬅️ منوی اصلی', callback_data: 'admin:main' }],
    ] });
  }

  private async showUsers(chatId: number) {
    return this.send(chatId, '👥 مدیریت کاربران\n\nکاربران ثبت‌شده:', { inline_keyboard: [
      [{ text: '📋 فهرست کاربران', callback_data: 'users:list:1' }],
      [{ text: '⬅️ منوی اصلی', callback_data: 'admin:main' }],
    ] });
  }

  private async startServiceCreate(chatId: number, adminId: number) {
    this.conversations.set({ type: 'service-create', step: 0, adminId, values: [] });
    return this.send(chatId, '➕ افزودن سرویس\n\nمرحله ۱ از ۸\nشناسه انگلیسی سرویس را ارسال کنید.\nمثال: apple-id', AdminBotKeyboard.cancel('admin:services'));
  }

  private async startServiceField(chatId: number, adminId: number, data: string) {
    const [, , serviceId, field] = data.split(':');
    const prompts: Record<string, string> = {
      title: 'عنوان جدید را ارسال کنید.', description: 'توضیحات جدید را ارسال کنید.', icon: 'نام آیکون را ارسال کنید.',
      serverText: 'متن اختصاصی سرویس را ارسال کنید. برای حذف «-» بفرستید.', rulesText: 'قوانین را ارسال کنید. برای حذف «-» بفرستید.',
      media: 'رسانه‌ها را هر خط به شکل image|URL|عنوان یا video|URL|عنوان ارسال کنید. برای حذف همه «-».',
      faqs: 'FAQ را هر خط به شکل سوال|پاسخ ارسال کنید. برای حذف همه «-».',
    };
    this.conversations.set({ type: 'service-edit', step: 0, adminId, entityId: serviceId, field, values: [] });
    return this.send(chatId, `✏️ ویرایش سرویس\n\n${prompts[field] ?? 'مقدار جدید را ارسال کنید.'}`, AdminBotKeyboard.cancel(`service:edit:${serviceId}`));
  }

  private async handleConversation(chatId: number, adminId: number, text: string, state: any) {
    if (!text) return this.send(chatId, 'لطفاً یک مقدار معتبر ارسال کنید.');
    if (state.type === 'payment-reject') {
      const payment = await this.commerce.rejectPayment(state.entityId, text);
      this.conversations.clear(adminId);
      await this.notifyUser(payment.userId, '❌ درخواست شارژ رد شد', payment.adminReason || text);
      return this.send(chatId, '❌ درخواست شارژ رد شد و دلیل برای کاربر ارسال شد.', { inline_keyboard: [[{ text: '💰 مدیریت مالی', callback_data: 'admin:finance' }],[{ text: '🏠 منوی اصلی', callback_data: 'admin:main' }]] });
    }

    if (state.type === 'service-edit') {
      const patch: any = {};
      switch (state.field) {
        case 'title': patch.title = text; break;
        case 'description': patch.description = text; break;
        case 'icon': patch.icon = text; break;
        case 'serverText': patch.serverText = text === '-' ? null : text; break;
        case 'rulesText': patch.rulesText = text === '-' ? null : text; break;
        case 'media': patch.media = parseMedia(text); break;
        case 'faqs': patch.faqs = parseFaqs(text); break;
      }
      const service = await this.commerce.updateService(state.entityId, patch);
      this.conversations.clear(adminId);
      return this.send(chatId, `✅ سرویس «${service.title}» به‌روزرسانی شد.`, serviceMenu(service));
    }

    state.values.push(text);
    const prompts = ['عنوان فارسی سرویس:', 'توضیح سرویس:', 'آیکون سرویس:', 'متن اختصاصی سرویس یا «-»:', 'قوانین سرویس یا «-»:', 'رسانه‌ها یا «-»:', 'سوالات متداول یا «-»:'];
    if (state.values.length < 8) return this.send(chatId, `مرحله ${state.values.length + 1} از ۸\n\n${prompts[state.values.length - 1]}`, AdminBotKeyboard.cancel('admin:services'));
    const [slug, title, description, icon, serverText, rulesText, media, faqs] = state.values;
    const service = await this.commerce.createService({ slug, title, description, icon, serverText: serverText === '-' ? null : serverText, rulesText: rulesText === '-' ? null : rulesText, media: parseMedia(media), faqs: parseFaqs(faqs) });
    this.conversations.clear(adminId);
    return this.send(chatId, `✅ سرویس «${service.title}» ساخته شد.`, serviceMenu(service));
  }

  private async listServices(chatId: number, mode?: 'edit' | 'delete') {
    const rows = await this.commerce.listServices(true);
    if (!rows.length) return this.send(chatId, 'سرویسی ثبت نشده است.', AdminBotKeyboard.back('admin:services'));
    const buttons = rows.map(s => [{ text: `${s.active ? '🟢' : '⚪'} ${s.title}`, callback_data: mode === 'delete' ? `service:delete:confirm:${s.id}` : mode === 'edit' ? `service:edit:${s.id}` : `service:edit:${s.id}` }]);
    buttons.push([{ text: '⬅️ مدیریت سرویس‌ها', callback_data: 'admin:services' }]);
    return this.send(chatId, '📋 فهرست سرویس‌ها', { inline_keyboard: buttons });
  }

  private async editServiceMenu(chatId: number, id: string) {
    const service = await this.commerce.getService(id);
    return this.send(chatId, `🛠 مدیریت «${service.title}»\n\nوضعیت: ${service.active ? 'فعال' : 'غیرفعال'}`, serviceMenu(service));
  }

  private async toggleService(chatId: number, id: string) {
    const service = await this.commerce.getService(id);
    const updated = await this.commerce.updateService(id, { active: !service.active });
    return this.send(chatId, `✅ سرویس «${updated.title}» ${updated.active ? 'فعال' : 'غیرفعال'} شد.`, serviceMenu(updated));
  }

  private async confirmDelete(chatId: number, id: string) {
    const service = await this.commerce.getService(id);
    return this.send(chatId, `⚠️ سرویس «${service.title}» غیرفعال شود؟\nسفارش‌های قبلی حفظ خواهند شد.`, { inline_keyboard: [[{ text: '🗑 تأیید', callback_data: `service:delete:yes:${id}` }, { text: 'انصراف', callback_data: `service:edit:${id}` }]] });
  }

  private async deleteService(chatId: number, id: string) {
    const service = await this.commerce.deleteService(id);
    return this.send(chatId, `✅ سرویس «${service.title}» غیرفعال شد.`, AdminBotKeyboard.services());
  }

  private async listPendingPayments(chatId: number) {
    const rows = await this.payments.find({ where: { status: 'PENDING' as any }, order: { createdAt: 'ASC' }, take: 20 });
    if (!rows.length) return this.send(chatId, '✅ درخواست شارژ در انتظاری وجود ندارد.', { inline_keyboard: [[{ text: '⬅️ مدیریت مالی', callback_data: 'admin:finance' }]] });
    for (const payment of rows) {
      const user = await this.users.findOne({ where: { id: payment.userId } });
      const text = `💰 درخواست شارژ\n\n👤 کاربر: ${user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || 'بدون نام' : 'نامشخص'}\n🆔 Telegram ID: ${user?.telegramId ?? 'نامشخص'}\n💵 مبلغ: ${payment.amount} ${payment.currency}\n🕐 وضعیت: در انتظار بررسی`;
      await this.send(chatId, text, { inline_keyboard: [[{ text: '📷 مشاهده فیش', callback_data: `payment:receipt:${payment.id}` }],[{ text: '✅ تأیید شارژ', callback_data: `payment:approve:${payment.id}` },{ text: '❌ رد درخواست', callback_data: `payment:reject:${payment.id}` }]] });
    }
  }

  private async approvePayment(chatId: number, id: string) {
    const payment = await this.commerce.approvePayment(id, 'تأیید توسط ادمین');
    await this.notifyUser(payment.userId, '✅ شارژ حساب موفق بود', `مبلغ ${payment.amount} ${payment.currency} به کیف پول شما اضافه شد.`);
    return this.send(chatId, '✅ درخواست شارژ تأیید شد و موجودی کاربر افزایش یافت.', { inline_keyboard: [[{ text: '💰 درخواست‌های شارژ', callback_data: 'finance:pending' }],[{ text: '🏠 منوی اصلی', callback_data: 'admin:main' }]] });
  }

  private async startRejectPayment(chatId: number, adminId: number, id: string) {
    this.conversations.set({ type: 'payment-reject', step: 0, adminId, entityId: id, values: [] });
    return this.send(chatId, '✍️ دلیل رد درخواست را ارسال کنید:', AdminBotKeyboard.cancel('finance:pending'));
  }

  private async sendReceipt(chatId: number, id: string) {
    const payment: any = await this.payments.findOne({ where: { id } });
    if (!payment) return this.send(chatId, 'فیش پیدا نشد.', AdminBotKeyboard.back('finance:pending'));
    const path = String(payment.receiptPath ?? '');
    if (!path) return this.send(chatId, 'برای این درخواست فایل فیش ثبت نشده است.');
    const { readFile } = await import('node:fs/promises');
    try {
      const bytes = await readFile(path);
      const form = new FormData();
      form.append('chat_id', String(chatId));
      form.append('caption', `📷 فیش واریزی\nشناسه درخواست: ${payment.id}\nمبلغ: ${payment.amount} ${payment.currency}`);
      form.append('photo', new Blob([bytes]), path.split(/[\\/]/).pop() || 'receipt');
      await fetch(`https://api.telegram.org/bot${this.token()}/sendPhoto`, { method: 'POST', body: form });
    } catch {
      return this.send(chatId, `📷 مسیر فیش: ${path}`);
    }
  }

  private async listPaymentMethods(chatId: number) {
    const rows = await this.methods.find({ order: { createdAt: 'ASC' } });
    if (!rows.length) return this.send(chatId, 'روش پرداختی ثبت نشده است.', AdminBotKeyboard.back('admin:finance'));
    const text = rows.map((m: any) => `💳 ${m.title}\nشماره کارت: ${m.cardNumber ?? '-'}\nبانک: ${m.bankName ?? '-'}\nوضعیت: ${m.active ? 'فعال' : 'غیرفعال'}`).join('\n\n');
    return this.send(chatId, `💳 روش‌های پرداخت\n\n${text}`, AdminBotKeyboard.back('admin:finance'));
  }

  private async listOrders(chatId: number, page: number) {
    const take = 10; const rows: any[] = await this.orders.find({ order: { createdAt: 'DESC' }, skip: (page - 1) * take, take });
    if (!rows.length) return this.send(chatId, 'سفارشی ثبت نشده است.', AdminBotKeyboard.back('admin:orders'));
    const text = rows.map(o => `📦 ${o.id}\nکاربر: ${o.userId}\nمبلغ: ${o.amount} ${o.currency}\nوضعیت: ${o.status}`).join('\n\n');
    return this.send(chatId, `📦 سفارش‌های اخیر\n\n${text}`, { inline_keyboard: [[{ text: '⬅️ مدیریت سفارشات', callback_data: 'admin:orders' }]] });
  }

  private async listUsers(chatId: number, page: number) {
    const take = 10; const rows: any[] = await this.users.find({ order: { createdAt: 'DESC' }, skip: (page - 1) * take, take });
    if (!rows.length) return this.send(chatId, 'کاربری ثبت نشده است.', AdminBotKeyboard.back('admin:users'));
    const text = rows.map(u => `👤 ${[u.firstName, u.lastName].filter(Boolean).join(' ') || 'بدون نام'}\n🆔 ${u.telegramId ?? '-'}\n👤 @${u.username ?? '-'}`).join('\n\n');
    return this.send(chatId, `👥 کاربران\n\n${text}`, { inline_keyboard: [[{ text: '⬅️ مدیریت کاربران', callback_data: 'admin:users' }]] });
  }

  private async notifyUser(userId: string, title: string, body: string) {
    await this.notifications.create(userId, title, body).catch(() => undefined);
    const user: any = await this.users.findOne({ where: { id: userId } });
    if (user?.telegramId) await this.api('sendMessage', { chat_id: user.telegramId, text: `${title}\n\n${body}` });
  }
}

function parseMedia(input: string): ServiceMedia[] {
  if (!input || input.trim() === '-') return [];
  return input.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    const [type, url, ...title] = line.split('|').map(v => v.trim());
    if (type !== 'image' && type !== 'video') throw new Error('رسانه باید image یا video باشد.');
    if (!url) throw new Error('URL رسانه الزامی است.');
    return { type, url, title: title.join('|') || undefined } as ServiceMedia;
  });
}

function parseFaqs(input: string): ServiceFaq[] {
  if (!input || input.trim() === '-') return [];
  return input.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    const [question, ...answer] = line.split('|').map(v => v.trim());
    if (!question || !answer.length) throw new Error('FAQ باید به شکل سوال|پاسخ باشد.');
    return { question, answer: answer.join('|') } as ServiceFaq;
  });
}

function serviceMenu(service: Service): BotKeyboard {
  return { inline_keyboard: [
    [{ text: '✏️ عنوان', callback_data: `service:field:${service.id}:title` }, { text: '📝 توضیحات', callback_data: `service:field:${service.id}:description` }],
    [{ text: '🖥 متن سرویس', callback_data: `service:field:${service.id}:serverText` }, { text: '📜 قوانین', callback_data: `service:field:${service.id}:rulesText` }],
    [{ text: '🖼 رسانه', callback_data: `service:field:${service.id}:media` }, { text: '❓ FAQ', callback_data: `service:field:${service.id}:faqs` }],
    [{ text: '🎨 آیکون', callback_data: `service:field:${service.id}:icon` }],
    [{ text: service.active ? '⏸ غیرفعال کردن' : '▶️ فعال کردن', callback_data: `service:toggle:${service.id}` }],
    [{ text: '🗑 حذف سرویس', callback_data: `service:delete:confirm:${service.id}` }],
    [{ text: '⬅️ مدیریت سرویس‌ها', callback_data: 'admin:services' }],
  ] };
}
