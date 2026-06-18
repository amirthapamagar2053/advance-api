import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../common/prisma.service';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  it('findByEmail returns user when found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: '1', email: 'a@b.com' });
    const result = await service.findByEmail('a@b.com');
    expect(result).toEqual({ id: '1', email: 'a@b.com' });
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'a@b.com' } });
  });

  it('findByEmail returns null when not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    expect(await service.findByEmail('none@b.com')).toBeNull();
  });

  it('findById returns user by id', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: '1', email: 'a@b.com' });
    const result = await service.findById('1');
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: '1' } });
    expect(result?.id).toBe('1');
  });

  it('create inserts and returns a new user', async () => {
    const data = { email: 'a@b.com', password: 'hashed', name: 'Alice', role: 'employee' as any };
    mockPrisma.user.create.mockResolvedValue({ id: 'new-id', ...data });
    const result = await service.create(data);
    expect(result.email).toBe('a@b.com');
    expect(mockPrisma.user.create).toHaveBeenCalledWith({ data });
  });
});
