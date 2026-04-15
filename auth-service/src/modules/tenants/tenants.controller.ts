import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { TenantsService } from './tenants.service';
import { CreateTenantRequestDto } from './dto/tenants.controller.dto';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: CreateTenantRequestDto) {
    return this.tenantsService.create(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async myTenants(@Request() req: any) {
    return this.tenantsService.findUserTenants(req.user.id);
  }
}
