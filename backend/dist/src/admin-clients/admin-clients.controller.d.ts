import { PrismaService } from '../prisma/prisma.service';
export declare class AdminClientsController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getAllClients(req: any): Promise<{
        id: string;
        name: string;
        email: string;
        phoneNumber: string | null;
        createdAt: Date;
    }[]>;
    createClient(body: {
        name: string;
        email: string;
        phoneNumber?: string;
        birthDate?: string;
    }, req: any): Promise<{
        id: string;
        name: string;
        email: string;
        phoneNumber: string | null;
        birthDate: Date | null;
    }>;
    updateClient(id: string, body: {
        name: string;
        email: string;
        phoneNumber?: string;
        birthDate?: string;
    }, req: any): Promise<{
        id: string;
        name: string;
        email: string;
        phoneNumber: string | null;
    }>;
    deleteClient(id: string, req: any): Promise<{
        id: string;
    }>;
    getClientHistory(id: string, req: any): Promise<{
        client: {
            name: string;
            email: string;
            phoneNumber: string | null;
            createdAt: Date;
        };
        metrics: {
            totalSpent: number;
            completedCount: number;
            noShowCount: number;
            totalAppointments: number;
        };
        history: {
            id: string;
            date: Date;
            service: string;
            price: number;
            barber: string;
            status: import("@prisma/client").$Enums.AppointmentStatus;
        }[];
    }>;
}
