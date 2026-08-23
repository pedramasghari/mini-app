import { AdminBotRuntimeService } from './runtime/admin-bot.runtime.service';

/**
 * Backward-compatible export for older imports.
 * The Telegram bot runtime now lives in ./runtime and only sends the Mini App
 * link plus notification messages; admin operations are handled by the Mini App.
 */
export const AdminBotService = AdminBotRuntimeService;
