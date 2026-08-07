import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
export declare class AppointmentsService {
    private prisma;
    private notificationsService;
    constructor(prisma: PrismaService, notificationsService: NotificationsService);
    bookAnyAvailableBarber(clientId: string, serviceId: string, startTime: Date, preferredBarberId?: string): Promise<{
        service: {
            name: string;
        };
        client: {
            name: string;
            phoneNumber: string | null;
        };
        barber: {
            name: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        clientId: string;
        barberId: string;
        serviceId: string;
        startTime: Date;
        endTime: Date;
        status: import("@prisma/client").$Enums.AppointmentStatus;
    }>;
    getAvailability(dateString: string, serviceId: string, preferredBarberId?: string): Promise<{
        time: string;
        available: boolean;
        dateTime: string;
    }[]>;
    updateStatus(appointmentId: string, status: string, userId: string, role: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        clientId: string;
        barberId: string;
        serviceId: string;
        startTime: Date;
        endTime: Date;
        status: import("@prisma/client").$Enums.AppointmentStatus;
    }>;
    getTodayMetrics(barberId: string): Promise<{
        totalRevenue: number;
        completedCount: number;
        pendingCount: number;
    }>;
    getAdvancedMetrics(startDateStr: string, endDateStr: string, barberId?: string): Promise<{
        totalRevenue: number;
        totalCommission: number;
        completedCount: number;
        details: {
            id: string;
            startTime: Date;
            clientName: string;
            serviceName: string;
            price: number;
            commission: number;
            barberName: string;
        }[];
    }>;
}
