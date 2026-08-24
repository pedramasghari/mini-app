import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AdminGuard } from './admin.guard';
import type { Request } from 'express';
import type { Express } from 'express';
import { CommerceService } from '../commerce/commerce.service';
import { SmsCodeService } from '../commerce/smscode.service';
import { PaymentRequest } from '../commerce/entities/commerce.entity';
import { User } from '../users/entities/user.entity';
import type { CreateProductInput, CreateServiceInput, GuideInput } from '../commerce/commerce.service';

const GUIDE_UPLOAD_DIR = 'uploads/guides';
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly commerce: CommerceService,
    private readonly smsCode: SmsCodeService,
    @InjectRepository(PaymentRequest) private readonly paymentRequests: Repository<PaymentRequest>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  @Get('access') access(@Req() request: Request & { adminSession?: { user: unknown } }) {
    return { allowed: true, user: request.adminSession?.user ?? null };
  }

  @Get('payments')
  async payments(@Query('page') pageQuery?: string, @Query('limit') limitQuery?: string, @Query('status') statusQuery?: string) {
    const page = Math.max(1, Number(pageQuery) || 1);
    const limit = Math.min(50, Math.max(1, Number(limitQuery) || 10));
    const status = statusQuery?.trim().toUpperCase();
    const qb = this.paymentRequests.createQueryBuilder('p').orderBy('p.createdAt', 'DESC');
    if (status) qb.where('p.status = :status', { status });
    const [items, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    const userIds = [...new Set(items.map((item) => item.userId))];
    const users = userIds.length ? await this.users.find({ where: userIds.map((id) => ({ id })) }) : [];
    const byId = new Map(users.map((user) => [user.id, user]));
    return {
      items: items.map((item) => {
        const user = byId.get(item.userId);
        return {
          ...item,
          user: user ? { id: user.id, telegramId: user.telegramId, username: user.username, firstName: user.firstName, lastName: user.lastName, photoUrl: user.photoUrl } : null,
        };
      }),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  @Get('payments/:id')
  async payment(@Param('id') id: string) {
    const payment = await this.paymentRequests.findOne({ where: { id } });
    if (!payment) throw new BadRequestException('درخواست شارژ پیدا نشد.');
    const user = await this.users.findOne({ where: { id: payment.userId } });
    return {
      ...payment,
      user: user ? { id: user.id, telegramId: user.telegramId, username: user.username, firstName: user.firstName, lastName: user.lastName, photoUrl: user.photoUrl } : null,
    };
  }

  @Post('payments/:id/approve')
  approvePayment(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.commerce.approvePayment(id, reason);
  }

  @Post('payments/:id/reject')
  rejectPayment(@Param('id') id: string, @Body('reason') reason?: string) {
    const value = reason?.trim();
    if (!value) throw new BadRequestException('دلیل رد درخواست الزامی است.');
    if (value.length > 1000) throw new BadRequestException('دلیل رد درخواست بیش از حد طولانی است.');
    return this.commerce.rejectPayment(id, value);
  }

  @Get('services') services() { return this.commerce.listServices(true); }
  @Get('services/:id') service(@Param('id') id: string) { return this.commerce.getService(id); }
  @Post('services') createService(@Body() body: CreateServiceInput) { return this.commerce.createService(body); }
  @Patch('services/:id') updateService(@Param('id') id: string, @Body() body: Partial<CreateServiceInput> & { active?: boolean }) { return this.commerce.updateService(id, body); }
  @Delete('services/:id') deleteService(@Param('id') id: string) { return this.commerce.deleteService(id); }

  @Get('services/:serviceId/products') products(@Param('serviceId') serviceId: string) { return this.commerce.listProducts(serviceId, true); }
  @Get('products/:id') product(@Param('id') id: string) { return this.commerce.getProduct(id); }
  @Post('products') createProduct(@Body() body: CreateProductInput) { return this.commerce.createProduct(body); }
  @Patch('products/:id') updateProduct(@Param('id') id: string, @Body() body: Partial<Omit<CreateProductInput, 'serviceId'>> & { active?: boolean }) { return this.commerce.updateProduct(id, body); }
  @Delete('products/:id') deleteProduct(@Param('id') id: string) { return this.commerce.deleteProduct(id); }

  @Get('services/:serviceId/sms-config') smsConfig(@Param('serviceId') serviceId: string) { return this.smsCode.getServiceConfig(serviceId); }
  @Put('services/:serviceId/sms-config') saveSmsConfig(@Param('serviceId') serviceId: string, @Body() body: Record<string, unknown>) { return this.smsCode.saveServiceConfig(serviceId, body as never); }
  @Get('smscode/countries') countries() { return this.smsCode.catalogCountries(); }
  @Get('smscode/services') catalogServices(@Req() req: Request) { const value = Number((req.query as Record<string, string | undefined>).countryId); return this.smsCode.catalogServices(Number.isInteger(value) && value > 0 ? value : undefined); }
  @Get('smscode/operators') operators(@Req() req: Request) { const query = req.query as Record<string, string | undefined>; const countryId = Number(query.countryId); const platformId = Number(query.platformId); if (!Number.isInteger(countryId) || !Number.isInteger(platformId)) throw new BadRequestException('countryId و platformId الزامی هستند.'); return this.smsCode.catalogOperators(countryId, platformId); }
  @Get('smscode/products') catalogProducts(@Req() req: Request) { const query = req.query as Record<string, string | undefined>; return this.smsCode.catalogProducts({ countryId: query.countryId ? Number(query.countryId) : undefined, platformId: query.platformId ? Number(query.platformId) : undefined, operatorId: query.operatorId ? Number(query.operatorId) : undefined, sort: query.sort, page: query.page ? Number(query.page) : 1, limit: query.limit ? Number(query.limit) : 100 }); }
  @Post('smscode/webhook/configure') configureWebhook(@Body('webhookUrl') webhookUrl?: string) { return this.smsCode.configureWebhook(webhookUrl); }
  @Get('smscode/webhook') webhookStatus() { return this.smsCode.webhookStatus(); }

  @Post('guide-media/upload')
  @UseInterceptors(FileInterceptor('file', { storage: diskStorage({ destination: GUIDE_UPLOAD_DIR, filename: (_request, file, callback) => callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`) }), limits: { fileSize: 30 * 1024 * 1024 }, fileFilter: (_request, file, callback) => { if (!IMAGE_TYPES.has(file.mimetype) && !VIDEO_TYPES.has(file.mimetype)) { callback(new BadRequestException('فقط تصویر JPG/PNG/WebP/GIF یا ویدیوی MP4/WebM/MOV مجاز است.'), false); return; } callback(null, true); } }))
  uploadGuideMedia(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('فایل ارسال نشده است.');
    return { url: `/uploads/guides/${file.filename}`, mediaType: IMAGE_TYPES.has(file.mimetype) ? 'image' : 'video', originalName: file.originalname, size: file.size, mimeType: file.mimetype };
  }

  @Get('products/:productId/guide') guide(@Param('productId') productId: string) { return this.commerce.getGuide(productId); }
  @Put('products/:productId/guide') saveGuide(@Param('productId') productId: string, @Body() body: GuideInput) { return this.commerce.saveGuide(productId, body); }
  @Delete('products/:productId/guide') deleteGuide(@Param('productId') productId: string) { return this.commerce.deleteGuide(productId); }
}
