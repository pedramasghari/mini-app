import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { WithdrawalsService } from './withdrawals.service';

const COOKIE = 'miniapp_session';

@Controller('wallet/requests')
export class WalletRequestsController {
  constructor(private readonly auth: AuthService, private readonly withdrawals: WithdrawalsService) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    const token = req.cookies?.[COOKIE] as string | undefined;
    const session = await this.auth.getSession(token ?? '');
    return this.withdrawals.listWalletRequests(
      session.user.id,
      Number(page ?? 1),
      Number(limit ?? 10),
      type ?? 'ALL',
      status,
    );
  }
}
