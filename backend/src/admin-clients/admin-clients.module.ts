import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminClientsController } from './admin-clients.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AdminClientsController],
})
export class AdminClientsModule {}
