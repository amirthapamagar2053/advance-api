import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { Role, User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(data: { email: string; password: string; name: string; role?: Role }): Promise<User> {
    return this.prisma.user.create({ data });
  }
}
