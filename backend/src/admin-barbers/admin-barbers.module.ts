import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminBarbersController } from './admin-barbers.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AdminBarbersController],
})
export class AdminBarbersModule {}
