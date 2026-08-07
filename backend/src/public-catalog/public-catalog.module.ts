import { Module } from '@nestjs/common';
import { PublicCatalogController } from './public-catalog.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PublicCatalogController],
})
export class PublicCatalogModule {}
