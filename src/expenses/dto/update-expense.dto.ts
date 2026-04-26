import { PartialType } from '@nestjs/swagger';
import { CreateVariableExpenseDto } from './create-variable-expense.dto';

export class UpdateExpenseDto extends PartialType(CreateVariableExpenseDto) {}
