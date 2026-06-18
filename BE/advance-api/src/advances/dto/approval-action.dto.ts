import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ApprovalActionDto {
  @ApiPropertyOptional({ example: 'Amount exceeds department budget' })
  @IsOptional()
  @IsString()
  comments?: string;
}
