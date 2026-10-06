import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { Protected } from '../../auth/protected.decorator';
import { Perm } from '../../auth/decorators/permissions.decorator';
import { CurrentUser, Tenant } from '../../auth/decorators/tenant.decorator';
import { AuthUser } from '../../auth/auth-user';
import { StockService } from './stock.service';
import {
  CreateMovementDto,
  ListMovementsDto,
  ListStockDto,
  ReservationDto,
  SetReorderDto,
} from './dto/stock.dto';

@Controller()
export class StockController {
  constructor(private readonly service: StockService) {}

  @Protected(Perm.read)
  @Get('stock')
  list(@Tenant() tenantId: string, @Query() query: ListStockDto) {
    return this.service.list(tenantId, query);
  }

  @Protected(Perm.read)
  @Get('sizes/:id/stock')
  forSize(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.service.forSize(tenantId, id);
  }

  @Protected(Perm.read)
  @Get('stock/movements')
  movements(@Tenant() tenantId: string, @Query() query: ListMovementsDto) {
    return this.service.movements(tenantId, query);
  }

  @Protected(Perm.adjust)
  @Post('stock/movements')
  move(
    @Tenant() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateMovementDto,
  ) {
    return this.service.move(tenantId, user, dto);
  }

  @Protected(Perm.write)
  @Post('stock/reserve')
  reserve(@Tenant() tenantId: string, @Body() dto: ReservationDto) {
    return this.service.reserve(tenantId, dto);
  }

  @Protected(Perm.write)
  @Post('stock/release')
  release(@Tenant() tenantId: string, @Body() dto: ReservationDto) {
    return this.service.release(tenantId, dto);
  }

  @Protected(Perm.write)
  @Put('stock/reorder')
  setReorder(@Tenant() tenantId: string, @Body() dto: SetReorderDto) {
    return this.service.setReorder(tenantId, dto);
  }
}
