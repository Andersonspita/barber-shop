"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentsController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const appointments_service_1 = require("./appointments.service");
let AppointmentsController = class AppointmentsController {
    appointmentsService;
    constructor(appointmentsService) {
        this.appointmentsService = appointmentsService;
    }
    async getAvailability(date, serviceId, barberId) {
        if (!date || !serviceId) {
            throw new common_1.BadRequestException('Parâmetros date e serviceId são obrigatórios.');
        }
        return this.appointmentsService.getAvailability(date, serviceId, barberId);
    }
    async bookDynamic(body, req) {
        const startTimeDate = new Date(body.startTime);
        if (isNaN(startTimeDate.getTime())) {
            throw new common_1.BadRequestException('Data inválida');
        }
        const appt = await this.appointmentsService.bookAnyAvailableBarber(req.user.id, body.serviceId, startTimeDate, body.barberId);
        return { message: 'Agendamento confirmado!', appointmentId: appt.id };
    }
    async getTestData() {
        const prisma = this.appointmentsService.prisma;
        const client = await prisma.user.findFirst({ where: { role: 'CLIENT' } });
        const service = await prisma.service.findFirst();
        return { clientId: client?.id, serviceId: service?.id };
    }
    async getTodayMetrics(req) {
        if (req.user.role !== 'BARBER')
            throw new common_1.BadRequestException('Apenas barbeiros podem ver métricas.');
        return this.appointmentsService.getTodayMetrics(req.user.id);
    }
    async getAdvancedMetrics(req, startDate, endDate, barberId) {
        if (req.user.role !== 'BARBER')
            throw new common_1.BadRequestException('Acesso negado.');
        const targetBarberId = req.user.isAdmin ? (barberId || undefined) : req.user.id;
        return this.appointmentsService.getAdvancedMetrics(startDate, endDate, targetBarberId);
    }
    async getMyAppointments(req) {
        const prisma = this.appointmentsService.prisma;
        const appointments = await prisma.appointment.findMany({
            where: req.user.role === 'BARBER' ? { barberId: req.user.id } : { clientId: req.user.id },
            include: {
                service: true,
                client: { select: { name: true, email: true } },
            },
            orderBy: { startTime: 'asc' }
        });
        return appointments;
    }
    async updateStatus(id, status, req) {
        if (req.user.role === 'CLIENT' && status !== 'CANCELED') {
            throw new common_1.BadRequestException('Clientes só podem cancelar agendamentos.');
        }
        return this.appointmentsService.updateStatus(id, status, req.user.id, req.user.role);
    }
};
exports.AppointmentsController = AppointmentsController;
__decorate([
    (0, common_1.Get)('availability'),
    __param(0, (0, common_1.Query)('date')),
    __param(1, (0, common_1.Query)('serviceId')),
    __param(2, (0, common_1.Query)('barberId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], AppointmentsController.prototype, "getAvailability", null);
__decorate([
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Post)('dynamic'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AppointmentsController.prototype, "bookDynamic", null);
__decorate([
    (0, common_1.Get)('test-data'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AppointmentsController.prototype, "getTestData", null);
__decorate([
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Get)('metrics/today'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AppointmentsController.prototype, "getTodayMetrics", null);
__decorate([
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Get)('metrics/advanced'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('startDate')),
    __param(2, (0, common_1.Query)('endDate')),
    __param(3, (0, common_1.Query)('barberId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], AppointmentsController.prototype, "getAdvancedMetrics", null);
__decorate([
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AppointmentsController.prototype, "getMyAppointments", null);
__decorate([
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Patch)(':id/status'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('status')),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], AppointmentsController.prototype, "updateStatus", null);
exports.AppointmentsController = AppointmentsController = __decorate([
    (0, common_1.Controller)('appointments'),
    __metadata("design:paramtypes", [appointments_service_1.AppointmentsService])
], AppointmentsController);
//# sourceMappingURL=appointments.controller.js.map