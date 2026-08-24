import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SupportConversation } from './support-conversation.entity';

export type SupportSenderRole = 'USER' | 'ADMIN';
export type SupportMessageStatus = 'SENT' | 'DELIVERED' | 'READ';

@Entity('support_messages')
@Index('idx_support_messages_conversation_created', ['conversationId', 'createdAt'])
export class SupportMessage {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Column('uuid') conversationId!: string;
  @ManyToOne(() => SupportConversation, (conversation) => conversation.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' }) conversation!: SupportConversation;

  @Column('uuid') senderId!: string;
  @Column({ type: 'varchar', length: 10 }) senderRole!: SupportSenderRole;
  @Column({ type: 'text', default: '' }) body!: string;
  @Column({ type: 'uuid', nullable: true }) replyToMessageId!: string | null;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) attachments!: Array<{ type: 'IMAGE' | 'VIDEO'; url: string; name?: string | null; size?: number | null }>;
  @Column({ type: 'varchar', length: 12, default: 'SENT' }) status!: SupportMessageStatus;
  @Column({ type: 'timestamp', nullable: true }) deliveredAt!: Date | null;
  @Column({ type: 'timestamp', nullable: true }) readAt!: Date | null;

  @CreateDateColumn() createdAt!: Date;
}
