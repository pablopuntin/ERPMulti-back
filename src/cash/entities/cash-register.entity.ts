import {

  Entity,

  PrimaryGeneratedColumn,

  Column,

  OneToMany,

  CreateDateColumn,

  ManyToOne,

  JoinColumn

} from 'typeorm';

import { CashMovement } from './cash-movement.entity';

import { Branch } from '../../branches/entities/branch.entity';



@Entity({ name: 'cash_registers' })

export class CashRegister {

  @PrimaryGeneratedColumn('uuid')

  id: string;



  @Column({ nullable: true })

  branchId?: string;



  @CreateDateColumn()

  openedAt: Date;



  @Column({ type: 'timestamp', nullable: true })

  closedAt?: Date;



  @Column({ type: 'decimal', default: 0 })

  openingBalance: number;



  @Column({ type: 'decimal', default: 0 })

  closingBalance: number;



  @Column({ default: false })

  isClosed: boolean;



  @OneToMany(() => CashMovement, (movement) => movement.register)

  movements: CashMovement[];



  @ManyToOne(() => Branch, { nullable: true })

  @JoinColumn({ name: 'branchId' })

  branch?: Branch;

}

