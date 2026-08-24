import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type NumberOrderStatus = 'IN_PROCESS' | 'VERIFY' | 'SUCCESS' | 'EXPIRED' | 'CANCEL';

export type NumberOrderOtp = {
  code: string | null;
  message: string | null;
  revision: number;
  receivedAt: string;
};

@Entity('number_orders')
@Index('uq_number_order_number', ['orderNumber'], { unique: true })
@Index('uq_number_order_sms_order', ['smsCodeOrderId'], { unique: true })
@Index('idx_number_orders_user_created', ['userId', 'createdAt'])
@Index('idx_number_orders_user_status', ['userId', 'status'])
export class NumberOrder {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column({ length: 24 }) orderNumber!: string;

  @Column('uuid') userId!: string;
  @Column('uuid') smsCodeOrderId!: string;
  @Column('uuid') serviceId!: string;
  @Column('uuid') productId!: string;

  @Column({ length: 30 }) status!: NumberOrderStatus;
  @Column({ type: 'varchar', length: 40, nullable: true }) phoneNumber!: string | null;
  @Column({ type: 'decimal', precision: 30, scale: 8 }) amount!: string;
  @Column({ length: 10 }) currency!: string;

  @Column({ type: 'jsonb', default: {} }) metadata!: {
    otpCodes?: NumberOrderOtp[];
    providerOrderId?: string | null;
    expiresAt?: string | null;
    lastOtpCode?: string | null;
    lastOtpMessage?: string | null;
    smsRevision?: number;
  };

  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
