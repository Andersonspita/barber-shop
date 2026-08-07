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
exports.AdminBarbersController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const prisma_service_1 = require("../prisma/prisma.service");
let AdminBarbersController = class AdminBarbersController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getAllBarbers(req) {
        if (!req.user.isAdmin)
            throw new common_1.BadRequestException('Acesso negado');
        return this.prisma.user.findMany({
            where: { role: 'BARBER' },
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
                isAdmin: true,
                commissionRate: true,
                createdAt: true,
            }
        });
    }
    async createBarber(body, req) {
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
                passwordHash: genericPassword,
                role: 'BARBER',
                isAdmin: body.isAdmin || false,
                commissionRate: body.commissionRate ?? 0.50,
            },
            select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
                isAdmin: true,
                commissionRate: true,
            }
        });
    }
    async updateBarber(id, body, req) {
        if (!req.user.isAdmin)
            throw new common_1.BadRequestException('Acesso negado');
        return this.prisma.user.update({
            where: { id },
            data: {
                name: body.name,
                email: body.email,
                phoneNumber: body.phoneNumber || null,
                isAdmin: body.isAdmin || false,
                commissionRate: body.commissionRate ?? 0.50,
            },
            select: {
                id: true,
                name: true,
                email: true,
                phoneNumber: true,
                isAdmin: true,
                commissionRate: true,
            }
        });
    }
    async deleteBarber(id, req) {
        if (!req.user.isAdmin)
            throw new common_1.BadRequestException('Acesso negado');
        return this.prisma.user.delete({
            where: { id },
            select: { id: true }
        });
    }
};
exports.AdminBarbersController = AdminBarbersController;
__decorate([
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminBarbersController.prototype, "getAllBarbers", null);
__decorate([
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminBarbersController.prototype, "createBarber", null);
__decorate([
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], AdminBarbersController.prototype, "updateBarber", null);
__decorate([
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminBarbersController.prototype, "deleteBarber", null);
exports.AdminBarbersController = AdminBarbersController = __decorate([
    (0, common_1.Controller)('admin/barbers'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminBarbersController);
//# sourceMappingURL=admin-barbers.controller.js.map