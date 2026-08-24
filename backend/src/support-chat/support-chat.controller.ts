import { BadRequestException, Body, Controller, Get, Param, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { diskStorage } from 'multer';
import { mkdirSync } from 'node:fs';
import { extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AuthService } from '../auth/auth.service';
import { AdminGuard } from '../admin/admin.guard';
import { SupportChatService, SupportAttachmentInput } from './support-chat.service';

const COOKIE = 'miniapp_session';
type SessionRequest = Request & { adminSession?: { user: { id: string } } };
const uploadDir = 'uploads/support-chat';
mkdirSync(uploadDir, { recursive: true });

@Controller('support-chat')
export class SupportChatController {
  constructor(private readonly auth: AuthService, private readonly support: SupportChatService) {}

  private async userId(req: Request) {
    const token = req.cookies?.[COOKIE] as string | undefined;
    if (!token) throw new BadRequestException('Authentication required');
    const session = await this.auth.getSession(token);
    return session.user.id;
  }

  @Get('me')
  async me(@Req() req: Request) { return this.support.getMine(await this.userId(req)); }

  @Post('me/messages')
  async send(@Req() req: Request, @Body() body: { body?: string; replyToMessageId?: string | null; attachments?: SupportAttachmentInput[] }) {
    return this.support.send(await this.userId(req), 'USER', body);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({ destination: uploadDir, filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`) }),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|gif|webp)|^video\/(mp4|webm|quicktime)$/.test(file.mimetype)),
  }))
  async upload(@Req() req: Request, @UploadedFile() file: Express.Multer.File) {
    await this.userId(req);
    if (!file) throw new BadRequestException('فقط تصویر یا ویدیو مجاز است.');
    const type = file.mimetype.startsWith('image/') ? 'IMAGE' : 'VIDEO';
    return { type, url: `/uploads/support-chat/${file.filename}`, name: file.originalname, size: file.size };
  }

  @Get('admin/conversations')
  @UseGuards(AdminGuard)
  async adminConversations() { return this.support.listForAdmins(); }

  @Get('admin/conversations/:id')
  @UseGuards(AdminGuard)
  async adminConversation(@Param('id') id: string) { return this.support.getForAdmin(id); }

  @Post('admin/conversations/:id/messages')
  @UseGuards(AdminGuard)
  async adminSend(@Req() req: SessionRequest, @Param('id') id: string, @Body() body: { body?: string; replyToMessageId?: string | null; attachments?: SupportAttachmentInput[] }) {
    const adminId = req.adminSession?.user.id ?? (await this.userId(req));
    return this.support.send(adminId, 'ADMIN', { ...body, conversationId: id });
  }
}
