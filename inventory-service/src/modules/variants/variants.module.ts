import { Module } from '@nestjs/common';
import { VariantsController } from './variants.controller';
import { VariantsService } from './variants.service';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [ProductsModule],
  controllers: [VariantsController],
  providers: [VariantsService],
})
export class VariantsModule {}
