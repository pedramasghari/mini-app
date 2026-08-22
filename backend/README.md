# Mini App Backend

NestJS + TypeORM + PostgreSQL backend for the Telegram Mini App.

## Setup

```bash
pnpm install
cp .env.example .env
pnpm start:dev
```

PostgreSQL is configured through `DATABASE_*` variables.

## Commerce API

- `GET /services`
- `GET /products`
- `GET /products/:id`
- `GET /products/:productId/guide`
- `POST /orders`
- `POST /orders/:id/inputs`
- `GET /orders/me`
- `GET /transactions/me`
- `GET /payment-methods`
- `POST /payments/card-transfer` (multipart: `amount`, `paymentMethodId`, `receipt`)

The initial database seed creates an Apple ID service, an Apple ID setup product and a generic step-by-step setup guide. The guide is intentionally written around the user's own Apple Account information and Apple's supported verification flow.

## Admin Telegram Bot

The admin bot is intentionally separate from the customer bot. Configure:

```env
ADMIN_BOT_TOKEN=...
ADMIN_TELEGRAM_IDS=123456789,987654321
```

Supported commands:

- `/payments` — pending payment requests
- `/cards` — active card-to-card payment methods
- `/addcard` — guided card creation

New payment requests are pushed to authorized admins with an inline **Approve / Reject** keyboard. Rejecting requires a reason. Receipts are sent to the admin as Telegram documents.

Only Telegram numeric IDs listed in `ADMIN_TELEGRAM_IDS` can operate the admin bot.

## Storage note

Receipt files currently use local `./uploads/receipts` storage for development. Production should move receipt storage to durable private object storage and keep only an object key in PostgreSQL.

## Verification-provider boundary

The backend does **not** automate Apple Account creation or relay third-party temporary-number OTPs into an Apple Account creation flow. A verification provider can be integrated later for permitted testing/verification use cases without putting provider credentials in the frontend or source control.
