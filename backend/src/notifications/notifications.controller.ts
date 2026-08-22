import { Controller, Get, MessageEvent, Post, Req, Param, Sse, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { Observable, concat, defer, of } from 'rxjs';
import { map } from 'rxjs/operators';
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
  async stream(@Req() req: Request): Promise<Observable<MessageEvent>> {
    const userId = await this.userId(req);
    const connection = this.notifications.connect(userId);
    const initial = of<MessageEvent>({ data: { type: 'connected' } });
    const events = connection.subject.pipe(map((event) => ({ data: event })));
    return concat(initial, defer(() => events));
  }
}
