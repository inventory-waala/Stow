import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Protected } from '../../auth/protected.decorator';
import { Perm } from '../../auth/decorators/permissions.decorator';
import { Tenant } from '../../auth/decorators/tenant.decorator';
import { LocationsService } from './locations.service';
import { CreateLocationDto, UpdateLocationDto } from './dto/location.dto';

@Controller('locations')
export class LocationsController {
  constructor(private readonly service: LocationsService) {}

  @Protected(Perm.read)
  @Get()
  list(@Tenant() tenantId: string) {
    return this.service.list(tenantId);
  }

  @Protected(Perm.read)
  @Get(':id')
  get(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.service.get(tenantId, id);
  }

  @Protected(Perm.admin)
  @Post()
  create(@Tenant() tenantId: string, @Body() dto: CreateLocationDto) {
    return this.service.create(tenantId, dto);
  }

  @Protected(Perm.admin)
  @Patch(':id')
  update(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.service.update(tenantId, id, dto);
  }

  @Protected(Perm.admin)
  @Delete(':id')
  remove(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.service.remove(tenantId, id);
  }
}
