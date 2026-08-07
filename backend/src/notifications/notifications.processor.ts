import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';

@Processor('whatsapp-queue')
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case 'send-confirmation': {
        const { clientName, phone, time, serviceName, barberName } = job.data;
        this.logger.log(`[Evolution API] Enviando CONFIRMAÇÃO para ${clientName} (${phone}) - Serviço: ${serviceName} com ${barberName} às ${time}`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        this.logger.log(`✅ [Evolution API] Confirmação enviada!`);
        break;
      }
      case 'send-reminder': {
        const { clientName, phone, time, serviceName, barberName } = job.data;
        this.logger.log(`[Evolution API] Enviando LEMBRETE para ${clientName} (${phone}) - Faltam 2 horas para o serviço: ${serviceName} com ${barberName} às ${time}`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        this.logger.log(`✅ [Evolution API] Lembrete enviado!`);
        break;
      }
      default:
        this.logger.warn(`Job desconhecido: ${job.name}`);
    }
  }
}
