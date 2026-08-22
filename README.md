# Telegram Mini App

Stack: Next.js + NestJS + TypeORM + PostgreSQL.

## 1. Start PostgreSQL

```bash
docker compose up -d postgres
```

## 2. Backend

```bash
cd backend
cp .env.example .env
```

Set `TELEGRAM_BOT_TOKEN` in `backend/.env`.

Then:

```bash
pnpm install
pnpm start:dev
```

Backend: `http://localhost:4000`

## 3. Frontend

```bash
cd frontend
cp .env.example .env.local
pnpm install
pnpm dev
```

Frontend: `http://localhost:3000`

The frontend proxies `/api/*` to the backend, so the session cookie remains same-origin from the browser's point of view.

## 4. Open it inside Telegram

Telegram Mini Apps must be opened by Telegram so that `Telegram.WebApp.initData` exists. For a normal bot, configure the Mini App URL in @BotFather. Telegram's production Mini App URL should use HTTPS.

For local development, expose only Next.js with a HTTPS tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
```

Copy the generated `https://...trycloudflare.com` URL and configure it as the bot's Main Mini App or Menu Button in @BotFather.

If you use a different tunnel/domain, set the backend's `FRONTEND_URL` only if you also want direct cross-origin API access. The normal development path uses the Next.js `/api` proxy and does not require exposing port 4000.

## Authentication

`POST /auth/telegram` validates Telegram `initData`, creates/finds the user, creates/finds the wallet, and sets an HttpOnly session cookie.

`GET /auth/me` returns the authenticated user and wallet.

`POST /auth/logout` invalidates the current session.

Sessions are stored server-side and only a SHA-256 hash of the session token is stored in PostgreSQL.

## Database

TypeORM currently uses `synchronize: true` for development so the schema is created automatically. Before production, switch to migrations and set `synchronize: false`.
