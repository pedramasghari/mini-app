import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CommerceModule } from '../commerce/commerce.module';
import { User } from '../users/entities/user.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { ActivationProgress, Order, OrderInput, PaymentRequest, Product, Service, SmsCodeOrder, WalletTransaction } from '../commerce/entities/commerce.entity';
import { AdminController } from './admin.controller';
import { AdminFinanceController } from './admin-finance.controller';
import { AdminGuard } from './admin.guard';

@Module({
  imports: [
    AuthModule,
    CommerceModule,
    TypeOrmModule.forFeature([User, Wallet, WalletTransaction, Order, OrderInput, Product, Service, SmsCodeOrder, PaymentRequest, ActivationProgress]),
  ],
  controllers: [AdminController, AdminFinanceController],
  providers: [AdminGuard],
  exports: [AdminGuard],
})
export class AdminModule {}
