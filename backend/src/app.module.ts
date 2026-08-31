import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ShopModule } from './shop/shop.module';
import { AvailabilityModule } from './availability/availability.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AuthModule } from './auth/auth.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ServicesModule } from './services/services.module';
import { AdminClientsModule } from './admin-clients/admin-clients.module';
import { AdminBarbersModule } from './admin-barbers/admin-barbers.module';
import { ScheduleBlocksModule } from './schedule-blocks/schedule-blocks.module';
import { PublicCatalogModule } from './public-catalog/public-catalog.module';
import { WaitlistModule } from './waitlist/waitlist.module';

@Module({
  imports: [
    PrismaModule,
    ShopModule,
    AvailabilityModule,
    AppointmentsModule,
    AuthModule,
    NotificationsModule,
    ServicesModule,
    AdminClientsModule,
    AdminBarbersModule,
    ScheduleBlocksModule,
    PublicCatalogModule,
    WaitlistModule,
    // Teto geral de requisições; o login tem um limite bem mais estreito,
    // declarado na própria rota.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
