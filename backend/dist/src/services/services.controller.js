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
exports.ServicesController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const prisma_service_1 = require("../prisma/prisma.service");
let ServicesController = class ServicesController {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getAllServices(req) {
        if (!req.user.isAdmin)
            throw new common_1.BadRequestException('Acesso negado');
        return this.prisma.service.findMany({ orderBy: { name: 'asc' } });
    }
    async createService(body, req) {
        if (!req.user.isAdmin)
            throw new common_1.BadRequestException('Acesso negado');
        return this.prisma.service.create({
            data: {
                name: body.name,
                durationMinutes: Number(body.durationMinutes),
                price: Number(body.price),
            },
        });
    }
    async updateService(id, body, req) {
        if (!req.user.isAdmin)
            throw new common_1.BadRequestException('Acesso negado');
        return this.prisma.service.update({
            where: { id },
            data: {
                name: body.name,
                durationMinutes: Number(body.durationMinutes),
                price: Number(body.price),
            },
        });
    }
    async deleteService(id, req) {
        if (!req.user.isAdmin)
            throw new common_1.BadRequestException('Acesso negado');
        return this.prisma.service.delete({ where: { id } });
    }
};
exports.ServicesController = ServicesController;
__decorate([
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ServicesController.prototype, "getAllServices", null);
__decorate([
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ServicesController.prototype, "createService", null);
__decorate([
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ServicesController.prototype, "updateService", null);
__decorate([
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ServicesController.prototype, "deleteService", null);
exports.ServicesController = ServicesController = __decorate([
    (0, common_1.Controller)('admin/services'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ServicesController);
//# sourceMappingURL=services.controller.js.map