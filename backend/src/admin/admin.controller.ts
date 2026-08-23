import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import type { Request } from 'express';
import { CommerceService, CreateServiceInput } from '../commerce/commerce.service';
import type { ServiceMedia, ServiceFaq } from '../commerce/entities/commerce.entity';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly commerce: CommerceService) {}

  @Get('access')
  access(@Req() request: Request & { adminSession?: { user: unknown } }) {
    return { allowed: true, user: request.adminSession?.user ?? null };
  }

  @Get('services')
  services() {
    return this.commerce.listServices(true);
  }

  @Get('services/:id')
  service(@Param('id') id: string) {
    return this.commerce.getService(id);
  }

  @Post('services')
  createService(@Body() body: CreateServiceInput) {
    return this.commerce.createService({
      slug: body.slug,
      title: body.title,
      description: body.description,
      icon: body.icon,
      serverText: body.serverText,
      rulesText: body.rulesText,
      media: Array.isArray(body.media) ? body.media as ServiceMedia[] : [],
      faqs: Array.isArray(body.faqs) ? body.faqs as ServiceFaq[] : [],
    });
  }

  @Patch('services/:id')
  updateService(@Param('id') id: string, @Body() body: Partial<CreateServiceInput> & { active?: boolean }) {
    return this.commerce.updateService(id, body);
  }

  @Delete('services/:id')
  deleteService(@Param('id') id: string) {
    return this.commerce.deleteService(id);
  }
}
