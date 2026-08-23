import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { CommerceService } from './commerce.service';
import { PaymentMethod, Service, ServiceFaq, ServiceMedia } from './entities/commerce.entity';

type Button = { text: string; callback_data?: string; web_app?: { url: string }; url?: string };
type InlineKeyboardMarkup = { inline_keyboard: Button[][] };
type State = { action: string; values: string[]; serviceId?: string; paymentId?: string; field?: string };

@Injectable()
export class AdminBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdminBotService.name);
  private offset = 0;
  private timer?: NodeJS.Timeout;
  private readonly states = new Map<number, State>();
  private readonly notified = new Set<string>();

  constructor(
    private config: ConfigService,
    private commerce: CommerceService,
    private notifications: NotificationsService,
    @InjectRepository(PaymentMethod) private methods: Repository<PaymentMethod>,
    @InjectRepository(User) private users: Repository<User>,
  ) {}

  onModuleInit() { if (this.config.get('ADMIN_BOT_TOKEN')) void this.poll(); }
  onModuleDestroy() { if (this.timer) clearTimeout(this.timer); }

  private admins() { return String(this.config.get('ADMIN_TELEGRAM_IDS') ?? '').split(',').map(v => v.trim()).filter(Boolean); }
  private allowed(id: number) { return this.admins().includes(String(id)); }
  private miniAppUrl() { return String(this.config.get('MINI_APP_URL') ?? '').trim(); }

  private api(method: string, body: Record<string, unknown>) {
    const token = this.config.get<string>('ADMIN_BOT_TOKEN');
    return fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json() as Promise<any>);
  }

  private async poll() {
    try {
      const token = this.config.get<string>('ADMIN_BOT_TOKEN');
      if (!token) return;
      const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?timeout=20&offset=${this.offset}`);
      const json = await response.json() as any;
      for (const update of json.result ?? []) { this.offset = update.update_id + 1; await this.handle(update); }
      await this.notifyNewPayments();
    } catch (error) { this.logger.warn(`خطا در ارتباط ربات: ${String(error)}`); }
    this.timer = setTimeout(() => void this.poll(), 1000);
  }

  private mainKeyboard(admin: boolean): InlineKeyboardMarkup {
    if (!admin) return { inline_keyboard: [[{ text: '🚀 باز کردن فروشگاه', web_app: { url: this.miniAppUrl() } }]] };
    return { inline_keyboard: [
      [{ text: '🛍 مدیریت سرویس‌ها', callback_data: 'menu:services' }],
      [{ text: '💰 درخواست‌های شارژ', callback_data: 'menu:payments' }, { text: '💳 مدیریت کارت‌ها', callback_data: 'menu:cards' }],
      [{ text: '🚀 باز کردن مینی‌اپ', web_app: { url: this.miniAppUrl() } }],
    ] };
  }

  private serviceMenu(): InlineKeyboardMarkup { return { inline_keyboard: [
    [{ text: '➕ افزودن سرویس', callback_data: 'service:add' }],
    [{ text: '✏️ ویرایش سرویس', callback_data: 'service:edit:list' }, { text: '🗑 حذف سرویس', callback_data: 'service:delete:list' }],
    [{ text: '📋 فهرست سرویس‌ها', callback_data: 'service:list' }],
    [{ text: '⬅️ منوی اصلی', callback_data: 'menu:main' }],
  ] }; }

  private serviceFieldMenu(service: Service): InlineKeyboardMarkup { return { inline_keyboard: [
    [{ text: '✏️ عنوان', callback_data: `service:field:${service.id}:title` }, { text: '📝 توضیحات', callback_data: `service:field:${service.id}:description` }],
    [{ text: '🖥 متن اختصاصی سرویس', callback_data: `service:field:${service.id}:serverText` }],
    [{ text: '📜 قوانین', callback_data: `service:field:${service.id}:rulesText` }],
    [{ text: '🖼 آموزش تصویری/ویدیویی', callback_data: `service:field:${service.id}:media` }],
    [{ text: '❓ سوالات متداول', callback_data: `service:field:${service.id}:faqs` }],
    [{ text: '🔖 شناسه و آیکون', callback_data: `service:field:${service.id}:slugIcon` }],
    [{ text: service.active ? '⏸ غیرفعال کردن' : '▶️ فعال کردن', callback_data: `service:toggle:${service.id}` }],
    [{ text: '🗑 حذف سرویس', callback_data: `service:delete:confirm:${service.id}` }],
    [{ text: '⬅️ بازگشت', callback_data: 'service:edit:list' }],
  ] }; }

  private async handle(update: any) {
    if (update.callback_query) return this.callback(update.callback_query);
    const message = update.message;
    if (!message?.from) return;
    const userId = Number(message.from.id);
    if (!this.allowed(userId)) {
      const url = this.miniAppUrl();
      if (url) await this.send(message.chat.id, '👋 به فروشگاه خوش آمدید. برای استفاده از خدمات، مینی‌اپ را باز کنید.', this.mainKeyboard(false));
      return;
    }
    const state = this.states.get(userId);
    const text = String(message.text ?? '').trim();
    if (state) return this.stateMessage(message.chat.id, userId, text, state);
    if (text === '/start' || text === '/menu' || text === '/help') return this.send(message.chat.id, '🤖 پنل مدیریت\n\nهمه عملیات مدیریتی را از منوی زیر انجام دهید.', this.mainKeyboard(true));
    return this.send(message.chat.id, 'از منوی مدیریت استفاده کنید.', this.mainKeyboard(true));
  }

  private async callback(query: any) {
    const adminId = Number(query.from?.id);
    if (!adminId || !this.allowed(adminId)) {
      await this.api('answerCallbackQuery', { callback_query_id: query.id, text: 'دسترسی مجاز نیست.', show_alert: true });
      return;
    }
    await this.api('answerCallbackQuery', { callback_query_id: query.id });
    const chatId = Number(query.message?.chat?.id);
    const data = String(query.data ?? '');
    try {
      if (data === 'menu:main') return this.send(chatId, '🤖 منوی اصلی مدیریت', this.mainKeyboard(true));
      if (data === 'menu:services') return this.send(chatId, '🛍 مدیریت سرویس‌ها\n\nافزودن، ویرایش، فعال/غیرفعال و حذف سرویس.', this.serviceMenu());
      if (data === 'menu:payments') return this.sendPending(chatId);
      if (data === 'menu:cards') return this.sendCards(chatId);
      if (data === 'service:list') return this.sendServiceList(chatId, true);
      if (data === 'service:add') return this.startAddService(chatId, adminId);
      if (data === 'service:edit:list') return this.sendServiceList(chatId, false, 'edit');
      if (data === 'service:delete:list') return this.sendServiceList(chatId, false, 'delete');

      if (data.startsWith('service:edit:')) {
        const service = await this.commerce.getService(data.slice('service:edit:'.length));
        return this.send(chatId, `✏️ ویرایش سرویس «${service.title}»`, this.serviceFieldMenu(service));
      }
      if (data.startsWith('service:delete:confirm:')) {
        const id = data.slice('service:delete:confirm:'.length);
        const service = await this.commerce.getService(id);
        return this.send(chatId, `⚠️ آیا سرویس «${service.title}» غیرفعال شود؟\n\nبرای حفظ سفارش‌های قبلی، حذف به‌صورت نرم انجام می‌شود.`, { inline_keyboard: [[{ text: '🗑 بله، حذف کن', callback_data: `service:delete:yes:${id}` }, { text: 'انصراف', callback_data: `service:edit:${id}` }]] });
      }
      if (data.startsWith('service:delete:yes:')) {
        const id = data.slice('service:delete:yes:'.length);
        const service = await this.commerce.deleteService(id);
        return this.send(chatId, `✅ سرویس «${service.title}» غیرفعال شد.`, this.serviceMenu());
      }
      if (data.startsWith('service:toggle:')) {
        const id = data.slice('service:toggle:'.length);
        const service = await this.commerce.getService(id);
        const updated = await this.commerce.updateService(id, { active: !service.active });
        return this.send(chatId, `✅ وضعیت «${updated.title}» به «${updated.active ? 'فعال' : 'غیرفعال'}» تغییر کرد.`, this.serviceFieldMenu(updated));
      }
      if (data.startsWith('service:field:')) {
        const [, , serviceId, field] = data.split(':');
        this.states.set(adminId, { action: 'edit-service', values: [], serviceId, field });
        const prompts: Record<string, string> = {
          title: 'عنوان جدید سرویس را ارسال کنید:',
          description: 'توضیحات جدید سرویس را ارسال کنید:',
          serverText: 'متن اختصاصی سرویس را ارسال کنید. برای خالی کردن «-» بفرستید:',
          rulesText: 'متن قوانین را ارسال کنید. برای خالی کردن «-» بفرستید:',
          media: 'هر رسانه را در یک خط به شکل زیر بفرستید:\nimage|https://...|عنوان\nvideo|https://...|عنوان\nبرای حذف همه رسانه‌ها «-» بفرستید:',
          faqs: 'هر سوال را در یک خط به شکل «سوال|پاسخ» بفرستید. برای حذف همه «-» بفرستید:',
          slugIcon: 'شناسه و آیکون را در یک خط بفرستید: slug|icon',
        };
        return this.send(chatId, prompts[field] ?? 'مقدار جدید را ارسال کنید:', { inline_keyboard: [[{ text: '❌ انصراف', callback_data: `service:edit:${serviceId}` }]] });
      }
      if (data.startsWith('service:add:confirm')) return this.confirmAddService(chatId, adminId);
      if (data.startsWith('approve:')) {
        const id = data.slice(8);
        const payment = await this.commerce.approvePayment(id, 'تأیید توسط ادمین');
        await this.notifyCustomer(payment.userId, '✅ شارژ حساب با موفقیت انجام شد', `مبلغ ${payment.amount} ${payment.currency} به کیف پول شما اضافه شد.`);
        return this.send(chatId, `✅ درخواست ${id} تأیید شد و کیف پول کاربر شارژ شد.`);
      }
      if (data.startsWith('reject:')) {
        const id = data.slice(7);
        this.states.set(adminId, { action: 'reject', values: [], paymentId: id });
        return this.send(chatId, '✍️ لطفاً دلیل رد درخواست را ارسال کنید:', { inline_keyboard: [[{ text: '❌ انصراف', callback_data: 'menu:payments' }]] });
      }
    } catch (error) { return this.send(chatId, `❌ عملیات انجام نشد: ${error instanceof Error ? error.message : 'خطای نامشخص'}`); }
  }

  private async startAddService(chatId: number, adminId: number) {
    this.states.set(adminId, { action: 'add-service', values: [] });
    return this.send(chatId, '➕ افزودن سرویس جدید\n\nمرحله ۱ از ۸\nشناسه انگلیسی سرویس را ارسال کنید؛ مثال: apple-id', { inline_keyboard: [[{ text: '❌ انصراف', callback_data: 'menu:services' }]] });
  }

  private async stateMessage(chatId: number, adminId: number, text: string, state: State) {
    if (text === '/cancel') { this.states.delete(adminId); return this.send(chatId, 'عملیات لغو شد.', this.mainKeyboard(true)); }
    if (state.action === 'reject') {
      this.states.delete(adminId);
      const result = await this.commerce.rejectPayment(state.paymentId!, text);
      await this.notifyCustomer(result.userId, '❌ درخواست شارژ تأیید نشد', result.adminReason ?? 'درخواست شارژ شما تأیید نشد.');
      return this.send(chatId, '❌ درخواست رد شد و نتیجه برای کاربر ارسال شد.', this.mainKeyboard(true));
    }
    if (state.action === 'add-service') return thisaddServiceStep(chatId, adminId, state, text);
    if (state.action === 'edit-service') {
      const serviceId = state.serviceId!;
      let patch: any;
      if (state.field === 'title') patch = { title: text };
      else if (state.field === 'description') patch = { description: text };
      else if (state.field === 'serverText') patch = { serverText: text === '-' ? null : text };
      else if (state.field === 'rulesText') patch = { rulesText: text === '-' ? null : text };
      else if (state.field === 'media') patch = { media: parseMedia(text) };
      else if (state.field === 'faqs') patch = { faqs: parseFaqs(text) };
      else if (state.field === 'slugIcon') { const [slug, icon] = text.split('|').map(v => v.trim()); patch = { slug, icon }; }
      const updated = await this.commerce.updateService(serviceId, patch);
      this.states.delete(adminId);
      return this.send(chatId, `✅ سرویس «${updated.title}» به‌روزرسانی شد.`, this.serviceFieldMenu(updated));
    }
  }

  private async sendServiceList(chatId: number, includeInactive: boolean, mode?: 'edit' | 'delete') {
    const rows = await this.commerce.listServices(includeInactive);
    if (!rows.length) return this.send(chatId, 'هیچ سرویسی ثبت نشده است.', this.serviceMenu());
    const buttons = rows.map(s => [{ text: `${s.active ? '🟢' : '⚪'} ${s.title}`, callback_data: mode === 'edit' ? `service:edit:${s.id}` : mode === 'delete' ? `service:delete:confirm:${s.id}` : `service:edit:${s.id}` }]);
    buttons.push([{ text: '⬅️ بازگشت', callback_data: 'menu:services' }]);
    return this.send(chatId, mode === 'edit' ? 'یک سرویس را برای ویرایش انتخاب کنید:' : mode === 'delete' ? 'یک سرویس را برای حذف انتخاب کنید:' : '📋 فهرست سرویس‌ها:', { inline_keyboard: buttons });
  }

  private async notifyNewPayments() {
    const rows = await this.commerce.pendingPayments();
    for (const p of rows) {
      if (this.notified.has(p.id)) continue;
      this.notified.add(p.id);
      const user = await this.users.findOne({ where: { id: p.userId } });
      const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'بدون نام';
      const username = user?.username ? `@${user.username}` : 'بدون نام کاربری';
      const text = ['💰 درخواست شارژ کیف پول', '', `شناسه درخواست: ${p.id}`, `👤 نام کاربر: ${userName}`, `🆔 نام کاربری: ${username}`, `📱 شناسه تلگرام: ${user?.telegramId ?? 'نامشخص'}`, `💵 مبلغ: ${p.amount} ${p.currency}`, '🕐 وضعیت: در انتظار بررسی', '', 'لطفاً فیش واریزی را بررسی کنید.'].join('\n');
      const keyboard: InlineKeyboardMarkup = { inline_keyboard: [[{ text: '✅ تأیید شارژ', callback_data: `approve:${p.id}` }, { text: '❌ رد درخواست', callback_data: `reject:${p.id}` }]] };
      for (const admin of this.admins()) { const chatId = Number(admin); if (!Number.isSafeInteger(chatId)) continue; await this.send(chatId, text, keyboard); if (p.receiptPath) await this.sendReceipt(chatId, p.receiptPath, `🧾 فیش واریزی درخواست ${p.id}`); }
    }
  }

  private async sendPending(chatId: number) {
    const rows = await this.commerce.pendingPayments();
    if (!rows.length) return this.send(chatId, 'در حال حاضر درخواست شارژ در انتظاری وجود ندارد.', this.mainKeyboard(true));
    for (const p of rows) {
      const user = await this.users.findOne({ where: { id: p.userId } });
      await this.send(chatId, `💰 درخواست شارژ\n\nشناسه: ${p.id}\n👤 کاربر: ${[user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'بدون نام'}\n🆔 ${user?.username ? '@' + user.username : user?.telegramId}\n💵 مبلغ: ${p.amount} ${p.currency}\n📌 وضعیت: ${p.status}`, { inline_keyboard: [[{ text: '✅ تأیید شارژ', callback_data: `approve:${p.id}` }, { text: '❌ رد درخواست', callback_data: `reject:${p.id}` }], [{ text: '⬅️ منوی اصلی', callback_data: 'menu:main' }]] });
      if (p.receiptPath) await this.sendReceipt(chatId, p.receiptPath, `🧾 فیش واریزی ${p.id}`);
    }
  }

  private async sendCards(chatId: number) {
    const cards = await this.methods.find({ where: { active: true }, order: { createdAt: 'DESC' } });
    if (!cards.length) return this.send(chatId, 'هیچ کارت فعالی ثبت نشده است.', this.mainKeyboard(true));
    return this.send(chatId, cards.map(c => `• ${c.bankName ?? 'بانک'} — ${c.cardNumber.slice(0, 4)} **** **** ${c.cardNumber.slice(-4)} — ${c.holderName}`).join('\n'), this.mainKeyboard(true));
  }

  private async notifyCustomer(userId: string, title: string, text: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || this.notifications.isOnline(userId)) return;
    const chatId = Number(user.telegramId); if (Number.isSafeInteger(chatId)) await this.send(chatId, `${title}\n\n${text}`, this.mainKeyboard(false));
  }

  private async send(chatId: number, text: string, reply_markup?: InlineKeyboardMarkup) { return this.api('sendMessage', { chat_id: chatId, text, ...(reply_markup ? { reply_markup } : {}) }); }

  private async sendReceipt(chatId: number, path: string, caption: string) {
    const token = this.config.get<string>('ADMIN_BOT_TOKEN'); if (!token) return;
    const bytes = await readFile(path); const form = new FormData(); form.append('chat_id', String(chatId)); form.append('caption', caption);
    const extension = extname(path).toLowerCase(); const field = ['.jpg', '.jpeg', '.png', '.webp'].includes(extension) ? 'photo' : 'document';
    form.append(field, new Blob([bytes]), path.split(/[\\/]/).pop() ?? 'receipt');
    await fetch(`https://api.telegram.org/bot${token}/${field === 'photo' ? 'sendPhoto' : 'sendDocument'}`, { method: 'POST', body: form });
  }
}

async function thisaddServiceStep(chatId: number, adminId: number, state: State, text: string) {
  state.values.push(text);
  const prompts = [
    'مرحله ۲ از ۸\nعنوان فارسی سرویس را ارسال کنید:',
    'مرحله ۳ از ۸\nتوضیح کوتاه سرویس را ارسال کنید:',
    'مرحله ۴ از ۸\nآیکون سرویس را ارسال کنید؛ مثال: apple یا box:',
    'مرحله ۵ از ۸\nمتن اختصاصی سرویس را ارسال کنید؛ اگر ندارید «-»:',
    'مرحله ۶ از ۸\nمتن قوانین سرویس را ارسال کنید؛ اگر ندارید «-»:',
    'مرحله ۷ از ۸\nرسانه‌ها را هرکدام در یک خط بفرستید: image|URL|عنوان یا video|URL|عنوان\nاگر ندارید «-»:',
    'مرحله ۸ از ۸\nسوالات متداول را هرکدام در یک خط بفرستید: سوال|پاسخ\nاگر ندارید «-»:',
  ];
  if (state.values.length < 8) return undefined;
  const [slug, title, description, icon, serverText, rulesText, mediaText, faqText] = state.values;
  const servicePayload = { slug, title, description, icon, serverText: serverText === '-' ? null : serverText, rulesText: rulesText === '-' ? null : rulesText, media: parseMedia(mediaText), faqs: parseFaqs(faqText) };
  (state as any).preview = servicePayload;
  return undefined;
}

function parseMedia(text: string): ServiceMedia[] {
  if (text.trim() === '-') return [];
  return text.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    const [type, url, title] = line.split('|').map(v => v.trim());
    if (type !== 'image' && type !== 'video') throw new Error('نوع رسانه باید image یا video باشد.');
    if (!url) throw new Error('آدرس رسانه وارد نشده است.');
    return { type, url, title };
  });
}

function parseFaqs(text: string): ServiceFaq[] {
  if (text.trim() === '-') return [];
  return text.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    const index = line.indexOf('|');
    if (index <= 0) throw new Error('فرمت سوال متداول باید «سوال|پاسخ» باشد.');
    return { question: line.slice(0, index).trim(), answer: line.slice(index + 1).trim() };
  });
}
