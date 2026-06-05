import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const mockUsers = {
  findByEmail: jest.fn(),
  create: jest.fn(),
};
const mockJwt = { sign: jest.fn().mockReturnValue('mock-token') };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsers },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('register', () => {
    it('throws ConflictException when email already exists', async () => {
      mockUsers.findByEmail.mockResolvedValue({ id: '1' });
      await expect(
        service.register({ name: 'A', email: 'a@b.com', password: '123456', role: 'employee' as any }),
      ).rejects.toThrow(ConflictException);
    });

    it('hashes password and returns user without password field', async () => {
      mockUsers.findByEmail.mockResolvedValue(null);
      mockUsers.create.mockResolvedValue({ id: '1', email: 'a@b.com', role: 'employee', name: 'A' });
      const result = await service.register({ name: 'A', email: 'a@b.com', password: '123456', role: 'employee' as any });
      expect(result).toEqual({ id: '1', email: 'a@b.com', role: 'employee' });
      expect(result).not.toHaveProperty('password');
      const createCall = mockUsers.create.mock.calls[0][0];
      expect(createCall.password).not.toBe('123456');
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException for unknown email', async () => {
      mockUsers.findByEmail.mockResolvedValue(null);
      await expect(service.login({ email: 'x@b.com', password: '123456' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      const hashed = await bcrypt.hash('correct', 10);
      mockUsers.findByEmail.mockResolvedValue({ id: '1', email: 'a@b.com', password: hashed, role: 'employee' });
      await expect(service.login({ email: 'a@b.com', password: 'wrong' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('returns access_token on valid credentials', async () => {
      const hashed = await bcrypt.hash('correct', 10);
      mockUsers.findByEmail.mockResolvedValue({ id: '1', email: 'a@b.com', password: hashed, role: 'employee' });
      const result = await service.login({ email: 'a@b.com', password: 'correct' });
      expect(result).toEqual({ access_token: 'mock-token' });
      expect(mockJwt.sign).toHaveBeenCalledWith({ sub: '1', email: 'a@b.com', role: 'employee' });
    });
  });
});
