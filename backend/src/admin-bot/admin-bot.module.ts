import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CommerceModule } from '../commerce/commerce.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../users/entities/user.entity';
import { ActivationGuide, ActivationProgress, ActivationStep, Order, OrderInput, PaymentMethod, PaymentRequest, Product, Service, WalletTransaction } from '../commerce/entities/commerce.entity';
import { AdminBotService } from './admin-bot.service';
import { AdminBotConversationService } from './conversations/admin-bot.conversation.service';
import { AdminBotFinanceService } from './finance/admin-bot.finance.service';
import { AdminBotOrdersService } from './orders/admin-bot.orders.service';
import { AdminBotUsersService } from './users/admin-bot.users.service';
import { AdminBotServiceManagementService } from './services/admin-bot.service-management.service';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => CommerceModule),
    NotificationsModule,
    TypeOrmModule.forFeature([User, Service, Product, ActivationGuide, ActivationProgress, ActivationStep, Order, OrderInput, PaymentMethod, PaymentRequest, WalletTransaction]),
  ],
  providers: [
    AdminBotService,
    AdminBotConversationService,
    AdminBotFinanceService,
    AdminBotOrdersService,
    AdminBotUsersService,
    AdminBotServiceManagementService,
  ],
  exports: [AdminBotService],
})
export class AdminBotModule {}
