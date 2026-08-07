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
exports.AppointmentsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const date_fns_1 = require("date-fns");
const notifications_service_1 = require("../notifications/notifications.service");
let AppointmentsService = class AppointmentsService {
    prisma;
    notificationsService;
    constructor(prisma, notificationsService) {
        this.prisma = prisma;
        this.notificationsService = notificationsService;
    }
    async bookAnyAvailableBarber(clientId, serviceId, startTime, preferredBarberId) {
        const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
        if (!service)
            throw new common_1.NotFoundException('Serviço não encontrado');
        const endTime = (0, date_fns_1.addMinutes)(startTime, service.durationMinutes);
        const appointment = await this.prisma.$transaction(async (tx) => {
            const whereClause = {
                role: 'BARBER',
                NOT: {
                    barberAppointments: {
                        some: {
                            status: 'SCHEDULED',
                            startTime: { lt: endTime },
                            endTime: { gt: startTime },
                        },
                    },
                },
            };
            if (preferredBarberId) {
                whereClause.id = preferredBarberId;
            }
            const availableBarbers = await tx.user.findMany({
                where: whereClause,
                take: 1,
            });
            if (availableBarbers.length === 0) {
                throw new common_1.ConflictException('Não há barbeiros disponíveis neste horário.');
            }
            return tx.appointment.create({
                data: {
                    clientId,
                    barberId: availableBarbers[0].id,
                    serviceId,
                    startTime,
                    endTime,
                    status: 'SCHEDULED',
                },
                include: {
                    client: { select: { name: true, phoneNumber: true } },
                    barber: { select: { name: true } },
                    service: { select: { name: true } }
                }
            });
        }, {
            isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable,
        });
        await this.notificationsService.scheduleWhatsAppNotification({
            appointmentId: appointment.id,
            clientName: appointment.client?.name || 'Cliente',
            phone: appointment.client?.phoneNumber || 'S/N',
            serviceName: appointment.service?.name || 'Serviço',
            barberName: appointment.barber?.name || 'Equipe',
            time: appointment.startTime
        });
        return appointment;
    }
    async getAvailability(dateString, serviceId, preferredBarberId) {
        const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
        if (!service)
            throw new common_1.NotFoundException('Serviço não encontrado');
        const date = new Date(dateString);
        if (isNaN(date.getTime()))
            throw new common_1.ConflictException('Data inválida');
        const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0, 0);
        const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 18, 0, 0);
        let allBarbers = await this.prisma.user.findMany({ where: { role: 'BARBER' } });
        if (preferredBarberId) {
            allBarbers = allBarbers.filter(b => b.id === preferredBarberId);
        }
        if (allBarbers.length === 0)
            return [];
        const dayAppointments = await this.prisma.appointment.findMany({
            where: {
                status: 'SCHEDULED',
                startTime: { gte: startOfDay, lt: endOfDay },
                barberId: preferredBarberId ? preferredBarberId : undefined
            },
        });
        const dayBlocks = await this.prisma.scheduleBlock.findMany({
            where: {
                startTime: { lt: endOfDay },
                endTime: { gt: startOfDay },
                barberId: preferredBarberId ? preferredBarberId : undefined
            }
        });
        const availableSlots = [];
        let currentSlot = startOfDay;
        while (currentSlot < endOfDay) {
            const slotEnd = (0, date_fns_1.addMinutes)(currentSlot, service.durationMinutes);
            if (slotEnd <= endOfDay) {
                const isAnyBarberFree = allBarbers.some((barber) => {
                    const hasApptConflict = dayAppointments.some(appt => {
                        return appt.barberId === barber.id &&
                            appt.startTime < slotEnd &&
                            appt.endTime > currentSlot;
                    });
                    const hasBlockConflict = dayBlocks.some(block => {
                        return block.barberId === barber.id &&
                            block.startTime < slotEnd &&
                            block.endTime > currentSlot;
                    });
                    return !hasApptConflict && !hasBlockConflict;
                });
                if (isAnyBarberFree) {
                    availableSlots.push({
                        time: currentSlot.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false }),
                        available: true,
                        dateTime: currentSlot.toISOString()
                    });
                }
            }
            currentSlot = (0, date_fns_1.addMinutes)(currentSlot, 30);
        }
        return availableSlots;
    }
    async updateStatus(appointmentId, status, userId, role) {
        const appointment = await this.prisma.appointment.findUnique({ where: { id: appointmentId } });
        if (!appointment)
            throw new common_1.NotFoundException('Agendamento não encontrado');
        if (role === 'BARBER' && appointment.barberId !== userId) {
            throw new common_1.ConflictException('Sem permissão para alterar este agendamento');
        }
        if (role === 'CLIENT' && appointment.clientId !== userId) {
            throw new common_1.ConflictException('Sem permissão para alterar este agendamento');
        }
        if (status === 'COMPLETED') {
            const now = new Date();
            if (now < appointment.startTime) {
                throw new common_1.BadRequestException('Não é possível concluir um agendamento antes do seu horário de início.');
            }
        }
        return this.prisma.appointment.update({
            where: { id: appointmentId },
            data: { status: status }
        });
    }
    async getTodayMetrics(barberId) {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
        const appointments = await this.prisma.appointment.findMany({
            where: {
                barberId,
                startTime: { gte: startOfDay, lt: endOfDay },
            },
            include: { service: true }
        });
        let totalRevenue = 0;
        let completedCount = 0;
        let pendingCount = 0;
        for (const appt of appointments) {
            if (appt.status === 'COMPLETED') {
                completedCount++;
                totalRevenue += Number(appt.service.price);
            }
            else if (appt.status === 'SCHEDULED') {
                pendingCount++;
            }
        }
        return { totalRevenue, completedCount, pendingCount };
    }
    async getAdvancedMetrics(startDateStr, endDateStr, barberId) {
        if (!startDateStr || !endDateStr) {
            throw new common_1.BadRequestException('startDate e endDate são obrigatórios');
        }
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        endDate.setHours(23, 59, 59, 999);
        const whereClause = {
            startTime: {
                gte: startDate,
                lte: endDate,
            },
        };
        if (barberId) {
            whereClause.barberId = barberId;
        }
        const appointments = await this.prisma.appointment.findMany({
            where: whereClause,
            include: {
                service: true,
                barber: { select: { name: true, commissionRate: true } },
                client: { select: { name: true, email: true } }
            },
            orderBy: { startTime: 'desc' }
        });
        let totalRevenue = 0;
        let completedCount = 0;
        let totalCommission = 0;
        const details = [];
        for (const appt of appointments) {
            if (appt.status === 'COMPLETED') {
                completedCount++;
                const price = Number(appt.service.price);
                totalRevenue += price;
                const rate = appt.barber?.commissionRate ? Number(appt.barber.commissionRate) : 0.50;
                const commission = price * rate;
                totalCommission += commission;
                details.push({
                    id: appt.id,
                    startTime: appt.startTime,
                    clientName: appt.client?.name || appt.client?.email || 'Desconhecido',
                    serviceName: appt.service.name,
                    price,
                    commission,
                    barberName: appt.barber?.name || 'Desconhecido'
                });
            }
        }
        return { totalRevenue, totalCommission, completedCount, details };
    }
};
exports.AppointmentsService = AppointmentsService;
exports.AppointmentsService = AppointmentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notifications_service_1.NotificationsService])
], AppointmentsService);
//# sourceMappingURL=appointments.service.js.map