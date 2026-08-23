import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, Context, InlineKeyboard } from 'grammy';
import { HttpsProxyAgent } from 'https-proxy-agent';

const proxyUrl = process.env.TELEGRAM_PROXY_URL ?? 'http://127.0.0.1:2080';
const agent = new HttpsProxyAgent(proxyUrl);

@Injectable()
export class AdminBotRuntimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdminBotRuntimeService.name);
  private readonly bot: Bot<Context>;
  private running = false;
  private startPromise?: Promise<void>;

  constructor(private readonly config: ConfigService) {
    const token = this.token();
    this.bot = new Bot<Context>(token || '000000:disabled', {
      client: {
        baseFetchConfig: {
          agent,
          compress: true,
        },
      },
    });

    const sendApp = async (ctx: Context) => {
      const appUrl = this.appUrl();
      if (!appUrl) {
        await ctx.reply('آدرس Mini App تنظیم نشده است.');
        return;
      }

      await ctx.reply('برای ورود به Mini App روی دکمه زیر بزنید:', {
        reply_markup: new InlineKeyboard().url('🚀 ورود به Mini App', appUrl),
      });
    };

    this.bot.command('start', sendApp);
    this.bot.command('menu', sendApp);
    this.bot.on('message', sendApp);

    this.bot.catch((error) => {
      this.logger.error('Telegram bot error', error.error);
    });
  }

  async onModuleInit() {
    if (!this.token()) {
      this.logger.warn('TELEGRAM_BOT_TOKEN/ADMIN_BOT_TOKEN تنظیم نشده است؛ ربات اجرا نشد.');
      return;
    }

    try {
      await this.bot.api.deleteWebhook({ drop_pending_updates: false });
      const me = await this.bot.api.getMe();
      this.logger.log(`Telegram bot connected: @${me.username}`);
      this.logger.log(`Telegram proxy: ${proxyUrl}`);

      this.running = true;
      this.startPromise = this.bot.start({
        allowed_updates: ['message'],
        onStart: (info) => {
          this.logger.log(`Telegram polling started: @${info.username}`);
        },
      });

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

  async sendToTelegram(chatId: string | number, message: string) {
    if (!this.token()) return false;
    try {
      await this.bot.api.sendMessage(chatId, message, { parse_mode: 'HTML' });
      return true;
    } catch (error) {
      this.logger.warn(
        `Telegram notification failed for ${chatId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  async sendToAdmins(message: string) {
    const adminIds = String(
      this.config.get('ADMIN_TELEGRAM_IDS') ??
        this.config.get('ADMIN_TELEGRAM_ID') ??
        '',
    )
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    await Promise.all(adminIds.map((id) => this.sendToTelegram(id, message)));
  }

  private token() {
    return String(
      this.config.get('TELEGRAM_BOT_TOKEN') ??
        this.config.get('ADMIN_BOT_TOKEN') ??
        '',
    ).trim();
  }

  private appUrl() {
    return String(this.config.get('MINI_APP_URL') ?? '').trim();
  }
}
