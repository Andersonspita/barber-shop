import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('responde na raiz', () => {
    expect(appController.getHello()).toBe('Hello World!');
  });

  it('expõe a verificação de saúde', () => {
    expect(appController.health()).toMatchObject({ status: 'ok' });
  });
});
