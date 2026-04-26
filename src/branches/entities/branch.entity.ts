import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany
} from 'typeorm';
import { BranchUser } from './branch-user.entity';
import { StockLocation } from './stock-location.entity';
import { CashRegister } from 'src/cash/entities/cash-register.entity';
import { Order } from 'src/orders/entities/order.entity';

export enum BranchType {
  BRANCH = 'branch',
  WAREHOUSE = 'warehouse',
  TRANSIT = 'transit'
}

@Entity('branches')
export class Branch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({
    type: 'enum',
    enum: BranchType,
    default: BranchType.BRANCH
  })
  type: BranchType;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  openingHours?: {
    monday?: { open: string; close: string };
    tuesday?: { open: string; close: string };
    wednesday?: { open: string; close: string };
    thursday?: { open: string; close: string };
    friday?: { open: string; close: string };
    saturday?: { open: string; close: string };
    sunday?: { open: string; close: string };
  };

  @Column({ nullable: true })
  managerId?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  openingBalance: number;

  @Column({ default: false })
  restrictSalesToBranchStock: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // === Relaciones ===
  @OneToMany(() => BranchUser, (branchUser) => branchUser.branch)
  branchUsers: BranchUser[];

  @OneToMany(() => StockLocation, (stockLocation) => stockLocation.branch)
  stockLocations: StockLocation[];

  @OneToMany(() => CashRegister, (cashRegister) => cashRegister.branch)
  cashRegisters: CashRegister[];

  @OneToMany(() => Order, (order) => order.branch)
  orders: Order[];
}
