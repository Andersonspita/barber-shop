import { AppointmentsService } from './appointments.service';
export declare class AppointmentsController {
    private readonly appointmentsService;
    constructor(appointmentsService: AppointmentsService);
    getAvailability(date: string, serviceId: string, barberId?: string): Promise<{
        time: string;
        available: boolean;
        dateTime: string;
    }[]>;
    bookDynamic(body: {
        serviceId: string;
        startTime: string;
        barberId?: string;
    }, req: any): Promise<{
        message: string;
        appointmentId: string;
    }>;
    getTestData(): Promise<{
        clientId: any;
        serviceId: any;
    }>;
    getTodayMetrics(req: any): Promise<{
        totalRevenue: number;
        completedCount: number;
        pendingCount: number;
    }>;
    getAdvancedMetrics(req: any, startDate: string, endDate: string, barberId?: string): Promise<{
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
    getMyAppointments(req: any): Promise<any>;
    updateStatus(id: string, status: string, req: any): Promise<{
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
}
