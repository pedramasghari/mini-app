import { Injectable } from '@nestjs/common';
import { ConversationState } from '../admin-bot.types';

@Injectable()
export class AdminBotConversationService {
  private readonly states = new Map<number, ConversationState>();

  get(adminId: number) { return this.states.get(adminId); }
  set(state: ConversationState) { this.states.set(state.adminId, state); }
  delete(adminId: number) { this.states.delete(adminId); }
  clear(adminId: number) { this.states.delete(adminId); }
  isActive(adminId: number) { return this.states.has(adminId); }
}
