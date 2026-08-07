"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const prisma_module_1 = require("./prisma/prisma.module");
const appointments_module_1 = require("./appointments/appointments.module");
const auth_module_1 = require("./auth/auth.module");
const notifications_module_1 = require("./notifications/notifications.module");
const bullmq_1 = require("@nestjs/bullmq");
const services_module_1 = require("./services/services.module");
const admin_clients_module_1 = require("./admin-clients/admin-clients.module");
const admin_barbers_module_1 = require("./admin-barbers/admin-barbers.module");
const schedule_blocks_module_1 = require("./schedule-blocks/schedule-blocks.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            appointments_module_1.AppointmentsModule,
            auth_module_1.AuthModule,
            notifications_module_1.NotificationsModule,
            services_module_1.ServicesModule,
            admin_clients_module_1.AdminClientsModule,
            admin_barbers_module_1.AdminBarbersModule,
            schedule_blocks_module_1.ScheduleBlocksModule,
            bullmq_1.BullModule.forRoot({
                connection: {
                    host: process.env.REDIS_HOST || 'localhost',
                    port: Number(process.env.REDIS_PORT) || 6379,
                },
            })
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map