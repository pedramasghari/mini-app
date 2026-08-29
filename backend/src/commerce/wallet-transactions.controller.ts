import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { WalletTransaction } from './entities/commerce.entity';
import { ZibalPayment } from '../zibal/entities/zibal-payment.entity';

const COOKIE = 'miniapp_session';

@Controller('wallet/transactions')
export class WalletTransactionsController {
  constructor(
    private readonly auth: AuthService,
    @InjectRepository(WalletTransaction)
    private readonly transactions: Repository<WalletTransaction>,
    @InjectRepository(ZibalPayment)
    private readonly zibalPayments: Repository<ZibalPayment>,
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

    const zibalIds = items
      .filter((item) => item.referenceType === 'ZIBAL_PAYMENT' && item.referenceId)
      .map((item) => item.referenceId!)
      .filter(Boolean);
    const zibalPayments = zibalIds.length
      ? await this.zibalPayments.find({ where: { id: In(zibalIds), userId } })
      : [];
    const zibalById = new Map(zibalPayments.map((payment) => [payment.id, payment]));

    return {
      items: items.map((transaction) => {
        const payment = transaction.referenceType === 'ZIBAL_PAYMENT' && transaction.referenceId
          ? zibalById.get(transaction.referenceId)
          : undefined;

        return {
          ...transaction,
          gateway: payment ? 'ZIBAL' : null,
          gatewayStatus: payment?.status ?? null,
          gatewayTrackId: payment?.trackId ?? null,
          gatewayResult: payment?.gatewayResult ?? null,
          gatewayMessage: payment?.gatewayMessage ?? null,
          gatewayRefNumber: payment?.refNumber ?? null,
          gatewayCardNumber: payment?.cardNumber ?? null,
          gatewayPaidAt: payment?.paidAt ?? null,
        };
      }),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    };
  }
}
