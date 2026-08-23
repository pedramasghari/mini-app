import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @OneToOne(() => User)
  @JoinColumn()
  user!: User;

  @Column({ type: 'uuid', unique: true })
  userId!: string;

  @Column({ type: 'decimal', precision: 30, scale: 8, default: 0 })
  balance!: string;

  @Column({ type: 'varchar', length: 10, default: 'IRT' })
  currency!: string;

  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
