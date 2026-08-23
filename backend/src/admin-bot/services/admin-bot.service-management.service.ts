import { Injectable } from '@nestjs/common';
import { CommerceService } from '../../commerce/commerce.service';

@Injectable()
export class AdminBotServiceManagementService {
  constructor(private readonly commerce: CommerceService) {}

  list(includeInactive = true) { return this.commerce.listServices(includeInactive); }
  get(id: string) { return this.commerce.getService(id); }
  create(input: Parameters<CommerceService['createService']>[0]) { return this.commerce.createService(input); }
  update(id: string, patch: Parameters<CommerceService['updateService']>[1]) { return this.commerce.updateService(id, patch); }
  remove(id: string) { return this.commerce.deleteService(id); }
}
