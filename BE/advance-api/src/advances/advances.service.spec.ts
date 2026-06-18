import { Test, TestingModule } from '@nestjs/testing';
import { AdvancesService } from './advances.service';
import { PrismaService } from '../common/prisma.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

const mockPrisma = {
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
  advanceRequest: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  approvalLog: { create: jest.fn() },
};

describe('AdvancesService', () => {
  let service: AdvancesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdvancesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<AdvancesService>(AdvancesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('generates ADV-XXXX request number and creates the record', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ nextval: BigInt(1042) }]);
      mockPrisma.advanceRequest.create.mockResolvedValue({ id: '1', requestNumber: 'ADV-1042' });
      const result = await service.create('emp1', { amount: 5000, purpose: 'Trip' });
      expect(result.requestNumber).toBe('ADV-1042');
      expect(mockPrisma.advanceRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ requestNumber: 'ADV-1042', employeeId: 'emp1' }),
        }),
      );
    });
  });

  describe('submit', () => {
    it('throws NotFoundException when advance does not exist', async () => {
      mockPrisma.advanceRequest.findUnique.mockResolvedValue(null);
      await expect(service.submit('bad-id', 'emp1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when employee is not the owner', async () => {
      mockPrisma.advanceRequest.findUnique.mockResolvedValue({ id: '1', employeeId: 'other', status: 'Draft' });
      await expect(service.submit('1', 'emp1')).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when status is not Draft', async () => {
      mockPrisma.advanceRequest.findUnique.mockResolvedValue({ id: '1', employeeId: 'emp1', status: 'Pending_Supervisor' });
      await expect(service.submit('1', 'emp1')).rejects.toThrow(BadRequestException);
    });

    it('updates status to Pending_Supervisor', async () => {
      mockPrisma.advanceRequest.findUnique.mockResolvedValue({ id: '1', employeeId: 'emp1', status: 'Draft' });
      mockPrisma.advanceRequest.update.mockResolvedValue({ id: '1', status: 'Pending_Supervisor' });
      const result = await service.submit('1', 'emp1');
      expect(result.status).toBe('Pending_Supervisor');
    });
  });

  describe('approve', () => {
    it('throws NotFoundException when advance does not exist', async () => {
      mockPrisma.advanceRequest.findUnique.mockResolvedValue(null);
      await expect(service.approve('bad-id', 'mgr1', {})).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when status is not Pending_Supervisor', async () => {
      mockPrisma.advanceRequest.findUnique.mockResolvedValue({ id: '1', status: 'Draft' });
      await expect(service.approve('1', 'mgr1', {})).rejects.toThrow(BadRequestException);
    });

    it('runs a transaction to update status and insert approval log', async () => {
      mockPrisma.advanceRequest.findUnique.mockResolvedValue({ id: '1', status: 'Pending_Supervisor' });
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.advanceRequest.update.mockResolvedValue({ id: '1', status: 'Approved' });
      mockPrisma.approvalLog.create.mockResolvedValue({});
      const result = await service.approve('1', 'mgr1', { comments: 'Looks good' });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.approvalLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'Approved', actorId: 'mgr1' }) }),
      );
      expect(result.status).toBe('Approved');
    });
  });

  describe('reject', () => {
    it('runs a transaction and sets status to Rejected', async () => {
      mockPrisma.advanceRequest.findUnique.mockResolvedValue({ id: '1', status: 'Pending_Supervisor' });
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.advanceRequest.update.mockResolvedValue({ id: '1', status: 'Rejected' });
      mockPrisma.approvalLog.create.mockResolvedValue({});
      const result = await service.reject('1', 'mgr1', { comments: 'Over budget' });
      expect(result.status).toBe('Rejected');
      expect(mockPrisma.approvalLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'Rejected' }) }),
      );
    });
  });

  describe('returnRequest', () => {
    it('runs a transaction and sets status to Returned', async () => {
      mockPrisma.advanceRequest.findUnique.mockResolvedValue({ id: '1', status: 'Pending_Supervisor' });
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.advanceRequest.update.mockResolvedValue({ id: '1', status: 'Returned' });
      mockPrisma.approvalLog.create.mockResolvedValue({});
      const result = await service.returnRequest('1', 'mgr1', { comments: 'Need more info' });
      expect(result.status).toBe('Returned');
    });
  });
});
