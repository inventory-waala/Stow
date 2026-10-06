import {
  BadRequestException,
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
import { VariantsService } from './variants.service';
import {
  CreateBarcodeDto,
  CreateSizeDto,
  CreateVariantDto,
  UpdateSizeDto,
  UpdateVariantDto,
} from './dto/variant.dto';

@Controller()
export class VariantsController {
  constructor(private readonly service: VariantsService) {}

  // ── Variants ─────────────────────────────────────────────────────────────

  @Protected(Perm.read)
  @Get('products/:productId/variants')
  listForProduct(
    @Tenant() tenantId: string,
    @Param('productId') productId: string,
  ) {
    return this.service.listForProduct(tenantId, productId);
  }

  @Protected(Perm.write)
  @Post('products/:productId/variants')
  create(
    @Tenant() tenantId: string,
    @Param('productId') productId: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.service.create(tenantId, productId, dto);
  }

  @Protected(Perm.read)
  @Get('variants/:id')
  get(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.service.get(tenantId, id);
  }

  @Protected(Perm.write)
  @Patch('variants/:id')
  update(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.service.update(tenantId, id, dto);
  }

  @Protected(Perm.write)
  @Delete('variants/:id')
  remove(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.service.remove(tenantId, id);
  }

  // ── Sizes ────────────────────────────────────────────────────────────────

  @Protected(Perm.write)
  @Post('variants/:id/sizes')
  addSize(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateSizeDto,
  ) {
    return this.service.addSize(tenantId, id, dto);
  }

  // Declared before ':id' so "lookup" is never taken for a size id.
  @Protected(Perm.read)
  @Get('sizes/lookup')
  lookup(@Tenant() tenantId: string, @Query('barcode') barcode?: string) {
    if (!barcode) throw new BadRequestException('barcode is required');
    return this.service.lookupByBarcode(tenantId, barcode);
  }

  @Protected(Perm.read)
  @Get('sizes/:id')
  getSize(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.service.getSize(tenantId, id);
  }

  @Protected(Perm.write)
  @Patch('sizes/:id')
  updateSize(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSizeDto,
  ) {
    return this.service.updateSize(tenantId, id, dto);
  }

  @Protected(Perm.write)
  @Delete('sizes/:id')
  removeSize(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.service.removeSize(tenantId, id);
  }

  // ── Barcodes (printed on a size) ─────────────────────────────────────────

  @Protected(Perm.write)
  @Post('sizes/:id/barcodes')
  addBarcode(
    @Tenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: CreateBarcodeDto,
  ) {
    return this.service.addBarcode(tenantId, id, dto);
  }

  @Protected(Perm.write)
  @Delete('barcodes/:id')
  removeBarcode(@Tenant() tenantId: string, @Param('id') id: string) {
    return this.service.removeBarcode(tenantId, id);
  }
}
