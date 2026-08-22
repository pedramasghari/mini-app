import {
  BadRequestException, Body, Controller, Get, Param, Post, Req, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { diskStorage } from 'multer';
import { extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { AuthService } from '../auth/auth.service';
import { CommerceService } from './commerce.service';

const COOKIE = 'miniapp_session';
mkdirSync('./uploads/receipts', { recursive: true });
function token(req: Request) { return req.cookies?.[COOKIE] as string | undefined; }
type UploadedReceipt = { path: string };

@Controller()
export class CommerceController {
  constructor(private readonly commerce: CommerceService, private readonly auth: AuthService) {}
  private async userId(req: Request) { const session = await this.auth.getSession(token(req) ?? ''); return session.user.id; }
  @Get('services') listServices() { return this.commerce.listServices(); }
  @Get('products') listProducts() { return this.commerce.listProducts(); }
  @Get('services/:serviceId/products') products(@Param('serviceId') id: string) { return this.commerce.listProducts(id); }
  @Get('products/:id') product(@Param('id') id: string) { return this.commerce.product(id); }
  @Get('products/:productId/guide') guide(@Param('productId') id: string) { return this.commerce.guide(id); }
  @Post('orders') async createOrder(@Req() req: Request, @Body('productId') productId: string) { if (!productId) throw new BadRequestException('productId is required'); return this.commerce.createOrder(await this.userId(req), productId); }
  @Post('orders/:id/inputs') async inputs(@Req() req: Request, @Param('id') id: string, @Body() values: Record<string, string>) { return this.commerce.saveInputs(await this.userId(req), id, values); }
  @Get('orders/me') async orders(@Req() req: Request) { return this.commerce.myOrders(await this.userId(req)); }
  @Get('transactions/me') async transactions(@Req() req: Request) { return this.commerce.myTransactions(await this.userId(req)); }
  @Get('payment-methods') paymentMethods() { return this.commerce.paymentMethods(); }
  @Post('payments/card-transfer')
  @UseInterceptors(FileInterceptor('receipt', { storage: diskStorage({ destination: './uploads/receipts', filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`) }), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.mimetype)) }))
  async cardTransfer(@Req() req: Request, @Body('amount') amount: string, @Body('paymentMethodId') methodId: string, @UploadedFile() receipt?: UploadedReceipt) { if (!receipt) throw new BadRequestException('Receipt is required'); return this.commerce.createPayment(await this.userId(req), amount, methodId, receipt.path); }
}
