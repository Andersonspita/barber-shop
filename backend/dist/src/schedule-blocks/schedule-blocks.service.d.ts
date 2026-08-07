import { PrismaService } from '../prisma/prisma.service';
export declare class ScheduleBlocksService {
    private prisma;
    constructor(prisma: PrismaService);
    createBlock(barberId: string, startTime: Date, endTime: Date, reason?: string): Promise<{
        id: string;
        startTime: Date;
        endTime: Date;
        reason: string | null;
        createdAt: Date;
        barberId: string;
    }>;
    getBlocks(barberId: string, start?: Date, end?: Date): Promise<{
        id: string;
        startTime: Date;
        endTime: Date;
        reason: string | null;
        createdAt: Date;
        barberId: string;
    }[]>;
    deleteBlock(id: string, barberId: string, isAdmin: boolean): Promise<{
        id: string;
        startTime: Date;
        endTime: Date;
        reason: string | null;
        createdAt: Date;
        barberId: string;
    }>;
}
