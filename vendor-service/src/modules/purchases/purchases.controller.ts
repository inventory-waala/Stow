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
import { PurchasesService } from './purchases.service';
import { Protected } from '../../auth/protected.decorator';
import { Perm } from '../../auth/decorators/permissions.decorator';
import { CurrentUser, Tenant } from '../../auth/decorators/tenant.decorator';
import { AccessToken } from '../../auth/decorators/access-token.decorator';
import { AuthUser } from '../../auth/auth-user';
import {
  CreatePurchaseDto,
  ListPurchasesDto,
  ReceivePurchaseDto,
  UpdatePurchaseDto,
  UpdateStatusDto,
} from './dto/purchase.dto';

@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Protected(Perm.read)
  @Get()
  list(@Tenant() tenantId: string, @Query() query: ListPurchasesDto) {
    return this.purchases.list(tenantId, query);
  }

  @Protected(Perm.read)
  @Get(':id')
  get(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.purchases.get(tenantId, id);
  }

  @Protected(Perm.write)
  @Post()
  create(
    @Tenant() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePurchaseDto,
    @AccessToken() token: string,
  ) {
    return this.purchases.create(tenantId, user?.id, dto, token);
  }

  @Protected(Perm.write)
  @Patch(':id')
  update(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseDto,
    @AccessToken() token: string,
  ) {
    return this.purchases.update(tenantId, id, dto, token);
  }

  @Protected(Perm.write)
  @Patch(':id/status')
  setStatus(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.purchases.setStatus(tenantId, id, dto.status);
  }

  /** Posts the stock and marks the order received. */
  @Protected(Perm.receive)
  @Post(':id/receive')
  receive(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: ReceivePurchaseDto,
    @AccessToken() token: string,
  ) {
    return this.purchases.receive(tenantId, id, dto, token);
  }

  @Protected(Perm.admin)
  @Delete(':id')
  remove(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.purchases.remove(tenantId, id);
  }
}
