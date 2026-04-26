import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn
} from 'typeorm';
import { Branch } from './branch.entity';
import { User } from 'src/users/entities/user.entity';

export enum BranchUserRole {
  EMPLOYEE = 'employee', // Vendedor
  CASHIER = 'cashier', // Cajero
  MANAGER = 'manager', // Gerente Local
  GENERAL_MANAGER = 'general_manager' // Gerente General
}

@Entity('branch_users')
export class BranchUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: BranchUserRole
  })
  role: BranchUserRole;

  @Column({ type: 'jsonb', nullable: true })
  permissions?: {
    canViewAllBranches?: boolean;
    canManageProducts?: boolean;
    canManageUsers?: boolean;
    canViewReports?: boolean;
    canManageCash?: boolean;
    canManageExpenses?: boolean;
  };

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  notes?: string;

  @CreateDateColumn()
  assignedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // === Relaciones ===
  @ManyToOne(() => Branch, (branch) => branch.branchUsers, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'branch_id' })
  branch: Branch;

  @ManyToOne(() => User, (user) => user.branchAssignments, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
