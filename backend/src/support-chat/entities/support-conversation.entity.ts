import { Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { SupportMessage } from './support-message.entity';

@Entity('support_conversations')
@Index('uq_support_conversation_user', ['userId'], { unique: true })
export class SupportConversation {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column('uuid') userId!: string;

  @Column({ type: 'timestamp', nullable: true }) lastMessageAt!: Date | null;

  @Column({ type: 'int', default: 0 }) userUnreadCount!: number;

  @Column({ type: 'int', default: 0 }) adminUnreadCount!: number;

  @Column({ type: 'text', nullable: true }) lastMessagePreview!: string | null;

  @OneToMany(() => SupportMessage, (message) => message.conversation)
  messages!: SupportMessage[];

  @CreateDateColumn() createdAt!: Date;
  @UpdateDateColumn() updatedAt!: Date;
}
