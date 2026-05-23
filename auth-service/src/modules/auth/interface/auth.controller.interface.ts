import {
  LoginDto,
  LoginResponseDto,
  RefreshTokenDto,
} from '../dto/auth.controller.dto';

export const AUTH_CONTROLLER = 'AUTH_CONTROLLER';

export interface IAuthController {
  login(loginData: LoginDto): Promise<LoginResponseDto>;
  refresh(body: RefreshTokenDto): Promise<LoginResponseDto>;
  logout(body: RefreshTokenDto): Promise<{ message: string }>;
}
