import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

/**
 * As rotas `/services` e `/barbers` viviam aqui e também no
 * PublicCatalogController — duas definições para o mesmo caminho, e a que
 * respondia dependia da ordem de registro dos módulos. A versão daqui não
 * filtrava serviço inativo nem trazia a descrição. O catálogo público é o
 * dono dessas rotas; aqui fica só a verificação de saúde.
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  health() {
    return { status: 'ok', uptime: process.uptime() };
  }
}
