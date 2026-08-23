# Admin Bot Module

ربات تلگرام فقط برای ادمین‌هاست و کاربران عادی فقط دکمه باز کردن Mini App را دریافت می‌کنند.

## ساختار

```text
admin-bot/
├── admin-bot.module.ts
├── admin-bot.service.ts
├── admin-bot.types.ts
├── keyboard/
│   └── admin-bot.keyboard.ts
├── conversations/
│   └── admin-bot.conversation.service.ts
├── finance/
│   └── admin-bot.finance.service.ts
├── orders/
│   └── admin-bot.orders.service.ts
├── users/
│   └── admin-bot.users.service.ts
└── services/
    └── admin-bot.service-management.service.ts
```

Keyboard، Conversation، مالی، سفارشات، کاربران و مدیریت سرویس‌ها از هم تفکیک شده‌اند. دسترسی مدیریتی باید همیشه با ADMIN_TELEGRAM_IDS کنترل شود و کاربران عادی فقط Mini App را دریافت کنند.
