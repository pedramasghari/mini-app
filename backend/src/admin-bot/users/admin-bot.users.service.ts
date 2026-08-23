import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class AdminBotUsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  list(limit = 20) { return this.users.find({ order: { createdAt: 'DESC' }, take: limit }); }
  get(id: string) { return this.users.findOne({ where: { id } }); }
  getByTelegramId(telegramId: string) { return this.users.findOne({ where: { telegramId } }); }
}
