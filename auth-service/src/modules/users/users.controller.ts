import { Body, Controller, Inject, Post } from '@nestjs/common';
import { RegisterUserDto } from './dto/users-controller.dto';
import {
  IUsersService,
  USERS_SERVICE,
} from './interfaces/users.service.interface';

@Controller('auth')
export class UsersController {
  constructor(
    @Inject(USERS_SERVICE)
    private readonly usersService: IUsersService,
  ) {}

  @Post('register')
  async register(@Body() registerUserDto: RegisterUserDto) {
    return this.usersService.register(registerUserDto);
  }
}
