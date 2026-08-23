# Telegram Bot

The Telegram bot is intentionally kept minimal.

- Any incoming message receives the Mini App launch link.
- The bot does not contain finance, user, order, service, or administration workflows.
- Charge-related notifications are sent through `NotificationsService` to the affected user and configured administrators.
- Admin management lives inside the Mini App under `/admin/*`.

Configuration:

- `TELEGRAM_BOT_TOKEN`
- `MINI_APP_URL`
- `ADMIN_TELEGRAM_IDS`
- `TELEGRAM_PROXY_URL`
