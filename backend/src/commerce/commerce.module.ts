import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { WalletsModule } from '../wallets/wallets.module';
import {
  ActivationGuide, ActivationStep, Order, OrderInput, PaymentMethod,
  PaymentRequest, Product, Service, WalletTransaction,
} from './entities/commerce.entity';
import { CommerceService } from './commerce.service';
import { CommerceController } from './commerce.controller';
import { AdminBotService } from './admin-bot.service';

@Module({
  imports: [AuthModule, WalletsModule, TypeOrmModule.forFeature([
    Service, Product, ActivationGuide, ActivationStep, Order, OrderInput,
    PaymentMethod, PaymentRequest, WalletTransaction,
  ])],
  controllers: [CommerceController],
  providers: [CommerceService, AdminBotService],
  exports: [CommerceService],
})
export class CommerceModule {}
