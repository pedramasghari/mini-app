# Support chat

This module is intentionally designed as an application-owned support conversation layer. Telegram is used for offline notifications, not as the source of truth for the conversation.

Architecture:
- PostgreSQL stores conversations/messages/read state.
- WebSocket/SSE transport keeps Mini App and admin UI realtime.
- The Telegram bot sends a notification when a recipient is offline (when write access is available).
- Attachments are stored through the existing media/storage abstraction.
- Replies reference another support message.

The next implementation step should wire this module into the existing authenticated user/admin guards and existing realtime transport rather than creating a second socket server.
