import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Wallet } from './entities/wallet.entity';

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletsRepository: Repository<Wallet>,
  ) {}

  async createForUser(userId: string): Promise<Wallet> {
    const wallet = this.walletsRepository.create({
      userId,
      balance: '0',
      currency: 'USD',
    });

    return this.walletsRepository.save(wallet);
  }

  async findByUserId(userId: string): Promise<Wallet | null> {
    return this.walletsRepository.findOne({
      where: {
        userId,
      },
    });
  }
}
