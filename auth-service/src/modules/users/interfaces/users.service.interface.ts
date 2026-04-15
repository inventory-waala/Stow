import { RegisterUserDto } from '../dto/users-controller.dto';

export const USERS_SERVICE = 'USERS_SERVICE';

export interface IUsersService {
  register(registerUserDto: RegisterUserDto): Promise<any>;
  findByEmail(email: string): Promise<any>;
  findById(id: string): Promise<any>;
  getProfile(userId: string): Promise<any>;
}
