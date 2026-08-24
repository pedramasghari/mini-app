import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { AdminGuard } from '../admin/admin.guard';
import { SupportChatService, SupportAttachmentInput } from './support-chat.service';

const COOKIE = 'miniapp_session';

type SessionRequest = Request & { adminSession?: { user: { id: string } } };

@Controller('support-chat')
export class SupportChatController {
  constructor(private readonly auth: AuthService, private readonly support: SupportChatService) {}

  private async userId(req: Request) {
    const token = req.cookies?.[COOKIE] as string | undefined;
    if (!token) throw new Error('Authentication required');
    const session = await this.auth.getSession(token);
    return session.user.id;
  }

  @Get('me')
  async me(@Req() req: Request) {
    return this.support.getMine(await this.userId(req));
  }

  @Post('me/messages')
  async send(@Req() req: Request, @Body() body: { body?: string; replyToMessageId?: string | null; attachments?: SupportAttachmentInput[] }) {
    return this.support.send(await this.userId(req), 'USER', body);
  }

  @Get('admin/conversations')
  @UseGuards(AdminGuard)
  async adminConversations() {
    return this.support.listForAdmins();
  }

  @Get('admin/conversations/:id')
  @UseGuards(AdminGuard)
  async adminConversation(@Param('id') id: string) {
    return this.support.getForAdmin(id);
  }

  @Post('admin/conversations/:id/messages')
  @UseGuards(AdminGuard)
  async adminSend(@Req() req: SessionRequest, @Param('id') id: string, @Body() body: { body?: string; replyToMessageId?: string | null; attachments?: SupportAttachmentInput[] }) {
    const adminId = req.adminSession?.user.id ?? (await this.userId(req));
    return this.support.send(adminId, 'ADMIN', { ...body, conversationId: id });
  }
}
