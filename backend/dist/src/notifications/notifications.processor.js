"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var NotificationsProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
let NotificationsProcessor = NotificationsProcessor_1 = class NotificationsProcessor extends bullmq_1.WorkerHost {
    logger = new common_1.Logger(NotificationsProcessor_1.name);
    async process(job) {
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
};
exports.NotificationsProcessor = NotificationsProcessor;
exports.NotificationsProcessor = NotificationsProcessor = NotificationsProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('whatsapp-queue')
], NotificationsProcessor);
//# sourceMappingURL=notifications.processor.js.map