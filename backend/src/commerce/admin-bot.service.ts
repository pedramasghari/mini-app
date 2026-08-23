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

type Button = { text: string; callback_data?: string; web_app?: { url: string } };
type Keyboard = { inline_keyboard: Button[][] };
type State = { action: 'add-service' | 'edit-service' | 'reject'; values: string[]; serviceId?: string; paymentId?: string; field?: string };

@Injectable()
export class AdminBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdminBotService.name);
  private offset = 0;
  private timer?: NodeJS.Timeout;
  private readonly states = new Map<number, State>();
  private readonly notified = new Set<string>();

  constructor(private config: ConfigService, private commerce: CommerceService, private notifications: NotificationsService, @InjectRepository(PaymentMethod) private methods: Repository<PaymentMethod>, @InjectRepository(User) private users: Repository<User>) {}

  onModuleInit() { if (this.config.get('ADMIN_BOT_TOKEN')) void this.poll(); }
  onModuleDestroy() { if (this.timer) clearTimeout(this.timer); }
  private admins() { return String(this.config.get('ADMIN_TELEGRAM_IDS') ?? '').split(',').map(v => v.trim()).filter(Boolean); }
  private allowed(id: number) { return this.admins().includes(String(id)); }
  private appUrl() { return String(this.config.get('MINI_APP_URL') ?? '').trim(); }
  private api(method: string, body: Record<string, unknown>) { const token = this.config.get<string>('ADMIN_BOT_TOKEN'); return fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json() as Promise<any>); }

  private async poll() {
    try {
      const token = this.config.get<string>('ADMIN_BOT_TOKEN'); if (!token) return;
      const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates?timeout=20&offset=${this.offset}`); const data = await r.json() as any;
      for (const update of data.result ?? []) { this.offset = update.update_id + 1; await this.handle(update); }
      await this.notifyNewPayments();
    } catch (e) { this.logger.warn(`خطا در ربات: ${String(e)}`); }
    this.timer = setTimeout(() => void this.poll(), 1000);
  }

  private userKeyboard(): Keyboard { return { inline_keyboard: [[{ text: '🚀 باز کردن فروشگاه', web_app: { url: this.appUrl() } }]] }; }
  private mainKeyboard(): Keyboard { return { inline_keyboard: [[{ text: '🛍 مدیریت سرویس‌ها', callback_data: 'menu:services' }], [{ text: '💰 درخواست‌های شارژ', callback_data: 'menu:payments' }, { text: '💳 کارت‌ها', callback_data: 'menu:cards' }], [{ text: '🚀 باز کردن مینی‌اپ', web_app: { url: this.appUrl() } }]] }; }
  private serviceMenu(): Keyboard { return { inline_keyboard: [[{ text: '➕ افزودن سرویس', callback_data: 'service:add' }], [{ text: '✏️ ویرایش سرویس', callback_data: 'service:edit:list' }, { text: '🗑 حذف سرویس', callback_data: 'service:delete:list' }], [{ text: '📋 فهرست سرویس‌ها', callback_data: 'service:list' }], [{ text: '⬅️ منوی اصلی', callback_data: 'menu:main' }]] }; }
  private serviceFields(s: Service): Keyboard { return { inline_keyboard: [[{ text: '✏️ عنوان', callback_data: `service:field:${s.id}:title` }, { text: '📝 توضیحات', callback_data: `service:field:${s.id}:description` }], [{ text: '🖥 متن سرویس', callback_data: `service:field:${s.id}:serverText` }, { text: '📜 قوانین', callback_data: `service:field:${s.id}:rulesText` }], [{ text: '🖼 رسانه آموزشی', callback_data: `service:field:${s.id}:media` }, { text: '❓ سوالات متداول', callback_data: `service:field:${s.id}:faqs` }], [{ text: '🔖 شناسه و آیکون', callback_data: `service:field:${s.id}:slugIcon` }], [{ text: s.active ? '⏸ غیرفعال کردن' : '▶️ فعال کردن', callback_data: `service:toggle:${s.id}` }], [{ text: '🗑 حذف سرویس', callback_data: `service:delete:confirm:${s.id}` }], [{ text: '⬅️ بازگشت', callback_data: 'service:edit:list' }]] }; }

  private async handle(update: any) {
    if (update.callback_query) return this.callback(update.callback_query);
    const m = update.message; if (!m?.from) return; const id = Number(m.from.id);
    if (!this.allowed(id)) { if (this.appUrl()) await this.send(m.chat.id, '👋 برای استفاده از خدمات فقط مینی‌اپ را باز کنید.', this.userKeyboard()); return; }
    const state = this.states.get(id); const text = String(m.text ?? '').trim();
    if (state) return this.stateMessage(m.chat.id, id, text, state);
    return this.send(m.chat.id, '🤖 پنل مدیریت\n\nتمام عملیات مدیریتی را از منوی زیر انجام دهید.', this.mainKeyboard());
  }

  private async callback(q: any) {
    const adminId = Number(q.from?.id); if (!adminId || !this.allowed(adminId)) { await this.api('answerCallbackQuery', { callback_query_id: q.id, text: 'دسترسی مجاز نیست.', show_alert: true }); return; }
    await this.api('answerCallbackQuery', { callback_query_id: q.id }); const chatId = Number(q.message?.chat?.id); const d = String(q.data ?? '');
    try {
      if (d === 'menu:main') return this.send(chatId, '🤖 منوی اصلی مدیریت', this.mainKeyboard());
      if (d === 'menu:services') return this.send(chatId, '🛍 مدیریت سرویس‌ها', this.serviceMenu());
      if (d === 'menu:payments') return this.sendPending(chatId);
      if (d === 'menu:cards') return this.sendCards(chatId);
      if (d === 'service:add') return this.startAdd(chatId, adminId);
      if (d === 'service:list') return this.serviceList(chatId, true);
      if (d === 'service:edit:list') return this.serviceList(chatId, false, 'edit');
      if (d === 'service:delete:list') return this.serviceList(chatId, false, 'delete');
      if (d.startsWith('service:edit:')) { const s = await this.commerce.getService(d.slice(13)); return this.send(chatId, `✏️ ویرایش «${s.title}»`, this.serviceFields(s)); }
      if (d.startsWith('service:toggle:')) { const s = await this.commerce.getService(d.slice(15)); const u = await this.commerce.updateService(s.id, { active: !s.active }); return this.send(chatId, `✅ «${u.title}» ${u.active ? 'فعال' : 'غیرفعال'} شد.`, this.serviceFields(u)); }
      if (d.startsWith('service:delete:confirm:')) { const s = await this.commerce.getService(d.slice(23)); return this.send(chatId, `⚠️ سرویس «${s.title}» غیرفعال شود؟\nسفارش‌های قبلی حفظ می‌شوند.`, { inline_keyboard: [[{ text: '🗑 تأیید حذف', callback_data: `service:delete:yes:${s.id}` }, { text: 'انصراف', callback_data: `service:edit:${s.id}` }]] }); }
      if (d.startsWith('service:delete:yes:')) { const s = await this.commerce.deleteService(d.slice(20)); return this.send(chatId, `✅ «${s.title}» حذف شد.`, this.serviceMenu()); }
      if (d.startsWith('service:field:')) { const [, , id, field] = d.split(':'); this.states.set(adminId, { action: 'edit-service', values: [], serviceId: id, field }); const prompts: Record<string, string> = { title: 'عنوان جدید را ارسال کنید:', description: 'توضیحات جدید را ارسال کنید:', serverText: 'متن اختصاصی سرویس را ارسال کنید؛ برای حذف «-» بفرستید:', rulesText: 'قوانین را ارسال کنید؛ برای حذف «-» بفرستید:', media: 'رسانه‌ها را هرکدام در یک خط بفرستید:\nimage|URL|عنوان\nvideo|URL|عنوان\nبرای حذف همه «-» بفرستید:', faqs: 'FAQ را هرکدام در یک خط بفرستید:\nسوال|پاسخ\nبرای حذف همه «-» بفرستید:', slugIcon: 'به شکل slug|icon ارسال کنید:' }; return this.send(chatId, prompts[field] ?? 'مقدار جدید را ارسال کنید:', { inline_keyboard: [[{ text: '❌ انصراف', callback_data: `service:edit:${id}` }]] }); }
      if (d.startsWith('approve:')) { const p = await this.commerce.approvePayment(d.slice(8), 'تأیید توسط ادمین'); await this.notifyCustomer(p.userId, '✅ شارژ حساب با موفقیت انجام شد', `مبلغ ${p.amount} ${p.currency} به کیف پول شما اضافه شد.`); return this.send(chatId, '✅ درخواست شارژ تأیید و کیف پول کاربر شارژ شد.', this.mainKeyboard()); }
      if (d.startsWith('reject:')) { this.states.set(adminId, { action: 'reject', values: [], paymentId: d.slice(7) }); return this.send(chatId, '✍️ دلیل رد درخواست را ارسال کنید:', { inline_keyboard: [[{ text: '❌ انصراف', callback_data: 'menu:payments' }]] }); }
    } catch (e) { return this.send(chatId, `❌ عملیات انجام نشد: ${e instanceof Error ? e.message : 'خطای نامشخص'}`); }
  }

  private async startAdd(chatId: number, adminId: number) { this.states.set(adminId, { action: 'add-service', values: [] }); return this.send(chatId, '➕ افزودن سرویس\nمرحله ۱ از ۸\nشناسه انگلیسی را بفرستید؛ مثال: apple-id', { inline_keyboard: [[{ text: '❌ انصراف', callback_data: 'menu:services' }]] }); }

  private async stateMessage(chatId: number, adminId: number, text: string, state: State) {
    if (text === '/cancel') { this.states.delete(adminId); return this.send(chatId, 'عملیات لغو شد.', this.mainKeyboard()); }
    if (state.action === 'reject') { this.states.delete(adminId); const r = await this.commerce.rejectPayment(state.paymentId!, text); await this.notifyCustomer(r.userId, '❌ درخواست شارژ تأیید نشد', r.adminReason ?? 'درخواست رد شد.'); return this.send(chatId, '❌ درخواست رد شد.', this.mainKeyboard()); }
    if (state.action === 'edit-service') {
      const id = state.serviceId!; let patch: any;
      if (state.field === 'title') patch = { title: text }; else if (state.field === 'description') patch = { description: text }; else if (state.field === 'serverText') patch = { serverText: text === '-' ? null : text }; else if (state.field === 'rulesText') patch = { rulesText: text === '-' ? null : text }; else if (state.field === 'media') patch = { media: parseMedia(text) }; else if (state.field === 'faqs') patch = { faqs: parseFaqs(text) }; else if (state.field === 'slugIcon') { const [slug, icon] = text.split('|').map(v => v.trim()); patch = { slug, icon }; }
      const s = await this.commerce.updateService(id, patch); this.states.delete(adminId); return this.send(chatId, `✅ «${s.title}» به‌روزرسانی شد.`, this.serviceFields(s));
    }
    state.values.push(text);
    const prompts = ['عنوان فارسی سرویس:', 'توضیح کوتاه سرویس:', 'آیکون سرویس؛ مثال apple یا box:', 'متن اختصاصی سرویس؛ در صورت نبود «-»:', 'قوانین سرویس؛ در صورت نبود «-»:', 'رسانه‌ها؛ هر خط image|URL|عنوان یا video|URL|عنوان؛ در صورت نبود «-»:', 'FAQ؛ هر خط سوال|پاسخ؛ در صورت نبود «-»:'];
    if (state.values.length < 8) return this.send(chatId, `مرحله ${state.values.length + 1} از ۸\n${prompts[state.values.length - 1]}`, { inline_keyboard: [[{ text: '❌ انصراف', callback_data: 'menu:services' }]] });
    const [slug, title, description, icon, serverText, rulesText, mediaText, faqText] = state.values;
    const created = await this.commerce.createService({ slug, title, description, icon, serverText: serverText === '-' ? null : serverText, rulesText: rulesText === '-' ? null : rulesText, media: parseMedia(mediaText), faqs: parseFaqs(faqText) });
    this.states.delete(adminId);
    return this.send(chatId, `✅ سرویس «${created.title}» با موفقیت ساخته شد.`, this.serviceFields(created));
  }

  private async serviceList(chatId: number, includeInactive: boolean, mode?: 'edit' | 'delete') { const rows = await this.commerce.listServices(includeInactive); if (!rows.length) return this.send(chatId, 'سرویسی وجود ندارد.', this.serviceMenu()); const buttons = rows.map(s => [{ text: `${s.active ? '🟢' : '⚪'} ${s.title}`, callback_data: mode === 'delete' ? `service:delete:confirm:${s.id}` : `service:edit:${s.id}` }]); buttons.push([{ text: '⬅️ بازگشت', callback_data: 'menu:services' }]); return this.send(chatId, mode === 'delete' ? 'سرویس موردنظر برای حذف را انتخاب کنید:' : mode === 'edit' ? 'سرویس موردنظر برای ویرایش را انتخاب کنید:' : '📋 فهرست سرویس‌ها', { inline_keyboard: buttons }); }

  private async notifyNewPayments() { for (const p of await this.commerce.pendingPayments()) { if (this.notified.has(p.id)) continue; this.notified.add(p.id); const u = await this.users.findOne({ where: { id: p.userId } }); const name = [u?.firstName, u?.lastName].filter(Boolean).join(' ') || 'بدون نام'; const text = ['💰 درخواست شارژ کیف پول', '', `شناسه: ${p.id}`, `👤 کاربر: ${name}`, `🆔 ${u?.username ? '@' + u.username : 'بدون نام کاربری'}`, `📱 تلگرام: ${u?.telegramId ?? 'نامشخص'}`, `💵 مبلغ: ${p.amount} ${p.currency}`, '📌 وضعیت: در انتظار بررسی'].join('\n'); const kb: Keyboard = { inline_keyboard: [[{ text: '✅ تأیید شارژ', callback_data: `approve:${p.id}` }, { text: '❌ رد درخواست', callback_data: `reject:${p.id}` }]] }; for (const a of this.admins()) { const chat = Number(a); if (Number.isSafeInteger(chat)) { await this.send(chat, text, kb); if (p.receiptPath) await this.sendReceipt(chat, p.receiptPath, `🧾 فیش واریزی ${p.id}`); } } } }
  private async sendPending(chatId: number) { const rows = await this.commerce.pendingPayments(); if (!rows.length) return this.send(chatId, 'درخواستی در انتظار بررسی نیست.', this.mainKeyboard()); for (const p of rows) { const u = await this.users.findOne({ where: { id: p.userId } }); await this.send(chatId, `💰 درخواست شارژ\n\nشناسه: ${p.id}\n👤 کاربر: ${[u?.firstName, u?.lastName].filter(Boolean).join(' ') || 'بدون نام'}\n🆔 ${u?.username ? '@' + u.username : u?.telegramId}\n💵 مبلغ: ${p.amount} ${p.currency}`, { inline_keyboard: [[{ text: '✅ تأیید شارژ', callback_data: `approve:${p.id}` }, { text: '❌ رد درخواست', callback_data: `reject:${p.id}` }], [{ text: '⬅️ منوی اصلی', callback_data: 'menu:main' }]] }); if (p.receiptPath) await this.sendReceipt(chatId, p.receiptPath, `🧾 فیش واریزی ${p.id}`); } }
  private async sendCards(chatId: number) { const cards = await this.methods.find({ where: { active: true }, order: { createdAt: 'DESC' } }); return this.send(chatId, cards.length ? cards.map(c => `• ${c.bankName ?? 'بانک'} — ${c.cardNumber.slice(0, 4)} **** **** ${c.cardNumber.slice(-4)} — ${c.holderName}`).join('\n') : 'هیچ کارت فعالی ثبت نشده است.', this.mainKeyboard()); }
  private async notifyCustomer(userId: string, title: string, text: string) { const u = await this.users.findOne({ where: { id: userId } }); if (!u || this.notifications.isOnline(userId)) return; const chat = Number(u.telegramId); if (Number.isSafeInteger(chat)) await this.send(chat, `${title}\n\n${text}`, this.userKeyboard()); }
  private async send(chatId: number, text: string, reply_markup?: Keyboard) { return this.api('sendMessage', { chat_id: chatId, text, ...(reply_markup ? { reply_markup } : {}) }); }
  private async sendReceipt(chatId: number, path: string, caption: string) { const token = this.config.get<string>('ADMIN_BOT_TOKEN'); if (!token) return; const bytes = await readFile(path); const form = new FormData(); form.append('chat_id', String(chatId)); form.append('caption', caption); const ext = extname(path).toLowerCase(); const field = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? 'photo' : 'document'; form.append(field, new Blob([bytes]), path.split(/[\\/]/).pop() ?? 'receipt'); await fetch(`https://api.telegram.org/bot${token}/${field === 'photo' ? 'sendPhoto' : 'sendDocument'}`, { method: 'POST', body: form }); }
}

function parseMedia(text: string): ServiceMedia[] { if (text.trim() === '-') return []; return text.split('\n').map(x => x.trim()).filter(Boolean).map(line => { const [type, url, title] = line.split('|').map(v => v.trim()); if (type !== 'image' && type !== 'video') throw new Error('نوع رسانه باید image یا video باشد.'); if (!url) throw new Error('آدرس رسانه الزامی است.'); return { type, url, title }; }); }
function parseFaqs(text: string): ServiceFaq[] { if (text.trim() === '-') return []; return text.split('\n').map(x => x.trim()).filter(Boolean).map(line => { const i = line.indexOf('|'); if (i <= 0) throw new Error('فرمت FAQ باید سوال|پاسخ باشد.'); return { question: line.slice(0, i).trim(), answer: line.slice(i + 1).trim() }; }); }
