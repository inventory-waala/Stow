import { Module } from '@nestjs/common';
import { VariantTypesController } from './variant-types.controller';
import { VariantTypesService } from './variant-types.service';
import { JsonSchemaValidator } from '../../common/json-schema.validator';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [ProductsModule],
  controllers: [VariantTypesController],
  providers: [VariantTypesService, JsonSchemaValidator],
  exports: [VariantTypesService],
})
export class VariantTypesModule {}
