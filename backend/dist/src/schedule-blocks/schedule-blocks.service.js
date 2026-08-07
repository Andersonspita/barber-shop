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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduleBlocksService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ScheduleBlocksService = class ScheduleBlocksService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createBlock(barberId, startTime, endTime, reason) {
        if (startTime >= endTime) {
            throw new common_1.BadRequestException('O horário de fim deve ser após o horário de início.');
        }
        const conflictAppt = await this.prisma.appointment.findFirst({
            where: {
                barberId,
                status: 'SCHEDULED',
                AND: [
                    { startTime: { lt: endTime } },
                    { endTime: { gt: startTime } }
                ]
            }
        });
        if (conflictAppt) {
            throw new common_1.ConflictException('Já existe um agendamento marcado neste horário.');
        }
        const conflictBlock = await this.prisma.scheduleBlock.findFirst({
            where: {
                barberId,
                AND: [
                    { startTime: { lt: endTime } },
                    { endTime: { gt: startTime } }
                ]
            }
        });
        if (conflictBlock) {
            throw new common_1.ConflictException('Já existe um bloqueio de agenda neste horário.');
        }
        return this.prisma.scheduleBlock.create({
            data: {
                barberId,
                startTime,
                endTime,
                reason
            }
        });
    }
    async getBlocks(barberId, start, end) {
        const where = { barberId };
        if (start && end) {
            where.startTime = { gte: start };
            where.endTime = { lte: end };
        }
        return this.prisma.scheduleBlock.findMany({
            where,
            orderBy: { startTime: 'asc' }
        });
    }
    async deleteBlock(id, barberId, isAdmin) {
        const block = await this.prisma.scheduleBlock.findUnique({ where: { id } });
        if (!block)
            throw new common_1.BadRequestException('Bloqueio não encontrado.');
        if (!isAdmin && block.barberId !== barberId) {
            throw new common_1.ConflictException('Sem permissão para remover este bloqueio.');
        }
        return this.prisma.scheduleBlock.delete({ where: { id } });
    }
};
exports.ScheduleBlocksService = ScheduleBlocksService;
exports.ScheduleBlocksService = ScheduleBlocksService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ScheduleBlocksService);
//# sourceMappingURL=schedule-blocks.service.js.map