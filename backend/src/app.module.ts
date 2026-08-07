import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AuthModule } from './auth/auth.module';
import { NotificationsModule } from './notifications/notifications.module';
import { BullModule } from '@nestjs/bullmq';
import { ServicesModule } from './services/services.module';
import { AdminClientsModule } from './admin-clients/admin-clients.module';
import { AdminBarbersModule } from './admin-barbers/admin-barbers.module';
import { ScheduleBlocksModule } from './schedule-blocks/schedule-blocks.module';

@Module({
  imports: [
    PrismaModule, 
    AppointmentsModule, 
    AuthModule, 
    NotificationsModule,
    ServicesModule,
    AdminClientsModule,
    AdminBarbersModule,
    ScheduleBlocksModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
      },
    })
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
