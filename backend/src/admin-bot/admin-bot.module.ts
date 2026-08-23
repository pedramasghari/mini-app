import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminBotRuntimeService } from './runtime/admin-bot.runtime.service';

@Module({
  imports: [ConfigModule],
  providers: [AdminBotRuntimeService],
  exports: [AdminBotRuntimeService],
})
export class AdminBotModule {}
