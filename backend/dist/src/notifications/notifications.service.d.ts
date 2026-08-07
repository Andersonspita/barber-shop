import { Queue } from 'bullmq';
export interface NotificationPayload {
    appointmentId: string;
    clientName: string;
    phone: string;
    serviceName: string;
    barberName: string;
    time: Date;
}
export declare class NotificationsService {
    private readonly whatsappQueue;
    constructor(whatsappQueue: Queue);
    scheduleWhatsAppNotification(data: NotificationPayload): Promise<void>;
}
