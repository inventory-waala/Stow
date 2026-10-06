import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { Protected } from '../../auth/protected.decorator';
import { Perm } from '../../auth/decorators/permissions.decorator';
import { Tenant } from '../../auth/decorators/tenant.decorator';
import {
  CreateSupplierDto,
  ListSuppliersDto,
  UpdateSupplierDto,
} from './dto/supplier.dto';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Protected(Perm.read)
  @Get()
  list(@Tenant() tenantId: string, @Query() query: ListSuppliersDto) {
    return this.suppliers.list(tenantId, query);
  }

  @Protected(Perm.read)
  @Get(':id')
  get(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.suppliers.get(tenantId, id);
  }

  @Protected(Perm.write)
  @Post()
  create(@Tenant() tenantId: string, @Body() dto: CreateSupplierDto) {
    return this.suppliers.create(tenantId, dto);
  }

  @Protected(Perm.write)
  @Patch(':id')
  update(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliers.update(tenantId, id, dto);
  }

  @Protected(Perm.admin)
  @Delete(':id')
  remove(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.suppliers.remove(tenantId, id);
  }
}
