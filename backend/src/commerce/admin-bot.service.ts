import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { readFile } from 'node:fs/promises';
import { User } from '../users/entities/user.entity';
import { CommerceService } from './commerce.service';
import { PaymentMethod } from './entities/commerce.entity';

@Injectable()
export class AdminBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdminBotService.name);
  private offset = 0; private timer?: NodeJS.Timeout;
  private readonly states = new Map<number, { action: string; values: string[]; paymentId?: string }>();
  private readonly notified = new Set<string>();
  constructor(private config: ConfigService, private commerce: CommerceService, @InjectRepository(PaymentMethod) private methods: Repository<PaymentMethod>, @InjectRepository(User) private users: Repository<User>) {}
  onModuleInit() { if (this.config.get('ADMIN_BOT_TOKEN')) this.poll(); }
  onModuleDestroy() { if (this.timer) clearTimeout(this.timer); }
  private admins() { return String(this.config.get('ADMIN_TELEGRAM_IDS') ?? '').split(',').map(v => v.trim()).filter(Boolean); }
  private allowed(id: number) { return this.admins().includes(String(id)); }
  private api(method: string, body: Record<string, unknown>) { const token = this.config.get<string>('ADMIN_BOT_TOKEN'); return fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json() as Promise<any>); }

  private async poll() {
    try {
      const token = this.config.get<string>('ADMIN_BOT_TOKEN'); if (!token) return;
      const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?timeout=20&offset=${this.offset}`); const json = await response.json() as any;
      for (const update of json.result ?? []) { this.offset = update.update_id + 1; await this.handle(update); }
      await this.notifyNewPayments();
    } catch (error) { this.logger.warn(`Bot polling failed: ${String(error)}`); }
    this.timer = setTimeout(() => this.poll(), 1000);
  }

  private async notifyNewPayments() {
    const rows = await this.commerce.pendingPayments();
    for (const p of rows) {
      if (this.notified.has(p.id)) continue;
      this.notified.add(p.id);
      const user = await this.users.findOne({ where: { id: p.userId } });
      for (const admin of this.admins()) {
        const chatId = Number(admin);
        if (!Number.isSafeInteger(chatId)) continue;
        await this.send(chatId, `🔔 New payment request\n\nID: ${p.id}\nUser: ${user?.username ? '@' + user.username : user?.telegramId}\nAmount: ${p.amount} ${p.currency}`, { inline_keyboard: [[{ text: '✅ Approve', callback_data: `approve:${p.id}` }, { text: '❌ Reject', callback_data: `reject:${p.id}` }]] });
        if (p.receiptPath) await this.sendFile(chatId, p.receiptPath, `Receipt ${p.id}`);
      }
    }
  }

  private async handle(update: any) {
    if (update.callback_query) return this.callback(update.callback_query);
    const message = update.message; if (!message?.from || !this.allowed(message.from.id)) return;
    const text = String(message.text ?? '').trim(); const state = this.states.get(message.from.id);
    if (state) return this.stateMessage(message.chat.id, message.from.id, text, state);
    if (text === '/start' || text === '/help') return this.send(message.chat.id, 'Admin Bot\n\n/payments — pending payments\n/cards — active cards\n/addcard — add card');
    if (text === '/payments') return this.sendPending(message.chat.id);
    if (text === '/cards') return this.sendCards(message.chat.id);
    if (text === '/addcard') { this.states.set(message.from.id, { action: 'addcard', values: [] }); return this.send(message.chat.id, 'Card number:'); }
  }

  private async stateMessage(chatId: number, adminId: number, text: string, state: { action: string; values: string[]; paymentId?: string }) {
    if (state.action === 'reject') { this.states.delete(adminId); await this.commerce.rejectPayment(state.paymentId!, text); return this.send(chatId, 'Payment rejected.'); }
    if (state.action === 'addcard') { state.values.push(text); if (state.values.length === 1) return this.send(chatId, 'Card holder name:'); if (state.values.length === 2) return this.send(chatId, 'Bank name (or -):'); this.states.delete(adminId); const [cardNumber, holderName, bank] = state.values; await this.methods.save(this.methods.create({ type: 'CARD_TRANSFER', title: `${bank === '-' ? '' : bank + ' '}Card`, cardNumber, holderName, bankName: bank === '-' ? null : bank, active: true })); return this.send(chatId, `Card added.\n${cardNumber.slice(0, 4)} **** **** ${cardNumber.slice(-4)}`); }
  }

  private async callback(query: any) {
    const adminId = query.from?.id; if (!adminId || !this.allowed(adminId)) return;
    await this.api('answerCallbackQuery', { callback_query_id: query.id }); const data = String(query.data ?? '');
    if (data.startsWith('approve:')) { const id = data.slice(8); await this.commerce.approvePayment(id, 'Approved by admin'); this.notified.delete(id); return this.send(query.message.chat.id, `Payment ${id} approved.`); }
    if (data.startsWith('reject:')) { const id = data.slice(7); this.states.set(adminId, { action: 'reject', values: [], paymentId: id }); return this.send(query.message.chat.id, 'Send rejection reason:'); }
  }

  private async sendPending(chatId: number) { const rows = await this.commerce.pendingPayments(); if (!rows.length) return this.send(chatId, 'No pending payments.'); for (const p of rows) { const user = await this.users.findOne({ where: { id: p.userId } }); await this.send(chatId, `Payment\nID: ${p.id}\nUser: ${user?.username ? '@' + user.username : user?.telegramId}\nAmount: ${p.amount} ${p.currency}\nStatus: ${p.status}`, { inline_keyboard: [[{ text: '✅ Approve', callback_data: `approve:${p.id}` }, { text: '❌ Reject', callback_data: `reject:${p.id}` }]] }); if (p.receiptPath) await this.sendFile(chatId, p.receiptPath, `Receipt ${p.id}`); } }
  private async sendCards(chatId: number) { const cards = await this.methods.find({ where: { active: true }, order: { createdAt: 'DESC' } }); if (!cards.length) return this.send(chatId, 'No active cards.'); return this.send(chatId, cards.map(c => `• ${c.bankName ?? ''} ${c.cardNumber.slice(0, 4)} **** **** ${c.cardNumber.slice(-4)} — ${c.holderName}`).join('\n')); }
  private async send(chatId: number, text: string, inline_keyboard?: any[][]) { return this.api('sendMessage', { chat_id: chatId, text, ...(inline_keyboard ? { reply_markup: { inline_keyboard } } : {}) }); }
  private async sendFile(chatId: number, path: string, caption: string) { const token = this.config.get<string>('ADMIN_BOT_TOKEN'); const bytes = await readFile(path); const form = new FormData(); form.append('chat_id', String(chatId)); form.append('caption', caption); form.append('document', new Blob([bytes]), path.split(/[\\/]/).pop() ?? 'receipt'); await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: 'POST', body: form }); }
}
