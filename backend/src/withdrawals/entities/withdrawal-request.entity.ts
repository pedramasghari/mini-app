import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('withdrawal_requests')
@Index('idx_withdrawal_user_created', ['userId', 'createdAt'])
@Index('idx_withdrawal_status_created', ['status', 'createdAt'])
export class WithdrawalRequest {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Index()
  @Column('uuid') userId!: string;

  @Column({ type: 'varchar', length: 34 }) cardNumber!: string;

  @Column({ type: 'varchar', length: 160 }) cardHolderName!: string;

  @Column({ type: 'decimal', precision: 30, scale: 8 }) amount!: string;

  @Column({ type: 'varchar', length: 10, default: 'IRT' }) currency!: string;

  @Column({ type: 'varchar', length: 24, default: 'PENDING' }) status!: 'PENDING' | 'COMPLETED' | 'CANCELLED';

  @Column({ type: 'text', nullable: true }) receiptPath!: string | null;

  @Column({ type: 'text', nullable: true }) adminReason!: string | null;

  @Column({ type: 'timestamptz', nullable: true }) completedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true }) cancelledAt!: Date | null;

  @Column({ type: 'uuid', nullable: true }) completedBy!: string | null;

  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
