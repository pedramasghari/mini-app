import { BadRequestException, Controller, Get, Param, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import type { Request } from 'express';
import { AdminGuard } from './admin.guard';
import { WithdrawalsService } from '../withdrawals/withdrawals.service';

const UPLOAD_DIR = './uploads/withdrawals';
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

@Controller('admin/withdrawals')
@UseGuards(AdminGuard)
export class AdminWithdrawalsController {
  constructor(private readonly withdrawals: WithdrawalsService) {}

  @Get()
  list(@Query('page') page?: string, @Query('limit') limit?: string, @Query('status') status?: string) {
    return this.withdrawals.adminList(Number(page ?? 1), Number(limit ?? 10), status);
  }

  @Post(':id/complete')
  @UseInterceptors(FileInterceptor('receipt', {
    storage: diskStorage({
      destination: UPLOAD_DIR,
      filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED.has(file.mimetype)) {
        cb(new BadRequestException('فقط JPG، PNG، WebP یا PDF مجاز است.'), false);
        return;
      }
      cb(null, true);
    },
  }))
  async complete(@Req() req: Request, @Param('id') id: string, @UploadedFile() receipt?: Express.Multer.File) {
    if (!receipt) throw new BadRequestException('تصویر یا فایل واریزی الزامی است.');
    const adminUserId = (req as Request & { adminSession?: { user: { id: string } } }).adminSession?.user.id;
    if (!adminUserId) throw new BadRequestException('شناسه ادمین در Session وجود ندارد.');
    return this.withdrawals.adminComplete(id, adminUserId, `/uploads/withdrawals/${receipt.filename}`);
  }
}
