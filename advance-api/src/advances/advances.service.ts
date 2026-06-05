import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AdvanceStatus } from '@prisma/client';
import { CreateAdvanceDto } from './dto/create-advance.dto';
import { ApprovalActionDto } from './dto/approval-action.dto';

@Injectable()
export class AdvancesService {
  constructor(private prisma: PrismaService) {}

  async create(employeeId: string, dto: CreateAdvanceDto) {
    const seq = await this.prisma.$queryRaw<[{ nextval: bigint }]>`
      SELECT nextval('advance_request_seq')
    `;
    const requestNumber = `ADV-${seq[0].nextval}`;
    return this.prisma.advanceRequest.create({
      data: { requestNumber, employeeId, amount: dto.amount, purpose: dto.purpose },
    });
  }

  findOwn(employeeId: string) {
    return this.prisma.advanceRequest.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findPending() {
    return this.prisma.advanceRequest.findMany({
      where: { status: AdvanceStatus.Pending_Supervisor },
      include: { employee: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const advance = await this.prisma.advanceRequest.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, name: true, email: true } },
        approvalLogs: {
          include: { actor: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!advance) throw new NotFoundException('Advance request not found');
    return advance;
  }

  async submit(id: string, employeeId: string) {
    const advance = await this.prisma.advanceRequest.findUnique({ where: { id } });
    if (!advance) throw new NotFoundException('Advance request not found');
    if (advance.employeeId !== employeeId) throw new ForbiddenException();
    if (advance.status !== AdvanceStatus.Draft) {
      throw new BadRequestException('Only Draft requests can be submitted');
    }
    return this.prisma.advanceRequest.update({
      where: { id },
      data: { status: AdvanceStatus.Pending_Supervisor },
    });
  }

  approve(id: string, actorId: string, dto: ApprovalActionDto) {
    return this.action(id, actorId, AdvanceStatus.Approved, 'Approved', dto.comments);
  }

  reject(id: string, actorId: string, dto: ApprovalActionDto) {
    return this.action(id, actorId, AdvanceStatus.Rejected, 'Rejected', dto.comments);
  }

  returnRequest(id: string, actorId: string, dto: ApprovalActionDto) {
    return this.action(id, actorId, AdvanceStatus.Returned, 'Returned', dto.comments);
  }

  private async action(
    id: string,
    actorId: string,
    status: AdvanceStatus,
    action: string,
    comments?: string,
  ) {
    const advance = await this.prisma.advanceRequest.findUnique({ where: { id } });
    if (!advance) throw new NotFoundException('Advance request not found');
    if (advance.status !== AdvanceStatus.Pending_Supervisor) {
      throw new BadRequestException('Only Pending_Supervisor requests can be actioned');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.advanceRequest.update({ where: { id }, data: { status } });
      await tx.approvalLog.create({ data: { advanceRequestId: id, action, actorId, comments } });
      return updated;
    });
  }
}
