import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column('uuid') userId!: string;
  @Column({ length: 40 }) type!: string;
  @Column({ length: 160 }) title!: string;
  @Column({ type: 'text' }) message!: string;
  @Column({ type: 'jsonb', default: {} }) data!: Record<string, unknown>;
  @Index() @Column({ default: false }) read!: boolean;
  @CreateDateColumn() createdAt!: Date;
}
