import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { SupabaseStorageService } from './supabase-storage.service';
import { SettlementStatus } from '@prisma/client';
import { SettlementActionDto } from './dto/settlement-action.dto';
import { ExpenseInput } from './dto/create-settlement.dto';

@Injectable()
export class SettlementsService {
  constructor(
    private prisma: PrismaService,
    private storage: SupabaseStorageService,
  ) {}

  async create(employeeId: string, advanceRequestId: string, expenses: ExpenseInput[]) {
    const advance = await this.prisma.advanceRequest.findUnique({ where: { id: advanceRequestId } });
    if (!advance) throw new NotFoundException('Advance request not found');
    if (advance.employeeId !== employeeId) throw new ForbiddenException();
    if (advance.status !== 'Approved') {
      throw new BadRequestException('Advance must be Approved before submitting a settlement');
    }

    const seq = await this.prisma.$queryRaw<[{ nextval: bigint }]>`
      SELECT nextval('settlement_seq')
    `;
    const referenceNumber = `SET-${String(seq[0].nextval)}`;

    const uploadedExpenses = await Promise.all(
      expenses.map(async (e) => {
        const receiptUrl = await this.storage.uploadFile(
          e.file.buffer,
          e.file.originalname,
          e.file.mimetype,
        );
        return { expenseType: e.expenseType, amount: e.amount, receiptUrl };
      }),
    );

    const totalUtilized = uploadedExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

    return this.prisma.settlement.create({
      data: {
        referenceNumber,
        advanceRequestId,
        employeeId,
        totalUtilized,
        expenses: { create: uploadedExpenses },
      },
      include: { expenses: true },
    });
  }

  findOwn(employeeId: string) {
    return this.prisma.settlement.findMany({
      where: { employeeId },
      include: { expenses: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findPending() {
    return this.prisma.settlement.findMany({
      where: { status: SettlementStatus.Pending_Review },
      include: {
        expenses: true,
        employee: { select: { id: true, name: true, email: true } },
        advanceRequest: { select: { requestNumber: true, amount: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id },
      include: {
        expenses: true,
        employee: { select: { id: true, name: true, email: true } },
        advanceRequest: { select: { requestNumber: true, amount: true, purpose: true } },
        approvalLogs: {
          include: { actor: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!settlement) throw new NotFoundException('Settlement not found');
    return settlement;
  }

  approve(id: string, actorId: string, dto: SettlementActionDto) {
    return this.action(id, actorId, SettlementStatus.Approved, 'Approved', dto.comments);
  }

  returnSettlement(id: string, actorId: string, dto: SettlementActionDto) {
    return this.action(id, actorId, SettlementStatus.Returned_for_Revision, 'Returned for Revision', dto.comments);
  }

  private async action(
    id: string,
    actorId: string,
    status: SettlementStatus,
    action: string,
    comments?: string,
  ) {
    const settlement = await this.prisma.settlement.findUnique({ where: { id } });
    if (!settlement) throw new NotFoundException('Settlement not found');
    if (settlement.status !== SettlementStatus.Pending_Review) {
      throw new BadRequestException('Only Pending_Review settlements can be actioned');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.settlement.update({ where: { id }, data: { status } });
      await tx.approvalLog.create({ data: { settlementId: id, action, actorId, comments } });
      return updated;
    });
  }
}
