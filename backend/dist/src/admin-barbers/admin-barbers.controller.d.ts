import { PrismaService } from '../prisma/prisma.service';
export declare class AdminBarbersController {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getAllBarbers(req: any): Promise<{
        id: string;
        name: string;
        email: string;
        phoneNumber: string | null;
        isAdmin: boolean;
        commissionRate: import("@prisma/client-runtime-utils").Decimal | null;
        createdAt: Date;
    }[]>;
    createBarber(body: {
        name: string;
        email: string;
        phoneNumber?: string;
        isAdmin?: boolean;
        commissionRate?: number;
    }, req: any): Promise<{
        id: string;
        name: string;
        email: string;
        phoneNumber: string | null;
        isAdmin: boolean;
        commissionRate: import("@prisma/client-runtime-utils").Decimal | null;
    }>;
    updateBarber(id: string, body: {
        name: string;
        email: string;
        phoneNumber?: string;
        isAdmin?: boolean;
        commissionRate?: number;
    }, req: any): Promise<{
        id: string;
        name: string;
        email: string;
        phoneNumber: string | null;
        isAdmin: boolean;
        commissionRate: import("@prisma/client-runtime-utils").Decimal | null;
    }>;
    deleteBarber(id: string, req: any): Promise<{
        id: string;
    }>;
}
