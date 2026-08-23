import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from '../../commerce/entities/commerce.entity';

@Injectable()
export class AdminBotOrdersService {
  constructor(@InjectRepository(Order) private readonly orders: Repository<Order>) {}

  list(limit = 20) { return this.orders.find({ order: { createdAt: 'DESC' }, take: limit }); }
  get(id: string) { return this.orders.findOne({ where: { id } }); }
}
