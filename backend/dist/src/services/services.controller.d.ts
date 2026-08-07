import { PrismaService } from '../prisma/prisma.service';
export declare class ServicesController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getAllServices(req: any): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        durationMinutes: number;
        price: import("@prisma/client-runtime-utils").Decimal;
    }[]>;
    createService(body: {
        name: string;
        durationMinutes: number;
        price: number;
    }, req: any): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        durationMinutes: number;
        price: import("@prisma/client-runtime-utils").Decimal;
    }>;
    updateService(id: string, body: {
        name: string;
        durationMinutes: number;
        price: number;
    }, req: any): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        durationMinutes: number;
        price: import("@prisma/client-runtime-utils").Decimal;
    }>;
    deleteService(id: string, req: any): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        durationMinutes: number;
        price: import("@prisma/client-runtime-utils").Decimal;
    }>;
}
