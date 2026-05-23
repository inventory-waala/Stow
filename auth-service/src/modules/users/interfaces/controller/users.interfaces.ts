import { RegisterUserDto } from '../../dto/users-controller.dto';

export const USERS_REPOSITORY = 'USERS_REPOSITORY';
export const USERS_SERVICE = 'USERS_SERVICE';

export interface IUsersRepository {
  newUser(data: {
    email: string;
    passwordHash: string;
    name?: string;
  }): Promise<any>;
  findByEmail(email: string): Promise<any>;
  findById(id: string): Promise<any>;
  findProfileById(id: string): Promise<any>;
}

export interface IUsersService {
  register(registerUserDto: RegisterUserDto): Promise<any>;
  findByEmail(email: string): Promise<any>;
  findById(id: string): Promise<any>;
  getProfile(userId: string): Promise<any>;
}
