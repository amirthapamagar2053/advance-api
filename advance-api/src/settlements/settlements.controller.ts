import {
  Controller, Get, Post, Patch, Body, Param,
  UseGuards, UseInterceptors, UploadedFiles, BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody, ApiResponse } from '@nestjs/swagger';
import { SettlementsService } from './settlements.service';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { SettlementActionDto } from './dto/settlement-action.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('settlements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settlements')
export class SettlementsController {
  constructor(private settlements: SettlementsService) {}

  @Post()
  @Roles('employee')
  @UseInterceptors(
    FilesInterceptor('receipts', 20, {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only images and PDFs are allowed'), false);
        }
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Submit a settlement with expense receipts' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['advanceRequestId', 'expenses', 'receipts'],
      properties: {
        advanceRequestId: { type: 'string', format: 'uuid' },
        expenses: {
          type: 'string',
          description: 'JSON array: [{"expenseType":"Travel","amount":500}, ...]',
          example: '[{"expenseType":"Travel","amount":500}]',
        },
        receipts: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Settlement created' })
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateSettlementDto,
    @Body('expenses') expensesJson: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    let parsed: { expenseType: string; amount: number }[];
    try {
      parsed = JSON.parse(expensesJson);
    } catch {
      throw new BadRequestException('expenses must be a valid JSON string');
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new BadRequestException('expenses must be a non-empty array');
    }
    if (!files || files.length !== parsed.length) {
      throw new BadRequestException('Number of receipts must match number of expenses');
    }
    const expenses = parsed.map((e, i) => ({ ...e, file: files[i] }));
    return this.settlements.create(user.id, dto.advanceRequestId, expenses);
  }

  @Get()
  @Roles('employee')
  @ApiOperation({ summary: 'List own settlements' })
  findOwn(@CurrentUser() user: any) {
    return this.settlements.findOwn(user.id);
  }

  // IMPORTANT: 'pending' must be declared BEFORE ':id' to avoid route collision
  @Get('pending')
  @Roles('finance_director')
  @ApiOperation({ summary: 'List all Pending_Review settlements (finance director view)' })
  findPending() {
    return this.settlements.findPending();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get settlement with expenses and original advance details' })
  findOne(@Param('id') id: string) {
    return this.settlements.findOne(id);
  }

  @Patch(':id/approve')
  @Roles('finance_director')
  @ApiOperation({ summary: 'Approve a Pending_Review settlement' })
  approve(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: SettlementActionDto) {
    return this.settlements.approve(id, user.id, dto);
  }

  @Patch(':id/return')
  @Roles('finance_director')
  @ApiOperation({ summary: 'Return settlement for revision' })
  returnSettlement(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: SettlementActionDto) {
    return this.settlements.returnSettlement(id, user.id, dto);
  }
}
