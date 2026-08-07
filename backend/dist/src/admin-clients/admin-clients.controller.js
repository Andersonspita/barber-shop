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
exports.AdminClientsController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const prisma_service_1 = require("../prisma/prisma.service");
let AdminClientsController = class AdminClientsController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getAllClients(req) {
        if (!req.user.isAdmin)
            throw new common_1.BadRequestException('Acesso negado');
        return this.prisma.user.findMany({
            where: { role: 'CLIENT' },
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
                createdAt: true,
            }
        });
    }
    async createClient(body, req) {
        if (!req.user.isAdmin)
            throw new common_1.BadRequestException('Acesso negado');
        const genericPassword = 'Mudar@123';
        const exists = await this.prisma.user.findUnique({ where: { email: body.email } });
        if (exists)
            throw new common_1.BadRequestException('E-mail já cadastrado.');
        return this.prisma.user.create({
            data: {
                name: body.name,
                email: body.email,
                phoneNumber: body.phoneNumber || null,
                birthDate: body.birthDate ? new Date(body.birthDate) : null,
                passwordHash: genericPassword,
                role: 'CLIENT',
            },
            select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
                birthDate: true,
            }
        });
    }
    async updateClient(id, body, req) {
        if (!req.user.isAdmin)
            throw new common_1.BadRequestException('Acesso negado');
        return this.prisma.user.update({
            where: { id },
            data: {
                name: body.name,
                email: body.email,
                phoneNumber: body.phoneNumber || null,
                birthDate: body.birthDate ? new Date(body.birthDate) : null,
            },
            select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
            }
        });
    }
    async deleteClient(id, req) {
        if (!req.user.isAdmin)
            throw new common_1.BadRequestException('Acesso negado');
        return this.prisma.user.delete({
            where: { id },
            select: { id: true }
        });
    }
    async getClientHistory(id, req) {
        if (!req.user.isAdmin)
            throw new common_1.BadRequestException('Acesso negado');
        const client = await this.prisma.user.findUnique({
            where: { id, role: 'CLIENT' },
            select: { name: true, email: true, phoneNumber: true, createdAt: true }
        });
        if (!client)
            throw new common_1.BadRequestException('Cliente não encontrado');
        const appointments = await this.prisma.appointment.findMany({
            where: { clientId: id },
            include: {
                service: { select: { name: true, price: true } },
                barber: { select: { name: true } }
            },
            orderBy: { startTime: 'desc' }
        });
        let totalSpent = 0;
        let completedCount = 0;
        let noShowCount = 0;
        const history = appointments.map(appt => {
            if (appt.status === 'COMPLETED') {
                completedCount++;
                totalSpent += Number(appt.service.price);
            }
            else if (appt.status === 'NO_SHOW' || appt.status === 'CANCELLED') {
                noShowCount++;
            }
            return {
                id: appt.id,
                date: appt.startTime,
                service: appt.service.name,
                price: Number(appt.service.price),
                barber: appt.barber?.name || 'Desconhecido',
                status: appt.status
            };
        });
        return {
            client,
            metrics: {
                totalSpent,
                completedCount,
                noShowCount,
                totalAppointments: appointments.length
            },
            history
        };
    }
};
exports.AdminClientsController = AdminClientsController;
__decorate([
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminClientsController.prototype, "getAllClients", null);
__decorate([
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminClientsController.prototype, "createClient", null);
__decorate([
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminClientsController.prototype, "updateClient", null);
__decorate([
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminClientsController.prototype, "deleteClient", null);
__decorate([
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Get)(':id/history'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminClientsController.prototype, "getClientHistory", null);
exports.AdminClientsController = AdminClientsController = __decorate([
    (0, common_1.Controller)('admin/clients'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminClientsController);
//# sourceMappingURL=admin-clients.controller.js.map