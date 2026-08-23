import { Injectable } from '@nestjs/common';
import { CommerceService } from '../../commerce/commerce.service';

@Injectable()
export class AdminBotFinanceService {
  constructor(private readonly commerce: CommerceService) {}

  async pending() { return this.commerce.listPendingPayments(); }
  async approve(paymentId: string) { return this.commerce.approvePayment(paymentId, 'تأیید توسط ادمین'); }
  async reject(paymentId: string, reason: string) { return this.commerce.rejectPayment(paymentId, reason); }
}
