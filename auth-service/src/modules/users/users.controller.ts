import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Post,
} from '@nestjs/common';
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

  @Get('me')
  async getMe(@Headers('x-user-id') userId?: string) {
    if (!userId) {
      throw new BadRequestException(
        'x-user-id header is required until JWT guard is added in phase 4',
      );
    }

    return this.usersService.getProfile(userId);
  }
}
