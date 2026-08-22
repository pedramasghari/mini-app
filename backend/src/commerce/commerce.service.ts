import { BadRequestException, Injectable, NotFoundException, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Wallet } from '../wallets/entities/wallet.entity';
import { ActivationGuide, ActivationProgress, ActivationStep, Order, OrderInput, PaymentMethod, PaymentRequest, Product, Service, WalletTransaction } from './entities/commerce.entity';

@Injectable()
export class CommerceService implements OnModuleInit {
  constructor(
    @InjectRepository(Service) private services: Repository<Service>,
    @InjectRepository(Product) private products: Repository<Product>,
    @InjectRepository(ActivationGuide) private guides: Repository<ActivationGuide>,
    @InjectRepository(ActivationStep) private steps: Repository<ActivationStep>,
    @InjectRepository(ActivationProgress) private progress: Repository<ActivationProgress>,
    @InjectRepository(Order) private orders: Repository<Order>,
    @InjectRepository(OrderInput) private inputs: Repository<OrderInput>,
    @InjectRepository(PaymentMethod) private methods: Repository<PaymentMethod>,
    @InjectRepository(PaymentRequest) private payments: Repository<PaymentRequest>,
    @InjectRepository(WalletTransaction) private transactions: Repository<WalletTransaction>,
    private dataSource: DataSource,
    private auth: AuthService,
    private notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    const exists = await this.services.findOne({ where: { slug: 'apple-id' } });
    if (exists) return;
    const service = await this.services.save(this.services.create({ slug: 'apple-id', title: 'اپل آیدی', description: 'راهنمای مرحله‌به‌مرحله ساخت و راه‌اندازی حساب اپل خودتان.', icon: 'apple', active: true }));
    const product = await this.products.save(this.products.create({ serviceId: service.id, title: 'راهنمای راه‌اندازی اپل آیدی', description: 'راهنمای مرحله‌به‌مرحله برای راه‌اندازی حساب شخصی اپل.', price: '9.99', currency: 'USD', icon: 'apple', active: true, requiresGuide: true }));
    const guide = await this.guides.save(this.guides.create({ productId: product.id, title: 'راهنمای فعال‌سازی اپل آیدی', description: 'مراحل را به‌ترتیب انجام دهید و فقط از اطلاعات متعلق به خودتان استفاده کنید.', active: true }));
    await this.steps.save([
      this.steps.create({ guideId: guide.id, position: 1, title: 'آماده‌سازی اطلاعات', content: 'یک ایمیل در اختیار خودتان و اطلاعات موردنیاز اپل را قبل از شروع آماده کنید.' }),
      this.steps.create({ guideId: guide.id, position: 2, title: 'شروع ساخت حساب اپل', content: 'فرآیند رسمی ساخت حساب اپل را باز کنید و دستورالعمل‌های نمایش‌داده‌شده را دنبال کنید.' }),
      this.steps.create({ guideId: guide.id, position: 3, title: 'وارد کردن اطلاعات شخصی', content: 'در صورت درخواست، نام، تاریخ تولد، ایمیل و یک گذرواژه قوی متعلق به خودتان را وارد کنید.', requiresInput: true, inputKey: 'email', inputLabel: 'ایمیل' }),
      this.steps.create({ guideId: guide.id, position: 4, title: 'تکمیل تأیید هویت', content: 'هر مرحله تأییدی را که اپل درخواست می‌کند، با روش‌های تأیید در دسترس خودتان تکمیل کنید.' }),
      this.steps.create({ guideId: guide.id, position: 5, title: 'پایان راه‌اندازی', content: 'اطلاعات حساب را بررسی کنید، در صورت نیاز شرایط اپل را بپذیرید و راه‌اندازی را به پایان برسانید.' }),
    ]);
  }

  async current(token?: string) { if (!token) throw new UnauthorizedException('جلسه ورود معتبر نیست.'); return this.auth.getSession(token); }
  listServices() { return this.services.find({ where: { active: true }, order: { createdAt: 'ASC' } }); }
  listProducts(serviceId?: string) { return this.products.find({ where: serviceId ? { serviceId, active: true } : { active: true }, order: { createdAt: 'ASC' } }); }
  async product(id: string) { const p = await this.products.findOne({ where: { id, active: true } }); if (!p) throw new NotFoundException('محصول پیدا نشد.'); return p; }
  async guide(productId: string) { const guide = await this.guides.findOne({ where: { productId, active: true } }); if (!guide) return null; return { ...guide, steps: await this.steps.find({ where: { guideId: guide.id }, order: { position: 'ASC' } }) }; }

