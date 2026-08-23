import { InlineKeyboardMarkup } from '@grammyjs/conversations/out/deps.node';
export class AdminBotKeyboard {
  static user(): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [{ text: '🚀 باز کردن فروشگاه', callback_data: 'web:url' }],
      ],
    };
  }
  static main(): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [{ text: '🛍 مدیریت سرویس‌ها', callback_data: 'admin:services' }],
        [
          { text: '💰 مدیریت مالی', callback_data: 'admin:finance' },
          { text: '📦 مدیریت سفارشات', callback_data: 'admin:orders' },
        ],
        [{ text: '👥 مدیریت کاربران', callback_data: 'admin:users' }],
        [{ text: '🚀 باز کردن مینی‌اپ', callback_data: 'web:url' }],
      ],
    };
  }
  static services(): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [{ text: '➕ افزودن سرویس', callback_data: 'service:create' }],
        [
          { text: '✏️ ویرایش سرویس', callback_data: 'service:edit:list' },
          { text: '🗑 حذف سرویس', callback_data: 'service:delete:list' },
        ],
        [{ text: '📋 فهرست سرویس‌ها', callback_data: 'service:list' }],
        [{ text: '⬅️ منوی اصلی', callback_data: 'admin:main' }],
      ],
    };
  }
  static back(target = 'admin:main'): InlineKeyboardMarkup {
    return {
      inline_keyboard: [[{ text: '⬅️ بازگشت', callback_data: target }]],
    };
  }
  static cancel(target = 'admin:main'): InlineKeyboardMarkup {
    return {
      inline_keyboard: [[{ text: '❌ انصراف', callback_data: target }]],
    };
  }
}
