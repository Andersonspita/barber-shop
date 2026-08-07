import { Module } from '@nestjs/common';
import { AdminBarbersController } from './admin-barbers.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdminBarbersController],
})
export class AdminBarbersModule {}
