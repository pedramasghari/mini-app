import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index({ unique: true }) @Column({ length: 80 }) slug!: string;
  @Column({ length: 120 }) title!: string;
  @Column({ length: 500 }) description!: string;
  @Column({ length: 80, default: 'box' }) icon!: string;
  @Column({ default: true }) active!: boolean;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column('uuid') serviceId!: string;
  @Column({ length: 120 }) title!: string;
  @Column({ length: 500 }) description!: string;
  @Column({ type: 'decimal', precision: 30, scale: 8 }) price!: string;
  @Column({ length: 10, default: 'IRT' }) currency!: string;
  @Column({ length: 80, default: 'box' }) icon!: string;
  @Column({ default: true }) active!: boolean;
  @Column({ default: true }) requiresGuide!: boolean;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
@Entity('activation_guides')
export class ActivationGuide {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index({ unique: true }) @Column('uuid') productId!: string;
  @Column({ length: 160 }) title!: string;
  @Column({ type: 'varchar', length: 500, nullable: true }) description!: string | null;
  @Column({ default: true }) active!: boolean;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
@Entity('activation_steps')
export class ActivationStep {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column('uuid') guideId!: string;
  @Column('int') position!: number;
  @Column({ length: 160 }) title!: string;
  @Column({ type: 'text' }) content!: string;
  @Column({ type: 'varchar', length: 500, nullable: true }) imageUrl!: string | null;
  @Column({ default: false }) requiresInput!: boolean;
  @Column({ type: 'varchar', length: 80, nullable: true }) inputKey!: string | null;
  @Column({ type: 'varchar', length: 160, nullable: true }) inputLabel!: string | null;
}
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column('uuid') userId!: string;
  @Index() @Column('uuid') productId!: string;
  @Column({ length: 30, default: 'PENDING_PAYMENT' }) status!: string;
  @Column({ type: 'decimal', precision: 30, scale: 8 }) amount!: string;
  @Column({ length: 10, default: 'IRT' }) currency!: string;
  @Column({ type: 'jsonb', default: {} }) metadata!: Record<string, unknown>;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
@Entity('order_inputs')
export class OrderInput {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column('uuid') orderId!: string;
  @Column({ length: 80 }) key!: string;
  @Column({ type: 'text' }) value!: string;
  @CreateDateColumn() createdAt!: Date;
}
@Entity('activation_progress')
export class ActivationProgress {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index({ unique: true }) @Column('uuid') orderId!: string;
  @Index() @Column('uuid') userId!: string;
  @Column('uuid') guideId!: string;
  @Column('int', { default: 0 }) currentStep!: number;
  @Column({ default: false }) completed!: boolean;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
@Entity('payment_methods')
export class PaymentMethod {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ length: 40, default: 'CARD_TRANSFER' }) type!: string;
  @Column({ length: 120 }) title!: string;
  @Column({ type: 'varchar', length: 120 }) cardNumber!: string;
  @Column({ length: 160 }) holderName!: string;
  @Column({ type: 'varchar', length: 120, nullable: true }) bankName!: string | null;
  @Column({ default: true }) active!: boolean;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
@Entity('payment_requests')
@Index('uq_one_pending_deposit_per_user', ['userId'], { unique: true, where: '"status" = \'PENDING\'' })
export class PaymentRequest {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column('uuid') userId!: string;
  @Column('uuid', { nullable: true }) orderId!: string | null;
  @Column('uuid') paymentMethodId!: string;
  @Column({ type: 'decimal', precision: 30, scale: 8 }) amount!: string;
  @Column({ length: 10, default: 'IRT' }) currency!: string;
  @Column({ length: 30, default: 'PENDING' }) status!: string;
  @Column({ type: 'text', nullable: true }) receiptPath!: string | null;
  @Column({ type: 'text', nullable: true }) adminReason!: string | null;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
@Entity('wallet_transactions')
export class WalletTransaction {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column('uuid') userId!: string;
  @Index() @Column('uuid') walletId!: string;
  @Column({ length: 40 }) type!: string;
  @Column({ type: 'decimal', precision: 30, scale: 8 }) amount!: string;
  @Column({ type: 'decimal', precision: 30, scale: 8 }) balanceBefore!: string;
  @Column({ type: 'decimal', precision: 30, scale: 8 }) balanceAfter!: string;
  @Column({ length: 10, default: 'IRT' }) currency!: string;
  @Column({ type: 'varchar', length: 120, nullable: true }) referenceType!: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) referenceId!: string | null;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @CreateDateColumn() createdAt!: Date;
}
