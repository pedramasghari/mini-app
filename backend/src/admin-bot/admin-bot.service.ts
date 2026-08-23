import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { CommerceService } from '../commerce/commerce.service';
import { PaymentMethod } from '../commerce/entities/commerce.entity';
import { AdminBotService as BotRuntime } from '../commerce/admin-bot.service';

/**
 * Entry point of the administrator bot.
 * The Telegram runtime remains compatible with the existing bot implementation,
 * while domain operations are exposed through dedicated services under this module.
 */
@Injectable()
export class AdminBotService extends BotRuntime {
  constructor(
    config: ConfigService,
    commerce: CommerceService,
    notifications: NotificationsService,
    @InjectRepository(PaymentMethod) methods: Repository<PaymentMethod>,
    @InjectRepository(User) users: Repository<User>,
  ) {
    super(config, commerce, notifications, methods, users);
  }
}
