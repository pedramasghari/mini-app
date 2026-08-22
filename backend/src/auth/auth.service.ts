import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { validate, parse } from '@telegram-apps/init-data-node';

import { UsersService } from '../users/users.service';
import { WalletsService } from '../wallets/wallets.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly walletsService: WalletsService,
  ) {}

  async authenticate(initData: string) {
    if (!initData?.trim()) {
      throw new UnauthorizedException('Telegram initData is required');
    }

    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN is not configured');

    try {
      validate(initData, botToken, { expiresIn: 3600 });
    } catch {
      throw new UnauthorizedException('Invalid or expired Telegram initData');
    }

    const data = parse(initData);
    const telegramUser = data.user;
    if (!telegramUser) throw new UnauthorizedException('Telegram user not found');

    const telegramId = String(telegramUser.id);
    let user = await this.usersService.findByTelegramId(telegramId);

    const profile = {
      username: telegramUser.username ?? null,
      firstName: telegramUser.first_name ?? null,
      lastName: telegramUser.last_name ?? null,
      languageCode: telegramUser.language_code ?? null,
      photoUrl: telegramUser.photo_url ?? null,
    };

    if (!user) {
      user = await this.usersService.create({ telegramId, ...profile });
      await this.walletsService.createForUser(user.id);
    } else {
      user = await this.usersService.update(user.id, profile);
    }

    const wallet = await this.walletsService.findByUserId(user.id);

    return { user, wallet };
  }
}
