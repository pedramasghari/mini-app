import { BadRequestException, Injectable, NotFoundException, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { Wallet } from '../wallets/entities/wallet.entity';
import { ActivationGuide, ActivationProgress, ActivationStep, Order, OrderInput, PaymentMethod, PaymentRequest, Product, Service, WalletTransaction } from './entities/commerce.entity';

@Injectable()
export class CommerceService implements OnModuleInit {
  constructor(@InjectRepository(Service) private services: Repository<Service>, @InjectRepository(Product) private products: Repository<Product>, @InjectRepository(ActivationGuide) private guides: Repository<ActivationGuide>, @InjectRepository(ActivationStep) private steps: Repository<ActivationStep>, @InjectRepository(ActivationProgress) private progress: Repository<ActivationProgress>, @InjectRepository(Order) private orders: Repository<Order>, @InjectRepository(OrderInput) private inputs: Repository<OrderInput>, @InjectRepository(PaymentMethod) private methods: Repository<PaymentMethod>, @InjectRepository(PaymentRequest) private payments: Repository<PaymentRequest>, @InjectRepository(WalletTransaction) private transactions: Repository<WalletTransaction>, private dataSource: DataSource, private auth: AuthService) {}

  async onModuleInit() {
    const exists = await this.services.findOne({ where: { slug: 'apple-id' } }); if (exists) return;
    const service = await this.services.save(this.services.create({ slug: 'apple-id', title: 'Apple ID', description: 'Guided Apple account setup service.', icon: 'apple', active: true }));
    const product = await this.products.save(this.products.create({ serviceId: service.id, title: 'Apple ID Setup', description: 'Step-by-step guidance for setting up your own Apple Account.', price: '9.99', currency: 'USD', icon: 'apple', active: true, requiresGuide: true }));
    const guide = await this.guides.save(this.guides.create({ productId: product.id, title: 'Apple Account Setup Guide', description: 'Follow each step in order and use your own account information.', active: true }));
    await this.steps.save([
      this.steps.create({ guideId: guide.id, position: 1, title: 'Prepare your information', content: 'Have an email address you control and the information required by Apple ready before continuing.' }),
      this.steps.create({ guideId: guide.id, position: 2, title: 'Start Apple Account setup', content: 'Open Apple’s official account setup flow and follow the on-screen instructions.' }),
      this.steps.create({ guideId: guide.id, position: 3, title: 'Enter your details', content: 'Enter your own name, date of birth, email address and a strong password when requested.', requiresInput: true, inputKey: 'email', inputLabel: 'Email address' }),
      this.steps.create({ guideId: guide.id, position: 4, title: 'Complete verification', content: 'Complete any verification Apple requests using verification methods available to you.' }),
      this.steps.create({ guideId: guide.id, position: 5, title: 'Finish setup', content: 'Review the account details, accept Apple’s terms where applicable, and finish the setup.' }),
    ]);
  }

  async current(token?: string) { if (!token) throw new UnauthorizedException(); return this.auth.getSession(token); }
  listServices() { return this.services.find({ where: { active: true }, order: { createdAt: 'ASC' } }); }
  listProducts(serviceId?: string) { return this.products.find({ where: serviceId ? { serviceId, active: true } : { active: true }, order: { createdAt: 'ASC' } }); }
  async product(id: string) { const p = await this.products.findOne({ where: { id, active: true } }); if (!p) throw new NotFoundException('Product not found'); return p; }
  async guide(productId: string) { const guide = await this.guides.findOne({ where: { productId, active: true } }); if (!guide) return null; const steps = await this.steps.find({ where: { guideId: guide.id }, order: { position: 'ASC' } }); return { ...guide, steps }; }

  async createOrder(userId: string, productId: string) {
    const product = await this.product(productId);
    const result = await this.dataSource.transaction(async manager => {
      const wallet = await manager.findOne(Wallet, { where: { userId }, lock: { mode: 'pessimistic_write' } });
      if (!wallet) throw new NotFoundException('Wallet not found');
      if (wallet.currency !== product.currency) throw new BadRequestException(`Wallet currency must be ${product.currency}`);
      const before = Number(wallet.balance); const price = Number(product.price);
      if (!Number.isFinite(price) || price <= 0) throw new BadRequestException('Invalid product price');
      if (before < price) throw new BadRequestException('INSUFFICIENT_BALANCE');
      const after = before - price;
      wallet.balance = after.toFixed(8);
      const order = manager.create(Order, { userId, productId, amount: product.price, currency: product.currency, status: 'IN_PROGRESS' });
      const saved = await manager.save(order);
      await manager.save(wallet);
      await manager.save(WalletTransaction, manager.create(WalletTransaction, { userId, walletId: wallet.id, type: 'PURCHASE', amount: `-${price.toFixed(8)}`, balanceBefore: before.toFixed(8), balanceAfter: wallet.balance, currency: wallet.currency, referenceType: 'ORDER', referenceId: saved.id, description: product.title }));
      const guide = await manager.findOne(ActivationGuide, { where: { productId, active: true } });
      let progress = null;
      if (guide) progress = await manager.save(manager.create(ActivationProgress, { orderId: saved.id, userId, guideId: guide.id, currentStep: 0, completed: false }));
      return { order: saved, progress, guide };
    });
    return result;
  }

  async orderGuide(userId: string, orderId: string) {
    const order = await this.orders.findOne({ where: { id: orderId, userId } }); if (!order) throw new NotFoundException('Order not found');
    const product = await this.product(order.productId); const guide = await this.guides.findOne({ where: { productId: product.id, active: true } }); if (!guide) throw new NotFoundException('Guide not found');
    const steps = await this.steps.find({ where: { guideId: guide.id }, order: { position: 'ASC' } });
    let progress = await this.progress.findOne({ where: { orderId, userId } });
    if (!progress) progress = await this.progress.save(this.progress.create({ orderId, userId, guideId: guide.id, currentStep: 0, completed: false }));
    const inputs = await this.inputs.find({ where: { orderId } });
    return { order, product, guide, steps, progress, inputs };
  }

  async updateProgress(userId: string, orderId: string, step: number, values?: Record<string, string>) {
    const data = await this.orderGuide(userId, orderId); if (step < 0 || step > data.steps.length - 1) throw new BadRequestException('Invalid step');
    if (values) await this.saveInputs(userId, orderId, values);
    const progress = data.progress; progress.currentStep = step; progress.completed = step === data.steps.length - 1; return this.progress.save(progress);
  }
  async saveInputs(userId: string, orderId: string, values: Record<string, string>) { const order = await this.orders.findOne({ where: { id: orderId, userId } }); if (!order) throw new NotFoundException('Order not found'); await this.inputs.delete({ orderId }); const rows = Object.entries(values).filter(([, value]) => value?.trim()).map(([key, value]) => this.inputs.create({ orderId, key, value })); if (rows.length) await this.inputs.save(rows); return { success: true }; }
  async paymentMethods() { return this.methods.find({ where: { active: true }, select: ['id', 'type', 'title', 'cardNumber', 'holderName', 'bankName'] }); }
  async createPayment(userId: string, amount: string, paymentMethodId: string, receiptPath: string) { if (!/^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(amount) || Number(amount) <= 0) throw new BadRequestException('Invalid amount'); const method = await this.methods.findOne({ where: { id: paymentMethodId, active: true } }); if (!method) throw new NotFoundException('Payment method not found'); return this.payments.save(this.payments.create({ userId, paymentMethodId, amount, receiptPath })); }
  async approvePayment(paymentId: string, reason?: string) { return this.dataSource.transaction(async manager => { const payment = await manager.findOne(PaymentRequest, { where: { id: paymentId } }); if (!payment || payment.status !== 'PENDING') throw new BadRequestException('Payment is not pending'); const wallet = await manager.findOne(Wallet, { where: { userId: payment.userId }, lock: { mode: 'pessimistic_write' } }); if (!wallet) throw new NotFoundException('Wallet not found'); const before = Number(wallet.balance); const after = before + Number(payment.amount); wallet.balance = after.toFixed(8); payment.status = 'APPROVED'; payment.adminReason = reason ?? null; await manager.save(wallet); await manager.save(payment); await manager.save(WalletTransaction, manager.create(WalletTransaction, { userId: payment.userId, walletId: wallet.id, type: 'DEPOSIT', amount: payment.amount, balanceBefore: before.toFixed(8), balanceAfter: wallet.balance, currency: payment.currency, referenceType: 'PAYMENT_REQUEST', referenceId: payment.id, description: 'Card transfer deposit' })); return payment; }); }
  async rejectPayment(paymentId: string, reason: string) { const payment = await this.payments.findOne({ where: { id: paymentId } }); if (!payment || payment.status !== 'PENDING') throw new BadRequestException('Payment is not pending'); payment.status = 'REJECTED'; payment.adminReason = reason || 'Rejected by admin'; return this.payments.save(payment); }
  async pendingPayments() { return this.payments.find({ where: { status: 'PENDING' }, order: { createdAt: 'ASC' }, take: 50 }); }
  async myOrders(userId: string) { return this.orders.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 50 }); }
  async myTransactions(userId: string) { return this.transactions.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 100 }); }
}
