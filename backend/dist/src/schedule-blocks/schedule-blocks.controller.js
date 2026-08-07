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
exports.ScheduleBlocksController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const schedule_blocks_service_1 = require("./schedule-blocks.service");
let ScheduleBlocksController = class ScheduleBlocksController {
    scheduleBlocksService;
    constructor(scheduleBlocksService) {
        this.scheduleBlocksService = scheduleBlocksService;
    }
    async createBlock(body, req) {
        const isBarberOrAdmin = req.user.role === 'BARBER' || req.user.isAdmin;
        if (!isBarberOrAdmin)
            throw new common_1.BadRequestException('Acesso negado');
        let targetBarberId = body.barberId;
        if (!targetBarberId) {
            if (req.user.role === 'BARBER') {
                targetBarberId = req.user.sub;
            }
            else {
                throw new common_1.BadRequestException('barberId é obrigatório para admin');
            }
        }
        if (targetBarberId !== req.user.sub && !req.user.isAdmin) {
            throw new common_1.BadRequestException('Acesso negado');
        }
        return this.scheduleBlocksService.createBlock(targetBarberId, new Date(body.startTime), new Date(body.endTime), body.reason);
    }
    async getBlocks(barberId, start, end, req) {
        let targetBarberId = barberId;
        if (!targetBarberId && req.user.role === 'BARBER') {
            targetBarberId = req.user.sub;
        }
        if (!targetBarberId)
            throw new common_1.BadRequestException('barberId é obrigatório');
        const startDate = start ? new Date(start) : undefined;
        const endDate = end ? new Date(end) : undefined;
        return this.scheduleBlocksService.getBlocks(targetBarberId, startDate, endDate);
    }
    async deleteBlock(id, req) {
        return this.scheduleBlocksService.deleteBlock(id, req.user.sub, req.user.isAdmin);
    }
};
exports.ScheduleBlocksController = ScheduleBlocksController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ScheduleBlocksController.prototype, "createBlock", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('barberId')),
    __param(1, (0, common_1.Query)('start')),
    __param(2, (0, common_1.Query)('end')),
    __param(3, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], ScheduleBlocksController.prototype, "getBlocks", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ScheduleBlocksController.prototype, "deleteBlock", null);
exports.ScheduleBlocksController = ScheduleBlocksController = __decorate([
    (0, common_1.Controller)('schedule-blocks'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    __metadata("design:paramtypes", [schedule_blocks_service_1.ScheduleBlocksService])
], ScheduleBlocksController);
//# sourceMappingURL=schedule-blocks.controller.js.map