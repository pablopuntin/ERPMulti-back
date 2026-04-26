import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import { ProductVariant } from 'src/products-variants/entities/products-variant.entity';
import { User } from 'src/users/entities/user.entity';
import { Branch } from 'src/branches/entities/branch.entity';
import { StockLocationType } from 'src/branches/entities/stock-location.entity';

export enum StockTransferStatus {
  COMPLETED = 'completed'
}

@Entity({ name: 'stock_transfers' })
export class StockTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: StockTransferStatus,
    default: StockTransferStatus.COMPLETED
  })
  status: StockTransferStatus;

  @Column({
    type: 'enum',
    enum: StockLocationType
  })
  fromLocationType: StockLocationType;

  @ManyToOne(() => Branch, {
    nullable: true,
    eager: true,
    onDelete: 'SET NULL'
  })
  @JoinColumn({ name: 'from_branch_id' })
  fromBranch?: Branch | null;

  @Column({
    type: 'enum',
    enum: StockLocationType
  })
  toLocationType: StockLocationType;

  @ManyToOne(() => Branch, {
    nullable: true,
    eager: true,
    onDelete: 'SET NULL'
  })
  @JoinColumn({ name: 'to_branch_id' })
  toBranch?: Branch | null;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @Column({ type: 'int', default: 0 })
  originQuantityBefore: number;

  @Column({ type: 'int', default: 0 })
  originQuantityAfter: number;

  @Column({ type: 'int', default: 0 })
  destinationQuantityBefore: number;

  @Column({ type: 'int', default: 0 })
  destinationQuantityAfter: number;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => ProductVariant, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;

  @ManyToOne(() => User, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy?: User | null;
}
