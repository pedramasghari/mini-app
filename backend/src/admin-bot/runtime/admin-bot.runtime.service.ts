import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bot, Context, InputFile } from 'grammy';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { CommerceService } from '../../commerce/commerce.service';
import { NotificationsService } from '../../notifications/notifications.service';
import {
  PaymentMethod,
  PaymentRequest,
  Order,
  Service,
  ServiceFaq,
  ServiceMedia,
} from '../../commerce/entities/commerce.entity';
import { User } from '../../users/entities/user.entity';
import { AdminBotConversationService } from '../conversations/admin-bot.conversation.service';
import { AdminBotKeyboard } from '../keyboard/admin-bot.keyboard';
import type { BotKeyboard } from '../admin-bot.types';
import { InlineKeyboardMarkup } from '@grammyjs/conversations/out/deps.node';
import { ReplyKeyboardMarkup } from 'node_modules/grammy/out/types.node';

const proxyUrl = process.env.TELEGRAM_PROXY_URL ?? 'http://127.0.0.1:2080';
const agent = new HttpsProxyAgent(proxyUrl);

@Injectable()
export class AdminBotRuntimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdminBotRuntimeService.name);
  private readonly bot: Bot<Context>;
  private running = false;
  private startPromise?: Promise<void>;

  constructor(
    private readonly config: ConfigService,
    private readonly commerce: CommerceService,
    private readonly notifications: NotificationsService,
    private readonly conversations: AdminBotConversationService,
    @InjectRepository(Service) private readonly services: Repository<Service>,
    @InjectRepository(PaymentRequest)
    private readonly payments: Repository<PaymentRequest>,
    @InjectRepository(PaymentMethod)
    private readonly methods: Repository<PaymentMethod>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    this.bot = new Bot<Context>(this.token(), {
      client: {
        baseFetchConfig: {
          agent,
          compress: true,
        },
      },
    });

    this.registerHandlers();

    this.bot.catch((error) => {
      this.logger.error('🚨 BOT ERROR', error.error);
    });
  }

  async onModuleInit() {
    const token = this.token();
    if (!token) {
      this.logger.warn('ADMIN_BOT_TOKEN تنظیم نشده است؛ ربات اجرا نشد.');
      return;
    }

    if (!this.adminIds().length) {
      this.logger.warn(
        'ADMIN_TELEGRAM_IDS تنظیم نشده است؛ کاربران غیرادمین فقط Mini App را می‌بینند.',
      );
    }

    try {
      // Polling و webhook همزمان قابل استفاده نیستند.
      // حذف webhook قبلی باعث می‌شود getUpdates واقعاً شروع به کار کند.
      await this.bot.api.deleteWebhook({ drop_pending_updates: false });

      const me = await this.bot.api.getMe();
      this.logger.log(`Telegram bot connected: @${me.username}`);
      this.logger.log(`Telegram proxy: ${proxyUrl}`);

      this.running = true;
      this.startPromise = this.bot.start({
        allowed_updates: ['message', 'callback_query'],
        onStart: (info) => {
          this.logger.log(`Telegram polling started: @${info.username}`);
        },
      });

      // bot.start() عمداً بدون await اجرا می‌شود تا NestJS startup را block نکند.
      void this.startPromise.catch((error) => {
        if (this.running) {
          this.logger.error(
            `Telegram polling stopped: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      });
    } catch (error) {
      this.running = false;
      this.logger.error(
        `Telegram bot initialization failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async onModuleDestroy() {
    this.running = false;
    try {
      await this.bot.stop();
    } catch (error) {
      this.logger.warn(
        `Telegram bot stop failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private token() {
    return String(this.config.get('ADMIN_BOT_TOKEN') ?? '').trim();
  }

  private appUrl() {
    return String(this.config.get('MINI_APP_URL') ?? '').trim();
  }

  private adminIds() {
    return String(
      this.config.get('ADMIN_TELEGRAM_IDS') ??
        this.config.get('ADMIN_TELEGRAM_ID') ??
        '',
    )
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }

  private isAdmin(id: number) {
    return this.adminIds().includes(String(id));
  }

  private registerHandlers() {
    this.bot.command('start', async (ctx) => {
      const id = ctx.from?.id;

      if (id === undefined) {
        return;
      }

      this.conversations.clear(id);
      await this.showMain(ctx, id);
    });

    this.bot.command('menu', async (ctx) => {
      const id = ctx.from?.id;

      if (id === undefined) {
        return;
      }

      this.conversations.clear(id);
      await this.showMain(ctx, id);
    });

    this.bot.command('admin', async (ctx) => {
      const id = ctx.from?.id;

      if (id === undefined) {
        return;
      }

      this.conversations.clear(id);
      await this.showMain(ctx, id);
    });

    this.bot.command('cancel', async (ctx) => {
      const id = ctx.from?.id;

      if (id === undefined) {
        return;
      }

      this.conversations.clear(id);
      await this.showMain(ctx, id);
    });

    this.bot.callbackQuery('admin:main', async (ctx) => {
      await this.answerCallback(ctx);
      await this.showMain(ctx, Number(ctx.from.id));
    });

    this.bot.callbackQuery('admin:services', async (ctx) => {
      await this.answerCallback(ctx);
      if (!this.isAdmin(Number(ctx.from.id))) return;
      await this.showServices(ctx);
    });

    this.bot.callbackQuery('admin:finance', async (ctx) => {
      await this.answerCallback(ctx);
      if (!this.isAdmin(Number(ctx.from.id))) return;
      await this.showFinance(ctx);
    });

    this.bot.callbackQuery('admin:orders', async (ctx) => {
      await this.answerCallback(ctx);
      if (!this.isAdmin(Number(ctx.from.id))) return;
      await this.showOrders(ctx);
    });

    this.bot.callbackQuery('admin:users', async (ctx) => {
      await this.answerCallback(ctx);
      if (!this.isAdmin(Number(ctx.from.id))) return;
      await this.showUsers(ctx);
    });
    this.bot.callbackQuery('web:url', async (ctx) => {
      await this.answerCallback(ctx);
      await this.send(ctx, `${this.appUrl()}`);
    });
    this.bot.callbackQuery('service:create', async (ctx) => {
      await this.answerCallback(ctx);
      if (!this.isAdmin(Number(ctx.from.id))) return;
      await this.startServiceCreate(ctx, Number(ctx.from.id));
    });

    this.bot.callbackQuery('service:list', async (ctx) => {
      await this.answerCallback(ctx);
      if (!this.isAdmin(Number(ctx.from.id))) return;
      await this.listServices(ctx);
    });

    this.bot.callbackQuery('service:edit:list', async (ctx) => {
      await this.answerCallback(ctx);
      if (!this.isAdmin(Number(ctx.from.id))) return;
      await this.listServices(ctx, 'edit');
    });

    this.bot.callbackQuery('service:delete:list', async (ctx) => {
      await this.answerCallback(ctx);
      if (!this.isAdmin(Number(ctx.from.id))) return;
      await this.listServices(ctx, 'delete');
    });

    this.bot.callbackQuery(/^service:edit:(.+)$/, async (ctx) => {
      await this.answerCallback(ctx);
      if (!this.isAdmin(Number(ctx.from.id))) return;
      await this.editServiceMenu(ctx, ctx.match[1]);
    });

    this.bot.callbackQuery(/^service:toggle:(.+)$/, async (ctx) => {
      await this.answerCallback(ctx);
      if (!this.isAdmin(Number(ctx.from.id))) return;
      await this.toggleService(ctx, ctx.match[1]);
    });

    this.bot.callbackQuery(/^service:delete:confirm:(.+)$/, async (ctx) => {
      await this.answerCallback(ctx);
      if (!this.isAdmin(Number(ctx.from.id))) return;
      await this.confirmDelete(ctx, ctx.match[1]);
    });

    this.bot.callbackQuery(/^service:delete:yes:(.+)$/, async (ctx) => {
      await this.answerCallback(ctx);
      if (!this.isAdmin(Number(ctx.from.id))) return;
      await this.deleteService(ctx, ctx.match[1]);
    });

    this.bot.callbackQuery(/^service:field:([^:]+):([^:]+)$/, async (ctx) => {
      await this.answerCallback(ctx);
      if (!this.isAdmin(Number(ctx.from.id))) return;
      await this.startServiceField(
        ctx,
        Number(ctx.from.id),
        ctx.match[1],
        ctx.match[2],
      );
    });

    this.bot.callbackQuery('finance:pending', async (ctx) => {
      await this.answerCallback(ctx);
      if (!this.isAdmin(Number(ctx.from.id))) return;
      await this.listPendingPayments(ctx);
    });

    this.bot.callbackQuery('finance:methods', async (ctx) => {
      await this.answerCallback(ctx);
      if (!this.isAdmin(Number(ctx.from.id))) return;
      await this.listPaymentMethods(ctx);
    });

    this.bot.callbackQuery(/^payment:approve:(.+)$/, async (ctx) => {
      await this.answerCallback(ctx);
      if (!this.isAdmin(Number(ctx.from.id))) return;
      await this.approvePayment(ctx, ctx.match[1]);
    });

    this.bot.callbackQuery(/^payment:reject:(.+)$/, async (ctx) => {
      await this.answerCallback(ctx);
      if (!this.isAdmin(Number(ctx.from.id))) return;
      await this.startRejectPayment(ctx, Number(ctx.from.id), ctx.match[1]);
    });

    this.bot.callbackQuery(/^payment:receipt:(.+)$/, async (ctx) => {
      await this.answerCallback(ctx);
      if (!this.isAdmin(Number(ctx.from.id))) return;
      await this.sendReceipt(ctx, ctx.match[1]);
    });

    this.bot.callbackQuery(/^order:list:(\d+)$/, async (ctx) => {
      await this.answerCallback(ctx);
      if (!this.isAdmin(Number(ctx.from.id))) return;
      await this.listOrders(ctx, Number(ctx.match[1]) || 1);
    });

    this.bot.callbackQuery(/^users:list:(\d+)$/, async (ctx) => {
      await this.answerCallback(ctx);
      if (!this.isAdmin(Number(ctx.from.id))) return;
      await this.listUsers(ctx, Number(ctx.match[1]) || 1);
    });

    this.bot.on('message:text', async (ctx) => {
      const id = Number(ctx.from.id);
      const text = ctx.message.text.trim();

      if (text === '🛍 مدیریت سرویس‌ها') {
        if (!this.isAdmin(id)) return;
        await this.showServices(ctx);
      }
      if (text === '💰 مدیریت مالی') {
        if (!this.isAdmin(id)) return;
        await this.showFinance(ctx);
      }
      if (text === '📦 مدیریت سفارشات') {
        if (!this.isAdmin(id)) return;
        await this.showOrders(ctx);
      }
      if (text === '👥 مدیریت کاربران') {
        if (!this.isAdmin(id)) return;
        await this.showUsers(ctx);
      }
      if (text === '🚀 باز کردن مینی‌اپ') {
        if (!this.isAdmin(id)) return;
        await this.send(
          ctx,
          `برای باز کردن مینی‌اپ روی لینک زیر کلیک کنید:\n\n${this.appUrl()}`,
        );
      }

      if (!this.isAdmin(id)) {
        await this.send(
          ctx,
          '👋 خوش آمدید\n\nبرای استفاده از خدمات، فقط مینی‌اپ را باز کنید.',
          AdminBotKeyboard.user(),
        );
        return;
      }

      const state = this.conversations.get(id);
      if (state) {
        try {
          await this.handleConversation(ctx, id, text, state);
        } catch (error) {
          this.logger.error(
            `Conversation error: ${error instanceof Error ? error.message : String(error)}`,
          );
          await this.send(
            ctx,
            `❌ عملیات انجام نشد.\n${error instanceof Error ? error.message : 'خطای نامشخص'}`,
            AdminBotKeyboard.back(),
          );
        }
        return;
      }
    });
  }

  private async answerCallback(ctx: Context) {
    const id = Number(ctx.from?.id ?? 0);
    if (!this.isAdmin(id)) {
      await ctx
        .answerCallbackQuery({ text: 'دسترسی مجاز نیست.', show_alert: true })
        .catch(() => undefined);
      return;
    }
    await ctx.answerCallbackQuery().catch(() => undefined);
  }

  private async send(
    ctx: Context,
    text: string,
    replyMarkup?: ReplyKeyboardMarkup | InlineKeyboardMarkup,
  ) {
    return ctx.reply(
      text,
      replyMarkup ? { reply_markup: replyMarkup } : undefined,
    );
  }

  private async sendToChat(
    chatId: number,
    text: string,
    replyMarkup?: InlineKeyboardMarkup,
  ) {
    return this.bot.api.sendMessage(
      chatId,
      text,
      replyMarkup ? { reply_markup: replyMarkup } : undefined,
    );
  }

  private async showMain(ctx: Context, id: number) {
    if (!ctx.chat) return;
    if (!this.isAdmin(id)) {
      await this.send(
        ctx,
        '👋 برای استفاده از خدمات، مینی‌اپ را باز کنید.',
        AdminBotKeyboard.user(),
      );
      return;
    }
    await this.send(
      ctx,
      '🤖 پنل مدیریت\n\nاز منوی زیر عملیات موردنظر را انتخاب کنید.',
      AdminBotKeyboard.main(),
    );
  }

  private async showServices(ctx: Context) {
    await this.send(
      ctx,
      '🛍 مدیریت سرویس‌ها\n\nسرویس‌ها، محتوای آموزشی، قوانین و FAQ را مدیریت کنید.',
      AdminBotKeyboard.services(),
    );
  }

  private async showFinance(ctx: Context) {
    await this.send(
      ctx,
      '💰 مدیریت مالی\n\nدرخواست‌های شارژ و روش‌های پرداخت را مدیریت کنید.',
      {
        inline_keyboard: [
          [
            {
              text: '⏳ درخواست‌های در انتظار',
              callback_data: 'finance:pending',
            },
          ],
          [{ text: '💳 روش‌های پرداخت', callback_data: 'finance:methods' }],
          [{ text: '⬅️ منوی اصلی', callback_data: 'admin:main' }],
        ],
      },
    );
  }

  private async showOrders(ctx: Context) {
    await this.send(ctx, '📦 مدیریت سفارشات\n\nآخرین سفارش‌ها:', {
      inline_keyboard: [
        [{ text: '📋 مشاهده سفارش‌ها', callback_data: 'order:list:1' }],
        [{ text: '⬅️ منوی اصلی', callback_data: 'admin:main' }],
      ],
    });
  }

  private async showUsers(ctx: Context) {
    await this.send(ctx, '👥 مدیریت کاربران\n\nکاربران ثبت‌شده:', {
      inline_keyboard: [
        [{ text: '📋 فهرست کاربران', callback_data: 'users:list:1' }],
        [{ text: '⬅️ منوی اصلی', callback_data: 'admin:main' }],
      ],
    });
  }

  private async startServiceCreate(ctx: Context, adminId: number) {
    this.conversations.set({
      type: 'service-create',
      step: 0,
      adminId,
      values: [],
    });
    await this.send(
      ctx,
      '➕ افزودن سرویس\n\nمرحله ۱ از ۸\nشناسه انگلیسی سرویس را ارسال کنید.\nمثال: apple-id',
      AdminBotKeyboard.cancel('admin:services'),
    );
  }

  private async startServiceField(
    ctx: Context,
    adminId: number,
    serviceId: string,
    field: string,
  ) {
    const prompts: Record<string, string> = {
      title: 'عنوان جدید را ارسال کنید.',
      description: 'توضیحات جدید را ارسال کنید.',
      icon: 'نام آیکون را ارسال کنید.',
      serverText: 'متن اختصاصی سرویس را ارسال کنید. برای حذف «-» بفرستید.',
      rulesText: 'قوانین را ارسال کنید. برای حذف «-» بفرستید.',
      media:
        'رسانه‌ها را هر خط به شکل image|URL|عنوان یا video|URL|عنوان ارسال کنید. برای حذف همه «-».',
      faqs: 'FAQ را هر خط به شکل سوال|پاسخ ارسال کنید. برای حذف همه «-».',
    };

    this.conversations.set({
      type: 'service-edit',
      step: 0,
      adminId,
      entityId: serviceId,
      field,
      values: [],
    });
    await this.send(
      ctx,
      `✏️ ویرایش سرویس\n\n${prompts[field] ?? 'مقدار جدید را ارسال کنید.'}`,
      AdminBotKeyboard.cancel(`service:edit:${serviceId}`),
    );
  }

  private async handleConversation(
    ctx: Context,
    adminId: number,
    text: string,
    state: any,
  ) {
    if (!text) {
      await this.send(ctx, 'لطفاً یک مقدار معتبر ارسال کنید.');
      return;
    }

    if (state.type === 'payment-reject') {
      const payment = await this.commerce.rejectPayment(state.entityId, text);
      this.conversations.clear(adminId);
      await this.notifyUser(
        payment.userId,
        '❌ درخواست شارژ رد شد',
        payment.adminReason || text,
      );
      await this.send(
        ctx,
        '❌ درخواست شارژ رد شد و دلیل برای کاربر ارسال شد.',
        {
          inline_keyboard: [
            [{ text: '💰 مدیریت مالی', callback_data: 'admin:finance' }],
            [{ text: '🏠 منوی اصلی', callback_data: 'admin:main' }],
          ],
        },
      );
      return;
    }

    if (state.type === 'service-edit') {
      const patch: any = {};
      switch (state.field) {
        case 'title':
          patch.title = text;
          break;
        case 'description':
          patch.description = text;
          break;
        case 'icon':
          patch.icon = text;
          break;
        case 'serverText':
          patch.serverText = text === '-' ? null : text;
          break;
        case 'rulesText':
          patch.rulesText = text === '-' ? null : text;
          break;
        case 'media':
          patch.media = parseMedia(text);
          break;
        case 'faqs':
          patch.faqs = parseFaqs(text);
          break;
      }

      const service = await this.commerce.updateService(state.entityId, patch);
      this.conversations.clear(adminId);
      await this.send(
        ctx,
        `✅ سرویس «${service.title}» به‌روزرسانی شد.`,
        serviceMenu(service),
      );
      return;
    }

    state.values.push(text);
    const prompts = [
      'عنوان فارسی سرویس:',
      'توضیح سرویس:',
      'آیکون سرویس:',
      'متن اختصاصی سرویس یا «-»:',
      'قوانین سرویس یا «-»:',
      'رسانه‌ها یا «-»:',
      'سوالات متداول یا «-»:',
    ];

    if (state.values.length < 8) {
      await this.send(
        ctx,
        `مرحله ${state.values.length + 1} از ۸\n\n${prompts[state.values.length - 1]}`,
        AdminBotKeyboard.cancel('admin:services'),
      );
      return;
    }

    const [slug, title, description, icon, serverText, rulesText, media, faqs] =
      state.values;
    const service = await this.commerce.createService({
      slug,
      title,
      description,
      icon,
      serverText: serverText === '-' ? null : serverText,
      rulesText: rulesText === '-' ? null : rulesText,
      media: parseMedia(media),
      faqs: parseFaqs(faqs),
    });

    this.conversations.clear(adminId);
    await this.send(
      ctx,
      `✅ سرویس «${service.title}» ساخته شد.`,
      serviceMenu(service),
    );
  }

  private async listServices(ctx: Context, mode?: 'edit' | 'delete') {
    const rows = await this.commerce.listServices(true);
    if (!rows.length) {
      await this.send(
        ctx,
        'سرویسی ثبت نشده است.',
        AdminBotKeyboard.back('admin:services'),
      );
      return;
    }

    const buttons = rows.map((s) => [
      {
        text: `${s.active ? '🟢' : '⚪'} ${s.title}`,
        callback_data:
          mode === 'delete'
            ? `service:delete:confirm:${s.id}`
            : `service:edit:${s.id}`,
      },
    ]);
    buttons.push([
      { text: '⬅️ مدیریت سرویس‌ها', callback_data: 'admin:services' },
    ]);

    await this.send(ctx, '📋 فهرست سرویس‌ها', { inline_keyboard: buttons });
  }

  private async editServiceMenu(ctx: Context, id: string) {
    const service = await this.commerce.getService(id);
    await this.send(
      ctx,
      `🛠 مدیریت «${service.title}»\n\nوضعیت: ${service.active ? 'فعال' : 'غیرفعال'}`,
      serviceMenu(service),
    );
  }

  private async toggleService(ctx: Context, id: string) {
    const service = await this.commerce.getService(id);
    const updated = await this.commerce.updateService(id, {
      active: !service.active,
    });
    await this.send(
      ctx,
      `✅ سرویس «${updated.title}» ${updated.active ? 'فعال' : 'غیرفعال'} شد.`,
      serviceMenu(updated),
    );
  }

  private async confirmDelete(ctx: Context, id: string) {
    const service = await this.commerce.getService(id);
    await this.send(
      ctx,
      `⚠️ سرویس «${service.title}» غیرفعال شود؟\nسفارش‌های قبلی حفظ خواهند شد.`,
      {
        inline_keyboard: [
          [
            { text: '🗑 تأیید', callback_data: `service:delete:yes:${id}` },
            { text: 'انصراف', callback_data: `service:edit:${id}` },
          ],
        ],
      },
    );
  }

  private async deleteService(ctx: Context, id: string) {
    const service = await this.commerce.deleteService(id);
    await this.send(
      ctx,
      `✅ سرویس «${service.title}» غیرفعال شد.`,
      AdminBotKeyboard.services(),
    );
  }

  private async listPendingPayments(ctx: Context) {
    const rows = await this.payments.find({
      where: { status: 'PENDING' as any },
      order: { createdAt: 'ASC' },
      take: 20,
    });
    if (!rows.length) {
      await this.send(ctx, '✅ درخواست شارژ در انتظاری وجود ندارد.', {
        inline_keyboard: [
          [{ text: '⬅️ مدیریت مالی', callback_data: 'admin:finance' }],
        ],
      });
      return;
    }

    for (const payment of rows) {
      const user = await this.users.findOne({ where: { id: payment.userId } });
      const text = `💰 درخواست شارژ\n\n👤 کاربر: ${user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || 'بدون نام' : 'نامشخص'}\n🆔 Telegram ID: ${user?.telegramId ?? 'نامشخص'}\n💵 مبلغ: ${payment.amount} ${payment.currency}\n🕐 وضعیت: در انتظار بررسی`;
      await this.send(ctx, text, {
        inline_keyboard: [
          [
            {
              text: '📷 مشاهده فیش',
              callback_data: `payment:receipt:${payment.id}`,
            },
          ],
          [
            {
              text: '✅ تأیید شارژ',
              callback_data: `payment:approve:${payment.id}`,
            },
            {
              text: '❌ رد درخواست',
              callback_data: `payment:reject:${payment.id}`,
            },
          ],
        ],
      });
    }
  }

  private async approvePayment(ctx: Context, id: string) {
    const payment = await this.commerce.approvePayment(id, 'تأیید توسط ادمین');
    await this.notifyUser(
      payment.userId,
      '✅ شارژ حساب موفق بود',
      `مبلغ ${payment.amount} ${payment.currency} به کیف پول شما اضافه شد.`,
    );
    await this.send(
      ctx,
      '✅ درخواست شارژ تأیید شد و موجودی کاربر افزایش یافت.',
      {
        inline_keyboard: [
          [{ text: '💰 درخواست‌های شارژ', callback_data: 'finance:pending' }],
          [{ text: '🏠 منوی اصلی', callback_data: 'admin:main' }],
        ],
      },
    );
  }

  private async startRejectPayment(ctx: Context, adminId: number, id: string) {
    this.conversations.set({
      type: 'payment-reject',
      step: 0,
      adminId,
      entityId: id,
      values: [],
    });
    await this.send(
      ctx,
      '✍️ دلیل رد درخواست را ارسال کنید:',
      AdminBotKeyboard.cancel('finance:pending'),
    );
  }

  private async sendReceipt(ctx: Context, id: string) {
    const payment: any = await this.payments.findOne({ where: { id } });
    if (!payment) {
      await this.send(
        ctx,
        'فیش پیدا نشد.',
        AdminBotKeyboard.back('finance:pending'),
      );
      return;
    }

    const path = String(payment.receiptPath ?? '');
    if (!path) {
      await this.send(ctx, 'برای این درخواست فایل فیش ثبت نشده است.');
      return;
    }

    const { readFile } = await import('node:fs/promises');
    try {
      const bytes = await readFile(path);
      const fileName = path.split(/[\\/]/).pop() || 'receipt';
      await ctx.replyWithPhoto(new InputFile(bytes, fileName), {
        caption: `📷 فیش واریزی\nشناسه درخواست: ${payment.id}\nمبلغ: ${payment.amount} ${payment.currency}`,
      });
    } catch (error) {
      this.logger.warn(
        `Receipt send failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      await this.send(ctx, `📷 مسیر فیش: ${path}`);
    }
  }

  private async listPaymentMethods(ctx: Context) {
    const rows = await this.methods.find({ order: { createdAt: 'ASC' } });
    if (!rows.length) {
      await this.send(
        ctx,
        'روش پرداختی ثبت نشده است.',
        AdminBotKeyboard.back('admin:finance'),
      );
      return;
    }

    const text = rows
      .map(
        (m: any) =>
          `💳 ${m.title}\nشماره کارت: ${m.cardNumber ?? '-'}\nبانک: ${m.bankName ?? '-'}\nوضعیت: ${m.active ? 'فعال' : 'غیرفعال'}`,
      )
      .join('\n\n');

    await this.send(
      ctx,
      `💳 روش‌های پرداخت\n\n${text}`,
      AdminBotKeyboard.back('admin:finance'),
    );
  }

  private async listOrders(ctx: Context, page: number) {
    const take = 10;
    const rows: any[] = await this.orders.find({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * take,
      take,
    });
    if (!rows.length) {
      await this.send(
        ctx,
        'سفارشی ثبت نشده است.',
        AdminBotKeyboard.back('admin:orders'),
      );
      return;
    }

    const text = rows
      .map(
        (o) =>
          `📦 ${o.id}\nکاربر: ${o.userId}\nمبلغ: ${o.amount} ${o.currency}\nوضعیت: ${o.status}`,
      )
      .join('\n\n');

    await this.send(ctx, `📦 سفارش‌های اخیر\n\n${text}`, {
      inline_keyboard: [
        [{ text: '⬅️ مدیریت سفارشات', callback_data: 'admin:orders' }],
      ],
    });
  }

  private async listUsers(ctx: Context, page: number) {
    const take = 10;
    const rows: any[] = await this.users.find({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * take,
      take,
    });
    if (!rows.length) {
      await this.send(
        ctx,
        'کاربری ثبت نشده است.',
        AdminBotKeyboard.back('admin:users'),
      );
      return;
    }

    const text = rows
      .map(
        (u) =>
          `👤 ${[u.firstName, u.lastName].filter(Boolean).join(' ') || 'بدون نام'}\n🆔 ${u.telegramId ?? '-'}\n👤 @${u.username ?? '-'}`,
      )
      .join('\n\n');

    await this.send(ctx, `👥 کاربران\n\n${text}`, {
      inline_keyboard: [
        [{ text: '⬅️ مدیریت کاربران', callback_data: 'admin:users' }],
      ],
    });
  }

  private async notifyUser(userId: string, title: string, body: string) {
    await this.notifications.create(userId, title, body).catch(() => undefined);
    const user: any = await this.users.findOne({ where: { id: userId } });
    if (user?.telegramId) {
      await this.sendToChat(Number(user.telegramId), `${title}\n\n${body}`);
    }
  }
}

function parseMedia(input: string): ServiceMedia[] {
  if (!input || input.trim() === '-') return [];
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [type, url, ...title] = line.split('|').map((v) => v.trim());
      if (type !== 'image' && type !== 'video')
        throw new Error('رسانه باید image یا video باشد.');
      if (!url) throw new Error('URL رسانه الزامی است.');
      return { type, url, title: title.join('|') || undefined } as ServiceMedia;
    });
}

function parseFaqs(input: string): ServiceFaq[] {
  if (!input || input.trim() === '-') return [];
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [question, ...answer] = line.split('|').map((v) => v.trim());
      if (!question || !answer.length)
        throw new Error('FAQ باید به شکل سوال|پاسخ باشد.');
      return { question, answer: answer.join('|') } as ServiceFaq;
    });
}

function serviceMenu(service: Service): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        {
          text: '✏️ عنوان',
          callback_data: `service:field:${service.id}:title`,
        },
        {
          text: '📝 توضیحات',
          callback_data: `service:field:${service.id}:description`,
        },
      ],
      [
        {
          text: '🖥 متن سرویس',
          callback_data: `service:field:${service.id}:serverText`,
        },
        {
          text: '📜 قوانین',
          callback_data: `service:field:${service.id}:rulesText`,
        },
      ],
      [
        { text: '🖼 رسانه', callback_data: `service:field:${service.id}:media` },
        { text: '❓ FAQ', callback_data: `service:field:${service.id}:faqs` },
      ],
      [{ text: '🎨 آیکون', callback_data: `service:field:${service.id}:icon` }],
      [
        {
          text: service.active ? '⏸ غیرفعال کردن' : '▶️ فعال کردن',
          callback_data: `service:toggle:${service.id}`,
        },
      ],
      [
        {
          text: '🗑 حذف سرویس',
          callback_data: `service:delete:confirm:${service.id}`,
        },
      ],
      [{ text: '⬅️ مدیریت سرویس‌ها', callback_data: 'admin:services' }],
    ],
  };
}
