import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { WalletTransaction } from './entities/commerce.entity';

const COOKIE = 'miniapp_session';

@Controller('wallet/transactions')
export class WalletTransactionsController {
  constructor(
    private readonly auth: AuthService,
    @InjectRepository(WalletTransaction)
    private readonly transactions: Repository<WalletTransaction>,
  ) {}

  private async userId(req: Request) {
    const token = req.cookies?.[COOKIE] as string | undefined;
    const session = await this.auth.getSession(token ?? '');
    return session.user.id;
  }

  @Get()
  async list(
    @Req() req: Request,
    @Query('page') pageValue?: string,
    @Query('limit') limitValue?: string,
  ) {
    const page = Math.max(1, Number(pageValue ?? 1) || 1);
    const limit = Math.min(50, Math.max(1, Number(limitValue ?? 20) || 20));
    const userId = await this.userId(req);

    const [items, total] = await this.transactions.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    };
  }
}
