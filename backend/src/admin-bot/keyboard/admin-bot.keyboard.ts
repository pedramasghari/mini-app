import { BotKeyboard } from '../admin-bot.types';

export class AdminBotKeyboard {
  static user(appUrl: string): BotKeyboard { return { inline_keyboard: [[{ text: '🚀 باز کردن فروشگاه', web_app: { url: appUrl } }]] }; }
  static main(appUrl: string): BotKeyboard { return { inline_keyboard: [[{ text: '🛍 مدیریت سرویس‌ها', callback_data: 'admin:services' }],[{ text: '💰 مدیریت مالی', callback_data: 'admin:finance' },{ text: '📦 مدیریت سفارشات', callback_data: 'admin:orders' }],[{ text: '👥 مدیریت کاربران', callback_data: 'admin:users' }],[{ text: '🚀 باز کردن مینی‌اپ', web_app: { url: appUrl } }]] }; }
  static services(): BotKeyboard { return { inline_keyboard: [[{ text: '➕ افزودن سرویس', callback_data: 'service:create' }],[{ text: '✏️ ویرایش سرویس', callback_data: 'service:edit:list' },{ text: '🗑 حذف سرویس', callback_data: 'service:delete:list' }],[{ text: '📋 فهرست سرویس‌ها', callback_data: 'service:list' }],[{ text: '⬅️ منوی اصلی', callback_data: 'admin:main' }]] }; }
  static back(target = 'admin:main'): BotKeyboard { return { inline_keyboard: [[{ text: '⬅️ بازگشت', callback_data: target }]] }; }
  static cancel(target = 'admin:main'): BotKeyboard { return { inline_keyboard: [[{ text: '❌ انصراف', callback_data: target }]] }; }
}
