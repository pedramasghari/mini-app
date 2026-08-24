import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type ServiceFaq = { question: string; answer: string };
export type GuideMediaType = 'image' | 'video';

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index({ unique: true }) @Column({ length: 80 }) slug!: string;
  @Column({ length: 120 }) title!: string;
  @Column({ length: 500 }) description!: string;
  @Column({ type: 'text', nullable: true }) serverText!: string | null;
  @Column({ type: 'text', nullable: true }) rulesText!: string | null;
  @Column({ type: 'jsonb', default: [] }) faqs!: ServiceFaq[];
  @Column({ length: 80, default: 'box' }) icon!: string;
  @Column({ default: true }) active!: boolean;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}

/** Provider routing is configured per service so each service can use a different country/price policy. */
@Entity('service_sms_configs')
@Index('uq_service_sms_config', ['serviceId'], { unique: true })
export class ServiceSmsConfig {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') serviceId!: string;
  @Column({ default: false }) enabled!: boolean;
  @Column({ type: 'int', nullable: true }) countryId!: number | null;
  @Column({ type: 'varchar', length: 8, nullable: true }) countryCode!: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) countryName!: string | null;
  @Column({ type: 'int', nullable: true }) platformId!: number | null;
  @Column({ type: 'varchar', length: 80, nullable: true }) platformCode!: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) platformName!: string | null;
  @Column({ type: 'int', nullable: true }) catalogProductId!: number | null;
  @Column({ type: 'int', nullable: true }) operatorId!: number | null;
  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true }) minProviderPrice!: string | null;
  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true }) maxProviderPrice!: string | null;
  @Column({ length: 30, default: 'cheapest' }) policy!: 'cheapest' | 'best_success';
  @Column({ type: 'varchar', length: 80, nullable: true }) preferredProvider!: string | null;
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
  @Column({ type: 'varchar', length: 1000, nullable: true }) description!: string | null;
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
  @Column({ type: 'varchar', length: 10, nullable: true }) mediaType!: GuideMediaType | null;
  @Column({ type: 'varchar', length: 1000, nullable: true }) mediaUrl!: string | null;
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

@Entity('smscode_orders')
@Index('uq_smscode_provider_order', ['providerOrderId'], { unique: true })
@Index('uq_smscode_idempotency_key', ['idempotencyKey'], { unique: true })
@Index('uq_active_sms_order_per_user', ['userId'], { unique: true, where: '\"status\" IN (\'CREATING\', \'PROVIDER_PENDING\', \'ACTIVE\', \'OTP_RECEIVED\')' })
@Index('idx_smscode_user', ['userId'])
@Index('idx_smscode_user_phone', ['userId', 'phoneNumber'])
export class SmsCodeOrder {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') userId!: string;
  @Column('uuid', { nullable: true }) serviceId!: string | null;
  @Column('uuid', { nullable: true }) productId!: string | null;
  @Column({ type: 'bigint', nullable: true }) providerOrderId!: string | null;
  @Column({ length: 30, default: 'CREATING' }) status!: string;
  @Column({ length: 128 }) idempotencyKey!: string;
  @Column({ type: 'decimal', precision: 30, scale: 8 }) chargedAmount!: string;
  @Column({ length: 10 }) currency!: string;
  @Column({ type: 'decimal', precision: 30, scale: 8, nullable: true }) providerAmount!: string | null;
  @Column({ type: 'varchar', length: 40, nullable: true }) phoneNumber!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) expiresAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) resendAvailableAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) cancelAvailableAt!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) replaceAvailableAt!: Date | null;
  @Column({ default: false }) canResend!: boolean;
  @Column({ default: false }) canCancel!: boolean;
  @Column({ default: false }) canReplace!: boolean;
  @Column({ type: 'int', default: 0 }) smsRevision!: number;
  @Column({ type: 'timestamptz', nullable: true }) refundedAt!: Date | null;
  @Column({ type: 'decimal', precision: 30, scale: 8, nullable: true }) refundedAmount!: string | null;
  @Column({ type: 'varchar', length: 80, nullable: true }) refundReason!: string | null;
  @Column({ type: 'jsonb', default: {} }) providerSnapshot!: Record<string, unknown>;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}

@Entity('smscode_webhook_events')
@Index('uq_smscode_webhook_event_key', ['eventKey'], { unique: true })
export class SmsCodeWebhookEvent {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ length: 180 }) eventKey!: string;
  @Column({ length: 80 }) event!: string;
  @Column({ type: 'bigint' }) providerOrderId!: string;
  @Column({ type: 'jsonb', default: {} }) payload!: Record<string, unknown>;
  @Column({ type: 'timestamptz', nullable: true }) processedAt!: Date | null;
  @Column({ type: 'text', nullable: true }) processingError!: string | null;
  @CreateDateColumn() createdAt!: Date;
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
@Index('uq_one_pending_deposit_per_user', ['userId'], { unique: true, where: '\"status\" = \'PENDING\'' })
export class PaymentRequest {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column('uuid') userId!: string;
  @Column({ type: 'decimal', precision: 30, scale: 8 }) amount!: string;
  @Column({ length: 10 }) currency!: string;
  @Column({ length: 30, default: 'PENDING' }) status!: string;
  @Column({ type: 'varchar', length: 1000, nullable: true }) proofUrl!: string | null;
  @Column({ type: 'text', nullable: true }) adminNote!: string | null;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
