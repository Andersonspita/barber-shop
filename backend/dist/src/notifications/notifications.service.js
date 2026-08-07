"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const date_fns_1 = require("date-fns");
let NotificationsService = class NotificationsService {
    whatsappQueue;
    constructor(whatsappQueue) {
        this.whatsappQueue = whatsappQueue;
    }
    async scheduleWhatsAppNotification(data) {
        await this.whatsappQueue.add('send-confirmation', data, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
        });
        const reminderTime = (0, date_fns_1.subHours)(data.time, 2);
        const delay = (0, date_fns_1.differenceInMilliseconds)(reminderTime, new Date());
        if (delay > 0) {
            await this.whatsappQueue.add('send-reminder', data, {
                delay,
                attempts: 3,
                backoff: { type: 'exponential', delay: 1000 },
            });
        }
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)('whatsapp-queue')),
    __metadata("design:paramtypes", [bullmq_2.Queue])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map