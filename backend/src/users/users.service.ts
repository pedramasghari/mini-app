import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findByTelegramId(telegramId: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { telegramId } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findAdmins(): Promise<User[]> {
    return this.usersRepository.find({ where: { role: 'ADMIN' } });
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (!ids.length) return [];
    return this.usersRepository.find({ where: { id: In(ids) } });
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(data);
    return this.usersRepository.save(user);
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    await this.usersRepository.update(id, data);
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new Error('User not found after update');
    return user;
  }

  async save(user: User): Promise<User> {
    return this.usersRepository.save(user);
  }
}