  async createOrder(userId: string, productId: string) {
    const product = await this.product(productId);
    return this.dataSource.transaction(async manager => {
      const wallet = await manager.findOne(Wallet, { where: { userId }, lock: { mode: 'pessimistic_write' } });
      if (!wallet) throw new NotFoundException('کیف پول پیدا نشد.');
      if (wallet.currency !== product.currency) throw new BadRequestException(`واحد پول کیف پول باید ${product.currency} باشد.`);
      const before = Number(wallet.balance), price = Number(product.price);
      if (!Number.isFinite(price) || price <= 0) throw new BadRequestException('قیمت محصول معتبر نیست.');
      if (before < price) throw new BadRequestException('موجودی کیف پول کافی نیست.');
      wallet.balance = (before - price).toFixed(8);
      const order = await manager.save(manager.create(Order, { userId, productId, amount: product.price, currency: product.currency, status: 'IN_PROGRESS' }));
      await manager.save(wallet);
      await manager.save(WalletTransaction, manager.create(WalletTransaction, { userId, walletId: wallet.id, type: 'PURCHASE', amount: `-${price.toFixed(8)}`, balanceBefore: before.toFixed(8), balanceAfter: wallet.balance, currency: wallet.currency, referenceType: 'ORDER', referenceId: order.id, description: product.title }));
      const guide = await manager.findOne(ActivationGuide, { where: { productId, active: true } });
      const progress = guide ? await manager.save(manager.create(ActivationProgress, { orderId: order.id, userId, guideId: guide.id, currentStep: 0, completed: false })) : null;
      return { order, progress, guide };
    });
  }

  async orderGuide(userId: string, orderId: string) {
    const order = await this.orders.findOne({ where: { id: orderId, userId } }); if (!order) throw new NotFoundException('سفارش پیدا نشد.');
    const product = await this.product(order.productId); const guide = await this.guides.findOne({ where: { productId: product.id, active: true } }); if (!guide) throw new NotFoundException('راهنمای فعال‌سازی پیدا نشد.');
    const steps = await this.steps.find({ where: { guideId: guide.id }, order: { position: 'ASC' } }); let progress = await this.progress.findOne({ where: { orderId, userId } });
    if (!progress) progress = await this.progress.save(this.progress.create({ orderId, userId, guideId: guide.id, currentStep: 0, completed: false }));
    return { order, product, guide, steps, progress, inputs: await this.inputs.find({ where: { orderId } }) };
  }

  async updateProgress(userId: string, orderId: string, step: number, values?: Record<string, string>) { const data = await this.orderGuide(userId, orderId); if (step < 0 || step > data.steps.length - 1) throw new BadRequestException('مرحله انتخاب‌شده معتبر نیست.'); if (values) await this.saveInputs(userId, orderId, values); data.progress.currentStep = step; data.progress.completed = step === data.steps.length - 1; return this.progress.save(data.progress); }
  async saveInputs(userId: string, orderId: string, values: Record<string, string>) { const order = await this.orders.findOne({ where: { id: orderId, userId } }); if (!order) throw new NotFoundException('سفارش پیدا نشد.'); await this.inputs.delete({ orderId }); const rows = Object.entries(values).filter(([, value]) => value?.trim()).map(([key, value]) => this.inputs.create({ orderId, key, value })); if (rows.length) await this.inputs.save(rows); return { success: true }; }
  async paymentMethods() { return this.methods.find({ where: { active: true }, select: ['id', 'type', 'title', 'cardNumber', 'holderName', 'bankName'] }); }

