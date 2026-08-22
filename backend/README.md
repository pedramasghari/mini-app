# Mini App Backend

NestJS + TypeORM + PostgreSQL backend for the Telegram Mini App.

## Setup

```bash
pnpm install
cp .env.example .env
pnpm start:dev
```

PostgreSQL is configured through `DATABASE_*` variables.

## Wallet charging

Customers can charge the wallet with **Card-to-card transfer**. Online payment is represented as a disabled/coming-soon method and cannot create a payment request yet.

Flow:

1. Customer chooses Card-to-card.
2. Enters the requested amount.
3. Active cards configured by the admin are displayed.
4. Customer completes the bank transfer.
5. Customer uploads an image/PDF receipt.
6. `PaymentRequest` is created as `PENDING`.
7. Admin Bot receives the request and receipt with **Approve / Reject** buttons.
8. Approve atomically credits the wallet and creates a `WalletTransaction`.
9. Reject requires a reason and never changes the wallet.
10. The customer receives a persistent notification. If the Mini App is online the notification and wallet balance update are pushed through SSE immediately; otherwise the Admin Bot sends a Telegram message.

Only one pending deposit is allowed per user. This is protected both by an application check and a PostgreSQL partial unique index, while approval/rejection use pessimistic row locks to prevent double processing and wallet race conditions.

## Realtime notifications

- `GET /notifications` — latest notifications
- `GET /notifications/unread-count` — unread count
- `POST /notifications/:id/read` — mark notification read
- `GET /notifications/stream` — authenticated Server-Sent Events stream

The frontend connects to `/api/notifications/stream` through the existing Next.js rewrite. Wallet balance and notification state update without a refresh.

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

Configure:

```env
ADMIN_BOT_TOKEN=...
ADMIN_TELEGRAM_IDS=123456789,987654321
```

Supported commands:

- `/payments` — pending payment requests
- `/cards` — active card-to-card payment methods
- `/addcard` — guided card creation

New payment requests are pushed to authorized admins with an inline **Approve / Reject** keyboard. Rejecting requires a reason. Receipts are sent to the admin as Telegram documents. After a decision, the customer is notified in-app when online or through Telegram when offline.

Only Telegram numeric IDs listed in `ADMIN_TELEGRAM_IDS` can operate the admin bot.

## Storage note

Receipt files currently use local `./uploads/receipts` storage for development. Production should move receipt storage to durable private object storage and keep only an object key in PostgreSQL.

## Verification-provider boundary

The backend does **not** automate Apple Account creation or relay third-party temporary-number OTPs into an Apple Account creation flow. A verification provider can be integrated later for permitted testing/verification use cases without putting provider credentials in the frontend or source control.
