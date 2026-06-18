import { Test, TestingModule } from '@nestjs/testing';
import { SettlementsService } from './settlements.service';
import { PrismaService } from '../common/prisma.service';
import { SupabaseStorageService } from './supabase-storage.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

const mockPrisma = {
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
  advanceRequest: { findUnique: jest.fn() },
  settlement: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  approvalLog: { create: jest.fn() },
};

const mockStorage = { uploadFile: jest.fn() };

const mockFile = (name = 'r.jpg') =>
  ({ buffer: Buffer.from('data'), originalname: name, mimetype: 'image/jpeg' } as Express.Multer.File);

describe('SettlementsService', () => {
  let service: SettlementsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SupabaseStorageService, useValue: mockStorage },
      ],
    }).compile();
    service = module.get<SettlementsService>(SettlementsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('throws NotFoundException when advance request does not exist', async () => {
      mockPrisma.advanceRequest.findUnique.mockResolvedValue(null);
      await expect(service.create('emp1', 'adv-id', [])).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when employee does not own the advance', async () => {
      mockPrisma.advanceRequest.findUnique.mockResolvedValue({ id: 'adv-id', employeeId: 'other', status: 'Approved' });
      await expect(service.create('emp1', 'adv-id', [])).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when advance is not Approved', async () => {
      mockPrisma.advanceRequest.findUnique.mockResolvedValue({ id: 'adv-id', employeeId: 'emp1', status: 'Draft' });
      await expect(service.create('emp1', 'adv-id', [])).rejects.toThrow(BadRequestException);
    });

    it('uploads receipts and creates settlement with expenses', async () => {
      mockPrisma.advanceRequest.findUnique.mockResolvedValue({ id: 'adv-id', employeeId: 'emp1', status: 'Approved' });
      mockPrisma.$queryRaw.mockResolvedValue([{ nextval: BigInt(3021) }]);
      mockStorage.uploadFile.mockResolvedValue('https://cdn.example.com/receipt.jpg');
      mockPrisma.settlement.create.mockResolvedValue({ id: 'set-1', referenceNumber: 'SET-3021' });
      const expenses = [{ expenseType: 'Travel', amount: 500, file: mockFile() }];
      const result = await service.create('emp1', 'adv-id', expenses);
      expect(result.referenceNumber).toBe('SET-3021');
      expect(mockStorage.uploadFile).toHaveBeenCalledTimes(1);
      expect(mockPrisma.settlement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            referenceNumber: 'SET-3021',
            totalUtilized: 500,
          }),
        }),
      );
    });
  });

  describe('approve', () => {
    it('throws NotFoundException when settlement does not exist', async () => {
      mockPrisma.settlement.findUnique.mockResolvedValue(null);
      await expect(service.approve('bad-id', 'dir1', {})).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when status is not Pending_Review', async () => {
      mockPrisma.settlement.findUnique.mockResolvedValue({ id: '1', status: 'Approved' });
      await expect(service.approve('1', 'dir1', {})).rejects.toThrow(BadRequestException);
    });

    it('runs transaction to update status and log the action', async () => {
      mockPrisma.settlement.findUnique.mockResolvedValue({ id: '1', status: 'Pending_Review' });
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.settlement.update.mockResolvedValue({ id: '1', status: 'Approved' });
      mockPrisma.approvalLog.create.mockResolvedValue({});
      const result = await service.approve('1', 'dir1', { comments: 'All good' });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.approvalLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'Approved', actorId: 'dir1' }) }),
      );
      expect(result.status).toBe('Approved');
    });
  });

  describe('returnSettlement', () => {
    it('runs transaction and sets status to Returned_for_Revision', async () => {
      mockPrisma.settlement.findUnique.mockResolvedValue({ id: '1', status: 'Pending_Review' });
      mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
      mockPrisma.settlement.update.mockResolvedValue({ id: '1', status: 'Returned_for_Revision' });
      mockPrisma.approvalLog.create.mockResolvedValue({});
      const result = await service.returnSettlement('1', 'dir1', { comments: 'Blurry receipt' });
      expect(result.status).toBe('Returned_for_Revision');
      expect(mockPrisma.approvalLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'Returned for Revision' }) }),
      );
    });
  });
});
