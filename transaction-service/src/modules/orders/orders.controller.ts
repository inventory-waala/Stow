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
import { OrdersService } from './orders.service';
import { Protected } from '../../auth/protected.decorator';
import { Perm } from '../../auth/decorators/permissions.decorator';
import { CurrentUser, Tenant } from '../../auth/decorators/tenant.decorator';
import { AccessToken } from '../../auth/decorators/access-token.decorator';
import { AuthUser } from '../../auth/auth-user';
import {
  CreateOrderDto,
  FulfilOrderDto,
  ListOrdersDto,
  UpdateOrderDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Protected(Perm.read)
  @Get()
  list(@Tenant() tenantId: string, @Query() query: ListOrdersDto) {
    return this.orders.list(tenantId, query);
  }

  @Protected(Perm.read)
  @Get(':id')
  get(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.orders.get(tenantId, id);
  }

  @Protected(Perm.write)
  @Post()
  create(
    @Tenant() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOrderDto,
    @AccessToken() token: string,
  ) {
    return this.orders.create(tenantId, user?.id, dto, token);
  }

  @Protected(Perm.write)
  @Patch(':id')
  update(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
    @AccessToken() token: string,
  ) {
    return this.orders.update(tenantId, id, dto, token);
  }

  @Protected(Perm.write)
  @Patch(':id/status')
  setStatus(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orders.setStatus(tenantId, id, dto.status);
  }

  /** Reserves stock against the order without shipping it. */
  @Protected(Perm.fulfil)
  @Post(':id/confirm')
  confirm(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @AccessToken() token: string,
  ) {
    return this.orders.confirm(tenantId, id, token);
  }

  /** Releases the reservation and posts the stock out. */
  @Protected(Perm.fulfil)
  @Post(':id/fulfil')
  fulfil(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: FulfilOrderDto,
    @AccessToken() token: string,
  ) {
    return this.orders.fulfil(tenantId, id, dto, token);
  }

  /** Cancels the order, releasing any stock it holds. */
  @Protected(Perm.cancel)
  @Post(':id/cancel')
  cancel(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @AccessToken() token: string,
  ) {
    return this.orders.cancel(tenantId, id, token);
  }

  @Protected(Perm.admin)
  @Delete(':id')
  remove(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.orders.remove(tenantId, id);
  }
}
