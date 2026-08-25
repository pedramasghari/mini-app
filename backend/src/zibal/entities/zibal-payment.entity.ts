import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('zibal_payments')
@Index('uq_zibal_track_id', ['trackId'], { unique: true })
@Index('uq_zibal_order_id', ['orderId'], { unique: true })
@Index('idx_zibal_pending_created', ['status', 'createdAt'])
@Index('idx_zibal_pending_expires', ['status', 'expiresAt'])
export class ZibalPayment {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column('uuid') userId!: string;
  @Column('uuid') orderId!: string;
  @Column({ type: 'decimal', precision: 30, scale: 8 }) amount!: string;
  @Column({ type: 'bigint' }) gatewayAmount!: string;
  @Column({ length: 10, default: 'IRT' }) currency!: string;
  @Column({ type: 'bigint', nullable: true }) trackId!: string | null;
  @Column({ length: 30, default: 'PENDING' }) status!: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';
  @Column({ type: 'varchar', length: 80, nullable: true }) gatewayResult!: string | null;
  @Column({ type: 'varchar', length: 160, nullable: true }) gatewayMessage!: string | null;
  @Column({ type: 'varchar', length: 80, nullable: true }) refNumber!: string | null;
  @Column({ type: 'varchar', length: 80, nullable: true }) cardNumber!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) paidAt!: Date | null;
  @Column({ type: 'jsonb', default: {} }) gatewaySnapshot!: Record<string, unknown>;
  @Column({ type: 'text', nullable: true }) failureReason!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) expiresAt!: Date | null;
  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
