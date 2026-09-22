import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlatformController } from './platform.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PlatformController],
})
export class PlatformModule {}
