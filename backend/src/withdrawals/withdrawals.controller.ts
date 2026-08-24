import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { WithdrawalsService } from './withdrawals.service';

const COOKIE = 'miniapp_session';

@Controller('wallet/withdrawals')
export class WithdrawalsController {
  constructor(private readonly auth: AuthService, private readonly withdrawals: WithdrawalsService) {}

  private async userId(req: Request) {
    const token = req.cookies?.[COOKIE] as string | undefined;
    const session = await this.auth.getSession(token ?? '');
    return session.user.id;
  }

  @Get()
  list(@Req() req: Request, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.withdrawals.listMine(await this.userId(req), Number(page ?? 1), Number(limit ?? 10));
  }

  @Post()
  create(@Req() req: Request, @Body() body: { cardNumber?: string; cardHolderName?: string; amount?: string }) {
    if (!body.cardNumber || !body.cardHolderName || !body.amount) throw new BadRequestException('شماره کارت، نام صاحب کارت و مبلغ الزامی است.');
    return this.withdrawals.create(await this.userId(req), {
      cardNumber: body.cardNumber,
      cardHolderName: body.cardHolderName,
      amount: body.amount,
    });
  }

  @Post(':id/cancel')
  cancel(@Req() req: Request, @Param('id') id: string) {
    return this.withdrawals.cancel(await this.userId(req), id);
  }
}
