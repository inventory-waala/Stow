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
import { Protected } from '../../auth/protected.decorator';
import { Perm } from '../../auth/decorators/permissions.decorator';
import { Tenant } from '../../auth/decorators/tenant.decorator';
import { ProductsService } from './products.service';
import {
  CreateProductDto,
  ListProductsDto,
  UpdateProductDto,
} from './dto/product.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Protected(Perm.read)
  @Get()
  list(@Tenant() tenantId: string, @Query() query: ListProductsDto) {
    return this.service.list(tenantId, query);
  }

  @Protected(Perm.read)
  @Get(':id')
  get(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.service.get(tenantId, id);
  }

  @Protected(Perm.write)
  @Post()
  create(@Tenant() tenantId: string, @Body() dto: CreateProductDto) {
    return this.service.create(tenantId, dto);
  }

  @Protected(Perm.write)
  @Patch(':id')
  update(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.service.update(tenantId, id, dto);
  }

  @Protected(Perm.write)
  @Delete(':id')
  remove(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.service.remove(tenantId, id);
  }
}
