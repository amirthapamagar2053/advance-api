import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSettlementDto {
  @ApiProperty({ description: 'ID of the approved AdvanceRequest' })
  @IsUUID()
  advanceRequestId: string;
}

export interface ExpenseInput {
  expenseType: string;
  amount: number;
  file: Express.Multer.File;
}
