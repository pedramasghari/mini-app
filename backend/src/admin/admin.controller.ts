import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import type { Request } from 'express';
import { Req } from '@nestjs/common';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  @Get('access')
  access(@Req() request: Request & { adminSession?: { user: unknown } }) {
    return {
      allowed: true,
      user: request.adminSession?.user ?? null,
    };
  }
}
