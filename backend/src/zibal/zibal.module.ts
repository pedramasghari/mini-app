import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ZibalPayment } from './entities/zibal-payment.entity';
import { ZibalController } from './zibal.controller';
import { ZibalService } from './zibal.service';
import { Wallet } from '../wallets/entities/wallet.entity';
import { WalletTransaction } from '../commerce/entities/commerce.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ZibalPayment, Wallet, WalletTransaction]),
    AuthModule,
    NotificationsModule,
  ],
  controllers: [ZibalController],
  providers: [ZibalService],
  exports: [ZibalService],
})
export class ZibalModule {}
