import { Module } from '@nestjs/common';
import { AdminClientsController } from './admin-clients.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdminClientsController],
})
export class AdminClientsModule {}
