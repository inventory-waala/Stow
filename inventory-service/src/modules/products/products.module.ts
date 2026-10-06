import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductSchemaService } from './product-schema.service';
import { JsonSchemaValidator } from '../../common/json-schema.validator';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, ProductSchemaService, JsonSchemaValidator],
  exports: [ProductsService, ProductSchemaService],
})
export class ProductsModule {}
