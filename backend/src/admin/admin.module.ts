import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommerceModule } from '../commerce/commerce.module';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';

@Module({
  imports: [AuthModule, CommerceModule],
  controllers: [AdminController],
  providers: [AdminGuard],
  exports: [AdminGuard],
})
export class AdminModule {}
