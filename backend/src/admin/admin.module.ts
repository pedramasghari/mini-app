import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CommerceModule } from '../commerce/commerce.module';
import { WithdrawalsModule } from '../withdrawals/withdrawals.module';
import { User } from '../users/entities/user.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { ActivationProgress, Order, OrderInput, PaymentRequest, Product, Service, SmsCodeOrder, WalletTransaction } from '../commerce/entities/commerce.entity';
import { NumberOrder } from '../commerce/entities/number-order.entity';
import { WithdrawalRequest } from '../withdrawals/entities/withdrawal-request.entity';
import { AdminController } from './admin.controller';
import { AdminFinanceController } from './admin-finance.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminWithdrawalsController } from './admin-withdrawals.controller';
import { AdminGuard } from './admin.guard';

@Module({
  imports: [
    AuthModule,
    CommerceModule,
    WithdrawalsModule,
    TypeOrmModule.forFeature([User, Wallet, WalletTransaction, Order, OrderInput, Product, Service, SmsCodeOrder, NumberOrder, PaymentRequest, ActivationProgress, WithdrawalRequest]),
  ],
  controllers: [AdminController, AdminFinanceController, AdminUsersController, AdminOrdersController, AdminWithdrawalsController],
  providers: [AdminGuard],
  exports: [AdminGuard],
})
export class AdminModule {}
