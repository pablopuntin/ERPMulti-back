import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  Index
} from 'typeorm';
import { CashRegister } from './cash-register.entity';

export enum CashMovementType {
  INCOME = 'income',
  EXPENSE = 'expense',
  ADJUSTMENT = 'adjustment'
}

@Entity({ name: 'cash_movements' })
@Index('UQ_cash_movements_payment_id', ['paymentId'], {
  unique: true,
  where: 'payment_id IS NOT NULL'
})
export class CashMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CashRegister, (register) => register.movements, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'register_id' })
  register: CashRegister;

  @Column({ type: 'enum', enum: CashMovementType })
  type: CashMovementType;

  @Column('decimal')
  amount: number;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId?: string;

  @CreateDateColumn()
  createdAt: Date;
}
