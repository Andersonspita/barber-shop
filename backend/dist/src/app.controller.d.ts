import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
export declare class AppController {
    private readonly appService;
    private readonly prisma;
    constructor(appService: AppService, prisma: PrismaService);
    getHello(): string;
    getServices(): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        durationMinutes: number;
        price: import("@prisma/client-runtime-utils").Decimal;
    }[]>;
    getBarbers(): Promise<{
        id: string;
        name: string;
    }[]>;
}
