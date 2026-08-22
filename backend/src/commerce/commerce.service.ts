import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { Wallet } from '../wallets/entities/wallet.entity';
import {
  ActivationGuide, ActivationStep, Order, OrderInput, PaymentMethod,
  PaymentRequest, Product, Service, WalletTransaction,
} from './entities/commerce.entity';

@Injectable()
export class CommerceService {
  constructor(
    @InjectRepository(Service) private services: Repository<Service>,
    @InjectRepository(Product) private products: Repository<Product>,
    @InjectRepository(ActivationGuide) private guides: Repository<ActivationGuide>,
    @InjectRepository(ActivationStep) private steps: Repository<ActivationStep>,
    @InjectRepository(Order) private orders: Repository<Order>,
    @InjectRepository(OrderInput) private inputs: Repository<OrderInput>,
    @InjectRepository(PaymentMethod) private methods: Repository<PaymentMethod>,
    @InjectRepository(PaymentRequest) private payments: Repository<PaymentRequest>,
    @InjectRepository(WalletTransaction) private transactions: Repository<WalletTransaction>,
    private dataSource: DataSource,
    private auth: AuthService,
  ) {}

  async current(token?: string) {
    if (!token) throw new UnauthorizedException();
    return this.auth.getSession(token);
  }

  listServices() { return this.services.find({ where: { active: true }, order: { createdAt: 'ASC' } }); }
  listProducts(serviceId?: string) { return this.products.find({ where: serviceId ? { serviceId, active: true } : { active: true }, order: { createdAt: 'ASC' } }); }
  async product(id: string) { const p = await this.products.findOne({ where: { id, active: true } }); if (!p) throw new NotFoundException('Product not found'); return p; }

  async guide(productId: string) {
    const guide = await this.guides.findOne({ where: { productId, active: true } });
    if (!guide) return null;
    const steps = await this.steps.find({ where: { guideId: guide.id }, order: { position: 'ASC' } });
    return { ...guide, steps };
  }

  async createOrder(userId: string, productId: string) {
    const product = await this.product(productId);
    return this.orders.save(this.orders.create({ userId, productId, amount: product.price, currency: product.currency }));
  }

  async saveInputs(userId: string, orderId: string, values: Record<string, string>) {
    const order = await this.orders.findOne({ where: { id: orderId, userId } });
    if (!order) throw new NotFoundException('Order not found');
    await this.inputs.delete({ orderId });
    const rows = Object.entries(values).filter(([, value]) => value?.trim()).map(([key, value]) => this.inputs.create({ orderId, key, value }));
    if (rows.length) await this.inputs.save(rows);
    return { success: true };
  }

  async paymentMethods() { return this.methods.find({ where: { active: true }, select: ['id', 'type', 'title', 'cardNumber', 'holderName', 'bankName'] }); }

  async createPayment(userId: string, amount: string, paymentMethodId: string, receiptPath: string) {
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(amount) || Number(amount) <= 0) throw new BadRequestException('Invalid amount');
    const method = await this.methods.findOne({ where: { id: paymentMethodId, active: true } });
    if (!method) throw new NotFoundException('Payment method not found');
    return this.payments.save(this.payments.create({ userId, paymentMethodId, amount, receiptPath }));
  }

  async approvePayment(paymentId: string, reason?: string) {
    return this.dataSource.transaction(async manager => {
      const payment = await manager.findOne(PaymentRequest, { where: { id: paymentId } });
      if (!payment || payment.status !== 'PENDING') throw new BadRequestException('Payment is not pending');
      const wallet = await manager.findOne(Wallet, { where: { userId: payment.userId }, lock: { mode: 'pessimistic_write' } });
      if (!wallet) throw new NotFoundException('Wallet not found');
      const before = Number(wallet.balance);
      const after = before + Number(payment.amount);
      wallet.balance = after.toFixed(8);
      payment.status = 'APPROVED'; payment.adminReason = reason ?? null;
      await manager.save(wallet); await manager.save(payment);
      await manager.save(WalletTransaction, manager.create(WalletTransaction, {
        userId: payment.userId, walletId: wallet.id, type: 'DEPOSIT', amount: payment.amount,
        balanceBefore: before.toFixed(8), balanceAfter: wallet.balance, currency: payment.currency,
        referenceType: 'PAYMENT_REQUEST', referenceId: payment.id, description: 'Card transfer deposit',
      }));
      return payment;
    });
  }

  async rejectPayment(paymentId: string, reason: string) {
    const payment = await this.payments.findOne({ where: { id: paymentId } });
    if (!payment || payment.status !== 'PENDING') throw new BadRequestException('Payment is not pending');
    payment.status = 'REJECTED'; payment.adminReason = reason || 'Rejected by admin';
    return this.payments.save(payment);
  }

  async pendingPayments() { return this.payments.find({ where: { status: 'PENDING' }, order: { createdAt: 'ASC' }, take: 50 }); }
  async myOrders(userId: string) { return this.orders.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 50 }); }
  async myTransactions(userId: string) { return this.transactions.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 100 }); }
}
