import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { diskStorage } from 'multer';
import { extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CommerceService } from './commerce.service';
import { SmsCodeOrder } from './entities/commerce.entity';
import { SmsCodeService } from './smscode.service';

const COOKIE = 'miniapp_session';
mkdirSync('./uploads/receipts', { recursive: true });
function token(req: Request) { return req.cookies?.[COOKIE] as string | undefined; }
type UploadedReceipt = { path: string };

@Controller()
export class CommerceController {
  constructor(
    private readonly commerce: CommerceService,
    private readonly auth: AuthService,
    private readonly notifications: NotificationsService,
    private readonly smsCode: SmsCodeService,
    @InjectRepository(SmsCodeOrder) private readonly smsOrders: Repository<SmsCodeOrder>,
  ) {}

  private async userId(req: Request) {
    const session = await this.auth.getSession(token(req) ?? '');
    return session.user.id;
  }

  @Get('services') listServices() { return this.commerce.listServices(); }
  @Get('products') listProducts() { return this.commerce.listProducts(); }
  @Get('services/:serviceId/products') products(@Param('serviceId') id: string) { return this.commerce.listProducts(id); }
  @Get('products/:id') product(@Param('id') id: string) { return this.commerce.product(id); }
  @Get('products/:productId/guide') guide(@Param('productId') id: string) { return this.commerce.guide(id); }
  @Post('orders') async createOrder(@Req() req: Request, @Body('productId') productId: string) { if (!productId) throw new BadRequestException('productId is required'); return this.commerce.createOrder(await this.userId(req), productId); }
  @Get('orders/:id/guide') async orderGuide(@Req() req: Request, @Param('id') id: string) { return this.commerce.orderGuide(await this.userId(req), id); }
  @Post('orders/:id/progress') async progress(@Req() req: Request, @Param('id') id: string, @Body('step') step: number, @Body('values') values?: Record<string, string>) { return this.commerce.updateProgress(await this.userId(req), id, Number(step), values); }
  @Post('orders/:id/inputs') async inputs(@Req() req: Request, @Param('id') id: string, @Body() values: Record<string, string>) { return this.commerce.saveInputs(await this.userId(req), id, values); }
  @Get('orders/me') async orders(@Req() req: Request) { return this.commerce.myOrders(await this.userId(req)); }
  @Get('transactions/me') async transactions(@Req() req: Request) { return this.commerce.myTransactions(await this.userId(req)); }
  @Get('payment-methods') paymentMethods() { return this.commerce.paymentMethods(); }

  @Post('smscode/orders') async createSmsOrder(@Req() req: Request, @Body('productId') productId: string) {
    return this.smsCode.create(await this.userId(req), productId);
  }

  @Get('smscode/orders/active') async activeSmsOrder(@Req() req: Request, @Query('serviceId') serviceId?: string) {
    const userId = await this.userId(req);
    if (!serviceId) throw new BadRequestException('serviceId is required');

    const row = await this.smsOrders.findOne({
      where: {
        userId,
        serviceId,
        status: In(['ACTIVE', 'OTP_RECEIVED']),
      },
      order: { createdAt: 'DESC' },
    });

    if (!row) return null;

    const current = await this.smsCode.get(userId, row.id);
    return current && ['ACTIVE', 'OTP_RECEIVED'].includes(current.status) ? current : null;
  }

  @Get('smscode/orders/:id') async smsOrder(@Req() req: Request, @Param('id') id: string) {
    return this.smsCode.get(await this.userId(req), id);
  }

  @Post('smscode/orders/:id/resend') async resendSms(@Req() req: Request, @Param('id') id: string) {
    return this.smsCode.resend(await this.userId(req), id);
  }

  @Post('smscode/orders/:id/cancel') async cancelSms(@Req() req: Request, @Param('id') id: string) {
    return this.smsCode.cancel(await this.userId(req), id);
  }

  /** SMSCode calls this endpoint directly. It is intentionally outside auth/session guards. */
  @Post('webhooks/smscode')
  async smscodeWebhook(@Req() req: RawBodyRequest<Request>, @Body() body: Record<string, unknown>) {
    const signature = req.header('X-Webhook-Signature');
    const rawBody = req.rawBody;
    if (!rawBody) throw new BadRequestException('Raw webhook body is unavailable.');
    return this.smsCode.handleWebhook(rawBody, signature, body as never);
  }

  @Post('payments/card-transfer')
  @UseInterceptors(FileInterceptor('receipt', {
    storage: diskStorage({
      destination: './uploads/receipts',
      filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.mimetype)),
  }))
  async cardTransfer(
    @Req() req: Request,
    @Body('amount') amount: string,
    @Body('paymentMethodId') methodId: string,
    @UploadedFile() receipt?: UploadedReceipt,
  ) {
    if (!receipt) throw new BadRequestException('Receipt is required');
    const userId = await this.userId(req);
    const payment = await this.commerce.createPayment(userId, amount, methodId, receipt.path);
    await this.notifications.create(userId, { type: 'DEPOSIT_PENDING', title: 'درخواست شارژ ثبت شد', message: `درخواست شارژ به مبلغ ${payment.amount} ${payment.currency} ثبت شد و در انتظار بررسی است.`, data: { paymentId: payment.id, amount: payment.amount, status: payment.status } });
    return payment;
  }
}
