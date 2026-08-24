import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { WalletsModule } from '../wallets/wallets.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Wallet } from '../wallets/entities/wallet.entity';
import { User } from '../users/entities/user.entity';
import { ActivationGuide, ActivationProgress, ActivationStep, Order, OrderInput, PaymentMethod, PaymentRequest, Product, Service, ServiceSmsConfig, SmsCodeOrder, SmsCodeWebhookEvent, WalletTransaction } from './entities/commerce.entity';
import { NumberOrder } from './entities/number-order.entity';
import { CommerceService } from './commerce.service';
import { CommerceController } from './commerce.controller';
import { NumberOrdersController } from './number-orders.controller';
import { NumberOrdersService } from './number-orders.service';
import { SmsCodeService } from './smscode.service';

@Module({
  imports: [
    AuthModule,
    WalletsModule,
    NotificationsModule,
    TypeOrmModule.forFeature([
      User,
      Wallet,
      Service,
      ServiceSmsConfig,
      Product,
      ActivationGuide,
      ActivationProgress,
      ActivationStep,
      Order,
      SmsCodeOrder,
      SmsCodeWebhookEvent,
      OrderInput,
      PaymentMethod,
      PaymentRequest,
      WalletTransaction,
      NumberOrder,
    ]),
  ],
  controllers: [CommerceController, NumberOrdersController],
  providers: [CommerceService, SmsCodeService, NumberOrdersService],
  exports: [CommerceService, SmsCodeService, NumberOrdersService],
})
export class CommerceModule {}
