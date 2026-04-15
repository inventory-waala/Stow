import {
  ConflictException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { RegisterUserDto } from './dto/users-controller.dto';
import { IUsersService } from './interfaces/users.service.interface';
import {
  IUsersRepository,
  USERS_REPOSITORY,
} from '../../repositories/interfaces/users.repository.interface';
import {
  ITokenService,
  TOKEN_SERVICE,
} from '../tokens/interface/token.service.interface';
import { TenantsService } from '../tenants/tenants.service';

@Injectable()
export class UsersService implements IUsersService {
  private readonly saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 15);

  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: IUsersRepository,
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: ITokenService,
    private readonly tenantsService: TenantsService,
  ) {}

  async register(user: RegisterUserDto) {
    const existingUser = await this.usersRepository.findByEmail(user.email);

    if (existingUser) {
      throw new ConflictException('Email is already in use');
    }

    const salt = bcrypt.genSaltSync(this.saltRounds);

    const passwordHash = bcrypt.hashSync(user.password, salt);

    const newUser = await this.usersRepository.newUser({
      email: user.email,
      passwordHash,
      name: user.name,
    });

    // Auto-provision a tenant + owner role for this user
    const tenantId = await this.tenantsService.createWithOwnerRole(
      newUser.id,
      user.name || user.email.split('@')[0],
    );

    const verificationToken =
      await this.tokenService.generateEmailVerificationToken(newUser.id);

    return {
      ...newUser,
      tenantId,
      verificationToken,
    };
  }

  async findByEmail(email: string) {
    return this.usersRepository.findByEmail(email);
  }

  async findById(id: string) {
    return this.usersRepository.findById(id);
  }

  async getProfile(userId: string) {
    const user = await this.usersRepository.findProfileById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
