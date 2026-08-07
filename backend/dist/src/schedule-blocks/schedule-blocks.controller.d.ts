import { ScheduleBlocksService } from './schedule-blocks.service';
export declare class ScheduleBlocksController {
    private readonly scheduleBlocksService;
    constructor(scheduleBlocksService: ScheduleBlocksService);
    createBlock(body: {
        barberId?: string;
        startTime: string;
        endTime: string;
        reason?: string;
    }, req: any): Promise<{
        id: string;
        startTime: Date;
        endTime: Date;
        reason: string | null;
        createdAt: Date;
        barberId: string;
    }>;
    getBlocks(barberId: string, start: string, end: string, req: any): Promise<{
        id: string;
        startTime: Date;
        endTime: Date;
        reason: string | null;
        createdAt: Date;
        barberId: string;
    }[]>;
    deleteBlock(id: string, req: any): Promise<{
        id: string;
        startTime: Date;
        endTime: Date;
        reason: string | null;
        createdAt: Date;
        barberId: string;
    }>;
}
