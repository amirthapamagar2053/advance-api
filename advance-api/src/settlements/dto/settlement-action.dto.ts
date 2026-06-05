import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SettlementActionDto {
  @ApiPropertyOptional({ example: 'The travel receipt is blurry, please re-upload.' })
  @IsOptional()
  @IsString()
  comments?: string;
}
