import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Wallet } from '../wallets/entities/wallet.entity';
import { WalletTransaction } from '../commerce/entities/commerce.entity';
import { WithdrawalRequest } from './entities/withdrawal-request.entity';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsService } from './withdrawals.service';

@Module({
  imports: [
    AuthModule,
    NotificationsModule,
    TypeOrmModule.forFeature([WithdrawalRequest, Wallet, WalletTransaction]),
  ],
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
