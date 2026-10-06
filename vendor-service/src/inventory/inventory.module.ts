import { Global, Module } from '@nestjs/common';
import { InventoryClient } from './inventory.client';

@Global()
@Module({
  providers: [InventoryClient],
  exports: [InventoryClient],
})
export class InventoryModule {}
