import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';

export enum OperationAttemptStatus {
  STARTED = 'started',
  COMMITTED = 'committed',
  PDF_FAILED = 'pdf_failed',
  FAILED_ROLLED_BACK = 'failed_rolled_back'
}

@Entity('operation_attempts')
@Index('idx_operation_attempts_key', ['operationKey'], { unique: true })
@Index('idx_operation_attempts_status', ['status'])
export class OperationAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  operationType: string;

  @Column()
  operationKey: string;

  @Column({ nullable: true })
  branchId?: string;

  @Column({ nullable: true })
  userId?: string;

  @Column({ type: 'text', nullable: true })
  requestHash?: string;

  @Column({
    type: 'enum',
    enum: OperationAttemptStatus,
    default: OperationAttemptStatus.STARTED
  })
  status: OperationAttemptStatus;

  @Column({ nullable: true })
  orderId?: string;

  @Column({ nullable: true })
  saleId?: string;

  @Column({ nullable: true })
  remitoId?: string;

  @Column({ nullable: true })
  paymentId?: string;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'jsonb', nullable: true })
  resultSnapshot?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
