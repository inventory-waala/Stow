import { Test, TestingModule } from '@nestjs/testing';
import { PasskeyController } from './passkey.controller';
import { PasskeyService } from './passkey.service';
import { AUTH_SERVICE } from '../auth/interface/auth.service.interface';

describe('PasskeyController', () => {
  let controller: PasskeyController;
  const passkeyService = {
    verifyAuthentication: jest.fn(),
  };
  const authService = {
    loginWithVerifiedUser: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PasskeyController],
      providers: [
        { provide: PasskeyService, useValue: passkeyService },
        { provide: AUTH_SERVICE, useValue: authService },
      ],
    }).compile();

    controller = module.get<PasskeyController>(PasskeyController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns a session alongside the verified profile', async () => {
    passkeyService.verifyAuthentication.mockResolvedValue({
      success: true,
      user: { id: 'u1', email: 'a@b.c' },
    });
    authService.loginWithVerifiedUser.mockResolvedValue({
      accessToken: 'at',
      refreshToken: 'rt',
    });

    const result = await controller.verifyAuthentication({
      response: {} as any,
    });

    expect(authService.loginWithVerifiedUser).toHaveBeenCalledWith('u1');
    expect(result).toEqual({
      success: true,
      user: { id: 'u1', email: 'a@b.c' },
      accessToken: 'at',
      refreshToken: 'rt',
    });
  });
});
