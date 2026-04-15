import { Test, TestingModule } from '@nestjs/testing';
import { PasskeyController } from './passkey.controller';
import { PasskeyService } from './passkey.service';

describe('PasskeyController', () => {
  let controller: PasskeyController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PasskeyController],
      providers: [
        {
          provide: PasskeyService,
          useValue: {}, // Mock implementation
        },
      ],
    }).compile();

    controller = module.get<PasskeyController>(PasskeyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
