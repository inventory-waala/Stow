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
import { CustomersService } from './customers.service';
import { Protected } from '../../auth/protected.decorator';
import { Perm } from '../../auth/decorators/permissions.decorator';
import { Tenant } from '../../auth/decorators/tenant.decorator';
import {
  CreateCustomerDto,
  ListCustomersDto,
  UpdateCustomerDto,
} from './dto/customer.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Protected(Perm.read)
  @Get()
  list(@Tenant() tenantId: string, @Query() query: ListCustomersDto) {
    return this.customers.list(tenantId, query);
  }

  @Protected(Perm.read)
  @Get(':id')
  get(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.customers.get(tenantId, id);
  }

  @Protected(Perm.write)
  @Post()
  create(@Tenant() tenantId: string, @Body() dto: CreateCustomerDto) {
    return this.customers.create(tenantId, dto);
  }

  @Protected(Perm.write)
  @Patch(':id')
  update(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customers.update(tenantId, id, dto);
  }

  @Protected(Perm.admin)
  @Delete(':id')
  remove(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.customers.remove(tenantId, id);
  }
}
