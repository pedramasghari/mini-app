import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { WalletsModule } from './wallets/wallets.module';
import { AuthModule } from './auth/auth.module';
import { CommerceModule } from './commerce/commerce.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminBotModule } from './admin-bot/admin-bot.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    UsersModule,
    WalletsModule,
    AuthModule,
    NotificationsModule,
    CommerceModule,
    AdminBotModule,
    AdminModule,
  ],
})
export class AppModule {}
