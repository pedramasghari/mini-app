import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import type { Request } from 'express';
import { CommerceService } from '../commerce/commerce.service';
import type { CreateProductInput, CreateServiceInput, GuideInput } from '../commerce/commerce.service';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly commerce: CommerceService) {}

  @Get('access')
  access(@Req() request: Request & { adminSession?: { user: unknown } }) { return { allowed: true, user: request.adminSession?.user ?? null }; }
  @Get('services') services() { return this.commerce.listServices(true); }
  @Get('services/:id') service(@Param('id') id: string) { return this.commerce.getService(id); }
  @Post('services') createService(@Body() body: CreateServiceInput) { return this.commerce.createService(body); }
  @Patch('services/:id') updateService(@Param('id') id: string, @Body() body: Partial<CreateServiceInput> & { active?: boolean }) { return this.commerce.updateService(id, body); }
  @Delete('services/:id') deleteService(@Param('id') id: string) { return this.commerce.deleteService(id); }

  @Get('services/:serviceId/products') products(@Param('serviceId') serviceId: string) { return this.commerce.listProducts(serviceId, true); }
  @Get('products/:id') product(@Param('id') id: string) { return this.commerce.getProduct(id); }
  @Post('products') createProduct(@Body() body: CreateProductInput) { return this.commerce.createProduct(body); }
  @Patch('products/:id') updateProduct(@Param('id') id: string, @Body() body: Partial<Omit<CreateProductInput, 'serviceId'>> & { active?: boolean }) { return this.commerce.updateProduct(id, body); }
  @Delete('products/:id') deleteProduct(@Param('id') id: string) { return this.commerce.deleteProduct(id); }

  @Get('products/:productId/guide') guide(@Param('productId') productId: string) { return this.commerce.getGuide(productId); }
  @Put('products/:productId/guide') saveGuide(@Param('productId') productId: string, @Body() body: GuideInput) { return this.commerce.saveGuide(productId, body); }
  @Delete('products/:productId/guide') deleteGuide(@Param('productId') productId: string) { return this.commerce.deleteGuide(productId); }
}