  async createPayment(userId: string, amount: string, paymentMethodId: string, receiptPath: string) {
    if (!/^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(amount) || Number(amount) <= 0) throw new BadRequestException('مبلغ واردشده معتبر نیست.');
    const method = await this.methods.findOne({ where: { id: paymentMethodId, active: true, type: 'CARD_TRANSFER' } }); if (!method) throw new NotFoundException('روش پرداخت کارت‌به‌کارت پیدا نشد.');
    const pending = await this.payments.findOne({ where: { userId, status: 'PENDING' } }); if (pending) throw new BadRequestException('یک درخواست شارژ در انتظار بررسی دارید.');
    const wallet = await this.dataSource.getRepository(Wallet).findOne({ where: { userId } }); if (!wallet) throw new NotFoundException('کیف پول پیدا نشد.');
    try { return await this.payments.save(this.payments.create({ userId, paymentMethodId, amount, currency: wallet.currency, receiptPath, status: 'PENDING' })); }
    catch (error) { if (error instanceof QueryFailedError && (error as any).driverError?.code === '23505') throw new BadRequestException('یک درخواست شارژ در انتظار بررسی دارید.'); throw error; }
  }

  async approvePayment(paymentId: string, reason?: string) {
    const result = await this.dataSource.transaction(async manager => {
      const payment = await manager.findOne(PaymentRequest, { where: { id: paymentId }, lock: { mode: 'pessimistic_write' } }); if (!payment || payment.status !== 'PENDING') throw new BadRequestException('این درخواست در انتظار بررسی نیست یا قبلاً پردازش شده است.');
      const wallet = await manager.findOne(Wallet, { where: { userId: payment.userId }, lock: { mode: 'pessimistic_write' } }); if (!wallet) throw new NotFoundException('کیف پول پیدا نشد.');
      const before = Number(wallet.balance), amount = Number(payment.amount); if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('مبلغ درخواست معتبر نیست.'); if (wallet.currency !== payment.currency) throw new BadRequestException('واحد پول پرداخت با کیف پول یکسان نیست.');
      wallet.balance = (before + amount).toFixed(8); payment.status = 'APPROVED'; payment.adminReason = reason ?? null;
      await manager.save(wallet); await manager.save(payment); await manager.save(WalletTransaction, manager.create(WalletTransaction, { userId: payment.userId, walletId: wallet.id, type: 'DEPOSIT', amount: payment.amount, balanceBefore: before.toFixed(8), balanceAfter: wallet.balance, currency: wallet.currency, referenceType: 'PAYMENT_REQUEST', referenceId: payment.id, description: 'شارژ کارت‌به‌کارت' }));
      return { payment, wallet: { balance: wallet.balance, currency: wallet.currency } };
    });
    const online = (await this.notifications.create(result.payment.userId, { type: 'DEPOSIT_APPROVED', title: 'شارژ حساب با موفقیت انجام شد', message: `مبلغ ${result.payment.amount} ${result.payment.currency} به کیف پول شما اضافه شد.`, data: { paymentId: result.payment.id, amount: result.payment.amount, status: result.payment.status } })).online;
    this.notifications.emit(result.payment.userId, { type: 'wallet.updated', wallet: result.wallet, payment: { id: result.payment.id, status: 'APPROVED', amount: result.payment.amount } });
    return { ...result.payment, wallet: result.wallet, online };
  }

  async rejectPayment(paymentId: string, reason: string) {
    const result = await this.dataSource.transaction(async manager => { const payment = await manager.findOne(PaymentRequest, { where: { id: paymentId }, lock: { mode: 'pessimistic_write' } }); if (!payment || payment.status !== 'PENDING') throw new BadRequestException('این درخواست در انتظار بررسی نیست یا قبلاً پردازش شده است.'); payment.status = 'REJECTED'; payment.adminReason = reason?.trim() || 'درخواست توسط ادمین رد شد.'; return manager.save(payment); });
    const online = (await this.notifications.create(result.userId, { type: 'DEPOSIT_REJECTED', title: 'درخواست شارژ تأیید نشد', message: result.adminReason ?? 'درخواست شارژ شما رد شد.', data: { paymentId: result.id, amount: result.amount, status: result.status, reason: result.adminReason } })).online;
    this.notifications.emit(result.userId, { type: 'payment.updated', payment: { id: result.id, status: 'REJECTED', amount: result.amount, reason: result.adminReason } });
    return { ...result, online };
  }

  async pendingPayments() { return this.payments.find({ where: { status: 'PENDING' }, order: { createdAt: 'ASC' }, take: 50 }); }
  async myOrders(userId: string) { return this.orders.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 50 }); }
  async myTransactions(userId: string) { return this.transactions.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 100 }); }
}
