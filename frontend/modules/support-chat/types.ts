export type SupportAttachment = { type: 'IMAGE' | 'VIDEO'; url: string; name?: string | null; size?: number | null };
export type SupportMessage = { id: string; conversationId: string; senderId: string; senderRole: 'USER' | 'ADMIN'; body: string; replyToMessageId: string | null; attachments: SupportAttachment[]; status: 'SENT' | 'DELIVERED' | 'READ'; deliveredAt: string | null; readAt: string | null; createdAt: string };
export type SupportConversation = { id: string; userId: string; lastMessageAt: string | null; userUnreadCount: number; adminUnreadCount: number; lastMessagePreview: string | null; createdAt: string; updatedAt: string };
export type SupportMeResponse = { conversation: SupportConversation; messages: SupportMessage[] };
export type SupportAdminConversation = SupportConversation & { user: { id: string; username: string | null; firstName: string | null; lastName: string | null; photoUrl: string | null; telegramId: string } | null };
