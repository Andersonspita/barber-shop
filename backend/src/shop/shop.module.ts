import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ShopSettingsService } from './shop-settings.service';
import { ShopController } from './shop.controller';

/**
 * Global porque praticamente todo módulo de agenda precisa do fuso e das
 * regras de antecedência da barbearia.
 */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [ShopController],
  providers: [ShopSettingsService],
  exports: [ShopSettingsService],
})
export class ShopModule {}
