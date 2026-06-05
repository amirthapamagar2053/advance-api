import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AdvancesService } from './advances.service';
import { CreateAdvanceDto } from './dto/create-advance.dto';
import { ApprovalActionDto } from './dto/approval-action.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('advances')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('advances')
export class AdvancesController {
  constructor(private advances: AdvancesService) {}

  @Post()
  @Roles('employee')
  @ApiOperation({ summary: 'Create a new advance request (Draft)' })
  @ApiResponse({ status: 201, description: 'Advance request created' })
  create(@CurrentUser() user: any, @Body() dto: CreateAdvanceDto) {
    return this.advances.create(user.id, dto);
  }

  @Get()
  @Roles('employee')
  @ApiOperation({ summary: 'List own advance requests' })
  findOwn(@CurrentUser() user: any) {
    return this.advances.findOwn(user.id);
  }

  // IMPORTANT: 'pending' must be declared BEFORE ':id' to avoid route collision
  @Get('pending')
  @Roles('supervisor', 'finance_manager')
  @ApiOperation({ summary: 'List all Pending_Supervisor requests (manager view)' })
  findPending() {
    return this.advances.findPending();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single advance request by ID' })
  findOne(@Param('id') id: string) {
    return this.advances.findOne(id);
  }

  @Patch(':id/submit')
  @Roles('employee')
  @ApiOperation({ summary: 'Submit a Draft advance request to supervisor' })
  submit(@Param('id') id: string, @CurrentUser() user: any) {
    return this.advances.submit(id, user.id);
  }

  @Patch(':id/approve')
  @Roles('supervisor', 'finance_manager')
  @ApiOperation({ summary: 'Approve a Pending_Supervisor advance request' })
  approve(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: ApprovalActionDto) {
    return this.advances.approve(id, user.id, dto);
  }

  @Patch(':id/reject')
  @Roles('supervisor', 'finance_manager')
  @ApiOperation({ summary: 'Reject a Pending_Supervisor advance request' })
  reject(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: ApprovalActionDto) {
    return this.advances.reject(id, user.id, dto);
  }

  @Patch(':id/return')
  @Roles('supervisor', 'finance_manager')
  @ApiOperation({ summary: 'Return a Pending_Supervisor advance request to employee' })
  returnAdvance(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: ApprovalActionDto) {
    return this.advances.returnRequest(id, user.id, dto);
  }
}
