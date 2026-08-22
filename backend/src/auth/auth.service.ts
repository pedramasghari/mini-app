import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';

import { validate, parse } from '@telegram-apps/init-data-node';

import { UsersService } from '../users/users.service';
import { WalletsService } from '../wallets/wallets.service';

import { Session } from './entities/session.entity';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly walletsService: WalletsService,
    @InjectRepository(Session)
    private readonly sessionsRepository: Repository<Session>,
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

    if (!user) {
      user = await this.usersService.create({
        telegramId,
        username: telegramUser.username ?? null,
        firstName: telegramUser.firstName ?? null,
        lastName: telegramUser.lastName ?? null,
        languageCode: telegramUser.languageCode ?? null,
      });
      await this.walletsService.createForUser(user.id);
    } else {
      user.username = telegramUser.username ?? null;
      user.firstName = telegramUser.firstName ?? null;
      user.lastName = telegramUser.lastName ?? null;
      user.languageCode = telegramUser.languageCode ?? null;
      user = await this.usersService.save(user);
    }

    let wallet = await this.walletsService.findByUserId(user.id);
    if (!wallet) wallet = await this.walletsService.createForUser(user.id);

    const sessionToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashSessionToken(sessionToken);
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

    await this.sessionsRepository.delete({ userId: user.id });
    await this.sessionsRepository.save(
      this.sessionsRepository.create({
        tokenHash,
        userId: user.id,
        expiresAt,
        telegramQueryId: data.queryId ?? null,
      }),
    );

    return { sessionToken, expiresAt, user, wallet };
  }

  async getUserFromSession(sessionToken: string) {
    const session = await this.sessionsRepository.findOne({
      where: { tokenHash: this.hashSessionToken(sessionToken) },
      relations: { user: true },
    });
    if (!session) return null;

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.sessionsRepository.delete(session.id);
      return null;
    }
    return session.user;
  }

  async getWalletForUser(userId: string) {
    return this.walletsService.findByUserId(userId);
  }

  async logout(sessionToken?: string) {
    if (!sessionToken) return;
    await this.sessionsRepository.delete({
      tokenHash: this.hashSessionToken(sessionToken),
    });
  }

  private hashSessionToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
