import { Module } from '@nestjs/common';
import { ServicesController } from './services.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ServicesController],
})
export class ServicesModule {}
