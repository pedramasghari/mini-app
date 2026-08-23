import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { WalletsModule } from '../wallets/wallets.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminBotModule } from '../admin-bot/admin-bot.module';
import { User } from '../users/entities/user.entity';
import { ActivationGuide, ActivationProgress, ActivationStep, Order, OrderInput, PaymentMethod, PaymentRequest, Product, Service, WalletTransaction } from './entities/commerce.entity';
import { CommerceService } from './commerce.service';
import { CommerceController } from './commerce.controller';

@Module({
  imports: [AuthModule, WalletsModule, NotificationsModule, forwardRef(() => AdminBotModule), TypeOrmModule.forFeature([User, Service, Product, ActivationGuide, ActivationProgress, ActivationStep, Order, OrderInput, PaymentMethod, PaymentRequest, WalletTransaction])],
  controllers: [CommerceController],
  providers: [CommerceService],
  exports: [CommerceService],
})
export class CommerceModule {}
