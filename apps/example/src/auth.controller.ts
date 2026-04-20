import {
  Controller,
  Post,
  Body,
  Req,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { PrismaService } from './prisma.service';

const LOGIN_RATE_WINDOW_MS = 60_000;
const LOGIN_RATE_MAX_ATTEMPTS = 10;
const loginAttempts = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const attempts = (loginAttempts.get(key) ?? []).filter((t) => now - t < LOGIN_RATE_WINDOW_MS);
  attempts.push(now);
  loginAttempts.set(key, attempts);
  return attempts.length > LOGIN_RATE_MAX_ATTEMPTS;
}

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  password!: string;

  @IsOptional()
  @IsString()
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
  async login(@Body() dto: LoginDto, @Req() req: any) {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const key = `${ip}:${dto.email.toLowerCase()}`;
    if (isRateLimited(key)) {
      throw new HttpException('Too many login attempts, try again later', HttpStatus.TOO_MANY_REQUESTS);
    }

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
