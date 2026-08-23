import { createHash, randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { validate, parse } from '@telegram-apps/init-data-node';

import { UsersService } from '../users/users.service';
import { WalletsService } from '../wallets/wallets.service';
import { Session } from './entities/session.entity';

const SESSION_DAYS = 30;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly walletsService: WalletsService,
  ) {}

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private adminIds(): Set<string> {
    return new Set(
      String(
        this.configService.get('ADMIN_TELEGRAM_IDS') ??
          this.configService.get('ADMIN_TELEGRAM_ID') ??
          '',
      )
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    );
  }

  isAdminTelegramId(telegramId: string) {
    return this.adminIds().has(String(telegramId));
  }

  async authenticate(initData: string) {
    if (!initData?.trim()) throw new UnauthorizedException('Telegram initData is required');
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
    const profile = {
      username: telegramUser.username ?? null,
      firstName: telegramUser.first_name ?? null,
      lastName: telegramUser.last_name ?? null,
      languageCode: telegramUser.language_code ?? null,
      photoUrl: telegramUser.photo_url ?? null,
      role: this.isAdminTelegramId(telegramId) ? ('ADMIN' as const) : ('USER' as const),
    };

    let user = await this.usersService.findByTelegramId(telegramId);
    if (!user) {
      user = await this.usersService.create({ telegramId, ...profile });
      await this.walletsService.createForUser(user.id);
    } else {
      user = await this.usersService.update(user.id, profile);
    }

    const wallet = await this.walletsService.findByUserId(user.id);
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await this.sessions.delete({ userId: user.id });
    await this.sessions.save(
      this.sessions.create({
        userId: user.id,
        tokenHash: this.hashToken(token),
        expiresAt,
        telegramQueryId: data.query_id ?? null,
      }),
    );

    return {
      token,
      expiresAt,
      user,
      wallet,
      isAdmin: user.role === 'ADMIN',
    };
  }

  async getSession(token: string) {
    if (!token) throw new UnauthorizedException('Authentication required');
    const session = await this.sessions.findOne({
      where: { tokenHash: this.hashToken(token) },
      relations: { user: true },
    });
    if (!session || session.expiresAt.getTime() <= Date.now()) {
      if (session) await this.sessions.delete(session.id);
      throw new UnauthorizedException('Session expired');
    }
    const wallet = await this.walletsService.findByUserId(session.userId);
    return {
      user: session.user,
      wallet,
      isAdmin: session.user.role === 'ADMIN',
    };
  }

  async logout(token: string) {
    if (token) await this.sessions.delete({ tokenHash: this.hashToken(token) });
  }
}
