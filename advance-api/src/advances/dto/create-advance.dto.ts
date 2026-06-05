import { IsNumber, IsString, IsPositive, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateAdvanceDto {
  @ApiProperty({ example: 5000, description: 'Requested amount' })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @Min(1)
  amount: number;

  @ApiProperty({ example: 'Field trip to Batangas' })
  @IsString()
  purpose: string;
}
