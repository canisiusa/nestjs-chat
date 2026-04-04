import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';

class LoginDto {
  email: string;
  password: string;
}

class RegisterDto {
  email: string;
  name: string;
  password: string;
  organizationId?: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: dto.password,
        organizationId: dto.organizationId || 'default',
      },
    });

    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
    });

    return { user: { id: user.id, email: user.email, name: user.name }, token };
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || user.password !== dto.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      name: user.name,
      organizationId: user.organizationId,
    });

    return { user: { id: user.id, email: user.email, name: user.name }, token };
  }
}
