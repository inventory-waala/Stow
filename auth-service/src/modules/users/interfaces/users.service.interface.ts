import { RegisterUserDto } from '../dto/users-controller.dto';

export const USERS_SERVICE = 'USERS_SERVICE';

export interface CreateVerifiedUserDto {
  email: string;
  name: string;
  password: string;
}

export interface IUsersService {
  register(registerUserDto: RegisterUserDto): Promise<any>;
  createVerifiedUser(
    data: CreateVerifiedUserDto,
  ): Promise<{ id: string; email: string; name: string | null }>;
  findByEmail(email: string): Promise<any>;
  findById(id: string): Promise<any>;
  getProfile(userId: string): Promise<any>;
}
