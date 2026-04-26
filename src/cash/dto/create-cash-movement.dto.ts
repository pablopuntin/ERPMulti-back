import {

  IsEnum,

  IsNumber,

  IsOptional,

  IsString,

  IsUUID

} from 'class-validator';

import { CashMovementType } from '../entities/cash-movement.entity';



export class CreateCashMovementDto {

  @IsUUID()

  registerId: string;



  @IsEnum(CashMovementType)

  type: CashMovementType;



  @IsNumber()

  amount: number;



  @IsOptional()

  @IsString()

  reason?: string;

}

