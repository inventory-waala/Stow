import { Test, TestingModule } from '@nestjs/testing';
import { PasskeyService } from './passkey.service';

import { AUTHENTICATOR_REPOSITORY } from '../../repositories/interfaces/authenticator.repository.interface';
import { USERS_REPOSITORY } from '../../repositories/interfaces/users.repository.interface';

describe('PasskeyService', () => {
  let service: PasskeyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasskeyService,
        {
          provide: USERS_REPOSITORY,
          useValue: {}, // Mock implementation
        },
        {
          provide: AUTHENTICATOR_REPOSITORY,
          useValue: {}, // Mock implementation
        },
      ],
    }).compile();

    service = module.get<PasskeyService>(PasskeyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
