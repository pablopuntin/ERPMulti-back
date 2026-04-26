import { PartialType } from '@nestjs/swagger';
import { CreatePriceChangeHistoryDto } from './create-price-history.dto';

export class UpdatePriceHistoryDto extends PartialType(
  CreatePriceChangeHistoryDto
) {}
