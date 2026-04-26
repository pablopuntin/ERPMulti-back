import { PartialType } from '@nestjs/swagger';
import { CreateStockMovementDto } from './create-stock.dto';
export class UpdateStockMovementDto extends PartialType(
  CreateStockMovementDto
) {}
