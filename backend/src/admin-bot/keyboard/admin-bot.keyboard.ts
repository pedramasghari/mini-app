import { InlineKeyboardMarkup } from '@grammyjs/conversations/out/deps.node';
import { Keyboard } from 'grammy';
export class AdminBotKeyboard {
  static user(): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [{ text: '🚀 باز کردن فروشگاه', callback_data: 'web:url' }],
      ],
    };
  }
  static main(): Keyboard {
    const keyboard = new Keyboard()
      .text('🛍 مدیریت سرویس‌ها')
      .text('💰 مدیریت مالی')
      .row()
      .text('📦 مدیریت سفارشات')
      .text('👥 مدیریت کاربران')
      .row()
      .text('🚀 باز کردن مینی‌اپ')
      .resized()
      .persistent();

    return keyboard;
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
