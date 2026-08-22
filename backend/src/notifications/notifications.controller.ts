import { Controller, Get, Header, MessageEvent, Param, Post, Req, Sse, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, concat, finalize, interval, map, merge, of } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { NotificationsService } from './notifications.service';

const COOKIE = 'miniapp_session';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly auth: AuthService, private readonly notifications: NotificationsService) {}

  private async userId(req: Request) {
    const token = req.cookies?.[COOKIE] as string | undefined;
    if (!token) throw new UnauthorizedException();
    const session = await this.auth.getSession(token);
    return session.user.id;
  }

  @Get()
  async list(@Req() req: Request) { return this.notifications.list(await this.userId(req)); }

  @Get('unread-count')
  async unread(@Req() req: Request) { return { count: await this.notifications.unreadCount(await this.userId(req)) }; }

  @Post(':id/read')
  async read(@Req() req: Request, @Param('id') id: string) { return this.notifications.markRead(await this.userId(req), id); }

  @Sse('stream')
  @Header('Cache-Control', 'no-cache, no-transform')
  @Header('X-Accel-Buffering', 'no')
  @Header('Connection', 'keep-alive')
  async stream(@Req() req: Request): Promise<Observable<MessageEvent>> {
    const userId = await this.userId(req);
    const connection = this.notifications.connect(userId);
    const events = connection.subject.pipe(map((event) => ({ data: event } as MessageEvent)));
    const heartbeat = interval(15000).pipe(map(() => ({ data: { type: 'heartbeat', timestamp: Date.now() } } as MessageEvent)));
    return concat(
      of<MessageEvent>({ data: { type: 'connected', timestamp: Date.now() } }),
      merge(events, heartbeat),
    ).pipe(finalize(connection.close));
  }
}
