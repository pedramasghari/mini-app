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

Then install and run:

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

## 4. Open it inside Telegram

Telegram Mini Apps must be opened by Telegram so that `Telegram.WebApp.initData` exists. For a normal production bot, configure the Mini App URL in @BotFather. The URL must be HTTPS.

For local development, expose the Next.js port with a HTTPS tunnel such as Cloudflare Tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
```

Copy the generated `https://...trycloudflare.com` URL and configure it as the bot's Main Mini App or Menu Button in @BotFather.

Important: the backend must also be reachable by the browser. For local development with the current frontend, expose port 4000 as well:

```bash
cloudflared tunnel --url http://localhost:4000
```

Then set the public backend URL in `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=https://YOUR-BACKEND-TUNNEL.trycloudflare.com
```

Restart Next.js after changing the environment variable.

## Authentication

`POST /auth/telegram` validates Telegram `initData`, creates/finds the user, creates/finds the wallet, and sets an HttpOnly session cookie.

`GET /auth/me` returns the authenticated user and wallet.

`POST /auth/logout` invalidates the current session.

Sessions are stored server-side and only a SHA-256 hash of the session token is stored in PostgreSQL.

## Database

TypeORM currently uses `synchronize: true` for development so the schema is created automatically. Before production, switch to migrations and set `synchronize: false`.
